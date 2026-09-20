const Store = require('electron-store');

const DEFAULT_SETTINGS = {
  onboarded: false,
  pinHash: null,
  pinSalt: null,
  coinsPerMinute: 1,
  autostart: false,
  activeChildId: null,
  whitelist: [],
  soundEffectsEnabled: true,
  lowBalanceThreshold: 10,
  updateFeedUrl: null,
  siblingRecognitionEnabled: true,
  securityQuestionId: null,
  securityAnswerHash: null,
  securityAnswerSalt: null,
  lastWeeklyDigestSeenAt: null,
  // Background/tray behavior (STANDARDS.md §12 — FamilyQuest PC now runs as a
  // background family/screen-time app, not a one-shot tool): closing the parent
  // dashboard window hides it to the tray instead of quitting the whole app.
  minimizeToTray: true,
  trayBalloonShown: false,
  // Parent-facing heads-up when a child's session starts (screen time begins)
  // or ends (screen locks again) while the dashboard window isn't open/visible.
  notifyOnSessionChange: true
};

// Isolates the persisted store to a scratch directory during automated tests
// (see tests/setup.cjs) so a `npm test` run can never read from or write to a
// real parent/child's actual data file.
const storeOptions = { name: 'familyquest-data', defaults: {} };
if (process.env.FAMILYQUEST_TEST_STORE_DIR) {
  storeOptions.cwd = process.env.FAMILYQUEST_TEST_STORE_DIR;
}

const store = new Store({
  ...storeOptions,
  defaults: {
    children: [],
    tasks: [],
    sessions: [],
    audit: [],
    rewards: [],
    redemptions: [],
    familyGoal: null,
    coopQuests: [],
    settings: DEFAULT_SETTINGS,
    // Parent dashboard window size/position, remembered between sessions
    // (STANDARDS.md §12.3). Never stores a "minimized to tray" state here —
    // the dashboard simply isn't recreated until the parent asks for it again.
    dashboardBounds: null
  }
});

// A settings object saved by an older build (before a field existed) would keep
// that field permanently undefined otherwise — self-heal it on every read.
function getSettings() {
  const current = store.get('settings') || {};
  const merged = { ...DEFAULT_SETTINGS, ...current };
  if (Object.keys(merged).length !== Object.keys(current).length) {
    store.set('settings', merged);
  }
  return merged;
}

function setSettings(patch) {
  const merged = { ...getSettings(), ...patch };
  store.set('settings', merged);
  return merged;
}

module.exports = store;
module.exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
module.exports.getSettings = getSettings;
module.exports.setSettings = setSettings;
