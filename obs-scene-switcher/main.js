const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const OBSWebSocket = require('obs-websocket-js').default;
const ConfigManager = require('./src/config-manager');

// Keep a global reference of the window object
let mainWindow;
let configManager;

// OBS WebSocket instance
let obs = null;
let obsConnectionStatus = {
  connected: false,
  connecting: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  reconnectTimer: null,
  lastConnectionConfig: null
};

// Initialize configuration manager
function initializeConfig() {
  const userDataPath = app.getPath('userData');
  configManager = new ConfigManager(userDataPath);
  
  // Set up configuration watchers
  configManager.watch('window', (windowConfig) => {
    if (mainWindow && windowConfig) {
      updateWindowFromConfig(windowConfig);
    }
  });
  
  configManager.watch('theme', (themeConfig) => {
    if (mainWindow && themeConfig) {
      mainWindow.webContents.send('theme:update', themeConfig);
    }
  });
  
  return configManager;
}

// Update window properties from config
function updateWindowFromConfig(windowConfig) {
  if (!mainWindow || !windowConfig) return;
  
  try {
    // Update always on top
    if (windowConfig.alwaysOnTop !== undefined) {
      mainWindow.setAlwaysOnTop(windowConfig.alwaysOnTop, 'floating');
    }
    
    // Update window bounds if remember settings are enabled
    if (windowConfig.rememberPosition && windowConfig.bounds) {
      const { x, y } = windowConfig.bounds;
      if (x !== undefined && y !== undefined) {
        mainWindow.setPosition(x, y);
      }
    }
    
    if (windowConfig.rememberSize && windowConfig.bounds) {
      const { width, height } = windowConfig.bounds;
      if (width && height) {
        mainWindow.setSize(width, height);
      }
    }
    
    // Update transparency
    if (windowConfig.transparency !== undefined) {
      mainWindow.setOpacity(windowConfig.transparency);
    }
  } catch (error) {
    console.error('Error updating window from config:', error);
  }
}

// Save window bounds to config
function saveWindowBounds() {
  if (!mainWindow || !configManager) return;
  
  try {
    const bounds = mainWindow.getBounds();
    const config = configManager.get('window');
    
    if (config.rememberPosition) {
      configManager.set('window.bounds.x', bounds.x);
      configManager.set('window.bounds.y', bounds.y);
    }
    
    if (config.rememberSize) {
      configManager.set('window.bounds.width', bounds.width);
      configManager.set('window.bounds.height', bounds.height);
    }
  } catch (error) {
    console.error('Error saving window config:', error);
  }
}

function createWindow() {
  // Initialize configuration manager
  if (!configManager) {
    configManager = initializeConfig();
  }
  
  // Load window configuration
  const windowConfig = configManager.get('window');
  const themeConfig = configManager.get('theme');
  
  const electronWindowConfig = {
    width: windowConfig.bounds.width,
    height: windowConfig.bounds.height,
    x: windowConfig.bounds.x,
    y: windowConfig.bounds.y,
    minWidth: windowConfig.minWidth,
    minHeight: windowConfig.minHeight,
    frame: false, // Remove default window frame
    transparent: true, // Enable transparency
    alwaysOnTop: windowConfig.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#00000000', // Transparent background
    resizable: true,
    movable: true,
    skipTaskbar: false
  };

  // Create the browser window
  mainWindow = new BrowserWindow(electronWindowConfig);

  // Load the index.html
  mainWindow.loadFile('index.html');

  // Save window position when moved or resized
  let saveTimer;
  const debounceSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWindowBounds, 1000);
  };

  mainWindow.on('moved', debounceSave);
  mainWindow.on('resized', debounceSave);

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent window from hiding on blur (keeps always on top)
  mainWindow.setAlwaysOnTop(true, 'floating');
  
  // Make window stay on all workspaces (macOS)
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true);
  }

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// OBS WebSocket Management
function initializeOBS() {
  if (obs) return;
  
  obs = new OBSWebSocket();
  
  // Connection events
  obs.on('ConnectionOpened', () => {
    console.log('OBS WebSocket connection opened');
    obsConnectionStatus.connected = true;
    obsConnectionStatus.connecting = false;
    obsConnectionStatus.reconnectAttempts = 0;
    
    if (mainWindow) {
      mainWindow.webContents.send('obs:connectionChanged', true);
    }
  });

  obs.on('ConnectionClosed', () => {
    console.log('OBS WebSocket connection closed');
    obsConnectionStatus.connected = false;
    obsConnectionStatus.connecting = false;
    
    if (mainWindow) {
      mainWindow.webContents.send('obs:connectionChanged', false);
    }
    
    // Attempt to reconnect if it was unexpected
    if (obsConnectionStatus.lastConnectionConfig && 
        obsConnectionStatus.reconnectAttempts < obsConnectionStatus.maxReconnectAttempts) {
      scheduleReconnect();
    }
  });

  obs.on('ConnectionError', (error) => {
    console.error('OBS WebSocket connection error:', error);
    obsConnectionStatus.connected = false;
    obsConnectionStatus.connecting = false;
    
    if (mainWindow) {
      mainWindow.webContents.send('obs:connectionChanged', false);
    }
  });

  // Scene change events
  obs.on('CurrentProgramSceneChanged', (data) => {
    console.log('Scene changed to:', data.sceneName);
    if (mainWindow) {
      mainWindow.webContents.send('obs:sceneChanged', data.sceneName);
    }
  });

  obs.on('SceneListChanged', async () => {
    console.log('Scene list changed');
    try {
      const scenes = await getSceneList();
      if (mainWindow) {
        mainWindow.webContents.send('obs:scenesListChanged', scenes);
      }
    } catch (error) {
      console.error('Error getting updated scene list:', error);
    }
  });
}

