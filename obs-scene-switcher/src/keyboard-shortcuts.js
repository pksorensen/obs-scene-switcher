// Keyboard Shortcuts Manager - Handles global keyboard shortcuts
class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.isEnabled = true;
        this.currentKeys = new Set();
        this.bindEvents();
        this.loadShortcuts();
    }

    bindEvents() {
        // Track key presses
        document.addEventListener('keydown', (e) => {
            if (!this.isEnabled) return;
            
            this.currentKeys.add(e.key);
            const shortcut = this.buildShortcutString(e);
            
            if (this.shortcuts.has(shortcut)) {
                e.preventDefault();
                const callback = this.shortcuts.get(shortcut);
                callback();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.currentKeys.delete(e.key);
        });

        // Clear keys when window loses focus
        window.addEventListener('blur', () => {
            this.currentKeys.clear();
        });
    }

    buildShortcutString(event) {
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

    async loadShortcuts() {
        try {
            const settings = await window.electronAPI.settings.getAll();
            const shortcuts = settings.shortcuts || {};
            
            // Clear existing shortcuts
            this.shortcuts.clear();
            
            // Register default shortcuts
            this.registerDefaultShortcuts();
            
            // Register configured shortcuts
            Object.entries(shortcuts).forEach(([action, shortcut]) => {
                if (shortcut && shortcut.trim()) {
                    this.registerShortcut(shortcut, this.getActionCallback(action));
                }
            });
        } catch (error) {
            console.error('Error loading shortcuts:', error);
        }
    }

    registerDefaultShortcuts() {
        // Window controls
        this.registerShortcut('Escape', () => {
            if (document.querySelector('.settings-panel-modal')) {
                // Close settings if open
                const settingsPanel = document.querySelector('.settings-panel-modal');
                if (settingsPanel) {
                    settingsPanel.remove();
                }
            }
        });

        this.registerShortcut('F1', () => {
            // Open help/about
            this.showHelp();
        });
    }

    registerShortcut(shortcut, callback) {
        this.shortcuts.set(shortcut, callback);
    }

    unregisterShortcut(shortcut) {
        this.shortcuts.delete(shortcut);
    }

    getActionCallback(action) {
        const callbacks = {
            toggleConnection: () => {
                const connectBtn = document.getElementById('connect-btn');
                if (connectBtn) connectBtn.click();
            },
            
            refreshScenes: () => {
                const refreshBtn = document.getElementById('refresh-scenes-btn');
                if (refreshBtn) refreshBtn.click();
            },
            
            toggleAlwaysOnTop: () => {
                const alwaysOnTopToggle = document.getElementById('always-on-top-toggle');
                if (alwaysOnTopToggle) {
                    alwaysOnTopToggle.checked = !alwaysOnTopToggle.checked;
                    alwaysOnTopToggle.dispatchEvent(new Event('change'));
                }
            },
            
            minimizeWindow: () => {
                window.electronAPI.minimizeWindow();
            },
            
            closeWindow: () => {
                window.electronAPI.closeWindow();
            },
            
            openSettings: () => {
                const settingsBtn = document.getElementById('open-advanced-settings-btn');
                if (settingsBtn) settingsBtn.click();
            },
            
            nextScene: () => {
                this.switchToNextScene();
            },
            
            prevScene: () => {
                this.switchToPreviousScene();
            },
            
            // Scene shortcuts
            scene1: () => this.switchToSceneByIndex(0),
            scene2: () => this.switchToSceneByIndex(1),
            scene3: () => this.switchToSceneByIndex(2),
            scene4: () => this.switchToSceneByIndex(3),
            scene5: () => this.switchToSceneByIndex(4),
            scene6: () => this.switchToSceneByIndex(5),
            scene7: () => this.switchToSceneByIndex(6),
            scene8: () => this.switchToSceneByIndex(7),
            scene9: () => this.switchToSceneByIndex(8),
            scene10: () => this.switchToSceneByIndex(9)
        };
        
        return callbacks[action] || (() => {
            console.warn('Unknown shortcut action:', action);
        });
    }

    switchToNextScene() {
        const sceneItems = document.querySelectorAll('.scene-item');
        const activeScene = document.querySelector('.scene-item.active');
        
        if (sceneItems.length === 0) return;
        
        let nextIndex = 0;
        if (activeScene) {
            const currentIndex = Array.from(sceneItems).indexOf(activeScene);
            nextIndex = (currentIndex + 1) % sceneItems.length;
        }
        
        sceneItems[nextIndex].click();
    }

    switchToPreviousScene() {
        const sceneItems = document.querySelectorAll('.scene-item');
        const activeScene = document.querySelector('.scene-item.active');
        
        if (sceneItems.length === 0) return;
        
        let prevIndex = sceneItems.length - 1;
        if (activeScene) {
            const currentIndex = Array.from(sceneItems).indexOf(activeScene);
            prevIndex = currentIndex === 0 ? sceneItems.length - 1 : currentIndex - 1;
        }
        
        sceneItems[prevIndex].click();
    }

    switchToSceneByIndex(index) {
        const sceneItems = document.querySelectorAll('.scene-item');
        if (sceneItems[index]) {
            sceneItems[index].click();
        }
    }

    showHelp() {
        const helpModal = document.createElement('div');
        helpModal.className = 'help-modal';
        helpModal.innerHTML = `
            <div class="help-overlay"></div>
            <div class="help-content">
                <div class="help-header">
                    <h2>OBS Scene Switcher - Help</h2>
                    <button class="help-close">&times;</button>
                </div>
                <div class="help-body">
                    <h3>Keyboard Shortcuts</h3>
                    <div class="shortcuts-help">
                        ${this.generateShortcutsHelp()}
                    </div>
                    <h3>About</h3>
                    <p>OBS Scene Switcher v1.0.0</p>
                    <p>A simple, always-on-top controller for OBS Studio.</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(helpModal);
        
        // Close button
        helpModal.querySelector('.help-close').addEventListener('click', () => {
            helpModal.remove();
        });
        
        // Overlay click
        helpModal.querySelector('.help-overlay').addEventListener('click', () => {
            helpModal.remove();
        });
        
        // Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                helpModal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    generateShortcutsHelp() {
        const shortcutDescriptions = {
            toggleConnection: 'Toggle OBS connection',
            refreshScenes: 'Refresh scenes list',
            toggleAlwaysOnTop: 'Toggle always on top',
            minimizeWindow: 'Minimize window',
            closeWindow: 'Close window',
            openSettings: 'Open settings',
            nextScene: 'Switch to next scene',
            prevScene: 'Switch to previous scene',
            scene1: 'Switch to scene 1',
            scene2: 'Switch to scene 2',
            scene3: 'Switch to scene 3',
            scene4: 'Switch to scene 4',
            scene5: 'Switch to scene 5'
        };
        
        let html = '<div class="shortcuts-grid">';
        
        for (const [shortcut, callback] of this.shortcuts) {
            const action = Object.keys(shortcutDescriptions).find(key => 
                this.getActionCallback(key) === callback
            );
            
            if (action && shortcutDescriptions[action]) {
                html += `
                    <div class="shortcut-help-item">
                        <span class="shortcut-key">${shortcut}</span>
                        <span class="shortcut-description">${shortcutDescriptions[action]}</span>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        return html;
    }

    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    isShortcutRegistered(shortcut) {
        return this.shortcuts.has(shortcut);
    }

    getAllShortcuts() {
        return Array.from(this.shortcuts.keys());
    }
}

// CSS for help modal
const helpStyles = document.createElement('style');
helpStyles.textContent = `
    .help-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .help-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
    }
    
    .help-content {
        position: relative;
        background: rgba(40, 40, 40, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        width: 500px;
        max-width: 90vw;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }
    
    .help-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        background: rgba(50, 50, 50, 0.9);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .help-header h2 {
        font-size: 18px;
        font-weight: 600;
        color: #ffffff;
        margin: 0;
    }
    
    .help-close {
        background: none;
        border: none;
        color: #ffffff;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s;
    }
    
    .help-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e74c3c;
    }
    
    .help-body {
        padding: 24px;
        color: #ffffff;
        overflow-y: auto;
        max-height: 60vh;
    }
    
    .help-body h3 {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .shortcuts-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        margin-bottom: 20px;
    }
    
    .shortcut-help-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(60, 60, 60, 0.5);
        border-radius: 6px;
        font-size: 12px;
    }
    
    .shortcut-key {
        background: rgba(255, 255, 255, 0.1);
        padding: 4px 8px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
        color: #3498db;
    }
    
    .shortcut-description {
        color: #cccccc;
    }
`;
document.head.appendChild(helpStyles);

// Initialize keyboard shortcuts when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.keyboardShortcuts = new KeyboardShortcuts();
});

// Export for use in other modules
window.KeyboardShortcuts = KeyboardShortcuts;