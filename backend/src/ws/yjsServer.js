// Yjs WebSocket Server
// Manages CRDT document synchronization using y-websocket
// Handles real-time collaborative canvas editing with automatic conflict resolution
//
// Requirements: 1.1, 1.4, 1.5

const WebSocket = require('ws');
const Y = require('yjs');
const fs = require('fs');
const path = require('path');
const rbacService = require('../services/rbacService');
const eventService = require('../services/eventService');
const intentService = require('../services/intentService');
const { decodeYjsUpdate, getEventType } = require('../utils/crdt');
const { parseWsQuery, broadcastToRoomMap, safeCloseWs } = require('../utils/wsUtils');
const { AuthenticationError } = require('../utils/errors');
const { isValidYjsMessage } = require('../utils/validation');
const prisma = require('../db/prisma');

// In-memory storage for Y.Doc instances per room
// Map<roomId, Y.Doc>
const ydocs = new Map();

// Track WebSocket connections per room with user context
// Map<roomId, Map<WebSocket, {userId, userRole}>>
const roomConnections = new Map();

// Persistence directory for Y.Doc snapshots
const PERSIST_DIR = path.join(__dirname, '../../data/ydocs');
if (!fs.existsSync(PERSIST_DIR)) {
  fs.mkdirSync(PERSIST_DIR, { recursive: true });
}

// Debounce timers for saving docs
const saveTimers = new Map();

/**
 * Persist Y.Doc state to database (debounced — saves 2s after last update)
 */
function scheduleSave(roomId) {
  if (saveTimers.has(roomId)) clearTimeout(saveTimers.get(roomId));
  saveTimers.set(roomId, setTimeout(() => {
    const ydoc = ydocs.get(roomId);
    if (!ydoc) return;
    try {
      const update = Y.encodeStateAsUpdate(ydoc);
      fs.writeFileSync(path.join(PERSIST_DIR, `${roomId}.bin`), Buffer.from(update));
      console.log(`[Persist] Saved Y.Doc for room: ${roomId}`);
    } catch (err) {
      console.error(`[Persist] Failed to save room ${roomId}:`, err.message);
    }
    saveTimers.delete(roomId);
  }, 2000));
}

/**
 * Persist Y.Doc nodes to Supabase database
 * This ensures drawings are saved and can be recovered even if binary files are lost
 * Debounced to avoid excessive database writes
 * 
 * @param {string} roomId - Room identifier
 * @param {Y.Doc} ydoc - The Y.Doc instance
 * @param {string} userId - User who triggered the update
 */
const dbSaveTimers = new Map();
async function persistYDocToDatabase(roomId, ydoc, userId) {
  // Debounce database saves (5 seconds after last update)
  if (dbSaveTimers.has(roomId)) {
    clearTimeout(dbSaveTimers.get(roomId));
  }

  dbSaveTimers.set(roomId, setTimeout(async () => {
    try {
      const nodesMap = ydoc.getMap('nodes');
      const nodes = [];
      
      nodesMap.forEach((value, key) => {
        nodes.push({
          id: key,
          roomId,
          ...value,
          updatedBy: userId,
          updatedAt: new Date(),
        });
      });

      console.log(`[Persist] Saving ${nodes.length} nodes to database for room: ${roomId}`);

      // Use upsert to create or update each node
      for (const node of nodes) {
        await prisma.canvasNode.upsert({
          where: {
            id_roomId: {
              id: node.id,
              roomId: roomId,
            },
          },
          update: {
            type: node.type,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            rotation: node.rotation,
            content: node.content || {},
            color: node.color,
            locked: node.locked || false,
            intent: node.intent,
            taskStatus: node.taskStatus,
            assignee: node.assignee,
            points: node.points || [],
            updatedBy: userId,
            updatedAt: new Date(),
          },
          create: {
            id: node.id,
            roomId: roomId,
            type: node.type || 'unknown',
            x: node.x || 0,
            y: node.y || 0,
            width: node.width,
            height: node.height,
            rotation: node.rotation || 0,
            content: node.content || {},
            color: node.color,
            locked: node.locked || false,
            intent: node.intent,
            taskStatus: node.taskStatus,
            assignee: node.assignee,
            points: node.points || [],
            createdBy: node.createdBy || userId,
            createdAt: node.createdAt ? new Date(node.createdAt) : new Date(),
            updatedBy: userId,
            updatedAt: new Date(),
          },
        });
      }

      console.log(`✅ [Persist] Successfully saved ${nodes.length} nodes to database for room: ${roomId}`);
    } catch (error) {
      console.error(`❌ [Persist] Failed to save nodes to database for room ${roomId}:`, error.message);
      // Don't throw - real-time sync still works even if DB save fails
    } finally {
      dbSaveTimers.delete(roomId);
    }
  }, 5000)); // 5 second debounce for database writes
}

