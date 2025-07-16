const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
  constructor() {
    this.testResults = {};
    this.debugMode = process.env.DEBUG_TESTS === 'true';
    this.coverage = process.env.COVERAGE === 'true';
    this.timeout = parseInt(process.env.TEST_TIMEOUT || '30000');
  }

  async runAllTests() {
    console.log('🚀 Starting OBS Integration Test Suite');
    console.log('=' .repeat(50));

    const testSuites = [
      'connection.test.js',
      'scenes.test.js',
      'ui.test.js'
    ];

    const results = {};

    for (const suite of testSuites) {
      console.log(`\n📋 Running ${suite}...`);
      
      try {
        const result = await this.runTestSuite(suite);
        results[suite] = result;
        
        if (result.success) {
          console.log(`✅ ${suite} - PASSED (${result.duration}ms)`);
        } else {
          console.log(`❌ ${suite} - FAILED (${result.duration}ms)`);
          console.log(`   Errors: ${result.errors.length}`);
        }
      } catch (error) {
        console.error(`💥 ${suite} - CRASHED: ${error.message}`);
        results[suite] = {
          success: false,
          error: error.message,
          duration: 0
        };
      }
    }

    this.generateReport(results);
    return results;
  }

  async runTestSuite(suiteName) {
    const suitePath = path.join(__dirname, '../integration', suiteName);
    
    if (!fs.existsSync(suitePath)) {
      throw new Error(`Test suite not found: ${suitePath}`);
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const args = [
        'node_modules/.bin/jest',
        suitePath,
        '--json',
        '--no-cache',
        `--timeout=${this.timeout}`
      ];

      if (this.coverage) {
        args.push('--coverage');
      }

      if (this.debugMode) {
        args.push('--verbose');
      }

      const process = spawn('npx', args, {
        cwd: path.resolve(__dirname, '../..'),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        try {
          const result = JSON.parse(stdout);
          resolve({
            success: code === 0,
            duration,
            tests: result.testResults?.[0]?.assertionResults || [],
            errors: result.testResults?.[0]?.failureMessages || [],
            coverage: result.coverageMap
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse test output: ${parseError.message}`));
        }
      });

      process.on('error', reject);
    });
  }

  generateReport(results) {
    console.log('\n📊 Test Report');
    console.log('=' .repeat(50));

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let totalDuration = 0;

    Object.entries(results).forEach(([suite, result]) => {
      if (result.tests) {
        const suiteTotal = result.tests.length;
        const suitePassed = result.tests.filter(t => t.status === 'passed').length;
        const suiteFailed = suiteTotal - suitePassed;

        totalTests += suiteTotal;
        passedTests += suitePassed;
        failedTests += suiteFailed;
        totalDuration += result.duration;

        console.log(`\n📋 ${suite}`);
        console.log(`   Tests: ${suiteTotal} | Passed: ${suitePassed} | Failed: ${suiteFailed}`);
        console.log(`   Duration: ${result.duration}ms`);

        if (result.errors.length > 0) {
          console.log(`   Errors:`);
          result.errors.forEach(error => {
            console.log(`     - ${error}`);
          });
        }
      }
    });

    console.log('\n📈 Summary');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`   Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`   Total Duration: ${totalDuration}ms`);

    // Performance analysis
    if (totalDuration > 0) {
      console.log('\n⚡ Performance Analysis');
      console.log(`   Average test duration: ${(totalDuration / totalTests).toFixed(2)}ms`);
      
      if (totalDuration > 10000) {
        console.log('   ⚠️  WARNING: Test suite is running slowly (>10s total)');
      }
    }

    // Generate HTML report
    this.generateHTMLReport(results);
  }

  generateHTMLReport(results) {
    const reportPath = path.join(__dirname, '../reports/test-report.html');
    const reportDir = path.dirname(reportPath);

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const html = this.generateHTMLContent(results);
    fs.writeFileSync(reportPath, html);
    
    console.log(`\n📄 HTML Report: ${reportPath}`);
  }

  generateHTMLContent(results) {
    const timestamp = new Date().toISOString();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>OBS Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .test-item { margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 3px; }
        .error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 3px; margin: 5px 0; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-box { padding: 15px; background: #e9ecef; border-radius: 5px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>OBS Integration Test Report</h1>
        <p>Generated: ${timestamp}</p>
    </div>
    
    <div class="stats">
        ${Object.entries(results).map(([suite, result]) => `
            <div class="stat-box">
                <h3>${suite}</h3>
                <p class="${result.success ? 'passed' : 'failed'}">
                    ${result.success ? 'PASSED' : 'FAILED'}
                </p>
                <p>${result.duration}ms</p>
            </div>
        `).join('')}
    </div>
    
    ${Object.entries(results).map(([suite, result]) => `
        <div class="suite">
            <h2>${suite}</h2>
            <p>Duration: ${result.duration}ms</p>
            
            ${result.tests ? result.tests.map(test => `
                <div class="test-item">
                    <span class="${test.status}">
                        ${test.status === 'passed' ? '✅' : '❌'} ${test.title}
                    </span>
                    <span style="float: right;">${test.duration}ms</span>
                </div>
            `).join('') : ''}
            
            ${result.errors && result.errors.length > 0 ? `
                <h3>Errors:</h3>
                ${result.errors.map(error => `
                    <div class="error">${error}</div>
                `).join('')}
            ` : ''}
        </div>
    `).join('')}
</body>
</html>
    `;
  }
}

module.exports = { TestRunner };

// CLI usage
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(console.error);
}