const crypto = require('crypto');
const store = require('./store.cjs');

function uuid() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function todayKey(date = new Date()) {
  // Local calendar day, not UTC — a 23:50 session and a 00:05 one are different days.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addAudit(childId, type, message) {
  const audit = store.get('audit');
  audit.unshift({ id: uuid(), ts: nowIso(), childId: childId || null, type, message });
  // Keep the log from growing without bound on a machine that runs for years.
  if (audit.length > 5000) audit.length = 5000;
  store.set('audit', audit);
}

// ---------- Children ----------

// Fields added after a child was first created would be permanently undefined on
// that record otherwise — same self-heal approach as store.getSettings().
function normalizeChild(child) {
  if (!child) return child;
  const defaults = {
    weekendDailyLimitMins: null,
    lifetimeCoinsEarned: child.coinBalance || 0,
    streakMilestonesAwarded: [],
    restrictedWindows: [],
    allowedApps: [],
    coinMultiplier: null,
    companionId: 'dragon',
    themeColor: 'purple',
    lastSpinDate: null
  };
  return { ...defaults, ...child };
}

function getChildren() {
  return store.get('children').map(normalizeChild);
}

function getChild(childId) {
  return getChildren().find((c) => c.id === childId) || null;
}

function addChild({ name, avatarId, dailyTimeLimitMins, bedtimeStart, bedtimeEnd, weekendDailyLimitMins, companionId, themeColor }) {
  const child = {
    id: uuid(),
    name: String(name).trim(),
    avatarId: avatarId || 'fox',
    coinBalance: 0,
    lifetimeCoinsEarned: 0,
    dailyTimeLimitMins: Number(dailyTimeLimitMins) || 120,
    weekendDailyLimitMins: weekendDailyLimitMins === undefined || weekendDailyLimitMins === null ? null : Number(weekendDailyLimitMins),
    bedtimeStart: bedtimeStart || '20:30',
    bedtimeEnd: bedtimeEnd || '07:00',
    streakMilestonesAwarded: [],
    restrictedWindows: [],
    allowedApps: [],
    coinMultiplier: null,
    companionId: companionId || 'dragon',
    themeColor: themeColor || 'purple',
    lastSpinDate: null,
    createdAt: nowIso()
  };
  const children = getChildren();
  children.push(child);
  store.set('children', children);
  addAudit(child.id, 'child_created', `נוצר פרופיל עבור ${child.name}`);
  return child;
}

function updateChild(childId, patch) {
  const children = getChildren();
  const idx = children.findIndex((c) => c.id === childId);
  if (idx === -1) throw new Error('Child not found');
  children[idx] = { ...children[idx], ...patch, id: children[idx].id };
  store.set('children', children);
  return children[idx];
}

function removeChild(childId) {
  store.set('children', getChildren().filter((c) => c.id !== childId));
  store.set('tasks', store.get('tasks').filter((t) => t.childId !== childId));
  store.set('sessions', store.get('sessions').filter((s) => s.childId !== childId));
  store.set('rewards', (store.get('rewards') || []).filter((r) => r.childId !== childId));
  store.set('redemptions', (store.get('redemptions') || []).filter((r) => r.childId !== childId));
  const settings = store.getSettings();
  if (settings.activeChildId === childId) store.setSettings({ activeChildId: null });
}

// ---------- Tasks / Quests ----------

function getTasks(childId) {
  const tasks = store.get('tasks');
  return childId ? tasks.filter((t) => t.childId === childId) : tasks;
}