/**
 * Load Y.Doc state from disk if available
 */
function loadFromDisk(roomId, ydoc) {
  const filePath = path.join(PERSIST_DIR, `${roomId}.bin`);
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath);
      Y.applyUpdate(ydoc, new Uint8Array(data));
      const nodesMap = ydoc.getMap('nodes');
      console.log(`[Persist] Loaded Y.Doc for room: ${roomId}, nodes in map: ${nodesMap.size}`);
    } catch (err) {
      console.error(`[Persist] Failed to load room ${roomId}:`, err.message);
    }
  } else {
    console.log(`[Persist] No saved state found for room: ${roomId}`);
  }
}

/**
 * Initialize Yjs WebSocket server on /yjs path (legacy function for backward compatibility)
 * @param {http.Server} server - HTTP server instance
 * @returns {WebSocket.Server} Yjs WebSocket server instance
 */
function initYjsServer(server) {
  const wss = new WebSocket.Server({ noServer: true });

  console.log('Yjs WebSocket server initialized on /yjs');

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/yjs') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', handleYjsConnection);

  return wss;
}

/**
 * Get or create Y.Doc instance for a room, loading from disk if available
 */
function getYDoc(roomId) {
  if (!ydocs.has(roomId)) {
    const ydoc = new Y.Doc();
    loadFromDisk(roomId, ydoc);
    ydocs.set(roomId, ydoc);
    console.log(`[YDoc] Loaded/created Y.Doc for room: ${roomId}`);
  }
  return ydocs.get(roomId);
}

/**
 * Check RBAC permissions for all mutations in an update BEFORE applying.
 * Falls back to ALLOW when Supabase/DB is unreachable so drawing always works.
 * 
 * Requirements: 1.6, 2.1-2.6
 */
