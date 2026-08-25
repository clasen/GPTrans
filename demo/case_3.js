import GPTrans from '../index.js';
import { join } from 'path';

const dbPath = join(import.meta.dirname, '../db');
try { process.loadEnvFile(join(import.meta.dirname, '.env')); } catch { }

try {
    const gptrans = new GPTrans({
        path: dbPath,
        target: 'ar',
        from: 'es',
    });

    console.log(gptrans.t('Cargando...'));
} catch (e) {
    console.error(e);
}