function scheduleReconnect() {
  if (obsConnectionStatus.reconnectTimer) {
    clearTimeout(obsConnectionStatus.reconnectTimer);
  }
  
  obsConnectionStatus.reconnectAttempts++;
  console.log(`Scheduling reconnect attempt ${obsConnectionStatus.reconnectAttempts}/${obsConnectionStatus.maxReconnectAttempts}`);
  
  obsConnectionStatus.reconnectTimer = setTimeout(async () => {
    if (obsConnectionStatus.lastConnectionConfig) {
      console.log('Attempting to reconnect to OBS...');
      try {
        await connectToOBS(
          obsConnectionStatus.lastConnectionConfig.host,
          obsConnectionStatus.lastConnectionConfig.port,
          obsConnectionStatus.lastConnectionConfig.password
        );
      } catch (error) {
        console.error('Reconnection failed:', error);
        // Will trigger another reconnect attempt if within limits
      }
    }
  }, obsConnectionStatus.reconnectDelay);
}

async function connectToOBS(host, port, password) {
  if (!obs) {
    initializeOBS();
  }
  
  if (obsConnectionStatus.connected) {
    await disconnectFromOBS();
  }
  
  obsConnectionStatus.connecting = true;
  obsConnectionStatus.lastConnectionConfig = { host, port, password };
  
  try {
    const connectionInfo = {
      address: `ws://${host}:${port}`,
      password: password || undefined
    };
    
    await obs.connect(connectionInfo.address, connectionInfo.password);
    console.log('Successfully connected to OBS');
    return true;
  } catch (error) {
    console.error('Failed to connect to OBS:', error);
    obsConnectionStatus.connecting = false;
    obsConnectionStatus.lastConnectionConfig = null;
    throw error;
  }
}

async function disconnectFromOBS() {
  if (!obs) return;
  
  // Clear reconnection attempts
  obsConnectionStatus.lastConnectionConfig = null;
  obsConnectionStatus.reconnectAttempts = 0;
  
  if (obsConnectionStatus.reconnectTimer) {
    clearTimeout(obsConnectionStatus.reconnectTimer);
    obsConnectionStatus.reconnectTimer = null;
  }
  
  try {
    await obs.disconnect();
    console.log('Disconnected from OBS');
  } catch (error) {
    console.error('Error disconnecting from OBS:', error);
  }
}

async function getSceneList() {
  if (!obs || !obsConnectionStatus.connected) {
    throw new Error('Not connected to OBS');
  }
  
  try {
    const response = await obs.call('GetSceneList');
    return response.scenes || [];
  } catch (error) {
    console.error('Error getting scene list:', error);
    throw error;
  }
}

