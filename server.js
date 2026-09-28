/**
 * STEERING COMMITTEE — Express & Socket.io Server
 * "Everyone steers. Nobody agrees."
 */

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

// Default to production if deployed on Render without explicit NODE_ENV
if (process.env.RENDER && !process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const app = express();
const server = http.createServer(app);

// Attach Socket.io with permissive CORS for cross-device mobile play
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// JSON body parser
app.use(express.json());

// Serve static assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    nodeEnv: nodeEnv,
    isProduction: isProduction,
    timestamp: new Date().toISOString()
  });
});

// Development / test routes — strictly gated to non-production environments
if (!isProduction) {
  app.use('/tests', express.static(path.join(__dirname, 'tests')));
  app.get('/tests', (req, res) => {
    res.status(200).send('<!DOCTYPE html><html><head><title>Test Suite</title></head><body><h1>STEERING COMMITTEE Test Suite (Dev Mode)</h1><p>Running in development mode.</p></body></html>');
  });
}

// Socket.io connection placeholder for P0
io.on('connection', (socket) => {
  socket.emit('connected', { id: socket.id, timestamp: Date.now() });

  socket.on('disconnect', () => {
    // Socket disconnected
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`[STEERING COMMITTEE] Server listening on http://${HOST}:${PORT} (NODE_ENV=${nodeEnv})`);
  });
}

module.exports = { app, server, io };
