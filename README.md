# 🚆 GPTrans

The smarter way to translate: AI-powered, cache-optimized, globally ready.

It intelligently batches and caches translation requests, ensuring blazing-fast results and reducing API calls.

Whether you're building a multilingual website, a mobile app, or a localization tool, GPTrans delivers top-tier performance with minimal setup.

## ✨ Features

- **AI-Powered Translations:** Harness advanced models like OpenAI's GPT and Anthropic's Sonnet for high-quality translations
- **Smart Batching & Debouncing:** Translations are processed in batches, not only for efficiency but also to provide better context. By sending multiple related texts together, the AI model can better understand the overall context and produce more accurate and consistent translations across related terms and phrases.
- **Reference Translations:** Use existing translations in other languages as context to improve accuracy and consistency across your multilingual content
- **Flexible Base Language:** Translate from an intermediate language instead of the original, useful for avoiding gender-specific terms or leveraging more neutral language versions
- **Caching with JSON:** Quickly retrieves cached translations to boost performance
- **Parameter Substitution:** Dynamically replace placeholders in your translations
- **Smart Context Handling:** Add contextual information to improve translation accuracy. Perfect for gender-aware translations, domain-specific content, or any scenario where additional context helps produce better results. The context is automatically cleared after each translation to prevent unintended effects.
- **Translation Instructions:** Pass additional instructions (e.g., "Use natural tone") to guide the AI translator's style.

## 📦 Installation

```bash
npm install gptrans
```
> **AI Skill**: You can also add GPTrans as a skill for AI agentic development:
> ```bash
> npx skills add https://github.com/clasen/GPTrans --skill gptrans
> ```
### 🌐 Environment Setup

GPTrans uses dotenv for environment configuration. Create a `.env` file in your project root and add your API keys:

```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=for_image_translations
```

## 🚀 Quick Start

Here's a simple example to get you started:

```javascript
import GPTrans from 'gptrans';

const gptrans = new GPTrans({
  from: 'en-US',
  target: 'es-AR',
  model: 'sonnet45'
});

// Translate text with parameter substitution
console.log(gptrans.t('Hello, {name}!', { name: 'John' }));

// Set context for gender-aware translations
console.log(gptrans.setContext('Message is for a woman').t('You are very good'));

// Other translation examples
console.log(gptrans.t('Withdraw'));
console.log(gptrans.t('Top-up'));
console.log(gptrans.t('Transfer'));
console.log(gptrans.t('Deposit'));
console.log(gptrans.t('Balance'));
console.log(gptrans.t('Transaction'));
console.log(gptrans.t('Account'));
console.log(gptrans.t('Card'));
```

## ⚙️ Configuration Options

When creating a new instance of GPTrans, you can customize:

| Option | Description | Default |
|--------|-------------|---------|
| `from` | Source language locale (BCP 47) | `en-US` |
| `target` | Target language locale (BCP 47) | `es` |
| `model` | Translation model key or array of models for fallback | `sonnet45` `gpt41` |
| `batchThreshold` | Maximum number of characters to accumulate before triggering batch processing | `1500` |
| `debounceTimeout` | Time in milliseconds to wait before processing translations | `500` |
| `instruction` | Additional instruction for the translator (e.g., tone, style). Does not affect the cache key | `''` |
| `freeze` | Freeze mode to prevent translations from being queued | `false` |

### BCP 47 Language Tags

GPTrans uses BCP 47 language tags for language specification. BCP 47 is the standard for language tags that combines language, script, and region codes. Here are some common examples:

- `en-US` - English (United States)
- `es-AR` - Spanish (Argentina)
- `pt-BR` - Portuguese (Brazil)

For simplified or universal language codes, you can omit the region specification:
- `es` - Spanish (Universal)

## 🔍 How It Works

1. **First-Time Translation Behavior:** On the first request, Gptrans will return the original text while processing the translation in the background. This ensures your application remains responsive without waiting for API calls.
2. **Translation Caching:** Once processed, translations are stored in `db/gptrans_<tag>.json`. Subsequent requests for the same text will be served instantly from the cache.
3. **Smart Batch Processing:** Automatically groups translation requests to optimize API usage and provide better context.
4. **Dynamic Model Integration:** Easily plug in multiple AI translation providers with the ModelMix library.
5. **Customizable Prompts:** Load and modify translation prompts (see the `prompt/translate.md` file) to fine-tune the translation output.
6. **Manual Corrections:** A JSON file stores key-translation pairs, allowing you to override specific translations and make manual corrections when needed. Simply edit the `db/gptrans_<tag>.json` file:

```json
{
    "balanc_pephba": "Saldo",
    "transa_m1wmv2": "Transacción",
    "accoun_rtvnkg": "Cuenta",
    "card_yis1pt": "Tarjeta",
    "hello_name_1vhllz3": "¡Hola, {name}!",
    ...
}
```

## 🎉 Why Choose GPTrans?

GPTrans stands out by combining advanced AI capabilities with efficient batching and caching. This means:

- **Speed:** Reduced API calls and instant retrieval of cached translations
- **Quality:** Leverage state-of-the-art models for precise and context-aware translations
- **Flexibility:** Tailor the tool to your specific localization needs with minimal effort
- **Zero Maintenance:** Set it up once and forget about it - automatic updates and self-healing capabilities keep everything running smoothly

