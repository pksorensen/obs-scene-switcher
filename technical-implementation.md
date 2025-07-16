# OBS Scene Switcher - Technical Implementation Guide

## Window Management Implementation

### 1. Electron Main Process Setup

```typescript
// src/main/window.ts
import { BrowserWindow, screen, app } from 'electron';
import { UserConfig } from '../shared/types';

export class WindowManager {
  private window: BrowserWindow | null = null;
  private config: UserConfig;

  constructor(config: UserConfig) {
    this.config = config;
  }

  createWindow(): BrowserWindow {
    const { width, height, x, y } = this.config.window;
    
    this.window = new BrowserWindow({
      width: width || 200,
      height: height || 300,
      x: x || undefined,
      y: y || undefined,
      minWidth: 150,
      minHeight: 100,
      maxWidth: 600,
      maxHeight: 800,
      
      // Window behavior
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: true,
      
      // Security
      webSecurity: true,
      contextIsolation: true,
      nodeIntegration: false,
      
      // Web preferences
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });

    // Handle window events
    this.setupWindowEvents();
    
    // Load the renderer
    this.window.loadFile('dist/renderer/index.html');
    
    return this.window;
  }

  private setupWindowEvents(): void {
    if (!this.window) return;

    // Save position/size on move/resize
    this.window.on('moved', this.saveWindowState.bind(this));
    this.window.on('resized', this.saveWindowState.bind(this));
    
    // Handle window close
    this.window.on('close', (event) => {
      event.preventDefault();
      this.window?.hide();
    });

    // Prevent window from going off-screen
    this.window.on('move', this.constrainToScreen.bind(this));
    
    // Handle always-on-top behavior
    this.window.on('blur', () => {
      if (this.config.window.alwaysOnTop) {
        this.window?.setAlwaysOnTop(true);
      }
    });
  }

  private saveWindowState(): void {
    if (!this.window) return;
    
    const bounds = this.window.getBounds();
    this.config.window.position = { x: bounds.x, y: bounds.y };
    this.config.window.size = { width: bounds.width, height: bounds.height };
    
    // Save to persistent storage
    this.saveConfig();
  }

  private constrainToScreen(): void {
    if (!this.window) return;
    
    const bounds = this.window.getBounds();
    const displays = screen.getAllDisplays();
    
    // Find the display containing the window
    const display = displays.find(d => 
      bounds.x >= d.bounds.x && 
      bounds.x < d.bounds.x + d.bounds.width &&
      bounds.y >= d.bounds.y && 
      bounds.y < d.bounds.y + d.bounds.height
    ) || screen.getPrimaryDisplay();
    
    // Constrain to display bounds
    const workArea = display.workArea;
    const newBounds = {
      x: Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - bounds.width)),
      y: Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - bounds.height)),
      width: bounds.width,
      height: bounds.height,
    };
    
    if (newBounds.x !== bounds.x || newBounds.y !== bounds.y) {
      this.window.setBounds(newBounds);
    }
  }

  // Magnetic snap to screen edges
  enableMagneticSnap(): void {
    if (!this.window) return;
    
    this.window.on('will-move', (event, newBounds) => {
      const displays = screen.getAllDisplays();
      const snapDistance = 10;
      
      displays.forEach(display => {
        const workArea = display.workArea;
        
        // Snap to left edge
        if (Math.abs(newBounds.x - workArea.x) < snapDistance) {
          newBounds.x = workArea.x;
        }
        
        // Snap to right edge
        if (Math.abs(newBounds.x + newBounds.width - (workArea.x + workArea.width)) < snapDistance) {
          newBounds.x = workArea.x + workArea.width - newBounds.width;
        }
        
        // Snap to top edge
        if (Math.abs(newBounds.y - workArea.y) < snapDistance) {
          newBounds.y = workArea.y;
        }
        
        // Snap to bottom edge
        if (Math.abs(newBounds.y + newBounds.height - (workArea.y + workArea.height)) < snapDistance) {
          newBounds.y = workArea.y + workArea.height - newBounds.height;
        }
      });
    });
  }
}
```

