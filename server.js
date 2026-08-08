const express = require('express');
const { pipeline } = require('@xenova/transformers');

const app = express();
app.use(express.json({limit: '1mb'})); // Limit payload for shared hosting

// Lightweight text-generation model (downloads quantized weights on first run)
// Using gpt2 which is tiny (~50MB) and works well on shared hosting
const MODEL_ID = process.env.MODEL || 'Xenova/gpt-2';

let generator = null;
let loading = false;

// Cache directory for model weights — use tmp or home
const CACHE_DIR = process.env.TRANSFORMERS_CACHE || '/tmp/transformers_cache';

async function getGenerator() {
  if (generator) return generator;
  if (loading) {
    // Wait for existing load
    while (!generator) await new Promise(r => setTimeout(r, 100));
    return generator;
  }
  loading = true;
  try {
    console.log(`Loading model: ${MODEL_ID}`);
    generator = await pipeline('text-generation', MODEL_ID, {
      quantized: true,
      backend: 'wasm',
      // Set cache dir for model storage
      cache_dir: CACHE_DIR,
    });
    console.log('Model loaded successfully');
  } catch (err) {
    console.error('Model load error:', err.message);
    throw err;
  } finally {
    loading = false;
  }
  return generator;
}

// OpenAI-compatible endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const gen = await getGenerator();
    const { messages, model, max_tokens = 100, temperature = 0.7 } = req.body;

    const prompt = messages.map(m => 
      (m.role === 'user' ? 'U: ' : 'A: ') + m.content
    ).join('\n') + '\nA: ';

    const output = await gen(prompt, {
      max_new_tokens: max_tokens,
      temperature,
      do_sample: true,
      top_p: 0.95,
    });

    const text = output[0]?.generated_text || '';
    
    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: MODEL_ID,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text.replace(prompt, '').trim() },
        finish_reason: 'stop'
      }]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL_ID, loaded: !!generator });
});

// Models endpoint
app.get('/v1/models', (req, res) => {
  res.json({ data: [{ id: MODEL_ID, object: 'model' }] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Transformers.js API listening on port ${PORT}`);
  console.log(`Model: ${MODEL_ID}`);
});
