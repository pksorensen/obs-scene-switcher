const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const OBSWebSocket = require('obs-websocket-js').default;
const ConfigManager = require('./src/config-manager');

// Keep a global reference of the window object
let mainWindow;
let configManager;
let isDocked = false;
let dockPosition = 'bottom-right';
let originalBounds = null;
let autoHideTimer = null;
let isHidden = false;
let showOnHover = true;
let hideDelay = 3000;

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
    
    // Update minimum size based on compact mode
    const layoutConfig = configManager.get('layout');
    const minHeight = layoutConfig.compactMode ? 50 : windowConfig.minHeight;
    const minWidth = layoutConfig.compactMode ? 100 : windowConfig.minWidth;
    
    mainWindow.setMinimumSize(minWidth, minHeight);
    
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
  if (!mainWindow || !configManager || isDocked) return;
  
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

// Get screen bounds and workarea
function getScreenInfo() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  
  return {
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor
  };
}

// Calculate dock position based on screen bounds
function calculateDockPosition(position, windowBounds) {
  const screenInfo = getScreenInfo();
  const { workArea } = screenInfo;
  
  // Add padding from screen edges
  const padding = 20;
  
  let x, y;
  
  switch (position) {
    case 'top-left':
      x = workArea.x + padding;
      y = workArea.y + padding;
      break;
    case 'top-right':
      x = workArea.x + workArea.width - windowBounds.width - padding;
      y = workArea.y + padding;
      break;
    case 'bottom-left':
      x = workArea.x + padding;
      y = workArea.y + workArea.height - windowBounds.height - padding;
      break;
    case 'bottom-right':
    default:
      x = workArea.x + workArea.width - windowBounds.width - padding;
      y = workArea.y + workArea.height - windowBounds.height - padding;
      break;
  }
  
  return { x, y };
}

// Dock window to specified position
function dockWindow(position = 'bottom-right') {
  if (!mainWindow) return false;
  
  try {
    // Store original bounds before docking
    if (!isDocked) {
      originalBounds = mainWindow.getBounds();
    }
    
    const currentBounds = mainWindow.getBounds();
    const dockCoords = calculateDockPosition(position, currentBounds);
    
    // Move window to dock position
    mainWindow.setPosition(dockCoords.x, dockCoords.y);
    
    // Set dock state
    isDocked = true;
    dockPosition = position;
    
    // Make window non-resizable when docked
    mainWindow.setResizable(false);
    
    // Set up auto-hide functionality
    const dockConfig = configManager ? configManager.get('window.dock') : {};
    hideDelay = dockConfig.hideDelay || 3000;
    showOnHover = dockConfig.showOnHover !== false;
    
    // Add mouse event listeners for auto-hide
    if (dockConfig.autoHide) {
      mainWindow.on('mouse-enter', () => {
        if (isHidden) {
          showWindow();
        }
        clearAutoHideTimer();
      });
      
      mainWindow.on('mouse-leave', () => {
        if (dockConfig.autoHide) {
          startAutoHideTimer();
        }
      });
      
      // Start auto-hide timer
      startAutoHideTimer();
    }
    
    // Notify renderer about dock state
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('dock:stateChanged', {
        docked: true,
        position: position,
        bounds: mainWindow.getBounds(),
        autoHide: dockConfig.autoHide || false
      });
    }
    
    console.log(`Window docked to ${position}`);
    return true;
  } catch (error) {
    console.error('Error docking window:', error);
    return false;
  }
}

// Undock window and restore original position
function undockWindow() {
  if (!mainWindow || !isDocked) return false;
  
  try {
    // Restore original bounds if available
    if (originalBounds) {
      mainWindow.setBounds(originalBounds);
    }
    
    // Reset dock state
    isDocked = false;
    dockPosition = null;
    originalBounds = null;
    isHidden = false;
    
    // Clear auto-hide functionality
    clearAutoHideTimer();
    
    // Remove mouse event listeners
    mainWindow.removeAllListeners('mouse-enter');
    mainWindow.removeAllListeners('mouse-leave');
    
    // Make window resizable again
    mainWindow.setResizable(true);
    
    // Notify renderer about dock state
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('dock:stateChanged', {
        docked: false,
        position: null,
        bounds: mainWindow.getBounds(),
        autoHide: false
      });
    }
    
    console.log('Window undocked');
    return true;
  } catch (error) {
    console.error('Error undocking window:', error);
    return false;
  }
}

// Toggle dock state
function toggleDock(position = 'bottom-right') {
  if (isDocked) {
    return undockWindow();
  } else {
    return dockWindow(position);
  }
}

// Update dock position when screen configuration changes
function updateDockPosition() {
  if (!isDocked || !mainWindow) return;
  
  try {
    const currentBounds = mainWindow.getBounds();
    const newCoords = calculateDockPosition(dockPosition, currentBounds);
    mainWindow.setPosition(newCoords.x, newCoords.y);
    
    console.log(`Dock position updated to ${dockPosition}`);
  } catch (error) {
    console.error('Error updating dock position:', error);
  }
}

