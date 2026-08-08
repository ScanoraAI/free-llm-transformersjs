// Minimal test server to check GoDaddy compatibility
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    node_version: process.version, 
    platform: process.platform,
    arch: process.arch
  });
});

app.get('/test', async (req, res) => {
  try {
    // Try loading transformers.js only on this endpoint
    const { pipeline } = await import('@xenova/transformers');
    res.json({ status: 'transformers loaded', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Test server running on ${HOST}:${PORT}`);
  console.log(`Node version: ${process.version}`);
});
