/**
 * Integration Test Runner
 * 
 * Orchestrates the execution of all integration tests with proper setup,
 * reporting, and cleanup. Provides comprehensive test coverage reporting
 * and performance metrics.
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TestResult {
  testFile: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

interface TestSuite {
  name: string;
  description: string;
  testFile: string;
  timeout: number;
  requirements: string[];
}

// Define test suites based on task requirements
const testSuites: TestSuite[] = [
  {
    name: 'Dashboard Integration',
    description: 'Complete user flows across tabs with filtering and status updates',
    testFile: 'dashboard-integration.test.tsx',
    timeout: 30000,
    requirements: ['1.3', '3.6', '5.5']
  },
  {
    name: 'End-to-End Connection Management',
    description: 'Full user workflows with real API integration scenarios',
    testFile: 'connection-management-e2e.test.tsx',
    timeout: 60000,
    requirements: ['1.3', '5.5', '6.3']
  },
  {
    name: 'Performance and Stress Testing',
    description: 'Performance with large datasets and virtual scrolling',
    testFile: 'performance-stress.test.tsx',
    timeout: 120000,
    requirements: ['Performance optimization']
  },
  {
    name: 'Accessibility Compliance',
    description: 'Screen reader compatibility and keyboard navigation',
    testFile: 'accessibility-compliance.test.tsx',
    timeout: 45000,
    requirements: ['6.3', 'Accessibility compliance']
  }
];

class IntegrationTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;
  private reportDir: string;

  constructor() {
    this.reportDir = join(process.cwd(), 'test-reports', 'integration');
    this.ensureReportDirectory();
  }

  private ensureReportDirectory(): void {
    if (!existsSync(this.reportDir)) {
      mkdirSync(this.reportDir, { recursive: true });
    }
  }

  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    console.log(`\n🧪 Running ${suite.name}...`);
    console.log(`📝 ${suite.description}`);
    console.log(`📋 Requirements: ${suite.requirements.join(', ')}`);

    const startTime = Date.now();
    
    try {
      // Run the test with vitest
      const command = `npx vitest run src/__tests__/integration/${suite.testFile} --reporter=json --timeout=${suite.timeout}`;
      const output = execSync(command, { 
        encoding: 'utf8',
        timeout: suite.timeout + 10000 // Add buffer for test runner overhead
      });

      const result = this.parseTestOutput(output, suite.testFile);
      const duration = Date.now() - startTime;

      console.log(`✅ ${suite.name} completed in ${duration}ms`);
      console.log(`   Passed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`);

      return {
        ...result,
        duration
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${suite.name} failed after ${duration}ms`);
      console.error(`   Error: ${error.message}`);

      return {
        testFile: suite.testFile,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration
      };
    }
  }

  private parseTestOutput(output: string, testFile: string): Omit<TestResult, 'duration'> {
    try {
      // Parse JSON output from vitest
      const lines = output.split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('{'));
      
      if (jsonLine) {
        const testResult = JSON.parse(jsonLine);
        
        return {
          testFile,
          passed: testResult.numPassedTests || 0,
          failed: testResult.numFailedTests || 0,
          skipped: testResult.numPendingTests || 0,
          coverage: testResult.coverageMap ? {
            statements: testResult.coverageMap.statements?.pct || 0,
            branches: testResult.coverageMap.branches?.pct || 0,
            functions: testResult.coverageMap.functions?.pct || 0,
            lines: testResult.coverageMap.lines?.pct || 0
          } : undefined
        };
      }
    } catch (error) {
      console.warn('Failed to parse test output, using fallback parsing');
    }

    // Fallback parsing for non-JSON output
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    const skippedMatch = output.match(/(\d+) skipped/);

    return {
      testFile,
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0
    };
  }

  private generateReport(): void {
    const totalTests = this.results.reduce((sum, result) => sum + result.passed + result.failed + result.skipped, 0);
    const totalPassed = this.results.reduce((sum, result) => sum + result.passed, 0);
    const totalFailed = this.results.reduce((sum, result) => sum + result.failed, 0);
    const totalSkipped = this.results.reduce((sum, result) => sum + result.skipped, 0);
    const totalDuration = Date.now() - this.startTime;

    const report = {
      summary: {
        totalTests,
        totalPassed,
        totalFailed,
        totalSkipped,
        totalDuration,
        successRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0
      },
      testSuites: this.results.map((result, index) => ({
        ...testSuites[index],
        ...result
      })),
      requirements: {
        '1.3': 'View connections, filter, update status across tabs',
        '3.6': 'Filter state persistence and tab switching',
        '5.5': 'Tab switching and state persistence with browser refresh',
        '6.3': 'Accessibility compliance with screen readers and keyboard navigation',
        'Performance optimization': 'Large datasets and virtual scrolling performance',
        'Accessibility compliance': 'Full accessibility compliance testing'
      },
      timestamp: new Date().toISOString()
    };

    // Write JSON report
    const jsonReportPath = join(this.reportDir, 'integration-test-report.json');
    writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Write HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlReportPath = join(this.reportDir, 'integration-test-report.html');
    writeFileSync(htmlReportPath, htmlReport);

    console.log(`\n📊 Test reports generated:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
  }

  private generateHtmlReport(report: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #6c757d; margin-top: 5px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .test-suite { margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 6px; overflow: hidden; }
        .test-suite-header { background: #e9ecef; padding: 15px; font-weight: bold; }
        .test-suite-content { padding: 15px; }
        .requirement { background: #e7f3ff; padding: 10px; margin: 10px 0; border-left: 4px solid #007bff; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .status-skipped { color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Integration Test Report</h1>
            <p>Connection Management System - Task 12 Validation</p>
            <p><small>Generated: ${report.timestamp}</small></p>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value ${report.summary.totalFailed === 0 ? 'success' : 'failure'}">
                    ${report.summary.successRate.toFixed(1)}%
                </div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value status-passed">${report.summary.totalPassed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value status-failed">${report.summary.totalFailed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(report.summary.totalDuration / 1000).toFixed(1)}s</div>
                <div class="metric-label">Total Duration</div>
            </div>
        </div>

        <h2>Test Suites</h2>
        ${report.testSuites.map((suite: any) => `
            <div class="test-suite">
                <div class="test-suite-header">
                    ${suite.name}
                    <span style="float: right;">
                        <span class="status-passed">${suite.passed} passed</span>
                        ${suite.failed > 0 ? `<span class="status-failed">${suite.failed} failed</span>` : ''}
                        ${suite.skipped > 0 ? `<span class="status-skipped">${suite.skipped} skipped</span>` : ''}
                    </span>
                </div>
                <div class="test-suite-content">
                    <p><strong>Description:</strong> ${suite.description}</p>
                    <p><strong>Duration:</strong> ${(suite.duration / 1000).toFixed(2)}s</p>
                    <div class="requirement">
                        <strong>Requirements Tested:</strong> ${suite.requirements.join(', ')}
                    </div>
                    ${suite.coverage ? `
                        <p><strong>Coverage:</strong> 
                            Statements: ${suite.coverage.statements}%, 
                            Branches: ${suite.coverage.branches}%, 
                            Functions: ${suite.coverage.functions}%, 
                            Lines: ${suite.coverage.lines}%
                        </p>
                    ` : ''}
                </div>
            </div>
        `).join('')}

        <h2>Requirements Coverage</h2>
        ${Object.entries(report.requirements).map(([req, desc]) => `
            <div class="requirement">
                <strong>${req}:</strong> ${desc}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }

  public async runAllTests(): Promise<void> {
    console.log('🚀 Starting Integration Test Suite');
    console.log('📋 Task 12: Integration testing and end-to-end validation');
    console.log(`📊 Running ${testSuites.length} test suites...\n`);

    this.startTime = Date.now();

    // Run each test suite
    for (const suite of testSuites) {
      const result = await this.runTestSuite(suite);
      this.results.push(result);
    }

    // Generate comprehensive report
    this.generateReport();

    // Print final summary
    const totalPassed = this.results.reduce((sum, result) => sum + result.passed, 0);
    const totalFailed = this.results.reduce((sum, result) => sum + result.failed, 0);
    const totalDuration = Date.now() - this.startTime;

    console.log('\n🎯 Integration Test Summary');
    console.log('=' .repeat(50));
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`⏱️  Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`📈 Success Rate: ${totalPassed + totalFailed > 0 ? ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) : 0}%`);

    if (totalFailed === 0) {
      console.log('\n🎉 All integration tests passed! Task 12 requirements validated.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the detailed report.');
      process.exit(1);
    }
  }
}

// Run the integration tests if this file is executed directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.runAllTests().catch(error => {
    console.error('❌ Integration test runner failed:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner, TestResult, TestSuite };