### 2. OBS WebSocket Integration

```typescript
// src/main/obs-client.ts
import OBSWebSocket from 'obs-websocket-js';
import { EventEmitter } from 'events';

interface ConnectionConfig {
  host: string;
  port: number;
  password?: string;
}

export class OBSClient extends EventEmitter {
  private obs: OBSWebSocket;
  private config: ConnectionConfig;
  private reconnectTimer?: NodeJS.Timeout;
  private isConnecting = false;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
    this.obs = new OBSWebSocket();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Connection events
    this.obs.on('ConnectionOpened', () => {
      this.emit('connected');
      this.clearReconnectTimer();
    });

    this.obs.on('ConnectionClosed', () => {
      this.emit('disconnected');
      this.scheduleReconnect();
    });

    this.obs.on('ConnectionError', (error) => {
      this.emit('error', error);
      this.scheduleReconnect();
    });

    // Scene events
    this.obs.on('CurrentProgramSceneChanged', (event) => {
      this.emit('sceneChanged', event.sceneName);
    });

    // Status events
    this.obs.on('SceneListChanged', () => {
      this.emit('scenesUpdated');
    });
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return;
    
    this.isConnecting = true;
    this.emit('connecting');

    try {
      await this.obs.connect(
        `ws://${this.config.host}:${this.config.port}`,
        this.config.password
      );
      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    if (this.obs.identified) {
      await this.obs.disconnect();
    }
  }

  async getScenes(): Promise<Scene[]> {
    const response = await this.obs.call('GetSceneList');
    return response.scenes.map(scene => ({
      name: scene.sceneName,
      isActive: scene.sceneName === response.currentProgramSceneName,
    }));
  }

  async getCurrentScene(): Promise<string> {
    const response = await this.obs.call('GetCurrentProgramScene');
    return response.currentProgramSceneName;
  }

  async setCurrentScene(sceneName: string): Promise<void> {
    await this.obs.call('SetCurrentProgramScene', {
      sceneName: sceneName,
    });
  }

  async getVersion(): Promise<string> {
    const response = await this.obs.call('GetVersion');
    return response.obsVersion;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnect failed:', error);
      });
    }, 5000); // Retry after 5 seconds
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
```

### 3. IPC Communication Layer

```typescript
// src/main/ipc-handlers.ts
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { OBSClient } from './obs-client';
import { ConfigManager } from './config';

export class IPCHandler {
  constructor(
    private obsClient: OBSClient,
    private configManager: ConfigManager
  ) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // OBS operations
    ipcMain.handle('obs:connect', this.handleConnect.bind(this));
    ipcMain.handle('obs:disconnect', this.handleDisconnect.bind(this));
    ipcMain.handle('obs:getScenes', this.handleGetScenes.bind(this));
    ipcMain.handle('obs:setScene', this.handleSetScene.bind(this));
    ipcMain.handle('obs:getCurrentScene', this.handleGetCurrentScene.bind(this));
    ipcMain.handle('obs:getStatus', this.handleGetStatus.bind(this));

    // Configuration
    ipcMain.handle('config:get', this.handleGetConfig.bind(this));
    ipcMain.handle('config:set', this.handleSetConfig.bind(this));
    ipcMain.handle('config:reset', this.handleResetConfig.bind(this));

    // Window operations
    ipcMain.handle('window:minimize', this.handleMinimize.bind(this));
    ipcMain.handle('window:close', this.handleClose.bind(this));
    ipcMain.handle('window:setOpacity', this.handleSetOpacity.bind(this));
    ipcMain.handle('window:setAlwaysOnTop', this.handleSetAlwaysOnTop.bind(this));

