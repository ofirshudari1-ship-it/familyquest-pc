// Update wrapper around electron-updater (GitHub Releases feed, see package.json build.publish).
//
// Design (v2.6.0, same as TapAct / Playnest):
//   - ONE configured autoUpdater instance with listeners registered once (the old code re-created
//     listeners on every manual check and flipped autoDownload to false, which silently disabled
//     background downloads after the first manual "check now").
//   - First check ~5s after launch, then every 6 hours, and again after the PC wakes from sleep
//     (the app lives in the tray for days, so a single check per launch never updated it).
//   - autoDownload always on; "install on quit" follows the Settings toggle autoInstallUpdates
//     (default ON); no Windows toast (checkForUpdates, not checkForUpdatesAndNotify).
//   - One restart prompt per downloaded version, shown on the parent dashboard window only (never
//     on the child's lock screen), deferred until that window is visible; the tray menu also carries
//     a "restart to update" item while an update waits.
//   - "Restart now" = silent NSIS install + relaunch. The installer is per-machine (Program Files)
//     and requests admin, so Windows shows ONE UAC prompt per update. We never install unattended:
//     an unanswered UAC prompt would close the app (and its screen-time enforcement) without updating.
//   - Everything is logged to <userData>/updater.log and nothing can throw out of this module.
const { app, dialog, powerMonitor } = require('electron');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const store = require('./store.cjs');
const {
  UPDATE_CHECK_INTERVAL_MS,
  shouldRunPeriodicCheck,
  shouldPromptForVersion,
  isCheckOverdue
} = require('./update-schedule.cjs');

const emitter = new EventEmitter();
let lastStatus = { state: 'idle' };
let autoUpdater = null;
let initialized = false;
let feedOverridden = false;
let downloadedVersion = null;
let promptedVersion = null;
let lastCheckAt = 0;
let periodicTimer = null;

function logPath() {
  return path.join(app.getPath('userData'), 'updater.log');
}

function logUpdate(message) {
  try {
    const file = logPath();
    try {
      if (fs.statSync(file).size > 200 * 1024) fs.renameSync(file, file + '.old');
    } catch {
      /* no log yet */
    }
    fs.appendFileSync(file, `${new Date().toISOString()} ${message}\n`);
  } catch {
    /* logging must never break the updater */
  }
}

function setStatus(status) {
  lastStatus = status;
  try {
    emitter.emit('status', status);
  } catch (err) {
    logUpdate(`status listener threw: ${err?.message || err}`);
  }
}

function getStatus() {
  return lastStatus;
}

function getDownloadedVersion() {
  return downloadedVersion;
}

function loadUpdater() {
  if (autoUpdater) return autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    logUpdate(`electron-updater not available: ${err?.message || err}`);
    autoUpdater = null;
  }
  return autoUpdater;
}

// A parent-configured URL (Settings > updates) overrides the GitHub feed baked into the build;
// clearing it restores GitHub.
function applyFeed(u) {
  const { updateFeedUrl } = store.getSettings();
  if (updateFeedUrl) {
    u.setFeedURL({ provider: 'generic', url: updateFeedUrl });
    feedOverridden = true;
  } else if (feedOverridden) {
    u.setFeedURL({ provider: 'github', owner: 'ofirshudari1-ship-it', repo: 'familyquest-pc' });
    feedOverridden = false;
  }
}

function applySettings() {
  if (!autoUpdater) return;
  const on = store.getSettings().autoInstallUpdates !== false;
  autoUpdater.autoInstallOnAppQuit = on;
  // electron-updater registers its quit handler only when a download completes with the flag on;
  // turning the toggle on afterwards must register it for an already-downloaded update as well.
  if (on && downloadedVersion && typeof autoUpdater.addQuitHandler === 'function') {
    try {
      autoUpdater.addQuitHandler();
    } catch (err) {
      logUpdate(`addQuitHandler failed: ${err?.message || err}`);
    }
  }
}

function installNow() {
  const u = loadUpdater();
  if (!u) return;
  try {
    logUpdate(`installNow ${downloadedVersion}`);
    global.isQuitting = true;
    u.quitAndInstall(true, true);
  } catch (err) {
    global.isQuitting = false;
    logUpdate(`quitAndInstall failed: ${err?.message || err}`);
  }
}

// Shown at most once per downloaded version, on the parent dashboard window, and only while that
// window is visible. If it is not, the prompt waits for the next call (window shown / next launch).
function maybePrompt(dashboardWin) {
  if (!downloadedVersion || !shouldPromptForVersion(promptedVersion, downloadedVersion)) return;
  if (!dashboardWin || dashboardWin.isDestroyed() || !dashboardWin.isVisible() || dashboardWin.isMinimized()) return;
  const version = downloadedVersion;
  promptedVersion = version;
  const auto = store.getSettings().autoInstallUpdates !== false;
  dialog
    .showMessageBox(dashboardWin, {
      type: 'info',
      title: 'FamilyQuest PC',
      message: `עדכון לגרסה ${version} הורד ומוכן להתקנה.`,
      detail:
        (auto
          ? 'אפשר להפעיל מחדש עכשיו, או שהעדכון יותקן אוטומטית ביציאה הבאה מהתוכנה. '
          : 'אפשר להפעיל מחדש עכשיו להתקנה. ההתקנה האוטומטית ביציאה כבויה בהגדרות. ') +
        'Windows תבקש אישור פעם אחת (חלון UAC), כי התוכנה מותקנת לכל המשתמשים בתיקיית Program Files. בזמן ההפעלה מחדש אכיפת זמן המסך נעצרת לכמה שניות.',
      buttons: ['הפעל מחדש עכשיו', 'מאוחר יותר'],
      defaultId: 0,
      cancelId: 1
    })
    .then((result) => {
      if (result.response === 0) installNow();
    })
    .catch((err) => logUpdate(`restart dialog failed: ${err?.message || err}`));
}

