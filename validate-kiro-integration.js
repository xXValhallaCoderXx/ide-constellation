#!/usr/bin/env node

/**
 * Validation script for Kiro Agent Integration (Requirement 5)
 * This script simulates a Kiro agent attempting to communicate with the MCP server
 */

async function validateKiroIntegration() {
  console.log('🚀 Validating Kiro Agent Integration...\n');
  
  const testCases = [
    { port: 31337, description: 'Default port' },
    { port: 31338, description: 'Fallback port 1' },
    { port: 31339, description: 'Fallback port 2' }
  ];

  let serverFound = false;
  let serverData = null;

  for (const testCase of testCases) {
    try {
      console.log(`📡 Testing ${testCase.description} (${testCase.port})...`);
      
      const response = await fetch(`http://127.0.0.1:${testCase.port}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kiro-Agent/1.0'
        }
      });

      if (response.ok) {
        serverData = await response.json();
        serverFound = true;
        console.log(`✅ Server found on port ${testCase.port}`);
        console.log(`📊 Response:`, JSON.stringify(serverData, null, 2));
        break;
      } else {
        console.log(`❌ Server responded with status ${response.status} on port ${testCase.port}`);
      }
    } catch (error) {
      console.log(`❌ No server on port ${testCase.port}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (serverFound) {
    console.log('🎉 VALIDATION SUCCESSFUL');
    console.log('✅ Kiro agent can successfully communicate with MCP server');
    console.log(`✅ Server status: ${serverData.status}`);
    console.log(`✅ Server timestamp: ${serverData.timestamp}`);
    console.log(`✅ Server port: ${serverData.port}`);
    
    // Validate response format
    const hasRequiredFields = serverData.status && serverData.timestamp;
    if (hasRequiredFields) {
      console.log('✅ Response format matches requirements');
    } else {
      console.log('⚠️  Response format may not match requirements');
    }
    
    return true;
  } else {
    console.log('❌ VALIDATION FAILED');
    console.log('❌ No MCP server found on any expected port');
    console.log('💡 Make sure the VS Code extension is running and has started the MCP server');
    return false;
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateKiroIntegration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Validation script error:', error);
      process.exit(1);
    });
}

module.exports = { validateKiroIntegration };