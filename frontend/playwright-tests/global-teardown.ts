import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Global teardown for Playwright tests
 * Cleans up test artifacts and generates reports
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for Playwright tests...');
  
  try {
    // Clean up authentication state
    const authStatePath = 'playwright-tests/auth-state.json';
    if (fs.existsSync(authStatePath)) {
      fs.unlinkSync(authStatePath);
      console.log('🗑️ Cleaned up authentication state');
    }
    
    // Clean up test artifacts
    await cleanupTestArtifacts();
    
    // Generate test summary report
    await generateTestSummary();
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error to avoid masking test failures
  }
}

/**
 * Clean up test artifacts and temporary files
 */
async function cleanupTestArtifacts() {
  const artifactsDir = 'playwright-tests/artifacts';
  
  if (fs.existsSync(artifactsDir)) {
    const files = fs.readdirSync(artifactsDir);
    for (const file of files) {
      const filePath = path.join(artifactsDir, file);
      const stats = fs.statSync(filePath);
      
      // Remove files older than 7 days
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (stats.mtime.getTime() < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Removed old artifact: ${file}`);
      }
    }
  }
}

/**
 * Generate test summary report
 */
async function generateTestSummary() {
  const resultsPath = 'playwright-results.json';
  
  if (fs.existsSync(resultsPath)) {
    try {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: results.suites?.reduce((total: number, suite: any) => 
          total + (suite.specs?.length || 0), 0) || 0,
        passed: results.suites?.reduce((total: number, suite: any) => 
          total + (suite.specs?.filter((spec: any) => 
            spec.tests?.every((test: any) => test.status === 'passed')
          ).length || 0), 0) || 0,
        failed: results.suites?.reduce((total: number, suite: any) => 
          total + (suite.specs?.filter((spec: any) => 
            spec.tests?.some((test: any) => test.status === 'failed')
          ).length || 0), 0) || 0,
        skipped: results.suites?.reduce((total: number, suite: any) => 
          total + (suite.specs?.filter((spec: any) => 
            spec.tests?.every((test: any) => test.status === 'skipped')
          ).length || 0), 0) || 0,
        duration: results.config?.timeout || 0
      };
      
      fs.writeFileSync(
        'playwright-tests/test-summary.json', 
        JSON.stringify(summary, null, 2)
      );
      
      console.log('📊 Test summary generated:', {
        total: summary.totalTests,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped
      });
      
    } catch (error) {
      console.error('❌ Failed to generate test summary:', error);
    }
  }
}

export default globalTeardown;
