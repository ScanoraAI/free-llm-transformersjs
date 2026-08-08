// GoDaddy-compatible Transformers.js LLM Server
// Uses pure Node.js http module - zero dependencies at startup
// Proxies to a VM-hosted transformers.js instance when available
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const MODEL = process.env.MODEL || 'Xenova/gpt-2';

// Optional: Proxy to a VM-hosted transformers.js instance
const TRANSFORMERS_PROXY = process.env.TRANSFORMERS_PROXY || null;

function makeProxyRequest(targetUrl, options, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(targetUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(responseBody)
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: responseBody });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy());
    if (data) req.write(data);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
  
  // Health check - always available
  if (url === '/health' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      node_version: process.version,
      timestamp: new Date().toISOString(),
      service: 'free-llm-transformersjs',
      model: MODEL,
      proxy_target: TRANSFORMERS_PROXY || 'none'
    }));
    return;
  }
  
  // Models endpoint
  if (url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      data: [{ id: MODEL, object: 'model' }] 
    }));
    return;
  }
  
  // Chat completions endpoint (OpenAI-compatible)
  if (url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        
        // If we have a proxy endpoint, forward the request
        if (TRANSFORMERS_PROXY) {
          try {
            const proxyResult = await makeProxyRequest(TRANSFORMERS_PROXY, {
              method: 'POST',
              path: '/v1/chat/completions'
            }, payload);
            
            res.writeHead(proxyResult.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(proxyResult.data));
            return;
          } catch (proxyError) {
            console.error('Proxy failed:', proxyError.message);
          }
        }
        
        // Fallback response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: MODEL,
          choices: [{
            index: 0,
            message: { 
              role: 'assistant', 
              content: `This is the ScanoraAI Transformers.js gateway. To enable actual LLM responses, set the TRANSFORMERS_PROXY environment variable to your VM-hosted transformers.js endpoint. Current model: ${MODEL}`
            },
            finish_reason: 'stop'
          }]
        }));
        
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON', detail: err.message }));
      }
    });
    return;
  }
  
  // 404 handler
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`[${new Date().toISOString()}] Transformers.js gateway running on ${HOST}:${PORT}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Proxy target: ${TRANSFORMERS_PROXY || 'none (fallback mode)'}`);
  console.log(`Node.js version: ${process.version}`);
});

process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] Unhandled rejection:', reason);
});
