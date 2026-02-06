import GPTrans from '../index.js';

console.log('🚀 Testing GPTrans Refine\n');
console.log('='.repeat(70));

async function testRefine() {
    // Step 1: Create initial translations
    const gptrans = new GPTrans({
        from: 'en-US',
        target: 'es-AR',
        model: 'sonnet45',
        name: 'refine_test'
    });

    const texts = [
        'You have exceeded the maximum number of attempts',
        'Your session has expired, please log in again',
        'The operation was completed successfully',
        'An unexpected error occurred, please try again later',
        'Are you sure you want to delete this item?'
    ];

    console.log('\n📝 Step 1: Creating initial translations...\n');
    texts.forEach(text => {
        console.log(`   EN: ${text}`);
        console.log(`   ES: ${gptrans.t(text)}\n`);
    });

    await gptrans.preload();

    console.log('='.repeat(70));
    console.log('\n📝 Step 2: Translations before refine:\n');
    texts.forEach(text => {
        console.log(`   EN: ${text}`);
        console.log(`   ES: ${gptrans.t(text)}\n`);
    });

    // Step 2: Refine with multiple instructions in a single pass
    console.log('='.repeat(70));
    console.log('\n🔄 Step 3: Refining with multiple instructions (single API pass)...\n');

    await gptrans.refine([
        'Use "vos" instead of "tú" for all second-person references',
        'Use a more friendly and colloquial tone, less robotic',
        'Shorten messages where possible without losing clarity'
    ]);

    console.log('📝 Translations after refine:\n');
    texts.forEach(text => {
        console.log(`   EN: ${text}`);
        console.log(`   ES: ${gptrans.t(text)}\n`);
    });

    console.log('='.repeat(70));
    console.log('\n✅ Refine test completed!\n');
}

testRefine().catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
});