// null/undefined means "use the plain daily/weekly period math below" — fully
// backward compatible with tasks saved before this field existed.
function normalizeActiveDays(activeDays) {
  if (!Array.isArray(activeDays) || activeDays.length === 0) return null;
  const days = [...new Set(activeDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return days.length ? days : null;
}

function createTask({ childId, title, rewardCoins, requiresProof, recurrence, notes, activeDays, coopId }) {
  const task = {
    id: uuid(),
    childId,
    title: String(title).trim(),
    rewardCoins: Math.max(0, Number(rewardCoins) || 0),
    requiresProof: requiresProof === true,
    recurrence: ['once', 'daily', 'weekly'].includes(recurrence) ? recurrence : 'once',
    activeDays: normalizeActiveDays(activeDays),
    coopId: coopId || null,
    status: 'pending',
    notes: notes || '',
    createdAt: nowIso(),
    submittedAt: null,
    decidedAt: null,
    proofPath: null
  };
  const tasks = store.get('tasks');
  tasks.push(task);
  store.set('tasks', tasks);
  return task;
}

function saveTask(task) {
  const tasks = store.get('tasks');
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx === -1) throw new Error('Task not found');
  tasks[idx] = task;
  store.set('tasks', tasks);
  return task;
}

function getTask(taskId) {
  const task = store.get('tasks').find((t) => t.id === taskId);
  if (!task) throw new Error('Task not found');
  return task;
}

// Child marks a quest done. Every quest — no exceptions — waits for an
// explicit parent approveTask()/rejectTask() call; a child can never pay
// themselves. A task flagged requiresProof cannot even be submitted without
// a photo — enforced here, not just as a UI nicety, since this is the actual
// source of truth main.cjs's file-picker dialog defers to.
function submitTask(taskId, proofPath) {
  const task = getTask(taskId);
  if (task.requiresProof && !proofPath) {
    throw new Error('תמונה נדרשת להשלמת המשימה הזו');
  }
  task.submittedAt = nowIso();
  task.proofPath = proofPath || null;
  task.status = 'submitted';
  addAudit(task.childId, 'quest_submitted', `"${task.title}" דווח כבוצע וממתין לאישור הורה`);
  return saveTask(task);
}

function approveTask(taskId) {
  const task = getTask(taskId);
  if (task.status !== 'submitted') throw new Error('Task is not awaiting approval');
  task.status = 'approved';
  task.decidedAt = nowIso();
  saveTask(task);
  creditCoins(task.childId, task.rewardCoins);
  addAudit(task.childId, 'quest_approved', `"${task.title}" אושר על ידי ההורה (+${task.rewardCoins} מטבעות)`);
  checkStreakBonuses(task.childId);
  if (task.coopId) checkCoopCompletion(task.coopId);
  return task;
}

function rejectTask(taskId, note) {
  const task = getTask(taskId);
  if (task.status !== 'submitted') throw new Error('Task is not awaiting approval');
  task.status = 'rejected';
  task.decidedAt = nowIso();
  task.notes = note || task.notes;
  saveTask(task);
  addAudit(task.childId, 'quest_rejected', `"${task.title}" נדחה${note ? `: ${note}` : ''}`);
  return task;
}

function deleteTask(taskId) {
  store.set('tasks', store.get('tasks').filter((t) => t.id !== taskId));
}

// ---------- Co-op quests (sibling teamwork) ----------
// A co-op quest is just N ordinary per-child Task rows sharing one coopId, plus
// a lightweight record tracking the group and its shared bonus — reuses the
// entire existing task lifecycle (submit/approve/reject/reset) rather than a
// parallel system.

function createCoopQuest({ title, rewardCoins, bonusCoins, requiresProof, recurrence, childIds }) {
  const uniqueChildIds = [...new Set(childIds || [])];
  if (uniqueChildIds.length < 2) throw new Error('משימת שיתוף פעולה דורשת לפחות שני ילדים');
  if (!String(title || '').trim()) throw new Error('כותרת חסרה');
  const bonus = Math.max(0, Number(bonusCoins) || 0);

  const coopId = uuid();
  const taskIds = uniqueChildIds.map(
    (childId) => createTask({ childId, title, rewardCoins, requiresProof, recurrence: recurrence || 'once', coopId }).id
  );

  const coop = {
    id: coopId,
    title: String(title).trim(),
    bonusCoins: bonus,
    childIds: uniqueChildIds,
    taskIds,
    createdAt: nowIso(),
    completedAt: null
  };
  const coopQuests = store.get('coopQuests') || [];
  coopQuests.push(coop);
  store.set('coopQuests', coopQuests);
  addAudit(null, 'coop_quest_created', `משימת שיתוף פעולה חדשה: "${coop.title}" (${uniqueChildIds.length} ילדים)`);
  return coop;
}

// Called after any task tied to a coopId becomes 'approved'. Awards the shared
// bonus to every participant exactly once, only once every participant's task
// is approved — a safe no-op otherwise (including if called again afterward).
function checkCoopCompletion(coopId) {
  const coopQuests = store.get('coopQuests') || [];
  const idx = coopQuests.findIndex((c) => c.id === coopId);
  if (idx === -1 || coopQuests[idx].completedAt) return;
  const coop = coopQuests[idx];

  const tasks = store.get('tasks');
  const siblingTasks = coop.taskIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean);
  if (siblingTasks.length < coop.taskIds.length) return; // a task was deleted — can never complete
  if (!siblingTasks.every((t) => t.status === 'approved')) return;

  coop.completedAt = nowIso();
  coopQuests[idx] = coop;
  store.set('coopQuests', coopQuests);

  for (const childId of coop.childIds) {
    if (coop.bonusCoins > 0) creditCoins(childId, coop.bonusCoins);
  }
  addAudit(null, 'coop_quest_complete', `שיתוף הפעולה "${coop.title}" הושלם על ידי כולם! בונוס ${coop.bonusCoins} מטבעות לכל משתתף`);
  queueCelebration(null, 'coop_complete', { title: coop.title, bonusCoins: coop.bonusCoins });
}

// Every coop group a child participates in (or all of them, if no childId is
// given), each annotated with live progress so the UI never has to join task
// and coop data itself.
function getCoopQuests(childId) {
  const coopQuests = store.get('coopQuests') || [];
  const tasks = store.get('tasks');
  const filtered = childId ? coopQuests.filter((c) => c.childIds.includes(childId)) : coopQuests;
  return filtered.map((c) => {
    const siblingTasks = c.taskIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean);
    // Representative per-child terms for display/editing — prefer a still-pending
    // task (what a not-yet-decided child would get), falling back to any task.
    const representative = siblingTasks.find((t) => t.status === 'pending') || siblingTasks[0];
    return {
      ...c,
      approvedCount: siblingTasks.filter((t) => t.status === 'approved').length,
      totalCount: c.childIds.length,
      rewardCoins: representative ? representative.rewardCoins : 0,
      requiresProof: representative ? representative.requiresProof : false
    };
  });
}

function getCoopQuestOrThrow(coopId) {
  const coopQuests = store.get('coopQuests') || [];
  const idx = coopQuests.findIndex((c) => c.id === coopId);
  if (idx === -1) throw new Error('שיתוף הפעולה לא נמצא');
  if (coopQuests[idx].completedAt) throw new Error('אי אפשר לשנות שיתוף פעולה שכבר הושלם');
  return { coopQuests, idx };
}

