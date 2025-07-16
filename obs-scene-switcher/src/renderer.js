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
                }
            });

            window.electronAPI.obs.onSceneChanged((sceneName) => {
                this.updateCurrentScene(sceneName);
            });

            window.electronAPI.obs.onScenesListChanged((scenes) => {
                this.updateScenesList(scenes);
            });
        }
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