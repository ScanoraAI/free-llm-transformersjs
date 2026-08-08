// Minimum viable server - NO dependencies loaded at startup
const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      node_version: process.version,
      timestamp: new Date().toISOString()
    }));
  } else if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      data: [{ id: 'gpt-2', object: 'model' }] 
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Node version: ${process.version}`);
});

// Prevent crashes from killing the process
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] Unhandled rejection:', reason);
});
