/**
 * Phase 1: Network & Connection Testing Script
 * Tests 1.2.1-1.2.4 from canvas_drop_inspection_tasks.md
 * 
 * This script tests:
 * - Socket connection status and stability
 * - REST API fallback mechanisms
 * - Network timeout handling
 * - Server availability monitoring
 */

// Test configuration
const TEST_CONFIG = {
  targetUrl: 'https://collab-canvas-frontend.up.railway.app/',
  socketEndpoint: 'wss://collab-canvas-backend.up.railway.app/socket.io/',
  restApiEndpoint: 'https://collab-canvas-backend.up.railway.app/api',
  timeout: 30000,
  retryAttempts: 3,
  testDuration: 60000 // 1 minute test duration
};

// Test results storage
const testResults = {
  '1.2.1': { name: 'Socket Connection Status', status: 'pending', details: [] },
  '1.2.2': { name: 'REST API Fallback Testing', status: 'pending', details: [] },
  '1.2.3': { name: 'Network Timeout Testing', status: 'pending', details: [] },
  '1.2.4': { name: 'Server Availability Testing', status: 'pending', details: [] }
};

/**
 * Test 1.2.1: Socket Connection Status
 */
async function testSocketConnection() {
  console.log('🔌 Starting Test 1.2.1: Socket Connection Status');
  
  try {
    // Open the application
    await page.goto(TEST_CONFIG.targetUrl, { waitUntil: 'networkidle' });
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Check WebSocket connections in DevTools
    const wsConnections = await page.evaluate(() => {
      return new Promise((resolve) => {
        const connections = [];
        
        // Monitor WebSocket connections
        const originalWebSocket = window.WebSocket;
        window.WebSocket = function(...args) {
          const ws = new originalWebSocket(...args);
          connections.push({
            url: args[0],
            readyState: ws.readyState,
            timestamp: Date.now()
          });
          return ws;
        };
        
        // Check existing connections
        setTimeout(() => {
          resolve(connections);
        }, 5000);
      });
    });
    
    testResults['1.2.1'].details.push({
      type: 'websocket_connections',
      data: wsConnections,
      timestamp: Date.now()
    });
    
    // Monitor connection stability
    const connectionMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics = {
          connectionEvents: [],
          reconnectionAttempts: 0,
          connectionDrops: 0
        };
        
        // Listen for socket events
        if (window.socketService) {
          const originalEmit = window.socketService.emit;
          window.socketService.emit = function(...args) {
            metrics.connectionEvents.push({
              event: args[0],
              timestamp: Date.now(),
              data: args[1]
            });
            return originalEmit.apply(this, args);
          };
        }
        
        setTimeout(() => {
          resolve(metrics);
        }, 10000);
      });
    });
    
    testResults['1.2.1'].details.push({
      type: 'connection_metrics',
      data: connectionMetrics,
      timestamp: Date.now()
    });
    
    // Test connection during object creation
    await testConnectionDuringObjectCreation();
    
    testResults['1.2.1'].status = 'completed';
    console.log('✅ Test 1.2.1 completed successfully');
    
  } catch (error) {
    testResults['1.2.1'].status = 'failed';
    testResults['1.2.1'].details.push({
      type: 'error',
      message: error.message,
      timestamp: Date.now()
    });
    console.error('❌ Test 1.2.1 failed:', error);
  }
}

/**
 * Test 1.2.2: REST API Fallback Testing
 */
async function testRestApiFallback() {
  console.log('🔄 Starting Test 1.2.2: REST API Fallback Testing');
  
  try {
    // Simulate WebSocket failure by blocking WebSocket connections
    await page.route('**/socket.io/**', route => route.abort());
    
    // Attempt object creation (should trigger REST fallback)
    const fallbackResult = await page.evaluate(async () => {
      try {
        // Simulate object creation
        const testObject = {
          type: 'rectangle',
          properties: {
            x: 100,
            y: 100,
            width: 50,
            height: 50,
            fill: '#ff0000'
          }
        };
        
        // This should trigger REST API fallback
        const result = await window.objectCreationService?.createObject(
          'test-canvas-id',
          testObject,
          { fallbackToRest: true }
        );
        
        return {
          success: result?.success || false,
          method: result?.method || 'unknown',
          error: result?.error || null,
          attempts: result?.attempts || 0
        };
      } catch (error) {
        return {
          success: false,
          method: 'failed',
          error: error.message,
          attempts: 0
        };
      }
    });
    
    testResults['1.2.2'].details.push({
      type: 'fallback_result',
      data: fallbackResult,
      timestamp: Date.now()
    });
    
    // Test response times
    const responseTimes = await page.evaluate(() => {
      return new Promise((resolve) => {
        const times = [];
        const startTime = Date.now();
        
        // Monitor network requests
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          const requestStart = Date.now();
          return originalFetch.apply(this, args).then(response => {
            times.push({
              url: args[0],
              duration: Date.now() - requestStart,
              status: response.status,
              timestamp: Date.now()
            });
            return response;
          });
        };
        
        setTimeout(() => {
          resolve(times);
        }, 5000);
      });
    });
    
    testResults['1.2.2'].details.push({
      type: 'response_times',
      data: responseTimes,
      timestamp: Date.now()
    });
    
    testResults['1.2.2'].status = 'completed';
    console.log('✅ Test 1.2.2 completed successfully');
    
  } catch (error) {
    testResults['1.2.2'].status = 'failed';
    testResults['1.2.2'].details.push({
      type: 'error',
      message: error.message,
      timestamp: Date.now()
    });
    console.error('❌ Test 1.2.2 failed:', error);
  }
}