// Edits a still-in-progress co-op quest. title/rewardCoins/requiresProof
// only propagate to sibling tasks still 'pending' — a child whose task is
// already submitted/approved/rejected already has a decided outcome under the
// original terms, and editing must not retroactively change that.
function updateCoopQuest(coopId, { title, rewardCoins, bonusCoins, requiresProof }) {
  const { coopQuests, idx } = getCoopQuestOrThrow(coopId);
  const coop = coopQuests[idx];

  if (title !== undefined && String(title).trim()) coop.title = String(title).trim();
  if (bonusCoins !== undefined) coop.bonusCoins = Math.max(0, Number(bonusCoins) || 0);
  coopQuests[idx] = coop;
  store.set('coopQuests', coopQuests);

  const tasks = store.get('tasks');
  for (const taskId of coop.taskIds) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status !== 'pending') continue;
    if (title !== undefined && String(title).trim()) task.title = coop.title;
    if (rewardCoins !== undefined) task.rewardCoins = Math.max(0, Number(rewardCoins) || 0);
    if (requiresProof !== undefined) task.requiresProof = requiresProof === true;
    saveTask(task);
  }

  addAudit(null, 'coop_quest_updated', `שיתוף הפעולה "${coop.title}" עודכן`);
  return coop;
}

// Cancels a still-in-progress co-op quest. Undecided sibling tasks (pending or
// submitted) are removed outright; a sibling task that already has a decided
// outcome (approved/rejected) is left in place — that child's coins or
// rejection already happened — but detached from the group (coopId cleared)
// so the UI stops looking up a coop record that's about to disappear.
function cancelCoopQuest(coopId) {
  const { coopQuests, idx } = getCoopQuestOrThrow(coopId);
  const coop = coopQuests[idx];

  const tasks = store.get('tasks');
  for (const taskId of coop.taskIds) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) continue;
    if (task.status === 'pending' || task.status === 'submitted') {
      deleteTask(task.id);
    } else {
      task.coopId = null;
      saveTask(task);
    }
  }

  store.set('coopQuests', (store.get('coopQuests') || []).filter((c) => c.id !== coopId));
  addAudit(null, 'coop_quest_canceled', `שיתוף הפעולה "${coop.title}" בוטל`);
}

// Calendar-day difference (not a rolling 24h window) — a "daily" quest done at
// 7am should reopen at the next local midnight, not at 7am the next day.
function calendarDaysBetween(basisDate, now) {
  const a = new Date(basisDate.getFullYear(), basisDate.getMonth(), basisDate.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / 86400000);
}

// Daily/weekly quests reopen once their calendar period has elapsed since the
// last decision — unless the parent picked specific weekdays (activeDays), in
// which case the quest only reopens on a matching weekday, at most once per day.
// Called on a scheduler tick (see lockManager.cjs) — cheap and idempotent.
function resetRecurringTasks() {
  const tasks = store.get('tasks');
  const now = new Date();
  let changed = false;
  for (const task of tasks) {
    if (task.recurrence === 'once') continue;
    if (task.status === 'pending') continue;
    const basis = task.decidedAt || task.submittedAt;
    if (!basis) continue;
    const days = calendarDaysBetween(new Date(basis), now);
    let shouldReset;
    if (task.activeDays && task.activeDays.length) {
      shouldReset = days >= 1 && task.activeDays.includes(now.getDay());
    } else {
      const periodDays = task.recurrence === 'daily' ? 1 : 7;
      shouldReset = days >= periodDays;
    }
    if (shouldReset) {
      task.status = 'pending';
      task.submittedAt = null;
      task.decidedAt = null;
      task.proofPath = null;
      changed = true;
    }
  }
  if (changed) store.set('tasks', tasks);
}

// ---------- Coins ----------

// One-shot "something worth celebrating just happened" signals. Any code path
// that credits coins or awards a streak bonus can push here without knowing or
// caring who's listening — lockManager drains this on every tick and relays it
// to the renderer as a 'celebrate' event. Kept in-memory only (not persisted):
// missing a celebration animation after a restart is harmless, unlike losing data.
let pendingCelebrations = [];
function queueCelebration(childId, type, payload) {
  pendingCelebrations.push({ childId, type, payload });
}
function drainCelebrations() {
  const items = pendingCelebrations;
  pendingCelebrations = [];
  return items;
}

// A parent-granted temporary boost (see grantCoinMultiplier) — expired ones are
// treated as absent rather than requiring a separate cleanup pass.
function getActiveMultiplier(child, at = new Date()) {
  if (!child.coinMultiplier) return null;
  if (new Date(child.coinMultiplier.expiresAt) <= at) return null;
  return child.coinMultiplier;
}

function grantCoinMultiplier(childId, value, durationMs) {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');
  const mult = Math.round(Number(value) * 10) / 10;
  const duration = Math.round(Number(durationMs));
  if (!Number.isFinite(mult) || mult <= 1) throw new Error('מכפיל לא תקין');
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('משך זמן לא תקין');
  const expiresAt = new Date(Date.now() + duration).toISOString();
  updateChild(childId, { coinMultiplier: { value: mult, expiresAt } });
  addAudit(
    childId,
    'multiplier_granted',
    `בונוס מטבעות פי ${mult} עד ${new Date(expiresAt).toLocaleString('he-IL')}`
  );
  return getChild(childId);
}

function clearCoinMultiplier(childId) {
  return updateChild(childId, { coinMultiplier: null });
}

