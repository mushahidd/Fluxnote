/**
 * Unit tests for event logging integration in yjsServer.js
 * Tests that CRDT mutations are properly logged to the event service
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

// Mock modules BEFORE requiring yjsServer
jest.mock('../../services/eventService', () => ({
  insertEvent: jest.fn().mockResolvedValue({ id: 1 }),
}));
jest.mock('../../services/rbacService', () => ({
  canMutate: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../services/intentService', () => ({
  classifyNodeIntent: jest.fn().mockResolvedValue({ intent: 'note', confidence: 0.9 }),
}));

const Y = require('yjs');
const { logYjsMutations, getYDoc } = require('../yjsServer');
const { getEventType, decodeYjsUpdate } = require('../../utils/crdt');
const eventService = require('../../services/eventService');

describe('Event Logging Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Test 1: getEventType returns correct event types', () => {
    expect(getEventType({ operation: 'create' })).toBe('CRDT_NODE_CREATED');
    expect(getEventType({ operation: 'update' })).toBe('CRDT_NODE_UPDATED');
    expect(getEventType({ operation: 'delete' })).toBe('CRDT_NODE_DELETED');
    expect(getEventType({ operation: 'move' })).toBe('CRDT_NODE_MOVED');
    expect(getEventType({ operation: 'unknown' })).toBe('CRDT_NODE_UPDATED');
    console.log('✅ Test 1 passed: getEventType returns correct event types');
  });

  test('Test 2: logYjsMutations calls insertEvent for create mutation', async () => {
    const roomId = 'log_room_2';
    const userId = 'user_2';
    const ydoc = getYDoc(roomId);
    const nodesMap = ydoc.getMap('nodes');

    // Capture full state BEFORE the create (to seed the temp doc)
    const prevState = Y.encodeStateAsUpdate(ydoc);
    // Capture state vector BEFORE (to compute delta after)
    const svBefore = Y.encodeStateVector(ydoc);

    ydoc.transact(() => {
      nodesMap.set('node_2', {
        id: 'node_2', type: 'STICKY_NOTE', x: 100, y: 200, text: 'Test note', color: '#FF5722',
      });
    });

    // Delta = only what changed after svBefore
    const delta = Y.encodeStateAsUpdate(ydoc, svBefore);
    
    // Decode mutations
    const mutations = decodeYjsUpdate(delta, prevState);

    await logYjsMutations(mutations, roomId, userId);
    await new Promise((r) => setTimeout(r, 50));

    expect(eventService.insertEvent).toHaveBeenCalledWith(
      'CRDT_NODE_CREATED',
      expect.objectContaining({ nodeId: 'node_2' }),
      userId,
      roomId
    );
    console.log('✅ Test 2 passed: insertEvent called for CRDT_NODE_CREATED');
  });

  test('Test 3: logYjsMutations calls insertEvent for delete mutation', async () => {
    const roomId = 'log_room_3';
    const userId = 'user_3';
    const ydoc = getYDoc(roomId);
    const nodesMap = ydoc.getMap('nodes');

    // Pre-populate
    ydoc.transact(() => {
      nodesMap.set('node_3', { id: 'node_3', type: 'STICKY_NOTE', x: 10, y: 20 });
    });

    jest.clearAllMocks();

    const prevState = Y.encodeStateAsUpdate(ydoc);
    const svBefore = Y.encodeStateVector(ydoc);

    ydoc.transact(() => {
      nodesMap.delete('node_3');
    });

    const delta = Y.encodeStateAsUpdate(ydoc, svBefore);
    
    // Decode mutations
    const mutations = decodeYjsUpdate(delta, prevState);

    await logYjsMutations(mutations, roomId, userId);
    await new Promise((r) => setTimeout(r, 50));

    expect(eventService.insertEvent).toHaveBeenCalledWith(
      'CRDT_NODE_DELETED',
      expect.objectContaining({ nodeId: 'node_3' }),
      userId,
      roomId
    );
    console.log('✅ Test 3 passed: insertEvent called for CRDT_NODE_DELETED');
  });

  test('Test 4: logYjsMutations calls insertEvent for move mutation (only x/y change)', async () => {
    const roomId = 'log_room_4';
    const userId = 'user_4';
    const ydoc = getYDoc(roomId);
    const nodesMap = ydoc.getMap('nodes');

    // Pre-populate
    ydoc.transact(() => {
      nodesMap.set('node_4', {
        id: 'node_4', type: 'STICKY_NOTE', x: 100, y: 200, text: 'hello', color: '#fff',
      });
    });

    jest.clearAllMocks();

    const prevState = Y.encodeStateAsUpdate(ydoc);
    const svBefore = Y.encodeStateVector(ydoc);

    ydoc.transact(() => {
      const node = nodesMap.get('node_4');
      nodesMap.set('node_4', { ...node, x: 300, y: 400 });
    });

    const delta = Y.encodeStateAsUpdate(ydoc, svBefore);
    
    // Decode mutations
    const mutations = decodeYjsUpdate(delta, prevState);

    await logYjsMutations(mutations, roomId, userId);
    await new Promise((r) => setTimeout(r, 50));

    expect(eventService.insertEvent).toHaveBeenCalledWith(
      'CRDT_NODE_MOVED',
      expect.objectContaining({ nodeId: 'node_4', x: 300, y: 400 }),
      userId,
      roomId
    );
    console.log('✅ Test 4 passed: insertEvent called for CRDT_NODE_MOVED');
  });

  test('Test 5: logYjsMutations does not throw when insertEvent fails', async () => {
    const roomId = 'log_room_5';
    const userId = 'user_5';
    const ydoc = getYDoc(roomId);
    const nodesMap = ydoc.getMap('nodes');

    eventService.insertEvent.mockRejectedValueOnce(new Error('Database error'));

    const prevState = Y.encodeStateAsUpdate(ydoc);
    const svBefore = Y.encodeStateVector(ydoc);

    ydoc.transact(() => {
      nodesMap.set('node_5', { id: 'node_5', type: 'STICKY_NOTE', x: 0, y: 0 });
    });

    const delta = Y.encodeStateAsUpdate(ydoc, svBefore);
    
    // Decode mutations
    const mutations = decodeYjsUpdate(delta, prevState);

    await expect(
      logYjsMutations(mutations, roomId, userId)
    ).resolves.not.toThrow();

    console.log('✅ Test 5 passed: Event logging failures handled gracefully');
  });
});
