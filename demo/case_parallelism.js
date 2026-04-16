import GPTrans from '../index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar .env desde la carpeta demo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
try {
    process.loadEnvFile(join(__dirname, '.env'));
} catch {
    /* optional .env missing or unreadable */
}

console.log('🚀 Prueba de Paralelismo en GPTrans');
console.log('⚠️  Múltiples instancias con MISMO NOMBRE y MISMO PAR DE IDIOMAS\n');
console.log('=' .repeat(70));

// Test: Múltiples instancias con el MISMO NOMBRE y MISMO PAR DE IDIOMAS
async function testParallelTranslations() {
    const instanceName = 'parallel_test';  // UN SOLO NOMBRE
    const sourceLang = 'en';               // UN SOLO IDIOMA ORIGEN
    const targetLang = 'es';               // UN SOLO IDIOMA DESTINO
    const instanceCount = 20;              // MUCHAS INSTANCIAS
    
    console.log(`📋 Configuración de la prueba:`);
    console.log(`   Nombre de instancia: "${instanceName}"`);
    console.log(`   Par de idiomas: ${sourceLang} → ${targetLang}`);
    console.log(`   Número de instancias: ${instanceCount}`);
    console.log(`   Modo: Promise.all() - Todas simultáneas`);
    console.log('-'.repeat(70));
    
    // Generar textos únicos para cada instancia
    const texts = Array.from({ length: instanceCount }, (_, i) => 
        `Parallel translation test number ${i + 1}`
    );
    
    console.log(`\n🚀 Iniciando ${instanceCount} traducciones simultáneas...\n`);
    
    const startTime = Date.now();
    
    // TODAS las instancias se crean y solicitan traducciones SIMULTÁNEAMENTE
    const results = await Promise.all(
        texts.map(async (text, index) => {
            // Todas las instancias comparten el MISMO NOMBRE
            const gptrans = new GPTrans({ 
                from: sourceLang, 
                target: targetLang,
                model: 'sonnet45',
                name: instanceName  // ⚠️ MISMO NOMBRE = MISMA DB
            });
            
            // Mostrar solo las primeras y últimas para no saturar consola
            if (index < 5 || index >= instanceCount - 2) {
                console.log(`  [${index + 1}/${instanceCount}] Instancia creada, traduciendo: "${text}"`);
            } else if (index === 5) {
                console.log(`  ... (${instanceCount - 7} instancias más) ...`);
            }
            
            // Primera lectura (inmediata - probablemente sin traducir)
            const immediate = await gptrans.t(text);
            
            // Esperar para que se procesen las traducciones
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Segunda lectura (después del procesamiento)
            const final = await gptrans.t(text);
            
            return { 
                index: index + 1,
                original: text, 
                immediate: immediate,
                final: final
            };
        })
    );
    
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESULTADOS');
    console.log('='.repeat(70));
    
    // Mostrar solo algunos resultados para no saturar
    console.log('\n📋 Traducciones (primeras 5):');
    results.slice(0, 5).forEach(({ index, original, immediate, final }) => {
        console.log(`\n   [${index}] Original: "${original}"`);
        console.log(`       Inmediato: "${immediate}"`);
        console.log(`       Final: "${final}"`);
    });
    
    if (instanceCount > 5) {
        console.log(`\n   ... (${instanceCount - 5} traducciones más) ...`);
    }
    
    console.log(`\n⏱️  Tiempo total: ${duration.toFixed(2)}s`);
    console.log(`⚡ Velocidad promedio: ${(duration / instanceCount).toFixed(3)}s por traducción`);
    
    // Análisis de integridad
    console.log('\n' + '='.repeat(70));
    console.log('🔍 ANÁLISIS DE INTEGRIDAD');
    console.log('='.repeat(70));
    
    const allTranslated = results.every(r => r.final !== r.original);
    const someImmediate = results.filter(r => r.immediate !== r.original).length;
    const uniqueFinals = new Set(results.map(r => r.final));
    const uniqueOriginals = new Set(results.map(r => r.original));
    
    console.log(`\n✓ Textos originales únicos: ${uniqueOriginals.size}/${instanceCount}`);
    console.log(`✓ Traducciones inmediatas: ${someImmediate}/${instanceCount}`);
    console.log(`✓ Traducciones finales completadas: ${results.filter(r => r.final !== r.original).length}/${instanceCount}`);
    console.log(`✓ Traducciones finales únicas: ${uniqueFinals.size}/${instanceCount}`);
    
    console.log('\n📈 Estado:');
    console.log(`   Todas traducidas correctamente: ${allTranslated ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   Sin duplicados: ${uniqueFinals.size === instanceCount ? '✅ SÍ' : '❌ NO'}`);
    
    // Detectar problemas
    const hasRaceCondition = uniqueFinals.size !== instanceCount;
    const hasUntranslated = !allTranslated;
    
    if (hasRaceCondition) {
        console.log(`\n⚠️  RACE CONDITION DETECTADA:`);
        console.log(`   Se esperaban ${instanceCount} traducciones únicas`);
        console.log(`   Se obtuvieron ${uniqueFinals.size} traducciones únicas`);
        console.log(`   Duplicados: ${instanceCount - uniqueFinals.size}`);
    }
    
    if (hasUntranslated) {
        const untranslated = results.filter(r => r.final === r.original);
        console.log(`\n⚠️  TRADUCCIONES INCOMPLETAS:`);
        console.log(`   ${untranslated.length} textos no fueron traducidos`);
        untranslated.slice(0, 3).forEach(({ index, original }) => {
            console.log(`      [${index}] "${original}"`);
        });
    }
    
    if (!hasRaceCondition && !hasUntranslated) {
        console.log(`\n✅ PRUEBA EXITOSA:`);
        console.log(`   Todas las traducciones se completaron correctamente`);
        console.log(`   No se detectaron race conditions`);
        console.log(`   No se detectaron duplicados`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('💡 CONCLUSIÓN');
    console.log('='.repeat(70));
    console.log(`\n${instanceCount} instancias con:`);
    console.log(`   • MISMO nombre: "${instanceName}"`);
    console.log(`   • MISMO par de idiomas: ${sourceLang} → ${targetLang}`);
    console.log(`   • Solicitudes SIMULTÁNEAS con Promise.all()`);
    console.log(`   • Resultado: ${hasRaceCondition || hasUntranslated ? '🔴 PROBLEMAS DETECTADOS' : '✅ EXITOSO'}`);
    console.log('');
}

// Ejecutar prueba
testParallelTranslations().catch(error => {
    console.error('\n❌ Error durante la prueba:', error.message);
    console.error(error.stack);
});
