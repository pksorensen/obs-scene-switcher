const { EventEmitter } = require('events');

class OBSConnectionDialog extends EventEmitter {
  constructor(window) {
    super();
    this.window = window;
    this.visible = false;
    this.loading = false;
    this.errorMessage = '';
  }

  async show() {
    this.visible = true;
    this.emit('shown');
    return true;
  }

  async hide() {
    this.visible = false;
    this.emit('hidden');
    return true;
  }

  async isVisible() {
    return this.visible;
  }

  async isLoading() {
    return this.loading;
  }

  async getErrorMessage() {
    return this.errorMessage;
  }

  async validateForm(formData) {
    const { host, port, password } = formData;
    
    const errors = [];
    
    if (!host || host.trim() === '') {
      errors.push('Host is required');
    }
    
    if (!port || port.trim() === '') {
      errors.push('Port is required');
    } else if (isNaN(parseInt(port))) {
      errors.push('Port must be a number');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async connect(connectionData) {
    this.loading = true;
    this.errorMessage = '';
    
    try {
      // Simulate connection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { host, port, password } = connectionData;
      
      if (port === 9999) {
        throw new Error('Connection failed: ECONNREFUSED');
      }
      
      this.loading = false;
      this.emit('connected', connectionData);
      return { success: true };
    } catch (error) {
      this.loading = false;
      this.errorMessage = error.message;
      this.emit('error', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { OBSConnectionDialog };