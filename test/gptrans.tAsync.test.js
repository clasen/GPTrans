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
