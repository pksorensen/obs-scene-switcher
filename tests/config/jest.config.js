module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup/test-setup.js'],
  
  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/debug/**',
    '!src/mocks/**'
  ],
  
  coverageDirectory: 'tests/coverage',
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'json'
  ],
  
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Fail fast
  bail: false,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Transform configuration
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Platform-specific configurations
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration-setup.js']
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e-setup.js']
    }
  ],
  
  // Reporter configuration
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'OBS Integration Test Report',
      outputPath: 'tests/reports/test-report.html',
      includeFailureMsg: true,
      includeSuiteFailure: true
    }],
    ['jest-junit', {
      outputDirectory: 'tests/reports',
      outputName: 'junit.xml'
    }]
  ],
  
  // Global setup/teardown
  globalSetup: '<rootDir>/tests/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.js',
  
  // Watch mode configuration
  watchman: true,
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/reports/',
    '<rootDir>/tests/coverage/'
  ],
  
  // Performance monitoring
  detectLeaks: true,
  detectOpenHandles: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Platform-specific overrides
  ...(process.platform === 'win32' && {
    // Windows-specific config
    testTimeout: 60000,
    maxWorkers: 2
  }),
  
  ...(process.platform === 'darwin' && {
    // macOS-specific config
    testTimeout: 45000,
    maxWorkers: 4
  }),
  
  ...(process.platform === 'linux' && {
    // Linux-specific config
    testTimeout: 30000,
    maxWorkers: 'auto'
  })
};