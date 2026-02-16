import test from 'node:test';
import assert from 'node:assert/strict';
import GPTrans from '../index.js';

function createMemoryDb() {
    const store = new Map();
    return {
        get(context, key) {
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
            if (!pairs) return;
            pairs.delete(key);
            if (pairs.size === 0) store.delete(context);
        }
    };
}

function createTestInstance() {
    const gp = new GPTrans({
        from: 'es',
        target: 'en-US',
        debounceTimeout: 10_000,
        batchThreshold: 50_000,
        name: `unit_${Date.now()}_${Math.random().toString(36).slice(2)}`
    });

    gp.dbFrom = createMemoryDb();
    gp.dbTarget = createMemoryDb();

    return gp;
}

const stubMmix = () => ({ limiter: { updateSettings() {} } });

// --- Split logic ---

test('_processBatch splits correctly with \\n------\\n separators', async (t) => {
    const gp = createTestInstance();
    const originalMmix = GPTrans.mmix;
    GPTrans.mmix = stubMmix;

    gp._translate = async () => 'Hello\n------\nGoodbye\n------\nThank you';

    gp.pendingTranslations.set('k1', 'Hola');
    gp.pendingTranslations.set('k2', 'Adiós');
    gp.pendingTranslations.set('k3', 'Gracias');
    gp.pendingCharCount = 15;

    await gp._processBatch('');

    const h = gp._hash('');
    assert.equal(gp.dbTarget.get(h, 'k1'), 'Hello');
    assert.equal(gp.dbTarget.get(h, 'k2'), 'Goodbye');
    assert.equal(gp.dbTarget.get(h, 'k3'), 'Thank you');

    GPTrans.mmix = originalMmix;
});

test('_processBatch falls back to split by divider without newlines', async (t) => {
    const gp = createTestInstance();
    const originalMmix = GPTrans.mmix;
    GPTrans.mmix = stubMmix;

    // Model returned divider without surrounding newlines
    gp._translate = async () => 'Hello------Goodbye------Thank you';

    gp.pendingTranslations.set('k1', 'Hola');
    gp.pendingTranslations.set('k2', 'Adiós');
    gp.pendingTranslations.set('k3', 'Gracias');
    gp.pendingCharCount = 15;

    await gp._processBatch('');

    const h = gp._hash('');
    assert.equal(gp.dbTarget.get(h, 'k1'), 'Hello');
    assert.equal(gp.dbTarget.get(h, 'k2'), 'Goodbye');
    assert.equal(gp.dbTarget.get(h, 'k3'), 'Thank you');

    GPTrans.mmix = originalMmix;
});

// --- Double-newline no longer used as fallback ---

test('_processBatch does NOT split by double newlines', async (t) => {
    const gp = createTestInstance();
    const originalMmix = GPTrans.mmix;
    GPTrans.mmix = stubMmix;

    // Response has no divider but has double newlines — old code would split by \n\n
    // and accidentally "match" 3 chunks. New code should treat this as a mismatch.
    gp._translate = async () => 'Hello world\n\nThis is a paragraph\n\nAnother paragraph';

    gp.pendingTranslations.set('k1', 'Hola');
    gp.pendingTranslations.set('k2', 'Adiós');
    gp.pendingTranslations.set('k3', 'Gracias');
    gp.pendingCharCount = 15;

    const errors = [];
    const origError = console.error;
    console.error = (...args) => errors.push(args.join(' '));

    await gp._processBatch('');

    console.error = origError;

    // Should hit mismatch path, not silently save wrong translations
    assert.ok(errors.some(e => e.includes('Translation count mismatch')));

    GPTrans.mmix = originalMmix;
});

// --- Duplicate detection ---

