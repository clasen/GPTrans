import GPTrans from '../index.js';


// Case 2: Translate from Spanish Spain to Spanish Argentina
const model = new GPTrans({
    from: 'es',
    target: 'es',
});

await model.preload();


console.log(model.setContext().t('Eres muy bueno'));
console.log(model.setContext('El mensaje es para una mujer').t('Eres muy bueno'));


console.log(model.setContext().t('Tienes fuego?'));