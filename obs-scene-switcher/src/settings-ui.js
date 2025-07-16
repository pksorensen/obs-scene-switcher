// Settings UI - Manages the settings panel and validation
class SettingsUI {
    constructor() {
        this.isOpen = false;
        this.currentTab = 'connection';
        this.settingsPanel = null;
        this.overlay = null;
        this.validators = new Map();
        this.initializeValidators();
    }

    // Initialize field validators
    initializeValidators() {
        this.validators.set('connection.host', (value) => {
            if (!value || value.trim() === '') return 'Host is required';
            const hostRegex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^localhost$/;
            if (!hostRegex.test(value)) return 'Invalid host format';
            return null;
        });

        this.validators.set('connection.port', (value) => {
            const port = parseInt(value);
            if (isNaN(port) || port < 1 || port > 65535) return 'Port must be between 1 and 65535';
            return null;
        });

        this.validators.set('window.bounds.width', (value) => {
            const width = parseInt(value);
            if (isNaN(width) || width < 300) return 'Width must be at least 300px';
            return null;
        });

        this.validators.set('window.bounds.height', (value) => {
            const height = parseInt(value);
            if (isNaN(height) || height < 400) return 'Height must be at least 400px';
            return null;
        });

        this.validators.set('theme.fontSize', (value) => {
            const fontSize = parseInt(value);
            if (isNaN(fontSize) || fontSize < 8 || fontSize > 24) return 'Font size must be between 8 and 24';
            return null;
        });

        this.validators.set('shortcuts.*', (value) => {
            if (!value || value.trim() === '') return 'Shortcut cannot be empty';
            const validKeys = /^(Ctrl|Alt|Shift|Meta)(\+(Ctrl|Alt|Shift|Meta))*\+([A-Za-z0-9]|F[1-9]|F1[0-2]|Space|Enter|Tab|Escape|Delete|Backspace|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right)$/;
            if (!validKeys.test(value)) return 'Invalid shortcut format';
            return null;
        });
    }

