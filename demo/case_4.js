import GPTrans from '../index.js';
import { join } from 'path';
import { promises as fs } from 'fs';

const dbPath = join(import.meta.dirname, '../db');
try { process.loadEnvFile(join(import.meta.dirname, '.env')); } catch { }

// Initialize translator
const model = new GPTrans({
    path: dbPath,
    model: ['sonnet50', 'gpt56luna@80'],
    from: 'es',  // Assuming the source file is in Spanish
    target: 'en',
});

// Load the model
await model.preload();

// Read and translate the file
const filePath = join(import.meta.dirname, 'georgia_incident.md');
const content = await fs.readFile(filePath, 'utf-8');

// Translate the content
const translatedContent = model.t(content);
console.log(translatedContent);
