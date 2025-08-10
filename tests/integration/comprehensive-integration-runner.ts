/**
 * Comprehensive Integration Test Runner
 * 
 * Orchestrates execution of all integration test suites for Task 12
 * Provides detailed reporting, performance metrics, and requirement validation
 * 
 * Test Suites Included:
 * - Dashboard Integration Tests (existing)
 * - Connection Management E2E Tests (existing)
 * - Performance Stress Tests (existing)
 * - Accessibility Compliance Tests (existing)
 * - LinkedIn Interaction Service Integration Tests (new)
 * - API Backend Integration Tests (new)
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  file: string;
  description: string;
  requirements: string[];
  timeout: number;
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  testCount: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  coverage?: number;
  errors: string[];
  warnings: string[];
}

interface ComprehensiveTestReport {
  timestamp: string;
  totalDuration: number;
  overallStatus: 'PASSED' | 'FAILED' | 'PARTIAL';
  suiteResults: TestResult[];
  requirementsCoverage: Record<string, boolean>;
  performanceMetrics: {
    averageTestDuration: number;
    slowestSuite: string;
    fastestSuite: string;
    totalTests: number;
    overallPassRate: number;
  };
  recommendations: string[];
  summary: {
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
  };
}

class ComprehensiveIntegrationRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Dashboard Integration',
      file: 'dashboard-integration.test.tsx',
      description: 'Complete user flows for connection management dashboard',
      requirements: ['1.3', '3.6', '5.5'],
      timeout: 60000
    },
    {
      name: 'Connection Management E2E',
      file: 'connection-management-e2e.test.tsx',
      description: 'End-to-end connection management workflows',
      requirements: ['1.3', '3.6', '5.5'],
      timeout: 90000
    },
    {
      name: 'Performance Stress Testing',
      file: 'performance-stress.test.tsx',
      description: 'Performance validation with large datasets and virtual scrolling',
      requirements: ['Performance'],
      timeout: 120000
    },
    {
      name: 'Accessibility Compliance',
      file: 'accessibility-compliance.test.tsx',
      description: 'WCAG 2.1 AA compliance and keyboard navigation',
      requirements: ['6.3'],
      timeout: 45000
    },
    {
      name: 'LinkedIn Interaction Service',
      file: 'linkedin-interaction-integration.test.tsx',
      description: 'LinkedIn automation workflows and navigation methods',
      requirements: ['Task 10', 'Task 11'],
      timeout: 180000
    },
    {
      name: 'API Backend Integration',
      file: 'api-backend-integration.test.tsx',
      description: 'Backend API services and database operations',
      requirements: ['API', 'Database', 'Authentication'],
      timeout: 75000
    }
  ];

  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<ComprehensiveTestReport> {
    console.log('🚀 Starting Comprehensive Integration Test Suite');
    console.log('=' .repeat(60));
    
    this.startTime = Date.now();
    this.results = [];

    // Create reports directory if it doesn't exist
    const reportsDir = join(process.cwd(), 'test-reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    // Run each test suite
    for (const suite of this.testSuites) {
      console.log(`\n📋 Running ${suite.name}...`);
      console.log(`   Description: ${suite.description}`);
      console.log(`   Requirements: ${suite.requirements.join(', ')}`);
      console.log(`   Timeout: ${suite.timeout / 1000}s`);
      
      const result = await this.runTestSuite(suite);
      this.results.push(result);
      
      this.printSuiteResult(result);
    }

    // Generate comprehensive report
    const report = this.generateComprehensiveReport();
    
    // Save reports
    await this.saveReports(report);
    
    // Print final summary
    this.printFinalSummary(report);
    
    return report;
  }

  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    const suiteStartTime = Date.now();
    const result: TestResult = {
      suite: suite.name,
      passed: false,
      duration: 0,
      testCount: 0,
      passedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
      warnings: []
    };

    try {
      // Run the test suite using vitest
      const testCommand = `npx vitest run src/__tests__/integration/${suite.file} --reporter=json --timeout=${suite.timeout}`;
      
      const output = execSync(testCommand, {
        encoding: 'utf-8',
        timeout: suite.timeout + 10000, // Add 10s buffer
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      // Parse vitest JSON output
      const testOutput = this.parseVitestOutput(output);
      
      result.testCount = testOutput.numTotalTests || 0;
      result.passedCount = testOutput.numPassedTests || 0;
      result.failedCount = testOutput.numFailedTests || 0;
      result.skippedCount = testOutput.numPendingTests || 0;
      result.passed = testOutput.success || false;
      
      if (testOutput.testResults) {
        result.errors = testOutput.testResults
          .filter((test: any) => test.status === 'failed')
          .map((test: any) => test.message || 'Unknown error');
      }

    } catch (error: any) {
      result.passed = false;
      result.errors.push(error.message || 'Test suite execution failed');
      
      // Try to extract some information from stderr
      if (error.stderr) {
        const stderrLines = error.stderr.toString().split('\n');
        const errorLines = stderrLines.filter(line => 
          line.includes('FAIL') || line.includes('Error') || line.includes('✗')
        );
        result.errors.push(...errorLines.slice(0, 5)); // Limit to 5 error lines
      }
    }

    result.duration = Date.now() - suiteStartTime;
    return result;
  }

  private parseVitestOutput(output: string): any {
    try {
      // Vitest JSON output might be mixed with other output
      const lines = output.split('\n');
      const jsonLine = lines.find(line => {
        try {
          const parsed = JSON.parse(line);
          return parsed.numTotalTests !== undefined;
        } catch {
          return false;
        }
      });

      if (jsonLine) {
        return JSON.parse(jsonLine);
      }

      // Fallback: try to parse the entire output
      return JSON.parse(output);
    } catch (error) {
      // If JSON parsing fails, return a default structure
      return {
        success: false,
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0,
        testResults: []
      };
    }
  }

  private generateComprehensiveReport(): ComprehensiveTestReport {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.reduce((sum, r) => sum + r.testCount, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passedCount, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failedCount, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skippedCount, 0);
    
    const passedSuites = this.results.filter(r => r.passed).length;
    const failedSuites = this.results.filter(r => !r.passed).length;
    
    const overallStatus: 'PASSED' | 'FAILED' | 'PARTIAL' = 
      failedSuites === 0 ? 'PASSED' : 
      passedSuites === 0 ? 'FAILED' : 'PARTIAL';

    // Calculate performance metrics
    const durations = this.results.map(r => r.duration);
    const averageTestDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const slowestSuite = this.results.reduce((prev, curr) => 
      prev.duration > curr.duration ? prev : curr
    ).suite;
    const fastestSuite = this.results.reduce((prev, curr) => 
      prev.duration < curr.duration ? prev : curr
    ).suite;

    // Generate requirements coverage
    const requirementsCoverage: Record<string, boolean> = {};
    this.testSuites.forEach(suite => {
      suite.requirements.forEach(req => {
        const suiteResult = this.results.find(r => r.suite === suite.name);
        requirementsCoverage[req] = suiteResult?.passed || false;
      });
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      timestamp: new Date().toISOString(),
      totalDuration,
      overallStatus,
      suiteResults: this.results,
      requirementsCoverage,
      performanceMetrics: {
        averageTestDuration,
        slowestSuite,
        fastestSuite,
        totalTests,
        overallPassRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0
      },
      recommendations,
      summary: {
        totalSuites: this.testSuites.length,
        passedSuites,
        failedSuites,
        totalTests,
        totalPassed,
        totalFailed,
        totalSkipped
      }
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Performance recommendations
    const slowSuites = this.results.filter(r => r.duration > 60000);
    if (slowSuites.length > 0) {
      recommendations.push(
        `Consider optimizing slow test suites: ${slowSuites.map(s => s.suite).join(', ')}`
      );
    }

    // Failure recommendations
    const failedSuites = this.results.filter(r => !r.passed);
    if (failedSuites.length > 0) {
      recommendations.push(
        `Address failing test suites before deployment: ${failedSuites.map(s => s.suite).join(', ')}`
      );
    }

    // Coverage recommendations
    const lowPassRateSuites = this.results.filter(r => 
      r.testCount > 0 && (r.passedCount / r.testCount) < 0.8
    );
    if (lowPassRateSuites.length > 0) {
      recommendations.push(
        `Improve test pass rate for: ${lowPassRateSuites.map(s => s.suite).join(', ')}`
      );
    }

    // General recommendations
    if (this.results.some(r => r.errors.length > 0)) {
      recommendations.push('Review and fix test errors to improve reliability');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests are passing! Consider adding more edge case coverage.');
    }

    return recommendations;
  }

  private async saveReports(report: ComprehensiveTestReport): Promise<void> {
    const reportsDir = join(process.cwd(), 'test-reports');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON report
    const jsonReportPath = join(reportsDir, `integration-test-report-${timestamp}.json`);
    writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
    
    // Save HTML report
    const htmlReportPath = join(reportsDir, `integration-test-report-${timestamp}.html`);
    const htmlContent = this.generateHtmlReport(report);
    writeFileSync(htmlReportPath, htmlContent);
    
    // Save latest report (overwrite)
    const latestJsonPath = join(reportsDir, 'latest-integration-report.json');
    const latestHtmlPath = join(reportsDir, 'latest-integration-report.html');
    writeFileSync(latestJsonPath, JSON.stringify(report, null, 2));
    writeFileSync(latestHtmlPath, htmlContent);
    
    console.log(`\n📊 Reports saved:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
    console.log(`   Latest: ${latestJsonPath}`);
  }

  private generateHtmlReport(report: ComprehensiveTestReport): string {
    const statusColor = report.overallStatus === 'PASSED' ? '#28a745' : 
                       report.overallStatus === 'FAILED' ? '#dc3545' : '#ffc107';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Test Report - ${report.timestamp}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .passed { background: #d4edda; color: #155724; }
        .failed { background: #f8d7da; color: #721c24; }
        .partial { background: #fff3cd; color: #856404; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .suite-result { margin: 15px 0; padding: 15px; border: 1px solid #dee2e6; border-radius: 6px; }
        .error-list { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; }
        .requirements-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .requirement { padding: 8px; border-radius: 4px; text-align: center; font-size: 12px; }
        .req-passed { background: #d4edda; color: #155724; }
        .req-failed { background: #f8d7da; color: #721c24; }
        .recommendations { background: #e7f3ff; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Integration Test Report</h1>
            <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
            <p>Overall Status: <span class="status-badge ${report.overallStatus.toLowerCase()}">${report.overallStatus}</span></p>
        </div>
        
        <div class="content">
            <div class="metric-grid">
                <div class="metric-card">
                    <h3>Test Suites</h3>
                    <p><strong>${report.summary.passedSuites}/${report.summary.totalSuites}</strong> passed</p>
                </div>
                <div class="metric-card">
                    <h3>Total Tests</h3>
                    <p><strong>${report.summary.totalPassed}/${report.summary.totalTests}</strong> passed</p>
                </div>
                <div class="metric-card">
                    <h3>Duration</h3>
                    <p><strong>${(report.totalDuration / 1000).toFixed(1)}s</strong></p>
                </div>
                <div class="metric-card">
                    <h3>Pass Rate</h3>
                    <p><strong>${report.performanceMetrics.overallPassRate.toFixed(1)}%</strong></p>
                </div>
            </div>

            <h2>Requirements Coverage</h2>
            <div class="requirements-grid">
                ${Object.entries(report.requirementsCoverage).map(([req, passed]) => 
                  `<div class="requirement ${passed ? 'req-passed' : 'req-failed'}">${req}</div>`
                ).join('')}
            </div>

            <h2>Test Suite Results</h2>
            ${report.suiteResults.map(suite => `
                <div class="suite-result">
                    <h3>${suite.suite} <span class="status-badge ${suite.passed ? 'passed' : 'failed'}">${suite.passed ? 'PASSED' : 'FAILED'}</span></h3>
                    <p><strong>Tests:</strong> ${suite.passedCount}/${suite.testCount} passed (${suite.failedCount} failed, ${suite.skippedCount} skipped)</p>
                    <p><strong>Duration:</strong> ${(suite.duration / 1000).toFixed(1)}s</p>
                    ${suite.errors.length > 0 ? `
                        <div class="error-list">
                            <strong>Errors:</strong>
                            <ul>${suite.errors.map(error => `<li>${error}</li>`).join('')}</ul>
                        </div>
                    ` : ''}
                </div>
            `).join('')}

            <h2>Performance Metrics</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <h4>Average Duration</h4>
                    <p>${(report.performanceMetrics.averageTestDuration / 1000).toFixed(1)}s</p>
                </div>
                <div class="metric-card">
                    <h4>Slowest Suite</h4>
                    <p>${report.performanceMetrics.slowestSuite}</p>
                </div>
                <div class="metric-card">
                    <h4>Fastest Suite</h4>
                    <p>${report.performanceMetrics.fastestSuite}</p>
                </div>
            </div>

            <h2>Recommendations</h2>
            <div class="recommendations">
                <ul>
                    ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  private printSuiteResult(result: TestResult): void {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    const duration = (result.duration / 1000).toFixed(1);
    
    console.log(`   ${status} (${duration}s)`);
    console.log(`   Tests: ${result.passedCount}/${result.testCount} passed`);
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.slice(0, 2).forEach(error => {
        console.log(`     • ${error.substring(0, 100)}...`);
      });
    }
  }

  private printFinalSummary(report: ComprehensiveTestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🏁 COMPREHENSIVE INTEGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    
    const statusEmoji = report.overallStatus === 'PASSED' ? '✅' : 
                       report.overallStatus === 'FAILED' ? '❌' : '⚠️';
    
    console.log(`${statusEmoji} Overall Status: ${report.overallStatus}`);
    console.log(`⏱️  Total Duration: ${(report.totalDuration / 1000).toFixed(1)}s`);
    console.log(`📊 Test Suites: ${report.summary.passedSuites}/${report.summary.totalSuites} passed`);
    console.log(`🧪 Total Tests: ${report.summary.totalPassed}/${report.summary.totalTests} passed`);
    console.log(`📈 Pass Rate: ${report.performanceMetrics.overallPassRate.toFixed(1)}%`);
    
    console.log('\n📋 Requirements Coverage:');
    Object.entries(report.requirementsCoverage).forEach(([req, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${req}`);
    });
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Main execution
async function main() {
  const runner = new ComprehensiveIntegrationRunner();
  
  try {
    const report = await runner.runAllTests();
    
    // Exit with appropriate code
    const exitCode = report.overallStatus === 'FAILED' ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Integration test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ComprehensiveIntegrationRunner, type ComprehensiveTestReport };