// ---------- Family goal ----------
// A single shared "thermometer" all children fill together as they earn coins —
// contributing doesn't cost the child anything, it's a parallel tally alongside
// their own balance. Deliberately just one active goal at a time (no competing
// goals, no per-child targets) to keep it a simple shared thing to root for.

function getFamilyGoal() {
  return store.get('familyGoal') || null;
}

function createFamilyGoal({ title, emoji, targetCoins, rewardText }) {
  const target = Math.round(Number(targetCoins));
  if (!String(title || '').trim()) throw new Error('כותרת חסרה');
  if (!Number.isFinite(target) || target <= 0) throw new Error('יעד מטבעות לא תקין');
  const goal = {
    id: uuid(),
    title: String(title).trim(),
    emoji: emoji || '🎯',
    targetCoins: target,
    rewardText: String(rewardText || '').trim(),
    contributedCoins: 0,
    createdAt: nowIso(),
    completedAt: null
  };
  store.set('familyGoal', goal);
  addAudit(null, 'family_goal_created', `יעד משפחתי חדש: "${goal.title}" (${target} מטבעות)`);
  return goal;
}

function clearFamilyGoal() {
  store.set('familyGoal', null);
}

// Called from creditCoins for every coin any child earns while a goal is active —
// the family "pool" grows alongside (not instead of) the child's own balance.
function contributeToFamilyGoal(amount) {
  if (amount <= 0) return;
  const goal = getFamilyGoal();
  if (!goal || goal.completedAt) return;
  goal.contributedCoins += amount;
  if (goal.contributedCoins >= goal.targetCoins) {
    goal.contributedCoins = goal.targetCoins;
    goal.completedAt = nowIso();
    addAudit(null, 'family_goal_complete', `היעד המשפחתי "${goal.title}" הושג!`);
    queueCelebration(null, 'family_goal_complete', { title: goal.title, rewardText: goal.rewardText });
  }
  store.set('familyGoal', goal);
}

function creditCoins(childId, amount) {
  const child = getChild(childId);
  const multiplier = getActiveMultiplier(child);
  const finalAmount = multiplier ? Math.round(amount * multiplier.value) : amount;
  const beforeLevel = getLevel(childId).level;

  const updated = updateChild(childId, {
    coinBalance: child.coinBalance + finalAmount,
    lifetimeCoinsEarned: child.lifetimeCoinsEarned + Math.max(0, finalAmount)
  });

  const afterLevel = getLevel(childId);
  if (afterLevel.level > beforeLevel) {
    queueCelebration(childId, 'level_up', { level: afterLevel.level, title: afterLevel.title });
    addAudit(childId, 'level_up', `עלה/תה לרמה ${afterLevel.level}! (${afterLevel.title})`);
  }
  contributeToFamilyGoal(Math.max(0, finalAmount));
  return updated;
}

function debitCoins(childId, amount) {
  const child = getChild(childId);
  if (child.coinBalance < amount) throw new Error('Insufficient coin balance');
  return updateChild(childId, { coinBalance: child.coinBalance - amount });
}

// ---------- Screen time sessions ----------

function getSessions(childId) {
  const sessions = store.get('sessions');
  return childId ? sessions.filter((s) => s.childId === childId) : sessions;
}

function minutesUsedToday(childId) {
  const key = todayKey();
  return getSessions(childId)
    .filter((s) => todayKey(new Date(s.startTime)) === key)
    .reduce((sum, s) => sum + s.minutesGranted, 0);
}

// Israeli weekend (Friday/Saturday) — matches the Hebrew-first audience this app
// targets. Used only for the optional per-child weekend limit override.
function isWeekend(at = new Date()) {
  const day = at.getDay();
  return day === 5 || day === 6;
}

function effectiveDailyLimit(child, at = new Date()) {
  if (isWeekend(at) && child.weekendDailyLimitMins !== null && child.weekendDailyLimitMins !== undefined) {
    return child.weekendDailyLimitMins;
  }
  return child.dailyTimeLimitMins;
}

// Time ranges commonly cross midnight (e.g. 20:30-07:00); this treats both
// same-day and overnight ranges correctly against the given instant.
function isWithinTimeRange(startStr, endStr, at = new Date()) {
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);
  const minsNow = at.getHours() * 60 + at.getMinutes();
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;
  if (startMins === endMins) return false; // zero-length window = disabled
  if (startMins < endMins) return minsNow >= startMins && minsNow < endMins;
  return minsNow >= startMins || minsNow < endMins; // overnight wrap
}

function isBedtime(child, at = new Date()) {
  return isWithinTimeRange(child.bedtimeStart, child.bedtimeEnd, at);
}

// Named restriction windows beyond bedtime (e.g. "school hours", Mon-Fri 08:00-15:00).
function createRestrictedWindow({ childId, label, days, start, end }) {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');
  const window = {
    id: uuid(),
    label: String(label).trim(),
    days: Array.isArray(days) ? days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
    start,
    end
  };
  updateChild(childId, { restrictedWindows: [...(child.restrictedWindows || []), window] });
  return window;
}

function removeRestrictedWindow(childId, windowId) {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');
  updateChild(childId, { restrictedWindows: (child.restrictedWindows || []).filter((w) => w.id !== windowId) });
}

// Returns the first matching restriction active right now — bedtime takes
// precedence for messaging purposes, then custom windows in list order.
function getActiveRestriction(child, at = new Date()) {
  if (isBedtime(child, at)) return { type: 'bedtime', label: null };
  const day = at.getDay();
  for (const w of child.restrictedWindows || []) {
    if (w.days.includes(day) && isWithinTimeRange(w.start, w.end, at)) {
      return { type: 'restricted', label: w.label };
    }
  }
  return null;
}

