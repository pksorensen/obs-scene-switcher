// Main renderer script for OBS Scene Switcher
class OBSSceneSwitcher {
    constructor() {
        this.isConnected = false;
        this.currentScene = null;
        this.scenes = [];
        this.settingsUI = null;
        this.initializeUI();
        this.bindEvents();
        this.loadSettings();
        this.startStatusCheck();
    }

    initializeUI() {
        // Get DOM elements
        this.elements = {
            statusIndicator: document.getElementById('status-indicator'),
            statusText: document.getElementById('status-text'),
            connectionPanel: document.getElementById('connection-panel'),
            scenesContainer: document.getElementById('scenes-container'),
            scenesList: document.getElementById('scenes-list'),
            hostInput: document.getElementById('host-input'),
            portInput: document.getElementById('port-input'),
            passwordInput: document.getElementById('password-input'),
            connectBtn: document.getElementById('connect-btn'),
            refreshScenesBtn: document.getElementById('refresh-scenes-btn'),
            muteBtn: document.getElementById('mute-btn'),
            micMuteBtn: document.getElementById('mic-mute-btn'),
            compactModeBtn: document.getElementById('compact-mode-btn'),
            alwaysOnTopToggle: document.getElementById('always-on-top-toggle'),
            minimizeBtn: document.getElementById('minimize-btn'),
            maximizeBtn: document.getElementById('maximize-btn'),
            closeBtn: document.getElementById('close-btn'),
            gridViewBtn: document.getElementById('grid-view-btn'),
            listViewBtn: document.getElementById('list-view-btn'),
            settingsToggleBtn: document.getElementById('settings-toggle-btn'),
            settingsContent: document.getElementById('settings-content'),
            autoConnectToggle: document.getElementById('auto-connect-toggle'),
            minimizeToTrayToggle: document.getElementById('minimize-to-tray-toggle'),
            compactModeToggle: document.getElementById('compact-mode-toggle'),
            openAdvancedSettingsBtn: document.getElementById('open-advanced-settings-btn'),
            loadingOverlay: document.getElementById('loading-overlay'),
            notificationContainer: document.getElementById('notification-container')
        };
        
        // Initialize view state
        this.viewMode = 'grid';
        this.settingsExpanded = false;
        this.compactMode = false;
        this.isMuted = false;
        this.isMicMuted = false;
    }