// Auto-hide functionality
function startAutoHideTimer() {
  if (!isDocked || !configManager.get('window.dock.autoHide')) return;
  
  clearTimeout(autoHideTimer);
  autoHideTimer = setTimeout(() => {
    if (isDocked && !isHidden) {
      hideWindow();
    }
  }, hideDelay);
}

function clearAutoHideTimer() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

function hideWindow() {
  if (!mainWindow || !isDocked || isHidden) return;
  
  try {
    // Move window off-screen based on dock position
    const bounds = mainWindow.getBounds();
    const screenInfo = getScreenInfo();
    
    let hideX = bounds.x;
    let hideY = bounds.y;
    
    switch (dockPosition) {
      case 'bottom-right':
        hideX = screenInfo.workArea.x + screenInfo.workArea.width - 5;
        break;
      case 'bottom-left':
        hideX = screenInfo.workArea.x - bounds.width + 5;
        break;
      case 'top-right':
        hideX = screenInfo.workArea.x + screenInfo.workArea.width - 5;
        break;
      case 'top-left':
        hideX = screenInfo.workArea.x - bounds.width + 5;
        break;
    }
    
    mainWindow.setPosition(hideX, hideY);
    isHidden = true;
    
    // Notify renderer
    if (mainWindow.webContents) {
      mainWindow.webContents.send('dock:hiddenStateChanged', true);
    }
    
    console.log('Window auto-hidden');
  } catch (error) {
    console.error('Error hiding window:', error);
  }
}

function showWindow() {
  if (!mainWindow || !isDocked || !isHidden) return;
  
  try {
    // Restore to dock position
    const bounds = mainWindow.getBounds();
    const dockCoords = calculateDockPosition(dockPosition, bounds);
    mainWindow.setPosition(dockCoords.x, dockCoords.y);
    
    isHidden = false;
    
    // Notify renderer
    if (mainWindow.webContents) {
      mainWindow.webContents.send('dock:hiddenStateChanged', false);
    }
    
    console.log('Window shown from auto-hide');
    
    // Restart auto-hide timer
    if (configManager.get('window.dock.autoHide')) {
      startAutoHideTimer();
    }
  } catch (error) {
    console.error('Error showing window:', error);
  }
}

// Get current dock state
function getDockState() {
  return {
    docked: isDocked,
    position: dockPosition,
    originalBounds: originalBounds,
    currentBounds: mainWindow ? mainWindow.getBounds() : null,
    screenInfo: getScreenInfo(),
    isHidden: isHidden,
    autoHide: configManager ? configManager.get('window.dock.autoHide') : false
  };
}

