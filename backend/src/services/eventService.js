// Event sourcing service
// insertEvent(type, payload, userId, roomId)
//   → inserts event into Event table
//   → NEVER updates or deletes events
//   → returns created event

const prisma = require('../db/prisma');

/**
 * Insert a new event into the event log
 * @param {string} type - Event type (NODE_CREATED, NODE_UPDATED, etc.)
 * @param {Object} payload - Event payload data
 * @param {string} userId - User who triggered the event
 * @param {string} roomId - Room ID
 * @returns {Promise<Object>} Created event
 */
async function insertEvent(type, payload, userId, roomId) {
  try {
    const event = await prisma.event.create({
      data: {
        type,
        payload,
        userId,
        roomId,
        timestamp: new Date(),
      },
    });

    return event;
  } catch (error) {
    console.error('[EventService] Failed to insert event:', error.message);
    console.warn('[EventService] Event not persisted - real-time sync will continue');
    
    // Return a mock event so the system continues working
    return {
      id: Date.now(),
      type,
      payload,
      userId,
      roomId,
      timestamp: new Date(),
      persisted: false
    };
  }
}

/**
 * Get all events for a room
 * @param {string} roomId - Room ID
 * @param {number} afterId - Optional: get events after this ID
 * @returns {Promise<Array>}
 */
async function getEvents(roomId, afterId = 0) {
  return await prisma.event.findMany({
    where: {
      roomId,
      id: { gt: afterId },
    },
    orderBy: { timestamp: 'asc' },
  });
}

/**
 * Get latest event ID for a room
 * @param {string} roomId - Room ID
 * @returns {Promise<number>}
 */
async function getLatestEventId(roomId) {
  const event = await prisma.event.findFirst({
    where: { roomId },
    orderBy: { id: 'desc' },
    select: { id: true },
  });

  return event ? event.id : 0;
}

module.exports = {
  insertEvent,
  getEvents,
  getLatestEventId,
};
