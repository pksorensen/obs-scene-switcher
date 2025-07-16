// Configuration Manager - Handles all app settings and preferences
const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor(userDataPath) {
        this.userDataPath = userDataPath;
        this.configPath = path.join(userDataPath, 'config.json');
        this.backupPath = path.join(userDataPath, 'config.backup.json');
        this.config = this.loadConfig();
        this.watchers = new Map();
        this.debounceTimeout = null;
    }

    // Default configuration structure
    getDefaultConfig() {
        return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            
            // OBS Connection Settings
            connection: {
                host: 'localhost',
                port: 4455,
                password: '',
                autoConnect: false,
                reconnectAttempts: 3,
                reconnectDelay: 2000,
                connectionTimeout: 5000
            },
            
            // Window Settings
            window: {
                bounds: {
                    width: 400,
                    height: 600,
                    x: undefined,
                    y: undefined
                },
                alwaysOnTop: true,
                startMinimized: false,
                rememberPosition: true,
                rememberSize: true,
                transparency: 0.95,
                minWidth: 300,
                minHeight: 400
            },
            
            // Theme and Appearance
            theme: {
                name: 'dark',
                primaryColor: '#3498db',
                accentColor: '#2ecc71',
                backgroundColor: 'rgba(30, 30, 30, 0.95)',
                textColor: '#ffffff',
                fontSize: 12,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                borderRadius: 8,
                customCSS: ''
            },
            
            // Layout Settings
            layout: {
                showStatusBar: true,
                showSettingsPanel: true,
                compactMode: false,
                sceneButtonStyle: 'card', // 'card' or 'list'
                showScenePreview: false,
                animationsEnabled: true,
                gridColumns: 1
            },
            
            // Keyboard Shortcuts
            shortcuts: {
                toggleConnection: 'Ctrl+Space',
                refreshScenes: 'F5',
                toggleAlwaysOnTop: 'Ctrl+T',
                minimizeWindow: 'Ctrl+M',
                closeWindow: 'Ctrl+W',
                openSettings: 'Ctrl+,',
                scene1: 'F1',
                scene2: 'F2',
                scene3: 'F3',
                scene4: 'F4',
                scene5: 'F5',
                scene6: 'F6',
                scene7: 'F7',
                scene8: 'F8',
                scene9: 'F9',
                scene10: 'F10',
                nextScene: 'Ctrl+Right',
                prevScene: 'Ctrl+Left'
            },
            
            // Notification Settings
            notifications: {
                enabled: true,
                showConnectionStatus: true,
                showSceneChanges: true,
                showErrors: true,
                duration: 3000,
                position: 'top-center', // 'top-left', 'top-center', 'top-right', etc.
                sounds: false
            },
            
            // Performance Settings
            performance: {
                updateInterval: 1000,
                enableHardwareAcceleration: true,
                lowLatencyMode: false,
                maxFPS: 60,
                enableGPUAcceleration: true
            },
            
            // Advanced Settings
            advanced: {
                enableDebugMode: false,
                enableTelemetry: true,
                autoUpdateCheck: true,
                experimentalFeatures: false,
                logLevel: 'info', // 'debug', 'info', 'warn', 'error'
                maxLogSize: 10 * 1024 * 1024 // 10MB
            },
            
            // Scene Management
            scenes: {
                rememberLastScene: true,
                autoSwitchDelay: 0,
                confirmSceneSwitch: false,
                enableSceneHotkeys: true,
                sceneTransitionDuration: 300,
                customSceneNames: {},
                hiddenScenes: []
            }
        };
    }

    // Load configuration from file
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const loadedConfig = JSON.parse(configData);
                
                // Merge with defaults to ensure all keys exist
                const defaultConfig = this.getDefaultConfig();
                const mergedConfig = this.deepMerge(defaultConfig, loadedConfig);
                
                // Update version if needed
                if (mergedConfig.version !== defaultConfig.version) {
                    mergedConfig.version = defaultConfig.version;
                    mergedConfig.lastUpdated = new Date().toISOString();
                }
                
                return mergedConfig;
            }
        } catch (error) {
            console.error('Error loading config:', error);
            
            // Try to load backup
            if (fs.existsSync(this.backupPath)) {
                try {
                    const backupData = fs.readFileSync(this.backupPath, 'utf8');
                    const backupConfig = JSON.parse(backupData);
                    console.log('Loaded configuration from backup');
                    return this.deepMerge(this.getDefaultConfig(), backupConfig);
                } catch (backupError) {
                    console.error('Error loading backup config:', backupError);
                }
            }
        }
        
        return this.getDefaultConfig();
    }

    // Save configuration to file
    saveConfig() {
        try {
            // Create backup before saving
            if (fs.existsSync(this.configPath)) {
                fs.copyFileSync(this.configPath, this.backupPath);
            }
            
            // Update timestamp
            this.config.lastUpdated = new Date().toISOString();
            
            // Ensure directory exists
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            // Save with pretty formatting
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
            
            // Notify watchers
            this.notifyWatchers();
            
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    // Debounced save to prevent too frequent writes
    debouncedSave() {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        
        this.debounceTimeout = setTimeout(() => {
            this.saveConfig();
        }, 500);
    }

    // Get configuration value by path
    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current === null || current === undefined || !current.hasOwnProperty(key)) {
                return defaultValue;
            }
            current = current[key];
        }
        
        return current;
    }

    // Set configuration value by path
    set(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
        this.debouncedSave();
        
        return true;
    }

    // Get all configuration
    getAll() {
        return { ...this.config };
    }

    // Update multiple values at once
    update(updates) {
        const mergedConfig = this.deepMerge(this.config, updates);
        this.config = mergedConfig;
        this.debouncedSave();
        return true;
    }

    // Reset to default configuration
    reset() {
        this.config = this.getDefaultConfig();
        this.saveConfig();
        return true;
    }

    // Export configuration to file
    exportConfig(exportPath) {
        try {
            const exportData = {
                ...this.config,
                exportedAt: new Date().toISOString(),
                exportVersion: '1.0.0'
            };
            
            fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Error exporting config:', error);
            return false;
        }
    }

    // Import configuration from file
    importConfig(importPath) {
        try {
            const importData = fs.readFileSync(importPath, 'utf8');
            const importedConfig = JSON.parse(importData);
            
            // Validate imported config
            if (!this.validateConfig(importedConfig)) {
                throw new Error('Invalid configuration format');
            }
            
            // Merge with current config
            this.config = this.deepMerge(this.getDefaultConfig(), importedConfig);
            this.saveConfig();
            
            return true;
        } catch (error) {
            console.error('Error importing config:', error);
            return false;
        }
    }

    // Validate configuration structure
    validateConfig(config) {
        const required = ['version', 'connection', 'window', 'theme'];
        return required.every(key => config.hasOwnProperty(key));
    }

    // Deep merge two objects
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    // Watch for configuration changes
    watch(path, callback) {
        if (!this.watchers.has(path)) {
            this.watchers.set(path, new Set());
        }
        this.watchers.get(path).add(callback);
    }

    // Remove watcher
    unwatch(path, callback) {
        if (this.watchers.has(path)) {
            this.watchers.get(path).delete(callback);
            if (this.watchers.get(path).size === 0) {
                this.watchers.delete(path);
            }
        }
    }

    // Notify watchers of changes
    notifyWatchers() {
        for (const [path, callbacks] of this.watchers) {
            const value = this.get(path);
            for (const callback of callbacks) {
                try {
                    callback(value, path);
                } catch (error) {
                    console.error('Error in config watcher:', error);
                }
            }
        }
    }

    // Get configuration schema for validation
    getSchema() {
        return {
            type: 'object',
            properties: {
                version: { type: 'string' },
                connection: {
                    type: 'object',
                    properties: {
                        host: { type: 'string' },
                        port: { type: 'number', minimum: 1, maximum: 65535 },
                        password: { type: 'string' },
                        autoConnect: { type: 'boolean' },
                        reconnectAttempts: { type: 'number', minimum: 0 },
                        reconnectDelay: { type: 'number', minimum: 0 },
                        connectionTimeout: { type: 'number', minimum: 1000 }
                    }
                },
                window: {
                    type: 'object',
                    properties: {
                        bounds: {
                            type: 'object',
                            properties: {
                                width: { type: 'number', minimum: 200 },
                                height: { type: 'number', minimum: 300 },
                                x: { type: ['number', 'null'] },
                                y: { type: ['number', 'null'] }
                            }
                        },
                        alwaysOnTop: { type: 'boolean' },
                        rememberPosition: { type: 'boolean' },
                        rememberSize: { type: 'boolean' }
                    }
                }
            },
            required: ['version', 'connection', 'window']
        };
    }
}

module.exports = ConfigManager;