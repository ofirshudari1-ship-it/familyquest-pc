// Smoke tests for electron/economy.cjs — the core data/business logic layer
// (children, quests, coins, screen-time sessions, streaks). Explicitly does
// NOT touch electron/pin.cjs or electron/lockManager.cjs's PIN-adjacent paths;
// those were reviewed separately and are out of scope here.
const economy = require('../electron/economy.cjs');
const store = require('../electron/store.cjs');

function resetStore() {
  store.set('children', []);
  store.set('tasks', []);
  store.set('sessions', []);
  store.set('audit', []);
  store.set('rewards', []);
  store.set('redemptions', []);
  store.set('familyGoal', null);
  store.set('coopQuests', []);
  store.setSettings({ ...store.DEFAULT_SETTINGS });
}

beforeEach(() => {
  resetStore();
});

describe('children', () => {
  it('creates a child with sane defaults', () => {
    const child = economy.addChild({ name: '  Uri  ', dailyTimeLimitMins: 90 });
    expect(child.name).toBe('Uri');
    expect(child.coinBalance).toBe(0);
    expect(child.dailyTimeLimitMins).toBe(90);
    expect(economy.getChild(child.id)).not.toBeNull();
  });

  it('removeChild cascades to that child\'s tasks, sessions, rewards, redemptions', () => {
    const child = economy.addChild({ name: 'Uri' });
    economy.createTask({ childId: child.id, title: 'Tidy room', rewardCoins: 5 });
    economy.createReward({ childId: child.id, title: 'Movie night', cost: 10 });
    economy.removeChild(child.id);
    expect(economy.getChild(child.id)).toBeNull();
    expect(economy.getTasks(child.id)).toHaveLength(0);
    expect(economy.getRewards(child.id)).toHaveLength(0);
  });
});

describe('quest lifecycle', () => {
  it('a quest requiring proof cannot be submitted without one', () => {
    const child = economy.addChild({ name: 'Uri' });
    const task = economy.createTask({ childId: child.id, title: 'Clean room', rewardCoins: 5, requiresProof: true });
    expect(() => economy.submitTask(task.id, null)).toThrow();
    expect(() => economy.submitTask(task.id, '/tmp/photo.png')).not.toThrow();
  });

  it('approving a submitted quest credits coins exactly once', () => {
    const child = economy.addChild({ name: 'Uri' });
    const task = economy.createTask({ childId: child.id, title: 'Homework', rewardCoins: 10 });
    economy.submitTask(task.id, null);
    economy.approveTask(task.id);
    expect(economy.getChild(child.id).coinBalance).toBe(10);
    // Approving twice is rejected, not double-paid.
    expect(() => economy.approveTask(task.id)).toThrow();
    expect(economy.getChild(child.id).coinBalance).toBe(10);
  });

  it('a rejected quest awards no coins', () => {
    const child = economy.addChild({ name: 'Uri' });
    const task = economy.createTask({ childId: child.id, title: 'Homework', rewardCoins: 10 });
    economy.submitTask(task.id, null);
    economy.rejectTask(task.id, 'not done yet');
    expect(economy.getChild(child.id).coinBalance).toBe(0);
  });
});

describe('coop quests', () => {
  it('awards the shared bonus once, only once every participant is approved', () => {
    const a = economy.addChild({ name: 'A' });
    const b = economy.addChild({ name: 'B' });
    const coop = economy.createCoopQuest({ title: 'Clean garage', rewardCoins: 5, bonusCoins: 20, childIds: [a.id, b.id] });
    const [taskA, taskB] = economy.getCoopQuests()[0].taskIds;

    economy.submitTask(taskA, null);
    economy.approveTask(taskA);
    // Only one of two participants done — bonus not yet awarded.
    expect(economy.getChild(a.id).coinBalance).toBe(5);
    expect(economy.getChild(b.id).coinBalance).toBe(0);

    economy.submitTask(taskB, null);
    economy.approveTask(taskB);
    // Both done — each gets their own reward plus the shared bonus.
    expect(economy.getChild(a.id).coinBalance).toBe(5 + 20);
    expect(economy.getChild(b.id).coinBalance).toBe(5 + 20);
    expect(economy.getCoopQuests().find((c) => c.id === coop.id).completedAt).not.toBeNull();
  });
});

describe('screen-time redemption', () => {
  it('rejects redemption when coin balance is insufficient', () => {
    const child = economy.addChild({ name: 'Uri', dailyTimeLimitMins: 120 });
    expect(() => economy.redeemMinutes(child.id, 30)).toThrow('אין מספיק מטבעות');
  });

  it('caps a redemption at the remaining daily limit', () => {
    const child = economy.addChild({ name: 'Uri', dailyTimeLimitMins: 20 });
    economy.creditCoins(child.id, 100);
    const session = economy.redeemMinutes(child.id, 60);
    expect(session.minutesGranted).toBe(20);
  });

  it('blocks redemption during a bedtime window', () => {
    const child = economy.addChild({ name: 'Uri', bedtimeStart: '00:00', bedtimeEnd: '23:59' });
    economy.creditCoins(child.id, 100);
    expect(() => economy.redeemMinutes(child.id, 10)).toThrow('שעת שינה');
  });

  it('grantHomeworkPass bypasses coin cost and does not require a balance', () => {
    const child = economy.addChild({ name: 'Uri' });
    const session = economy.grantHomeworkPass(child.id, 15);
    expect(session.coinsSpent).toBe(0);
    expect(session.minutesGranted).toBe(15);
    expect(economy.getChild(child.id).coinBalance).toBe(0);
  });
});

describe('coin multiplier', () => {
  it('applies an active multiplier to credited coins', () => {
    const child = economy.addChild({ name: 'Uri' });
    economy.grantCoinMultiplier(child.id, 2, 60000);
    economy.creditCoins(child.id, 10);
    expect(economy.getChild(child.id).coinBalance).toBe(20);
  });

  it('rejects an invalid multiplier value', () => {
    const child = economy.addChild({ name: 'Uri' });
    expect(() => economy.grantCoinMultiplier(child.id, 1, 60000)).toThrow();
    expect(() => economy.grantCoinMultiplier(child.id, 0.5, 60000)).toThrow();
  });
});

describe('weekly digest', () => {
  it('does not show when there is no recent activity', () => {
    economy.addChild({ name: 'Uri' });
    const digest = economy.getWeeklyDigest();
    expect(digest.shouldShow).toBe(false);
  });

  it('shows once and is suppressed after markWeeklyDigestSeen', () => {
    const child = economy.addChild({ name: 'Uri' });
    const task = economy.createTask({ childId: child.id, title: 'Homework', rewardCoins: 10 });
    economy.submitTask(task.id, null);
    economy.approveTask(task.id);

    const before = economy.getWeeklyDigest();
    expect(before.shouldShow).toBe(true);
    expect(before.totalCoins).toBe(10);
    expect(before.totalTasksApproved).toBe(1);

    economy.markWeeklyDigestSeen();
    const after = economy.getWeeklyDigest();
    expect(after.shouldShow).toBe(false);
  });
});

describe('streaks', () => {
  it('computeStreak is 0 with no approved quests', () => {
    const child = economy.addChild({ name: 'Uri' });
    expect(economy.computeStreak(child.id)).toBe(0);
  });
});
