#!/usr/bin/env node

/**
 * Test script for the DynamoDB repair tool
 * Validates the tool's functionality without making actual changes
 */

import { DynamoDBRepairTool } from './repair-dynamodb-edges.js';

async function runTests() {
  console.log('🧪 Testing DynamoDB Repair Tool...\n');
  
  const tool = new DynamoDBRepairTool();
  let testsPassed = 0;
  let testsTotal = 0;

  // Test 1: AWS Access Validation
  testsTotal++;
  console.log('Test 1: Validating AWS access...');
  try {
    const hasAccess = await tool.validateAccess();
    if (hasAccess) {
      console.log('✅ AWS access validation passed');
      testsPassed++;
    } else {
      console.log('❌ AWS access validation failed');
    }
  } catch (error) {
    console.log('❌ AWS access validation error:', error.message);
  }

  // Test 2: Query User Edges (dry run)
  testsTotal++;
  console.log('\nTest 2: Testing user edge query...');
  try {
    // Try to query a small sample
    const items = await tool.scanUserEdges(null, null);
    console.log(`✅ Successfully scanned ${items.length} user-edge items`);
    testsPassed++;
    
    // Show sample of what we found
    if (items.length > 0) {
      const sample = items[0];
      console.log('   Sample item structure:', {
        PK: sample.PK,
        SK: sample.SK,
        status: sample.status,
        hasGSI: !!(sample.GSI1PK && sample.GSI1SK)
      });
    }
  } catch (error) {
    console.log('❌ User edge query failed:', error.message);
  }

  // Test 3: Dry Run Status Change
  testsTotal++;
  console.log('\nTest 3: Testing dry run status change...');
  try {
    const results = await tool.changeStatus('good_contact', 'possible', null, true);
    console.log(`✅ Dry run completed successfully`);
    console.log(`   Would update ${results.length} items`);
    testsPassed++;
  } catch (error) {
    console.log('❌ Dry run status change failed:', error.message);
  }

  // Test 4: Log File Creation
  testsTotal++;
  console.log('\nTest 4: Testing log file creation...');
  try {
    await tool.saveLog();
    console.log('✅ Log file created successfully');
    console.log(`   Log file: ${tool.logFile}`);
    testsPassed++;
  } catch (error) {
    console.log('❌ Log file creation failed:', error.message);
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`   Passed: ${testsPassed}/${testsTotal}`);
  console.log(`   Success Rate: ${Math.round((testsPassed/testsTotal) * 100)}%`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All tests passed! The repair tool is ready to use.');
    console.log('\n💡 Next steps:');
    console.log('   1. Run with --dry-run first to preview changes');
    console.log('   2. Start with a specific --user-id for testing');
    console.log('   3. Check the generated log file for details');
  } else {
    console.log('⚠️  Some tests failed. Please check your AWS configuration.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});