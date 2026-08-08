# Free LLM API (Transformers.js)

Self-hosted OpenAI-compatible LLM API using [Transformers.js](https://github.com/xenova/transformers.js) — runs entirely in Node.js via WebAssembly. **No Python, no GPU, no paid APIs.**

## Models
- `Xenova/gpt-2` (default) — lightweight, fast on shared hosting
- `Xenova/llama-2-7b-chat` — requires ~3GB RAM
- `Xenova/qwen-1.8b` — small and efficient

> Full list: https://huggingface.co/Xenova

## Deployment (cPanel)
1. Fork this repo → GitHub
2. In cPanel: Setup Node.js App → create app → **pull from Git**
3. Set env vars:
   - `MODEL` = desired model ID (e.g. `Xenova/gpt-2`)
   - `PORT` = auto-set by cPanel (usually 3000+)
4. Start app

## API Usage

```bash
# Chat completion (OpenAI-compatible)
curl -X POST https://your-app.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Hello!"}]
  }'

# List models
curl https://your-app.com/v1/models

# Health check
curl https://your-app.com/health
```

## First Run
First request downloads quantized model weights (~100-500MB). Subsequent runs are cached in `node_modules`.
