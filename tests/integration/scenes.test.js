const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { OBSWebSocketConnection } = require('../../src/obs-integration/websocket');
const { MockOBSServer } = require('../mocks/obs-server');

describe('OBS Scene Management Tests', () => {
  let obsConnection;
  let mockServer;

  beforeEach(async () => {
    mockServer = new MockOBSServer();
    await mockServer.start(4455, {
      scenes: [
        { name: 'Scene 1', active: true },
        { name: 'Scene 2', active: false },
        { name: 'Test Scene with Special Chars 🎮', active: false },
        { name: 'Long Scene Name That Should Be Handled Properly', active: false }
      ]
    });
    
    obsConnection = new OBSWebSocketConnection();
    await obsConnection.connect({
      host: 'localhost',
      port: 4455,
      password: 'test123'
    });
  });

  afterEach(async () => {
    await obsConnection.disconnect();
    await mockServer.stop();
  });

  describe('Scene Listing', () => {
    it('should retrieve all scenes', async () => {
      const scenes = await obsConnection.getScenes();
      
      expect(scenes).toHaveLength(4);
      expect(scenes[0].name).toBe('Scene 1');
      expect(scenes[0].active).toBe(true);
    });

    it('should handle empty scene list', async () => {
      await mockServer.setScenes([]);
      
      const scenes = await obsConnection.getScenes();
      expect(scenes).toHaveLength(0);
    });

    it('should handle large scene list', async () => {
      const largeSceneList = Array.from({ length: 100 }, (_, i) => ({
        name: `Scene ${i + 1}`,
        active: i === 0
      }));
      
      await mockServer.setScenes(largeSceneList);
      
      const scenes = await obsConnection.getScenes();
      expect(scenes).toHaveLength(100);
    });

    it('should handle scene names with special characters', async () => {
      const scenes = await obsConnection.getScenes();
      const specialScene = scenes.find(s => s.name.includes('🎮'));
      
      expect(specialScene).toBeDefined();
      expect(specialScene.name).toBe('Test Scene with Special Chars 🎮');
    });
  });

  describe('Scene Switching', () => {
    it('should switch scenes successfully', async () => {
      const result = await obsConnection.switchScene('Scene 2');
      
      expect(result.success).toBe(true);
      
      const scenes = await obsConnection.getScenes();
      const activeScene = scenes.find(s => s.active);
      expect(activeScene.name).toBe('Scene 2');
    });

    it('should handle invalid scene names', async () => {
      const result = await obsConnection.switchScene('Non-existent Scene');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Scene not found');
    });

    it('should measure switching latency', async () => {
      const startTime = Date.now();
      await obsConnection.switchScene('Scene 2');
      const switchTime = Date.now() - startTime;
      
      expect(switchTime).toBeLessThan(100); // Target: <100ms
    });

    it('should handle rapid scene switching', async () => {
      const scenes = ['Scene 1', 'Scene 2', 'Scene 1', 'Scene 2'];
      
      for (const sceneName of scenes) {
        const result = await obsConnection.switchScene(sceneName);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Scene Updates', () => {
    it('should detect scene additions', async (done) => {
      obsConnection.on('sceneAdded', (scene) => {
        expect(scene.name).toBe('New Scene');
        done();
      });

      await mockServer.addScene({ name: 'New Scene', active: false });
    });

    it('should detect scene removals', async (done) => {
      obsConnection.on('sceneRemoved', (sceneName) => {
        expect(sceneName).toBe('Scene 2');
        done();
      });

      await mockServer.removeScene('Scene 2');
    });

    it('should detect scene renames', async (done) => {
      obsConnection.on('sceneRenamed', (oldName, newName) => {
        expect(oldName).toBe('Scene 1');
        expect(newName).toBe('Main Scene');
        done();
      });

      await mockServer.renameScene('Scene 1', 'Main Scene');
    });
  });

  describe('Performance', () => {
    it('should retrieve scenes within 50ms', async () => {
      const startTime = Date.now();
      await obsConnection.getScenes();
      const retrievalTime = Date.now() - startTime;
      
      expect(retrievalTime).toBeLessThan(50);
    });

    it('should handle concurrent scene operations', async () => {
      const promises = [
        obsConnection.getScenes(),
        obsConnection.switchScene('Scene 2'),
        obsConnection.getScenes(),
        obsConnection.switchScene('Scene 1')
      ];

      const results = await Promise.all(promises);
      
      expect(results[0]).toHaveLength(4); // First getScenes
      expect(results[1].success).toBe(true); // First switch
      expect(results[2]).toHaveLength(4); // Second getScenes
      expect(results[3].success).toBe(true); // Second switch
    });
  });
});