// Theme Manager - Handles theme application and updates
class ThemeManager {
    constructor() {
        this.currentTheme = null;
        this.styleElement = null;
        this.initializeTheme();
    }

    initializeTheme() {
        // Create dynamic style element
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'dynamic-theme-styles';
        document.head.appendChild(this.styleElement);
        
        // Load initial theme
        this.loadTheme();
    }

    async loadTheme() {
        try {
            const settings = await window.electronAPI.settings.getAll();
            const themeConfig = settings.theme || {};
            const layoutConfig = settings.layout || {};
            
            this.applyTheme(themeConfig, layoutConfig);
            
            // Listen for theme updates
            if (window.electronAPI.onThemeUpdate) {
                window.electronAPI.onThemeUpdate((themeConfig) => {
                    this.applyTheme(themeConfig);
                });
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        }
    }

    applyTheme(themeConfig, layoutConfig = {}) {
        this.currentTheme = themeConfig;
        
        // Generate CSS custom properties
        const cssVariables = this.generateCSSVariables(themeConfig);
        
        // Generate layout-specific styles
        const layoutStyles = this.generateLayoutStyles(layoutConfig);
        
        // Combine all styles
        const fullCSS = `
            :root {
                ${cssVariables}
            }
            
            ${layoutStyles}
            
            ${this.generateThemeStyles(themeConfig)}
        `;
        
        // Apply styles
        this.styleElement.textContent = fullCSS;
        
        // Update body class for theme switching
        document.body.className = `theme-${themeConfig.name || 'dark'}`;
        
        // Apply window transparency
        if (themeConfig.transparency !== undefined) {
            document.body.style.opacity = themeConfig.transparency;
        }
    }

    generateCSSVariables(themeConfig) {
        const defaults = {
            primaryColor: '#3498db',
            accentColor: '#2ecc71',
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            textColor: '#ffffff',
            fontSize: '12px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            borderRadius: '8px'
        };
        
        const config = { ...defaults, ...themeConfig };
        
        return Object.entries(config).map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `--theme-${cssKey}: ${value};`;
        }).join('\n            ');
    }

    generateLayoutStyles(layoutConfig) {
        let styles = '';
        
        // Compact mode
        if (layoutConfig.compactMode) {
            styles += `
                .connection-panel {
                    padding: 12px !important;
                }
                
                .scenes-container {
                    padding: 12px !important;
                }
                
                .scene-item {
                    padding: 8px !important;
                    font-size: 11px !important;
                }
                
                .title-bar {
                    height: 28px !important;
                }
                
                .title-bar-title {
                    font-size: 11px !important;
                }
            `;
        }
        
        // Scene button style
        if (layoutConfig.sceneButtonStyle === 'list') {
            styles += `
                .scenes-list {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 4px !important;
                }
                
                .scene-item {
                    border-radius: 4px !important;
                    padding: 8px 12px !important;
                }
            `;
        }
        
        // Grid columns
        if (layoutConfig.gridColumns && layoutConfig.gridColumns > 1) {
            styles += `
                .scenes-list.grid-view {
                    grid-template-columns: repeat(${layoutConfig.gridColumns}, 1fr) !important;
                }
            `;
        }
        
        // Animations
        if (!layoutConfig.animationsEnabled) {
            styles += `
                *, *::before, *::after {
                    animation-duration: 0s !important;
                    transition-duration: 0s !important;
                }
            `;
        }
        
        return styles;
    }

    generateThemeStyles(themeConfig) {
        const { name = 'dark' } = themeConfig;
        
        if (name === 'light') {
            return this.generateLightTheme();
        } else if (name === 'auto') {
            return this.generateAutoTheme();
        }
        
        return this.generateDarkTheme();
    }

    generateDarkTheme() {
        return `
            body {
                background: var(--theme-background-color);
                color: var(--theme-text-color);
                font-family: var(--theme-font-family);
                font-size: var(--theme-font-size);
            }
            
            .app-container {
                background: var(--theme-background-color);
                border-radius: var(--theme-border-radius);
            }
            
            .primary-button {
                background: var(--theme-primary-color);
                border-radius: calc(var(--theme-border-radius) / 2);
                font-size: var(--theme-font-size);
            }
            
            .secondary-button {
                border-radius: calc(var(--theme-border-radius) / 2);
                font-size: calc(var(--theme-font-size) - 1px);
            }
            
            .scene-item.active {
                background: rgba(var(--theme-primary-color-rgb), 0.3);
                border-color: var(--theme-primary-color);
            }
            
            .connection-status {
                font-size: var(--theme-font-size);
            }
            
            .form-group label {
                font-size: calc(var(--theme-font-size) - 1px);
            }
            
            .form-group input {
                font-size: var(--theme-font-size);
                border-radius: calc(var(--theme-border-radius) / 2);
            }
        `;
    }

    generateLightTheme() {
        return `
            body {
                background: rgba(250, 250, 250, 0.95);
                color: #2c3e50;
                font-family: var(--theme-font-family);
                font-size: var(--theme-font-size);
            }
            
            .app-container {
                background: rgba(255, 255, 255, 0.95);
                border: 1px solid rgba(0, 0, 0, 0.1);
                border-radius: var(--theme-border-radius);
            }
            
            .title-bar {
                background: rgba(240, 240, 240, 0.9);
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            }
            
            .title-bar-title {
                color: #2c3e50;
            }
            
            .title-bar-control {
                color: #2c3e50;
            }
            
            .title-bar-control:hover {
                background: rgba(0, 0, 0, 0.1);
            }
            
            .connection-status {
                background: rgba(245, 245, 245, 0.8);
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                color: #2c3e50;
            }
            
            .connection-panel {
                background: rgba(248, 248, 248, 0.9);
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            }
            
            .form-group label {
                color: #34495e;
            }
            
            .form-group input {
                background: rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(0, 0, 0, 0.2);
                color: #2c3e50;
            }
            
            .form-group input:focus {
                border-color: var(--theme-primary-color);
                box-shadow: 0 0 0 2px rgba(var(--theme-primary-color-rgb), 0.2);
            }
            
            .scene-item {
                background: rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(0, 0, 0, 0.1);
                color: #2c3e50;
            }
            
            .scene-item:hover {
                background: rgba(245, 245, 245, 0.9);
            }
            
            .scene-item.active {
                background: rgba(var(--theme-primary-color-rgb), 0.1);
                border-color: var(--theme-primary-color);
            }
            
            .settings-panel {
                background: rgba(245, 245, 245, 0.9);
                border-top: 1px solid rgba(0, 0, 0, 0.1);
            }
            
            .settings-toggle label {
                color: #34495e;
            }
        `;
    }

    generateAutoTheme() {
        return `
            @media (prefers-color-scheme: light) {
                ${this.generateLightTheme()}
            }
            
            @media (prefers-color-scheme: dark) {
                ${this.generateDarkTheme()}
            }
        `;
    }

    // Convert hex color to RGB values
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // Get current theme
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Apply custom CSS
    applyCustomCSS(css) {
        if (css && css.trim()) {
            const customStyleElement = document.getElementById('custom-theme-styles');
            if (customStyleElement) {
                customStyleElement.textContent = css;
            } else {
                const newStyleElement = document.createElement('style');
                newStyleElement.id = 'custom-theme-styles';
                newStyleElement.textContent = css;
                document.head.appendChild(newStyleElement);
            }
        }
    }

    // Remove custom CSS
    removeCustomCSS() {
        const customStyleElement = document.getElementById('custom-theme-styles');
        if (customStyleElement) {
            customStyleElement.remove();
        }
    }
}

// Initialize theme manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Export for use in other modules
window.ThemeManager = ThemeManager;