#!/usr/bin/env node

/**
 * Dock Positioning Test Script
 * 
 * This script tests the dock positioning functionality for the OBS Scene Switcher
 * It simulates different dock positions and screen configurations
 */

const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

// Mock screen configurations for testing
const mockScreenConfigs = [
  {
    name: 'Single 1920x1080',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }
  },
  {
    name: 'Dual Monitor Setup',
    bounds: { x: 0, y: 0, width: 3840, height: 1080 },
    workArea: { x: 0, y: 0, width: 3840, height: 1040 }
  },
  {
    name: 'High DPI 4K',
    bounds: { x: 0, y: 0, width: 3840, height: 2160 },
    workArea: { x: 0, y: 0, width: 3840, height: 2120 }
  }
];

// Test window dimensions
const testWindow = {
  width: 400,
  height: 600
};

// Calculate dock position based on screen bounds
function calculateDockPosition(position, windowBounds, screenInfo) {
  const { workArea } = screenInfo;
  const padding = 20;
  
  let x, y;
  
  switch (position) {
    case 'top-left':
      x = workArea.x + padding;
      y = workArea.y + padding;
      break;
    case 'top-right':
      x = workArea.x + workArea.width - windowBounds.width - padding;
      y = workArea.y + padding;
      break;
    case 'bottom-left':
      x = workArea.x + padding;
      y = workArea.y + workArea.height - windowBounds.height - padding;
      break;
    case 'bottom-right':
    default:
      x = workArea.x + workArea.width - windowBounds.width - padding;
      y = workArea.y + workArea.height - windowBounds.height - padding;
      break;
  }
  
  return { x, y };
}

// Test dock positioning calculations
function testDockPositioning() {
  console.log('Testing Dock Positioning Calculations');
  console.log('=====================================');
  
  const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  
  mockScreenConfigs.forEach(screenConfig => {
    console.log(`\n--- ${screenConfig.name} ---`);
    console.log(`Screen: ${screenConfig.bounds.width}x${screenConfig.bounds.height}`);
    console.log(`Work Area: ${screenConfig.workArea.width}x${screenConfig.workArea.height}`);
    
    positions.forEach(position => {
      const coords = calculateDockPosition(position, testWindow, screenConfig);
      console.log(`${position}: (${coords.x}, ${coords.y})`);
      
      // Validate coordinates are within bounds
      const valid = coords.x >= 0 && 
                   coords.y >= 0 && 
                   coords.x + testWindow.width <= screenConfig.workArea.width &&
                   coords.y + testWindow.height <= screenConfig.workArea.height;
      
      console.log(`  Valid: ${valid ? '✓' : '✗'}`);
    });
  });
}

// Test screen bounds detection
function testScreenBounds() {
  console.log('\n\nTesting Screen Bounds Detection');
  console.log('===============================');
  
  try {
    const displays = screen.getAllDisplays();
    console.log(`Found ${displays.length} display(s)`);
    
    displays.forEach((display, index) => {
      console.log(`\nDisplay ${index + 1}:`);
      console.log(`  Bounds: ${display.bounds.width}x${display.bounds.height} at (${display.bounds.x}, ${display.bounds.y})`);
      console.log(`  Work Area: ${display.workArea.width}x${display.workArea.height} at (${display.workArea.x}, ${display.workArea.y})`);
      console.log(`  Scale Factor: ${display.scaleFactor}`);
      console.log(`  Primary: ${display.internal ? 'Yes' : 'No'}`);
    });
    
    // Test cursor position
    const cursor = screen.getCursorScreenPoint();
    const nearestDisplay = screen.getDisplayNearestPoint(cursor);
    console.log(`\nCursor at: (${cursor.x}, ${cursor.y})`);
    console.log(`Nearest display: ${nearestDisplay.bounds.width}x${nearestDisplay.bounds.height}`);
    
  } catch (error) {
    console.error('Error testing screen bounds:', error);
  }
}

// Test auto-hide calculations
function testAutoHideCalculations() {
  console.log('\n\nTesting Auto-Hide Calculations');
  console.log('==============================');
  
  const screenInfo = mockScreenConfigs[0];
  const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  
  positions.forEach(position => {
    const dockCoords = calculateDockPosition(position, testWindow, screenInfo);
    console.log(`\n${position}:`);
    console.log(`  Dock position: (${dockCoords.x}, ${dockCoords.y})`);
    
    // Calculate hide position
    let hideX = dockCoords.x;
    let hideY = dockCoords.y;
    
    switch (position) {
      case 'bottom-right':
        hideX = screenInfo.workArea.x + screenInfo.workArea.width - 5;
        break;
      case 'bottom-left':
        hideX = screenInfo.workArea.x - testWindow.width + 5;
        break;
      case 'top-right':
        hideX = screenInfo.workArea.x + screenInfo.workArea.width - 5;
        break;
      case 'top-left':
        hideX = screenInfo.workArea.x - testWindow.width + 5;
        break;
    }
    
    console.log(`  Hide position: (${hideX}, ${hideY})`);
    console.log(`  Hide offset: ${hideX - dockCoords.x} pixels`);
  });
}

// Run tests
async function runTests() {
  console.log('OBS Scene Switcher - Dock Positioning Tests');
  console.log('==========================================');
  
  // Run calculation tests
  testDockPositioning();
  testAutoHideCalculations();
  
  // Wait for app to be ready for screen tests
  if (app.isReady()) {
    testScreenBounds();
  } else {
    app.whenReady().then(() => {
      testScreenBounds();
      app.quit();
    });
  }
}

// Export for use in main application
module.exports = {
  calculateDockPosition,
  testDockPositioning,
  testScreenBounds,
  testAutoHideCalculations
};

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}