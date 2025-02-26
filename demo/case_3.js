import GPTrans from '../index.js';

try {
    const gptrans = new GPTrans({
        target: 'ar',
        from: 'es',
    });

    console.log(gptrans.t('Cargando...'));
} catch (e) {
    console.error(e);
}