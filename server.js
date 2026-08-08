// GoDaddy-compatible server - lazy loads heavy dependencies
const express = require('express');
const app = express();

// Health check - works without loading transformers
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    node_version: process.version,
    platform: process.platform,
    note: 'Server running, transformers.js not yet loaded'
  });
});

// Lazy load transformers only when chat is requested
let transformers = null;
let generator = null;

async function loadTransformers() {
  if (transformers) return transformers;
  
  try {
    console.log('[INFO] Loading @xenova/transformers...');
    transformers = await import('@xenova/transformers');
    console.log('[INFO] Loaded @xenova/transformers successfully');
  } catch (err) {
    console.error('[ERROR] Failed to load transformers:', err.message);
    throw new Error(`Could not load transformers: ${err.message}`);
  }
  return transformers;
}

// Chat completion endpoint
app.post('/v1/chat/completions', express.json({limit: '1mb'}), async (req, res) => {
  try {
    const { transformers: t } = await loadTransformers();
    
    if (!generator) {
      const MODEL_ID = process.env.MODEL || 'Xenova/gpt-2';
      console.log(`[INFO] Initializing generator with model: ${MODEL_ID}`);
      generator = await t.pipeline('text-generation', MODEL_ID, {
        quantized: true,
        backend: 'wasm',
      });
    }

    const { messages, max_tokens = 100, temperature = 0.7 } = req.body;
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
      model: process.env.MODEL || 'Xenova/gpt-2',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text.replace(prompt, '').trim() },
        finish_reason: 'stop'
      }]
    });
  } catch (err) {
    console.error('[ERROR] Generation failed:', err.message);
    res.status(500).json({ 
      error: 'Model loading failed',
      detail: err.message 
    });
  }
});

// Test endpoint - loads transformers
app.get('/test', async (req, res) => {
  try {
    await loadTransformers();
    res.json({ 
      status: 'success', 
      message: 'transformers.js loaded successfully',
      note: 'If you see this, the module works on GoDaddy'
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      error: err.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Node version: ${process.version}`);
});
