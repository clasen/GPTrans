# 🚆 GPTrans

The smarter way to translate: AI-powered, cache-optimized, globally ready.

It intelligently batches and caches translation requests, ensuring blazing-fast results and reducing API calls.

Whether you're building a multilingual website, a mobile app, or a localization tool, GPTrans delivers top-tier performance with minimal setup.

## ✨ Features

- **AI-Powered Translations:** Harness advanced models like OpenAI's GPT and Anthropic's Sonnet for high-quality translations
- **Smart Batching & Debouncing:** Automatically groups translation requests to optimize API usage
- **Caching with DeepBase:** Quickly retrieves cached translations to boost performance
- **Parameter Substitution:** Dynamically replace placeholders in your translations
- **Flexible Configuration:** Customize source and target locales, model keys, and batching settings to fit your needs

## 📦 Installation

```bash
npm install gptrans
```

## 🚀 Quick Start

Here's a simple example to get you started:

```javascript
import GPTrans from 'gptrans';

const gptrans = new GPTrans({
  target: 'es-AR',
  from: 'en-US',
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

When creating a new instance of Gptrans, you can customize:

| Option | Description | Default |
|--------|-------------|---------|
| `target` | Target language locale | `'en-US'` |
| `from` | Source language locale | `'es-AR'` |
| `model` | Translation model key | - |
| `batchThreshold` | Maximum number of characters to accumulate before triggering batch processing | `1000` |
| `debounceTimeout` | Time in milliseconds to wait before processing translations | `500` |

## 🔍 How It Works

1. **First-Time Translation Behavior:** On the first request, Gptrans will return the original text while processing the translation in the background. This ensures your application remains responsive without waiting for API calls.
2. **Translation Caching:** Once processed, translations are stored in `db/gptrans_<iso>.json`. Subsequent requests for the same text will be served instantly from the cache.
3. **Smart Batch Processing:** Translations are processed in batches, providing better context for more accurate results.
4. **Dynamic Model Integration:** Easily plug in multiple AI translation providers with the ModelMix library.
5. **Customizable Prompts:** Load and modify translation prompts (see the `prompt/translate.md` file) to fine-tune the translation output.
6. **Manual Corrections:** A JSON file stores key-translation pairs, allowing you to override specific translations and make manual corrections when needed. Simply edit the `db/gptrans_<iso>.json` file:

```json
{
{
    "balanc_pephba": "Saldo",
    "transa_m1wmv2": "Transacción",
    "accoun_rtvnkg": "Cuenta",
    "card_yis1pt": "Tarjeta",
    "hello_name_1vhllz3": "¡Hola, {name}!",
    ...
}
```

## 🌐 Environment Setup

Gptrans uses dotenv for environment configuration. Create a `.env` file in your project root and add your API keys:

```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## 🎉 Why Choose Gptrans?

Gptrans stands out by combining advanced AI capabilities with efficient batching and caching. This means:

- **Speed:** Reduced API calls and instant retrieval of cached translations
- **Quality:** Leverage state-of-the-art models for precise and context-aware translations
- **Flexibility:** Tailor the tool to your specific localization needs with minimal effort
- **Zero Maintenance:** Set it up once and forget about it - automatic updates and self-healing capabilities keep everything running smoothly

If you're looking to streamline your translation workflow and bring your applications to a global audience effortlessly, Gptrans is the perfect choice!

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub to contribute improvements or fixes.

## License

GPTrans is released under the MIT License.

Happy translating! 🌍✨

