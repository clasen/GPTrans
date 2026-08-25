import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import GPTrans from '../index.js';

function createMemoryDb() {
    const store = new Map();
    return {
        getSync(...keys) {
            if (keys.length === 0) {
                return Object.fromEntries(Array.from(store.entries()).map(([context, pairs]) => [
                    context,
                    Object.fromEntries(pairs.entries())
                ]));
            }
            const [context, key] = keys;
            if (keys.length === 1) {
                return Object.fromEntries(store.get(context)?.entries() ?? []);
            }
            return store.get(context)?.get(key);
        },
        set(context, key, value) {
            if (!store.has(context)) {
                store.set(context, new Map());
            }
            store.get(context).set(key, value);
        },
        entries() {
            return Array.from(store.entries()).map(([context, pairs]) => [
                context,
                Object.fromEntries(pairs.entries())
            ]);
        },
        async del(context, key) {
            const pairs = store.get(context);
            if (!pairs) {
                return;
            }
            pairs.delete(key);
            if (pairs.size === 0) {
                store.delete(context);
            }
        }
    };
}

function createTestInstance() {
    const gp = new GPTrans({
        from: 'en-US',
        target: 'es',
        debounceTimeout: 10_000,
        batchThreshold: 5000,
        path: tmpdir(),
        name: `unit_${Date.now()}_${Math.random().toString(36).slice(2)}`
    });

    gp.dbFrom = createMemoryDb();
    gp.dbTarget = createMemoryDb();

    return gp;
}

test('tAsync translates immediately and caches result', async () => {
    const gp = createTestInstance();
    let translateCalls = 0;

    gp._translate = async (text) => {
        translateCalls += 1;
        assert.equal(text, 'Hello {name}');
        return 'Hola {name}';
    };

    const first = await gp.tAsync('Hello {name}', { name: 'Martin' });
    const second = await gp.tAsync('Hello {name}', { name: 'Martin' });

    assert.equal(first, 'Hola Martin');
    assert.equal(second, 'Hola Martin');
    assert.equal(translateCalls, 1);

    if (gp.debounceTimer) {
        clearTimeout(gp.debounceTimer);
    }
});

test('tAsync removes queued batch item to avoid duplicate work', async () => {
    const gp = createTestInstance();
    let translateCalls = 0;

    gp._translate = async () => {
        translateCalls += 1;
        return 'Comprar';
    };

    const key = gp._textToKey('Buy');

    // Enqueue via sync API (batch/background path).
    const syncValue = gp.t('Buy');
    assert.equal(syncValue, 'Buy');
    assert.equal(gp.pendingTranslations.get(key), 'Buy');
    assert.equal(gp.pendingCharCount, 'Buy'.length);

    // Force immediate translation for same key.
    const asyncValue = await gp.tAsync('Buy');
    assert.equal(asyncValue, 'Comprar');

    assert.equal(translateCalls, 1);
    assert.equal(gp.pendingTranslations.has(key), false);
    assert.equal(gp.pendingCharCount, 0);

    if (gp.debounceTimer) {
        clearTimeout(gp.debounceTimer);
    }
});

test('preload translates missing keys from dbFrom into dbTarget', async () => {
    const gp = createTestInstance();
    gp.debounceTimeout = 1;
    let translateCalls = 0;

    const context = 'checkout';
    const sourceText = 'Buy now';
    const key = gp._textToKey(sourceText);
    const contextHash = gp._hash(context);

    gp.dbFrom.set(context, key, sourceText);
    gp.dbFrom.set('_context', contextHash, context);

    gp._translate = async (text) => {
        translateCalls += 1;
        assert.equal(text, sourceText);
        return 'Comprar ahora';
    };

    const originalMmix = GPTrans.mmix;
    GPTrans.mmix = () => ({
        limiter: {
            updateSettings() {
            }
        }
    });

    try {
        await gp.preload();

        assert.equal(translateCalls, 1);
        assert.equal(gp.dbTarget.getSync(contextHash, key), 'Comprar ahora');
        assert.deepEqual(gp.preloadReferences, []);
        assert.equal(gp.preloadBaseLanguage, null);
    } finally {
        GPTrans.mmix = originalMmix;
        if (gp.debounceTimer) {
            clearTimeout(gp.debounceTimer);
        }
    }
});

test('constructor requires an absolute database path', () => {
    assert.throws(() => new GPTrans(), /requires an absolute "path" option/);
    assert.throws(() => new GPTrans({ path: './db' }), /requires an absolute "path" option/);
});

