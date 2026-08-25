import GPTrans from '../index.js';

const dbPath = new URL('../db', import.meta.url).pathname;

try {
    const gptrans = new GPTrans({
        path: dbPath,
        target: 'ar',
        from: 'es',
    });

    console.log(gptrans.t('Cargando...'));
} catch (e) {
    console.error(e);
}