async function checkYjsMutations(mutations, userId, roomId, accessToken, userRole) {
  // CRITICAL: Check if user is a Viewer - Viewers cannot edit anything
  if (userRole === 'viewer' || userRole === 'Viewer') {
    console.warn(`[RBAC] User ${userId} is a Viewer - blocking all mutations`);
    return false;
  }

  for (const mutation of mutations) {
    if (!mutation.nodeId) continue;

    let canMutate = true;
    try {
      // For CREATE operations, check room-level permissions instead of node-level
      // (node doesn't exist yet in database)
      if (mutation.operation === 'create') {
        try {
          const workspaceRole = await rbacService.getWorkspaceRoleForRoom(
            userId,
            roomId,
            accessToken,
            null // userEmail not needed for basic role check
          );
          
          // If we got a role, check it. If null (DB error), allow by default
          if (workspaceRole === null) {
            console.warn(`[RBAC] Could not fetch role for user ${userId} in room ${roomId}, allowing by default`);
            canMutate = true;
          } else {
            // Allow if user has contributor or higher role
            // Viewers cannot create nodes
            canMutate = workspaceRole !== 'viewer';
            
            if (!canMutate) {
              console.warn(`[RBAC] User ${userId} role '${workspaceRole}' cannot create nodes in room ${roomId}`);
            }
          }
        } catch (roleErr) {
          console.warn(`[RBAC] Role check failed (DB unavailable), allowing create: ${roleErr.message}`);
          canMutate = true;
        }
      } else {
        // For UPDATE/DELETE, check node-level permissions
        canMutate = await rbacService.canMutate(
          userId,
          mutation.nodeId,
          mutation.operation,
          accessToken
        );
        
        // If canMutate is false, it might be due to DB error, not actual permission denial
        // Check if it's a DB connectivity issue
        if (!canMutate) {
          console.warn(`[RBAC] canMutate returned false for ${mutation.operation} on node ${mutation.nodeId}, treating as DB error and allowing`);
          canMutate = true;
        }
      }
    } catch (err) {
      // DB/Supabase unreachable — allow the mutation so drawing is never blocked
      console.warn(`[RBAC] Check failed (DB unavailable), allowing mutation: ${err.message}`);
      canMutate = true;
    }

    if (!canMutate) {
      console.warn(`RBAC violation: User ${userId} cannot ${mutation.operation} node ${mutation.nodeId}`);
      eventService.insertEvent(
        'RBAC_VIOLATION',
        { userId, nodeId: mutation.nodeId, operation: mutation.operation, reason: 'Insufficient permissions' },
        userId,
        roomId
      ).catch(() => {});
      return false;
    }
  }
  return true;
}

/**
 * Log events and classify intent for mutations (called AFTER update is applied and RBAC passed).
 * Also persists the full node state to database for reliable recovery.
 * 
 * Requirements: 2.1-2.6, 13.1-13.6, 15.1-15.6
 * @param {Array<Object>} mutations - Array of decoded mutations
 * @param {string} roomId - Room identifier
 * @param {string} userId - User identifier
 * @param {Y.Doc} ydoc - The Y.Doc instance to read current state from
 */
async function logYjsMutations(mutations, roomId, userId, ydoc) {
  const aiService = require('../services/aiService');
  const { broadcast } = require('./wsServer');
  
  for (const mutation of mutations) {
    if (!mutation.nodeId) continue;

    // Build event payload
    const eventType = getEventType(mutation);
    const eventPayload = { nodeId: mutation.nodeId, ...mutation.payload };

    if (mutation.operation === 'update' && mutation.previousValues) {
      eventPayload.previousValues = mutation.previousValues;
    }
    if (mutation.operation === 'delete' && mutation.previousValues) {
      eventPayload.deletedNode = mutation.previousValues;
    }

    // Non-blocking event log insertion
    eventService.insertEvent(eventType, eventPayload, userId, roomId)
      .catch((error) => {
        console.error('Event log insertion failed:', {
          userId,
          nodeId: mutation.nodeId,
          operation: mutation.operation,
          reason: error.message,
        });
      });

    // Non-blocking intent classification for text changes
    if (mutation.payload && mutation.payload.text) {
      intentService
        .classifyNodeIntent(mutation.payload.text, mutation.nodeId, roomId, userId)
        .catch((error) => {
          console.error('Intent classification failed:', {
            userId,
            nodeId: mutation.nodeId,
            reason: error.message,
          });
        });
    }

    // AI-powered intent classification + auto task creation
    // Check for text content in any node type
    if (mutation.payload && mutation.payload.text) {
      // Run asynchronously without blocking
      setImmediate(async () => {
        try {
          const text = mutation.payload.text;
          const intent = await aiService.classifyNodeIntent(text);
          
          console.log(`[AI] Classified node ${mutation.nodeId} as: ${intent}`);
          
          // Log intent classification event
          await eventService.insertEvent('NODE_INTENT_CLASSIFIED', {
            nodeId: mutation.nodeId,
            intent,
          }, userId, roomId);
          
          // If intent is "Action", create a task automatically
          if (intent === 'Action') {
            // Check if task already exists for this node
            const existing = await prisma.task.findFirst({
              where: { nodeId: mutation.nodeId }
            });
            
            if (!existing) {
              // Create task in database
              const task = await prisma.task.create({
                data: {
                  text: text.substring(0, 100), // Limit title length
                  authorId: userId,
                  nodeId: mutation.nodeId,
                  roomId: roomId,
                  status: 'todo',
                },
                include: {
                  author: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    }
                  }
                }
              });
              
              console.log(`[AI] Auto-created task ${task.id} for node ${mutation.nodeId}`);
              
              // Broadcast task creation to all users in room via /ws WebSocket
              broadcast(roomId, {
                type: 'task:created',
                task: {
                  id: task.id,
                  text: task.text,
                  status: task.status,
                  nodeId: task.nodeId,
                  authorId: task.authorId,
                  authorName: task.author?.name || task.author?.email || 'Unknown',
                  createdAt: task.createdAt,
                }
              });
            }
          }
        } catch (error) {
          console.error('[AI] Failed to classify intent or create task:', error.message);
        }
      });
    }
  }

  // CRITICAL: Persist full Y.Doc state to database after mutations
  // This ensures drawings are saved even if event sourcing fails
  persistYDocToDatabase(roomId, ydoc, userId).catch((error) => {
    console.error('[Persist] Failed to save Y.Doc to database:', error.message);
  });
}

