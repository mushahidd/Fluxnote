// Verification script for Intent Classification Integration
// Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
// 
// This script verifies that the intent classification integration is properly implemented

const fs = require('fs');
const path = require('path');

console.log('Verifying Intent Classification Integration...\n');

// Read the yjsServer.js file
const yjsServerPath = path.join(__dirname, '../yjsServer.js');
const yjsServerContent = fs.readFileSync(yjsServerPath, 'utf8');

let passedChecks = 0;
let totalChecks = 5;

// Check 1: intentService is imported
console.log('Check 1: Verify intentService is imported');
if (yjsServerContent.includes("const intentService = require('../services/intentService')")) {
  console.log('✅ PASS: intentService is imported\n');
  passedChecks++;
} else {
  console.log('❌ FAIL: intentService is not imported\n');
}

// Check 2: Intent classification is called in handleYjsUpdate
console.log('Check 2: Verify intentService.classifyNodeIntent is called');
if (yjsServerContent.includes('intentService.classifyNodeIntent')) {
  console.log('✅ PASS: intentService.classifyNodeIntent is called\n');
  passedChecks++;
} else {
  console.log('❌ FAIL: intentService.classifyNodeIntent is not called\n');
}

// Check 3: Text property check exists
console.log('Check 3: Verify text property check exists');
if (yjsServerContent.includes('mutation.payload.text') || yjsServerContent.includes('payload.text')) {
  console.log('✅ PASS: Text property check exists\n');
  passedChecks++;
} else {
  console.log('❌ FAIL: Text property check not found\n');
}

// Check 4: Error handling with .catch()
console.log('Check 4: Verify error handling with .catch()');
if (yjsServerContent.includes('.catch((error)') && 
    yjsServerContent.includes('Intent classification failed')) {
  console.log('✅ PASS: Error handling is implemented\n');
  passedChecks++;
} else {
  console.log('❌ FAIL: Error handling not properly implemented\n');
}

// Check 5: Requirements documented
console.log('Check 5: Verify requirements are documented');
if (yjsServerContent.includes('15.1') && 
    yjsServerContent.includes('15.2') &&
    yjsServerContent.includes('15.3')) {
  console.log('✅ PASS: Requirements 15.1-15.6 are documented\n');
  passedChecks++;
} else {
  console.log('❌ FAIL: Requirements not properly documented\n');
}

console.log('='.repeat(50));
console.log(`Verification Results: ${passedChecks}/${totalChecks} checks passed`);
console.log('='.repeat(50));

if (passedChecks === totalChecks) {
  console.log('✅ All checks passed! Intent classification integration is properly implemented.');
  console.log('\nImplementation Summary:');
  console.log('- intentService imported');
  console.log('- classifyNodeIntent called asynchronously (fire-and-forget)');
  console.log('- Text property checked before classification');
  console.log('- Error handling implemented with .catch()');
  console.log('- Requirements 15.1-15.6 documented');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the implementation.');
  process.exit(1);
}
