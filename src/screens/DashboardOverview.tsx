import { useEffect, useState } from 'react';
import type { Child, FamilyGoal, Insight, Level, LockState, WeeklyDigest, WeeklyStar } from '../types';
import Avatar from '../components/Avatar';
import CoinBadge from '../components/CoinBadge';
import Companion from '../components/Companion';
import LevelBar from '../components/LevelBar';

function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function statusInfo(lockState: LockState | null, childId: string): { text: string; color: string } {
  if (!lockState) return { text: '—', color: 'var(--text-dim)' };
  if (lockState.status === 'setup') return { text: 'ההגדרה הראשונית לא הושלמה', color: 'var(--warn)' };
  if (lockState.status === 'picker') return { text: 'לא נבחר כרגע במחשב', color: 'var(--text-dim)' };
  if (lockState.childId !== childId) return { text: 'לא פעיל/ה כרגע במחשב', color: 'var(--text-dim)' };
  if (lockState.status === 'unlocked') return { text: `▶️ פעיל — ${formatRemaining(lockState.remainingMs)} נותרו`, color: 'var(--good)' };
  if (lockState.reason === 'bedtime') return { text: '🌙 נעול — שעת שינה', color: 'var(--text-dim)' };
  if (lockState.reason === 'restricted') return { text: `⛔ נעול — ${lockState.label}`, color: 'var(--bad)' };
  return { text: '🔒 נעול — אין זמן מסך', color: 'var(--text-dim)' };
}

function ChildSummaryCard({ child, lockState, todayLimit }: { child: Child; lockState: LockState | null; todayLimit: number | null }) {
  const [level, setLevel] = useState<Level | null>(null);
  const [streak, setStreak] = useState(0);
  const [usedToday, setUsedToday] = useState(0);

  useEffect(() => {
    const reload = () => {
      window.familyquest.getLevel(child.id).then(setLevel);
      window.familyquest.getStreak(child.id).then(setStreak);
      window.familyquest.usageByDay(child.id, 1).then((d) => setUsedToday(d[0]?.minutes || 0));
    };
    reload();
    // These change on the order of minutes (a quest approved, a session
    // redeemed), not every tick — a 20s poll keeps them fresh without
    // re-fetching on every ~3s lock:state push (which used to be this
    // effect's dependency and fired 3 IPC calls per child every few seconds
    // for no visible benefit).
    const interval = setInterval(reload, 20000);
    return () => clearInterval(interval);
  }, [child.id]);

  const status = statusInfo(lockState, child.id);
  const limit = todayLimit ?? child.dailyTimeLimitMins;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar avatarId={child.avatarId} size={46} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>{child.name}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: status.color }}>{status.text}</div>
        </div>
        <CoinBadge amount={child.coinBalance} size="sm" />
      </div>
      {level && <Companion companionId={child.companionId} level={level.level} streak={streak} size={40} compact />}
      {level && <LevelBar level={level} variant="light" compact />}
      <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-dim)' }}>
        <span>⏱️ {usedToday}/{limit} דק׳ היום</span>
        {streak > 0 && <span>🔥 רצף {streak} ימים</span>}
        {child.coinMultiplier && new Date(child.coinMultiplier.expiresAt) > new Date() && (
          <span style={{ color: 'var(--warn)', fontWeight: 700 }}>🎉 פי {child.coinMultiplier.value}</span>
        )}
      </div>
    </div>
  );
}

