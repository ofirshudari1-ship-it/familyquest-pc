const { Tray, Menu, nativeImage, app, Notification } = require('electron');
const economy = require('./economy.cjs');
const lockManager = require('./lockManager.cjs');
const windows = require('./windows.cjs');
const store = require('./store.cjs');
const { ICON_PNG_BASE64 } = require('./icon.cjs');

let tray = null;

// STANDARDS.md §12.2 menu order: primary action(s) first, then a separator,
// then Open/Settings, then a separator, then Exit last and separated so it's
// never hit by accident.
function buildMenu() {
  const settings = store.getSettings();
  const pendingCount = economy.getTasks().filter((t) => t.status === 'submitted').length;

  return Menu.buildFromTemplate([
    { label: `FamilyQuest PC v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    {
      label: 'הקפא מחשב עכשיו',
      click: () => {
        if (settings.activeChildId) lockManager.freeze(settings.activeChildId);
      }
    },
    { type: 'separator' },
    {
      label: pendingCount > 0 ? `פתח דשבורד הורים (${pendingCount} ממתינים)` : 'פתח דשבורד הורים',
      click: () => windows.getOrCreateDashboardWindow()
    },
    { label: 'אודות', role: 'about' },
    { type: 'separator' },
    // The one real full-exit path from the tray: isQuitting must be set before
    // app.quit() so the dashboard window's 'close' handler (which otherwise
    // intercepts every close while minimizeToTray is on) lets this one through
    // instead of just hiding the window again. See windows.cjs's close handler.
    {
      label: 'יציאה',
      click: () => {
        global.isQuitting = true;
        app.quit();
      }
    }
  ]);
}

// Tray icon tooltip reflects live app state (STANDARDS.md §12.2), not just a
// static app name — shows whether the screen is currently locked, running a
// session, or has quests waiting on parent approval.
function statusLabel() {
  const pendingCount = economy.getTasks().filter((t) => t.status === 'submitted').length;
  const state = lockManager.computeState();
  const statusText =
    state.status === 'locked'
      ? 'המסך נעול'
      : state.status === 'unlocked'
        ? 'זמן מסך פעיל'
        : state.status === 'picker'
          ? 'ממתין לבחירת ילד/ה'
          : 'בהגדרה ראשונית';
  return pendingCount > 0 ? `FamilyQuest PC — ${statusText} (${pendingCount} ממתינים לאישור)` : `FamilyQuest PC — ${statusText}`;
}

function refreshTooltip() {
  if (tray) tray.setToolTip(statusLabel());
}

function createTray() {
  const icon = nativeImage.createFromBuffer(Buffer.from(ICON_PNG_BASE64, 'base64'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  refreshTooltip();
  tray.setContextMenu(buildMenu());

  // STANDARDS.md §12.2: a single left click (and, for users who double-click
  // out of habit, a double click too) opens/raises the dashboard — never a
  // menu. Right-click already shows the context menu via setContextMenu above.
  const openDashboard = () => windows.getOrCreateDashboardWindow();
  tray.on('click', openDashboard);
  tray.on('double-click', openDashboard);

  // Refresh the menu/tooltip whenever anything that shows up in either one
  // changes (quest submitted for approval, lock state flips), so both stay
  // live without the parent needing to reopen them.
  lockManager.on('state', () => {
    tray.setContextMenu(buildMenu());
    refreshTooltip();
  });

  return tray;
}

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(buildMenu());
  refreshTooltip();
}

// One-time explanatory balloon the first time the parent closes the dashboard
// window and it minimizes to the tray instead of quitting (STANDARDS.md
// §12.1) — otherwise parents reasonably assume closing the window closed the
// app, and are confused/annoyed to later find it still enforcing screen time.
function notifyMinimizedToTrayOnce() {
  const settings = store.getSettings();
  if (settings.trayBalloonShown) return;
  store.setSettings({ trayBalloonShown: true });
  if (!tray || tray.isDestroyed?.()) return;
  const title = 'FamilyQuest PC ממשיכה לרוץ ברקע';
  const content = 'הבקרה על זמן המסך נשארת פעילה. לחיצה על סמל המגש פותחת את דשבורד ההורים, קליק ימני ← יציאה לסגירה מלאה.';
  if (typeof tray.displayBalloon === 'function') {
    // Windows-only Tray API — the intended platform for this app.
    tray.displayBalloon({ title, content });
  } else if (Notification.isSupported()) {
    new Notification({ title, body: content }).show();
  }
}

module.exports = { createTray, refreshTray, notifyMinimizedToTrayOnce };