If you're looking to streamline your translation workflow and bring your applications to a global audience effortlessly, GPTrans is the perfect choice!

## 📝 Translation Instructions

The `instruction` option lets you guide the AI translator's style, tone, or behavior without creating a separate cache entry. Unlike `context` (which produces separate translations for each unique context), `instruction` does not affect the cache key — so the same text with the same context always maps to the same cache entry regardless of the instruction used.

### Usage

```javascript
const gptrans = new GPTrans({
  from: 'en',
  target: 'es-AR',
  instruction: 'Use natural and colloquial tone'
});

console.log(gptrans.t('Welcome to our platform'));
console.log(gptrans.t('Please verify your identity'));
```

### Instruction vs Context

| | `context` | `instruction` |
|---|---|---|
| **Purpose** | Semantic information (gender, domain) | Style guidance (tone, formality) |
| **Affects cache key** | Yes — different contexts create separate translations | No — same key regardless of instruction |
| **Example** | `'Use natural tone'` |

## 🔄 Preloading Translations

The `preload()` method allows you to pre-translate all texts in your database. It now supports advanced options for improved translation accuracy through reference translations and alternate base languages.

### Basic Usage

```javascript
// Simple preload - translates all pending texts
await gptrans.preload();
```

### Advanced Options

#### Using Reference Translations

Include translations from other languages as context to improve accuracy and consistency:

```javascript
// Use English and Portuguese translations as reference
const gptrans = new GPTrans({ from: 'es', target: 'fr' });
await gptrans.preload({ 
  references: ['en', 'pt'] 
});
```

The AI model will see existing translations in the reference languages, helping it produce more consistent and accurate translations.

#### Using an Alternate Base Language

Translate from an intermediate language instead of the original:

```javascript
// Original is Spanish, but translate FROM English TO Portuguese
const gptrans = new GPTrans({ from: 'es', target: 'pt' });
await gptrans.preload({ 
  baseLanguage: 'en' 
});
```

This is useful when:
- The intermediate language has characteristics that better suit the target (e.g., English "he/she" can be omitted in some languages)
- You want to avoid gender-specific terms present in the source language
- The intermediate translation is cleaner or more universal

#### Combined Usage

You can use both options together:

```javascript
// Translate from English to German, showing Spanish and Portuguese as reference
const gptrans = new GPTrans({ from: 'es', target: 'de' });
await gptrans.preload({ 
  baseLanguage: 'en',
  references: ['es', 'pt'] 
});
```

### Real-World Example

**Problem:** Gender-specific translations

```javascript
// Spanish: "El estudiante es muy bueno" (masculine)
// English: "The student is very good" (neutral)

// Solution: Translate to Portuguese using English as base
const ptTranslator = new GPTrans({ from: 'es', target: 'pt' });
await ptTranslator.preload({ 
  baseLanguage: 'en',     // Use neutral English version
  references: ['es']       // Show original Spanish for context
});
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `references` | `string[]` | Array of language codes (e.g., `['en', 'pt']`) to use as translation references |
| `baseLanguage` | `string` | Language code to use as the base for translation instead of the original |


### Model Fallback System

GPTrans supports a fallback mechanism for translation models. Instead of providing a single model, you can pass an array of models:

```javascript
const translator = new GPTrans({
  model: ['claude37', 'gpt41'],
  // ... other options
});
```

When using multiple models:
- The first model in the array is used as the primary translation service
- If the primary model fails (due to API errors, rate limits, etc.), GPTrans automatically falls back to the next model
- This ensures higher availability and resilience of your translation service

## ✏️ Refining Translations

The `refine()` method lets you improve existing translations by running them through the AI again with a specific instruction. It processes translations in batches (same as the translation flow) and only updates entries that genuinely benefit from the refinement.

```javascript
const gptrans = new GPTrans({ from: 'en', target: 'es-AR' });

// After translations already exist...
// Refine with a single instruction
await gptrans.refine('Use a more natural and colloquial tone');

// Or pass multiple instructions at once (single API pass, saves tokens)
await gptrans.refine([
  'Shorten texts where possible without losing meaning',
  'Use a more colloquial tone'
]);
```

> **Note:** The refine method uses the **target translation** as input (not the original source text). If the AI determines a translation is already good, it keeps it unchanged. Passing an array of instructions is preferred over multiple `refine()` calls since it processes everything in a single API pass.

# 🖼️ Image Translation

Intelligent image translation using Google's Gemini AI.

![Image Translation Example](demo/en2es.jpg)

  Original English image (left) → Translated to Spanish (right)*

## ✨ Smart Path Detection

The translation system automatically detects if your image is already in a language folder and adjusts the output path accordingly:

### Example

```javascript
// Input: en/image.jpg
// Output: es/image.jpg (sibling folder at same level)

const result = await gptrans.img('en/image.jpg');
```

**Directory Structure:**
```
project/
├── en/
│   └── image.jpg          ← Original
└── es/
    └── image.jpg          ← Translation (sibling folder)
```


## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub to contribute improvements or fixes.

## License

GPTrans is released under the MIT License.

Happy translating! 🌍✨

