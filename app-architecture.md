# OBS Scene Switcher - App Architecture & UX Design

## Overview
A minimal, floating scene switcher for OBS that stays on top of other windows, providing quick access to scene switching without alt-tabbing.

## Core Architecture

### 1. Application Structure (Electron)

```
obs-scene-switcher/
├── src/
│   ├── main/              # Main process
│   │   ├── index.ts       # Entry point
│   │   ├── window.ts      # Window management
│   │   ├── obs-client.ts  # OBS WebSocket client
│   │   ├── config.ts      # Configuration management
│   │   └── ipc-handlers.ts # IPC communication
│   ├── renderer/          # Renderer process
│   │   ├── index.html     # Main UI
│   │   ├── app.tsx        # React app root
│   │   ├── components/    # UI components
│   │   │   ├── SceneButton.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   └── ConnectionStatus.tsx
│   │   ├── hooks/         # React hooks
│   │   │   ├── useOBSConnection.ts
│   │   │   └── useScenes.ts
│   │   └── styles/        # CSS modules
│   └── shared/            # Shared types & utils
│       ├── types.ts
│       └── constants.ts
├── electron-builder.yml   # Build configuration
└── package.json
```

### 2. Main Process Responsibilities

- **Window Management**: Create frameless, always-on-top window
- **OBS Connection**: Manage WebSocket connection to OBS
- **Configuration**: Store/retrieve user preferences
- **IPC Bridge**: Handle communication between main/renderer

### 3. Renderer Process (UI)

- **React-based UI**: For reactive scene button updates
- **Minimal Chrome**: Frameless window with custom titlebar
- **Drag Behavior**: Click-and-drag on non-button areas

## UX Design Specifications

### Window Properties
```typescript
{
  width: 200,           // Compact width
  height: 'auto',       // Based on content
  frame: false,         // No window chrome
  transparent: true,    // Rounded corners support
  alwaysOnTop: true,    // Always visible
  resizable: true,      // User can resize
  minWidth: 150,
  minHeight: 100,
  skipTaskbar: true     // Not in taskbar
}
```

### Visual Design

```
┌─────────────────────────┐
│ ⚡ OBS Scenes      ⚙️ ✕ │ <- Titlebar (drag area)
├─────────────────────────┤
│ ┌─────────┐ ┌─────────┐ │
│ │ Scene 1 │ │ Scene 2 │ │ <- Scene buttons
│ └─────────┘ └─────────┘ │
│ ┌─────────┐ ┌─────────┐ │
│ │ Scene 3 │ │ Scene 4 │ │
│ └─────────┘ └─────────┘ │
│          [●]            │ <- Connection status
└─────────────────────────┘
```

### Color Scheme (Dark Theme)
```css
:root {
  --bg-primary: #1a1a1a;      /* Window background */
  --bg-secondary: #2a2a2a;    /* Button background */
  --bg-hover: #3a3a3a;        /* Button hover */
  --bg-active: #4a4a4a;       /* Active scene */
  --text-primary: #ffffff;     /* Primary text */
  --text-secondary: #aaaaaa;   /* Secondary text */
  --accent: #ff6b6b;          /* OBS red accent */
  --success: #51cf66;         /* Connected status */
  --warning: #ffd93d;         /* Connecting status */
  --error: #ff6b6b;           /* Error status */
}
```

### Button States
1. **Default**: Dark background, white text
2. **Hover**: Slightly lighter background
3. **Active Scene**: Accent color border/background
4. **Transitioning**: Pulsing animation

## Configuration System

### User Preferences
```typescript
interface UserConfig {
  connection: {
    host: string;      // Default: "localhost"
    port: number;      // Default: 4455
    password?: string; // Optional password
  };
  window: {
    position: { x: number; y: number };
    size: { width: number; height: number };
    opacity: number;   // 0.7-1.0
    layout: 'grid' | 'list' | 'compact';
  };
  buttons: {
    showIcons: boolean;
    showPreview: boolean; // Mini preview on hover
    columns: number;      // For grid layout
  };
  shortcuts: {
    enabled: boolean;
    bindings: Record<string, string>; // scene -> shortcut
  };
}
```

