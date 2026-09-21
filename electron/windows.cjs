const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const taskbar = require('./taskbar.cjs');
const store = require('./store.cjs');
const { ICON_PNG_BASE64 } = require('./icon.cjs');

const isDev = process.env.NODE_ENV === 'development';

let homeWin = null;
let hudWin = null;
let dashboardWin = null;
let reassertInterval = null;
let splash = null;

// STANDARDS.md §19 — branded splash screen shown while the kid-facing lock
// screen (homeWin, the window created at every app launch) loads. Modeled
// on HOMEY AI's desktop/main.js (createSplash/closeSplash/revealMainWindow).
const SPLASH_MIN_MS = 800; // never flash-and-gone even on a fast/cached load
const SPLASH_MAX_MS = 8000; // fail-safe — show the main window regardless if loading hangs

function createSplash() {
  splash = new BrowserWindow({
    width: 320,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.webContents.once('did-finish-load', () => {
    if (!splash || splash.isDestroyed()) return;
    const logoSrc = `data:image/png;base64,${ICON_PNG_BASE64}`;
    const versionText = `v${app.getVersion()}`;
    splash.webContents
      .executeJavaScript(
        `document.getElementById('logo').src = ${JSON.stringify(logoSrc)};` +
          `document.getElementById('version').textContent = ${JSON.stringify(versionText)};`
      )
      .catch(() => {
        /* purely cosmetic — never block the splash on this */
      });
  });
  return splash;
}

function closeSplash() {
  if (splash && !splash.isDestroyed()) splash.close();
  splash = null;
}

// Reveal coordination lives at module scope (not inside createHomeWindow)
// because applyLockState — called on a 3s interval from lockManager.tick(),
// starting immediately and synchronously from lockManager.start() — also
// wants homeWin shown as soon as a lock state is known. Without this guard
// that first synchronous tick would call homeWin.show() before the renderer
// has even painted its first frame (before contentReady) and before the
// splash's 800ms floor, defeating both the splash and the show:false/
// ready-to-show anti-flash pattern.
let splashShownAt = 0;
let contentReady = false;
let revealed = false;
let lastLockState = null; // last state applyLockState was asked to render, re-applied once revealed

function revealMainWindow() {
  if (revealed || !homeWin || homeWin.isDestroyed() || !contentReady) return;
  const elapsed = Date.now() - splashShownAt;
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
  if (remaining > 0) {
    setTimeout(revealMainWindow, remaining);
    return;
  }
  revealed = true;
  closeSplash();
  // Re-run the normal lock-state visibility logic now that we're allowed to
  // actually show/hide windows — e.g. an 'unlocked' state at launch (a
  // session that was still active when the app restarted) must reveal the
  // HUD, not flash the home/kiosk window, exactly as applyLockState already
  // decides for every later tick. Fall back to a plain show if no state has
  // arrived yet (shouldn't normally happen — lockManager.tick() runs
  // synchronously from lockManager.start()).
  if (lastLockState) {
    applyLockState(lastLockState);
  } else {
    homeWin.show();
  }
}

// Used by applyLockState wherever the pre-splash code called `homeWin.show()`
// directly: before the initial reveal this defers to revealMainWindow (which
// waits for contentReady + the 800ms floor, then re-applies the lock state);
// afterwards it's a plain show.
function showHomeWindow() {
  if (!homeWin || homeWin.isDestroyed()) return;
  if (!revealed) {
    revealMainWindow();
    return;
  }
  if (!homeWin.isVisible()) homeWin.show();
}

function loadView(win, view) {
  if (isDev) {
    win.loadURL(`http://localhost:5174/#${view}`);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: view });
  }
}

