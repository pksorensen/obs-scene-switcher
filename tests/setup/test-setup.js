const { MockOBSServer } = require('../mocks/obs-server');

// Global test setup
global.beforeAll = global.beforeAll || (() => {});
global.afterAll = global.afterAll || (() => {});

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock Electron for testing
global.mockElectron = {
  remote: {
    BrowserWindow: class MockBrowserWindow {
      constructor(options) {
        this.options = options;
        this.isDestroyed = false;
      }
      
      close() {
        this.isDestroyed = true;
      }
      
      setSize(width, height) {
        this.options.width = width;
        this.options.height = height;
      }
      
      getSize() {
        return [this.options.width, this.options.height];
      }
    }
  },
  
  ipcRenderer: {
    send: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  }
};

// Mock WebSocket for testing
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }
  
  send(data) {
    if (this.readyState === WebSocket.OPEN) {
      // Simulate message handling
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({ data: JSON.stringify({ success: true }) });
        }
      }, 5);
    }
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
  
  addEventListener(event, handler) {
    if (event === 'open') this.onopen = handler;
    if (event === 'message') this.onmessage = handler;
    if (event === 'close') this.onclose = handler;
    if (event === 'error') this.onerror = handler;
  }
  
  removeEventListener(event, handler) {
    if (event === 'open') this.onopen = null;
    if (event === 'message') this.onmessage = null;
    if (event === 'close') this.onclose = null;
    if (event === 'error') this.onerror = null;
  }
};

// Global test utilities
global.testUtils = {
  createMockOBSServer: () => new MockOBSServer(),
  
  waitFor: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkCondition = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(checkCondition, 10);
        }
      };
      checkCondition();
    });
  },
  
  createMockScenes: (count = 5) => {
    return Array.from({ length: count }, (_, i) => ({
      name: `Scene ${i + 1}`,
      active: i === 0
    }));
  },
  
  measurePerformance: async (fn) => {
    const startTime = performance.now();
    await fn();
    return performance.now() - startTime;
  }
};

// Console override for cleaner test output
const originalConsole = { ...console };
global.console = {
  ...console,
  log: process.env.VERBOSE_TESTS ? console.log : () => {},
  info: process.env.VERBOSE_TESTS ? console.info : () => {},
  warn: console.warn,
  error: console.error
};

// Restore console for specific tests
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Memory leak detection
let initialMemory;
beforeEach(() => {
  initialMemory = process.memoryUsage();
});

afterEach(() => {
  if (process.env.DETECT_MEMORY_LEAKS) {
    const currentMemory = process.memoryUsage();
    const heapIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
    
    if (heapIncrease > 10 * 1024 * 1024) { // 10MB threshold
      console.warn(`⚠️  Potential memory leak detected: ${heapIncrease / 1024 / 1024}MB increase`);
    }
  }
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Performance monitoring
if (process.env.PERFORMANCE_MONITORING) {
  const { PerformanceObserver, performance } = require('perf_hooks');
  
  const obs = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      if (entry.duration > 100) { // Log operations taking >100ms
        console.log(`⚡ Performance: ${entry.name} took ${entry.duration}ms`);
      }
    });
  });
  
  obs.observe({ entryTypes: ['measure'] });
}

// Platform-specific setup
switch (process.platform) {
  case 'win32':
    // Windows-specific test setup
    jest.setTimeout(60000);
    break;
    
  case 'darwin':
    // macOS-specific test setup
    jest.setTimeout(45000);
    break;
    
  case 'linux':
    // Linux-specific test setup
    jest.setTimeout(30000);
    break;
}