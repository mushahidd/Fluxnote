// Handle incoming WebSocket messages
// Message format: { type, payload, nodeId }
//
// switch(message.type):
//   case "NODE_UPDATE":
//     1. rbacService.canMutate(userId, nodeId) → if false, send error back
//     2. eventService.insertEvent("NODE_UPDATED", payload, userId, roomId)
//     3. broadcast delta to all room clients (NOT full state)
//     4. intentService.classifyNodeIntent(payload.text) [async, non-blocking]
//
//   case "NODE_CREATE": → insert + broadcast
//   case "NODE_DELETE": → insert DELETE event + broadcast
//   case "CURSOR_MOVE": → broadcast ONLY (don't persist cursor positions)
//
// CRITICAL: RBAC check happens HERE before every mutation

const WebSocket = require('ws');
const eventService = require('../services/eventService');
const rbacService = require('../services/rbacService');
const intentService = require('../services/intentService');
const { isValidWSMessage, isValidNodePayload } = require('../utils/validation');
const { ValidationError } = require('../utils/errors');

/**
 * Handle WebSocket message
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Parsed message
 * @param {Function} broadcast - Function to broadcast to room
 */
async function handleMessage(ws, message, broadcast) {
  try {
    // Validate message structure
    const validation = isValidWSMessage(message);
    if (!validation.valid) {
      return sendError(ws, `Invalid message: ${validation.errors.join(', ')}`);
    }

    const { type, payload, nodeId } = message;

    // Use authenticated user info and roomId from WebSocket (prevents room ID spoofing)
    const user = {
      id: ws.userId,
      role: ws.userRole,
      name: ws.userName
    };
    const roomId = ws.roomId; // Use validated roomId from connection, not from message

    // Handle different message types
    switch (type) {
      case 'NODE_CREATE':
        await handleNodeCreate(ws, user, payload, roomId, broadcast);
        break;

      case 'NODE_UPDATE':
        await handleNodeUpdate(ws, user, nodeId, payload, roomId, broadcast);
        break;

      case 'NODE_DELETE':
        await handleNodeDelete(ws, user, nodeId, roomId, broadcast);
        break;

      case 'NODE_MOVE':
        await handleNodeMove(ws, user, nodeId, payload, roomId, broadcast);
        break;

      default:
        sendError(ws, `Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('WebSocket message handler error:', error);
    sendError(ws, 'Internal server error');
  }
}

/**
 * Handle node creation
 */
async function handleNodeCreate(ws, user, payload, roomId, broadcast) {
  try {
    // Validate payload structure
    const validation = isValidNodePayload(payload, 'create');
    if (!validation.valid) {
      return sendError(ws, `Invalid payload: ${validation.errors.join(', ')}`);
    }

    // CRITICAL: Viewers cannot create nodes
    if (user.role === 'viewer' || user.role === 'Viewer') {
      return sendError(ws, 'FORBIDDEN: Viewers cannot edit the canvas');
    }

    const nodeId = payload.nodeId || generateNodeId();
    const event = await eventService.insertEvent(
      'NODE_CREATED',
      { ...payload, nodeId },
      user.id,
      roomId
    );

    // Broadcast to all clients in room (including sender for operation confirmation)
    broadcast(roomId, {
      type: 'NODE_CREATED',
      event,
      payload: { ...payload, nodeId },
    });

    // Classify intent asynchronously (non-blocking)
    if (payload.text) {
      intentService.classifyNodeIntent(payload.text, nodeId, roomId, user.id)
        .catch(err => console.error('Intent classification error:', err));
    }
  } catch (error) {
    console.error('Node create error:', error);
    sendError(ws, 'Failed to create node');
  }
}

/**
 * Handle node update
 */
async function handleNodeUpdate(ws, user, nodeId, payload, roomId, broadcast) {
  try {
    // Validate payload structure
    const validation = isValidNodePayload(payload, 'update');
    if (!validation.valid) {
      return sendError(ws, `Invalid payload: ${validation.errors.join(', ')}`);
    }

    // CRITICAL: Viewers cannot update nodes
    if (user.role === 'viewer' || user.role === 'Viewer') {
      return sendError(ws, 'FORBIDDEN: Viewers cannot edit the canvas');
    }

    // RBAC check - can user mutate this node?
    const canMutate = await rbacService.canMutate(user.id, nodeId, 'update');
    
    if (!canMutate) {
      return sendError(ws, 'You do not have permission to update this node');
    }

    const event = await eventService.insertEvent(
      'NODE_UPDATED',
      { ...payload, nodeId },
      user.id,
      roomId
    );

    // Broadcast delta to all clients
    broadcast(roomId, {
      type: 'NODE_UPDATED',
      event,
      nodeId,
      payload,
    });

    // Classify intent if text was updated (async, non-blocking)
    if (payload.text) {
      intentService.classifyNodeIntent(payload.text, nodeId, roomId, user.id)
        .catch(err => console.error('Intent classification error:', err));
    }
  } catch (error) {
    console.error('Node update error:', error);
    sendError(ws, 'Failed to update node');
  }
}

/**
 * Handle node deletion
 */
async function handleNodeDelete(ws, user, nodeId, roomId, broadcast) {
  try {
    // CRITICAL: Viewers cannot delete nodes
    if (user.role === 'viewer' || user.role === 'Viewer') {
      return sendError(ws, 'FORBIDDEN: Viewers cannot edit the canvas');
    }

    // RBAC check
    const canMutate = await rbacService.canMutate(user.id, nodeId, 'delete');
    
    if (!canMutate) {
      return sendError(ws, 'You do not have permission to delete this node');
    }

    const event = await eventService.insertEvent(
      'NODE_DELETED',
      { nodeId },
      user.id,
      roomId
    );

    // Broadcast deletion
    broadcast(roomId, {
      type: 'NODE_DELETED',
      event,
      nodeId,
    });
  } catch (error) {
    console.error('Node delete error:', error);
    sendError(ws, 'Failed to delete node');
  }
}

/**
 * Handle node move
 */
async function handleNodeMove(ws, user, nodeId, payload, roomId, broadcast) {
  try {
    // Validate payload structure
    const validation = isValidNodePayload(payload, 'move');
    if (!validation.valid) {
      return sendError(ws, `Invalid payload: ${validation.errors.join(', ')}`);
    }

    // CRITICAL: Viewers cannot move nodes
    if (user.role === 'viewer' || user.role === 'Viewer') {
      return sendError(ws, 'FORBIDDEN: Viewers cannot edit the canvas');
    }

    // RBAC check
    const canMutate = await rbacService.canMutate(user.id, nodeId, 'update');
    
    if (!canMutate) {
      return sendError(ws, 'You do not have permission to move this node');
    }

    const event = await eventService.insertEvent(
      'NODE_MOVED',
      { nodeId, x: payload.x, y: payload.y },
      user.id,
      roomId
    );

    // Broadcast move
    broadcast(roomId, {
      type: 'NODE_MOVED',
      event,
      nodeId,
      payload,
    });
  } catch (error) {
    console.error('Node move error:', error);
    sendError(ws, 'Failed to move node');
  }
}

/**
 * Send error message to client
 */
function sendError(ws, message) {
  if (ws.readyState !== WebSocket.OPEN) return;
  
  ws.send(JSON.stringify({
    type: 'ERROR',
    error: message,
  }));
}

/**
 * Generate unique node ID
 */
function generateNodeId() {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  handleMessage,
};
