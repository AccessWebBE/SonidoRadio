const { app, BrowserWindow, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const {
  CHAT_URL,
  isAllowedChatUrl,
  isCameraCheck,
  isCameraRequest,
  isSafeExternalUrl,
} = require('./policies');
const { configureAutoUpdates } = require('./updater');

const APP_ID = 'be.accessweb.sonido';
const ERROR_PAGE = path.join(__dirname, 'index.html');
const FORCE_CLOSE_DELAY_MS = 3_000;

let mainWindow = null;
let showingConnectionError = false;

app.setAppUserModelId(APP_ID);

const openExternal = (url) => {
  if (!isSafeExternalUrl(url)) {
    return;
  }

  shell.openExternal(url).catch((error) => {
    console.error('Kon externe link niet openen:', error);
  });
};

const showConnectionError = async (window) => {
  if (showingConnectionError || window.isDestroyed()) {
    return;
  }

  showingConnectionError = true;
  try {
    await window.loadFile(ERROR_PAGE);
  } catch (error) {
    console.error('Kon de verbindingsfout niet tonen:', error);
  }
};

const configurePermissions = (session) => {
  session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.securityOrigin || details.requestingUrl || webContents.getURL();
    callback(isAllowedChatUrl(requestingUrl) && isCameraRequest(permission, details));
  });

  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    const requestingUrl = details.securityOrigin || details.requestingUrl || requestingOrigin;
    return isAllowedChatUrl(requestingUrl) && isCameraCheck(permission, details);
  });
};

const configureNavigation = (window) => {
  const { webContents } = window;

  const handleNavigation = (event) => {
    if (isAllowedChatUrl(event.url)) {
      showingConnectionError = false;
      return;
    }

    event.preventDefault();
    openExternal(event.url);
  };

  webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  webContents.on('will-navigate', handleNavigation);
  webContents.on('will-redirect', handleNavigation);

  webContents.on(
    'did-fail-load',
    (_event, errorCode, _errorDescription, validatedUrl, isMainFrame) => {
      const navigationWasCancelled = errorCode === -3;
      if (isMainFrame && !navigationWasCancelled && isAllowedChatUrl(validatedUrl)) {
        void showConnectionError(window);
      }
    },
  );
};

const configureClosing = (window) => {
  let forceCloseTimer = null;

  // Een remote beforeunload-handler mag de native sluitknop niet annuleren.
  window.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault();
  });

  window.on('close', () => {
    if (forceCloseTimer) {
      return;
    }

    forceCloseTimer = setTimeout(() => {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    }, FORCE_CLOSE_DELAY_MS);
    forceCloseTimer.unref();
  });

  window.on('closed', () => {
    if (forceCloseTimer) {
      clearTimeout(forceCloseTimer);
    }
  });
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Sonido Radio WebChat',
    backgroundColor: '#0f0a1a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = window;
  configureClosing(window);
  configureNavigation(window);
  configurePermissions(window.webContents.session);

  window.once('ready-to-show', () => {
    window.maximize();
    window.show();
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.loadURL(CHAT_URL).catch(() => {
    void showConnectionError(window);
  });
};

const focusMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);

  app.whenReady().then(() => {
    createWindow();
    configureAutoUpdates({
      app,
      autoUpdater,
      dialog,
      getMainWindow: () => mainWindow,
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      focusMainWindow();
    }
  });
}