### Storage Location
- Windows: `%APPDATA%/obs-scene-switcher/config.json`
- macOS: `~/Library/Application Support/obs-scene-switcher/config.json`
- Linux: `~/.config/obs-scene-switcher/config.json`

## Key Features

### 1. Smart Positioning
- Remember last position
- Snap to screen edges
- Multi-monitor support
- Prevent off-screen placement

### 2. Layout Options

**Grid Layout** (Default)
```
[Scene 1] [Scene 2]
[Scene 3] [Scene 4]
```

**List Layout**
```
[Scene 1         ]
[Scene 2         ]
[Scene 3         ]
```

**Compact Layout**
```
[1][2][3][4][5]
```

### 3. Keyboard Shortcuts
- Global shortcuts for scene switching
- Configurable per scene
- Visual indicator when triggered

### 4. Connection Management
- Auto-reconnect on disconnect
- Visual connection status
- Quick reconnect button
- Settings accessible via gear icon

## Technical Implementation Details

### OBS WebSocket Integration
```typescript
// Using obs-websocket-js
class OBSClient {
  async connect(config: ConnectionConfig): Promise<void>;
  async getScenes(): Promise<Scene[]>;
  async setCurrentScene(sceneName: string): Promise<void>;
  on('CurrentProgramSceneChanged', callback: (scene: string) => void);
  on('ConnectionClosed', callback: () => void);
}
```

### IPC Communication
```typescript
// Main -> Renderer
ipcMain.handle('obs:getScenes', async () => {
  return await obsClient.getScenes();
});

ipcMain.handle('obs:switchScene', async (_, sceneName: string) => {
  return await obsClient.setCurrentScene(sceneName);
});

// Renderer -> Main
const scenes = await window.api.getScenes();
await window.api.switchScene('Scene 1');
```

### React Component Structure
```tsx
// SceneButton.tsx
interface SceneButtonProps {
  scene: Scene;
  isActive: boolean;
  layout: LayoutType;
  onClick: () => void;
}

// Main App component manages state
function App() {
  const { scenes, activeScene, switchScene } = useOBSConnection();
  const { layout, opacity } = useSettings();
  
  return (
    <div className={styles.app} style={{ opacity }}>
      <TitleBar />
      <SceneGrid 
        scenes={scenes}
        activeScene={activeScene}
        onSceneClick={switchScene}
        layout={layout}
      />
      <ConnectionStatus />
    </div>
  );
}
```

## Performance Considerations

1. **Minimal CPU Usage**
   - React with minimal re-renders
   - Debounced WebSocket updates
   - Efficient event handling

2. **Small Memory Footprint**
   - Lazy load settings panel
   - Minimal dependencies
   - No scene preview caching (optional feature)

3. **Fast Startup**
   - Quick window creation
   - Async OBS connection
   - Cached configuration

## Security Considerations

1. **Password Storage**
   - Use electron-store with encryption
   - Optional keychain integration
   - Never store in plain text

2. **WebSocket Security**
   - Support for secure WebSocket (wss://)
   - Certificate validation options
   - Connection timeout handling

## Future Enhancements

1. **Scene Preview** (Optional)
   - Mini thumbnails on hover
   - Live preview mode
   - Configurable preview size

2. **Advanced Features**
   - Scene collections support
   - Transition duration control
   - Source visibility toggles
   - Basic audio controls

3. **Theming**
   - Custom color schemes
   - Match OBS theme
   - User-defined themes

## Accessibility

1. **Keyboard Navigation**
   - Tab through buttons
   - Enter to switch scenes
   - Escape to minimize

2. **Screen Reader Support**
   - ARIA labels
   - Scene change announcements
   - Connection status updates

3. **Visual Indicators**
   - High contrast mode
   - Colorblind-friendly indicators
   - Configurable text size