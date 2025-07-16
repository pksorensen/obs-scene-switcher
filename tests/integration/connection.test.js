const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { OBSWebSocketConnection } = require('../../src/obs-integration/websocket');
const { MockOBSServer } = require('../mocks/obs-server');

describe('OBS Connection Tests', () => {
  let obsConnection;
  let mockServer;

  beforeEach(() => {
    mockServer = new MockOBSServer();
    obsConnection = new OBSWebSocketConnection();
  });

  afterEach(async () => {
    await obsConnection.disconnect();
    await mockServer.stop();
  });

  describe('Basic Connection', () => {
    it('should connect to OBS when running', async () => {
      await mockServer.start(4455);
      
      const result = await obsConnection.connect({
        host: 'localhost',
        port: 4455,
        password: 'test123'
      });

      expect(result.success).toBe(true);
      expect(obsConnection.isConnected()).toBe(true);
    });

    it('should handle OBS not running', async () => {
      const result = await obsConnection.connect({
        host: 'localhost',
        port: 4455,
        password: 'test123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('should reject wrong password', async () => {
      await mockServer.start(4455, { password: 'correct' });
      
      const result = await obsConnection.connect({
        host: 'localhost',
        port: 4455,
        password: 'wrong'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    it('should handle connection timeout', async () => {
      const result = await obsConnection.connect({
        host: '192.168.255.255', // Non-routable IP
        port: 4455,
        password: 'test123',
        timeout: 1000
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Reconnection', () => {
    it('should auto-reconnect after disconnect', async (done) => {
      await mockServer.start(4455);
      await obsConnection.connect({
        host: 'localhost',
        port: 4455,
        password: 'test123',
        autoReconnect: true
      });

      obsConnection.on('reconnected', () => {
        expect(obsConnection.isConnected()).toBe(true);
        done();
      });

      // Simulate disconnect
      await mockServer.stop();
      await new Promise(resolve => setTimeout(resolve, 100));
      await mockServer.start(4455);
    });

    it('should respect reconnection limit', async () => {
      let reconnectAttempts = 0;
      
      obsConnection.on('reconnectAttempt', () => {
        reconnectAttempts++;
      });

      await obsConnection.connect({
        host: 'localhost',
        port: 4455,
        password: 'test123',
        autoReconnect: true,
        maxReconnectAttempts: 3
      });

      await new Promise(resolve => setTimeout(resolve, 5000));
      expect(reconnectAttempts).toBeLessThanOrEqual(3);
    });
  });

  describe('Performance', () => {
    it('should connect within 100ms', async () => {
      await mockServer.start(4455);
      
      const startTime = Date.now();
      await obsConnection.connect({
        host: 'localhost',
        port: 4455,
        password: 'test123'
      });
      const connectionTime = Date.now() - startTime;

      expect(connectionTime).toBeLessThan(100);
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      await mockServer.start(4455);
      
      for (let i = 0; i < 10; i++) {
        await obsConnection.connect({
          host: 'localhost',
          port: 4455,
          password: 'test123'
        });
        await obsConnection.disconnect();
      }

      // Should not crash or leak memory
      expect(obsConnection.isConnected()).toBe(false);
    });
  });
});