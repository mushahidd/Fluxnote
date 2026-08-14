// Test file for Yjs Server JWT Authentication
// Requirements: 1.2, 1.3
// 
// This test verifies the JWT authentication logic without requiring y-websocket
// to be installed. It tests the authentication function in isolation.

const jwt = require('jsonwebtoken');
const { parseWsQuery } = require('../../utils/wsUtils');
const { AuthenticationError } = require('../../utils/errors');

// Set JWT_SECRET for testing
process.env.JWT_SECRET = 'test_secret_key';

// Mock WebSocket and Request objects for testing
class MockWebSocket {
  constructor() {
    this.closed = false;
    this.closeCode = null;
    this.closeReason = null;
    this.userId = null;
    this.userRole = null;
    this.roomId = null;
  }

  close(code, reason) {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
  }
}

class MockRequest {
  constructor(url, host = 'localhost:3001') {
    this.url = url;
    this.headers = { host };
  }
}

// Standalone authentication function for testing
// This uses the same logic as in yjsServer.js via parseWsQuery
function authenticateYjsConnection(ws, req) {
  try {
    const { user, roomId } = parseWsQuery(req);
    
    // Attach user metadata to WebSocket connection
    ws.userId = user.id;
    ws.userRole = user.role;
    ws.roomId = roomId;

    console.log(`Yjs connection authenticated: User ${ws.userId} (${ws.userRole}) joined room ${roomId}`);
    return true;
  } catch (error) {
    // Authentication failed
    console.error('Yjs authentication failed:', error.message);
    
    if (error instanceof AuthenticationError) {
      ws.close(1008, error.message);
    } else {
      ws.close(1008, 'Authentication failed');
    }
    return false;
  }
}

// Test JWT authentication
function testAuthentication() {
  console.log('Testing Yjs JWT Authentication...\n');

  let passedTests = 0;
  let totalTests = 5;

  // Test 1: Valid token and roomId
  console.log('Test 1: Valid token and roomId');
  const validToken = jwt.sign(
    { id: 'user_123', role: 'Contributor', email: 'test@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const ws1 = new MockWebSocket();
  const req1 = new MockRequest(`/yjs?token=${validToken}&roomId=room_abc`);
  const result1 = authenticateYjsConnection(ws1, req1);
  
  if (result1 && ws1.userId === 'user_123' && ws1.userRole === 'Contributor' && ws1.roomId === 'room_abc' && !ws1.closed) {
    console.log('✅ PASS: Valid token authenticated successfully');
    console.log(`   - userId: ${ws1.userId}, userRole: ${ws1.userRole}, roomId: ${ws1.roomId}\n`);
    passedTests++;
  } else {
    console.log('❌ FAIL: Valid token authentication failed\n');
  }

  // Test 2: Missing token
  console.log('Test 2: Missing token');
  const ws2 = new MockWebSocket();
  const req2 = new MockRequest('/yjs?roomId=room_abc');
  const result2 = authenticateYjsConnection(ws2, req2);
  
  if (!result2 && ws2.closed && ws2.closeCode === 1008 && ws2.closeReason === 'Token required') {
    console.log('✅ PASS: Missing token rejected correctly');
    console.log(`   - closeCode: ${ws2.closeCode}, closeReason: ${ws2.closeReason}\n`);
    passedTests++;
  } else {
    console.log('❌ FAIL: Missing token not handled correctly\n');
  }

  // Test 3: Missing roomId
  console.log('Test 3: Missing roomId');
  const ws3 = new MockWebSocket();
  const req3 = new MockRequest(`/yjs?token=${validToken}`);
  const result3 = authenticateYjsConnection(ws3, req3);
  
  if (!result3 && ws3.closed && ws3.closeCode === 1008 && ws3.closeReason === 'RoomId required') {
    console.log('✅ PASS: Missing roomId rejected correctly');
    console.log(`   - closeCode: ${ws3.closeCode}, closeReason: ${ws3.closeReason}\n`);
    passedTests++;
  } else {
    console.log('❌ FAIL: Missing roomId not handled correctly\n');
  }

  // Test 4: Invalid token
  console.log('Test 4: Invalid token');
  const ws4 = new MockWebSocket();
  const req4 = new MockRequest('/yjs?token=invalid_token&roomId=room_abc');
  const result4 = authenticateYjsConnection(ws4, req4);
  
  if (!result4 && ws4.closed && ws4.closeCode === 1008 && ws4.closeReason === 'Invalid token') {
    console.log('✅ PASS: Invalid token rejected correctly');
    console.log(`   - closeCode: ${ws4.closeCode}, closeReason: ${ws4.closeReason}\n`);
    passedTests++;
  } else {
    console.log('❌ FAIL: Invalid token not handled correctly\n');
  }

  // Test 5: Expired token
  console.log('Test 5: Expired token');
  const expiredToken = jwt.sign(
    { id: 'user_456', role: 'Lead', email: 'expired@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '-1h' } // Already expired
  );
  const ws5 = new MockWebSocket();
  const req5 = new MockRequest(`/yjs?token=${expiredToken}&roomId=room_xyz`);
  const result5 = authenticateYjsConnection(ws5, req5);
  
  if (!result5 && ws5.closed && ws5.closeCode === 1008 && ws5.closeReason === 'Token expired') {
    console.log('✅ PASS: Expired token rejected correctly');
    console.log(`   - closeCode: ${ws5.closeCode}, closeReason: ${ws5.closeReason}\n`);
    passedTests++;
  } else {
    console.log('❌ FAIL: Expired token not handled correctly');
    console.log(`   - Expected closeReason: 'Token expired', Got: '${ws5.closeReason}'\n`);
  }

  console.log('='.repeat(50));
  console.log(`Test Results: ${passedTests}/${totalTests} tests passed`);
  console.log('='.repeat(50));

  if (passedTests === totalTests) {
    console.log('✅ All tests passed! JWT authentication is working correctly.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAuthentication();
}

// Jest wrapper — runs the same logic as a proper test suite
describe('Yjs JWT Authentication', () => {
  test('all authentication scenarios pass', (done) => {
    // Capture process.exit to prevent Jest from dying
    const originalExit = process.exit.bind(process);
    process.exit = (code) => {
      process.exit = originalExit;
      if (code === 0) {
        done();
      } else {
        done(new Error('Authentication tests failed'));
      }
    };

    testAuthentication();
  });
});

module.exports = { testAuthentication };
