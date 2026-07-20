const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { configureAutoUpdates } = require('../src/updater');

const createTimer = (callbacks) => (callback, delay) => {
  callbacks.push({ callback, delay });
  return { unref() {} };
};

test('schakelt updates uit tijdens lokale ontwikkeling', () => {
  const autoUpdater = new EventEmitter();
  const timers = [];

  configureAutoUpdates({
    app: { isPackaged: false },
    autoUpdater,
    dialog: {},
    getMainWindow: () => null,
    setTimeoutFn: createTimer(timers),
    setIntervalFn: createTimer(timers),
  });

  assert.equal(timers.length, 0);
  assert.equal(autoUpdater.listenerCount('update-downloaded'), 0);
});

test('downloadt updates en installeert na bevestiging', async () => {
  const autoUpdater = new EventEmitter();
  const timers = [];
  const dialogCalls = [];
  let installArguments = null;

  autoUpdater.checkForUpdates = async () => {};
  autoUpdater.quitAndInstall = (...args) => {
    installArguments = args;
  };

  configureAutoUpdates({
    app: { isPackaged: true },
    autoUpdater,
    dialog: {
      async showMessageBox(...args) {
        dialogCalls.push(args);
        return { response: 0 };
      },
    },
    getMainWindow: () => ({ isDestroyed: () => false }),
    setTimeoutFn: createTimer(timers),
    setIntervalFn: createTimer(timers),
  });

  assert.equal(autoUpdater.autoDownload, true);
  assert.equal(autoUpdater.autoInstallOnAppQuit, true);
  assert.equal(timers.length, 2);

  autoUpdater.emit('update-downloaded', { version: '1.2.0' });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(dialogCalls.length, 1);
  assert.deepEqual(installArguments, [true, true]);
});
