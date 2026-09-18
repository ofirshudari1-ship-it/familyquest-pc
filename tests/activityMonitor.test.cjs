// Smoke tests for the pure helpers in electron/activityMonitor.cjs — the
// approved-apps allow-list check used by lockManager's foreground-app polling.
const { isAppAllowed, EXEMPT } = require('../electron/activityMonitor.cjs');

describe('isAppAllowed', () => {
  it('allows anything when no name could be detected', () => {
    expect(isAppAllowed(null, ['chrome'])).toBe(true);
  });

  it('always allows exempt system/shell processes', () => {
    for (const name of EXEMPT) {
      expect(isAppAllowed(name, [])).toBe(true);
    }
  });

  it('matches case-insensitively and ignores a trailing .exe on either side', () => {
    expect(isAppAllowed('Chrome', ['chrome.exe'])).toBe(true);
    expect(isAppAllowed('notepad.exe', ['Notepad'])).toBe(true);
  });

  it('blocks a process not on the allow-list', () => {
    expect(isAppAllowed('steam', ['chrome', 'word'])).toBe(false);
  });

  it('treats an empty allow-list as blocking everything not exempt', () => {
    expect(isAppAllowed('steam', [])).toBe(false);
  });
});
