import GPTrans from '../index.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from demo folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('🚀 Testing GPTrans with Reference Translations\n');
console.log('='.repeat(70));

async function testReferences() {
    console.log('\n📋 Test 1: Basic usage without references (baseline)\n');
    
    // First, create translations in English and Portuguese
    const enTranslator = new GPTrans({ 
        from: 'es', 
        target: 'en',
        model: 'sonnet45',
        name: 'ref_test',
        debug: 3
    });
    
    const ptTranslator = new GPTrans({ 
        from: 'es', 
        target: 'pt',
        model: 'sonnet45',
        name: 'ref_test',
        debug: 3
    });
    
    // Sample Spanish texts with gendered language
    const spanishTexts = [
        'El estudiante es muy bueno',
        'La estudiante es muy buena',
        'Tienes que ir al doctor',
        'Está muy cansada'
    ];
    
    console.log('📝 Creating English translations from Spanish...');
    spanishTexts.forEach(text => {
        console.log(`   EN: ${enTranslator.t(text)}`);
    });
    
    // Wait for EN translations to complete if needed
    await enTranslator.preload();
    
    console.log('\n📝 Creating Portuguese translations from Spanish...');
    spanishTexts.forEach(text => {
        console.log(`   PT: ${ptTranslator.t(text)}`);
    });
    
    // Wait for PT translations to complete if needed
    await ptTranslator.preload();
    
    console.log('\n' + '='.repeat(70));
    console.log('\n📋 Test 2: Translation with English as reference\n');
    
    // Now translate to French using English as reference
    const frTranslator = new GPTrans({ 
        from: 'es', 
        target: 'fr',
        model: 'sonnet45',
        name: 'ref_test',
        debug: 3
    });
    
    console.log('🔄 Preloading French translations with English as reference...');
    await frTranslator.preload({ 
        references: ['en']
    });
    
    console.log('\n📝 French translations (with EN reference):');
    spanishTexts.forEach(text => {
        console.log(`   ES: ${text}`);
        console.log(`   FR: ${frTranslator.t(text)}\n`);
    });
    
    console.log('='.repeat(70));
    console.log('\n📋 Test 3: Translation using alternate base language\n');
    
    // Translate from English to Italian (using English as base instead of Spanish)
    const itTranslator = new GPTrans({ 
        from: 'es', 
        target: 'it',
        model: 'sonnet45',
        name: 'ref_test',
        debug: 3
    });
    
    console.log('🔄 Preloading Italian translations with English as base language...');
    await itTranslator.preload({ 
        baseLanguage: 'en',
        references: ['es', 'pt']  // Show original Spanish and Portuguese as reference
    });
    
    console.log('\n📝 Italian translations (from EN, with ES+PT references):');
    spanishTexts.forEach(text => {
        console.log(`   ES (original): ${text}`);
        console.log(`   IT (from EN):  ${itTranslator.t(text)}\n`);
    });
    
    console.log('='.repeat(70));
    console.log('\n📋 Test 4: Multiple references\n');
    
    // Translate to German with multiple references
    const deTranslator = new GPTrans({ 
        from: 'es', 
        target: 'de',
        model: 'sonnet45',
        name: 'ref_test',
        debug: 3
    });
    
    console.log('🔄 Preloading German translations with multiple references...');
    await deTranslator.preload({ 
        references: ['en', 'pt', 'fr']
    });
    
    console.log('\n📝 German translations (with EN+PT+FR references):');
    spanishTexts.forEach(text => {
        console.log(`   ES: ${text}`);
        console.log(`   DE: ${deTranslator.t(text)}\n`);
    });
    
    console.log('='.repeat(70));
    console.log('\n✅ All tests completed!\n');
    console.log('💡 Key features demonstrated:');
    console.log('   1. Baseline translations without references');
    console.log('   2. Using one language as reference for better context');
    console.log('   3. Using alternate base language (translate from intermediate language)');
    console.log('   4. Using multiple references for maximum accuracy\n');
}

// Run tests
testReferences().catch(error => {
    console.error('\n❌ Error during tests:', error.message);
    console.error(error.stack);
});