    // Create settings panel HTML
    createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'settings-panel';
        panel.className = 'settings-panel-modal';
        panel.innerHTML = `
            <div class="settings-overlay" id="settings-overlay"></div>
            <div class="settings-container">
                <div class="settings-header">
                    <h2>Settings</h2>
                    <button class="settings-close" id="settings-close">&times;</button>
                </div>
                
                <div class="settings-tabs">
                    <button class="settings-tab active" data-tab="connection">Connection</button>
                    <button class="settings-tab" data-tab="window">Window</button>
                    <button class="settings-tab" data-tab="theme">Theme</button>
                    <button class="settings-tab" data-tab="shortcuts">Shortcuts</button>
                    <button class="settings-tab" data-tab="advanced">Advanced</button>
                </div>
                
                <div class="settings-content">
                    <div class="settings-tab-content active" data-tab="connection">
                        <div class="settings-section">
                            <h3>OBS Connection</h3>
                            <div class="settings-field">
                                <label for="setting-host">WebSocket Host</label>
                                <input type="text" id="setting-host" data-path="connection.host" placeholder="localhost">
                                <span class="field-error" id="error-connection.host"></span>
                            </div>
                            <div class="settings-field">
                                <label for="setting-port">WebSocket Port</label>
                                <input type="number" id="setting-port" data-path="connection.port" min="1" max="65535" placeholder="4455">
                                <span class="field-error" id="error-connection.port"></span>
                            </div>
                            <div class="settings-field">
                                <label for="setting-password">WebSocket Password</label>
                                <input type="password" id="setting-password" data-path="connection.password" placeholder="Optional">
                            </div>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-auto-connect" data-path="connection.autoConnect">
                                    Auto-connect on startup
                                </label>
                            </div>
                            <div class="settings-field">
                                <label for="setting-reconnect-attempts">Reconnect Attempts</label>
                                <input type="number" id="setting-reconnect-attempts" data-path="connection.reconnectAttempts" min="0" max="10">
                            </div>
                            <div class="settings-field">
                                <label for="setting-reconnect-delay">Reconnect Delay (ms)</label>
                                <input type="number" id="setting-reconnect-delay" data-path="connection.reconnectDelay" min="500" max="10000">
                            </div>
                        </div>
                    </div>
                    
                    <div class="settings-tab-content" data-tab="window">
                        <div class="settings-section">
                            <h3>Window Behavior</h3>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-always-on-top" data-path="window.alwaysOnTop">
                                    Always on Top
                                </label>
                            </div>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-remember-position" data-path="window.rememberPosition">
                                    Remember Window Position
                                </label>
                            </div>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-remember-size" data-path="window.rememberSize">
                                    Remember Window Size
                                </label>
                            </div>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-start-minimized" data-path="window.startMinimized">
                                    Start Minimized
                                </label>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h3>Window Size</h3>
                            <div class="settings-field">
                                <label for="setting-width">Width (px)</label>
                                <input type="number" id="setting-width" data-path="window.bounds.width" min="300" max="2000">
                                <span class="field-error" id="error-window.bounds.width"></span>
                            </div>
                            <div class="settings-field">
                                <label for="setting-height">Height (px)</label>
                                <input type="number" id="setting-height" data-path="window.bounds.height" min="400" max="2000">
                                <span class="field-error" id="error-window.bounds.height"></span>
                            </div>
                            <div class="settings-field">
                                <label for="setting-transparency">Transparency</label>
                                <input type="range" id="setting-transparency" data-path="window.transparency" min="0.5" max="1" step="0.05">
                                <span id="transparency-value">0.95</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="settings-tab-content" data-tab="theme">
                        <div class="settings-section">
                            <h3>Appearance</h3>
                            <div class="settings-field">
                                <label for="setting-theme-name">Theme</label>
                                <select id="setting-theme-name" data-path="theme.name">
                                    <option value="dark">Dark</option>
                                    <option value="light">Light</option>
                                    <option value="auto">Auto</option>
                                </select>
                            </div>
                            <div class="settings-field">
                                <label for="setting-primary-color">Primary Color</label>
                                <input type="color" id="setting-primary-color" data-path="theme.primaryColor">
                            </div>
                            <div class="settings-field">
                                <label for="setting-accent-color">Accent Color</label>
                                <input type="color" id="setting-accent-color" data-path="theme.accentColor">
                            </div>
                            <div class="settings-field">
                                <label for="setting-font-size">Font Size</label>
                                <input type="number" id="setting-font-size" data-path="theme.fontSize" min="8" max="24">
                                <span class="field-error" id="error-theme.fontSize"></span>
                            </div>
                            <div class="settings-field">
                                <label for="setting-font-family">Font Family</label>
                                <input type="text" id="setting-font-family" data-path="theme.fontFamily">
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h3>Layout</h3>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-compact-mode" data-path="layout.compactMode">
                                    Compact Mode
                                </label>
                            </div>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-animations" data-path="layout.animationsEnabled">
                                    Enable Animations
                                </label>
                            </div>
                            <div class="settings-field">
                                <label for="setting-scene-style">Scene Button Style</label>
                                <select id="setting-scene-style" data-path="layout.sceneButtonStyle">
                                    <option value="card">Card</option>
                                    <option value="list">List</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="settings-tab-content" data-tab="shortcuts">
                        <div class="settings-section">
                            <h3>Keyboard Shortcuts</h3>
                            <div class="shortcuts-grid">
                                <div class="shortcut-item">
                                    <label>Toggle Connection</label>
                                    <input type="text" data-path="shortcuts.toggleConnection" class="shortcut-input">
                                </div>
                                <div class="shortcut-item">
                                    <label>Refresh Scenes</label>
                                    <input type="text" data-path="shortcuts.refreshScenes" class="shortcut-input">
                                </div>
                                <div class="shortcut-item">
                                    <label>Toggle Always on Top</label>
                                    <input type="text" data-path="shortcuts.toggleAlwaysOnTop" class="shortcut-input">
                                </div>
                                <div class="shortcut-item">
                                    <label>Open Settings</label>
                                    <input type="text" data-path="shortcuts.openSettings" class="shortcut-input">
                                </div>
                                <div class="shortcut-item">
                                    <label>Next Scene</label>
                                    <input type="text" data-path="shortcuts.nextScene" class="shortcut-input">
                                </div>
                                <div class="shortcut-item">
                                    <label>Previous Scene</label>
                                    <input type="text" data-path="shortcuts.prevScene" class="shortcut-input">
                                </div>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h3>Scene Shortcuts</h3>
                            <div class="shortcuts-grid">
                                <div class="shortcut-item">
                                    <label>Scene 1</label>
                                    <input type="text" data-path="shortcuts.scene1" class="shortcut-input">
                                </div>
                                <div class="shortcut-item">
                                    <label>Scene 2</label>
                                    <input type="text" data-path="shortcuts.scene2" class="shortcut-input">
                                </div>
                                <div class="shortcut-item">
                                    <label>Scene 3</label>
                                    <input type="text" data-path="shortcuts.scene3" class="shortcut-input">
                                </div>
                                <div class="shortcut-item">
                                    <label>Scene 4</label>
                                    <input type="text" data-path="shortcuts.scene4" class="shortcut-input">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="settings-tab-content" data-tab="advanced">
                        <div class="settings-section">
                            <h3>Performance</h3>
                            <div class="settings-field">
                                <label for="setting-update-interval">Update Interval (ms)</label>
                                <input type="number" id="setting-update-interval" data-path="performance.updateInterval" min="100" max="5000">
                            </div>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-hardware-acceleration" data-path="performance.enableHardwareAcceleration">
                                    Enable Hardware Acceleration
                                </label>
                            </div>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-low-latency" data-path="performance.lowLatencyMode">
                                    Low Latency Mode
                                </label>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h3>Debug</h3>
                            <div class="settings-field">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="setting-debug-mode" data-path="advanced.enableDebugMode">
                                    Enable Debug Mode
                                </label>
                            </div>
                            <div class="settings-field">
                                <label for="setting-log-level">Log Level</label>
                                <select id="setting-log-level" data-path="advanced.logLevel">
                                    <option value="debug">Debug</option>
                                    <option value="info">Info</option>
                                    <option value="warn">Warning</option>
                                    <option value="error">Error</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-footer">
                    <div class="settings-actions">
                        <button id="settings-reset" class="settings-btn secondary">Reset to Defaults</button>
                        <button id="settings-export" class="settings-btn secondary">Export Config</button>
                        <button id="settings-import" class="settings-btn secondary">Import Config</button>
                    </div>
                    <div class="settings-main-actions">
                        <button id="settings-cancel" class="settings-btn secondary">Cancel</button>
                        <button id="settings-save" class="settings-btn primary">Save</button>
                    </div>
                </div>
            </div>
        `;
        
