const INITIAL_UPDATE_DELAY_MS = 3_000;
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1_000;
const PROGRESS_HIDDEN = -1;

const configureAutoUpdates = ({
  app,
  autoUpdater,
  dialog,
  getMainWindow,
  logger = null,
  setTimeoutFn = setTimeout,
  setIntervalFn = setInterval,
}) => {
  if (!app.isPackaged) {
    return;
  }

  let updatePromptOpen = false;

  if (logger) {
    autoUpdater.logger = logger;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // De melding komt pas als de download klaar is. Zonder teken van leven lijkt
  // het alsof er niets gebeurt, dus tonen we de voortgang in taakbalk en dock.
  const showProgress = (value, mode) => {
    const window = getMainWindow();
    if (!window || window.isDestroyed() || typeof window.setProgressBar !== 'function') {
      return;
    }

    if (mode) {
      window.setProgressBar(value, { mode });
    } else {
      window.setProgressBar(value);
    }
  };

  autoUpdater.on('update-available', () => {
    showProgress(0, 'indeterminate');
  });

  autoUpdater.on('update-not-available', () => {
    showProgress(PROGRESS_HIDDEN);
  });

  autoUpdater.on('download-progress', ({ percent } = {}) => {
    const fraction = Number(percent) / 100;
    if (Number.isFinite(fraction)) {
      showProgress(Math.min(Math.max(fraction, 0), 1));
    }
  });

  autoUpdater.on('error', (error) => {
    showProgress(PROGRESS_HIDDEN);
    console.error('Automatische update mislukt:', error);
  });

  autoUpdater.on('update-downloaded', async (updateInfo) => {
    showProgress(PROGRESS_HIDDEN);

    if (updatePromptOpen) {
      return;
    }

    updatePromptOpen = true;
    const options = {
      type: 'info',
      title: 'Sonido-update klaar',
      message: `Sonido ${updateInfo.version} is klaar om te installeren.`,
      detail: 'Herstart nu, of laat de update automatisch installeren wanneer je de app afsluit.',
      buttons: ['Nu herstarten', 'Bij afsluiten'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    };

    try {
      const window = getMainWindow();
      const result = window && !window.isDestroyed()
        ? await dialog.showMessageBox(window, options)
        : await dialog.showMessageBox(options);

      if (result.response === 0) {
        autoUpdater.quitAndInstall(true, true);
      }
    } catch (error) {
      console.error('Kon de update niet installeren:', error);
    } finally {
      updatePromptOpen = false;
    }
  });

  const checkForUpdates = () => {
    Promise.resolve()
      .then(() => autoUpdater.checkForUpdates())
      .catch((error) => {
        console.error('Kon niet op updates controleren:', error);
      });
  };

  const initialCheck = setTimeoutFn(checkForUpdates, INITIAL_UPDATE_DELAY_MS);
  const periodicCheck = setIntervalFn(checkForUpdates, UPDATE_INTERVAL_MS);
  initialCheck.unref?.();
  periodicCheck.unref?.();
};

module.exports = { configureAutoUpdates };