function createWindow() {
  // Initialize configuration manager
  if (!configManager) {
    configManager = initializeConfig();
  }
  
  // Load window configuration
  const windowConfig = configManager.get('window');
  const themeConfig = configManager.get('theme');
  const layoutConfig = configManager.get('layout');
  
  // Set minimum height based on compact mode
  const minHeight = layoutConfig.compactMode ? 50 : windowConfig.minHeight;
  
  const electronWindowConfig = {
    width: windowConfig.bounds.width,
    height: windowConfig.bounds.height,
    x: windowConfig.bounds.x,
    y: windowConfig.bounds.y,
    minWidth: windowConfig.minWidth,
    minHeight: minHeight,
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
  
  // Listen for display changes to update dock position
  screen.on('display-added', updateDockPosition);
  screen.on('display-removed', updateDockPosition);
  screen.on('display-metrics-changed', updateDockPosition);
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

async function getMuteStatus() {
  if (!obs || !obsConnectionStatus.connected) {
    throw new Error('Not connected to OBS');
  }
  
  try {
    // Get the desktop audio source (usually called 'Desktop Audio' or 'Audio Output Capture')
    const inputs = await obs.call('GetInputList');
    const audioSource = inputs.inputs.find(input => 
      input.inputName.toLowerCase().includes('desktop audio') || 
      input.inputName.toLowerCase().includes('audio output capture') ||
      input.inputName.toLowerCase().includes('speakers')
    );
    
    if (!audioSource) {
      throw new Error('No audio source found');
    }
    
    const muteStatus = await obs.call('GetInputMute', { inputName: audioSource.inputName });
    return { muted: muteStatus.inputMuted, sourceName: audioSource.inputName };
  } catch (error) {
    console.error('Error getting mute status:', error);
    throw error;
  }
}

async function toggleMute() {
  if (!obs || !obsConnectionStatus.connected) {
    throw new Error('Not connected to OBS');
  }
  
  try {
    // Get the desktop audio source
    const inputs = await obs.call('GetInputList');
    const audioSource = inputs.inputs.find(input => 
      input.inputName.toLowerCase().includes('desktop audio') || 
      input.inputName.toLowerCase().includes('audio output capture') ||
      input.inputName.toLowerCase().includes('speakers')
    );
    
    if (!audioSource) {
      throw new Error('No audio source found');
    }
    
    // Toggle mute status
    await obs.call('ToggleInputMute', { inputName: audioSource.inputName });
    
    // Get the new mute status
    const muteStatus = await obs.call('GetInputMute', { inputName: audioSource.inputName });
    console.log('Audio mute toggled:', muteStatus.inputMuted);
    
    return { muted: muteStatus.inputMuted, sourceName: audioSource.inputName };
  } catch (error) {
    console.error('Error toggling mute:', error);
    throw error;
  }
}

// Microphone-specific functions
async function getMicMuteStatus() {
  if (!obs || !obsConnectionStatus.connected) {
    throw new Error('Not connected to OBS');
  }
  
  try {
    // Get microphone input sources
    const inputs = await obs.call('GetInputList');
    const micSource = inputs.inputs.find(input => 
      input.inputName.toLowerCase().includes('mic') || 
      input.inputName.toLowerCase().includes('microphone') ||
      input.inputName.toLowerCase().includes('audio input capture') ||
      input.inputKind === 'wasapi_input_capture' ||
      input.inputKind === 'pulse_input_capture' ||
      input.inputKind === 'coreaudio_input_capture'
    );
    
    if (!micSource) {
      throw new Error('No microphone source found');
    }
    
    const muteStatus = await obs.call('GetInputMute', { inputName: micSource.inputName });
    return { muted: muteStatus.inputMuted, sourceName: micSource.inputName };
  } catch (error) {
    console.error('Error getting mic mute status:', error);
    throw error;
  }
}

async function toggleMicMute() {
  if (!obs || !obsConnectionStatus.connected) {
    throw new Error('Not connected to OBS');
  }
  
  try {
    // Get microphone input sources
    const inputs = await obs.call('GetInputList');
    const micSource = inputs.inputs.find(input => 
      input.inputName.toLowerCase().includes('mic') || 
      input.inputName.toLowerCase().includes('microphone') ||
      input.inputName.toLowerCase().includes('audio input capture') ||
      input.inputKind === 'wasapi_input_capture' ||
      input.inputKind === 'pulse_input_capture' ||
      input.inputKind === 'coreaudio_input_capture'
    );
    
    if (!micSource) {
      throw new Error('No microphone source found');
    }
    
    // Toggle mute status
    await obs.call('ToggleInputMute', { inputName: micSource.inputName });
    
    // Get the new mute status
    const muteStatus = await obs.call('GetInputMute', { inputName: micSource.inputName });
    console.log('Microphone mute toggled:', muteStatus.inputMuted);
    
    return { muted: muteStatus.inputMuted, sourceName: micSource.inputName };
  } catch (error) {
    console.error('Error toggling mic mute:', error);
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

ipcMain.handle('window:updateCompactMode', (event, enabled) => {
  if (mainWindow && configManager) {
    // Update the layout configuration
    configManager.set('layout.compactMode', enabled);
    
    // Update window minimum size immediately
    const windowConfig = configManager.get('window');
    const minHeight = enabled ? 50 : windowConfig.minHeight;
    const minWidth = enabled ? 100 : windowConfig.minWidth;
    
    mainWindow.setMinimumSize(minWidth, minHeight);
    
    return true;
  }
  return false;
});

// Dock positioning IPC handlers
ipcMain.handle('dock:toggle', (event, position) => {
  return toggleDock(position);
});

ipcMain.handle('dock:dock', (event, position) => {
  return dockWindow(position);
});

ipcMain.handle('dock:undock', (event) => {
  return undockWindow();
});

ipcMain.handle('dock:getState', (event) => {
  return getDockState();
});

ipcMain.handle('dock:getScreenInfo', (event) => {
  return getScreenInfo();
});

ipcMain.handle('dock:setPosition', (event, position) => {
  if (isDocked) {
    dockPosition = position;
    return dockWindow(position);
  }
  return false;
});

ipcMain.handle('dock:show', (event) => {
  showWindow();
  return getDockState();
});

ipcMain.handle('dock:hide', (event) => {
  hideWindow();
  return getDockState();
});

ipcMain.handle('dock:toggleAutoHide', (event, enabled) => {
  if (configManager) {
    configManager.set('window.dock.autoHide', enabled);
    
    if (enabled && isDocked && !isHidden) {
      startAutoHideTimer();
    } else {
      clearAutoHideTimer();
    }
    
    return true;
  }
  return false;
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

ipcMain.handle('obs:getMuteStatus', async (event) => {
  try {
    const muteStatus = await getMuteStatus();
    return muteStatus;
  } catch (error) {
    console.error('IPC obs:getMuteStatus error:', error);
    throw error;
  }
});

ipcMain.handle('obs:toggleMute', async (event) => {
  try {
    const muteStatus = await toggleMute();
    return muteStatus;
  } catch (error) {
    console.error('IPC obs:toggleMute error:', error);
    throw error;
  }
});

// Microphone IPC handlers
ipcMain.handle('obs:getMicMuteStatus', async (event) => {
  try {
    const muteStatus = await getMicMuteStatus();
    return muteStatus;
  } catch (error) {
    console.error('IPC obs:getMicMuteStatus error:', error);
    throw error;
  }
});

ipcMain.handle('obs:toggleMicMute', async (event) => {
  try {
    const muteStatus = await toggleMicMute();
    return muteStatus;
  } catch (error) {
    console.error('IPC obs:toggleMicMute error:', error);
    throw error;
  }
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