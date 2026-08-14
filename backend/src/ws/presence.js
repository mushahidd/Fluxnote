/**
 * Presence Manager - Track and manage ephemeral user presence data
 * 
 * This module handles real-time cursor tracking for collaborative sessions.
 * Cursor positions are stored in-memory only (ephemeral data, not persisted).
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

/**
 * In-memory cursor tracking structure
 * Map<roomId, Map<userId, CursorData>>
 * 
 * CursorData: {
 *   x: number,
 *   y: number,
 *   name: string,
 *   color: string,
 *   lastUpdate: timestamp
 * }
 */
const rooms = new Map();

/**
 * Update cursor position for a user in a room
 * 
 * @param {string} roomId - Room identifier
 * @param {string} userId - User identifier
 * @param {Object} position - Cursor position {x, y}
 * @param {string} userName - User display name
 * @param {string} color - Cursor color (hex)
 * @returns {Object} Updated cursor data
 */
function updateCursor(roomId, userId, position, userName, color) {
  // Ensure room exists
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  const roomCursors = rooms.get(roomId);
  
  // Create cursor data with timestamp
  const cursorData = {
    x: position.x,
    y: position.y,
    name: userName,
    color: color,
    lastUpdate: Date.now()
  };

  // Update cursor position
  roomCursors.set(userId, cursorData);

  return cursorData;
}

/**
 * Get all cursors for a room
 * 
 * @param {string} roomId - Room identifier
 * @returns {Map<userId, CursorData>} Map of user cursors
 */
function getCursors(roomId) {
  if (!rooms.has(roomId)) {
    return new Map();
  }

  return rooms.get(roomId);
}

/**
 * Remove user cursor on disconnect
 * 
 * @param {string} roomId - Room identifier
 * @param {string} userId - User identifier
 * @returns {boolean} True if cursor was removed, false if not found
 */
function removeCursor(roomId, userId) {
  if (!rooms.has(roomId)) {
    return false;
  }

  const roomCursors = rooms.get(roomId);
  const removed = roomCursors.delete(userId);

  // Clean up empty rooms
  if (roomCursors.size === 0) {
    rooms.delete(roomId);
  }

  return removed;
}

/**
 * Broadcast cursor update to all clients in room
 * 
 * @param {string} roomId - Room identifier
 * @param {string} userId - User identifier
 * @param {Object} cursorData - Cursor data to broadcast
 * @param {Function} broadcast - Broadcast function from wsServer
 */
function broadcastCursor(roomId, userId, cursorData, broadcast) {
  // Prepare broadcast message
  const message = {
    type: 'CURSOR_MOVE',
    userId: userId,
    userName: cursorData.name,
    color: cursorData.color,
    payload: {
      x: cursorData.x,
      y: cursorData.y
    },
    timestamp: cursorData.lastUpdate
  };

  console.log(`Broadcasting cursor for user ${userId}: name="${cursorData.name}", color="${cursorData.color}"`);

  // Broadcast to all clients in room (broadcast function handles excluding sender)
  broadcast(roomId, message);
}

/**
 * Get cursor snapshot for new joiners
 * Returns all current cursor positions in a room
 * 
 * @param {string} roomId - Room identifier
 * @returns {Array} Array of cursor data objects
 */
function getCursorSnapshot(roomId) {
  const cursors = getCursors(roomId);
  const snapshot = [];

  cursors.forEach((cursorData, userId) => {
    snapshot.push({
      userId,
      ...cursorData
    });
  });

  console.log(`Cursor snapshot for room ${roomId}:`, JSON.stringify(snapshot, null, 2));

  return snapshot;
}

/**
 * Clean up stale cursors (optional maintenance function)
 * Removes cursors that haven't been updated in the specified timeout
 * 
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30 seconds)
 * @returns {number} Number of cursors removed
 */
function cleanupStaleCursors(timeoutMs = 30000) {
  const now = Date.now();
  let removedCount = 0;

  rooms.forEach((roomCursors, roomId) => {
    roomCursors.forEach((cursorData, userId) => {
      if (now - cursorData.lastUpdate > timeoutMs) {
        roomCursors.delete(userId);
        removedCount++;
      }
    });

    // Clean up empty rooms
    if (roomCursors.size === 0) {
      rooms.delete(roomId);
    }
  });

  return removedCount;
}

/**
 * Get statistics about presence data (for monitoring)
 * 
 * @returns {Object} Statistics object
 */
function getStats() {
  let totalCursors = 0;
  const roomStats = [];

  rooms.forEach((roomCursors, roomId) => {
    totalCursors += roomCursors.size;
    roomStats.push({
      roomId,
      cursorCount: roomCursors.size
    });
  });

  return {
    totalRooms: rooms.size,
    totalCursors,
    rooms: roomStats
  };
}

module.exports = {
  updateCursor,
  getCursors,
  removeCursor,
  broadcastCursor,
  getCursorSnapshot,
  cleanupStaleCursors,
  getStats
};
