// Smoke tests for the background/tray pass (STANDARDS.md §12 — FamilyQuest PC
// is now treated as a background family/screen-time app, not a one-shot tool).
// electron/main.cjs, tray.cjs and windows.cjs all `require('electron')`, which
// isn't available outside a real Electron process, so — matching the pattern
// already used for this kind of check in the sibling Playnest project — these
// assert against the actual source text rather than executing the modules.
const fs = require('node:fs');
const path = require('node:path');

const store = require('../electron/store.cjs');

function readElectronFile(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'electron', name), 'utf8');
}

describe('background/tray settings defaults', () => {
  it('DEFAULT_SETTINGS defaults minimizeToTray to true', () => {
    expect(store.DEFAULT_SETTINGS.minimizeToTray).toBe(true);
  });

  it('DEFAULT_SETTINGS defaults trayBalloonShown to false (one-time balloon not yet shown)', () => {
    expect(store.DEFAULT_SETTINGS.trayBalloonShown).toBe(false);
  });

  it('DEFAULT_SETTINGS defaults notifyOnSessionChange to true', () => {
    expect(store.DEFAULT_SETTINGS.notifyOnSessionChange).toBe(true);
  });
});

describe('windows.cjs — dashboard close-to-tray behavior', () => {
  const windows = readElectronFile('windows.cjs');

  it('only intercepts the dashboard close when minimizeToTray is on AND the app is not already quitting', () => {
    expect(windows).toMatch(/!global\.isQuitting\s*&&\s*minimizeToTray/);
    expect(windows).toMatch(/event\.preventDefault\(\)/);
    expect(windows).toMatch(/dashboardWin\.hide\(\)/);
  });

  it('shows the one-time tray balloon when the dashboard is hidden to tray', () => {
    expect(windows).toMatch(/notifyMinimizedToTrayOnce\(\)/);
  });

  it('persists and restores dashboard window bounds between sessions', () => {
    expect(windows).toMatch(/function getInitialDashboardBounds/);
    expect(windows).toMatch(/function saveDashboardBounds/);
    expect(windows).toMatch(/store\.set\('dashboardBounds'/);
    expect(windows).toMatch(/store\.get\('dashboardBounds'\)/);
  });

  it('never persists a "minimized to tray" state as something to restore on next launch', () => {
    // getInitialDashboardBounds only ever restores width/height/x/y/isMaximized —
    // it must not read or apply any kind of "start hidden" flag.
    expect(windows).not.toMatch(/isHidden|startHiddenInTray|wasMinimizedToTray/);
  });
});

describe('tray.cjs — menu, click behavior, and balloon', () => {
  const tray = readElectronFile('tray.cjs');

  it('has a real Exit item, last and separated, that sets isQuitting before app.quit()', () => {
    expect(tray).toMatch(/label:\s*'יציאה'/);
    expect(tray).toMatch(/global\.isQuitting\s*=\s*true;\s*\n\s*app\.quit\(\);/);
  });

  it('the Exit item is the final entry in the menu template (after a separator)', () => {
    const menuBody = tray.slice(tray.indexOf('function buildMenu'), tray.indexOf('function statusLabel'));
    const lastSeparatorIndex = menuBody.lastIndexOf("{ type: 'separator' }");
    const exitIndex = menuBody.indexOf("label: 'יציאה'");
    expect(exitIndex).toBeGreaterThan(-1);
    expect(exitIndex).toBeGreaterThan(lastSeparatorIndex);
  });

  it('single click AND double click on the tray icon open the dashboard (never a menu)', () => {
    expect(tray).toMatch(/tray\.on\('click',\s*openDashboard\)/);
    expect(tray).toMatch(/tray\.on\('double-click',\s*openDashboard\)/);
  });

  it('the tray tooltip reflects live lock/session state, not a static string', () => {
    expect(tray).toMatch(/function statusLabel/);
    expect(tray).toMatch(/lockManager\.computeState\(\)/);
    expect(tray).toMatch(/tray\.setToolTip\(/);
  });

  it('exposes a notifyMinimizedToTrayOnce helper gated on the trayBalloonShown flag', () => {
    expect(tray).toMatch(/function notifyMinimizedToTrayOnce/);
    expect(tray).toMatch(/if\s*\(settings\.trayBalloonShown\)\s*return;/);
    expect(tray).toMatch(/setSettings\(\{\s*trayBalloonShown:\s*true\s*\}\)/);
    expect(tray).toMatch(/module\.exports = \{[^}]*notifyMinimizedToTrayOnce/);
  });
});

describe('main.cjs — Windows startup registration and session-change notifications', () => {
  const main = readElectronFile('main.cjs');

  it('applies app.setLoginItemSettings unconditionally on every launch (self-healing autostart)', () => {
    expect(main).toMatch(/app\.setLoginItemSettings\(\{\s*openAtLogin:\s*Boolean\(autostart\)\s*\}\)/);
  });

  it('re-applies the login item whenever the autostart setting changes', () => {
    expect(main).toMatch(/hasOwnProperty\.call\(patch, 'autostart'\)/);
    expect(main).toMatch(/app\.setLoginItemSettings\(\{ openAtLogin: Boolean\(patch\.autostart\) \}\)/);
  });

  it('notifies about a session starting/ending only when notifyOnSessionChange is on and the dashboard is not visible', () => {
    expect(main).toMatch(/function notifySessionChange/);
    expect(main).toMatch(/if\s*\(!store\.getSettings\(\)\.notifyOnSessionChange\)\s*return;/);
    expect(main).toMatch(/dashboardWin\.isVisible\(\)/);
  });
});

describe('src/types.ts and DashboardSettings.tsx agree with electron/store.cjs on the new fields', () => {
  const types = fs.readFileSync(path.join(__dirname, '..', 'src', 'types.ts'), 'utf8');
  const settingsScreen = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', 'DashboardSettings.tsx'), 'utf8');

  it('Settings interface declares the new boolean fields', () => {
    for (const field of ['minimizeToTray', 'trayBalloonShown', 'notifyOnSessionChange']) {
      expect(types).toMatch(new RegExp(`${field}: boolean`));
    }
  });

  it('the settings screen exposes toggles for minimizeToTray and notifyOnSessionChange', () => {
    expect(settingsScreen).toMatch(/checked=\{settings\.minimizeToTray\}/);
    expect(settingsScreen).toMatch(/checked=\{settings\.notifyOnSessionChange\}/);
  });
});
