import GPTrans from '../index.js';


// Case 2: Translate from Spanish to English
const model = new GPTrans({
    from: 'es',
    target: 'en',
});

await model.preload();


console.log(model.setContext().t('Eres muy bueno'));
console.log(model.setContext('El mensaje es para una mujer').t('Eres muy bueno'));


console.log(model.setContext().t('Tienes fuego?'));