async function getCurrentScene() {
  if (!obs || !obsConnectionStatus.connected) {
    throw new Error('Not connected to OBS');
  }
  
  try {
    const response = await obs.call('GetCurrentProgramScene');
    return response.currentProgramSceneName;
  } catch (error) {
    console.error('Error getting current scene:', error);
    throw error;
  }
}

async function setCurrentScene(sceneName) {
  if (!obs || !obsConnectionStatus.connected) {
    throw new Error('Not connected to OBS');
  }
  
  try {
    await obs.call('SetCurrentProgramScene', { sceneName });
    console.log('Scene switched to:', sceneName);
  } catch (error) {
    console.error('Error setting current scene:', error);
    throw error;
  }
}

function getOBSStatus() {
  return {
    connected: obsConnectionStatus.connected,
    connecting: obsConnectionStatus.connecting,
    reconnectAttempts: obsConnectionStatus.reconnectAttempts,
    maxReconnectAttempts: obsConnectionStatus.maxReconnectAttempts
  };
}

// IPC handlers for window controls
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:setAlwaysOnTop', (event, value) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(value, 'floating');
  }
});

// OBS WebSocket IPC handlers
ipcMain.handle('obs:connect', async (event, host, port, password) => {
  try {
    const success = await connectToOBS(host, port, password);
    return success;
  } catch (error) {
    console.error('IPC obs:connect error:', error);
    return false;
  }
});

ipcMain.handle('obs:disconnect', async (event) => {
  try {
    await disconnectFromOBS();
    return true;
  } catch (error) {
    console.error('IPC obs:disconnect error:', error);
    return false;
  }
});

ipcMain.handle('obs:getScenes', async (event) => {
  try {
    const scenes = await getSceneList();
    return scenes;
  } catch (error) {
    console.error('IPC obs:getScenes error:', error);
    throw error;
  }
});

ipcMain.handle('obs:getCurrentScene', async (event) => {
  try {
    const currentScene = await getCurrentScene();
    return currentScene;
  } catch (error) {
    console.error('IPC obs:getCurrentScene error:', error);
    throw error;
  }
});

ipcMain.handle('obs:setCurrentScene', async (event, sceneName) => {
  try {
    await setCurrentScene(sceneName);
    return true;
  } catch (error) {
    console.error('IPC obs:setCurrentScene error:', error);
    throw error;
  }
});

ipcMain.handle('obs:getStatus', (event) => {
  return getOBSStatus();
});

// Settings IPC handlers
ipcMain.handle('settings:get', (event, key) => {
  return configManager ? configManager.get(key) : undefined;
});

ipcMain.handle('settings:set', (event, key, value) => {
  if (configManager) {
    configManager.set(key, value);
    return true;
  }
  return false;
});

ipcMain.handle('settings:getAll', (event) => {
  return configManager ? configManager.getAll() : {};
});

ipcMain.handle('settings:updateAll', (event, updates) => {
  if (configManager) {
    configManager.update(updates);
    return true;
  }
  return false;
});

ipcMain.handle('settings:reset', (event) => {
  if (configManager) {
    configManager.reset();
    return true;
  }
  return false;
});

ipcMain.handle('settings:export', async (event) => {
  if (!configManager) return { success: false, error: 'Configuration not initialized' };
  
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Settings',
      defaultPath: 'obs-scene-switcher-config.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (filePath) {
      const success = configManager.exportConfig(filePath);
      return { success, filePath };
    }
    return { success: false, error: 'No file selected' };
  } catch (error) {
    console.error('Error exporting settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:import', async (event) => {
  if (!configManager) return { success: false, error: 'Configuration not initialized' };
  
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Settings',
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (filePaths && filePaths.length > 0) {
      const success = configManager.importConfig(filePaths[0]);
      return { success, filePath: filePaths[0] };
    }
    return { success: false, error: 'No file selected' };
  } catch (error) {
    console.error('Error importing settings:', error);
    return { success: false, error: error.message };
  }
});

// App event handlers
app.whenReady().then(() => {
  // Initialize configuration first
  configManager = initializeConfig();
  createWindow();
  initializeOBS();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Clean up OBS connection before quitting
  await disconnectFromOBS();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}