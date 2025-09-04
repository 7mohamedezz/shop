// Electron application configuration
module.exports = {
  // Window configuration
  window: {
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // Don't show until ready
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    }
  },
  
  // Development settings
  development: {
    openDevTools: true,
    disableSandbox: true,
  },
  
  // Build configuration
  build: {
    appId: 'com.mycompany.plumbingshop',
    productName: 'Plumbing Shop',
    directories: {
      output: 'dist'
    }
  }
};
