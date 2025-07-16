# Dock Positioning System

## Overview

The dock positioning system allows the OBS Scene Switcher window to be positioned and "docked" to specific screen edges with advanced features like auto-hide and screen awareness.

## Features

### Core Functionality
- **4 Dock Positions**: Top-left, top-right, bottom-left, bottom-right
- **Screen Bounds Detection**: Automatically detects screen dimensions and work area
- **Multi-Monitor Support**: Works correctly across multiple displays
- **Auto-Hide**: Window can automatically hide after a configurable delay
- **Show on Hover**: Hidden windows can be shown when cursor approaches
- **Keyboard Shortcuts**: Full keyboard control for all dock operations

### Advanced Features
- **Screen Change Detection**: Automatically adjusts position when displays are added/removed
- **Smooth Transitions**: Animated movement between dock positions
- **State Persistence**: Remembers dock state across application restarts
- **Configuration Management**: All settings stored in application config
- **IPC Communication**: Full frontend-backend communication for dock controls

## Configuration

### Default Settings
```javascript
window: {
  dock: {
    enabled: false,              // Enable dock functionality
    position: 'bottom-right',    // Default dock position
    autoHide: false,             // Auto-hide after delay
    hideDelay: 3000,             // Delay before auto-hide (ms)
    showOnHover: true,           // Show window on mouse hover
    padding: 20,                 // Distance from screen edge (pixels)
    snapToEdges: true,           // Snap window to screen edges
    rememberDockState: true      // Remember dock state on restart
  }
}
```

### Keyboard Shortcuts
- `Ctrl+D` - Toggle dock state
- `Ctrl+Shift+1` - Dock to bottom-right
- `Ctrl+Shift+2` - Dock to bottom-left
- `Ctrl+Shift+3` - Dock to top-right
- `Ctrl+Shift+4` - Dock to top-left

## API Reference

### Main Process Functions

#### `dockWindow(position)`
Docks the window to a specific screen position.

**Parameters:**
- `position` (string): One of 'top-left', 'top-right', 'bottom-left', 'bottom-right'

**Returns:** `boolean` - Success status

#### `undockWindow()`
Undocks the window and restores original position.

**Returns:** `boolean` - Success status

#### `toggleDock(position)`
Toggles between docked and undocked states.

**Parameters:**
- `position` (string): Position to dock to if currently undocked

**Returns:** `boolean` - Success status

#### `getDockState()`
Returns current dock state information.

**Returns:** `object` - Dock state object
```javascript
{
  docked: boolean,           // Whether window is docked
  position: string,          // Current dock position
  originalBounds: object,    // Original window bounds
  currentBounds: object,     // Current window bounds
  screenInfo: object,        // Screen information
  isHidden: boolean,         // Whether window is auto-hidden
  autoHide: boolean          // Whether auto-hide is enabled
}
```

#### `getScreenInfo()`
Returns screen information for current display.

**Returns:** `object` - Screen information
```javascript
{
  bounds: object,      // Full screen bounds
  workArea: object,    // Available work area
  scaleFactor: number  // Display scale factor
}
```

### IPC Handlers

#### `dock:toggle`
Toggles dock state.

**Parameters:**
- `position` (string): Position to dock to

**Returns:** `boolean` - Success status

#### `dock:dock`
Docks window to position.

**Parameters:**
- `position` (string): Dock position

**Returns:** `boolean` - Success status

#### `dock:undock`
Undocks window.

**Returns:** `boolean` - Success status

#### `dock:getState`
Gets current dock state.

**Returns:** `object` - Dock state

#### `dock:getScreenInfo`
Gets screen information.

**Returns:** `object` - Screen info

#### `dock:setPosition`
Sets dock position if already docked.

**Parameters:**
- `position` (string): New dock position

**Returns:** `boolean` - Success status

#### `dock:show`
Shows window from auto-hide.

**Returns:** `object` - Updated dock state

#### `dock:hide`
Hides window (auto-hide).

**Returns:** `object` - Updated dock state

#### `dock:toggleAutoHide`
Toggles auto-hide functionality.

**Parameters:**
- `enabled` (boolean): Enable/disable auto-hide

**Returns:** `boolean` - Success status

## Implementation Details

### Screen Position Calculations

The dock positioning system uses the following logic:

1. **Get Screen Info**: Uses Electron's `screen` module to get display information
2. **Calculate Work Area**: Considers taskbars and system UI elements
3. **Apply Padding**: Adds configurable padding from screen edges
4. **Validate Bounds**: Ensures window stays within screen boundaries

### Auto-Hide Behavior

1. **Timer-Based**: Uses `setTimeout` for delayed hiding
2. **Mouse Events**: Listens for mouse enter/leave events
3. **Edge Positioning**: Moves window partially off-screen
4. **Smooth Restoration**: Restores to dock position on show

### Multi-Monitor Support

- **Cursor Detection**: Uses cursor position to determine active display
- **Display Changes**: Listens for display configuration changes
- **Coordinate Translation**: Handles different display coordinate systems

## Error Handling

The system includes comprehensive error handling:

- **Screen Detection Failures**: Falls back to primary display
- **Invalid Positions**: Defaults to bottom-right
- **Window Access Errors**: Safely handles window destruction
- **Configuration Errors**: Uses default settings on config failure

## Performance Considerations

- **Debounced Operations**: Position changes are debounced to prevent excessive updates
- **Event Cleanup**: Properly removes event listeners on undock
- **Memory Management**: Clears timers and references to prevent leaks

## Testing

Use the included test script to verify functionality:

```bash
node test-dock.js
```

This will test:
- Position calculations across different screen configurations
- Screen bounds detection
- Auto-hide calculations
- Multi-monitor scenarios

## Troubleshooting

### Common Issues

1. **Window not docking**: Check if window is properly initialized
2. **Auto-hide not working**: Verify configuration and mouse events
3. **Multi-monitor issues**: Ensure screen detection is working
4. **Position drift**: Check for coordinate system differences

### Debug Information

Enable debug logging by setting:
```javascript
advanced: {
  enableDebugMode: true,
  logLevel: 'debug'
}
```

## Future Enhancements

- **Magnetic Edges**: Snap to screen edges when dragging
- **Smart Positioning**: Avoid overlapping with other windows
- **Gesture Support**: Touch/trackpad gestures for dock control
- **Visual Feedback**: Animations and position previews
- **Custom Positions**: User-defined dock positions beyond the 4 corners