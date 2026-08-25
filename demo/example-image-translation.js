// Example usage based on user's requirements
import GPTrans from '../index.js';
import path from 'path';
import fs from 'fs';

async function main() {
    try {
        // Initialize GPTrans with Spanish as target
        const gptrans = new GPTrans({
            path: path.join(import.meta.dirname, 'db'),
            from: 'en-US',
            target: 'es'
        });

        console.log('🌍 Testing Image Translation with Smart Path Detection\n');
        console.log('═══════════════════════════════════════════════════\n');

        // Example 1: Image in language folder (en/image.jpg -> es/image.jpg)
        console.log('📁 Example 1: Image already in language folder');
        console.log('   Input: en/image.jpg');
        console.log('   Expected output: es/image.jpg (sibling folder)\n');

        const imageInLangFolder = path.join(import.meta.dirname, 'en', 'camera_4126.jpg');
        if (fs.existsSync(imageInLangFolder)) {
            const result1 = await gptrans.img(imageInLangFolder);
            console.log('   Result:', result1);
            console.log('');
        } else {
            console.log('   ⚠️  Image not found at:', imageInLangFolder);
            console.log('   (Create en/camera_4126.jpg to test this case)\n');
        }

        // // Example 2: Image in root folder (./image.jpg -> es/image.jpg)
        // console.log('📁 Example 2: Image in root/current folder');
        // console.log('   Input: ./image.jpg');
        // console.log('   Expected output: ./es/image.jpg (subfolder)\n');

        // const imageInRoot = path.join(import.meta.dirname, 'camera_4126.jpg');
        // if (fs.existsSync(imageInRoot)) {
        //     const result2 = await gptrans.img(imageInRoot);
        //     console.log('   Result:', result2);
        //     console.log('');
        // } else {
        //     console.log('   ⚠️  Image not found at:', imageInRoot);
        //     console.log('   (Create camera_4126.jpg to test this case)\n');
        // }

        // // Example 3: Image in non-language folder (images/photo.jpg -> images/es/photo.jpg)
        // console.log('📁 Example 3: Image in custom folder');
        // console.log('   Input: images/photo.jpg');
        // console.log('   Expected output: images/es/photo.jpg (subfolder)\n');

        // const imageInCustomFolder = path.join(import.meta.dirname, 'images', 'photo.jpg');
        // if (fs.existsSync(imageInCustomFolder)) {
        //     const result3 = await gptrans.img(imageInCustomFolder);
        //     console.log('   Result:', result3);
        //     console.log('');
        // } else {
        //     console.log('   ⚠️  Image not found at:', imageInCustomFolder);
        //     console.log('   (Create images/photo.jpg to test this case)\n');
        // }

        // console.log('═══════════════════════════════════════════════════');
        // console.log('🎉 Example completed successfully!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.message.includes('API Key')) {
            console.error('\n💡 Tip: Make sure you have GEMINI_API_KEY in your .env file');
            console.error('Get your API key from: https://aistudio.google.com/apikey');
        }

        if (error.message.includes('reference image')) {
            console.error('\n💡 Tip: Verify that the image path is correct');
        }
    }
}

main();
