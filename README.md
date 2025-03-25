# 🚆 GPTrans

The smarter way to translate: AI-powered, cache-optimized, globally ready.

It intelligently batches and caches translation requests, ensuring blazing-fast results and reducing API calls.

Whether you're building a multilingual website, a mobile app, or a localization tool, GPTrans delivers top-tier performance with minimal setup.

## ✨ Features

- **AI-Powered Translations:** Harness advanced models like OpenAI's GPT and Anthropic's Sonnet for high-quality translations
- **Smart Batching & Debouncing:** Translations are processed in batches, not only for efficiency but also to provide better context. By sending multiple related texts together, the AI model can better understand the overall context and produce more accurate and consistent translations across related terms and phrases.
- **Caching with JSON:** Quickly retrieves cached translations to boost performance
- **Parameter Substitution:** Dynamically replace placeholders in your translations
- **Smart Context Handling:** Add contextual information to improve translation accuracy. Perfect for gender-aware translations, domain-specific content, or any scenario where additional context helps produce better results. The context is automatically cleared after each translation to prevent unintended effects.

## 📦 Installation

```bash
npm install gptrans
```

### 🌐 Environment Setup

GPTrans uses dotenv for environment configuration. Create a `.env` file in your project root and add your API keys:

```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## 🚀 Quick Start

Here's a simple example to get you started:

```javascript
import GPTrans from 'gptrans';

const gptrans = new GPTrans({
  from: 'en-US',
  target: 'es-AR',
  model: 'claude-3-5-sonnet-20241022'
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
| `model` | Translation model key or array of models for fallback | `claude-3-7-sonnet` |
| `model` | Translation model key | `claude-3-7-sonnet` |
| `batchThreshold` | Maximum number of characters to accumulate before triggering batch processing | `1500` |
| `debounceTimeout` | Time in milliseconds to wait before processing translations | `500` |
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

## 🔄 Preloading Translations

You can preload translations for specific languages using the `preload` method. This is particularly useful when you want to initialize translations based on dynamically generated keys:

```javascript
await gptrans.preload({ target:'ar' });
```

### Model Fallback System

GPTrans supports a fallback mechanism for translation models. Instead of providing a single model, you can pass an array of models:

```javascript
const translator = new GPTrans({
  model: ['claude-3-7-sonnet-20250219', 'o3-mini-2025-01-31'],
  // ... other options
});
```

When using multiple models:
- The first model in the array is used as the primary translation service
- If the primary model fails (due to API errors, rate limits, etc.), GPTrans automatically falls back to the next model
- This ensures higher availability and resilience of your translation service

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub to contribute improvements or fixes.

## License

GPTrans is released under the MIT License.

Happy translating! 🌍✨