        return panel;
    }

    // Open settings panel
    async open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.settingsPanel = this.createSettingsPanel();
        document.body.appendChild(this.settingsPanel);
        
        await this.loadSettings();
        this.bindEvents();
        
        // Focus first input
        const firstInput = this.settingsPanel.querySelector('input, select');
        if (firstInput) firstInput.focus();
    }

    // Close settings panel
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        if (this.settingsPanel) {
            this.settingsPanel.remove();
            this.settingsPanel = null;
        }
    }

    // Load current settings into form
    async loadSettings() {
        try {
            const settings = await window.electronAPI.settings.getAll();
            
            // Populate form fields
            const inputs = this.settingsPanel.querySelectorAll('[data-path]');
            inputs.forEach(input => {
                const path = input.dataset.path;
                const value = this.getValueByPath(settings, path);
                
                if (input.type === 'checkbox') {
                    input.checked = Boolean(value);
                } else if (input.type === 'range') {
                    input.value = value;
                    const display = this.settingsPanel.querySelector(`#${input.id.replace('setting-', '')}-value`);
                    if (display) display.textContent = value;
                } else {
                    input.value = value || '';
                }
            });
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    // Save settings from form
    async saveSettings() {
        const updates = {};
        const inputs = this.settingsPanel.querySelectorAll('[data-path]');
        let hasErrors = false;

        // Clear previous errors
        this.settingsPanel.querySelectorAll('.field-error').forEach(error => {
            error.textContent = '';
        });

        // Validate and collect values
        inputs.forEach(input => {
            const path = input.dataset.path;
            let value;
            
            if (input.type === 'checkbox') {
                value = input.checked;
            } else if (input.type === 'number' || input.type === 'range') {
                value = parseFloat(input.value);
            } else {
                value = input.value;
            }

            // Validate field
            const error = this.validateField(path, value);
            if (error) {
                hasErrors = true;
                const errorElement = this.settingsPanel.querySelector(`#error-${path}`);
                if (errorElement) {
                    errorElement.textContent = error;
                }
            }

            this.setValueByPath(updates, path, value);
        });

        if (hasErrors) {
            this.showNotification('Please fix validation errors before saving', 'error');
            return false;
        }

        try {
            await window.electronAPI.settings.updateAll(updates);
            this.showNotification('Settings saved successfully', 'success');
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Error saving settings', 'error');
            return false;
        }
    }

    // Validate individual field
    validateField(path, value) {
        const validator = this.validators.get(path) || this.validators.get(path.replace(/\.\d+$/, '.*'));
        if (validator) {
            return validator(value);
        }
        return null;
    }

    // Bind event listeners
    bindEvents() {
        // Tab switching
        this.settingsPanel.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Close button
        this.settingsPanel.querySelector('#settings-close').addEventListener('click', () => {
            this.close();
        });

        // Overlay click
        this.settingsPanel.querySelector('#settings-overlay').addEventListener('click', () => {
            this.close();
        });

        // Range input updates
        this.settingsPanel.querySelectorAll('input[type="range"]').forEach(range => {
            range.addEventListener('input', () => {
                const valueDisplay = this.settingsPanel.querySelector(`#${range.id.replace('setting-', '')}-value`);
                if (valueDisplay) {
                    valueDisplay.textContent = range.value;
                }
            });
        });

        // Shortcut input handling
        this.settingsPanel.querySelectorAll('.shortcut-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                e.preventDefault();
                const shortcut = this.recordShortcut(e);
                input.value = shortcut;
            });
        });

        // Action buttons
        this.settingsPanel.querySelector('#settings-save').addEventListener('click', async () => {
            if (await this.saveSettings()) {
                this.close();
            }
        });

        this.settingsPanel.querySelector('#settings-cancel').addEventListener('click', () => {
            this.close();
        });

        this.settingsPanel.querySelector('#settings-reset').addEventListener('click', async () => {
            if (confirm('Are you sure you want to reset all settings to defaults?')) {
                await this.resetSettings();
            }
        });

        this.settingsPanel.querySelector('#settings-export').addEventListener('click', () => {
            this.exportSettings();
        });

        this.settingsPanel.querySelector('#settings-import').addEventListener('click', () => {
            this.importSettings();
        });
    }

    // Switch between tabs
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        this.settingsPanel.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update tab content
        this.settingsPanel.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });
    }

    // Record keyboard shortcut
    recordShortcut(event) {
        const parts = [];
        
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        if (event.metaKey) parts.push('Meta');
        
        const key = event.key;
        if (key !== 'Control' && key !== 'Alt' && key !== 'Shift' && key !== 'Meta') {
            parts.push(key);
        }
        
        return parts.join('+');
    }

    // Reset settings to defaults
    async resetSettings() {
        try {
            await window.electronAPI.settings.reset();
            await this.loadSettings();
            this.showNotification('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showNotification('Error resetting settings', 'error');
        }
    }

    // Export settings to file
    async exportSettings() {
        try {
            const result = await window.electronAPI.settings.export();
            if (result.success) {
                this.showNotification('Settings exported successfully', 'success');
            } else {
                this.showNotification('Error exporting settings', 'error');
            }
        } catch (error) {
            console.error('Error exporting settings:', error);
            this.showNotification('Error exporting settings', 'error');
        }
    }

    // Import settings from file
    async importSettings() {
        try {
            const result = await window.electronAPI.settings.import();
            if (result.success) {
                await this.loadSettings();
                this.showNotification('Settings imported successfully', 'success');
            } else {
                this.showNotification('Error importing settings', 'error');
            }
        } catch (error) {
            console.error('Error importing settings:', error);
            this.showNotification('Error importing settings', 'error');
        }
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `settings-notification ${type}`;
        notification.textContent = message;
        
        this.settingsPanel.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Utility: Get value by path
    getValueByPath(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    // Utility: Set value by path
    setValueByPath(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }
}

// Export for use in renderer
window.SettingsUI = SettingsUI;