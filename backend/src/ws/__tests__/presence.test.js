/**
 * Unit tests for presence.js
 * Tests cursor tracking functionality
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

const {
  updateCursor,
  getCursors,
  removeCursor,
  broadcastCursor,
  getCursorSnapshot,
  cleanupStaleCursors,
  getStats
} = require('../presence');

function testPresenceManager() {
  console.log('Testing Presence Manager...\n');

  let passedTests = 0;
  let totalTests = 12;

  // Test 1: Create new room and add cursor
  console.log('Test 1: Create new room and add cursor');
  try {
    const cursorData = updateCursor(
      'test_room1',
      'user1',
      { x: 100, y: 200 },
      'Alice',
      '#FF5722'
    );

    if (cursorData.x === 100 && cursorData.y === 200 && 
        cursorData.name === 'Alice' && cursorData.color === '#FF5722' &&
        cursorData.lastUpdate) {
      console.log('✅ PASS: Cursor created successfully');
      console.log(`   - Position: (${cursorData.x}, ${cursorData.y}), Name: ${cursorData.name}\n`);
      passedTests++;
    } else {
      console.log('❌ FAIL: Cursor data incorrect\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 2: Update existing cursor position
  console.log('Test 2: Update existing cursor position');
  try {
    updateCursor('test_room1', 'user1', { x: 100, y: 200 }, 'Alice', '#FF5722');
    const updated = updateCursor('test_room1', 'user1', { x: 150, y: 250 }, 'Alice', '#FF5722');

    if (updated.x === 150 && updated.y === 250) {
      console.log('✅ PASS: Cursor position updated');
      console.log(`   - New position: (${updated.x}, ${updated.y})\n`);
      passedTests++;
    } else {
      console.log('❌ FAIL: Cursor position not updated correctly\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 3: Handle multiple users in same room
  console.log('Test 3: Handle multiple users in same room');
  try {
    updateCursor('test_room2', 'user1', { x: 100, y: 200 }, 'Alice', '#FF5722');
    updateCursor('test_room2', 'user2', { x: 300, y: 400 }, 'Bob', '#2196F3');

    const cursors = getCursors('test_room2');
    if (cursors.size === 2) {
      console.log('✅ PASS: Multiple users tracked correctly');
      console.log(`   - Room has ${cursors.size} cursors\n`);
      passedTests++;
    } else {
      console.log(`❌ FAIL: Expected 2 cursors, got ${cursors.size}\n`);
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 4: Get cursors for non-existent room
  console.log('Test 4: Get cursors for non-existent room');
  try {
    const cursors = getCursors('nonexistent_room');
    if (cursors.size === 0) {
      console.log('✅ PASS: Empty Map returned for non-existent room\n');
      passedTests++;
    } else {
      console.log('❌ FAIL: Should return empty Map\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 5: Get all cursors for a room
  console.log('Test 5: Get all cursors for a room');
  try {
    updateCursor('test_room3', 'user1', { x: 100, y: 200 }, 'Alice', '#FF5722');
    updateCursor('test_room3', 'user2', { x: 300, y: 400 }, 'Bob', '#2196F3');

    const cursors = getCursors('test_room3');
    const user1Cursor = cursors.get('user1');
    const user2Cursor = cursors.get('user2');

    if (cursors.size === 2 && user1Cursor.x === 100 && user2Cursor.x === 300) {
      console.log('✅ PASS: All cursors retrieved correctly');
      console.log(`   - User1: (${user1Cursor.x}, ${user1Cursor.y}), User2: (${user2Cursor.x}, ${user2Cursor.y})\n`);
      passedTests++;
    } else {
      console.log('❌ FAIL: Cursor data incorrect\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 6: Remove cursor from room
  console.log('Test 6: Remove cursor from room');
  try {
    updateCursor('test_room4', 'user1', { x: 100, y: 200 }, 'Alice', '#FF5722');
    const removed = removeCursor('test_room4', 'user1');

    if (removed === true && getCursors('test_room4').size === 0) {
      console.log('✅ PASS: Cursor removed successfully\n');
      passedTests++;
    } else {
      console.log('❌ FAIL: Cursor not removed correctly\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 7: Remove non-existent cursor
  console.log('Test 7: Remove non-existent cursor');
  try {
    const removed = removeCursor('test_room4', 'nonexistent');
    if (removed === false) {
      console.log('✅ PASS: Returns false for non-existent cursor\n');
      passedTests++;
    } else {
      console.log('❌ FAIL: Should return false\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 8: Clean up empty rooms
  console.log('Test 8: Clean up empty rooms');
  try {
    updateCursor('test_room5', 'user1', { x: 100, y: 200 }, 'Alice', '#FF5722');
    removeCursor('test_room5', 'user1');

    const stats = getStats();
    const room5Exists = stats.rooms.find(r => r.roomId === 'test_room5');
    
    if (!room5Exists) {
      console.log('✅ PASS: Empty room cleaned up\n');
      passedTests++;
    } else {
      console.log('❌ FAIL: Empty room not cleaned up\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 9: Broadcast cursor with correct message format
  console.log('Test 9: Broadcast cursor with correct message format');
  try {
    let broadcastCalled = false;
    let broadcastMessage = null;
    
    const mockBroadcast = (roomId, message) => {
      broadcastCalled = true;
      broadcastMessage = message;
    };

    const cursorData = {
      x: 100,
      y: 200,
      name: 'Alice',
      color: '#FF5722',
      lastUpdate: Date.now()
    };

    broadcastCursor('test_room6', 'user1', cursorData, mockBroadcast);

    if (broadcastCalled && 
        broadcastMessage.type === 'CURSOR_MOVE' &&
        broadcastMessage.userId === 'user1' &&
        broadcastMessage.payload.x === 100 &&
        broadcastMessage.payload.y === 200) {
      console.log('✅ PASS: Broadcast called with correct format');
      console.log(`   - Message type: ${broadcastMessage.type}\n`);
      passedTests++;
    } else {
      console.log('❌ FAIL: Broadcast message format incorrect\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 10: Get cursor snapshot
  console.log('Test 10: Get cursor snapshot');
  try {
    updateCursor('test_room7', 'user1', { x: 100, y: 200 }, 'Alice', '#FF5722');
    updateCursor('test_room7', 'user2', { x: 300, y: 400 }, 'Bob', '#2196F3');

    const snapshot = getCursorSnapshot('test_room7');
    
    if (snapshot.length === 2 && snapshot[0].userId && snapshot[0].x) {
      console.log('✅ PASS: Cursor snapshot retrieved');
      console.log(`   - Snapshot contains ${snapshot.length} cursors\n`);
      passedTests++;
    } else {
      console.log('❌ FAIL: Snapshot format incorrect\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 11: Get snapshot for non-existent room
  console.log('Test 11: Get snapshot for non-existent room');
  try {
    const snapshot = getCursorSnapshot('nonexistent');
    if (Array.isArray(snapshot) && snapshot.length === 0) {
      console.log('✅ PASS: Empty array returned for non-existent room\n');
      passedTests++;
    } else {
      console.log('❌ FAIL: Should return empty array\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 12: Get statistics
  console.log('Test 12: Get statistics');
  try {
    updateCursor('test_room10', 'user1', { x: 100, y: 200 }, 'Alice', '#FF5722');
    updateCursor('test_room10', 'user2', { x: 300, y: 400 }, 'Bob', '#2196F3');
    updateCursor('test_room11', 'user3', { x: 500, y: 600 }, 'Charlie', '#4CAF50');

    const stats = getStats();
    
    if (stats.totalRooms >= 2 && stats.totalCursors >= 3 && Array.isArray(stats.rooms)) {
      console.log('✅ PASS: Statistics retrieved correctly');
      console.log(`   - Total rooms: ${stats.totalRooms}, Total cursors: ${stats.totalCursors}\n`);
      passedTests++;
    } else {
      console.log('❌ FAIL: Statistics incorrect\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Summary
  console.log('='.repeat(50));
  console.log(`Test Results: ${passedTests}/${totalTests} tests passed`);
  console.log('='.repeat(50));

  if (passedTests === totalTests) {
    console.log('✅ All tests passed! Presence manager is working correctly.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testPresenceManager();
}

module.exports = { testPresenceManager };
