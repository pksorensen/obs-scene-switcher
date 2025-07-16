const { EventEmitter } = require('events');

class ScenePicker extends EventEmitter {
  constructor(window) {
    super();
    this.window = window;
    this.scenes = [];
    this.searchFilter = '';
    this.focusedIndex = 0;
    this.layout = {
      columnsPerRow: 4
    };
  }

  async setScenes(scenes) {
    this.scenes = scenes;
    this.emit('scenesUpdated', scenes);
    return true;
  }

  async getSceneButtons() {
    return this.scenes.map(scene => ({
      text: scene.name,
      isActive: scene.active
    }));
  }

  async getVisibleSceneButtons() {
    return this.scenes
      .filter(scene => scene.name.toLowerCase().includes(this.searchFilter.toLowerCase()))
      .map(scene => ({
        text: scene.name,
        isActive: scene.active
      }));
  }

  async selectScene(sceneName) {
    this.emit('sceneSelected', sceneName);
    return true;
  }

  async setSearchFilter(filter) {
    this.searchFilter = filter;
    this.emit('filterChanged', filter);
    return true;
  }

  async simulateKeyPress(key) {
    if (key === 'ArrowDown') {
      this.focusedIndex = Math.min(this.focusedIndex + 1, this.scenes.length - 1);
    } else if (key === 'ArrowUp') {
      this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
    }
    
    this.emit('keyPressed', key);
    return true;
  }

  async getFocusedButton() {
    if (this.focusedIndex < this.scenes.length) {
      return {
        text: this.scenes[this.focusedIndex].name,
        isActive: this.scenes[this.focusedIndex].active
      };
    }
    return null;
  }

  async getLayout() {
    const windowSize = this.window.getSize();
    const windowWidth = windowSize[0];
    
    this.layout.columnsPerRow = Math.floor(windowWidth / 150); // Assume 150px per button
    
    return this.layout;
  }
}

module.exports = { ScenePicker };