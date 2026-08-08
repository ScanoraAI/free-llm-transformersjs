const express = require('express');
const { pipeline } = require('@xenova/transformers');

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught Exception:', err);
  process.exit(1);
});

const app = express();
app.use(express.json({limit: '1mb'}));

const MODEL_ID = process.env.MODEL || 'Xenova/gpt-2';

let generator = null;
let loading = false;

async function getGenerator() {
  if (generator) return generator;
  if (loading) {
    while (!generator) await new Promise(r => setTimeout(r, 100));
    return generator;
  }
  loading = true;
  try {
    console.log(`[INFO] Loading model: ${MODEL_ID}`);
    generator = await pipeline('text-generation', MODEL_ID, {
      quantized: true,
      backend: 'wasm',
    });
    console.log('[INFO] Model loaded successfully');
  } catch (err) {
    console.error('[ERROR] Model load failed:', err.message);
    throw err;
  } finally {
    loading = false;
  }
  return generator;
}

// Health check (always available, even before model loads)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL_ID, loaded: !!generator });
});

// Models endpoint
app.get('/v1/models', (req, res) => {
  res.json({ data: [{ id: MODEL_ID, object: 'model' }] });
});

// Chat completions
app.post('/v1/chat/completions', express.json({limit: '1mb'}), async (req, res) => {
  try {
    if (!generator) {
      const gen = await getGenerator();
    }
    const { messages, model, max_tokens = 100, temperature = 0.7 } = req.body;
    const prompt = messages.map(m => 
      (m.role === 'user' ? 'U: ' : 'A: ') + m.content
    ).join('\n') + '\nA: ';
    
    const output = await generator(prompt, {
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
    console.error('[ERROR] Generation failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`[INFO] Transformers.js API listening on ${HOST}:${PORT}`);
  console.log(`[INFO] Model: ${MODEL_ID}`);
  console.log(`[INFO] Node version: ${process.version}`);
});
