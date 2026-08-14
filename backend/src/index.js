// Entry point
// 1. Import app.js (Express app)
// 2. Import wsServer.js
// 3. Create HTTP server from Express app
// 4. Attach WebSocket server to same HTTP server on /ws path
// 5. Listen on PORT from .env
// Purpose: Single port serves both REST and WebSocket

require('dotenv').config();
const http = require('http');
const app = require('./app');
const WebSocket = require('ws');

const PORT = process.env.PORT || 4000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket servers with noServer: true for manual upgrade handling
const wsServer = new WebSocket.Server({ noServer: true });
const yjsServer = new WebSocket.Server({ noServer: true });

// Import connection handlers
const { handleRawWSConnection } = require('./ws/wsServer');
const { handleYjsConnection } = require('./ws/yjsServer');

// Single upgrade router to handle both /ws and /yjs paths
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  
  if (url.pathname === '/ws') {
    // Raw WebSocket for presence and events
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      wsServer.emit('connection', ws, request);
    });
  } else if (url.pathname === '/yjs') {
    // Yjs WebSocket for CRDT synchronization
    yjsServer.handleUpgrade(request, socket, head, (ws) => {
      yjsServer.emit('connection', ws, request);
    });
  } else {
    // Unknown path - close connection
    socket.destroy();
  }
});

// Attach connection handlers
wsServer.on('connection', handleRawWSConnection);
yjsServer.on('connection', handleYjsConnection);

console.log('✅ Raw WebSocket server initialized on /ws');
console.log('✅ Yjs WebSocket server initialized on /yjs');

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Raw WebSocket available at ws://localhost:${PORT}/ws`);
  console.log(`🔄 Yjs WebSocket available at ws://localhost:${PORT}/yjs`);
  console.log(`🔗 REST API available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
 
