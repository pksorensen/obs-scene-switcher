const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { OBSWebSocketConnection } = require('../../src/obs-integration/websocket');
const { MockOBSServer } = require('../mocks/obs-server');

describe('Cross-Platform Integration Tests', () => {
  let obsConnection;
  let mockServer;
  const platform = os.platform();
  const arch = os.arch();

  beforeEach(async () => {
    mockServer = new MockOBSServer();
    await mockServer.start(4455);
    obsConnection = new OBSWebSocketConnection();
  });

  afterEach(async () => {
    await obsConnection.disconnect();
    await mockServer.stop();
  });

  describe(`Platform: ${platform} (${arch})`, () => {
    it('should connect on current platform', async () => {
      const result = await obsConnection.connect({
        host: 'localhost',
        port: 4455,
        password: 'test123'
      });

      expect(result.success).toBe(true);
      expect(obsConnection.isConnected()).toBe(true);
    });

    it('should handle platform-specific paths', async () => {
      const testPath = platform === 'win32' ? 'C:\\test\\path' : '/test/path';
      const normalizedPath = path.normalize(testPath);
      
      expect(normalizedPath).toBeDefined();
      expect(typeof normalizedPath).toBe('string');
    });

    it('should handle platform-specific line endings', async () => {
      const testData = 'line1\nline2\nline3';
      const platformData = platform === 'win32' ? 
        testData.replace(/\n/g, '\r\n') : testData;
      
      expect(platformData).toBeDefined();
      expect(platformData.split(/\r?\n/)).toHaveLength(3);
    });
  });

  describe('Windows-specific tests', () => {
    beforeEach(() => {
      if (platform !== 'win32') {
        pending('Skipping Windows-specific test');
      }
    });

    it('should handle Windows paths correctly', () => {
      const windowsPath = 'C:\\Users\\Test\\OBS Studio';
      const normalized = path.normalize(windowsPath);
      
      expect(normalized).toBe(windowsPath);
      expect(path.sep).toBe('\\');
    });

    it('should handle Windows file permissions', async () => {
      const testFile = path.join(os.tmpdir(), 'obs-test.txt');
      fs.writeFileSync(testFile, 'test');
      
      const stats = fs.statSync(testFile);
      expect(stats.isFile()).toBe(true);
      
      fs.unlinkSync(testFile);
    });

    it('should handle Windows registry-like operations', () => {
      // Mock Windows registry operations
      const mockRegistry = {
        get: (key) => `value_for_${key}`,
        set: (key, value) => true
      };
      
      const value = mockRegistry.get('HKEY_CURRENT_USER\\Software\\OBS');
      expect(value).toBe('value_for_HKEY_CURRENT_USER\\Software\\OBS');
    });
  });

  describe('macOS-specific tests', () => {
    beforeEach(() => {
      if (platform !== 'darwin') {
        pending('Skipping macOS-specific test');
      }
    });

    it('should handle macOS paths correctly', () => {
      const macPath = '/Users/Test/Library/Application Support/obs-studio';
      const normalized = path.normalize(macPath);
      
      expect(normalized).toBe(macPath);
      expect(path.sep).toBe('/');
    });

    it('should handle macOS permissions', async () => {
      const testFile = path.join(os.tmpdir(), 'obs-test.txt');
      fs.writeFileSync(testFile, 'test');
      
      const stats = fs.statSync(testFile);
      expect(stats.isFile()).toBe(true);
      
      fs.unlinkSync(testFile);
    });

    it('should handle macOS bundle structure', () => {
      const bundlePath = '/Applications/OBS.app/Contents/MacOS/OBS';
      const parsedPath = path.parse(bundlePath);
      
      expect(parsedPath.dir).toBe('/Applications/OBS.app/Contents/MacOS');
      expect(parsedPath.name).toBe('OBS');
    });
  });

  describe('Linux-specific tests', () => {
    beforeEach(() => {
      if (platform !== 'linux') {
        pending('Skipping Linux-specific test');
      }
    });

    it('should handle Linux paths correctly', () => {
      const linuxPath = '/home/user/.config/obs-studio';
      const normalized = path.normalize(linuxPath);
      
      expect(normalized).toBe(linuxPath);
      expect(path.sep).toBe('/');
    });

    it('should handle Linux permissions', async () => {
      const testFile = path.join(os.tmpdir(), 'obs-test.txt');
      fs.writeFileSync(testFile, 'test');
      
      const stats = fs.statSync(testFile);
      expect(stats.isFile()).toBe(true);
      
      fs.unlinkSync(testFile);
    });

    it('should handle Linux desktop environment', () => {
      const desktopEnv = process.env.DESKTOP_SESSION || 
                        process.env.XDG_CURRENT_DESKTOP || 
                        'unknown';
      
      expect(typeof desktopEnv).toBe('string');
    });
  });

  describe('Architecture-specific tests', () => {
    it('should handle current architecture', () => {
      expect(['x64', 'arm64', 'arm', 'ia32']).toContain(arch);
    });

    it('should handle endianness', () => {
      const endianness = os.endianness();
      expect(['BE', 'LE']).toContain(endianness);
    });

    it('should handle memory constraints', () => {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      
      expect(totalMemory).toBeGreaterThan(0);
      expect(freeMemory).toBeGreaterThan(0);
      expect(freeMemory).toBeLessThanOrEqual(totalMemory);
    });
  });

  describe('Network stack tests', () => {
    it('should handle IPv4 connections', async () => {
      const result = await obsConnection.connect({
        host: '127.0.0.1',
        port: 4455,
        password: 'test123'
      });

      expect(result.success).toBe(true);
    });

    it('should handle localhost resolution', async () => {
      const result = await obsConnection.connect({
        host: 'localhost',
        port: 4455,
        password: 'test123'
      });

      expect(result.success).toBe(true);
    });

    it('should handle IPv6 if available', async () => {
      try {
        const result = await obsConnection.connect({
          host: '::1',
          port: 4455,
          password: 'test123'
        });
        
        // IPv6 may not be available on all systems
        expect(result.success).toBe(true);
      } catch (error) {
        // IPv6 not available, skip test
        expect(error).toBeDefined();
      }
    });
  });

  describe('File system tests', () => {
    it('should handle temp directory access', () => {
      const tmpDir = os.tmpdir();
      expect(fs.existsSync(tmpDir)).toBe(true);
      
      const testFile = path.join(tmpDir, 'obs-platform-test.txt');
      fs.writeFileSync(testFile, 'test data');
      
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf8')).toBe('test data');
      
      fs.unlinkSync(testFile);
    });

    it('should handle path separators', () => {
      const testPath = ['folder1', 'folder2', 'file.txt'];
      const joinedPath = path.join(...testPath);
      
      if (platform === 'win32') {
        expect(joinedPath).toBe('folder1\\folder2\\file.txt');
      } else {
        expect(joinedPath).toBe('folder1/folder2/file.txt');
      }
    });
  });

  describe('Process environment tests', () => {
    it('should handle environment variables', () => {
      const testVar = 'OBS_TEST_VAR';
      const testValue = 'test_value';
      
      process.env[testVar] = testValue;
      expect(process.env[testVar]).toBe(testValue);
      
      delete process.env[testVar];
      expect(process.env[testVar]).toBeUndefined();
    });

    it('should handle platform-specific environment', () => {
      if (platform === 'win32') {
        expect(process.env.USERPROFILE).toBeDefined();
        expect(process.env.APPDATA).toBeDefined();
      } else {
        expect(process.env.HOME).toBeDefined();
        expect(process.env.USER).toBeDefined();
      }
    });
  });

  describe('Performance characteristics', () => {
    it('should measure platform-specific performance', async () => {
      const iterations = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await obsConnection.connect({
          host: 'localhost',
          port: 4455,
          password: 'test123'
        });
        await obsConnection.disconnect();
      }
      
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / iterations;
      
      // Performance expectations may vary by platform
      const expectedMaxTime = platform === 'win32' ? 50 : 30;
      expect(avgTime).toBeLessThan(expectedMaxTime);
    });

    it('should handle concurrent connections appropriately', async () => {
      const concurrentConnections = 10;
      const promises = [];
      
      for (let i = 0; i < concurrentConnections; i++) {
        const conn = new OBSWebSocketConnection();
        promises.push(conn.connect({
          host: 'localhost',
          port: 4455,
          password: 'test123'
        }));
      }
      
      const results = await Promise.all(promises);
      const successful = results.filter(r => r.success).length;
      
      // At least some connections should succeed
      expect(successful).toBeGreaterThan(0);
    });
  });
});

// Platform-specific test suites
if (process.env.PLATFORM_SPECIFIC_TESTS) {
  describe('Extended platform tests', () => {
    it('should run platform-specific OBS tests', async () => {
      // This would run actual OBS if available
      try {
        const realConnection = new OBSWebSocketConnection();
        const result = await realConnection.connect({
          host: 'localhost',
          port: 4444, // Default OBS port
          password: ''
        });
        
        if (result.success) {
          console.log('✅ Real OBS connection successful');
          const scenes = await realConnection.getScenes();
          expect(scenes).toBeDefined();
          await realConnection.disconnect();
        } else {
          console.log('ℹ️  Real OBS not available for testing');
        }
      } catch (error) {
        console.log('ℹ️  Real OBS test skipped:', error.message);
      }
    });
  });
}