    // System operations
    ipcMain.handle('system:getVersion', this.handleGetVersion.bind(this));
    ipcMain.handle('system:quit', this.handleQuit.bind(this));
  }

  private async handleConnect(): Promise<void> {
    return this.obsClient.connect();
  }

  private async handleDisconnect(): Promise<void> {
    return this.obsClient.disconnect();
  }

  private async handleGetScenes(): Promise<Scene[]> {
    return this.obsClient.getScenes();
  }

  private async handleSetScene(event: IpcMainInvokeEvent, sceneName: string): Promise<void> {
    return this.obsClient.setCurrentScene(sceneName);
  }

  private async handleGetCurrentScene(): Promise<string> {
    return this.obsClient.getCurrentScene();
  }

  private async handleGetStatus(): Promise<ConnectionStatus> {
    return {
      connected: this.obsClient.isConnected(),
      version: await this.obsClient.getVersion(),
    };
  }

  private async handleGetConfig(): Promise<UserConfig> {
    return this.configManager.getConfig();
  }

  private async handleSetConfig(event: IpcMainInvokeEvent, config: UserConfig): Promise<void> {
    return this.configManager.setConfig(config);
  }

  // Additional handlers...
}
```

### 4. Configuration Management

```typescript
// src/main/config.ts
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

export class ConfigManager {
  private configPath: string;
  private config: UserConfig;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.config = this.getDefaultConfig();
  }

  async loadConfig(): Promise<UserConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = { ...this.getDefaultConfig(), ...JSON.parse(data) };
    } catch (error) {
      // Use defaults if file doesn't exist
      console.log('Using default configuration');
    }
    return this.config;
  }

  async saveConfig(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }

  getConfig(): UserConfig {
    return this.config;
  }

  async setConfig(newConfig: UserConfig): Promise<void> {
    this.config = newConfig;
    await this.saveConfig();
  }

  private getDefaultConfig(): UserConfig {
    return {
      connection: {
        host: 'localhost',
        port: 4455,
      },
      window: {
        position: { x: 100, y: 100 },
        size: { width: 200, height: 300 },
        opacity: 0.9,
        layout: 'grid',
        alwaysOnTop: true,
      },
      buttons: {
        showIcons: false,
        showPreview: false,
        columns: 2,
      },
      shortcuts: {
        enabled: true,
        bindings: {},
      },
    };
  }
}
```

### 5. Preload Script (Security Bridge)

```typescript
// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Expose secure API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // OBS operations
  obs: {
    connect: () => ipcRenderer.invoke('obs:connect'),
    disconnect: () => ipcRenderer.invoke('obs:disconnect'),
    getScenes: () => ipcRenderer.invoke('obs:getScenes'),
    setScene: (sceneName: string) => ipcRenderer.invoke('obs:setScene', sceneName),
    getCurrentScene: () => ipcRenderer.invoke('obs:getCurrentScene'),
    getStatus: () => ipcRenderer.invoke('obs:getStatus'),
    
    // Event listeners
    onSceneChanged: (callback: (sceneName: string) => void) => {
      ipcRenderer.on('obs:sceneChanged', (_, sceneName) => callback(sceneName));
    },
    onStatusChanged: (callback: (status: ConnectionStatus) => void) => {
      ipcRenderer.on('obs:statusChanged', (_, status) => callback(status));
    },
  },

  // Configuration
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: UserConfig) => ipcRenderer.invoke('config:set', config),
    reset: () => ipcRenderer.invoke('config:reset'),
  },

  // Window operations
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close'),
    setOpacity: (opacity: number) => ipcRenderer.invoke('window:setOpacity', opacity),
    setAlwaysOnTop: (alwaysOnTop: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', alwaysOnTop),
  },

  // System
  system: {
    getVersion: () => ipcRenderer.invoke('system:getVersion'),
    quit: () => ipcRenderer.invoke('system:quit'),
  },
});

// Type definitions for renderer
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
```

## Performance Optimizations

### 1. Efficient State Management

```typescript
// src/renderer/hooks/useOBSConnection.ts
import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';