function init() {
  if (initialized) return !!autoUpdater;
  if (!app.isPackaged) return false;
  const u = loadUpdater();
  if (!u) return false;
  initialized = true;
  try {
    u.autoDownload = true;
    u.logger = {
      info: (m) => logUpdate(`info ${m}`),
      warn: (m) => logUpdate(`warn ${m}`),
      error: (m) => logUpdate(`error ${m}`),
      debug: () => {}
    };
    applySettings();
    u.on('checking-for-update', () => {
      lastCheckAt = Date.now();
      setStatus({ state: 'checking' });
    });
    u.on('update-available', (info) => {
      logUpdate(`update available: ${info?.version}`);
      setStatus({ state: 'available', version: info.version });
    });
    u.on('update-not-available', () => {
      if (lastStatus.state !== 'downloaded') setStatus({ state: 'not-available' });
    });
    u.on('download-progress', (progress) => setStatus({ state: 'downloading', percent: Math.round(progress?.percent || 0) }));
    u.on('update-downloaded', (info) => {
      downloadedVersion = info?.version || null;
      logUpdate(`update downloaded: ${downloadedVersion}`);
      setStatus({ state: 'downloaded', version: downloadedVersion });
      emitter.emit('downloaded', downloadedVersion);
    });
    u.on('error', (err) => {
      logUpdate(`error: ${err?.message || err}`);
      // Calm message: offline / no release yet / feed unreachable are expected situations.
      if (lastStatus.state !== 'downloaded') setStatus({ state: 'error', message: 'לא ניתן היה לבדוק עדכונים כרגע. נסה שוב מאוחר יותר.' });
    });
    return true;
  } catch (err) {
    logUpdate(`init failed: ${err?.message || err}`);
    return false;
  }
}

async function runCheck(reason) {
  const u = autoUpdater;
  if (!u) return;
  try {
    lastCheckAt = Date.now();
    logUpdate(`check (${reason})`);
    applyFeed(u);
    await u.checkForUpdates();
  } catch (err) {
    logUpdate(`${reason} check failed: ${err?.message || err}`);
    if (lastStatus.state !== 'downloaded') setStatus({ state: 'error', message: 'לא ניתן היה לבדוק עדכונים כרגע. נסה שוב מאוחר יותר.' });
  }
}

// Manual "check now" from Settings.
async function checkForUpdates() {
  if (!app.isPackaged) {
    setStatus({ state: 'dev-mode', message: 'בדיקת עדכונים זמינה רק בגרסה המותקנת (production build), לא במצב פיתוח.' });
    return lastStatus;
  }
  if (!init()) {
    setStatus({ state: 'error', message: 'מודול העדכונים לא זמין.' });
    return lastStatus;
  }
  if (lastStatus.state === 'checking' || lastStatus.state === 'downloading') return lastStatus;
  await runCheck('manual');
  return lastStatus;
}

function downloadUpdate() {
  const u = loadUpdater();
  if (!u || lastStatus.state === 'downloading' || lastStatus.state === 'downloaded') return Promise.resolve();
  return Promise.resolve(u.downloadUpdate()).catch((err) => logUpdate(`downloadUpdate failed: ${err?.message || err}`));
}

function quitAndInstall() {
  installNow();
}

// Called from main.cjs a few seconds after the app is ready: first check now, then every 6h and
// after wake-from-sleep. Never awaited by the caller and never throws.
function autoCheckOnStartup() {
  if (!init()) return Promise.resolve();
  if (periodicTimer) clearInterval(periodicTimer);
  periodicTimer = setInterval(() => {
    if (shouldRunPeriodicCheck(lastStatus.state)) runCheck('periodic');
  }, UPDATE_CHECK_INTERVAL_MS);
  if (periodicTimer.unref) periodicTimer.unref();
  try {
    powerMonitor.on('resume', () => {
      if (shouldRunPeriodicCheck(lastStatus.state) && isCheckOverdue(lastCheckAt, Date.now())) runCheck('resume');
    });
  } catch (err) {
    logUpdate(`powerMonitor unavailable: ${err?.message || err}`);
  }
  return runCheck('startup');
}

module.exports = {
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getStatus,
  getDownloadedVersion,
  autoCheckOnStartup,
  applySettings,
  maybePrompt,
  on: emitter.on.bind(emitter)
};
