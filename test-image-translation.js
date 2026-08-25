import GPTrans from './index.js';
import path from 'path';
import fs from 'fs';

async function testImageTranslation() {
    try {
        console.log('🚀 Starting Image Translation Test\n');

        // Initialize GPTrans with Portuguese as target language
        const gptrans = new GPTrans({
            path: path.join(import.meta.dirname, 'db'),
            from: 'en-US',
            target: 'pt-BR',
            model: 'sonnet45'
        });

        // Test image path (you'll need to provide an actual image)
        const testImagePath = path.join(import.meta.dirname, 'test-image.jpg');

        // Check if test image exists
        if (!fs.existsSync(testImagePath)) {
            console.log('⚠️  Test image not found. Please create a test image at:', testImagePath);
            console.log('You can use any image with text in it for testing.\n');
            return;
        }

        console.log('📸 Test image found:', testImagePath);
        console.log('🎯 Target language: Portuguese (pt-BR)\n');

        // First call - should return original image and start generation
        console.log('🔄 First call (should return original and start generation)...');
        const result1 = await gptrans.translateImage(testImagePath);
        console.log('Result 1:', result1);
        console.log('');

        // Wait a moment
        console.log('⏳ Waiting 5 seconds before second call...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Second call - check status
        console.log('🔄 Second call (checking if translation is ready)...');
        const result2 = await gptrans.translateImage(testImagePath);
        console.log('Result 2:', result2);
        console.log('');

        if (result2.isTranslated) {
            console.log('✅ Translation completed! Translated image at:', result2.path);
        } else {
            console.log('⏳ Translation still generating... Check again later.');
            console.log('Expected path:', path.join(path.dirname(testImagePath), 'pt-BR', path.basename(testImagePath)));
        }

        console.log('\n🎉 Test completed!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.message.includes('API Key') || error.message.includes('GEMINI_API_KEY')) {
            console.error('\n💡 Tip: Make sure you have GEMINI_API_KEY in your .env file');
            console.error('You can get a free API key from: https://aistudio.google.com/apikey');
        }
    }
}

// Run the test
testImageTranslation();
