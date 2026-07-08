const { app, BrowserWindow } = require('electron');
const path = require('path');

const CHAT_HOSTS = ['boxy.chattersnet.nl', 'chameleon.chattersnet.nl'];

const hostOk = (url) => {
  try {
    return CHAT_HOSTS.includes(new URL(url).hostname);
  } catch (e) {
    return false;
  }
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const ses = mainWindow.webContents.session;

  // Sta ENKEL camera toe (video) voor de chattersnet-hosts.
  // Microfoon wordt bewust NIET toegestaan (radio speelt; geen mics op de chat).
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const url = (details && details.requestingUrl) || webContents.getURL();
    if (!hostOk(url)) {
      return callback(false);
    }
    if (permission === 'media') {
      const types = (details && details.mediaTypes) || [];
      // Weiger zodra er audio (microfoon) gevraagd wordt; sta camera-only toe.
      if (types.includes('audio')) {
        return callback(false);
      }
      return callback(true);
    }
    // Al de rest (locatie, notificaties, scherm delen, ...) weigeren.
    return callback(false);
  });

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const url = requestingOrigin || (details && details.requestingUrl) || (webContents && webContents.getURL());
    return permission === 'media' && hostOk(url);
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.maximize();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