function FamilyGoalCard() {
  const [goal, setGoal] = useState<FamilyGoal | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [targetCoins, setTargetCoins] = useState(200);
  const [rewardText, setRewardText] = useState('');

  const reload = () => window.familyquest.getFamilyGoal().then(setGoal);
  useEffect(() => {
    reload();
  }, []);

  const create = async () => {
    if (!title.trim() || targetCoins <= 0) return;
    await window.familyquest.createFamilyGoal({ title: title.trim(), emoji, targetCoins, rewardText: rewardText.trim() });
    setTitle('');
    setRewardText('');
    setTargetCoins(200);
    setCreating(false);
    reload();
  };

  const startOver = async () => {
    await window.familyquest.clearFamilyGoal();
    setCreating(true);
    reload();
  };

  if (!goal) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>🎯 יעד משפחתי</h3>
        {!creating ? (
          <>
            <div className="dim" style={{ marginBottom: 10 }}>
              יעד משותף שכל הילדים ממלאים יחד ככל שהם מרוויחים מטבעות — לא עולה להם כלום מהיתרה האישית שלהם.
            </div>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              + הגדרת יעד משפחתי
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              placeholder="שם היעד (למשל: טיול משפחתי)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field"
              style={{ marginBottom: 0 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                style={{ width: 50, textAlign: 'center', padding: 9, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <input
                type="number"
                min={1}
                placeholder="יעד מטבעות"
                value={targetCoins}
                onChange={(e) => setTargetCoins(Number(e.target.value))}
                style={{ flex: 1, padding: 9, borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
            <input
              placeholder="הפרס בסיום (אופציונלי)"
              value={rewardText}
              onChange={(e) => setRewardText(e.target.value)}
              className="field"
              style={{ marginBottom: 0 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={create} disabled={!title.trim() || targetCoins <= 0}>
                יצירה
              </button>
              <button className="btn-secondary" onClick={() => setCreating(false)}>
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const pct = Math.min(100, Math.round((goal.contributedCoins / goal.targetCoins) * 100));
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>
          {goal.emoji} {goal.title}
        </h3>
        {goal.completedAt && (
          <button className="btn-secondary" onClick={startOver} style={{ fontSize: 12 }}>
            יעד חדש
          </button>
        )}
      </div>
      <div style={{ background: 'var(--bg)', borderRadius: 999, height: 16, overflow: 'hidden', margin: '10px 0' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: goal.completedAt ? 'var(--good)' : 'linear-gradient(90deg, #4834a3, #6c5ce7)'
          }}
        />
      </div>
      <div className="dim" style={{ fontSize: 13 }}>
        {goal.completedAt
          ? `היעד הושג! 🎉${goal.rewardText ? ` ${goal.rewardText}` : ''}`
          : `🪙 ${goal.contributedCoins} / ${goal.targetCoins}${goal.rewardText ? ` · ${goal.rewardText}` : ''}`}
      </div>
    </div>
  );
}

// Proactive "here's what happened this week" summary — appears at most once
// per calendar week on Home, so a parent sees it without having to remember to
// open the Reports tab. Purely a read + a "seen" ack, both local (no email/cloud).
function WeeklyDigestBanner() {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);

  useEffect(() => {
    window.familyquest.getWeeklyDigest().then((d) => setDigest(d.shouldShow ? d : null));
  }, []);

  if (!digest) return null;

  const dismiss = () => {
    window.familyquest.markWeeklyDigestSeen();
    setDigest(null);
  };

  const hours = Math.floor(digest.totalMinutes / 60);
  const mins = digest.totalMinutes % 60;
  const timeText = hours > 0 ? `${hours} שעות ו-${mins} דק׳` : `${digest.totalMinutes} דק׳`;

  return (
    <div
      className="card fq-digest-banner"
      style={{ display: 'flex', gap: 14, alignItems: 'center', background: 'linear-gradient(120deg, #4834a3, #6c5ce7)', color: '#fff', border: 'none' }}
    >
      <span style={{ fontSize: 30 }}>📬</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>סיכום השבוע שעבר</div>
        <div style={{ fontSize: 13, opacity: 0.92, marginTop: 2 }}>
          🪙 {digest.totalCoins} מטבעות הורווחו · ✅ {digest.totalTasksApproved} משימות אושרו · ⏱️ {timeText} זמן מסך
          {digest.starName ? ` · 🌟 כוכב/ת השבוע: ${digest.starName}` : ''}
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="סגירת סיכום השבוע"
        style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13 }}
      >
        הבנתי ✓
      </button>
    </div>
  );
}

function WeeklyStarCard() {
  const [star, setStar] = useState<WeeklyStar | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    window.familyquest.getSettings().then((s) => setEnabled(s.siblingRecognitionEnabled));
    window.familyquest.getWeeklyStar().then(setStar);
  }, []);

  if (!enabled || !star) return null;

  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 28 }}>🌟</span>
      <div>
        <div style={{ fontWeight: 700 }}>כוכב/ת השבוע: {star.name}</div>
        <div className="dim" style={{ fontSize: 12.5 }}>
          {Math.round(star.rate * 100)}% מהמשימות השבוע הושלמו בהצלחה — כל הכבוד!
        </div>
      </div>
    </div>
  );
}

function InsightsPanel({ children, selectedChildId, onSelectChild }: {
  children: Child[];
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
}) {
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    if (!selectedChildId) return;
    window.familyquest.getInsights(selectedChildId).then(setInsights);
  }, [selectedChildId]);

  if (!selectedChildId) return null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>💡 הצעות מבוססות שימוש</h3>
        {children.length > 1 && (
          <select
            value={selectedChildId}
            onChange={(e) => onSelectChild(e.target.value)}
            style={{ padding: 6, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {insights.length === 0 ? (
        <div className="dim">עדיין אין מספיק נתונים לתובנות — נסו שוב בעוד כמה ימי שימוש.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((ins) => (
            <div
              key={ins.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 12px'
              }}
            >
              <span style={{ fontSize: 18 }}>{ins.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ins.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{ins.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardOverview({ children, selectedChildId, onSelectChild, pendingCount, pendingRewardsCount, onGoToQuests, onGoToRewards }: {
  children: Child[];
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
  pendingCount: number;
  pendingRewardsCount: number;
  onGoToQuests: () => void;
  onGoToRewards: () => void;
}) {
  const [lockState, setLockState] = useState<LockState | null>(null);
  const [todayLimits, setTodayLimits] = useState<Record<string, number>>({});

  useEffect(() => {
    window.familyquest.getLockState().then(setLockState);
    return window.familyquest.onLockState(setLockState);
  }, []);

  useEffect(() => {
    Promise.all(children.map((c) => window.familyquest.getTodayLimit(c.id).then((l) => [c.id, l] as const))).then((pairs) =>
      setTodayLimits(Object.fromEntries(pairs))
    );
  }, [children]);

  if (children.length === 0) {
    return <div className="dim">הוסיפו ילד ראשון בכרטיסייה "ילדים" כדי להתחיל.</div>;
  }

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>בית</h2>

      <WeeklyDigestBanner />

      {(pendingCount > 0 || pendingRewardsCount > 0) && (
        <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--primary-dim)', border: 'none' }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <div style={{ flex: 1, fontSize: 13.5 }}>
            {pendingCount > 0 && (
              <button onClick={onGoToQuests} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 700, marginInlineEnd: 14 }}>
                {pendingCount} משימות ממתינות לאישור ←
              </button>
            )}
            {pendingRewardsCount > 0 && (
              <button onClick={onGoToRewards} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 700 }}>
                {pendingRewardsCount} פרסים ממתינים למסירה ←
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
        {children.map((c) => (
          <ChildSummaryCard key={c.id} child={c} lockState={lockState} todayLimit={todayLimits[c.id] ?? null} />
        ))}
      </div>

      <FamilyGoalCard />
      {children.length > 1 && <WeeklyStarCard />}

      <InsightsPanel children={children} selectedChildId={selectedChildId} onSelectChild={onSelectChild} />
    </div>
  );
}