/**
 * Authenticate WebSocket connection using JWT
 * Requirements: 1.2, 1.3
 */
async function authenticateYjsConnection(ws, req) {
  try {
    const { user, roomId, token } = await parseWsQuery(req);
    
    ws.userId = user.id;
    ws.userRole = user.role;
    ws.roomId = roomId;
    ws.accessToken = token;

    console.log(`Yjs connection authenticated: User ${ws.userId} (${ws.userRole}) joined room ${roomId}`);
    return true;
  } catch (error) {
    console.error('Yjs authentication failed:', error.message);
    safeCloseWs(ws, 1008, error.message);
    return false;
  }
}

/**
 * Handle WebSocket connection lifecycle (exported for use in index.js)
 * Requirements: 1.2, 1.3, 1.6, 13.1-13.6
 * @param {WebSocket} ws - WebSocket connection
 * @param {http.IncomingMessage} req - HTTP request
 */
async function handleYjsConnection(ws, req) {
  console.log(`[Yjs] 🔌 New connection attempt, readyState: ${ws.readyState}`);
  
  const authenticated = await authenticateYjsConnection(ws, req);
  if (!authenticated) return;

  const { roomId, userId } = ws;
  const ydoc = getYDoc(roomId);

  console.log(`[Yjs] ✅ Authenticated connection for user ${userId} in room ${roomId}`);

  // Track connection
  if (!roomConnections.has(roomId)) {
    roomConnections.set(roomId, new Map());
  }
  roomConnections.get(roomId).set(ws, { userId, userRole: ws.userRole });
  
  console.log(`[Yjs] Room ${roomId} now has ${roomConnections.get(roomId).size} connection(s)`);

  // Attach update handler once per Y.Doc
  if (!ydoc._updateHandlerAttached) {
    ydoc.on('update', (update, origin) => {
      // Persist to disk (debounced)
      scheduleSave(roomId);

      // Broadcast update to all other clients in the room
      const connections = roomConnections.get(roomId);
      if (connections) {
        const message = Buffer.concat([
          Buffer.from([0, 2]),
          Buffer.from(update)
        ]);
        const excludeWs = origin?.ws;
        const broadcastCount = Array.from(connections.keys()).filter(
          ws => ws !== excludeWs && ws.readyState === 1
        ).length;
        
        console.log(`[YDoc] Broadcasting update to ${broadcastCount} clients in room ${roomId} (excluding sender: ${!!excludeWs})`);
        broadcastToRoomMap(connections, message, excludeWs);
      } else {
        console.warn(`[YDoc] No connections found for room ${roomId} during update broadcast`);
      }
    });
    ydoc._updateHandlerAttached = true;
    console.log(`[YDoc] Update handler attached for room ${roomId}`);
  }

  // Send initial sync: SyncStep1 (state vector)
  const stateVector = Y.encodeStateVector(ydoc);
  const syncStep1Message = Buffer.concat([
    Buffer.from([0, 0]), // messageType: 0 = sync, syncMessageType: 0 = SyncStep1
    Buffer.from(stateVector)
  ]);
  
  console.log(`[Yjs] Sending SyncStep1 to user ${userId}, message size: ${syncStep1Message.length} bytes, ws.readyState: ${ws.readyState}`);
  
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(syncStep1Message);
    console.log(`[Yjs] ✅ SyncStep1 sent successfully, Y.Doc has ${ydoc.getMap('nodes').size} nodes`);
  } else {
    console.error(`[Yjs] ❌ Cannot send SyncStep1 - WebSocket not open, state: ${ws.readyState}`);
  }

  // Handle incoming Yjs binary messages
  console.log(`[Yjs] 🎯 Attaching message handler for user ${userId}...`);
  
  // Test: Add a simple listener first to verify events are firing
  let messageCount = 0;
  ws.on('message', (data) => {
    messageCount++;
    console.log(`[Yjs] 📨 RAW MESSAGE #${messageCount} received for user ${userId}, size: ${data.length} bytes`);
  });
  
  ws.on('message', async (data) => {
    console.log(`[Yjs] ⚡ MESSAGE EVENT FIRED for user ${userId}`);
    
    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      console.log(`[Yjs] Received message from user ${userId}, size: ${buffer.length} bytes, first bytes: [${buffer[0]}, ${buffer[1]}]`);
      
      // Validate binary message
      const validation = isValidYjsMessage(buffer);
      if (!validation.valid) {
        console.warn(`Invalid Yjs message from user ${userId}:`, validation.error);
        return;
      }

      const messageType = buffer[0];

      // messageType 0 = sync protocol
      if (messageType === 0) {
        if (buffer.length < 2) return;
        
        const syncMessageType = buffer[1];
        const payload = buffer.subarray(2);

        if (syncMessageType === 0) {
          // SyncStep1: Client sends state vector, we respond with missing updates
          const stateVector = new Uint8Array(payload);
          const update = Y.encodeStateAsUpdate(ydoc, stateVector);
          
          const syncStep2Message = Buffer.concat([
            Buffer.from([0, 1]), // messageType: 0 = sync, syncMessageType: 1 = SyncStep2
            Buffer.from(update)
          ]);
          ws.send(syncStep2Message);

        } else if (syncMessageType === 1) {
          // SyncStep2: Client sends missing updates
          const update = new Uint8Array(payload);
          
          console.log(`[Yjs] Received SyncStep2 from user ${userId}, update size: ${update.length} bytes`);
          
          // Capture state BEFORE applying update
          const prevStateUpdate = Y.encodeStateAsUpdate(ydoc);
          
          // CRITICAL FIX: Decode and check RBAC BEFORE applying update
          const mutations = decodeYjsUpdate(update, prevStateUpdate);
          console.log(`[Yjs] Decoded ${mutations.length} mutations from SyncStep2`);
          
          const allowed = await checkYjsMutations(mutations, userId, roomId, ws.accessToken, ws.userRole);
          
          if (!allowed) {
            // RBAC violation - do NOT apply update, do NOT broadcast
            console.warn(`Rejected SyncStep2 update from user ${userId} due to RBAC violation`);
            return;
          }
          
          // Apply update with origin to track who made the change
          Y.applyUpdate(ydoc, update, { userId, ws });
          const nodesMap = ydoc.getMap('nodes');
          console.log(`[Yjs] Applied SyncStep2 update from user ${userId}, Y.Doc now has ${nodesMap.size} nodes`);
          console.log(`[Yjs] Node IDs in map:`, Array.from(nodesMap.keys()));
          
          // Log events and classify intent (mutations already decoded)
          logYjsMutations(mutations, roomId, userId, ydoc).catch(err => 
            console.error('Error logging mutations:', err)
          );

        } else if (syncMessageType === 2) {
          // Update: Client sends incremental update
          const update = new Uint8Array(payload);
          
          console.log(`[Yjs] Received incremental update from user ${userId}, update size: ${update.length} bytes`);
          
          // Capture state BEFORE applying update
          const prevStateUpdate = Y.encodeStateAsUpdate(ydoc);
          
          // CRITICAL FIX: Decode and check RBAC BEFORE applying update
          const mutations = decodeYjsUpdate(update, prevStateUpdate);
          console.log(`[Yjs] Decoded ${mutations.length} mutations from incremental update`);
          
          const allowed = await checkYjsMutations(mutations, userId, roomId, ws.accessToken, ws.userRole);
          
          if (!allowed) {
            // RBAC violation - do NOT apply update, do NOT broadcast
            console.warn(`Rejected incremental update from user ${userId} due to RBAC violation`);
            return;
          }
          
          // Apply update with origin
          Y.applyUpdate(ydoc, update, { userId, ws });
          const nodesMap = ydoc.getMap('nodes');
          console.log(`[Yjs] Applied incremental update from user ${userId}, Y.Doc now has ${nodesMap.size} nodes`);
          console.log(`[Yjs] Node IDs in map:`, Array.from(nodesMap.keys()));
          
          // Log events and classify intent (mutations already decoded)
          logYjsMutations(mutations, roomId, userId, ydoc).catch(err => 
            console.error('Error logging mutations:', err)
          );
        }
      }
      // messageType 1 = awareness protocol (not implemented yet)
      
    } catch (error) {
      console.error('❌ [Yjs] Message handler error for user ${userId}:', error);
      console.error('❌ [Yjs] Error stack:', error.stack);
    }
  });
  
  console.log(`[Yjs] ✅ Message handler attached for user ${userId}`);

  // Add ping/pong heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      console.log(`[Yjs] 💓 Sent ping to user ${userId}`);
    } else {
      console.log(`[Yjs] ⚠️ WebSocket not open for user ${userId}, state: ${ws.readyState}`);
      clearInterval(heartbeatInterval);
    }
  }, 30000); // Every 30 seconds

  ws.on('pong', () => {
    console.log(`[Yjs] 💓 Received pong from user ${userId}`);
  });

  ws.on('close', () => {
    console.log(`[Yjs] WebSocket closing for user ${userId} in room ${roomId}`);
    
    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    const connections = roomConnections.get(roomId);
    if (connections) {
      connections.delete(ws);

      // Keep Y.Doc alive even when room is empty — state persists for reconnects
      // Only clean up the connections map, not the doc
      if (connections.size === 0) {
        roomConnections.delete(roomId);
        console.log(`Room ${roomId} has no active connections (Y.Doc kept in memory)`);
      }
    }
    console.log(`User ${userId} disconnected from room ${roomId}`);
  });

  // Handle WebSocket errors to prevent process crashes
  ws.on('error', (error) => {
    console.error(`❌ [Yjs] WebSocket error for user ${userId} in room ${roomId}:`, error);
  });

  console.log(`Yjs connection established for room: ${roomId}`);
}

/**
 * Handle WebSocket connection lifecycle (legacy function name for backward compatibility)
 * Requirements: 1.2, 1.3, 1.6, 13.1-13.6
 */
function handleConnection(ws, req) {
  return handleYjsConnection(ws, req);
}

module.exports = {
  initYjsServer,
  handleYjsConnection,
  getYDoc,
  authenticateYjsConnection,
  checkYjsMutations,
  logYjsMutations,
  ydocs, // Export for testing
};