function getActiveSession(childId) {
  const now = new Date();
  return (
    getSessions(childId).find((s) => !s.actualEndTime && new Date(s.endTime) > now) || null
  );
}

function redeemMinutes(childId, minutes) {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');
  const requestedMinutes = Math.round(Number(minutes));
  if (!Number.isFinite(requestedMinutes) || requestedMinutes <= 0) throw new Error('מספר דקות לא תקין');
  if (getActiveSession(childId)) throw new Error('כבר יש סשן פעיל');
  const restriction = getActiveRestriction(child);
  if (restriction?.type === 'bedtime') throw new Error('שעת שינה - אי אפשר לפדות זמן מסך כרגע');
  if (restriction?.type === 'restricted') throw new Error(`${restriction.label} - אי אפשר לפדות זמן מסך כרגע`);

  const usedToday = minutesUsedToday(childId);
  const remainingDailyMins = effectiveDailyLimit(child) - usedToday;
  if (remainingDailyMins <= 0) throw new Error('המכסה היומית נוצלה');
  const grantMinutes = Math.min(requestedMinutes, remainingDailyMins);

  const { coinsPerMinute } = store.getSettings();
  const cost = Math.ceil(grantMinutes * coinsPerMinute);
  if (child.coinBalance < cost) throw new Error('אין מספיק מטבעות');

  debitCoins(childId, cost);
  const session = {
    id: uuid(),
    childId,
    coinsSpent: cost,
    minutesGranted: grantMinutes,
    startTime: nowIso(),
    endTime: new Date(Date.now() + grantMinutes * 60000).toISOString(),
    actualEndTime: null,
    reason: 'redeem'
  };
  const sessions = store.get('sessions');
  sessions.push(session);
  store.set('sessions', sessions);
  addAudit(childId, 'time_redeemed', `נפדו ${grantMinutes} דקות תמורת ${cost} מטבעות`);
  return session;
}

// Parent-granted free time (e.g. supervised homework/video call) — bypasses coin
// cost, the daily cap and bedtime, since it is an explicit override.
function grantHomeworkPass(childId, minutes) {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');
  const grantMinutes = Math.round(Number(minutes));
  if (!Number.isFinite(grantMinutes) || grantMinutes <= 0) throw new Error('מספר דקות לא תקין');
  if (getActiveSession(childId)) endSession(getActiveSession(childId).id);
  const session = {
    id: uuid(),
    childId,
    coinsSpent: 0,
    minutesGranted: grantMinutes,
    startTime: nowIso(),
    endTime: new Date(Date.now() + grantMinutes * 60000).toISOString(),
    actualEndTime: null,
    reason: 'homework_pass'
  };
  const sessions = store.get('sessions');
  sessions.push(session);
  store.set('sessions', sessions);
  addAudit(childId, 'homework_pass_granted', `ההורה העניק מעבר שיעורי בית: ${minutes} דקות`);
  return session;
}

function endSession(sessionId, reason) {
  const sessions = store.get('sessions');
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;
  sessions[idx].actualEndTime = nowIso();
  store.set('sessions', sessions);
  const session = sessions[idx];
  if (reason) addAudit(session.childId, 'session_ended', reason);
  return session;
}

function getTodayLimit(childId) {
  const child = getChild(childId);
  if (!child) return 0;
  return effectiveDailyLimit(child);
}

// ---------- Streaks & badges ----------

const STREAK_MILESTONES = [3, 7, 14, 30, 60];
const STREAK_BONUS_COINS = { 3: 5, 7: 10, 14: 20, 30: 40, 60: 80 };

