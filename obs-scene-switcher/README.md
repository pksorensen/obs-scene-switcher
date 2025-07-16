# OBS Scene Switcher

A lightweight, always-on-top Electron application for controlling OBS Studio scenes via WebSocket connection.

## Features

- **Always-on-top window** - Stays visible over other applications
- **Frameless design** - Custom title bar with drag support
- **Transparent background** - Blends with your desktop
- **Resizable window** - Minimum size constraints with saved position
- **OBS WebSocket integration** - Connect to OBS Studio for scene control
- **Scene switching** - Click to switch between OBS scenes
- **Connection management** - Easy connect/disconnect with saved settings
- **Real-time updates** - Scene changes reflect immediately

## Requirements

- Node.js 16 or higher
- OBS Studio with WebSocket plugin enabled
- Windows, macOS, or Linux

## Setup

1. **Install dependencies:**
   ```bash
   cd obs-scene-switcher
   npm install
   ```

2. **Enable OBS WebSocket:**
   - Open OBS Studio
   - Go to Tools → WebSocket Server Settings
   - Enable WebSocket server
   - Set port (default: 4455)
   - Set password (optional but recommended)

3. **Run the application:**
   ```bash
   npm start
   ```

## Development

Run in development mode with DevTools:
```bash
npm run dev
```

## Building

Create distributable packages:
```bash
npm run build
```

## Configuration

The application saves your connection settings and window position automatically:
- Connection settings (host, port, password)
- Window position and size
- Always-on-top preference

Configuration files are stored in the user data directory:
- Windows: `%APPDATA%/obs-scene-switcher/`
- macOS: `~/Library/Application Support/obs-scene-switcher/`
- Linux: `~/.config/obs-scene-switcher/`

## Usage

1. **Connect to OBS:**
   - Enter your OBS WebSocket server details
   - Click "Connect"

2. **Switch scenes:**
   - Connected scenes will appear in the list
   - Click any scene to switch to it
   - Current scene is highlighted

3. **Window controls:**
   - Drag the title bar to move the window
   - Use minimize/maximize/close buttons
   - Toggle "Always on Top" in settings

## Keyboard Shortcuts

- `Ctrl+Q` / `Cmd+Q` - Quit application
- `Ctrl+R` / `Cmd+R` - Refresh scenes list

## Troubleshooting

**Connection Issues:**
- Ensure OBS WebSocket server is enabled
- Check host/port settings match OBS configuration
- Verify password if set in OBS
- Check firewall settings

**Window Issues:**
- Reset window position by deleting config file
- Ensure minimum window size is respected
- Check display scaling settings

## Project Structure

```
obs-scene-switcher/
├── main.js              # Main Electron process
├── preload.js           # Preload script for secure context
├── index.html           # Main window HTML
├── package.json         # Dependencies and scripts
├── assets/
│   └── styles/
│       └── main.css     # Application styles
└── src/
    └── renderer.js      # Renderer process logic
```

## Technical Details

**Window Configuration:**
- `alwaysOnTop: true` - Keeps window above all others
- `frame: false` - Removes default window frame
- `transparent: true` - Enables background transparency
- `resizable: true` - Allows window resizing
- `minWidth: 300, minHeight: 400` - Minimum window size

**Security:**
- Context isolation enabled
- Node integration disabled
- Secure IPC communication via preload script

## License

MIT License - see LICENSE file for details