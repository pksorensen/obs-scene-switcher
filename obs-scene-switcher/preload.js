const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:setAlwaysOnTop', value),
  updateCompactMode: (enabled) => ipcRenderer.invoke('window:updateCompactMode', enabled),
  
  // OBS WebSocket communication (to be implemented)
  obs: {
    connect: (host, port, password) => ipcRenderer.invoke('obs:connect', host, port, password),
    disconnect: () => ipcRenderer.invoke('obs:disconnect'),
    getScenes: () => ipcRenderer.invoke('obs:getScenes'),
    getCurrentScene: () => ipcRenderer.invoke('obs:getCurrentScene'),
    setCurrentScene: (sceneName) => ipcRenderer.invoke('obs:setCurrentScene', sceneName),
    getStatus: () => ipcRenderer.invoke('obs:getStatus'),
    getMuteStatus: () => ipcRenderer.invoke('obs:getMuteStatus'),
    toggleMute: () => ipcRenderer.invoke('obs:toggleMute'),
    getMicMuteStatus: () => ipcRenderer.invoke('obs:getMicMuteStatus'),
    toggleMicMute: () => ipcRenderer.invoke('obs:toggleMicMute'),
    
    // Event listeners
    onSceneChanged: (callback) => {
      ipcRenderer.on('obs:sceneChanged', (event, sceneName) => callback(sceneName));
    },
    onConnectionChanged: (callback) => {
      ipcRenderer.on('obs:connectionChanged', (event, connected) => callback(connected));
    },
    onScenesListChanged: (callback) => {
      ipcRenderer.on('obs:scenesListChanged', (event, scenes) => callback(scenes));
    }
  },
  
  // Settings management
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    updateAll: (updates) => ipcRenderer.invoke('settings:updateAll', updates),
    reset: () => ipcRenderer.invoke('settings:reset'),
    export: () => ipcRenderer.invoke('settings:export'),
    import: () => ipcRenderer.invoke('settings:import')
  }
});