// Consecutive calendar days (ending today or yesterday — today not having a
// decision yet doesn't break an existing streak) with at least one approved quest.
function computeStreak(childId) {
  const approvedDays = new Set(
    getTasks(childId)
      .filter((t) => t.status === 'approved' && t.decidedAt)
      .map((t) => todayKey(new Date(t.decidedAt)))
  );
  if (approvedDays.size === 0) return 0;

  const cursor = new Date();
  if (!approvedDays.has(todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!approvedDays.has(todayKey(cursor))) return 0;
  }

  let streak = 0;
  while (approvedDays.has(todayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Awards each streak milestone at most once per child. Call after any quest
// approval (auto or manual) — cheap and idempotent.
function checkStreakBonuses(childId) {
  const child = getChild(childId);
  if (!child) return;
  const streak = computeStreak(childId);
  const awarded = child.streakMilestonesAwarded || [];
  const newlyReached = STREAK_MILESTONES.filter((m) => streak >= m && !awarded.includes(m));
  if (newlyReached.length === 0) return;

  let totalBonus = 0;
  for (const m of newlyReached) totalBonus += STREAK_BONUS_COINS[m];
  updateChild(childId, { streakMilestonesAwarded: [...awarded, ...newlyReached] });
  creditCoins(childId, totalBonus);
  const top = Math.max(...newlyReached);
  addAudit(childId, 'streak_bonus', `רצף של ${top} ימים! בונוס של ${totalBonus} מטבעות`);
  queueCelebration(childId, 'streak_milestone', { days: top, bonus: totalBonus });
}

// Declarative statKey/target shape (rather than an opaque test closure) so the
// trophy room can show real "3/10" progress on a badge that isn't earned yet,
// not just a yes/no. Every badge here is a plain `stat >= target` check.
const BADGE_CATALOG = [
  { id: 'first_quest', emoji: '🌱', title: 'צעד ראשון', statKey: 'approvedCount', target: 1 },
  { id: 'streak3', emoji: '🔥', title: 'רצף 3 ימים', statKey: 'streak', target: 3 },
  { id: 'streak7', emoji: '🔥🔥', title: 'רצף 7 ימים', statKey: 'streak', target: 7 },
  { id: 'streak30', emoji: '🔥🔥🔥', title: 'רצף 30 יום', statKey: 'streak', target: 30 },
  { id: 'quests10', emoji: '💪', title: '10 משימות', statKey: 'approvedCount', target: 10 },
  { id: 'quests50', emoji: '🏆', title: '50 משימות', statKey: 'approvedCount', target: 50 },
  { id: 'coins200', emoji: '🪙', title: 'אספן מטבעות', statKey: 'lifetimeCoinsEarned', target: 200 },
  { id: 'first_reward', emoji: '🎁', title: 'קנייה ראשונה', statKey: 'redemptionsCount', target: 1 }
];

function badgeStats(childId) {
  const child = getChild(childId);
  if (!child) return null;
  return {
    approvedCount: getTasks(childId).filter((t) => t.status === 'approved').length,
    streak: computeStreak(childId),
    lifetimeCoinsEarned: child.lifetimeCoinsEarned,
    redemptionsCount: getRedemptions(childId).length
  };
}

function getBadges(childId) {
  const stats = badgeStats(childId);
  if (!stats) return [];
  return BADGE_CATALOG.filter((b) => stats[b.statKey] >= b.target).map(({ id, emoji, title }) => ({ id, emoji, title }));
}

// Every badge, locked or not, with its current progress — powers the trophy room.
function getBadgeProgress(childId) {
  const stats = badgeStats(childId);
  if (!stats) return [];
  return BADGE_CATALOG.map(({ id, emoji, title, statKey, target }) => ({
    id,
    emoji,
    title,
    target,
    current: Math.min(stats[statKey], target),
    unlocked: stats[statKey] >= target
  }));
}

// ---------- Prize wheel ----------
// One free spin per child per day. Every segment is a net-positive outcome —
// no empty/losing slot — this is a fun bonus layered on top of the real
// progression (quests/streaks/level), never a way to lose ground. The full
// catalog (including weight) is exposed to the renderer via getSpinCatalog so
// the wheel's drawn segments always match what the backend can actually award,
// the same "no invented client-side data" principle as templates.ts/insights.cjs.
const SPIN_PRIZES = [
  { id: 'coins_small', emoji: '🪙', label: '3 מטבעות', weight: 30, type: 'coins', amount: 3 },
  { id: 'coins_medium', emoji: '💰', label: '8 מטבעות', weight: 28, type: 'coins', amount: 8 },
  { id: 'coins_large', emoji: '💎', label: '15 מטבעות', weight: 18, type: 'coins', amount: 15 },
  { id: 'coins_jackpot', emoji: '🎉', label: '30 מטבעות', weight: 9, type: 'coins', amount: 30 },
  { id: 'multiplier_short', emoji: '⚡', label: 'מכפיל פי 1.5 לשעה', weight: 10, type: 'multiplier', amount: 1.5, durationMs: 60 * 60 * 1000 },
  { id: 'multiplier_long', emoji: '🌟', label: 'מכפיל פי 2 ל-3 שעות', weight: 5, type: 'multiplier', amount: 2, durationMs: 3 * 60 * 60 * 1000 }
];

function getSpinCatalog() {
  return SPIN_PRIZES;
}

function canSpinToday(childId) {
  const child = getChild(childId);
  if (!child) return false;
  return child.lastSpinDate !== todayKey();
}

function pickWeightedPrize() {
  const totalWeight = SPIN_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const prize of SPIN_PRIZES) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return SPIN_PRIZES[0];
}

function spinWheel(childId) {
  if (!canSpinToday(childId)) throw new Error('כבר סובבתם היום — נסו שוב מחר');
  const prize = pickWeightedPrize();
  if (prize.type === 'coins') {
    creditCoins(childId, prize.amount);
  } else {
    grantCoinMultiplier(childId, prize.amount, prize.durationMs);
  }
  updateChild(childId, { lastSpinDate: todayKey() });
  addAudit(childId, 'wheel_spin', `גלגל המזל: ${prize.label}`);
  return { prizeId: prize.id, emoji: prize.emoji, label: prize.label, type: prize.type, amount: prize.amount };
}

// ---------- Level / XP ----------

const COINS_PER_LEVEL = 100;
const LEVEL_TITLES = [
  { min: 1, title: 'טירון' },
  { min: 3, title: 'חוקר' },
  { min: 5, title: 'הרפתקן' },
  { min: 8, title: 'גיבור' },
  { min: 12, title: 'אלוף' },
  { min: 16, title: 'אגדה' },
  { min: 20, title: 'סופר-אגדה' }
];

// Level is derived purely from lifetime coins earned (never spent down), so it
// only ever goes up — a stable long-term progression signal distinct from the
// spendable coin balance shown everywhere else.
function getLevel(childId) {
  const child = getChild(childId);
  if (!child) return null;
  const level = Math.floor(child.lifetimeCoinsEarned / COINS_PER_LEVEL) + 1;
  const title = [...LEVEL_TITLES].reverse().find((t) => level >= t.min)?.title || LEVEL_TITLES[0].title;
  const coinsIntoLevel = child.lifetimeCoinsEarned % COINS_PER_LEVEL;
  return {
    level,
    title,
    coinsIntoLevel,
    coinsToNextLevel: COINS_PER_LEVEL - coinsIntoLevel,
    progress: coinsIntoLevel / COINS_PER_LEVEL
  };
}

// ---------- Reward shop ----------

function getRewards(childId) {
  // tier was added after some rewards may already exist — same self-heal as
  // normalizeChild, just not worth persisting back for a single cosmetic field.
  const rewards = (store.get('rewards') || []).map((r) => ({ tier: 'small', ...r }));
  return childId ? rewards.filter((r) => r.childId === childId) : rewards;
}

function createReward({ childId, title, cost, emoji, tier }) {
  const reward = {
    id: uuid(),
    childId,
    title: String(title).trim(),
    cost: Math.max(1, Number(cost) || 1),
    emoji: emoji || '🎁',
    tier: ['small', 'medium', 'large'].includes(tier) ? tier : 'small',
    createdAt: nowIso()
  };
  const rewards = store.get('rewards') || [];
  rewards.push(reward);
  store.set('rewards', rewards);
  return reward;
}

function deleteReward(rewardId) {
  store.set('rewards', (store.get('rewards') || []).filter((r) => r.id !== rewardId));
}

function getRedemptions(childId) {
  const redemptions = store.get('redemptions') || [];
  return childId ? redemptions.filter((r) => r.childId === childId) : redemptions;
}

// Child spends coins to request a non-screen-time prize; the parent later marks
// it fulfilled once they've actually handed it over. Coins are spent immediately,
// same as a screen-time redemption, so the balance always reflects reality.
function requestReward(childId, rewardId) {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');
  const reward = (store.get('rewards') || []).find((r) => r.id === rewardId);
  if (!reward) throw new Error('Reward not found');
  debitCoins(childId, reward.cost);

  const redemption = {
    id: uuid(),
    childId,
    rewardId,
    rewardTitle: reward.title,
    rewardEmoji: reward.emoji,
    cost: reward.cost,
    status: 'pending',
    requestedAt: nowIso(),
    fulfilledAt: null
  };
  const redemptions = store.get('redemptions') || [];
  redemptions.push(redemption);
  store.set('redemptions', redemptions);
  addAudit(childId, 'reward_requested', `"${reward.title}" נפדה תמורת ${reward.cost} מטבעות`);
  return redemption;
}

function fulfillRedemption(redemptionId) {
  const redemptions = store.get('redemptions') || [];
  const idx = redemptions.findIndex((r) => r.id === redemptionId);
  if (idx === -1) throw new Error('Redemption not found');
  redemptions[idx].status = 'fulfilled';
  redemptions[idx].fulfilledAt = nowIso();
  store.set('redemptions', redemptions);
  addAudit(redemptions[idx].childId, 'reward_fulfilled', `"${redemptions[idx].rewardTitle}" נמסר`);
  return redemptions[idx];
}

function freeze(childId) {
  const active = getActiveSession(childId);
  if (active) endSession(active.id, 'הופסק על ידי הורה (הקפאת חירום)');
  addAudit(childId, 'parent_freeze', 'ההורה נעל את המחשב מיידית');
}

// getActiveSession excludes sessions whose planned end has already passed, but their
// actualEndTime is never set unless something marks them closed — do that here so
// reports and "is anyone in an active session" checks stay accurate.
function closeExpiredSessions() {
  const sessions = store.get('sessions');
  const now = new Date();
  let changed = false;
  for (const s of sessions) {
    if (!s.actualEndTime && new Date(s.endTime) <= now) {
      s.actualEndTime = s.endTime;
      changed = true;
      addAudit(s.childId, 'session_expired', `הזמן נגמר (${s.minutesGranted} דקות)`);
    }
  }
  if (changed) store.set('sessions', sessions);
  return changed;
}

// ---------- Reports ----------

function usageByDay(childId, days = 7) {
  const sessions = getSessions(childId);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const minutes = sessions
      .filter((s) => todayKey(new Date(s.startTime)) === key)
      .reduce((sum, s) => sum + s.minutesGranted, 0);
    result.push({ date: key, minutes });
  }
  return result;
}

function completionRate(childId, days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const decided = getTasks(childId).filter(
    (t) => (t.status === 'approved' || t.status === 'rejected') && t.decidedAt && new Date(t.decidedAt).getTime() >= cutoff
  );
  const approved = decided.filter((t) => t.status === 'approved').length;
  const total = decided.length;
  return { approved, total, rate: total === 0 ? null : approved / total };
}

function getAuditEntries(childId, limit = 200) {
  const audit = store.get('audit');
  const filtered = childId ? audit.filter((a) => a.childId === childId) : audit;
  return filtered.slice(0, limit);
}

function coinsEarnedByDay(childId, days = 7) {
  const tasks = getTasks(childId).filter((t) => t.status === 'approved' && t.decidedAt);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const coins = tasks
      .filter((t) => todayKey(new Date(t.decidedAt)) === key)
      .reduce((sum, t) => sum + t.rewardCoins, 0);
    result.push({ date: key, coins });
  }
  return result;
}

