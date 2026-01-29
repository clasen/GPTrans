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
    static #translationLocks = new Map();

    static mmix(models = 'sonnet45', { debug = false } = {}) {
        const key = Array.isArray(models) ? models.join(',') : models;

        if (!this.#mmixInstances.has(key)) {
            const mmix = new ModelMix({
                config: {
                    max_history: 1,
                    debug,
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

    static async #acquireTranslationLock(modelKey) {
        if (!this.#translationLocks.has(modelKey)) {
            this.#translationLocks.set(modelKey, Promise.resolve());
        }

        const previousLock = this.#translationLocks.get(modelKey);
        let releaseLock;

        const currentLock = new Promise(resolve => {
            releaseLock = resolve;
        });

        this.#translationLocks.set(modelKey, previousLock.then(() => currentLock));

        await previousLock;
        return releaseLock;
    }

    static isLanguageAvailable(langCode) {
        return isLanguageAvailable(langCode);
    }

    constructor({ from = 'en-US', target = 'es', model = 'sonnet45', batchThreshold = 1500, debounceTimeout = 500, promptFile = null, name = '', context = '', freeze = false, debug = false } = {}) {

        target = this.normalizeBCP47(target);
        from = this.normalizeBCP47(from);

        try {
            dotenv.config();
        } catch (e) {

        }

        const path = new URL('../../db', import.meta.url).pathname;
        const namePrefix = name ? '_' + name : '';
        this.dbPath = path;
        this.instanceName = name;
        this.dbTarget = new DeepBase({ name: 'gptrans' + namePrefix + '_' + target, path });
        this.dbFrom = new DeepBase({ name: 'gptrans' + namePrefix + '_from_' + from, path });

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
        this.isProcessingBatch = false; // Track if a batch is currently being processed
        this.modelMixOptions = { debug };
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
            const capturedContext = this.context;
            this._processBatch(capturedContext);
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
            this.dbFrom.set('_context', contextHash, this.context);
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

            // Set new timer - capture context at scheduling time
            const capturedContext = this.context;
            this.debounceTimer = setTimeout(() => {
                if (this.pendingTranslations.size > 0) {
                    this._processBatch(capturedContext);
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
        GPTrans.mmix(this.modelKey, this.modelMixOptions).limiter.updateSettings({ minTime });

        this.pendingCharCount = 0;

        // Load references for each text in the batch if preloadReferences is set
        const batchReferences = {};
        if (this.preloadReferences && this.preloadReferences.length > 0) {
            batch.forEach(([key]) => {
                const refs = this._loadReferenceTranslations(key, this.preloadReferences);
                if (Object.keys(refs).length > 0) {
                    batchReferences[key] = refs;
                }
            });
        }

        const textsToTranslate = batch.map(([_, text]) => text).join(`\n${this.divider}\n`);
        try {
            const translations = await this._translate(textsToTranslate, batch, batchReferences, this.preloadBaseLanguage);
            
            // Try different split strategies to be more robust
            let translatedTexts = translations.split(`\n${this.divider}\n`);
            
            // If split doesn't match batch size, try alternative separators
            if (translatedTexts.length !== batch.length) {
                // Try without newlines around divider
                translatedTexts = translations.split(this.divider);
                
                // If still doesn't match, try with just newline
                if (translatedTexts.length !== batch.length) {
                    translatedTexts = translations.split(/\n{2,}/); // Split by multiple newlines
                }
            }

            const contextHash = this._hash(context);
            
            // Validate we have the right number of translations
            if (translatedTexts.length !== batch.length) {
                console.error(`❌ Translation count mismatch:`);
                console.error(`   Expected: ${batch.length} translations`);
                console.error(`   Received: ${translatedTexts.length} translations`);
                console.error(`   Batch keys: ${batch.map(([key]) => key).join(', ')}`);
                console.error(`\n📝 Full response from model:\n${translations}\n`);
                
                // Try to save what we can
                const minLength = Math.min(translatedTexts.length, batch.length);
                for (let i = 0; i < minLength; i++) {
                    if (translatedTexts[i] && translatedTexts[i].trim()) {
                        this.dbTarget.set(contextHash, batch[i][0], translatedTexts[i].trim());
                    }
                }
                return;
            }

            batch.forEach(([key], index) => {
                if (!translatedTexts[index] || !translatedTexts[index].trim()) {
                    console.error(`❌ No translation found for ${key} at index ${index}`);
                    console.error(`   Original text: ${batch[index][1]}`);
                    return;
                }

                this.dbTarget.set(contextHash, key, translatedTexts[index].trim());
            });

        } catch (e) {
            console.error('❌ Error in _processBatch:', e.message);
            console.error(e.stack);
        }
    }

    async _translate(text, batch = [], batchReferences = {}, baseLanguage = null) {
        // Acquire lock to ensure atomic model configuration and translation
        const releaseLock = await GPTrans.#acquireTranslationLock(this.modelKey);

        try {
            const model = GPTrans.mmix(this.modelKey, this.modelMixOptions);

            model.setSystem("You are an expert translator specialized in literary translation between FROM_LANG and TARGET_DENONYM TARGET_LANG.");

            // Read and process prompt file
            let promptContent = fs.readFileSync(this.promptFile, 'utf-8');

            // Format references if available
            let referencesText = '';
            if (Object.keys(batchReferences).length > 0 && batch.length > 0) {
                // Group all references by language first
                const refsByLang = {};
                
                batch.forEach(([key], index) => {
                    if (batchReferences[key]) {
                        Object.entries(batchReferences[key]).forEach(([lang, translation]) => {
                            if (!refsByLang[lang]) {
                                refsByLang[lang] = [];
                            }
                            refsByLang[lang].push(translation);
                        });
                    }
                });
                
                // Format: one language header, then all its translations with bullets
                const refBlocks = Object.entries(refsByLang).map(([lang, translations]) => {
                    try {
                        const langInfo = isoAssoc(lang);
                        const header = `### ${langInfo.DENONYM} ${langInfo.LANG} (${lang}):`;
                        const content = translations.map(t => `- ${t}`).join('\n');
                        return `${header}\n${content}`;
                    } catch (e) {
                        const header = `### ${lang}:`;
                        const content = translations.map(t => `- ${t}`).join('\n');
                        return `${header}\n${content}`;
                    }
                });
                
                referencesText = refBlocks.join(`\n\n`);
            }

            // Remove reference section if no references
            if (!referencesText) {
                // Remove the entire "Reference Translations" section
                promptContent = promptContent.replace(
                    /## Reference Translations \(for context\)[\s\S]*?(?=\n#|$)/,
                    ''
                );
            }

            // Determine which FROM_ values to use
            let fromReplace = this.replaceFrom;
            if (baseLanguage) {
                try {
                    fromReplace = isoAssoc(baseLanguage, 'FROM_');
                } catch (e) {
                    console.warn(`Invalid baseLanguage: ${baseLanguage}, using default`);
                }
            }

            // Apply replacements to prompt
            promptContent = promptContent
                .replace(/INPUT/g, text)
                .replace(/CONTEXT/g, this.context)
                .replace(/REFERENCES/g, referencesText);

            // Apply language-specific replacements
            Object.entries(this.replaceTarget).forEach(([key, value]) => {
                promptContent = promptContent.replace(new RegExp(key, 'g'), value);
            });
            Object.entries(fromReplace).forEach(([key, value]) => {
                promptContent = promptContent.replace(new RegExp(key, 'g'), value);
            });

            model.addText(promptContent);

            const response = await model.message();

            // Extract content from code block if present
            const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/;
            const match = response.match(codeBlockRegex);
            const translatedText = match ? match[1].trim() : response.trim();

            return translatedText;

        } finally {
            // Always release the lock
            releaseLock();
        }
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

    _loadReferenceTranslations(key, referenceLangs = []) {
        const references = {};
        const contextHash = this._hash(this.context);

        for (const lang of referenceLangs) {
            const namePrefix = this.instanceName ? '_' + this.instanceName : '';
            const dbRef = new DeepBase({
                name: `gptrans${namePrefix}_${lang}`,
                path: this.dbPath
            });

            const translation = dbRef.get(contextHash, key);
            if (translation) {
                references[lang] = translation;
            }
        }

        return references;
    }

    async preload({ references = [], baseLanguage = null } = {}) {

        if (!this.context && this.replaceFrom.FROM_ISO === this.replaceTarget.TARGET_ISO) {
            return this;
        }

        // Filter out invalid references
        const validReferences = references.filter(lang => {
            const normalizedLang = this.normalizeBCP47(lang);
            // Don't include target language as reference (we're translating TO it)
            if (normalizedLang === this.replaceTarget.TARGET_ISO) {
                console.warn(`Ignoring reference language '${lang}': cannot use target language as reference`);
                return false;
            }
            // Don't include baseLanguage as reference (redundant)
            if (baseLanguage && normalizedLang === this.normalizeBCP47(baseLanguage)) {
                console.warn(`Ignoring reference language '${lang}': same as baseLanguage`);
                return false;
            }
            return true;
        });

        // Store preload options for use in translation
        this.preloadReferences = validReferences;
        this.preloadBaseLanguage = baseLanguage;

        // Track which keys need translation
        const keysNeedingTranslation = [];
        
        for (const [context, pairs] of this.dbFrom.entries()) {
            // Skip the _context metadata
            if (context === '_context') continue;
            
            this.setContext(context);
            const contextHash = this._hash(context);
            
            for (const [key, text] of Object.entries(pairs)) {
                // Check if translation already exists
                if (!this.dbTarget.get(contextHash, key)) {
                    keysNeedingTranslation.push({ context, contextHash, key });
                    // Only call get() if translation doesn't exist
                    this.get(key, text);
                }
            }
        }

        // If nothing needs translation, return immediately
        if (keysNeedingTranslation.length === 0) {
            this.preloadReferences = [];
            this.preloadBaseLanguage = null;
            return this;
        }

        // Wait for any pending translations to complete
        // No global timeout - each translation request has its own timeout
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                // Check if there are still pending translations or batch being processed
                const hasPending = this.pendingTranslations.size > 0 || this.isProcessingBatch;
                
                // Check if all needed translations are now complete
                let allTranslated = true;
                for (const { contextHash, key } of keysNeedingTranslation) {
                    if (!this.dbTarget.get(contextHash, key)) {
                        allTranslated = false;
                        break;
                    }
                }
                
                if (allTranslated && !hasPending) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });

        // Clear preload options after completion
        this.preloadReferences = [];
        this.preloadBaseLanguage = null;

        return this;
    }

    setFreeze(freeze = true) {
        this.freeze = freeze;
        return this;
    }

    async purge() {
        // Iterate through dbTarget and remove keys that don't exist in dbFrom
        for (const [contextHash, pairs] of this.dbTarget.entries()) {
            for (const key of Object.keys(pairs)) {

                const context = this.dbFrom.get('_context', contextHash);
                if (!this.dbFrom.get(context, key)) {
                    console.log(contextHash, key);
                    await this.dbTarget.del(contextHash, key);
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