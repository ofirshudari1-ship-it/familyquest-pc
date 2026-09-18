// Local, rule-based "smart suggestions" — the honest alternative to a real AI
// integration. Every function here reads only data already on this machine
// (tasks, sessions, rewards, redemptions) and returns null when there isn't
// enough history yet, so the panel never shows a guess dressed up as insight.
// v1 is informational only: the parent reads a suggestion and acts on it
// through the existing forms — nothing here mutates data on its own.
const economy = require('./economy.cjs');

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_MS = 24 * 60 * 60 * 1000;

function groupTasksByTitle(childId) {
  const tasks = economy.getTasks(childId).filter((t) => t.decidedAt && (t.status === 'approved' || t.status === 'rejected'));
  const map = {};
  for (const t of tasks) {
    if (!map[t.title]) map[t.title] = { approved: 0, rejected: 0, total: 0 };
    map[t.title].total++;
    if (t.status === 'approved') map[t.title].approved++;
    else map[t.title].rejected++;
  }
  return map;
}

function bestQuest(childId) {
  const grouped = groupTasksByTitle(childId);
  const candidates = Object.entries(grouped).filter(([, s]) => s.total >= 3);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b[1].approved / b[1].total - a[1].approved / a[1].total || b[1].total - a[1].total);
  const [title, s] = candidates[0];
  const rate = s.approved / s.total;
  if (rate < 0.8) return null;
  return {
    id: 'best_quest',
    icon: '🌟',
    title: 'משימת העל',
    message: `"${title}" מאושרת כמעט תמיד (${s.approved} מתוך ${s.total}) — אולי שווה להוסיף לה משימה דומה.`
  };
}

function strugglingQuest(childId) {
  const grouped = groupTasksByTitle(childId);
  const candidates = Object.entries(grouped).filter(([, s]) => s.total >= 3);
  candidates.sort((a, b) => b[1].rejected / b[1].total - a[1].rejected / a[1].total);
  if (candidates.length && candidates[0][1].rejected / candidates[0][1].total > 0.4) {
    const [title, s] = candidates[0];
    return {
      id: 'struggling_quest',
      icon: '🤔',
      title: 'משימה שלא מסתדרת',
      message: `"${title}" נדחית ב-${Math.round((s.rejected / s.total) * 100)}% מהפעמים — אולי הגמול לא מספיק, או שהיא לא ברורה מספיק.`
    };
  }
  const now = Date.now();
  const stale = economy
    .getTasks(childId)
    .find((t) => t.status === 'pending' && !t.submittedAt && now - new Date(t.createdAt).getTime() > 14 * DAY_MS);
  if (stale) {
    return {
      id: 'stale_quest',
      icon: '🤔',
      title: 'משימה שלא זזה',
      message: `"${stale.title}" לא בוצעה אף פעם כבר יותר משבועיים — אולי כדאי להסיר אותה או לנסח אותה אחרת.`
    };
  }
  return null;
}

function underusedReward(childId) {
  const child = economy.getChild(childId);
  if (!child) return null;
  const rewards = economy.getRewards(childId);
  const redeemedIds = new Set(economy.getRedemptions(childId).map((r) => r.rewardId));
  const now = Date.now();
  const candidate = rewards.find(
    (r) => !redeemedIds.has(r.id) && now - new Date(r.createdAt).getTime() > 7 * DAY_MS && child.coinBalance >= r.cost
  );
  if (!candidate) return null;
  return {
    id: 'underused_reward',
    icon: '🎁',
    title: 'פרס שמחכה',
    message: `יש מספיק מטבעות ל"${candidate.title}" כבר יותר משבוע ועדיין לא נפדה — אולי המחיר גבוה מדי, או שהפרס פחות מעניין.`
  };
}

function popularReward(childId) {
  const redemptions = economy.getRedemptions(childId);
  if (redemptions.length < 3) return null;
  const counts = {};
  for (const r of redemptions) counts[r.rewardTitle] = (counts[r.rewardTitle] || 0) + 1;
  const [title, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (count < 2) return null;
  return {
    id: 'popular_reward',
    icon: '🔥',
    title: 'פרס מבוקש',
    message: `"${title}" נפדה ${count} פעמים — פרסים דומים כדאי לשקול להוסיף לחנות.`
  };
}

function peakDay(childId) {
  const tasks = economy.getTasks(childId).filter((t) => t.status === 'approved' && t.decidedAt);
  if (tasks.length < 5) return null;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const t of tasks) counts[new Date(t.decidedAt).getDay()]++;
  const max = Math.max(...counts);
  if (max < 2) return null;
  const dayIdx = counts.indexOf(max);
  return {
    id: 'peak_day',
    icon: '📅',
    title: 'היום הכי פעיל',
    message: `יום ${DAY_NAMES[dayIdx]} הוא היום הכי פרודוקטיבי — אפשר לשקול לתזמן שם עוד משימות.`
  };
}

function limitFit(childId) {
  const child = economy.getChild(childId);
  if (!child) return null;
  const usage = economy.usageByDay(childId, 7);
  const daysWithData = usage.filter((d) => d.minutes > 0);
  if (daysWithData.length < 4) return null;
  const limit = child.dailyTimeLimitMins;
  if (!limit) return null;
  const maxedDays = usage.filter((d) => d.minutes >= limit * 0.9).length;
  const lowDays = usage.filter((d) => d.minutes < limit * 0.3).length;
  if (maxedDays >= 5) {
    return {
      id: 'limit_high',
      icon: '⏱️',
      title: 'המכסה כמעט תמיד מנוצלת',
      message: `${child.name} מנצל/ת כמעט את כל מכסת הזמן היומית ברוב הימים — אם זה יוצר חיכוך, אפשר לשקול להעלות אותה.`
    };
  }
  if (lowDays >= 5) {
    return {
      id: 'limit_low',
      icon: '⏱️',
      title: 'יתרת זמן לא מנוצלת',
      message: `${child.name} כמעט אף פעם לא מגיע/ה למכסה היומית — כנראה שהיא לא הגורם המגביל כרגע.`
    };
  }
  return null;
}

const GENERATORS = [strugglingQuest, limitFit, underusedReward, bestQuest, popularReward, peakDay];

function getInsights(childId, limit = 4) {
  const results = [];
  for (const gen of GENERATORS) {
    const r = gen(childId);
    if (r) results.push(r);
    if (results.length >= limit) break;
  }
  return results;
}

module.exports = { getInsights, bestQuest, strugglingQuest, underusedReward, popularReward, peakDay, limitFit };