test('the default model chain uses the configured efforts and renders the EJS prompt', async () => {
    const previousAnthropicKey = process.env.ANTHROPIC_API_KEY;
    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';

    try {
        const model = GPTrans.mmix();
        assert.deepEqual(
            model.models.map(({ key }) => key),
            ['claude-sonnet-5', 'gpt-5.6-luna']
        );
        assert.equal(model.models[0].provider.config.effort, 50);
        assert.equal(model.models[1].provider.config.effort, 100);

        const gp = new GPTrans({ path: tmpdir(), freeze: true, name: 'modelmix-render' });
        assert.deepEqual(gp.modelKey, ['sonnet5@50', 'gpt56luna@100']);
        model.addTextFromFile(gp.promptFile);
        model.assign({
            INPUT: 'Hello',
            CONTEXT: 'Greeting',
            INSTRUCTION: 'Be friendly',
            REFERENCES: '',
            TARGET_ISO: 'es',
            TARGET_LANG: 'Spanish',
            TARGET_COUNTRY: 'Spain',
            TARGET_DENONYM: 'Spanish',
            FROM_ISO: 'en-US',
            FROM_LANG: 'English',
            FROM_COUNTRY: 'United States',
            FROM_DENONYM: 'American'
        });
        const messages = await model.prepareMessages();
        const renderedPrompt = messages[0].content[0].text;
        assert.match(renderedPrompt, /Translation from en-US to es/);
        assert.match(renderedPrompt, /```\nHello\n```/);
        assert.doesNotMatch(renderedPrompt, /<%-\s*[A-Z_]+\s*%>/);
    } finally {
        if (previousAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
        else process.env.ANTHROPIC_API_KEY = previousAnthropicKey;
        if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = previousOpenAiKey;
    }
});

test('_translate uses assign() with the absolute built-in prompt path', async () => {
    const gp = createTestInstance();
    const originalMmix = GPTrans.mmix;
    const calls = {};
    const model = {
        setSystem(value) {
            calls.system = value;
        },
        addTextFromFile(value) {
            calls.promptFile = value;
        },
        assign(value) {
            calls.templateData = value;
        },
        async block(options) {
            calls.blockOptions = options;
            return 'Hola';
        }
    };
    GPTrans.mmix = () => model;

    try {
        assert.equal(await gp._translate('Hello'), 'Hola');
        assert.equal(path.isAbsolute(calls.promptFile), true);
        assert.equal(path.basename(calls.promptFile), 'translate.md');
        await access(calls.promptFile);
        assert.equal(calls.templateData.INPUT, 'Hello');
        assert.equal(calls.templateData.FROM_ISO, 'en-US');
        assert.equal(calls.templateData.TARGET_ISO, 'es');
        assert.match(calls.system, /<%- FROM_LANG %>/);
        assert.deepEqual(calls.blockOptions, { addSystemExtra: false });
    } finally {
        GPTrans.mmix = originalMmix;
    }
});

test('DeepBase 3.9 cache is available to synchronous translations', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gptrans-deepbase-'));
    const originalMmix = GPTrans.mmix;
    const gp = new GPTrans({
        from: 'en',
        target: 'es',
        freeze: true,
        debounceTimeout: 1,
        path: directory,
        name: 'sync-cache'
    });

    try {
        const text = 'Hello';
        const key = gp._textToKey(text);
        const contextHash = gp._hash('');
        await gp.dbTarget.set(contextHash, key, 'Hola');

        assert.equal(gp.t(text), 'Hola');
        assert.equal(gp.dbTarget.getSync(contextHash, key), 'Hola');

        gp.setFreeze(false);
        const sourceText = 'New source text';
        const sourceKey = gp._textToKey(sourceText);
        gp._translate = async () => 'Nuevo texto fuente';
        GPTrans.mmix = () => ({ limiter: { updateSettings() {} } });

        gp.t(sourceText);
        await gp.preload();

        assert.equal(gp.dbFrom.getSync('', sourceKey), sourceText);
        assert.equal(gp.dbTarget.getSync(contextHash, sourceKey), 'Nuevo texto fuente');

        let refinePromptFile;
        gp._processRefineBatch = async (entries, instruction, promptFile) => {
            assert.equal(entries.length, 2);
            assert.equal(instruction, 'Use a formal tone');
            refinePromptFile = promptFile;
        };
        await gp.refine('Use a formal tone');
        assert.equal(path.isAbsolute(refinePromptFile), true);
        assert.equal(path.basename(refinePromptFile), 'refine.md');
        await access(refinePromptFile);
    } finally {
        GPTrans.mmix = originalMmix;
        if (gp.debounceTimer) {
            clearTimeout(gp.debounceTimer);
        }
        await gp.dbTarget.dispose({ clearMemory: true, releaseInstance: true });
        await gp.dbFrom.dispose({ clearMemory: true, releaseInstance: true });
        await rm(directory, { recursive: true });
    }
});
