// Test Yjs Sync Protocol Implementation
// Verifies that the Yjs server correctly handles:
// 1. SyncStep1 (state vector exchange)
// 2. SyncStep2 (missing updates)
// 3. Incremental updates
// 4. Broadcasting to other clients
// 5. Y.Doc cleanup on disconnect

// Mock dependencies before requiring yjsServer
jest.mock('../../services/eventService', () => ({
  insertEvent: jest.fn().mockResolvedValue({ id: 1 }),
  getEvents: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../services/rbacService', () => ({
  canMutate: jest.fn().mockResolvedValue(true),
  getNodeAcl: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../services/intentService', () => ({
  classifyNodeIntent: jest.fn().mockResolvedValue({ intent: 'reference', confidence: 0.9 }),
}));

const WebSocket = require('ws');
const http = require('http');
const Y = require('yjs');
const jwt = require('jsonwebtoken');
const { initYjsServer } = require('../yjsServer');

// Mock JWT secret
process.env.JWT_SECRET = 'test-secret-key';

// Create test JWT tokens
function createTestToken(userId, role = 'Contributor') {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Helper to create Yjs sync messages
function createSyncStep1Message(stateVector) {
  return Buffer.concat([
    Buffer.from([0, 0]), // messageType: 0 = sync, syncMessageType: 0 = SyncStep1
    Buffer.from(stateVector)
  ]);
}

function createSyncStep2Message(update) {
  return Buffer.concat([
    Buffer.from([0, 1]), // messageType: 0 = sync, syncMessageType: 1 = SyncStep2
    Buffer.from(update)
  ]);
}

function createUpdateMessage(update) {
  return Buffer.concat([
    Buffer.from([0, 2]), // messageType: 0 = sync, syncMessageType: 2 = Update
    Buffer.from(update)
  ]);
}

// Test suite
async function runTests() {
  console.log('Testing Yjs Sync Protocol Implementation...\n');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Create HTTP server
  const server = http.createServer();
  initYjsServer(server);
  
  await new Promise((resolve) => {
    server.listen(0, () => {
      console.log(`Test server listening on port ${server.address().port}\n`);
      resolve();
    });
  });
  
  const port = server.address().port;
  
  // Test 1: Client connects and receives SyncStep1
  try {
    console.log('Test 1: Client connects and receives SyncStep1');
    
    const token = createTestToken('user1');
    const ws1 = new WebSocket(`ws://localhost:${port}/yjs?token=${token}&roomId=sync_room1`);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
      
      ws1.on('message', (data) => {
        const buffer = Buffer.from(data);
        
        if (buffer[0] === 0 && buffer[1] === 0) {
          // SyncStep1 received
          clearTimeout(timeout);
          console.log('✅ PASS: SyncStep1 received from server');
          testsPassed++;
          ws1.close();
          resolve();
        }
      });
      
      ws1.on('error', reject);
    });
  } catch (error) {
    console.log('❌ FAIL:', error.message);
    testsFailed++;
  }
  
  // Test 2: Client sends SyncStep1, receives SyncStep2 with updates
  try {
    console.log('\nTest 2: Client sends SyncStep1, receives SyncStep2');
    
    const token = createTestToken('user2');
    const ws2 = new WebSocket(`ws://localhost:${port}/yjs?token=${token}&roomId=sync_room2`);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
      
      let receivedInitialSync = false;
      
      ws2.on('message', (data) => {
        const buffer = Buffer.from(data);
        
        if (!receivedInitialSync && buffer[0] === 0 && buffer[1] === 0) {
          // Initial SyncStep1 received, now send our SyncStep1
          receivedInitialSync = true;
          
          const clientDoc = new Y.Doc();
          const stateVector = Y.encodeStateVector(clientDoc);
          const syncStep1 = createSyncStep1Message(stateVector);
          
          ws2.send(syncStep1);
        } else if (buffer[0] === 0 && buffer[1] === 1) {
          // SyncStep2 received
          clearTimeout(timeout);
          console.log('✅ PASS: SyncStep2 received in response to SyncStep1');
          testsPassed++;
          ws2.close();
          resolve();
        }
      });
      
      ws2.on('error', reject);
    });
  } catch (error) {
    console.log('❌ FAIL:', error.message);
    testsFailed++;
  }
  
  // Test 3: Client sends update, server broadcasts to other clients
  try {
    console.log('\nTest 3: Client sends update, server broadcasts to other clients');
    
    const token1 = createTestToken('user3a');
    const token2 = createTestToken('user3b');
    
    const ws3a = new WebSocket(`ws://localhost:${port}/yjs?token=${token1}&roomId=sync_room3`);
    
    await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for connection
    
    const ws3b = new WebSocket(`ws://localhost:${port}/yjs?token=${token2}&roomId=sync_room3`);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 3000);
      
      let ws3aReady = false;
      let ws3bReady = false;
      
      ws3a.on('message', (data) => {
        const buffer = Buffer.from(data);
        if (buffer[0] === 0 && buffer[1] === 0) {
          ws3aReady = true;
          checkAndSendUpdate();
        }
      });
      
      ws3b.on('message', (data) => {
        const buffer = Buffer.from(data);
        
        console.log(`ws3b received message: type=${buffer[0]}, syncType=${buffer[1]}, length=${buffer.length}`);
        
        if (buffer[0] === 0 && buffer[1] === 0) {
          ws3bReady = true;
          checkAndSendUpdate();
        } else if (buffer[0] === 0 && buffer[1] === 2 && ws3bReady) {
          // Received broadcast update from ws3a (syncMessageType = 2)
          clearTimeout(timeout);
          console.log('✅ PASS: Update broadcast received by other client');
          testsPassed++;
          ws3a.close();
          ws3b.close();
          resolve();
        }
      });
      
      function checkAndSendUpdate() {
        if (ws3aReady && ws3bReady) {
          // Wait a bit to ensure both connections are fully established
          setTimeout(() => {
            // Create a Y.Doc update
            const doc = new Y.Doc();
            const nodesMap = doc.getMap('nodes');
            nodesMap.set('node1', { type: 'text', text: 'Hello' });
            
            const update = Y.encodeStateAsUpdate(doc);
            const updateMessage = createUpdateMessage(update);
            
            ws3a.send(updateMessage);
          }, 100);
        }
      }
      
      ws3a.on('error', reject);
      ws3b.on('error', reject);
    });
  } catch (error) {
    console.log('❌ FAIL:', error.message);
    testsFailed++;
  }
  
  // Test 4: Y.Doc cleanup on last client disconnect
  try {
    console.log('\nTest 4: Y.Doc cleanup on last client disconnect');
    
    const { ydocs } = require('../yjsServer');
    
    const token = createTestToken('user4');
    const ws4 = new WebSocket(`ws://localhost:${port}/yjs?token=${token}&roomId=cleanup_room`);
    
    await new Promise((resolve) => {
      ws4.on('message', () => {
        // Wait for initial sync
        setTimeout(() => {
          // Check Y.Doc exists
          const docExists = ydocs.has('cleanup_room');
          
          if (docExists) {
            // Close connection
            ws4.close();
            
            // Wait for cleanup
            setTimeout(() => {
              const docStillExists = ydocs.has('cleanup_room');
              
              if (!docStillExists) {
                console.log('✅ PASS: Y.Doc cleaned up after last client disconnect');
                testsPassed++;
              } else {
                console.log('❌ FAIL: Y.Doc not cleaned up (memory leak)');
                testsFailed++;
              }
              resolve();
            }, 200);
          } else {
            console.log('❌ FAIL: Y.Doc not created');
            testsFailed++;
            ws4.close();
            resolve();
          }
        }, 100);
      });
    });
  } catch (error) {
    console.log('❌ FAIL:', error.message);
    testsFailed++;
  }
  
  // Test 5: Multiple clients sync correctly
  try {
    console.log('\nTest 5: Multiple clients sync correctly');
    
    const token1 = createTestToken('user5a');
    const token2 = createTestToken('user5b');
    
    // Client 1 creates a document with data
    const ws5a = new WebSocket(`ws://localhost:${port}/yjs?token=${token1}&roomId=sync_room5`);
    
    await new Promise((resolve) => {
      ws5a.on('message', (data) => {
        const buffer = Buffer.from(data);
        if (buffer[0] === 0 && buffer[1] === 0) {
          // Send update with data
          const doc = new Y.Doc();
          const nodesMap = doc.getMap('nodes');
          nodesMap.set('node1', { type: 'text', text: 'Sync test' });
          
          const update = Y.encodeStateAsUpdate(doc);
          const updateMessage = createUpdateMessage(update);
          
          ws5a.send(updateMessage);
          
          setTimeout(resolve, 100);
        }
      });
    });
    
    // Client 2 connects and should receive the data
    const ws5b = new WebSocket(`ws://localhost:${port}/yjs?token=${token2}&roomId=sync_room5`);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
      
      let receivedInitialSync = false;
      
      ws5b.on('message', (data) => {
        const buffer = Buffer.from(data);
        
        if (!receivedInitialSync && buffer[0] === 0 && buffer[1] === 0) {
          receivedInitialSync = true;
          
          // Send SyncStep1 to request full state
          const clientDoc = new Y.Doc();
          const stateVector = Y.encodeStateVector(clientDoc);
          const syncStep1 = createSyncStep1Message(stateVector);
          
          ws5b.send(syncStep1);
        } else if (buffer[0] === 0 && buffer[1] === 1) {
          // SyncStep2 with full state
          const update = new Uint8Array(buffer.slice(2));
          
          const clientDoc = new Y.Doc();
          Y.applyUpdate(clientDoc, update);
          
          const nodesMap = clientDoc.getMap('nodes');
          const node1 = nodesMap.get('node1');
          
          if (node1 && node1.text === 'Sync test') {
            clearTimeout(timeout);
            console.log('✅ PASS: Client synced correctly with existing data');
            testsPassed++;
          } else {
            clearTimeout(timeout);
            console.log('❌ FAIL: Client did not receive correct data');
            testsFailed++;
          }
          
          ws5a.close();
          ws5b.close();
          resolve();
        }
      });
      
      ws5b.on('error', reject);
    });
  } catch (error) {
    console.log('❌ FAIL:', error.message);
    testsFailed++;
  }
  
  // Close server
  server.close();
  
  // Print results
  console.log('\n==================================================');
  console.log(`Test Results: ${testsPassed}/${testsPassed + testsFailed} tests passed`);
  console.log('==================================================');
  
  if (testsFailed === 0) {
    console.log('✅ All tests passed! Yjs sync protocol is working correctly.\n');
  } else {
    const msg = `${testsFailed} test(s) failed.`;
    console.log(`❌ ${msg}\n`);
    if (require.main === module) process.exit(1);
    else throw new Error(msg);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite error:', error);
  process.exit(1);
});

// Jest wrapper
describe('Yjs Sync Protocol', () => {
  test('sync protocol tests pass', async () => {
    await runTests();
  }, 15000);
});
