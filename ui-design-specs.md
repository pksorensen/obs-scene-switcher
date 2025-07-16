# OBS Scene Switcher - UI Design Specifications

## Component Library

### 1. SceneButton Component

```tsx
// SceneButton.tsx
interface SceneButtonProps {
  name: string;
  isActive: boolean;
  isTransitioning?: boolean;
  layout: 'grid' | 'list' | 'compact';
  icon?: string;
  shortcut?: string;
  onClick: () => void;
  onRightClick?: () => void;
}
```

**Visual States:**

```css
/* Default state */
.scene-button {
  background: #2a2a2a;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 12px 16px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

/* Hover state */
.scene-button:hover {
  background: #3a3a3a;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Active scene */
.scene-button.active {
  background: #ff6b6b;
  border-color: #ff5252;
  color: #ffffff;
}

/* Transitioning animation */
.scene-button.transitioning {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

/* Compact layout */
.scene-button.compact {
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 4px;
}

/* List layout */
.scene-button.list {
  width: 100%;
  text-align: left;
  padding: 10px 16px;
  border-radius: 4px;
  margin-bottom: 4px;
}
```

**Keyboard Shortcut Badge:**
```css
.shortcut-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-family: monospace;
  color: #aaaaaa;
}
```

### 2. TitleBar Component

```tsx
interface TitleBarProps {
  onSettings: () => void;
  onMinimize: () => void;
  onClose: () => void;
  isDragging: boolean;
}
```

**Design:**
```
┌─────────────────────────────────┐
│ ⚡ OBS Scenes    [⚙️] [―] [✕] │
└─────────────────────────────────┘
```

**CSS:**
```css
.titlebar {
  height: 32px;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  padding: 0 8px;
  -webkit-app-region: drag; /* Enable window dragging */
  user-select: none;
}

.titlebar-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 6px;
}

.titlebar-controls {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag; /* Buttons should be clickable */
}

.titlebar-button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #aaaaaa;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.titlebar-button:hover {
  background: #3a3a3a;
  color: #ffffff;
}

.titlebar-button.close:hover {
  background: #e74c3c;
  color: #ffffff;
}
```

### 3. ConnectionStatus Component

```tsx
interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  message?: string;
  onReconnect?: () => void;
}
```

**Visual States:**

```css
.connection-status {
  height: 24px;
  background: #242424;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: #aaaaaa;
  padding: 0 8px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: none;
}

/* Connected */
.status-indicator.connected {
  background: #51cf66;
  box-shadow: 0 0 4px #51cf66;
}

/* Connecting */
.status-indicator.connecting {
  background: #ffd93d;
  animation: blink 1s infinite;
}

/* Disconnected */
.status-indicator.disconnected {
  background: #ff6b6b;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.reconnect-button {
  margin-left: 8px;
  padding: 2px 8px;
  background: #3a3a3a;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  font-size: 11px;
  cursor: pointer;
}
```

### 4. SettingsPanel Component

```tsx
interface SettingsPanelProps {
  config: UserConfig;
  onSave: (config: UserConfig) => void;
  onClose: () => void;
}
```

**Layout:**
```
┌─────────────────────────────────────┐
│ Settings                        [✕] │
├─────────────────────────────────────┤
│ Connection                          │
│ ┌─────────────────────────────────┐ │
│ │ Host: [localhost            ]   │ │
│ │ Port: [4455                 ]   │ │
│ │ Pass: [••••••••             ]   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Appearance                          │
│ ┌─────────────────────────────────┐ │
│ │ Layout: [▼ Grid            ]   │ │
│ │ Opacity: [━━━━━━●━━] 90%      │ │
│ │ Columns: [2] (for grid)        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Shortcuts                           │
│ ┌─────────────────────────────────┐ │
│ │ ☑ Enable global shortcuts      │ │
│ │ Scene 1: [Ctrl+1          ]    │ │
│ │ Scene 2: [Ctrl+2          ]    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Cancel]                    [Save]  │
└─────────────────────────────────────┘
```

### 5. Responsive Behavior

**Window Resizing:**
- Minimum: 150x100px
- Maximum: 600x800px
- Grid reflows based on width
- Smooth transitions during resize

**Layout Adaptations:**

```typescript
// Grid layout column calculation
function calculateColumns(width: number): number {
  if (width < 200) return 1;
  if (width < 300) return 2;
  if (width < 450) return 3;
  return 4;
}
```

### 6. Animations & Transitions

**Window Appearance:**
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.app-container {
  animation: fadeIn 0.2s ease-out;
}
```

**Scene Switch Feedback:**
```css
@keyframes sceneSwitch {
  0% { transform: scale(1); }
  50% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.scene-button:active {
  animation: sceneSwitch 0.2s ease;
}
```

### 7. Hover Effects & Tooltips

**Scene Preview (Optional):**
```css
.scene-preview {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 160px;
  height: 90px;
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1000;
}

.scene-button:hover .scene-preview {
  opacity: 1;
}
```

### 8. Window Chrome & Borders

```css
.app-window {
  background: #1a1a1a;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  border: 1px solid #2a2a2a;
}

/* macOS style */
.platform-darwin .app-window {
  border-radius: 10px;
}

/* Windows style */
.platform-win32 .app-window {
  border-radius: 4px;
}
```

### 9. Focus States

```css
.scene-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px #ff6b6b;
}

.titlebar-button:focus {
  outline: none;
  background: #3a3a3a;
}

/* Keyboard navigation indicator */
.keyboard-nav .scene-button:focus {
  box-shadow: 0 0 0 3px #ff6b6b;
}
```

### 10. Error States

```css
.error-message {
  background: #2a1a1a;
  border: 1px solid #ff6b6b;
  color: #ff6b6b;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin: 8px;
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
```

## Interaction Patterns

### 1. Drag Behavior
- Click and hold on titlebar to drag
- Magnetic snap to screen edges (within 10px)
- Prevent dragging outside visible area

### 2. Right-Click Menu
```
┌─────────────────────┐
│ Edit Shortcut...    │
│ Rename Scene        │
│ ─────────────────── │
│ Settings...         │
│ About               │
└─────────────────────┘
```

### 3. Keyboard Navigation
- `Tab` - Move between buttons
- `Enter` - Activate scene
- `Escape` - Minimize window
- `Ctrl+,` - Open settings
- `Ctrl+Q` - Quit application

### 4. Touch/Trackpad Support
- Pinch to zoom (adjust opacity)
- Two-finger scroll (if more scenes than visible)
- Long press for right-click menu

## Accessibility Features

### 1. High Contrast Mode
```css
@media (prefers-contrast: high) {
  .scene-button {
    border: 2px solid #ffffff;
  }
  
  .scene-button.active {
    background: #ffffff;
    color: #000000;
  }
}
```

### 2. Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 3. Screen Reader Support
```html
<button 
  className="scene-button" 
  role="button"
  aria-label="Switch to Scene 1"
  aria-pressed={isActive}
  aria-keyshortcuts="Ctrl+1"
>
  Scene 1
</button>
```

## Platform-Specific Considerations

### Windows
- Respect Windows accent color
- Support Windows 11 rounded corners
- Taskbar preview on hover

### macOS
- Traffic light buttons style
- Vibrancy effects (optional)
- Mission Control integration

### Linux
- Respect GTK/Qt theme
- Support Wayland and X11
- System tray integration