const { app, ipcMain, dialog, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const store = require('./store.cjs');
const economy = require('./economy.cjs');
const pin = require('./pin.cjs');
const lockManager = require('./lockManager.cjs');
const windows = require('./windows.cjs');
const tray = require('./tray.cjs');
const updater = require('./updater.cjs');
const taskbar = require('./taskbar.cjs');
const insights = require('./insights.cjs');
const backup = require('./backup.cjs');

const isDev = process.env.NODE_ENV === 'development';
global.isQuitting = false;

// Lightweight crash log so a real bug report has something concrete to attach.
const errorLogPath = path.join(app.getPath('userData'), 'error.log');
function logCrash(label, err) {
  try {
    fs.appendFileSync(errorLogPath, `${new Date().toISOString()} ${label}: ${err?.stack || String(err)}\n`);
  } catch {
    /* ignore */
  }
}
process.on('uncaughtException', (err) => logCrash('MAIN uncaughtException', err));
process.on('unhandledRejection', (err) => logCrash('MAIN unhandledRejection', err));

// Electron security hardening (STANDARDS.md §11.4): every BrowserWindow's
// webContents (home/HUD/dashboard — windows.cjs already sets
// contextIsolation/nodeIntegration/sandbox per-window) is additionally
// locked down here so a compromised/malicious renderer can't pop an
// unrestricted new window or navigate the app itself to a remote origin.
// This app never needs either: all real navigation happens by hash change
// inside dist/index.html (see windows.cjs loadView), and there is no
// legitimate reason for FamilyQuest PC to open arbitrary external windows.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));

  contents.on('will-navigate', (navEvent, url) => {
    const target = new URL(url);
    const isDevServer = isDev && target.origin === 'http://localhost:5174';
    const isAppFile = target.protocol === 'file:' && target.pathname.startsWith(pathToFileURL(path.join(__dirname, '..', 'dist')).pathname);
    if (!isDevServer && !isAppFile) {
      navEvent.preventDefault();
    }
  });
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    windows.getOrCreateDashboardWindow();
  });

  app.whenReady().then(() => {
    // Self-heal: an earlier run may have hidden the Windows taskbar and then been
    // killed (crash, Task Manager) before it could restore it — that leaves the
    // taskbar hidden system-wide even with this app not running at all. Restoring
    // it unconditionally on every launch is always safe (a no-op if already shown).
    taskbar.showTaskbar();
    backup.autoSnapshot();

    windows.createHomeWindow();
    windows.createHudWindow();
    tray.createTray();

    lockManager.on('state', (state) => windows.applyLockState(state));
    lockManager.on('warning', ({ childId, minutesLeft }) => {
      windows.sendToAll('lock:warning', { childId, minutesLeft });
      if (Notification.isSupported()) {
        new Notification({
          title: 'FamilyQuest PC',
          body: minutesLeft === 5 ? 'נשארו 5 דקות לזמן המסך' : 'נשארה דקה אחת לזמן המסך'
        }).show();
      }
    });
    lockManager.on('app-flagged', (payload) => windows.sendToAll('lock:appFlagged', payload));
    lockManager.on('celebrate', (payload) => windows.sendToAll('lock:celebrate', payload));
    lockManager.start();

    updater.on('status', (status) => windows.sendToAll('updates:status', status));

    // Best-effort automatic update check a few seconds after startup, so it
    // never competes with window creation for startup time. Fully isolated
    // from app lifecycle: any failure (offline, no release published yet,
    // GitHub unreachable) is caught inside updater.cjs and only ever logged.
    setTimeout(() => {
      updater.autoCheckOnStartup().catch(() => {
        /* updater.cjs already logs — this catch only guards the setTimeout callback itself */
      });
    }, 5000);

    const { autostart } = store.getSettings();
    app.setLoginItemSettings({ openAtLogin: Boolean(autostart) });
  });
}

app.on('window-all-closed', () => {
  // The home/HUD windows intentionally resist closing (see windows.cjs); this only
  // fires once we're genuinely quitting, so there's nothing extra to do here.
});

app.on('before-quit', () => {
  taskbar.showTaskbar();
  global.isQuitting = true;
});

// ---------------- IPC: Children ----------------

ipcMain.handle('children:list', () => economy.getChildren());
ipcMain.handle('children:add', (e, data) => {
  const child = economy.addChild(data);
  lockManager.tick(); // may just have left the "nothing to enforce yet" setup state
  return child;
});
ipcMain.handle('children:update', (e, id, patch) => economy.updateChild(id, patch));
ipcMain.handle('children:remove', (e, id) => {
  economy.removeChild(id);
  lockManager.tick(); // may have just removed the last child (back to setup state)
});
ipcMain.handle('children:select', (e, id) => {
  store.setSettings({ activeChildId: id });
  return lockManager.tick();
});

// ---------------- IPC: Tasks ----------------

