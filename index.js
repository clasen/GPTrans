import DeepBase from 'deepbase';
import stringHash from 'string-hash';
import { ModelMix, MixOpenAI, MixAnthropic } from 'modelmix';
import { isoAssoc, isLanguageAvailable } from './isoAssoc.js';
import dotenv from 'dotenv';

dotenv.config();

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
        this.dbTarget = new DeepBase({ name: 'gptrans_' + target });
        this.dbFrom = new DeepBase({ name: 'gptrans_from_' + from });

        try {
            this.replace_target = isoAssoc(target, 'TARGET_');
            this.replace_from = isoAssoc(from, 'FROM_');
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
            options: { max_tokens: batchThreshold }
        };
        this.processing = false;
    }

    setContext(context = '') {
        if (this.context !== context && this.pendingTranslations.size > 0) {
            clearTimeout(this.debounceTimer);
            this._processBatch();
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
        const translation = this.dbTarget.get(key);
        if (!translation) {
            this.pendingTranslations.set(key, text);
            this.pendingCharCount += text.length; // Update character count

            if (!this.dbFrom.get(key)) {
                this.dbFrom.set(key, text);
            }

            // Clear existing timer
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            // Set new timer
            this.debounceTimer = setTimeout(() => {
                if (this.pendingTranslations.size > 0) {
                    this._processBatch();
                }
            }, this.debounceTimeout);

            // Process if we hit the character count threshold
            if (this.pendingCharCount >= this.batchThreshold) {
                clearTimeout(this.debounceTimer);
                this._processBatch();
            }
        }
        return translation;
    }

    async _processBatch() {
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

            batch.forEach(([key], index) => {
                this.dbTarget.set(key, translatedTexts[index].trim());
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
        model.replace(this.replace_target);
        model.replace(this.replace_from);

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
        key += stringHash(text + this.context).toString(36);
        return key;
    }

    async preload({ target = this.replace_target.TARGET_ISO, model = this.modelKey, from = this.replace_from.FROM_ISO, batchThreshold = this.batchThreshold, debounceTimeout = this.debounceTimeout } = {}) {

        // Create new GPTrans instance for the target language
        const translator = new GPTrans({
            from,
            target,
            model,
            batchThreshold,
            debounceTimeout,
        });

        // Process all entries in batches
        for (const [key, text] of this.dbFrom.entries()) {
            translator.get(key, text);
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