    bindEvents() {
        // Window controls
        this.elements.minimizeBtn.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });

        this.elements.maximizeBtn.addEventListener('click', () => {
            window.electronAPI.maximizeWindow();
        });

        this.elements.closeBtn.addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });

        // Connection controls
        this.elements.connectBtn.addEventListener('click', () => {
            this.toggleConnection();
        });

        this.elements.refreshScenesBtn.addEventListener('click', () => {
            this.refreshScenes();
        });

        this.elements.muteBtn.addEventListener('click', () => {
            this.toggleMute();
        });

        this.elements.micMuteBtn.addEventListener('click', () => {
            this.toggleMicMute();
        });

        // Compact mode button in title bar
        this.elements.compactModeBtn.addEventListener('click', () => {
            this.toggleCompactMode(!this.compactMode);
            this.saveSetting('compactMode', this.compactMode);
        });

        // View controls
        this.elements.gridViewBtn.addEventListener('click', () => {
            this.setViewMode('grid');
        });
        
        this.elements.listViewBtn.addEventListener('click', () => {
            this.setViewMode('list');
        });
        
        // Settings
        this.elements.settingsToggleBtn.addEventListener('click', () => {
            this.toggleSettings();
        });
        
        this.elements.alwaysOnTopToggle.addEventListener('change', (e) => {
            window.electronAPI.setAlwaysOnTop(e.target.checked);
            this.saveSetting('alwaysOnTop', e.target.checked);
        });
        
        this.elements.autoConnectToggle.addEventListener('change', (e) => {
            this.saveSetting('autoConnect', e.target.checked);
        });
        
        this.elements.minimizeToTrayToggle.addEventListener('change', (e) => {
            this.saveSetting('minimizeToTray', e.target.checked);
        });
        
        this.elements.compactModeToggle.addEventListener('change', (e) => {
            this.toggleCompactMode(e.target.checked);
            this.saveSetting('compactMode', e.target.checked);
        });
        
        // Advanced settings button
        this.elements.openAdvancedSettingsBtn.addEventListener('click', () => {
            this.openAdvancedSettings();
        });

        // OBS WebSocket event listeners
        if (window.electronAPI.obs) {
            window.electronAPI.obs.onConnectionChanged((connected) => {
                this.updateConnectionStatus(connected);
                // Auto-refresh scenes when connection is established
                if (connected) {
                    setTimeout(() => this.refreshScenes(), 500);
                    setTimeout(() => this.checkMuteStatus(), 800);
                    setTimeout(() => this.checkMicMuteStatus(), 1000);
                }
            });

            window.electronAPI.obs.onSceneChanged((sceneName) => {
                this.updateCurrentScene(sceneName);
            });

            window.electronAPI.obs.onScenesListChanged((scenes) => {
                this.updateScenesList(scenes);
            });
        }

        // Context menu for compact mode
        this.setupCompactModeContextMenu();
    }

    async loadSettings() {
        try {
            const settings = await window.electronAPI.settings.getAll();
            
            if (settings.host) this.elements.hostInput.value = settings.host;
            if (settings.port) this.elements.portInput.value = settings.port;
            if (settings.password) this.elements.passwordInput.value = settings.password;
            if (settings.alwaysOnTop !== undefined) {
                this.elements.alwaysOnTopToggle.checked = settings.alwaysOnTop;
            }
            if (settings.autoConnect !== undefined) {
                this.elements.autoConnectToggle.checked = settings.autoConnect;
            }
            if (settings.minimizeToTray !== undefined) {
                this.elements.minimizeToTrayToggle.checked = settings.minimizeToTray;
            }
            if (settings.compactMode !== undefined) {
                this.elements.compactModeToggle.checked = settings.compactMode;
                this.toggleCompactMode(settings.compactMode);
            }
            if (settings.viewMode) {
                this.setViewMode(settings.viewMode);
            }
            
            // Auto-connect if enabled
            if (settings.autoConnect) {
                setTimeout(() => this.connect(), 1000);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSetting(key, value) {
        try {
            await window.electronAPI.settings.set(key, value);
        } catch (error) {
            console.error('Error saving setting:', error);
        }
    }

    async toggleConnection() {
        if (this.isConnected) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        const host = this.elements.hostInput.value || 'localhost';
        const port = parseInt(this.elements.portInput.value) || 4455;
        const password = this.elements.passwordInput.value || '';

        // Save connection settings
        await this.saveSetting('host', host);
        await this.saveSetting('port', port);
        await this.saveSetting('password', password);

        // Update UI to show connecting state
        this.updateConnectionStatus(false, true);
        this.elements.connectBtn.disabled = true;
        this.elements.connectBtn.textContent = 'Connecting...';

        try {
            const success = await window.electronAPI.obs.connect(host, port, password);
            
            if (success) {
                this.isConnected = true;
                this.updateConnectionStatus(true);
                this.elements.connectBtn.textContent = 'Disconnect';
                this.elements.connectionPanel.style.display = 'none';
                this.elements.scenesContainer.style.display = 'block';
                
                // Load scenes
                await this.refreshScenes();
                
                // Check mute status
                await this.checkMuteStatus();
                
                // Check mic mute status
                await this.checkMicMuteStatus();
            } else {
                throw new Error('Connection failed');
            }
        } catch (error) {
            console.error('Connection error:', error);
            this.elements.statusIndicator.className = 'status-indicator error';
            this.updateConnectionStatus(false);
            this.showNotification('Failed to connect to OBS. Please check your settings.', 'error');
        } finally {
            this.elements.connectBtn.disabled = false;
        }
    }

    async disconnect() {
        try {
            await window.electronAPI.obs.disconnect();
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.elements.connectBtn.textContent = 'Connect';
            this.elements.connectionPanel.style.display = 'block';
            this.elements.scenesContainer.style.display = 'none';
            this.scenes = [];
            this.currentScene = null;
            this.isMuted = false;
            this.isMicMuted = false;
            this.updateMuteButtonState();
            this.updateMicMuteButtonState();
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    }

    async refreshScenes() {
        if (!this.isConnected) return;

        try {
            this.showLoading(true);
            const scenes = await window.electronAPI.obs.getScenes();
            const currentScene = await window.electronAPI.obs.getCurrentScene();
            
            this.scenes = scenes;
            this.currentScene = currentScene;
            this.renderScenes();
            this.showNotification('Scenes refreshed successfully', 'success');
        } catch (error) {
            console.error('Error refreshing scenes:', error);
            this.showNotification('Failed to load scenes from OBS', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderScenes() {
        this.elements.scenesList.innerHTML = '';

        this.scenes.forEach(scene => {
            const sceneElement = document.createElement('div');
            sceneElement.className = 'scene-item';
            if (scene.sceneName === this.currentScene) {
                sceneElement.classList.add('active');
            }

            sceneElement.innerHTML = `
                <span class="scene-name">${scene.sceneName}</span>
                ${scene.sceneName === this.currentScene ? '<span class="scene-status">ACTIVE</span>' : ''}
            `;

            sceneElement.addEventListener('click', () => {
                this.switchScene(scene.sceneName);
            });

            this.elements.scenesList.appendChild(sceneElement);
        });
    }

    async switchScene(sceneName) {
        if (!this.isConnected || sceneName === this.currentScene) return;

        try {
            await window.electronAPI.obs.setCurrentScene(sceneName);
            this.currentScene = sceneName;
            this.renderScenes();
            this.showNotification(`Switched to scene: ${sceneName}`, 'success');
        } catch (error) {
            console.error('Error switching scene:', error);
            this.showNotification(`Failed to switch to scene: ${sceneName}`, 'error');
        }
    }

    updateConnectionStatus(connected, connecting = false) {
        this.isConnected = connected;
        
        if (connecting) {
            this.elements.statusIndicator.className = 'status-indicator connecting';
            this.elements.statusText.textContent = 'Connecting...';
        } else if (connected) {
            this.elements.statusIndicator.className = 'status-indicator connected';
            this.elements.statusText.textContent = 'Connected to OBS';
            this.showNotification('Connected to OBS successfully', 'success');
        } else {
            this.elements.statusIndicator.className = 'status-indicator';
            this.elements.statusText.textContent = 'Disconnected';
            if (this.isConnected) { // Only show if we were previously connected
                this.showNotification('Disconnected from OBS', 'warning');
            }
        }
    }

    updateCurrentScene(sceneName) {
        this.currentScene = sceneName;
        this.renderScenes();
    }

    updateScenesList(scenes) {
        this.scenes = scenes;
        this.renderScenes();
    }

    async toggleMute() {
        if (!this.isConnected) {
            this.showNotification('Not connected to OBS', 'error');
            return;
        }

        try {
            this.elements.muteBtn.disabled = true;
            const result = await window.electronAPI.obs.toggleMute();
            this.isMuted = result.muted;
            this.updateMuteButtonState();
            
            const statusText = this.isMuted ? 'muted' : 'unmuted';
            this.showNotification(`Audio ${statusText}`, 'info');
        } catch (error) {
            console.error('Error toggling mute:', error);
            this.showNotification('Failed to toggle mute', 'error');
        } finally {
            this.elements.muteBtn.disabled = false;
        }
    }

    async checkMuteStatus() {
        if (!this.isConnected) return;

        try {
            const result = await window.electronAPI.obs.getMuteStatus();
            this.isMuted = result.muted;
            this.updateMuteButtonState();
        } catch (error) {
            console.error('Error checking mute status:', error);
            // Don't show error notification for this as it's a background check
        }
    }

    updateMuteButtonState() {
        if (this.isMuted) {
            this.elements.muteBtn.classList.add('muted');
            this.elements.muteBtn.title = 'Unmute Audio';
        } else {
            this.elements.muteBtn.classList.remove('muted');
            this.elements.muteBtn.title = 'Mute Audio';
        }
    }

    async toggleMicMute() {
        if (!this.isConnected) {
            this.showNotification('Not connected to OBS', 'error');
            return;
        }

        try {
            this.elements.micMuteBtn.disabled = true;
            const result = await window.electronAPI.obs.toggleMicMute();
            this.isMicMuted = result.muted;
            this.updateMicMuteButtonState();
            
            const statusText = this.isMicMuted ? 'muted' : 'unmuted';
            this.showNotification(`Microphone ${statusText}`, 'info');
        } catch (error) {
            console.error('Error toggling mic mute:', error);
            this.showNotification('Failed to toggle microphone mute', 'error');
        } finally {
            this.elements.micMuteBtn.disabled = false;
        }
    }

    async checkMicMuteStatus() {
        if (!this.isConnected) return;

        try {
            const result = await window.electronAPI.obs.getMicMuteStatus();
            this.isMicMuted = result.muted;
            this.updateMicMuteButtonState();
        } catch (error) {
            console.error('Error checking mic mute status:', error);
            // Don't show error notification for this as it's a background check
        }
    }

    updateMicMuteButtonState() {
        if (this.isMicMuted) {
            this.elements.micMuteBtn.classList.add('muted');
            this.elements.micMuteBtn.title = 'Unmute Microphone';
        } else {
            this.elements.micMuteBtn.classList.remove('muted');
            this.elements.micMuteBtn.title = 'Mute Microphone';
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.elements.scenesList.className = `scenes-list ${mode}-view`;
        
        // Update button states
        this.elements.gridViewBtn.classList.toggle('active', mode === 'grid');
        this.elements.listViewBtn.classList.toggle('active', mode === 'list');
        
        // Re-render scenes with new layout
        this.renderScenes();
        
        // Save preference
        this.saveSetting('viewMode', mode);
    }
    
    toggleSettings() {
        this.settingsExpanded = !this.settingsExpanded;
        this.elements.settingsContent.classList.toggle('expanded', this.settingsExpanded);
        this.elements.settingsToggleBtn.classList.toggle('active', this.settingsExpanded);
    }
    
    toggleCompactMode(enabled) {
        this.compactMode = enabled;
        document.querySelector('.app-container').classList.toggle('compact', enabled);
        
        // Update compact mode button state
        this.elements.compactModeBtn.classList.toggle('active', enabled);
        
        // Update window minimum size via IPC
        window.electronAPI.updateCompactMode(enabled);
        
        // In compact mode, automatically handle UI state
        if (enabled) {
            // If connected, show only scenes
            if (this.isConnected) {
                this.elements.connectionPanel.style.display = 'none';
                this.elements.scenesContainer.style.display = 'block';
            } else {
                // If not connected, show a minimal connection UI or auto-try to connect
                this.tryAutoConnect();
            }
        } else {
            // In normal mode, show appropriate panels based on connection state
            if (this.isConnected) {
                this.elements.connectionPanel.style.display = 'none';
                this.elements.scenesContainer.style.display = 'block';
            } else {
                this.elements.connectionPanel.style.display = 'block';
                this.elements.scenesContainer.style.display = 'none';
            }
        }
    }
    
    async tryAutoConnect() {
        // Try to auto-connect using saved settings when in compact mode
        const settings = await window.electronAPI.settings.getAll();
        if (settings.host && settings.port) {
            setTimeout(() => {
                this.connect();
            }, 500);
        }
    }
    
    setupCompactModeContextMenu() {
        // Right-click context menu for compact mode
        document.addEventListener('contextmenu', (e) => {
            if (this.compactMode) {
                e.preventDefault();
                this.showCompactContextMenu(e.clientX, e.clientY);
            }
        });
    }
    
    showCompactContextMenu(x, y) {
        // Remove existing context menu
        const existingMenu = document.getElementById('compact-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu
        const menu = document.createElement('div');
        menu.id = 'compact-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            background: rgba(40, 40, 40, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            padding: 4px 0;
            font-size: 11px;
            z-index: 10000;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        // Menu items
        const menuItems = [];
        
        if (this.isConnected) {
            menuItems.push({
                text: 'Disconnect from OBS',
                action: () => this.disconnect()
            });
            menuItems.push({
                text: 'Refresh Scenes',
                action: () => this.refreshScenes()
            });
        } else {
            menuItems.push({
                text: 'Connect to OBS',
                action: () => this.connect()
            });
        }
        
        menuItems.push({
            text: 'Exit Compact Mode',
            action: () => {
                this.elements.compactModeToggle.checked = false;
                this.toggleCompactMode(false);
                this.saveSetting('compactMode', false);
            }
        });
        
        // Add menu items to menu
        menuItems.forEach((item, index) => {
            const menuItem = document.createElement('div');
            menuItem.style.cssText = `
                padding: 6px 12px;
                cursor: pointer;
                color: #ffffff;
                transition: background-color 0.2s ease;
            `;
            menuItem.textContent = item.text;
            
            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.backgroundColor = 'transparent';
            });
            
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Remove menu when clicking outside
        setTimeout(() => {
            const removeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', removeMenu);
                }
            };
            document.addEventListener('click', removeMenu);
        }, 100);
    }
    
    showLoading(show) {
        this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        this.elements.notificationContainer.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }

    startStatusCheck() {
        // Check connection status every 5 seconds
        setInterval(async () => {
            try {
                const status = await window.electronAPI.obs.getStatus();
                if (status.connected !== this.isConnected) {
                    this.updateConnectionStatus(status.connected);
                }
                
                // Show reconnection attempts
                if (status.reconnectAttempts > 0 && !status.connected) {
                    this.elements.statusText.textContent = 
                        `Reconnecting... (${status.reconnectAttempts}/${status.maxReconnectAttempts})`;
                }
            } catch (error) {
                console.error('Error checking status:', error);
            }
        }, 5000);
    }
    
    openAdvancedSettings() {
        if (!this.settingsUI) {
            this.settingsUI = new SettingsUI();
        }
        this.settingsUI.open();
    }
}

// Add CSS animations for error notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(-20px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OBSSceneSwitcher();
});