// Cross-child aggregation over the last 7 days — used both for the parent-facing
// reports summary and (via getWeeklyStar below) the positive-only recognition card.
function weeklyStatsPerChild() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return getChildren().map((child) => {
    const decided = getTasks(child.id).filter(
      (t) => (t.status === 'approved' || t.status === 'rejected') && t.decidedAt && new Date(t.decidedAt).getTime() >= cutoff
    );
    const approved = decided.filter((t) => t.status === 'approved');
    return {
      childId: child.id,
      name: child.name,
      coinsThisWeek: approved.reduce((sum, t) => sum + t.rewardCoins, 0),
      tasksApprovedThisWeek: approved.length,
      decidedThisWeek: decided.length,
      rate: decided.length === 0 ? null : approved.length / decided.length
    };
  });
}

function familyWeeklySummary() {
  return weeklyStatsPerChild().map(({ childId, name, coinsThisWeek, tasksApprovedThisWeek }) => ({
    childId,
    name,
    coinsThisWeek,
    tasksApprovedThisWeek
  }));
}

// Positive-only highlight: the child with the best approval rate this week, and
// only when there's something real to celebrate (≥2 children, ≥1 decided task).
// Never computes or exposes a "lowest" child — there is no losing side to this.
function getWeeklyStar() {
  const stats = weeklyStatsPerChild().filter((s) => s.rate !== null);
  if (getChildren().length < 2 || stats.length === 0) return null;
  const top = stats.reduce((best, s) => (s.rate > best.rate ? s : best));
  return { childId: top.childId, name: top.name, rate: top.rate };
}

