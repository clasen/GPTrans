import DeepBase from 'deepbase';
import stringHash from 'string-hash';
import { ModelMix, MixOpenAI, MixAnthropic } from 'modelmix';
import { isoAssoc, isLanguageAvailable } from './isoAssoc.js';
import dotenv from 'dotenv';

class GPTrans {
    static #mmixInstance = null;

    static get mmix() {
        if (!this.#mmixInstance) {
            const mmix = new ModelMix({
                config: {
                    max_history: 1,
                    debug: false,
                    bottleneck: {
                        minTime: 15000,
                        maxConcurrent: 1
                    }
                }
            });

            mmix.attach(new MixOpenAI());
            mmix.attach(new MixAnthropic());

            this.#mmixInstance = mmix;
        }
        return this.#mmixInstance;
    }

    static isLanguageAvailable(langCode) {
        return isLanguageAvailable(langCode);
    }

    constructor({ from = 'en-US', target = 'es', model = 'claude-3-7-sonnet-20250219', batchThreshold = 1500, debounceTimeout = 500, promptFile = null, context = '', freeze = false }) {

        try {
            dotenv.config();
        } catch (e) {

        }

        const path = new URL('../../db', import.meta.url).pathname;
        this.dbTarget = new DeepBase({ name: 'gptrans_' + target, path });
        this.dbFrom = new DeepBase({ name: 'gptrans_from_' + from, path });

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
        this.freeze = freeze;
        this.modelConfig = {
            options: {
                max_tokens: batchThreshold,
                temperature: 0
            }
        };
        this.divider = '------';
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

        if (!text || !text.trim()) {
            return text;
        }

        const contextHash = this._hash(this.context);
        const translation = this.dbTarget.get(contextHash, key);

        if (!translation) {

            if (!this.freeze && !this.dbFrom.get(this.context, key)) {
                this.dbFrom.set(this.context, key, text);
            }

            // Skip translation if context is empty and languages are the same
            if (!this.context && this.replaceFrom.FROM_ISO === this.replaceTarget.TARGET_ISO) {
                return text;
            }

            if (this.freeze) {
                console.log(`Freeze mode: [${key}] ${text}`);
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

        const batch = Array.from(this.pendingTranslations.entries());

        // Clear pending translations and character count before awaiting translation
        this.pendingTranslations.clear();

        this.modelConfig.options.max_tokens = this.pendingCharCount + 1000;
        const minTime = Math.floor((60000 / (8000 / this.pendingCharCount)) * 1.4);
        GPTrans.mmix.limiter.updateSettings({ minTime });

        this.pendingCharCount = 0;

        const textsToTranslate = batch.map(([_, text]) => text).join(`\n${this.divider}\n`);
        try {
            const translations = await this._translate(textsToTranslate);
            const translatedTexts = translations.split(`\n${this.divider}\n`);

            const contextHash = this._hash(context);
            batch.forEach(([key], index) => {

                if (!translatedTexts[index]) {
                    console.log(translations);
                    console.error(`No translation found for ${key}`);

                    return;
                }

                this.dbTarget.set(contextHash, key, translatedTexts[index].trim());
            });

        } catch (e) {
            console.error(e);
        }
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

    async preload() {

        if (!this.context && this.replaceFrom.FROM_ISO === this.replaceTarget.TARGET_ISO) {
            return this;
        }

        for (const [context, pairs] of this.dbFrom.entries()) {
            this.setContext(context);
            for (const [key, text] of Object.entries(pairs)) {
                this.get(key, text);
            }
        }

        // Wait for any pending translations to complete
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (this.dbFrom.keys().length === this.dbTarget.keys().length) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });

        return this;
    }

    setFreeze(freeze = true) {
        this.freeze = freeze;
        return this;
    }
}

export default GPTrans;