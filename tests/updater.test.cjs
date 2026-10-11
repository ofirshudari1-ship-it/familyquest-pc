// Behavioural tests of electron/updater.cjs with `electron` and `electron-updater` replaced by
// in-memory fakes: nothing touches the network, a window or an installer.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const sched = require('../electron/update-schedule.cjs');

describe('update-schedule', () => {
  it('uses a 6h interval and a short first-check delay', () => {
    expect(sched.UPDATE_CHECK_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
    expect(sched.FIRST_CHECK_DELAY_MS).toBeGreaterThanOrEqual(1000);
    expect(sched.FIRST_CHECK_DELAY_MS).toBeLessThanOrEqual(15000);
  });
  it('skips periodic checks while busy or when an update waits', () => {
    for (const s of ['checking', 'available', 'downloading', 'downloaded']) expect(sched.shouldRunPeriodicCheck(s)).toBe(false);
    for (const s of ['idle', 'error', 'not-available', 'dev-mode']) expect(sched.shouldRunPeriodicCheck(s)).toBe(true);
  });
  it('prompts once per version', () => {
    expect(sched.shouldPromptForVersion(null, '2.6.0')).toBe(true);
    expect(sched.shouldPromptForVersion('2.6.0', '2.6.0')).toBe(false);
    expect(sched.shouldPromptForVersion('2.6.0', '2.6.1')).toBe(true);
    expect(sched.shouldPromptForVersion(null, null)).toBe(false);
  });
  it('detects an overdue check after wake', () => {
    const now = 1e12;
    expect(sched.isCheckOverdue(0, now)).toBe(true);
    expect(sched.isCheckOverdue(now - 1000, now)).toBe(false);
    expect(sched.isCheckOverdue(now - sched.UPDATE_CHECK_INTERVAL_MS, now)).toBe(true);
  });
});

function load() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-upd-'));
  const calls = { check: 0, quitAndInstall: [], dialogs: [], setFeed: [], addQuitHandler: 0 };
  const updater = new EventEmitter();
  Object.assign(updater, {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: () => { calls.check++; return Promise.resolve(); },
    checkForUpdatesAndNotify: () => { throw new Error('toast variant must not be used'); },
    quitAndInstall: (...a) => { calls.quitAndInstall.push(a); },
    setFeedURL: (o) => calls.setFeed.push(o),
    addQuitHandler: () => { calls.addQuitHandler++; },
    downloadUpdate: () => Promise.resolve(),
  });
  const power = new EventEmitter();
  const electron = {
    app: { isPackaged: true, getPath: () => userData },
    dialog: { showMessageBox: (...a) => { calls.dialogs.push(a); return Promise.resolve({ response: 1 }); } },
    powerMonitor: power,
  };
  const origLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'electron') return electron;
    if (request === 'electron-updater') return { autoUpdater: updater };
    return origLoad.call(this, request, ...rest);
  };
  const intervals = [];
  const origSI = global.setInterval;
  global.setInterval = (fn, ms) => { intervals.push({ fn, ms }); return { unref() {} }; };
  const modPath = require.resolve('../electron/updater.cjs');
  delete require.cache[modPath];
  const mod = require(modPath);
  const store = require('../electron/store.cjs');
  const restore = () => { Module._load = origLoad; global.setInterval = origSI; delete require.cache[modPath]; };
  return { mod, calls, updater, power, intervals, userData, store, restore };
}

