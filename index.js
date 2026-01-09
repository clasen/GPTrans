import DeepBase from 'deepbase';
import stringHash from 'string-hash';
import { ModelMix } from 'modelmix';
import { isoAssoc, isLanguageAvailable } from './isoAssoc.js';
import dotenv from 'dotenv';
import { GeminiGenerator } from 'genmix';
import fs from 'fs';
import path from 'path';

class GPTrans {
    static #mmixInstances = new Map();

    static mmix(models = 'sonnet45') {
        const key = Array.isArray(models) ? models.join(',') : models;

        if (!this.#mmixInstances.has(key)) {
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

            // Chain models dynamically
            let instance = mmix;
            const modelArray = Array.isArray(models) ? models : [models];

            for (const model of modelArray) {
                if (typeof instance[model] !== 'function') {
                    throw new Error(
                        `Model "${model}" is not available. Please check the model name. ` +
                        `Available models include: gpt41, gpt4o, sonnet45, sonnet37, opus41, haiku35, etc.`
                    );
                }
                instance = instance[model]();
            }

            this.#mmixInstances.set(key, instance);
        }
        return this.#mmixInstances.get(key);
    }

    static isLanguageAvailable(langCode) {
        return isLanguageAvailable(langCode);
    }

    constructor({ from = 'en-US', target = 'es', model = 'sonnet45', batchThreshold = 1500, debounceTimeout = 500, promptFile = null, name = '', context = '', freeze = false } = {}) {

        target = this.normalizeBCP47(target);
        from = this.normalizeBCP47(from);

        try {
            dotenv.config();
        } catch (e) {

        }

        const path = new URL('../../db', import.meta.url).pathname;
        name = name ? '_' + name : '';
        this.dbTarget = new DeepBase({ name: 'gptrans' + name + '_' + target, path });
        this.dbFrom = new DeepBase({ name: 'gptrans' + name + '_from_' + from, path });

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

    normalizeBCP47(iso) {
        if (iso.includes('-')) {
            return iso.split('-')[0].toLowerCase() + '-' + iso.split('-')[1].toUpperCase();
        }

        return iso.toLowerCase();
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

        if (!this.freeze && !this.dbFrom.get(this.context, key)) {
            this.dbFrom.set(this.context, key, text);
        }

        if (!translation) {

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
        GPTrans.mmix(this.modelKey).limiter.updateSettings({ minTime });

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

        const model = GPTrans.mmix(this.modelKey);

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

    purge() {
        // Iterate through dbTarget and remove keys that don't exist in dbFrom
        for (const [context, pairs] of this.dbTarget.entries()) {
            for (const key of Object.keys(pairs)) {
                if (!this.dbFrom.get(context, key)) {
                    this.dbTarget.del(context, key);
                }
            }
        }

        return this;
    }

    async img(imagePath, options = {}) {
        const {
            quality = '1K',
            numberOfImages = 1,
            prompt = null
        } = options;

        // Parse image filename and extension
        const parsedPath = path.parse(imagePath);
        const filename = parsedPath.base;
        const targetLang = this.replaceTarget.TARGET_ISO || 'en';

        // Check if image is already in a language folder
        const dirName = path.basename(path.dirname(imagePath));
        const parentDir = path.dirname(path.dirname(imagePath));

        // If the image is in a language folder (e.g., en/image.jpg)
        // create the target at the same level (e.g., es/image.jpg)
        // Otherwise, create it as a subfolder (e.g., ./image.jpg -> es/image.jpg)
        let targetDir, targetPath;

        if (this._isLanguageFolder(dirName)) {
            // Image is in a language folder: create sibling folder
            targetDir = path.join(parentDir, targetLang);
            targetPath = path.join(targetDir, filename);
        } else {
            // Image is not in a language folder: create subfolder
            targetDir = path.join(path.dirname(imagePath), targetLang);
            targetPath = path.join(targetDir, filename);
        }

        // Check if translated image already exists
        if (fs.existsSync(targetPath)) {
            return targetPath;
        }

        // Generate translated image and wait for completion
        try {
            await this._generateTranslatedImage(imagePath, targetPath, targetDir, prompt, quality, numberOfImages);
            // Return path of translated image if successful
            return targetPath;
        } catch (error) {
            // Return original path if generation fails
            return imagePath;
        }
    }

    _isLanguageFolder(folderName) {
        // Check if folder name is a valid language code
        // Common formats: en, es, pt, en-US, pt-BR, es-AR, etc.
        const languageCodePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
        return languageCodePattern.test(folderName);
    }

    async _generateTranslatedImage(imagePath, targetPath, targetDir, customPrompt, quality, numberOfImages) {
        // Initialize GeminiGenerator
        const generator = new GeminiGenerator();

        // Generate translation prompt
        const translationPrompt = customPrompt ||
            `Translate all text in this image to ${this.replaceTarget.TARGET_DENONYM} ${this.replaceTarget.TARGET_LANG}. Maintain the exact same layout, style, colors, and design. Only change the text content.`;

        // Generate translated image
        const result = await generator.generate(translationPrompt, {
            referenceImage: imagePath,
            quality: quality,
            numberOfImages: numberOfImages
        });

        if (result.images && result.images.length > 0) {
            // Create target directory if it doesn't exist
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Save translated image - preserve original file format
            const filename = path.basename(targetPath, path.extname(targetPath));
            const formatOptions = generator.getReferenceMetadata();
            await generator.save({ directory: targetDir, filename, formatOptions });
        } else {
            throw new Error('No translated image was generated');
        }
    }
}

export default GPTrans;