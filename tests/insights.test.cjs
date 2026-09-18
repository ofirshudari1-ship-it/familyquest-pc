// Smoke tests for electron/insights.cjs — the local, rule-based "smart
// suggestions" engine (no cloud AI; see file header there for why).
const economy = require('../electron/economy.cjs');
const insights = require('../electron/insights.cjs');
const store = require('../electron/store.cjs');

beforeEach(() => {
  store.set('children', []);
  store.set('tasks', []);
  store.set('sessions', []);
  store.set('rewards', []);
  store.set('redemptions', []);
});

function approveNTimes(childId, title, n, rewardCoins = 5) {
  for (let i = 0; i < n; i++) {
    const task = economy.createTask({ childId, title, rewardCoins });
    economy.submitTask(task.id, null);
    economy.approveTask(task.id);
  }
}

describe('getInsights', () => {
  it('returns nothing for a brand-new child with no history', () => {
    const child = economy.addChild({ name: 'Uri' });
    expect(insights.getInsights(child.id)).toHaveLength(0);
  });

  it('flags a quest with a high approval rate as the "best quest"', () => {
    const child = economy.addChild({ name: 'Uri' });
    approveNTimes(child.id, 'Read 20 minutes', 4);
    const best = insights.bestQuest(child.id);
    expect(best).not.toBeNull();
    expect(best.id).toBe('best_quest');
  });

  it('flags a quest that is rejected most of the time as struggling', () => {
    const child = economy.addChild({ name: 'Uri' });
    for (let i = 0; i < 5; i++) {
      const task = economy.createTask({ childId: child.id, title: 'Clean garage', rewardCoins: 5 });
      economy.submitTask(task.id, null);
      if (i < 3) economy.rejectTask(task.id, 'not done');
      else economy.approveTask(task.id);
    }
    const struggling = insights.strugglingQuest(child.id);
    expect(struggling).not.toBeNull();
    expect(struggling.id).toBe('struggling_quest');
  });

  it('never returns more insights than the requested limit', () => {
    const child = economy.addChild({ name: 'Uri' });
    approveNTimes(child.id, 'Homework', 5);
    const result = insights.getInsights(child.id, 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });
});
