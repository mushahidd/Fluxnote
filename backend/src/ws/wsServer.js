// Setup WebSocket server (ws library)
// On connection:
//   1. Parse JWT from query param (?token=...)
//   2. Verify token → get userId, role
//   3. Add client to room map: rooms[roomId].add(client)
//   4. Send missed events: replayEvents(roomId, client.lastEventId)
//   5. Register message handler: wsHandler(client, message)
//   6. On close: remove from room, broadcast USER_LEFT

const WebSocket = require('ws');
const { handleMessage } = require('./wsHandler');
const eventService = require('../services/eventService');
const { updateCursor, broadcastCursor, getCursorSnapshot, removeCursor } = require('./presence');
const { parseWsQuery, broadcastToRoomSet, safeCloseWs, safeSendWs } = require('../utils/wsUtils');
const { AuthenticationError } = require('../utils/errors');

// Room management: roomId -> Set of WebSocket clients
const rooms = new Map();

// Track assigned colors per room: roomId -> Set of colors in use
const roomColors = new Map();

// Color palette for user cursors
const COLOR_PALETTE = ['#FF5722', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#E91E63', '#673AB7'];

/**
 * Assign a unique color to a user, avoiding duplicates in the same room
 * @param {string} roomId - Room identifier
 * @returns {string} Hex color code
 */
function assignUserColor(roomId) {
  if (!roomColors.has(roomId)) {
    roomColors.set(roomId, new Set());
  }
  
  const usedColors = roomColors.get(roomId);
  
  // Find first unused color
  for (const color of COLOR_PALETTE) {
    if (!usedColors.has(color)) {
      usedColors.add(color);
      return color;
    }
  }
  
  // All colors used, fallback to hash-based color
  const roomClients = rooms.get(roomId);
  const userCount = roomClients ? roomClients.size : 0;
  return COLOR_PALETTE[userCount % COLOR_PALETTE.length];
}

/**
 * Handle raw WebSocket connection (exported for use in index.js)
 * @param {WebSocket} ws - WebSocket connection
 * @param {http.IncomingMessage} req - HTTP request
 */
async function handleRawWSConnection(ws, req) {
  try {
    // Parse and validate query parameters with JWT verification
    const { roomId, user, token } = await parseWsQuery(req);

    // Attach user info to WebSocket
    ws.userId = user.id;
    ws.userRole = user.role;
    ws.roomId = roomId;
    ws.accessToken = token;
    ws.userName = user.name || user.email;
    ws.userColor = assignUserColor(roomId);

    // Add client to room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(ws);

    console.log(`User ${user.id} (${user.role}) joined room ${roomId}`);

    // Send missed events if client provides lastEventId
    const url = new URL(req.url, `http://${req.headers.host}`);
    const lastEventId = parseInt(url.searchParams.get('lastEventId')) || 0;
    if (lastEventId > 0) {
      const missedEvents = await eventService.getEvents(roomId, lastEventId);
      safeSendWs(ws, {
        type: 'SYNC',
        events: missedEvents,
      });
    }

    // Broadcast user joined
    broadcast(roomId, {
      type: 'USER_JOINED',
      userId: user.id,
      userName: user.name || user.email,
      role: user.role,
    }, ws);

    // Send current cursor positions to new joiner
    const cursorSnapshot = getCursorSnapshot(roomId);
    if (cursorSnapshot.length > 0) {
      safeSendWs(ws, {
        type: 'CURSOR_SNAPSHOT',
        cursors: cursorSnapshot,
      });
    }

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle CURSOR_MOVE messages
        if (message.type === 'CURSOR_MOVE') {
          const { x, y } = message.payload;
          
          // Update cursor position in presence map
          const cursorData = updateCursor(
            roomId,
            ws.userId,
            { x, y },
            ws.userName,
            ws.userColor
          );
          
          // Broadcast cursor update to all clients except sender
          broadcastCursor(roomId, ws.userId, cursorData, (roomId, msg) => {
            broadcast(roomId, msg, ws);
          });
        } else {
          // Handle other message types via wsHandler
          await handleMessage(ws, message, broadcast);
        }
      } catch (error) {
        console.error('Message parse error:', error);
        safeSendWs(ws, {
          type: 'ERROR',
          error: 'Invalid message format',
        });
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`User ${user.id} left room ${roomId}`);
      
      // Remove cursor from presence map
      removeCursor(roomId, ws.userId);
      
      // Release user color
      if (roomColors.has(roomId)) {
        roomColors.get(roomId).delete(ws.userColor);
        
        // Clean up empty color set
        if (roomColors.get(roomId).size === 0) {
          roomColors.delete(roomId);
        }
      }
      
      // Remove from room
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(ws);
        
        // Clean up empty rooms
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
        }
      }

      // Broadcast user left
      broadcast(roomId, {
        type: 'USER_LEFT',
        userId: user.id,
      });
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

  } catch (error) {
    console.error('WebSocket connection error:', error);
    
    // Handle authentication errors
    if (error instanceof AuthenticationError) {
      safeCloseWs(ws, 1008, error.message);
    } else {
      safeCloseWs(ws, 1011, 'Internal server error');
    }
  }
}

/**
 * Initialize WebSocket server (legacy function for backward compatibility)
 * @param {http.Server} server - HTTP server instance
 */
function initWebSocketServer(server) {
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws',
  });

  wss.on('connection', handleRawWSConnection);

  console.log('✅ WebSocket server initialized');
}

/**
 * Broadcast message to all clients in a room
 * @param {string} roomId - Room ID
 * @param {Object} message - Message to broadcast
 * @param {WebSocket} excludeWs - Optional: exclude this WebSocket from broadcast
 */
function broadcast(roomId, message, excludeWs = null) {
  if (!rooms.has(roomId)) {
    return;
  }

  broadcastToRoomSet(rooms.get(roomId), message, excludeWs);
}

module.exports = {
  initWebSocketServer,
  handleRawWSConnection,
  broadcast,
};
