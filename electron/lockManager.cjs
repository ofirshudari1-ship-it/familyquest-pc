const EventEmitter = require('events');
const economy = require('./economy.cjs');
const store = require('./store.cjs');
const activityMonitor = require('./activityMonitor.cjs');

const FIVE_MIN_MS = 5 * 60 * 1000;
const ONE_MIN_MS = 60 * 1000;
const APP_CHECK_INTERVAL_MS = 10000;
const APP_REFLAG_COOLDOWN_MS = 2 * 60 * 1000;

class LockManager extends EventEmitter {
  constructor() {
    super();
    this._warnedSessions = new Set(); // `${sessionId}:5` / `${sessionId}:1` already fired
    this._interval = null;
    this._appCheckInterval = null;
    this._lastFlagged = null; // { childId, app, at } — throttles repeat flags of the same app
  }

  // Pure computation of what the currently-selected child's screen should show right now.
  computeState() {
    const settings = store.getSettings();

    // Nothing to enforce yet — the parent hasn't set a PIN and added a child
    // (or has since removed every child). Locking the screen here would trap
    // them behind a kiosk overlay with no way to reach the dashboard that sets
    // any of this up, so treat it as fully open until there is something to lock.
    if (!settings.onboarded || economy.getChildren().length === 0) {
      return { status: 'setup' };
    }

    const { activeChildId } = settings;
    if (!activeChildId) return { status: 'picker' };
    const child = economy.getChild(activeChildId);
    if (!child) return { status: 'picker' };

    const active = economy.getActiveSession(activeChildId);
    if (active) {
      return {
        status: 'unlocked',
        childId: activeChildId,
        reason: active.reason,
        sessionId: active.id,
        remainingMs: Math.max(0, new Date(active.endTime).getTime() - Date.now())
      };
    }
    const restriction = economy.getActiveRestriction(child);
    if (restriction?.type === 'bedtime') {
      return { status: 'locked', childId: activeChildId, reason: 'bedtime' };
    }
    if (restriction?.type === 'restricted') {
      return { status: 'locked', childId: activeChildId, reason: 'restricted', label: restriction.label };
    }
    return { status: 'locked', childId: activeChildId, reason: 'no_time' };
  }

  freeze(childId) {
    economy.freeze(childId);
    this.tick();
  }

  start() {
    if (this._interval) return;
    this.tick();
    this._interval = setInterval(() => this.tick(), 3000);
    this._appCheckInterval = setInterval(() => this._checkForegroundApp(), APP_CHECK_INTERVAL_MS);
  }

  stop() {
    clearInterval(this._interval);
    this._interval = null;
    clearInterval(this._appCheckInterval);
    this._appCheckInterval = null;
  }

  // Only runs while a session is actually unlocked, and only for a child whose
  // parent has opted into an approved-apps list — silent no-op otherwise, so
  // this never spawns PowerShell for families that haven't configured it.
  async _checkForegroundApp() {
    const state = this.computeState();
    if (state.status !== 'unlocked') return;
    const child = economy.getChild(state.childId);
    if (!child || !child.allowedApps || child.allowedApps.length === 0) return;

    const app = await activityMonitor.getForegroundProcessName();
    if (activityMonitor.isAppAllowed(app, child.allowedApps)) return;

    const now = Date.now();
    const last = this._lastFlagged;
    if (last && last.childId === state.childId && last.app === app && now - last.at < APP_REFLAG_COOLDOWN_MS) {
      return; // already flagged this exact app recently — don't spam the log
    }
    this._lastFlagged = { childId: state.childId, app, at: now };
    economy.addAudit(state.childId, 'app_not_approved', `"${app}" אינה ברשימת האפליקציות המאושרות בזמן משחק`);
    this.emit('app-flagged', { childId: state.childId, app });
  }

  // `_warnedSessions` gets two new keys per screen-time session and is never
  // cleared — on a machine that runs for months this grows without bound. Once
  // it's comfortably past any realistic number of concurrently-relevant entries,
  // drop it and let it repopulate; a warning firing again for a session that's
  // already long over is harmless (computeState() only reads *active* sessions).
  _pruneWarnedSessions() {
    if (this._warnedSessions.size > 500) this._warnedSessions.clear();
  }

  tick() {
    economy.closeExpiredSessions();
    economy.resetRecurringTasks();
    this._pruneWarnedSessions();

    // Any coin credit / streak bonus anywhere (task approval, IPC handlers, this
    // tick itself) may have queued a celebration — relay each one exactly once.
    for (const c of economy.drainCelebrations()) this.emit('celebrate', c);

    const state = this.computeState();

    if (state.status === 'unlocked') {
      const key5 = `${state.sessionId}:5`;
      const key1 = `${state.sessionId}:1`;
      if (state.remainingMs <= FIVE_MIN_MS && !this._warnedSessions.has(key5)) {
        this._warnedSessions.add(key5);
        this.emit('warning', { childId: state.childId, minutesLeft: 5 });
      }
      if (state.remainingMs <= ONE_MIN_MS && !this._warnedSessions.has(key1)) {
        this._warnedSessions.add(key1);
        this.emit('warning', { childId: state.childId, minutesLeft: 1 });
      }
    }

    this.emit('state', state);
    return state;
  }
}

module.exports = new LockManager();
