import GPTrans from '../index.js';

const gptrans = new GPTrans({
    model: 'claude-3-5-sonnet-20241022',
});

console.log(gptrans.t('Hello, {name}!', { name: 'Anya' }));

console.log(gptrans.t('Top-up'));
console.log(gptrans.t('Transfer'));
console.log(gptrans.t('Deposit'));
console.log(gptrans.t('Balance'));
console.log(gptrans.t('Transaction'));
console.log(gptrans.t('Account'));
console.log(gptrans.t('Card'));

// Case 2: Translate from Spanish Spain to Spanish Argentina
const es2ar = new GPTrans({
    from: 'es-ES',
    target: 'es-AR',
    model: 'claude-3-5-sonnet-20241022',
});

console.log(es2ar.t('Eres muy bueno'));
console.log(es2ar.setContext('El mensaje es para una mujer').t('Eres muy bueno'));
console.log(es2ar.setContext().t('Tienes fuego?'));

// Case 3
const ar2es = new GPTrans({
    from: 'es-AR',
    target: 'es-ES',
    model: 'claude-3-5-sonnet-20241022',
});

console.log(ar2es.t('¿Tenés fuego?'));

