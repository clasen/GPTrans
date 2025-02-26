import GPTrans from '../index.js';

try {
    const gptrans = new GPTrans({
        target: 'it',
    });

    await gptrans.preload();
    console.log('ready');

    console.log(gptrans.t('Top-up'));
    console.log(gptrans.t('Transfer'));
    console.log(gptrans.t('Deposit'));
    console.log(gptrans.t('Balance'));
    console.log(gptrans.t('Transaction'));
    console.log(gptrans.t('Account'));
    console.log(gptrans.t('Card'));
} catch (e) {
    console.error(e);
}