const WebSocket = require('ws');
const { EventEmitter } = require('events');

class OBSWebSocketConnection extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async connect(options) {
    const { host = 'localhost', port = 4444, password = '', timeout = 5000 } = options;
    
    try {
      this.ws = new WebSocket(`ws://${host}:${port}`);
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, timeout);

        this.ws.on('open', () => {
          clearTimeout(timeoutId);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve({ success: true });
        });

        this.ws.on('error', (error) => {
          clearTimeout(timeoutId);
          this.connected = false;
          resolve({ success: false, error: error.message });
        });

        this.ws.on('message', (data) => {
          this.handleMessage(JSON.parse(data.toString()));
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.emit('disconnected');
        });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }

  async getScenes() {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      this.pendingRequests.set(requestId, { resolve, reject });
      
      this.ws.send(JSON.stringify({
        op: 6,
        d: {
          requestType: 'GetSceneList',
          requestId
        }
      }));
    });
  }

  async switchScene(sceneName) {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      this.pendingRequests.set(requestId, { resolve, reject });
      
      this.ws.send(JSON.stringify({
        op: 6,
        d: {
          requestType: 'SetCurrentScene',
          requestId,
          requestData: { sceneName }
        }
      }));
    });
  }

  handleMessage(message) {
    const { op, d } = message;

    switch (op) {
      case 0: // Hello
        this.handleHello(d);
        break;
      case 7: // RequestResponse
        this.handleRequestResponse(d);
        break;
      case 5: // Event
        this.handleEvent(d);
        break;
    }
  }

  handleHello(data) {
    // Send identify
    this.ws.send(JSON.stringify({
      op: 1,
      d: {
        rpcVersion: 1
      }
    }));
  }

  handleRequestResponse(data) {
    const { requestId, requestStatus, responseData } = data;
    const request = this.pendingRequests.get(requestId);

    if (request) {
      this.pendingRequests.delete(requestId);
      
      if (requestStatus.result) {
        if (data.requestType === 'GetSceneList') {
          const scenes = responseData.scenes.map(scene => ({
            name: scene.sceneName,
            active: scene.sceneName === responseData.currentScene
          }));
          request.resolve(scenes);
        } else {
          request.resolve({ success: true });
        }
      } else {
        request.reject(new Error(requestStatus.comment || 'Request failed'));
      }
    }
  }

  handleEvent(data) {
    const { eventType, eventData } = data;
    
    switch (eventType) {
      case 'CurrentSceneChanged':
        this.emit('sceneChanged', eventData.sceneName);
        break;
      case 'SceneCreated':
        this.emit('sceneAdded', eventData);
        break;
      case 'SceneRemoved':
        this.emit('sceneRemoved', eventData.sceneName);
        break;
      case 'SceneNameChanged':
        this.emit('sceneRenamed', eventData.oldSceneName, eventData.sceneName);
        break;
    }
  }

  generateRequestId() {
    return ++this.requestId;
  }
}

module.exports = { OBSWebSocketConnection };