function createHomeWindow() {
  // homeWin is the first thing the app puts on screen at every launch (the
  // kid-facing lock screen) — createHudWindow/dashboardWin are secondary
  // (HUD follows once unlocked; the dashboard only opens on parent request),
  // so the branded startup splash belongs here, not on those.
  createSplash();
  splashShownAt = Date.now();
  contentReady = false;
  revealed = false;
  lastLockState = null;

  homeWin = new BrowserWindow({
    show: false,
    backgroundColor: '#141726',
    autoHideMenuBar: true,
    frame: isDev, // dev keeps window chrome so you can always close it while testing
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // The lock screen must not be dismissible by closing the window — in production,
  // clicking the (hidden, since frame:false) close affordance or Alt+F4 is blocked
  // here; only main.cjs (real app quit, gated by PIN in the renderer) sets isQuitting.
  homeWin.on('close', (event) => {
    if (!global.isQuitting) event.preventDefault();
  });

  homeWin.once('ready-to-show', () => {
    contentReady = true;
    revealMainWindow();
  });
  homeWin.webContents.once('did-fail-load', () => {
    contentReady = true;
    revealMainWindow();
  });
  // Safety timeout (STANDARDS.md §19.2): the splash must never be able to get
  // stuck forever even if the renderer never fires ready-to-show/did-fail-load.
  setTimeout(() => {
    contentReady = true;
    revealMainWindow();
  }, SPLASH_MAX_MS);

  loadView(homeWin, 'home');
  return homeWin;
}

function createHudWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  hudWin = new BrowserWindow({
    width: 220,
    height: 90,
    x: width - 240,
    y: 20,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  hudWin.setAlwaysOnTop(true, 'screen-saver');
  loadView(hudWin, 'hud');
  return hudWin;
}

// Window state persistence (STANDARDS.md §12.3): remember the dashboard's
// size/position/maximized state between sessions, but only reuse saved x/y if
// that point still lands on a currently-connected display — otherwise a
// disconnected second monitor would open the window off-screen forever.
function getInitialDashboardBounds() {
  const DEFAULTS = { width: 1100, height: 740 };
  const saved = store.get('dashboardBounds');
  if (!saved) return DEFAULTS;
  const onScreen = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return saved.x >= a.x && saved.y >= a.y && saved.x < a.x + a.width && saved.y < a.y + a.height;
  });
  return {
    width: saved.width || DEFAULTS.width,
    height: saved.height || DEFAULTS.height,
    ...(onScreen && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? { x: saved.x, y: saved.y } : {}),
    isMaximized: Boolean(saved.isMaximized)
  };
}

function saveDashboardBounds() {
  if (!dashboardWin || dashboardWin.isDestroyed()) return;
  const isMaximized = dashboardWin.isMaximized();
  const bounds = isMaximized ? dashboardWin.getNormalBounds() : dashboardWin.getBounds();
  store.set('dashboardBounds', { ...bounds, isMaximized });
}

function getOrCreateDashboardWindow() {
  if (dashboardWin && !dashboardWin.isDestroyed()) {
    dashboardWin.show();
    dashboardWin.focus();
    return dashboardWin;
  }
  const initialBounds = getInitialDashboardBounds();
  dashboardWin = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#f4f6fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (initialBounds.isMaximized) dashboardWin.maximize();

  let saveBoundsTimer = null;
  const scheduleSaveBounds = () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(saveDashboardBounds, 400);
  };
  dashboardWin.on('resize', scheduleSaveBounds);
  dashboardWin.on('move', scheduleSaveBounds);

  loadView(dashboardWin, 'dashboard');

  // Closing the dashboard (X) never quits FamilyQuest PC — screen-time
  // enforcement (home/HUD windows + tray) must keep running regardless. When
  // minimizeToTray is on (default) the window itself is hidden rather than
  // destroyed, so reopening it from the tray is instant and keeps scroll
  // position/state; the first time this happens, a one-time balloon explains
  // the app is still running (STANDARDS.md §12.1). Turning the setting off
  // falls back to a plain destroy-and-recreate — functionally identical from
  // the app's point of view, since nothing here ever calls app.quit().
  dashboardWin.on('close', (event) => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    saveDashboardBounds();
    const { minimizeToTray } = store.getSettings();
    if (!global.isQuitting && minimizeToTray) {
      event.preventDefault();
      dashboardWin.hide();
      // Deferred require avoids a load-order issue with tray.cjs (which
      // itself requires this module) — safe here since it only runs long
      // after both modules have finished loading, on an actual user close.
      require('./tray.cjs').notifyMinimizedToTrayOnce();
    }
  });
  dashboardWin.on('closed', () => {
    dashboardWin = null;
  });
  return dashboardWin;
}

function sendToAll(channel, payload) {
  for (const win of [homeWin, hudWin, dashboardWin]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function clearKiosk() {
  if (!isDev) {
    homeWin.setKiosk(false);
    homeWin.setAlwaysOnTop(false);
    taskbar.showTaskbar();
    clearInterval(reassertInterval);
    reassertInterval = null;
  }
}

// Drives what's on screen from a lock-state snapshot: fullscreen kiosk overlay
// while locked, a small floating countdown while an unlocked session is running,
// and a plain windowed view (no kiosk, taskbar untouched) during initial setup —
// there is nothing to enforce yet, and enforcing anyway would hide the taskbar
// the parent needs to reach the dashboard that completes setup in the first place.
function applyLockState(state) {
  if (!homeWin || homeWin.isDestroyed()) return;
  lastLockState = state;

  const locked = state.status === 'locked' || state.status === 'picker';

  if (state.status === 'setup') {
    clearKiosk();
    showHomeWindow();
    if (hudWin && !hudWin.isDestroyed()) hudWin.hide();
  } else if (locked) {
    if (hudWin && !hudWin.isDestroyed()) hudWin.hide();
    showHomeWindow();
    if (!isDev) {
      homeWin.setKiosk(true);
      homeWin.setAlwaysOnTop(true, 'screen-saver');
      // Deliberately NOT hiding the taskbar here (Shell_TrayWnd ShowWindow hack) —
      // true kiosk fullscreen + always-on-top already covers it in practice, and
      // that OS-level hide survives the app being killed (Task Manager, crash),
      // leaving Windows itself looking broken until the user restarts explorer.exe.
      // See SPEC.md nispach ד' for the incident this was removed after.
      if (!reassertInterval) {
        reassertInterval = setInterval(() => {
          if (homeWin && !homeWin.isDestroyed()) {
            homeWin.setAlwaysOnTop(true, 'screen-saver');
            homeWin.moveTop();
          }
        }, 1500);
      }
    }
  } else {
    clearKiosk();
    homeWin.hide();
    if (hudWin && !hudWin.isDestroyed()) hudWin.show();
  }

  sendToAll('lock:state', state);
}

module.exports = {
  createHomeWindow,
  createHudWindow,
  getOrCreateDashboardWindow,
  applyLockState,
  sendToAll,
  get homeWin() {
    return homeWin;
  },
  get hudWin() {
    return hudWin;
  },
  get dashboardWin() {
    return dashboardWin;
  }
};