describe('updater.cjs', () => {
  let h;
  const win = (visible = true) => ({ isDestroyed: () => false, isVisible: () => visible, isMinimized: () => false });
  beforeEach(() => { h = load(); h.store.setSettings({ updateFeedUrl: null, autoInstallUpdates: true }); });
  afterEach(() => h.restore());

  it('configures once: autoDownload on, install-on-quit follows the setting, no toast variant', async () => {
    await h.mod.autoCheckOnStartup();
    expect(h.updater.autoDownload).toBe(true);
    expect(h.updater.autoInstallOnAppQuit).toBe(true);
    expect(h.calls.check).toBe(1);
    h.store.setSettings({ autoInstallUpdates: false });
    h.mod.applySettings();
    expect(h.updater.autoInstallOnAppQuit).toBe(false);
  });

  it('a manual check does not wipe listeners or turn autoDownload off (old bug)', async () => {
    await h.mod.autoCheckOnStartup();
    const before = h.updater.listenerCount('update-downloaded');
    await h.mod.checkForUpdates();
    expect(h.updater.autoDownload).toBe(true);
    expect(h.updater.listenerCount('update-downloaded')).toBe(before);
    expect(h.calls.check).toBe(2);
  });

  it('checks every 6h but not while checking/downloading/downloaded', async () => {
    await h.mod.autoCheckOnStartup();
    const periodic = h.intervals.find((i) => i.ms === 6 * 60 * 60 * 1000);
    expect(periodic).toBeTruthy();
    periodic.fn();
    await Promise.resolve();
    expect(h.calls.check).toBe(2);
    h.updater.emit('checking-for-update');
    periodic.fn();
    expect(h.calls.check).toBe(2);
    h.updater.emit('update-available', { version: '2.6.0' });
    periodic.fn();
    expect(h.calls.check).toBe(2);
    h.updater.emit('update-downloaded', { version: '2.6.0' });
    periodic.fn();
    expect(h.calls.check).toBe(2);
    expect(h.mod.getDownloadedVersion()).toBe('2.6.0');
  });

  it('prompts once per version, only on a visible window, then silent restart on "restart now"', async () => {
    await h.mod.autoCheckOnStartup();
    h.updater.emit('update-downloaded', { version: '2.6.0' });
    h.mod.maybePrompt(win(false));
    expect(h.calls.dialogs.length).toBe(0); // hidden window: deferred
    h.mod.maybePrompt(win(true));
    expect(h.calls.dialogs.length).toBe(1);
    h.mod.maybePrompt(win(true));
    expect(h.calls.dialogs.length).toBe(1); // once per version
    const opts = h.calls.dialogs[0][1];
    expect(opts.detail).toMatch(/UAC/);
    expect(h.calls.quitAndInstall.length).toBe(0);
    h.mod.quitAndInstall();
    expect(h.calls.quitAndInstall).toEqual([[true, true]]);
  });

  it('a newer downloaded version prompts again', async () => {
    await h.mod.autoCheckOnStartup();
    h.updater.emit('update-downloaded', { version: '2.6.0' });
    h.mod.maybePrompt(win());
    h.updater.emit('update-downloaded', { version: '2.6.1' });
    h.mod.maybePrompt(win());
    expect(h.calls.dialogs.length).toBe(2);
  });

  it('turning install-on-quit on after a download registers the quit handler', async () => {
    h.store.setSettings({ autoInstallUpdates: false });
    await h.mod.autoCheckOnStartup();
    h.updater.emit('update-downloaded', { version: '2.6.0' });
    const before = h.calls.addQuitHandler;
    h.store.setSettings({ autoInstallUpdates: true });
    h.mod.applySettings();
    expect(h.calls.addQuitHandler).toBe(before + 1);
  });

  it('re-checks after wake only when overdue; errors are logged, never thrown', async () => {
    h.updater.checkForUpdates = () => { h.calls.check++; return Promise.reject(new Error('offline')); };
    await h.mod.autoCheckOnStartup();
    expect(h.mod.getStatus().state).toBe('error');
    h.power.emit('resume');
    await Promise.resolve();
    expect(h.calls.check).toBe(1); // last check was seconds ago: not overdue
    const log = fs.readFileSync(path.join(h.userData, 'updater.log'), 'utf8');
    expect(log).toMatch(/offline/);
  });

  it('a configured feed URL overrides GitHub and clearing it restores GitHub', async () => {
    h.store.setSettings({ updateFeedUrl: 'https://example.test/feed' });
    await h.mod.checkForUpdates();
    expect(h.calls.setFeed[0]).toEqual({ provider: 'generic', url: 'https://example.test/feed' });
    h.store.setSettings({ updateFeedUrl: null });
    await h.mod.checkForUpdates();
    expect(h.calls.setFeed[1]).toMatchObject({ provider: 'github', repo: 'familyquest-pc' });
  });
});
