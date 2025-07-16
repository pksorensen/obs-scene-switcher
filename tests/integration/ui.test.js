const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { remote } = require('electron');
const { OBSConnectionDialog } = require('../../src/ui/obs-connection-dialog');
const { ScenePicker } = require('../../src/ui/scene-picker');
const { MockOBSServer } = require('../mocks/obs-server');

describe('OBS UI Integration Tests', () => {
  let mockServer;
  let window;

  beforeEach(async () => {
    mockServer = new MockOBSServer();
    await mockServer.start(4455);
    
    // Create test window
    window = new remote.BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
  });

  afterEach(async () => {
    await mockServer.stop();
    window.close();
  });

  describe('Connection Dialog', () => {
    let dialog;

    beforeEach(() => {
      dialog = new OBSConnectionDialog(window);
    });

    it('should display connection dialog', async () => {
      await dialog.show();
      
      const isVisible = await dialog.isVisible();
      expect(isVisible).toBe(true);
    });

    it('should validate form inputs', async () => {
      await dialog.show();
      
      // Empty inputs
      const emptyResult = await dialog.validateForm({
        host: '',
        port: '',
        password: ''
      });
      expect(emptyResult.valid).toBe(false);
      
      // Invalid port
      const invalidPortResult = await dialog.validateForm({
        host: 'localhost',
        port: 'invalid',
        password: 'test'
      });
      expect(invalidPortResult.valid).toBe(false);
      
      // Valid inputs
      const validResult = await dialog.validateForm({
        host: 'localhost',
        port: '4455',
        password: 'test123'
      });
      expect(validResult.valid).toBe(true);
    });

    it('should show connection progress', async () => {
      await dialog.show();
      
      const connectionPromise = dialog.connect({
        host: 'localhost',
        port: 4455,
        password: 'test123'
      });
      
      const isLoading = await dialog.isLoading();
      expect(isLoading).toBe(true);
      
      await connectionPromise;
      
      const isLoadingAfter = await dialog.isLoading();
      expect(isLoadingAfter).toBe(false);
    });

    it('should display error messages', async () => {
      await dialog.show();
      
      await dialog.connect({
        host: 'localhost',
        port: 9999, // Wrong port
        password: 'test123'
      });
      
      const errorMessage = await dialog.getErrorMessage();
      expect(errorMessage).toContain('Connection failed');
    });
  });

  describe('Scene Picker', () => {
    let scenePicker;

    beforeEach(() => {
      scenePicker = new ScenePicker(window);
    });

    it('should display scene buttons', async () => {
      const scenes = [
        { name: 'Scene 1', active: true },
        { name: 'Scene 2', active: false },
        { name: 'Scene 3', active: false }
      ];
      
      await scenePicker.setScenes(scenes);
      
      const buttons = await scenePicker.getSceneButtons();
      expect(buttons).toHaveLength(3);
      expect(buttons[0].text).toBe('Scene 1');
      expect(buttons[0].isActive).toBe(true);
    });

    it('should handle scene selection', async () => {
      const scenes = [
        { name: 'Scene 1', active: true },
        { name: 'Scene 2', active: false }
      ];
      
      await scenePicker.setScenes(scenes);
      
      let selectedScene = null;
      scenePicker.on('sceneSelected', (scene) => {
        selectedScene = scene;
      });
      
      await scenePicker.selectScene('Scene 2');
      
      expect(selectedScene).toBe('Scene 2');
    });

    it('should filter scenes by search', async () => {
      const scenes = [
        { name: 'Main Scene', active: true },
        { name: 'Camera Scene', active: false },
        { name: 'Screen Share', active: false }
      ];
      
      await scenePicker.setScenes(scenes);
      await scenePicker.setSearchFilter('Camera');
      
      const filteredButtons = await scenePicker.getVisibleSceneButtons();
      expect(filteredButtons).toHaveLength(1);
      expect(filteredButtons[0].text).toBe('Camera Scene');
    });

    it('should handle keyboard navigation', async () => {
      const scenes = [
        { name: 'Scene 1', active: true },
        { name: 'Scene 2', active: false },
        { name: 'Scene 3', active: false }
      ];
      
      await scenePicker.setScenes(scenes);
      
      // Simulate arrow key navigation
      await scenePicker.simulateKeyPress('ArrowDown');
      const focusedButton = await scenePicker.getFocusedButton();
      expect(focusedButton.text).toBe('Scene 2');
      
      await scenePicker.simulateKeyPress('ArrowDown');
      const nextFocusedButton = await scenePicker.getFocusedButton();
      expect(nextFocusedButton.text).toBe('Scene 3');
    });

    it('should respond to window resizing', async () => {
      const scenes = Array.from({ length: 20 }, (_, i) => ({
        name: `Scene ${i + 1}`,
        active: i === 0
      }));
      
      await scenePicker.setScenes(scenes);
      
      // Resize window
      window.setSize(400, 300);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const layout = await scenePicker.getLayout();
      expect(layout.columnsPerRow).toBeLessThan(4);
      
      // Resize back
      window.setSize(800, 600);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const newLayout = await scenePicker.getLayout();
      expect(newLayout.columnsPerRow).toBeGreaterThan(4);
    });
  });

  describe('UI Responsiveness', () => {
    it('should maintain 60fps during scene switching', async () => {
      const scenePicker = new ScenePicker(window);
      const scenes = Array.from({ length: 10 }, (_, i) => ({
        name: `Scene ${i + 1}`,
        active: i === 0
      }));
      
      await scenePicker.setScenes(scenes);
      
      const frameRates = [];
      let lastFrameTime = Date.now();
      
      scenePicker.on('frameRendered', () => {
        const currentTime = Date.now();
        const frameTime = currentTime - lastFrameTime;
        frameRates.push(1000 / frameTime);
        lastFrameTime = currentTime;
      });
      
      // Rapid scene switching
      for (let i = 0; i < 10; i++) {
        await scenePicker.selectScene(`Scene ${(i % 10) + 1}`);
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
      }
      
      const avgFrameRate = frameRates.reduce((sum, rate) => sum + rate, 0) / frameRates.length;
      expect(avgFrameRate).toBeGreaterThan(55); // Allow some tolerance
    });

    it('should handle memory efficiently', async () => {
      const scenePicker = new ScenePicker(window);
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and destroy many scenes
      for (let i = 0; i < 100; i++) {
        const scenes = Array.from({ length: 50 }, (_, j) => ({
          name: `Scene ${i}-${j}`,
          active: j === 0
        }));
        
        await scenePicker.setScenes(scenes);
        await scenePicker.setScenes([]); // Clear
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not increase by more than 10MB
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});