export function useOBSConnection() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentScene, setCurrentScene] = useState<string>('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  // Debounced scene updates to prevent UI flicker
  const debouncedSceneUpdate = useCallback(
    debounce((sceneName: string) => {
      setCurrentScene(sceneName);
    }, 100),
    []
  );

  useEffect(() => {
    // Setup OBS event listeners
    window.electronAPI.obs.onSceneChanged(debouncedSceneUpdate);
    window.electronAPI.obs.onStatusChanged(setStatus);

    // Initial connection
    connectToOBS();

    return () => {
      debouncedSceneUpdate.cancel();
    };
  }, [debouncedSceneUpdate]);

  const connectToOBS = async () => {
    try {
      await window.electronAPI.obs.connect();
      const scenes = await window.electronAPI.obs.getScenes();
      setScenes(scenes);
    } catch (error) {
      console.error('Failed to connect to OBS:', error);
    }
  };

  const switchScene = useCallback(async (sceneName: string) => {
    try {
      await window.electronAPI.obs.setScene(sceneName);
      // Optimistic update for immediate feedback
      setCurrentScene(sceneName);
    } catch (error) {
      console.error('Failed to switch scene:', error);
    }
  }, []);

  return {
    scenes,
    currentScene,
    status,
    switchScene,
    reconnect: connectToOBS,
  };
}
```

### 2. Virtualization for Large Scene Lists

```typescript
// src/renderer/components/VirtualizedSceneGrid.tsx
import { FixedSizeGrid as Grid } from 'react-window';
import { Scene } from '../types';

interface VirtualizedSceneGridProps {
  scenes: Scene[];
  columns: number;
  onSceneClick: (sceneName: string) => void;
}

export function VirtualizedSceneGrid({ scenes, columns, onSceneClick }: VirtualizedSceneGridProps) {
  const rowCount = Math.ceil(scenes.length / columns);
  const itemHeight = 48;
  const itemWidth = 100;

  const Cell = ({ columnIndex, rowIndex, style }) => {
    const sceneIndex = rowIndex * columns + columnIndex;
    const scene = scenes[sceneIndex];

    if (!scene) return <div style={style} />;

    return (
      <div style={style}>
        <SceneButton
          scene={scene}
          onClick={() => onSceneClick(scene.name)}
          layout="grid"
        />
      </div>
    );
  };

  return (
    <Grid
      columnCount={columns}
      columnWidth={itemWidth}
      height={Math.min(rowCount * itemHeight, 400)}
      rowCount={rowCount}
      rowHeight={itemHeight}
      width={columns * itemWidth}
    >
      {Cell}
    </Grid>
  );
}
```

### 3. Efficient Rendering with React.memo

```typescript
// src/renderer/components/SceneButton.tsx
import React, { memo } from 'react';

interface SceneButtonProps {
  scene: Scene;
  isActive: boolean;
  onClick: () => void;
  layout: LayoutType;
}

export const SceneButton = memo<SceneButtonProps>(({ 
  scene, 
  isActive, 
  onClick, 
  layout 
}) => {
  return (
    <button
      className={`scene-button ${layout} ${isActive ? 'active' : ''}`}
      onClick={onClick}
      aria-label={`Switch to ${scene.name}`}
      aria-pressed={isActive}
    >
      {scene.name}
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  return (
    prevProps.scene.name === nextProps.scene.name &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.layout === nextProps.layout
  );
});
```

This comprehensive technical implementation provides:

1. **Robust Window Management** - Handles positioning, constraints, and magnetic snapping
2. **Reliable OBS Integration** - WebSocket client with auto-reconnection
3. **Secure IPC Communication** - Proper isolation between main and renderer
4. **Efficient Configuration** - Persistent storage with defaults
5. **Performance Optimizations** - Debounced updates, memoization, virtualization
6. **Cross-Platform Support** - Platform-specific behaviors and paths

The implementation ensures smooth operation while maintaining security and performance standards expected in professional streaming environments.