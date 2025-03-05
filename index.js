import DeepBase from 'deepbase';
import stringHash from 'string-hash';
import { ModelMix, MixOpenAI, MixAnthropic } from 'modelmix';
import { isoAssoc, isLanguageAvailable } from './isoAssoc.js';
import dotenv from 'dotenv';

class GPTrans {
    static #mmixInstance = null;

    static get mmix() {
        if (!this.#mmixInstance) {
            const mmix = new ModelMix();

            mmix.attach(new MixOpenAI());
            mmix.attach(new MixAnthropic());

            this.#mmixInstance = mmix;
        }
        return this.#mmixInstance;
    }

    static isLanguageAvailable(langCode) {
        return isLanguageAvailable(langCode);
    }

    constructor({ from = 'en-US', target = 'es-AR', model = 'claude-3-7-sonnet-20250219', batchThreshold = 1000, debounceTimeout = 500, promptFile = null, context = '' }) {

        try {
            dotenv.config();
        } catch (e) {

        }

        this.dbTarget = new DeepBase({ name: 'gptrans_' + target });
        this.dbFrom = new DeepBase({ name: 'gptrans_from_' + from });

        try {
            this.replaceTarget = isoAssoc(target, 'TARGET_');
            this.replaceFrom = isoAssoc(from, 'FROM_');
        } catch (e) {
            throw new Error(`Invalid target: ${target}`);
        }

        this.batchThreshold = batchThreshold; // Now represents character count threshold
        this.debounceTimeout = debounceTimeout;
        this.pendingTranslations = new Map(); // [key, text]
        this.pendingCharCount = 0; // Add character count tracker
        this.debounceTimer = null;
        this.modelKey = model;
        this.promptFile = promptFile ?? new URL('./prompt/translate.md', import.meta.url).pathname;
        this.context = context;
        this.modelConfig = {
            config: {
                max_history: 1,
                debug: false,
                bottleneck: {
                    maxConcurrent: 2,
                }
            },
            options: {
                max_tokens: batchThreshold,
                temperature: 0
            }
        };
        this.processing = false;
    }

    setContext(context = '') {
        if (this.context !== context && this.pendingTranslations.size > 0) {
            clearTimeout(this.debounceTimer);
            this._processBatch(this.context);
        }
        this.context = context;
        return this;
    }

    t(text, params = {}) {
        const key = this._textToKey(text);
        const translation = this.get(key, text) || text;

        return Object.entries(params).reduce(
            (text, [key, value]) => text.replace(`{${key}}`, value),
            translation
        );
    }

    get(key, text) {
        const contextHash = this._hash(this.context);
        const translation = this.dbTarget.get(contextHash, key);

        if (!translation) {
            if (!this.dbFrom.get(this.context, key)) {
                this.dbFrom.set(this.context, key, text);
            }

            // Skip translation if context is empty and languages are the same
            if (!this.context && this.replaceFrom.FROM_ISO === this.replaceTarget.TARGET_ISO) {
                return text;
            }

            this.pendingTranslations.set(key, text);
            this.pendingCharCount += text.length; // Update character count

            // Clear existing timer
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            // Set new timer
            this.debounceTimer = setTimeout(() => {
                if (this.pendingTranslations.size > 0) {
                    this._processBatch(this.context);
                }
            }, this.debounceTimeout);

            // Process if we hit the character count threshold
            if (this.pendingCharCount >= this.batchThreshold) {
                clearTimeout(this.debounceTimer);
                this._processBatch(this.context);
            }
        }
        return translation;
    }

    async _processBatch(context) {
        this.processing = true;

        const batch = Array.from(this.pendingTranslations.entries());

        // Clear pending translations and character count before awaiting translation
        this.pendingTranslations.clear();
        this.modelConfig.options.max_tokens = this.pendingCharCount + 1000;
        this.pendingCharCount = 0;

        const textsToTranslate = batch.map(([_, text]) => text).join('\n---\n');
        try {
            const translations = await this._translate(textsToTranslate);
            const translatedTexts = translations.split('\n---\n');

            const contextHash = this._hash(context);
            batch.forEach(([key], index) => {
                this.dbTarget.set(contextHash, key, translatedTexts[index].trim());
            });

        } catch (e) {
            console.error(e);
        }

        this.processing = false;
    }

    async _translate(text) {

        const model = GPTrans.mmix.create(this.modelKey, this.modelConfig);

        model.setSystem("You are an expert translator specialized in literary translation between FROM_LANG and TARGET_DENONYM TARGET_LANG.");

        model.addTextFromFile(this.promptFile);

        model.replace({ INPUT: text, CONTEXT: this.context });
        model.replace(this.replaceTarget);
        model.replace(this.replaceFrom);

        const response = await model.message();

        const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/;
        const match = response.match(codeBlockRegex);
        const translatedText = match ? match[1].trim() : response;

        return translatedText;
    }

    _textToKey(text, tokens = 5, maxlen = 6) {
        const words = text
            .toLowerCase()
            .replace(/[áàâäéèêëíìîïóòôöúùûüñ]/g, c => 'aeioun'['áéíóúñ'.indexOf(c.toLowerCase())] || c)
            .replace(/[^a-z0-9\s]+/g, "")
            .split(" ")
            .slice(0, tokens);

        let key = words.map((x) => x.slice(0, maxlen)).join("_");
        key += key ? '_' : '';
        key += this._hash(text);
        return key;
    }

    _hash(input) {
        return stringHash(input).toString(36);
    }

    async preload({ target = this.replaceTarget.TARGET_ISO, model = this.modelKey, from = this.replaceFrom.FROM_ISO, batchThreshold = this.batchThreshold, debounceTimeout = this.debounceTimeout } = {}) {

        // Create new GPTrans instance for the target language
        const translator = new GPTrans({
            from,
            target,
            model,
            batchThreshold,
            debounceTimeout,
        });

        // Process all entries in batches
        for (const [context, pairs] of this.dbFrom.entries()) {
            translator.setContext(context);
            for (const [key, text] of Object.entries(pairs)) {
                translator.get(key, text);
            }
        }

        // Wait for any pending translations to complete
        if (translator.pendingTranslations.size > 0) {
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (translator.processing === false && translator.pendingTranslations.size === 0) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 1000);
            });
        }

        return translator;
    }
}

export default GPTrans;