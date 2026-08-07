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

const createWindowSpy = () => {
  const calls = [];
  return {
    calls,
    window: {
      isDestroyed: () => false,
      setProgressBar: (...args) => calls.push(args),
    },
  };
};

const configureWithWindow = (window, autoUpdater) => {
  autoUpdater.checkForUpdates = async () => {};
  configureAutoUpdates({
    app: { isPackaged: true },
    autoUpdater,
    dialog: { async showMessageBox() { return { response: 1 }; } },
    getMainWindow: () => window,
    setTimeoutFn: createTimer([]),
    setIntervalFn: createTimer([]),
  });
};

test('toont de downloadvoortgang in de taakbalk', async () => {
  const autoUpdater = new EventEmitter();
  const { calls, window } = createWindowSpy();
  configureWithWindow(window, autoUpdater);

  autoUpdater.emit('update-available', { version: '1.2.0' });
  autoUpdater.emit('download-progress', { percent: 42.5 });
  autoUpdater.emit('download-progress', { percent: 100 });
  autoUpdater.emit('update-downloaded', { version: '1.2.0' });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(calls, [
    [0, { mode: 'indeterminate' }],
    [0.425],
    [1],
    [-1],
  ]);
});

test('verbergt de voortgangsbalk bij fouten en als er niets nieuws is', () => {
  const autoUpdater = new EventEmitter();
  const { calls, window } = createWindowSpy();
  configureWithWindow(window, autoUpdater);

  autoUpdater.emit('update-not-available', {});
  autoUpdater.emit('error', new Error('netwerk weg'));

  assert.deepEqual(calls, [[-1], [-1]]);
});

test('negeert onbruikbare voortgangswaarden en houdt de balk binnen bereik', () => {
  const autoUpdater = new EventEmitter();
  const { calls, window } = createWindowSpy();
  configureWithWindow(window, autoUpdater);

  autoUpdater.emit('download-progress', {});
  autoUpdater.emit('download-progress', { percent: 'geen getal' });
  autoUpdater.emit('download-progress', { percent: 140 });
  autoUpdater.emit('download-progress', { percent: -5 });

  assert.deepEqual(calls, [[1], [0]]);
});

test('overleeft een venster dat al gesloten is', () => {
  const autoUpdater = new EventEmitter();
  configureWithWindow(null, autoUpdater);

  assert.doesNotThrow(() => autoUpdater.emit('download-progress', { percent: 10 }));

  const zonderProgressBar = { isDestroyed: () => false };
  const tweede = new EventEmitter();
  configureWithWindow(zonderProgressBar, tweede);
  assert.doesNotThrow(() => tweede.emit('download-progress', { percent: 10 }));
});

test('geeft de logger door aan de updater', () => {
  const autoUpdater = new EventEmitter();
  const logger = { info() {}, error() {} };
  autoUpdater.checkForUpdates = async () => {};

  configureAutoUpdates({
    app: { isPackaged: true },
    autoUpdater,
    dialog: {},
    getMainWindow: () => null,
    logger,
    setTimeoutFn: createTimer([]),
    setIntervalFn: createTimer([]),
  });

  assert.equal(autoUpdater.logger, logger);
});
