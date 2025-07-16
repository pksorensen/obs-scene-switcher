# OBS Integration Debug Strategies

## Overview
This document outlines debugging strategies for the OBS WebSocket integration.

## 1. Connection Issues

### Symptom: Connection Timeout
**Debug Steps:**
1. Verify OBS is running and WebSocket server is enabled
2. Check if port 4455 is open: `netstat -an | grep 4455`
3. Test with telnet: `telnet localhost 4455`
4. Check firewall settings
5. Enable connection debug logging

**Debug Code:**
```javascript
// Enable WebSocket debug
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:4455');

ws.on('open', () => console.log('Connected'));
ws.on('error', (err) => console.error('Connection error:', err));
ws.on('close', (code, reason) => console.log('Closed:', code, reason));
```

### Symptom: Authentication Failed
**Debug Steps:**
1. Verify password in OBS settings
2. Check authentication handshake
3. Validate challenge/response generation
4. Test with no password first

**Debug Code:**
```javascript
// Log authentication process
obsConnection.on('authChallenge', (challenge) => {
  console.log('Auth challenge:', challenge);
});

obsConnection.on('authResponse', (response) => {
  console.log('Auth response:', response);
});
```

## 2. Scene Management Issues

### Symptom: Scene List Not Loading
**Debug Steps:**
1. Check WebSocket connection status
2. Verify scene list request format
3. Test with minimal OBS setup
4. Check for scene name encoding issues

**Debug Code:**
```javascript
// Debug scene list request
obsConnection.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.requestType === 'GetSceneList') {
    console.log('Scene list response:', data);
  }
});
```

### Symptom: Scene Switching Fails
**Debug Steps:**
1. Verify scene name matches exactly
2. Check for special characters in scene names
3. Test with simple scene names first
4. Monitor scene change events

**Debug Code:**
```javascript
// Debug scene switching
obsConnection.on('sceneChanged', (sceneName) => {
  console.log('Scene changed to:', sceneName);
});

obsConnection.on('sceneSwitchFailed', (error) => {
  console.error('Scene switch failed:', error);
});
```

## 3. UI Issues

### Symptom: UI Not Responding
**Debug Steps:**
1. Check for JavaScript errors in DevTools
2. Verify event listeners are attached
3. Test with minimal UI first
4. Monitor memory usage

**Debug Code:**
```javascript
// Debug UI events
document.addEventListener('click', (event) => {
  console.log('UI click:', event.target);
});

// Monitor memory usage
setInterval(() => {
  console.log('Memory usage:', process.memoryUsage());
}, 5000);
```

### Symptom: Scene Buttons Not Working
**Debug Steps:**
1. Check button event handlers
2. Verify scene data is loaded
3. Test with single scene first
4. Check CSS/styling issues

**Debug Code:**
```javascript
// Debug scene button clicks
sceneButtons.forEach(button => {
  button.addEventListener('click', (event) => {
    console.log('Scene button clicked:', event.target.textContent);
  });
});
```

## 4. Performance Issues

### Symptom: Slow Scene Switching
**Debug Steps:**
1. Measure switching latency
2. Check for network delays
3. Profile WebSocket message handling
4. Test with fewer scenes

**Debug Code:**
```javascript
// Measure switching performance
const switchScene = async (sceneName) => {
  const startTime = performance.now();
  
  await obsConnection.switchScene(sceneName);
  
  const endTime = performance.now();
  console.log(`Scene switch took ${endTime - startTime}ms`);
};
```

### Symptom: Memory Leaks
**Debug Steps:**
1. Monitor heap usage over time
2. Check for unremoved event listeners
3. Profile object creation/destruction
4. Test with repeated operations

**Debug Code:**
```javascript
// Monitor memory leaks
const monitorMemory = () => {
  const usage = process.memoryUsage();
  console.log('Heap used:', usage.heapUsed / 1024 / 1024, 'MB');
};

setInterval(monitorMemory, 1000);
```

## 5. Cross-Platform Issues

### Symptom: Different Behavior on Different OS
**Debug Steps:**
1. Test on each target platform
2. Check for platform-specific APIs
3. Verify file paths and permissions
4. Test with different OBS versions

**Debug Code:**
```javascript
// Platform-specific debugging
const platform = require('os').platform();
console.log('Platform:', platform);

switch (platform) {
  case 'win32':
    // Windows-specific debug
    break;
  case 'darwin':
    // macOS-specific debug
    break;
  case 'linux':
    // Linux-specific debug
    break;
}
```

## 6. Network Issues

### Symptom: Connection Drops
**Debug Steps:**
1. Monitor WebSocket connection state
2. Check for network instability
3. Test reconnection logic
4. Verify keepalive settings

**Debug Code:**
```javascript
// Monitor connection health
const monitorConnection = () => {
  if (obsConnection.readyState === WebSocket.OPEN) {
    obsConnection.ping();
  }
};

setInterval(monitorConnection, 30000);
```

## 7. Testing Utilities

### OBS Mock Server
Use the mock server for isolated testing:
```javascript
const { MockOBSServer } = require('./mocks/obs-server');
const server = new MockOBSServer();
await server.start(4455);
```

### Debug Logging
Enable comprehensive logging:
```javascript
const debug = require('debug')('obs-integration');
debug('Connection attempt:', { host, port });
```

### Performance Profiling
Use Chrome DevTools for performance analysis:
```javascript
console.time('scene-switch');
await switchScene('Scene 1');
console.timeEnd('scene-switch');
```

## 8. Common Issues and Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| OBS Not Found | Connection refused | Install OBS, enable WebSocket |
| Wrong Password | Auth failed | Check OBS WebSocket settings |
| Scene Not Found | Switch failed | Verify scene name exactly |
| UI Frozen | No response | Check for blocking operations |
| Memory Leak | Increasing memory | Remove unused event listeners |
| Slow Performance | High latency | Optimize WebSocket handling |

## 9. Debug Environment Setup

### Development Setup
```bash
# Enable debug logging
export DEBUG=obs-integration:*

# Enable test debugging
export DEBUG_TESTS=true

# Enable coverage
export COVERAGE=true

# Set test timeout
export TEST_TIMEOUT=60000
```

### Production Debugging
```bash
# Enable production logging
export NODE_ENV=production
export LOG_LEVEL=debug

# Enable performance monitoring
export PERFORMANCE_MONITORING=true
```

## 10. Automated Debug Scripts

### Connection Test Script
```javascript
const testConnection = async () => {
  try {
    const connection = new OBSWebSocketConnection();
    await connection.connect({ host: 'localhost', port: 4455 });
    console.log('✅ Connection successful');
    
    const scenes = await connection.getScenes();
    console.log('✅ Scenes loaded:', scenes.length);
    
    await connection.disconnect();
    console.log('✅ Disconnected successfully');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
};
```

### Performance Test Script
```javascript
const testPerformance = async () => {
  const connection = new OBSWebSocketConnection();
  await connection.connect({ host: 'localhost', port: 4455 });
  
  const scenes = await connection.getScenes();
  const startTime = Date.now();
  
  for (let i = 0; i < 100; i++) {
    const randomScene = scenes[Math.floor(Math.random() * scenes.length)];
    await connection.switchScene(randomScene.name);
  }
  
  const endTime = Date.now();
  const avgTime = (endTime - startTime) / 100;
  console.log(`Average switch time: ${avgTime}ms`);
  
  await connection.disconnect();
};
```

This debug strategy document provides comprehensive troubleshooting steps for all major integration points and common issues.