/**
 * Input Validation Utilities
 * Validates WebSocket messages, payloads, and user inputs
 */

const WebSocket = require('ws');

/**
 * Validate WebSocket message structure
 * @param {Object} message - Parsed WebSocket message
 * @returns {{ valid: boolean, errors: Array<string> }}
 */
function isValidWSMessage(message) {
  const errors = [];
  
  if (!message || typeof message !== 'object') {
    errors.push('Message must be an object');
    return { valid: false, errors };
  }
  
  if (!message.type || typeof message.type !== 'string') {
    errors.push('Message type is required and must be a string');
  }
  
  const validTypes = ['NODE_CREATE', 'NODE_UPDATE', 'NODE_DELETE', 'NODE_MOVE', 'CURSOR_MOVE'];
  if (message.type && !validTypes.includes(message.type)) {
    errors.push(`Invalid message type: ${message.type}`);
  }
  
  if (!message.payload || typeof message.payload !== 'object') {
    errors.push('Message payload is required and must be an object');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate node payload structure
 * @param {Object} payload - Node payload
 * @param {string} operation - Operation type (create, update, delete, move)
 * @returns {{ valid: boolean, errors: Array<string> }}
 */
function isValidNodePayload(payload, operation) {
  const errors = [];
  
  if (!payload || typeof payload !== 'object') {
    errors.push('Payload must be an object');
    return { valid: false, errors };
  }
  
  // Validate based on operation
  switch (operation) {
    case 'create':
      // nodeId is optional - server generates if not provided (wsHandler.js:76)
      if (payload.x === undefined || typeof payload.x !== 'number') {
        errors.push('x coordinate is required and must be a number');
      }
      if (payload.y === undefined || typeof payload.y !== 'number') {
        errors.push('y coordinate is required and must be a number');
      }
      break;
      
    case 'update':
      // At least one field should be present
      if (!payload.text && !payload.color && !payload.width && !payload.height) {
        errors.push('At least one update field is required');
      }
      break;
      
    case 'move':
      if (payload.x === undefined || typeof payload.x !== 'number') {
        errors.push('x coordinate is required for move');
      }
      if (payload.y === undefined || typeof payload.y !== 'number') {
        errors.push('y coordinate is required for move');
      }
      break;
      
    case 'delete':
      // No specific validation needed
      break;
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate Yjs binary message structure
 * @param {Buffer|Uint8Array} buffer - Binary message buffer
 * @returns {{ valid: boolean, error?: string }}
 */
function isValidYjsMessage(buffer) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    return { valid: false, error: 'Message must be a Buffer or Uint8Array' };
  }
  
  if (buffer.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  const messageType = buffer[0];
  
  // messageType 0 = sync protocol, 1 = awareness
  if (messageType !== 0 && messageType !== 1) {
    return { valid: false, error: `Invalid message type: ${messageType}` };
  }
  
  if (messageType === 0 && buffer.length < 2) {
    return { valid: false, error: 'Sync message must have at least 2 bytes' };
  }
  
  return { valid: true };
}

/**
 * Validate room ID format
 * @param {string} roomId - Room identifier
 * @returns {boolean}
 */
function isValidRoomId(roomId) {
  return typeof roomId === 'string' && roomId.length > 0 && roomId.length <= 255;
}

/**
 * Validate node ID format
 * @param {string} nodeId - Node identifier
 * @returns {boolean}
 */
function isValidNodeId(nodeId) {
  return typeof nodeId === 'string' && nodeId.length > 0 && nodeId.length <= 255;
}

/**
 * Validate user role
 * @param {string} role - User role
 * @returns {boolean}
 */
function isValidRole(role) {
  const validRoles = ['Lead', 'Contributor', 'Viewer'];
  return validRoles.includes(role);
}

/**
 * Sanitize text input for display
 * NOTE: This is display-layer escaping for logging/rendering, NOT input sanitization.
 * For HTML rendering, use a library like DOMPurify or escape at render time.
 * 
 * @param {string} input - User input text
 * @returns {string} Escaped text
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

module.exports = {
  isValidWSMessage,
  isValidNodePayload,
  isValidYjsMessage,
  isValidRoomId,
  isValidNodeId,
  isValidRole,
  sanitizeInput,
};