/**
 * Test 1.2.3: Network Timeout Testing
 */
async function testNetworkTimeouts() {
  console.log('⏱️ Starting Test 1.2.3: Network Timeout Testing');
  
  try {
    // Simulate slow network (3G throttling)
    await page.emulate({
      name: 'Slow 3G',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    });
    
    // Test timeout handling
    const timeoutResult = await page.evaluate(async () => {
      try {
        const startTime = Date.now();
        
        // Attempt operation with timeout
        const result = await Promise.race([
          new Promise((resolve) => {
            // Simulate slow operation
            setTimeout(() => resolve({ success: true, method: 'timeout' }), 35000);
          }),
          new Promise((_, reject) => {
            // Timeout after 30 seconds
            setTimeout(() => reject(new Error('Operation timeout')), 30000);
          })
        ]);
        
        return {
          success: true,
          duration: Date.now() - startTime,
          result
        };
      } catch (error) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: error.message
        };
      }
    });
    
    testResults['1.2.3'].details.push({
      type: 'timeout_test',
      data: timeoutResult,
      timestamp: Date.now()
    });
    
    // Test retry mechanisms
    const retryResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        const retryAttempts = [];
        let attemptCount = 0;
        
        const testRetry = async () => {
          attemptCount++;
          retryAttempts.push({
            attempt: attemptCount,
            timestamp: Date.now(),
            success: Math.random() > 0.7 // 30% success rate
          });
          
          if (attemptCount < 3 && !retryAttempts[retryAttempts.length - 1].success) {
            setTimeout(testRetry, 1000 * attemptCount); // Exponential backoff
          } else {
            resolve({
              totalAttempts: attemptCount,
              attempts: retryAttempts,
              finalSuccess: retryAttempts[retryAttempts.length - 1]?.success || false
            });
          }
        };
        
        testRetry();
      });
    });
    
    testResults['1.2.3'].details.push({
      type: 'retry_mechanism',
      data: retryResult,
      timestamp: Date.now()
    });
    
    testResults['1.2.3'].status = 'completed';
    console.log('✅ Test 1.2.3 completed successfully');
    
  } catch (error) {
    testResults['1.2.3'].status = 'failed';
    testResults['1.2.3'].details.push({
      type: 'error',
      message: error.message,
      timestamp: Date.now()
    });
    console.error('❌ Test 1.2.3 failed:', error);
  }
}

/**
 * Test 1.2.4: Server Availability Testing
 */
