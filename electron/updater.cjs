// Update-checking wrapper around electron-updater. Safe to call even when no real
// update feed has been published yet — it reports a clear status instead of
// crashing, since this project ships without a configured update server by default.
// See README.md "מנגנון עדכונים" for how to actually turn this on.
const { app, dialog, BrowserWindow } = require('electron');
const EventEmitter = require('events');
const store = require('./store.cjs');

const emitter = new EventEmitter();
let lastStatus = { state: 'idle' };

function setStatus(status) {
  lastStatus = status;
  emitter.emit('status', status);
}

function getStatus() {
  return lastStatus;
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    setStatus({ state: 'dev-mode', message: 'בדיקת עדכונים זמינה רק בגרסה המותקנת (production build), לא במצב פיתוח.' });
    return lastStatus;
  }

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    setStatus({ state: 'error', message: 'מודול העדכונים לא הותקן.' });
    return lastStatus;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.removeAllListeners();

  // A parent-configured URL (Settings → עדכוני תוכנה) overrides the placeholder
  // baked into the packaged build's app-update.yml at build time — this is what
  // actually lets someone point the app at a real feed without rebuilding.
  const { updateFeedUrl } = store.getSettings();
  if (updateFeedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: updateFeedUrl });
  }

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    setStatus({ state: 'available', version: info.version })
  );
  autoUpdater.on('update-not-available', () => setStatus({ state: 'not-available' }));
  autoUpdater.on('download-progress', (progress) =>
    setStatus({ state: 'downloading', percent: Math.round(progress.percent) })
  );
  autoUpdater.on('update-downloaded', (info) =>
    setStatus({ state: 'downloaded', version: info.version })
  );
  autoUpdater.on('error', (err) => {
    // A generic-provider feed pointing at nothing real yet (the shipped default)
    // fails DNS/HTTP — that is expected, not a bug, so keep the message calm.
    setStatus({ state: 'error', message: 'לא ניתן להגיע לשרת העדכונים. ודאו ש-updateFeedUrl הוגדר נכון.' });
  });

  try {
    setStatus({ state: 'checking' });
    await autoUpdater.checkForUpdates();
  } catch (err) {
    setStatus({ state: 'error', message: 'לא ניתן להגיע לשרת העדכונים. ודאו ש-updateFeedUrl הוגדר נכון.' });
  }
  return lastStatus;
}

function downloadUpdate() {
  const { autoUpdater } = require('electron-updater');
  return autoUpdater.downloadUpdate();
}

function quitAndInstall() {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.quitAndInstall();
}

// Silent, best-effort startup check against the GitHub Releases feed (see
// package.json build.publish). Called a few seconds after app ready — never
// awaited by the caller and never allowed to throw, so a network hiccup or a
// missing/incomplete release on GitHub can never crash or block the app.
function autoCheckOnStartup() {
  if (!app.isPackaged) {
    return Promise.resolve();
  }

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    logUpdaterError('module not available', err);
    return Promise.resolve();
  }

  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // A parent-configured feed URL (Settings → עדכוני תוכנה) overrides GitHub.
    const { updateFeedUrl } = store.getSettings();
    if (updateFeedUrl) {
      autoUpdater.setFeedURL({ provider: 'generic', url: updateFeedUrl });
    }

    autoUpdater.removeAllListeners('checking-for-update');
    autoUpdater.removeAllListeners('update-available');
    autoUpdater.removeAllListeners('update-not-available');
    autoUpdater.removeAllListeners('update-downloaded');
    autoUpdater.removeAllListeners('error');

    autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }));
    autoUpdater.on('update-available', (info) => {
      setStatus({ state: 'available', version: info.version });
    });
    autoUpdater.on('update-not-available', () => setStatus({ state: 'not-available' }));
    autoUpdater.on('update-downloaded', (info) => {
      setStatus({ state: 'downloaded', version: info.version });
      // A simple native dialog is the standard electron-updater pattern and
      // guarantees the parent actually sees the prompt even if they're not
      // sitting on the Settings screen (which also reflects 'downloaded' via
      // the status event above, for anyone who is).
      dialog
        .showMessageBox(BrowserWindow.getFocusedWindow() || undefined, {
          type: 'info',
          title: 'FamilyQuest PC',
          message: `עדכון חדש (${info.version}) הורד ומוכן להתקנה.`,
          detail: 'להתקין ולהפעיל מחדש עכשיו, או שההתקנה תתבצע אוטומטית ביציאה הבאה מהתוכנה?',
          buttons: ['התקן עכשיו', 'מאוחר יותר'],
          defaultId: 0,
          cancelId: 1
        })
        .then((result) => {
          if (result.response === 0) autoUpdater.quitAndInstall();
        })
        .catch((err) => logUpdaterError('restart dialog failed', err));
    });
    autoUpdater.on('error', (err) => {
      // Expected in dev/offline/no-release-yet situations — log only, never crash.
      logUpdaterError('background check', err);
      setStatus({ state: 'error', message: 'לא ניתן היה לבדוק עדכונים ברקע.' });
    });

    return autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      logUpdaterError('checkForUpdatesAndNotify rejected', err);
    });
  } catch (err) {
    logUpdaterError('unexpected failure', err);
    return Promise.resolve();
  }
}

function logUpdaterError(label, err) {
  try {
    // eslint-disable-next-line no-console
    console.error(`[updater] ${label} (non-fatal):`, err?.message || err);
  } catch {
    /* ignore — logging must never throw */
  }
}

module.exports = {
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getStatus,
  autoCheckOnStartup,
  on: emitter.on.bind(emitter)
};