// Proactive weekly summary — the on-demand Reports tab already has all of this
// data, but a parent has to remember to go look. This surfaces the same totals
// as a one-time-per-calendar-week banner on the Home tab instead, the local
// equivalent of the "weekly email digest" competitor apps (Qustodio/Bark) send
// automatically — without any email/server, per this app's no-cloud promise.
function weekBoundaryIso() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

function getWeeklyDigest() {
  const children = getChildren();
  const cutoffIso = weekBoundaryIso();
  const perChild = weeklyStatsPerChild();
  const totalCoins = perChild.reduce((sum, c) => sum + c.coinsThisWeek, 0);
  const totalTasksApproved = perChild.reduce((sum, c) => sum + c.tasksApprovedThisWeek, 0);
  const totalMinutes = children.reduce((sum, c) => {
    const usage = getSessions(c.id).filter((s) => s.startTime >= cutoffIso);
    return sum + usage.reduce((m, s) => m + s.minutesGranted, 0);
  }, 0);
  const star = getWeeklyStar();

  const { lastWeeklyDigestSeenAt } = store.getSettings();
  const hasActivity = totalTasksApproved > 0 || totalMinutes > 0;
  const neverSeenOrStale = !lastWeeklyDigestSeenAt || new Date(lastWeeklyDigestSeenAt).toISOString() < cutoffIso;
  const shouldShow = children.length > 0 && hasActivity && neverSeenOrStale;

  return {
    shouldShow,
    totalCoins,
    totalTasksApproved,
    totalMinutes,
    childCount: children.length,
    starName: star ? star.name : null
  };
}

function markWeeklyDigestSeen() {
  store.setSettings({ lastWeeklyDigestSeenAt: nowIso() });
}

function buildReportCsv(childId, days = 30) {
  const child = getChild(childId);
  const usage = usageByDay(childId, days);
  const coins = coinsEarnedByDay(childId, days);
  const audit = getAuditEntries(childId, 1000).filter(
    (a) => new Date(a.ts).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000
  );
  const lines = [`דוח FamilyQuest PC — ${child ? child.name : ''} — ${days} ימים אחרונים`, ''];
  lines.push('תאריך,דקות מסך,מטבעות שהורווחו');
  for (let i = 0; i < usage.length; i++) {
    lines.push(`${usage[i].date},${usage[i].minutes},${coins[i]?.coins ?? 0}`);
  }
  lines.push('');
  lines.push('תאריך ושעה,סוג,הודעה');
  for (const a of audit) {
    const message = String(a.message || '').replace(/"/g, '""');
    lines.push(`${new Date(a.ts).toLocaleString('he-IL')},${a.type},"${message}"`);
  }
  return lines.join('\n');
}

module.exports = {
  uuid,
  nowIso,
  todayKey,
  addAudit,
  getChildren,
  getChild,
  addChild,
  updateChild,
  removeChild,
  getTasks,
  getTask,
  createTask,
  submitTask,
  approveTask,
  rejectTask,
  deleteTask,
  createCoopQuest,
  checkCoopCompletion,
  getCoopQuests,
  updateCoopQuest,
  cancelCoopQuest,
  resetRecurringTasks,
  creditCoins,
  debitCoins,
  grantCoinMultiplier,
  clearCoinMultiplier,
  getActiveMultiplier,
  drainCelebrations,
  getFamilyGoal,
  createFamilyGoal,
  clearFamilyGoal,
  getSessions,
  minutesUsedToday,
  isBedtime,
  isWithinTimeRange,
  isWeekend,
  getTodayLimit,
  createRestrictedWindow,
  removeRestrictedWindow,
  getActiveRestriction,
  getActiveSession,
  redeemMinutes,
  grantHomeworkPass,
  endSession,
  freeze,
  closeExpiredSessions,
  usageByDay,
  completionRate,
  getAuditEntries,
  coinsEarnedByDay,
  familyWeeklySummary,
  getWeeklyStar,
  getWeeklyDigest,
  markWeeklyDigestSeen,
  buildReportCsv,
  computeStreak,
  checkStreakBonuses,
  getBadges,
  getBadgeProgress,
  getSpinCatalog,
  canSpinToday,
  spinWheel,
  getLevel,
  getRewards,
  createReward,
  deleteReward,
  getRedemptions,
  requestReward,
  fulfillRedemption
};
