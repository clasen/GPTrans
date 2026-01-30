import GPTrans from '../index.js';

// Ejemplo: Cómo obtener la información completa del idioma

const gptrans = new GPTrans({
    from: 'es',
    target: 'en',
});

// Información del idioma de destino (target)
console.log('\n📌 Idioma de DESTINO (target):');
console.log('  Código ISO:', gptrans.replaceTarget.TARGET_ISO);        // 'en'
console.log('  Nombre:', gptrans.replaceTarget.TARGET_LANG);            // 'English'
console.log('  País:', gptrans.replaceTarget.TARGET_COUNTRY);           // 'United States'
console.log('  Gentilicio:', gptrans.replaceTarget.TARGET_DENONYM);    // 'American'

// Información del idioma de origen (from)
console.log('\n📌 Idioma de ORIGEN (from):');
console.log('  Código ISO:', gptrans.replaceFrom.FROM_ISO);             // 'es'
console.log('  Nombre:', gptrans.replaceFrom.FROM_LANG);                // 'Spanish'
console.log('  País:', gptrans.replaceFrom.FROM_COUNTRY);               // 'Spain'
console.log('  Gentilicio:', gptrans.replaceFrom.FROM_DENONYM);        // 'Spanish'

// Ejemplo con variantes regionales
console.log('\n📌 Ejemplo con variantes regionales:');

const gptrans2 = new GPTrans({
    from: 'en-GB',
    target: 'pt-BR',
});

console.log('\n  Inglés Británico:');
console.log('    Código:', gptrans2.replaceFrom.FROM_ISO);              // 'en-GB'
console.log('    Idioma:', gptrans2.replaceFrom.FROM_LANG);             // 'English'
console.log('    País:', gptrans2.replaceFrom.FROM_COUNTRY);            // 'United Kingdom'
console.log('    Gentilicio:', gptrans2.replaceFrom.FROM_DENONYM);     // 'British'

console.log('\n  Portugués Brasileño:');
console.log('    Código:', gptrans2.replaceTarget.TARGET_ISO);          // 'pt-BR'
console.log('    Idioma:', gptrans2.replaceTarget.TARGET_LANG);         // 'Portuguese'
console.log('    País:', gptrans2.replaceTarget.TARGET_COUNTRY);        // 'Brazil'
console.log('    Gentilicio:', gptrans2.replaceTarget.TARGET_DENONYM); // 'Brazilian'
