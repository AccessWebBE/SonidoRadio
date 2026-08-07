const { app, BrowserWindow, Menu, clipboard, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log/main');
const path = require('path');
const {
  CHAT_URL,
  isAllowedChatUrl,
  isCameraCheck,
  isCameraRequest,
  isSafeExternalUrl,
} = require('./policies');
const { configureContextMenu } = require('./context-menu');
const { createRevealScheduler } = require('./reveal');
const { configureAutoUpdates } = require('./updater');

const APP_ID = 'be.accessweb.sonido';
const ERROR_PAGE = path.join(__dirname, 'index.html');
const SPLASH_PAGE = path.join(__dirname, 'splash.html');
const FORCE_CLOSE_DELAY_MS = 3_000;
const MIN_SPLASH_DURATION_MS = 1_000;
const MAX_SPLASH_DURATION_MS = 4_000;

let mainWindow = null;
let splashWindow = null;
let showingConnectionError = false;

app.setAppUserModelId(APP_ID);

// Een GUI-app heeft geen console, dus zonder logbestand is een stille
// updaterfout nergens terug te vinden.
log.transports.file.level = 'info';
log.info(`Sonido ${app.getVersion()} gestart op ${process.platform}`);

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

const createSplashWindow = () => {
  const window = new BrowserWindow({
    width: 440,
    height: 320,
    center: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    backgroundColor: '#0b0810',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splashWindow = window;
  window.on('closed', () => {
    if (splashWindow === window) {
      splashWindow = null;
    }
  });
  window.loadFile(SPLASH_PAGE).catch((error) => {
    console.error('Kon het startscherm niet laden:', error);
  });

  return window;
};

const createWindow = () => {
  const splash = createSplashWindow();
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
  configureContextMenu(window, { Menu, clipboard, openExternal });
  configurePermissions(window.webContents.session);

  const revealWindow = () => {
    if (window.isDestroyed()) {
      return;
    }

    if (!window.isVisible()) {
      window.maximize();
      window.show();
    }
    if (!splash.isDestroyed()) {
      splash.destroy();
    }
  };

  const reveal = createRevealScheduler({
    minDelayMs: MIN_SPLASH_DURATION_MS,
    maxDelayMs: MAX_SPLASH_DURATION_MS,
    reveal: revealWindow,
  });

  window.once('ready-to-show', reveal.request);
  window.webContents.once('did-finish-load', reveal.request);

  window.on('closed', () => {
    reveal.cancel();
    if (!splash.isDestroyed()) {
      splash.destroy();
    }
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
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
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
      logger: log,
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
