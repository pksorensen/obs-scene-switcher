const WebSocket = require('ws');
const crypto = require('crypto');

class MockOBSServer {
  constructor() {
    this.server = null;
    this.clients = new Set();
    this.scenes = [
      { name: 'Scene 1', active: true },
      { name: 'Scene 2', active: false }
    ];
    this.password = 'test123';
    this.protocol = 'obs-websocket_0.5.0';
  }

  async start(port = 4455, options = {}) {
    if (options.scenes) {
      this.scenes = options.scenes;
    }
    if (options.password) {
      this.password = options.password;
    }

    this.server = new WebSocket.Server({ port });
    
    this.server.on('connection', (ws) => {
      this.clients.add(ws);
      
      ws.on('message', (data) => {
        this.handleMessage(ws, JSON.parse(data.toString()));
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      // Send initial handshake
      this.sendMessage(ws, {
        op: 0, // Hello
        d: {
          obsWebSocketVersion: '5.0.0',
          rpcVersion: 1,
          authentication: {
            challenge: crypto.randomBytes(32).toString('base64'),
            salt: crypto.randomBytes(32).toString('base64')
          }
        }
      });
    });

    return new Promise((resolve) => {
      this.server.on('listening', resolve);
    });
  }

  async stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.clients.clear();
  }

  handleMessage(ws, message) {
    const { op, d } = message;

    switch (op) {
      case 1: // Identify
        this.handleIdentify(ws, d);
        break;
      case 6: // Request
        this.handleRequest(ws, d);
        break;
    }
  }

  handleIdentify(ws, data) {
    const { authentication } = data;
    
    if (this.password) {
      if (!authentication || !this.verifyAuth(authentication)) {
        this.sendMessage(ws, {
          op: 2, // Identified
          d: {
            negotiatedRpcVersion: 1,
            error: 'Authentication failed'
          }
        });
        return;
      }
    }

    this.sendMessage(ws, {
      op: 2, // Identified
      d: {
        negotiatedRpcVersion: 1
      }
    });
  }

  handleRequest(ws, data) {
    const { requestType, requestId, requestData } = data;

    switch (requestType) {
      case 'GetSceneList':
        this.sendMessage(ws, {
          op: 7, // RequestResponse
          d: {
            requestType,
            requestId,
            requestStatus: {
              result: true,
              code: 100
            },
            responseData: {
              currentScene: this.scenes.find(s => s.active)?.name || '',
              scenes: this.scenes.map(s => ({ sceneName: s.name }))
            }
          }
        });
        break;

      case 'SetCurrentScene':
        this.handleSetCurrentScene(ws, requestId, requestData);
        break;

      default:
        this.sendMessage(ws, {
          op: 7, // RequestResponse
          d: {
            requestType,
            requestId,
            requestStatus: {
              result: false,
              code: 604,
              comment: 'Unknown request type'
            }
          }
        });
    }
  }

  handleSetCurrentScene(ws, requestId, requestData) {
    const { sceneName } = requestData;
    const scene = this.scenes.find(s => s.name === sceneName);

    if (!scene) {
      this.sendMessage(ws, {
        op: 7, // RequestResponse
        d: {
          requestType: 'SetCurrentScene',
          requestId,
          requestStatus: {
            result: false,
            code: 600,
            comment: 'Scene not found'
          }
        }
      });
      return;
    }

    // Update active scene
    this.scenes.forEach(s => {
      s.active = s.name === sceneName;
    });

    this.sendMessage(ws, {
      op: 7, // RequestResponse
      d: {
        requestType: 'SetCurrentScene',
        requestId,
        requestStatus: {
          result: true,
          code: 100
        }
      }
    });

    // Send scene change event
    this.broadcast({
      op: 5, // Event
      d: {
        eventType: 'CurrentSceneChanged',
        eventData: {
          sceneName
        }
      }
    });
  }

  verifyAuth(authentication) {
    // Simplified auth verification for testing
    return authentication.response === 'valid_auth_response';
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    this.clients.forEach(ws => {
      this.sendMessage(ws, message);
    });
  }

  // Helper methods for testing
  setScenes(scenes) {
    this.scenes = scenes;
    this.broadcast({
      op: 5, // Event
      d: {
        eventType: 'SceneListChanged',
        eventData: {
          scenes: this.scenes.map(s => ({ sceneName: s.name }))
        }
      }
    });
  }

  addScene(scene) {
    this.scenes.push(scene);
    this.broadcast({
      op: 5, // Event
      d: {
        eventType: 'SceneCreated',
        eventData: {
          sceneName: scene.name
        }
      }
    });
  }

  removeScene(sceneName) {
    this.scenes = this.scenes.filter(s => s.name !== sceneName);
    this.broadcast({
      op: 5, // Event
      d: {
        eventType: 'SceneRemoved',
        eventData: {
          sceneName
        }
      }
    });
  }

  renameScene(oldName, newName) {
    const scene = this.scenes.find(s => s.name === oldName);
    if (scene) {
      scene.name = newName;
      this.broadcast({
        op: 5, // Event
        d: {
          eventType: 'SceneNameChanged',
          eventData: {
            oldSceneName: oldName,
            sceneName: newName
          }
        }
      });
    }
  }
}

module.exports = { MockOBSServer };