ipcMain.handle('tasks:list', (e, childId) => economy.getTasks(childId));
ipcMain.handle('tasks:create', (e, data) => economy.createTask(data));
ipcMain.handle('tasks:submit', async (e, taskId, attachProof) => {
  // A task the parent flagged requiresProof always opens the picker, regardless
  // of what the renderer passed — economy.submitTask is the actual source of
  // truth and will reject the submission below if no photo comes out of this.
  const requiresProof = economy.getTask(taskId).requiresProof;
  let proofPath = null;
  if (attachProof || requiresProof) {
    const result = await dialog.showOpenDialog({
      title: 'צירוף תמונה כהוכחה',
      properties: ['openFile'],
      filters: [{ name: 'תמונות', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });
    if (!result.canceled && result.filePaths[0]) {
      const proofDir = path.join(app.getPath('userData'), 'proof');
      fs.mkdirSync(proofDir, { recursive: true });
      const dest = path.join(proofDir, `${taskId}-${Date.now()}${path.extname(result.filePaths[0])}`);
      fs.copyFileSync(result.filePaths[0], dest);
      proofPath = dest;
    }
  }
  const task = economy.submitTask(taskId, proofPath);
  tray.refreshTray();
  return task;
});
ipcMain.handle('tasks:approve', (e, taskId) => {
  const task = economy.approveTask(taskId);
  lockManager.tick(); // coin balance / streak just changed
  tray.refreshTray();
  return task;
});
ipcMain.handle('tasks:reject', (e, taskId, note) => {
  const task = economy.rejectTask(taskId, note);
  tray.refreshTray();
  return task;
});
ipcMain.handle('tasks:remove', (e, taskId) => economy.deleteTask(taskId));
ipcMain.handle('coop:create', (e, data) => economy.createCoopQuest(data));
ipcMain.handle('coop:list', (e, childId) => economy.getCoopQuests(childId));
ipcMain.handle('coop:update', (e, coopId, patch) => economy.updateCoopQuest(coopId, patch));
ipcMain.handle('coop:cancel', (e, coopId) => economy.cancelCoopQuest(coopId));

// ---------------- IPC: Screen time ----------------

ipcMain.handle('sessions:redeem', (e, childId, minutes) => {
  const session = economy.redeemMinutes(childId, minutes);
  lockManager.tick();
  return session;
});
ipcMain.handle('sessions:homeworkPass', (e, childId, minutes) => {
  const session = economy.grantHomeworkPass(childId, minutes);
  lockManager.tick();
  return session;
});
ipcMain.handle('lock:getState', () => lockManager.computeState());
ipcMain.handle('lock:freeze', (e, childId) => lockManager.freeze(childId));

// ---------------- IPC: Reports ----------------

ipcMain.handle('reports:usageByDay', (e, childId, days) => economy.usageByDay(childId, days));
ipcMain.handle('reports:completionRate', (e, childId, days) => economy.completionRate(childId, days));
ipcMain.handle('reports:audit', (e, childId, limit) => economy.getAuditEntries(childId, limit));
ipcMain.handle('reports:todayLimit', (e, childId) => economy.getTodayLimit(childId));
ipcMain.handle('reports:badges', (e, childId) => economy.getBadges(childId));
ipcMain.handle('reports:badgeProgress', (e, childId) => economy.getBadgeProgress(childId));
ipcMain.handle('reports:streak', (e, childId) => economy.computeStreak(childId));
ipcMain.handle('reports:level', (e, childId) => economy.getLevel(childId));
ipcMain.handle('reports:insights', (e, childId) => insights.getInsights(childId));
ipcMain.handle('reports:coinsEarnedByDay', (e, childId, days) => economy.coinsEarnedByDay(childId, days));
ipcMain.handle('reports:familyWeeklySummary', () => economy.familyWeeklySummary());
ipcMain.handle('reports:weeklyStar', () => economy.getWeeklyStar());
ipcMain.handle('reports:weeklyDigest', () => economy.getWeeklyDigest());
ipcMain.handle('reports:markWeeklyDigestSeen', () => {
  economy.markWeeklyDigestSeen();
});
ipcMain.handle('reports:exportCsv', async (e, childId, days) => {
  const csv = economy.buildReportCsv(childId, days);
  const child = economy.getChild(childId);
  const result = await dialog.showSaveDialog({
    title: 'ייצוא דוח ל-CSV',
    defaultPath: `familyquest-${child ? child.name : 'report'}-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false };
  // BOM so Excel opens the Hebrew content as UTF-8 instead of guessing wrong.
  fs.writeFileSync(result.filePath, `﻿${csv}`, 'utf-8');
  return { ok: true, path: result.filePath };
});

// Reads a proof photo off disk and hands the renderer a data: URL — avoids
// file:// <img> loading, which is blocked from the http://localhost dev
// server and inconsistent across platforms in the packaged build.
const PROOF_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
ipcMain.handle('reports:proofImage', (e, proofPath) => {
  if (!proofPath) return null;
  try {
    const mime = PROOF_MIME[path.extname(proofPath).toLowerCase()];
    if (!mime) return null;
    const data = fs.readFileSync(proofPath).toString('base64');
    return `data:${mime};base64,${data}`;
  } catch {
    return null;
  }
});

// ---------------- IPC: Family goal ----------------

ipcMain.handle('family:get', () => economy.getFamilyGoal());
ipcMain.handle('family:create', (e, data) => economy.createFamilyGoal(data));
ipcMain.handle('family:clear', () => economy.clearFamilyGoal());

// ---------------- IPC: Backup & restore ----------------

ipcMain.handle('backup:export', () => backup.exportBackup());
ipcMain.handle('backup:import', () => backup.importBackup());

// ---------------- IPC: Prize wheel ----------------

ipcMain.handle('wheel:catalog', () => economy.getSpinCatalog());
ipcMain.handle('wheel:status', (e, childId) => economy.canSpinToday(childId));
ipcMain.handle('wheel:spin', (e, childId) => {
  const result = economy.spinWheel(childId);
  lockManager.tick(); // coin balance / multiplier / family goal may have just changed
  tray.refreshTray();
  return result;
});

// ---------------- IPC: Coin multiplier events ----------------

ipcMain.handle('children:grantMultiplier', (e, childId, value, durationMs) => {
  const child = economy.grantCoinMultiplier(childId, value, durationMs);
  tray.refreshTray();
  return child;
});
ipcMain.handle('children:clearMultiplier', (e, childId) => economy.clearCoinMultiplier(childId));

// ---------------- IPC: Restricted time windows ----------------

ipcMain.handle('restrictions:create', (e, data) => {
  const w = economy.createRestrictedWindow(data);
  lockManager.tick();
  return w;
});
ipcMain.handle('restrictions:remove', (e, childId, windowId) => {
  economy.removeRestrictedWindow(childId, windowId);
  lockManager.tick();
});

// ---------------- IPC: Reward shop ----------------

ipcMain.handle('rewards:list', (e, childId) => economy.getRewards(childId));
ipcMain.handle('rewards:create', (e, data) => economy.createReward(data));
ipcMain.handle('rewards:remove', (e, rewardId) => economy.deleteReward(rewardId));
ipcMain.handle('redemptions:list', (e, childId) => economy.getRedemptions(childId));
ipcMain.handle('redemptions:request', (e, childId, rewardId) => {
  const redemption = economy.requestReward(childId, rewardId);
  lockManager.tick();
  tray.refreshTray();
  return redemption;
});
ipcMain.handle('redemptions:fulfill', (e, redemptionId) => economy.fulfillRedemption(redemptionId));

// ---------------- IPC: Settings / PIN ----------------

ipcMain.handle('settings:get', () => store.getSettings());
ipcMain.handle('settings:set', (e, patch) => {
  const settings = store.setSettings(patch);
  if (Object.prototype.hasOwnProperty.call(patch, 'autostart')) {
    app.setLoginItemSettings({ openAtLogin: Boolean(patch.autostart) });
  }
  return settings;
});
ipcMain.handle('pin:has', () => pin.hasPin());
ipcMain.handle('pin:set', (e, newPin) => {
  pin.setPin(newPin);
  store.setSettings({ onboarded: true });
  return true;
});
ipcMain.handle('pin:verify', (e, candidate) => pin.verifyPin(candidate));
ipcMain.handle('pin:securityQuestions', () => pin.SECURITY_QUESTIONS);
ipcMain.handle('pin:setSecurityQuestion', (e, questionId, answer) => {
  pin.setSecurityQuestion(questionId, answer);
  return true;
});
ipcMain.handle('pin:hasSecurityQuestion', () => pin.hasSecurityQuestion());
ipcMain.handle('pin:getSecurityQuestion', () => pin.getSecurityQuestion());
ipcMain.handle('pin:verifySecurityAnswer', (e, answer) => pin.verifySecurityAnswer(answer));
ipcMain.handle('pin:resetViaRecovery', (e, answer, newPin) => {
  pin.resetPinViaRecovery(answer, newPin);
  return true;
});

// ---------------- IPC: App ----------------

ipcMain.handle('app:info', () => ({ name: app.getName(), version: app.getVersion() }));
ipcMain.handle('app:quit', () => {
  global.isQuitting = true;
  app.quit();
});
ipcMain.handle('app:openDashboard', () => {
  windows.getOrCreateDashboardWindow();
});
ipcMain.handle('updates:check', () => updater.checkForUpdates());
ipcMain.handle('updates:getStatus', () => updater.getStatus());
ipcMain.handle('updates:download', () => updater.downloadUpdate());
ipcMain.handle('updates:install', () => updater.quitAndInstall());

ipcMain.handle('app:openServiceFolder', () => {
  const serviceDir = isDev
    ? path.join(__dirname, '..', 'service')
    : path.join(process.resourcesPath, 'service');
  shell.openPath(serviceDir);
});