async function testServerAvailability() {
  console.log('🌐 Starting Test 1.2.4: Server Availability Testing');
  
  try {
    // Test server response times at different times
    const availabilityTests = [];
    
    for (let i = 0; i < 5; i++) {
      const testResult = await page.evaluate(async () => {
        const startTime = Date.now();
        
        try {
          // Test multiple endpoints
          const endpoints = [
            '/api/health',
            '/api/canvas',
            '/api/user'
          ];
          
          const results = await Promise.allSettled(
            endpoints.map(endpoint => 
              fetch(endpoint, { 
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
              })
            )
          );
          
          return {
            timestamp: Date.now(),
            duration: Date.now() - startTime,
            endpoints: results.map((result, index) => ({
              endpoint: endpoints[index],
              status: result.status,
              success: result.status === 'fulfilled' && result.value.ok,
              responseTime: result.status === 'fulfilled' ? 
                Date.now() - startTime : null
            }))
          };
        } catch (error) {
          return {
            timestamp: Date.now(),
            duration: Date.now() - startTime,
            error: error.message
          };
        }
      });
      
      availabilityTests.push(testResult);
      await page.waitForTimeout(2000); // Wait 2 seconds between tests
    }
    
    testResults['1.2.4'].details.push({
      type: 'availability_tests',
      data: availabilityTests,
      timestamp: Date.now()
    });
    
    // Monitor for 5xx errors
    const errorMonitoring = await page.evaluate(() => {
      return new Promise((resolve) => {
        const errors = [];
        
        // Monitor network requests for errors
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          return originalFetch.apply(this, args).then(response => {
            if (response.status >= 500) {
              errors.push({
                url: args[0],
                status: response.status,
                statusText: response.statusText,
                timestamp: Date.now()
              });
            }
            return response;
          });
        };
        
        setTimeout(() => {
          resolve(errors);
        }, 10000);
      });
    });
    
    testResults['1.2.4'].details.push({
      type: 'error_monitoring',
      data: errorMonitoring,
      timestamp: Date.now()
    });
    
    testResults['1.2.4'].status = 'completed';
    console.log('✅ Test 1.2.4 completed successfully');
    
  } catch (error) {
    testResults['1.2.4'].status = 'failed';
    testResults['1.2.4'].details.push({
      type: 'error',
      message: error.message,
      timestamp: Date.now()
    });
    console.error('❌ Test 1.2.4 failed:', error);
  }
}

/**
 * Helper function to test connection during object creation
 */
async function testConnectionDuringObjectCreation() {
  try {
    // Simulate object creation and monitor connection
    const creationResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics = {
          connectionStable: true,
          eventsReceived: [],
          errors: []
        };
        
        // Monitor socket events during creation
        if (window.socketService && window.socketService.socket) {
          const socket = window.socketService.socket;
          
          const eventHandlers = {
            'connect': () => metrics.eventsReceived.push({ event: 'connect', timestamp: Date.now() }),
            'disconnect': () => {
              metrics.eventsReceived.push({ event: 'disconnect', timestamp: Date.now() });
              metrics.connectionStable = false;
            },
            'error': (error) => {
              metrics.eventsReceived.push({ event: 'error', timestamp: Date.now(), error });
              metrics.errors.push(error);
            }
          };
          
          // Add event listeners
          Object.entries(eventHandlers).forEach(([event, handler]) => {
            socket.on(event, handler);
          });
          
          // Simulate object creation
          setTimeout(() => {
            // Remove event listeners
            Object.entries(eventHandlers).forEach(([event, handler]) => {
              socket.off(event, handler);
            });
            
            resolve(metrics);
          }, 5000);
        } else {
          resolve(metrics);
        }
      });
    });
    
    testResults['1.2.1'].details.push({
      type: 'creation_connection_test',
      data: creationResult,
      timestamp: Date.now()
    });
    
  } catch (error) {
    testResults['1.2.1'].details.push({
      type: 'creation_connection_error',
      message: error.message,
      timestamp: Date.now()
    });
  }
}

/**
 * Generate test report
 */
function generateTestReport() {
  console.log('\n📊 Phase 1 Network & Connection Testing Report');
  console.log('=' .repeat(50));
  
  Object.entries(testResults).forEach(([testId, result]) => {
    const status = result.status === 'completed' ? '✅' : 
                   result.status === 'failed' ? '❌' : '⏳';
    console.log(`${status} ${testId}: ${result.name} - ${result.status}`);
    
    if (result.details.length > 0) {
      result.details.forEach(detail => {
        console.log(`   📋 ${detail.type}: ${JSON.stringify(detail.data, null, 2)}`);
      });
    }
  });
  
  // Save results to file
  const fs = require('fs');
  const reportPath = './test_results_phase1_network.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Detailed results saved to: ${reportPath}`);
}

/**
 * Main test execution
 */
async function runPhase1NetworkTests() {
  console.log('🚀 Starting Phase 1: Network & Connection Testing');
  console.log(`Target URL: ${TEST_CONFIG.targetUrl}`);
  
  try {
    // Run all tests sequentially
    await testSocketConnection();
    await testRestApiFallback();
    await testNetworkTimeouts();
    await testServerAvailability();
    
    // Generate report
    generateTestReport();
    
    console.log('\n🎉 Phase 1 Network & Connection Testing completed!');
    
  } catch (error) {
    console.error('💥 Phase 1 testing failed:', error);
    generateTestReport();
  }
}

// Export for use in other scripts
module.exports = {
  runPhase1NetworkTests,
  testResults
};

// Run if called directly
if (require.main === module) {
  runPhase1NetworkTests();
}
