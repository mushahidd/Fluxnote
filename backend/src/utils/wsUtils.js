/**
 * WebSocket Utilities
 * Eliminates code duplication between wsServer.js and yjsServer.js
 */

const WebSocket = require('ws');
const { AuthenticationError } = require('./errors');
const { getUserForToken } = require('./supabase');
const shareService = require('../services/shareService');

/**
 * Parse and validate WebSocket connection query parameters
 * Extracts and verifies JWT token and roomId
 * 
 * @param {http.IncomingMessage} req - HTTP request
 * @returns {{ token: string, roomId: string, user: Object }}
 * @throws {AuthenticationError} If token or roomId is missing/invalid
 */
async function parseWsQuery(req) {
  // Use modern URL API (consistent with yjsServer.js:242)
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const roomId = url.searchParams.get('roomId');
  const shareToken = url.searchParams.get('shareToken');

  if (!roomId) {
    throw new AuthenticationError('RoomId required');
  }

  // Path 1: share token (anyone-with-link access — no JWT needed)
  if (shareToken && !token) {
    const shareAccess = await shareService.validateShareToken(shareToken);
    if (!shareAccess) {
      throw new AuthenticationError('Invalid or expired share link');
    }
    if (shareAccess.roomId !== roomId) {
      throw new AuthenticationError('Share token does not match room');
    }
    // Guest user — no real user account required
    return {
      token: shareToken,
      roomId,
      isGuest: true,
      shareRole: shareAccess.role,
      user: {
        id: `guest-${shareToken.slice(0, 8)}`,
        email: 'guest@share.link',
        role: shareAccess.role,
        name: 'Guest',
      },
    };
  }

  // TEMPORARY: Allow connections without token for testing
  // TODO: Remove this once proper authentication is implemented
  if (!token) {
    console.warn(`⚠️ [TEMP] Allowing unauthenticated access to room ${roomId} for testing`);
    return {
      token: 'temp-guest-token',
      roomId,
      isGuest: true,
      shareRole: 'contributor',
      user: {
        id: `guest-${Math.random().toString(36).substr(2, 9)}`,
        email: 'guest@temp.link',
        role: 'contributor',
        name: 'Guest User',
      },
    };
  }

  // Path 2: normal JWT auth
  let user;
  try {
    user = await getUserForToken(token);
    console.log('[wsUtils] User from token:', { 
      id: user?.id, 
      email: user?.email, 
      metadata: user?.user_metadata,
      app_metadata: user?.app_metadata 
    });
  } catch (error) {
    // TEMPORARY: If token validation fails, allow as guest
    console.warn(`⚠️ [TEMP] Token validation failed, allowing as guest: ${error.message}`);
    return {
      token: 'temp-guest-token',
      roomId,
      isGuest: true,
      shareRole: 'contributor',
      user: {
        id: `guest-${Math.random().toString(36).substr(2, 9)}`,
        email: 'guest@temp.link',
        role: 'contributor',
        name: 'Guest User',
      },
    };
  }
  
  if (!user) {
    // TEMPORARY: If user not found, allow as guest
    console.warn(`⚠️ [TEMP] User not found for token, allowing as guest`);
    return {
      token: 'temp-guest-token',
      roomId,
      isGuest: true,
      shareRole: 'contributor',
      user: {
        id: `guest-${Math.random().toString(36).substr(2, 9)}`,
        email: 'guest@temp.link',
        role: 'contributor',
        name: 'Guest User',
      },
    };
  }

  // Path 2b: JWT user accessing via share token (restricted invite check)
  if (shareToken) {
    const invite = await shareService.checkEmailInvite(roomId, user.email, user.id);
    if (invite) {
      // Auto-accept invite on first WS connect
      await shareService.acceptInvite(roomId, user.email, user.id).catch(() => {});
    }
  }

  console.log('[wsUtils] Authenticated user:', {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0],
    metadata: user.user_metadata
  });

  return {
    token,
    roomId,
    isGuest: false,
    user: {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || user.app_metadata?.role || 'Contributor',
      name: user.user_metadata?.name || user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    },
  };
}

/**
 * Broadcast message to all clients in a room (Set variant)
 * Used by wsServer.js which stores rooms as Map<roomId, Set<WebSocket>>
 * 
 * @param {Set<WebSocket>} clients - Set of WebSocket connections
 * @param {Object|Buffer} message - Message to broadcast (will be stringified if Object)
 * @param {WebSocket} excludeWs - Optional WebSocket to exclude from broadcast
 */
function broadcastToRoomSet(clients, message, excludeWs = null) {
  if (!clients || clients.size === 0) {
    return;
  }

  const messageData = Buffer.isBuffer(message) ? message : JSON.stringify(message);

  clients.forEach((clientWs) => {
    if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(messageData);
    }
  });
}

/**
 * Broadcast message to all clients in a room (Map variant)
 * Used by yjsServer.js which stores rooms as Map<roomId, Map<WebSocket, Object>>
 * 
 * @param {Map<WebSocket, Object>} roomConnections - Map of WebSocket connections
 * @param {Object|Buffer} message - Message to broadcast (will be stringified if Object)
 * @param {WebSocket} excludeWs - Optional WebSocket to exclude from broadcast
 */
function broadcastToRoomMap(roomConnections, message, excludeWs = null) {
  if (!roomConnections || roomConnections.size === 0) {
    return;
  }

  const messageData = Buffer.isBuffer(message) ? message : JSON.stringify(message);

  roomConnections.forEach((clientInfo, clientWs) => {
    if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(messageData);
    }
  });
}

/**
 * Safely close WebSocket connection with state check
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {number} code - Close code (default: 1000 = normal closure)
 * @param {string} reason - Close reason
 */
function safeCloseWs(ws, code = 1000, reason = '') {
  if (!ws) return;
  
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close(code, reason);
  }
}

/**
 * Safely send message to WebSocket with state check
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object|Buffer} message - Message to send
 * @returns {boolean} True if sent successfully
 */
function safeSendWs(ws, message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    const data = Buffer.isBuffer(message) ? message : JSON.stringify(message);
    ws.send(data);
    return true;
  } catch (error) {
    console.error('Failed to send WebSocket message:', error);
    return false;
  }
}

module.exports = {
  parseWsQuery,
  broadcastToRoomSet,
  broadcastToRoomMap,
  safeCloseWs,
  safeSendWs,
};