test('_processBatch discards batch when all translations are identical (3+)', async (t) => {
    const gp = createTestInstance();
    const originalMmix = GPTrans.mmix;
    GPTrans.mmix = stubMmix;

    gp._translate = async () =>
        'Everyone understands.\n------\nEveryone understands.\n------\nEveryone understands.\n------\nEveryone understands.';

    gp.pendingTranslations.set('k1', 'La fusión será completa');
    gp.pendingTranslations.set('k2', 'Y entonces entenderás');
    gp.pendingTranslations.set('k3', 'Qué libertad tiene el que');
    gp.pendingTranslations.set('k4', 'Todos lo entienden');
    gp.pendingCharCount = 80;

    const errors = [];
    const origError = console.error;
    console.error = (...args) => errors.push(args.join(' '));

    await gp._processBatch('');

    console.error = origError;

    const h = gp._hash('');
    // Nothing should be saved
    assert.equal(gp.dbTarget.get(h, 'k1'), undefined);
    assert.equal(gp.dbTarget.get(h, 'k2'), undefined);
    assert.equal(gp.dbTarget.get(h, 'k3'), undefined);
    assert.equal(gp.dbTarget.get(h, 'k4'), undefined);

    assert.ok(errors.some(e => e.includes('translations are identical')));

    GPTrans.mmix = originalMmix;
});

test('_processBatch allows batch of 2 with identical translations (edge case)', async (t) => {
    const gp = createTestInstance();
    const originalMmix = GPTrans.mmix;
    GPTrans.mmix = stubMmix;

    // Two items could legitimately have the same translation (e.g. synonyms)
    gp._translate = async () => 'Yes\n------\nYes';

    gp.pendingTranslations.set('k1', 'Sí');
    gp.pendingTranslations.set('k2', 'Claro que sí');
    gp.pendingCharCount = 15;

    await gp._processBatch('');

    const h = gp._hash('');
    assert.equal(gp.dbTarget.get(h, 'k1'), 'Yes');
    assert.equal(gp.dbTarget.get(h, 'k2'), 'Yes');

    GPTrans.mmix = originalMmix;
});

test('_processBatch saves partial duplicates normally', async (t) => {
    const gp = createTestInstance();
    const originalMmix = GPTrans.mmix;
    GPTrans.mmix = stubMmix;

    // Some translations are the same but not all — this is valid
    gp._translate = async () => 'Hello\n------\nHello\n------\nGoodbye';

    gp.pendingTranslations.set('k1', 'Hola');
    gp.pendingTranslations.set('k2', 'Buenos días');
    gp.pendingTranslations.set('k3', 'Adiós');
    gp.pendingCharCount = 20;

    await gp._processBatch('');

    const h = gp._hash('');
    assert.equal(gp.dbTarget.get(h, 'k1'), 'Hello');
    assert.equal(gp.dbTarget.get(h, 'k2'), 'Hello');
    assert.equal(gp.dbTarget.get(h, 'k3'), 'Goodbye');

    GPTrans.mmix = originalMmix;
});

// --- Count mismatch saves partial ---

test('_processBatch saves partial results on count mismatch', async (t) => {
    const gp = createTestInstance();
    const originalMmix = GPTrans.mmix;
    GPTrans.mmix = stubMmix;

    // Model returned only 2 translations for a batch of 3
    gp._translate = async () => 'Hello\n------\nGoodbye';

    gp.pendingTranslations.set('k1', 'Hola');
    gp.pendingTranslations.set('k2', 'Adiós');
    gp.pendingTranslations.set('k3', 'Gracias');
    gp.pendingCharCount = 15;

    const errors = [];
    const origError = console.error;
    console.error = (...args) => errors.push(args.join(' '));

    await gp._processBatch('');

    console.error = origError;

    const h = gp._hash('');
    assert.equal(gp.dbTarget.get(h, 'k1'), 'Hello');
    assert.equal(gp.dbTarget.get(h, 'k2'), 'Goodbye');
    assert.equal(gp.dbTarget.get(h, 'k3'), undefined); // Not saved

    assert.ok(errors.some(e => e.includes('Translation count mismatch')));

    GPTrans.mmix = originalMmix;
});
