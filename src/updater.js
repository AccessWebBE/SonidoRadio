const INITIAL_UPDATE_DELAY_MS = 10_000;
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1_000;

const configureAutoUpdates = ({
  app,
  autoUpdater,
  dialog,
  getMainWindow,
  setTimeoutFn = setTimeout,
  setIntervalFn = setInterval,
}) => {
  if (!app.isPackaged) {
    return;
  }

  let updatePromptOpen = false;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (error) => {
    console.error('Automatische update mislukt:', error);
  });

  autoUpdater.on('update-downloaded', async (updateInfo) => {
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
