import GPTrans from '../index.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

// Get current file directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = new URL('../db', import.meta.url).pathname;

// Initialize translator
const model = new GPTrans({
    path: dbPath,
    model: ['sonnet46', 'gpt54'],
    from: 'es',  // Assuming the source file is in Spanish
    target: 'en',
});

// Load the model
await model.preload();

// Read and translate the file
const filePath = `${__dirname}/georgia_incident.md`;
const content = await fs.readFile(filePath, 'utf-8');

// Translate the content
const translatedContent = model.t(content);
console.log(translatedContent);

