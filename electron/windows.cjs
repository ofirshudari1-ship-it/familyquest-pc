const { BrowserWindow, screen } = require('electron');
const path = require('path');
const taskbar = require('./taskbar.cjs');

const isDev = process.env.NODE_ENV === 'development';

let homeWin = null;
let hudWin = null;
let dashboardWin = null;
let reassertInterval = null;

function loadView(win, view) {
  if (isDev) {
    win.loadURL(`http://localhost:5174/#${view}`);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: view });
  }
}

function createHomeWindow() {
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

  loadView(homeWin, 'home');
  homeWin.once('ready-to-show', () => homeWin.show());
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

function getOrCreateDashboardWindow() {
  if (dashboardWin && !dashboardWin.isDestroyed()) {
    dashboardWin.show();
    dashboardWin.focus();
    return dashboardWin;
  }
  dashboardWin = new BrowserWindow({
    width: 1100,
    height: 740,
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
  loadView(dashboardWin, 'dashboard');
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

  const locked = state.status === 'locked' || state.status === 'picker';

  if (state.status === 'setup') {
    clearKiosk();
    if (!homeWin.isVisible()) homeWin.show();
    if (hudWin && !hudWin.isDestroyed()) hudWin.hide();
  } else if (locked) {
    if (hudWin && !hudWin.isDestroyed()) hudWin.hide();
    if (!homeWin.isVisible()) homeWin.show();
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
