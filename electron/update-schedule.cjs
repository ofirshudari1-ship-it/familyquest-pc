// When to check for updates and when to prompt. Pure helpers (no Electron) so the rules are
// unit-testable. FamilyQuest PC lives in the tray all day, so one check per launch is not enough:
// a first check shortly after launch, then every few hours, and one restart prompt per version.
// Same rules as TapAct / Playnest.

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const FIRST_CHECK_DELAY_MS = 5000; // shortly after launch

// A periodic check is skipped while one is already running or downloading, and once an update is
// downloaded and waiting (the parent already has the prompt / tray item; it also installs on quit).
function shouldRunPeriodicCheck(state) {
  return !(state === 'checking' || state === 'available' || state === 'downloading' || state === 'downloaded');
}

// The restart prompt is shown once per downloaded version, not at every periodic check.
function shouldPromptForVersion(notifiedVersion, version) {
  return !!version && notifiedVersion !== version;
}

// After the PC wakes from sleep, check right away if the last check is older than one interval.
function isCheckOverdue(lastCheckAtMs, nowMs, intervalMs = UPDATE_CHECK_INTERVAL_MS) {
  return !lastCheckAtMs || nowMs - lastCheckAtMs >= intervalMs;
}

module.exports = { UPDATE_CHECK_INTERVAL_MS, FIRST_CHECK_DELAY_MS, shouldRunPeriodicCheck, shouldPromptForVersion, isCheckOverdue };
