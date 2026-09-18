import { useEffect, useState } from 'react';
import type { Badge, CelebrationEvent, Child, FamilyGoal, Level, LockState } from '../types';
import Avatar from '../components/Avatar';
import CoinBadge from '../components/CoinBadge';
import LevelBar from '../components/LevelBar';
import Celebration from '../components/Celebration';
import Companion from '../components/Companion';
import PrizeWheel from '../components/PrizeWheel';
import { themeVars } from '../data/themes';
import QuestBoard from './QuestBoard';
import RedeemPanel from './RedeemPanel';
import RewardShop from './RewardShop';
import TrophyRoom from './TrophyRoom';
import '../styles/lock.css';

function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PickerBadges({ childId }: { childId: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  useEffect(() => {
    window.familyquest.getBadges(childId).then((b) => setBadges(b.slice(-3)));
  }, [childId]);
  if (badges.length === 0) return null;
  return (
    <div className="badge-strip">
      {badges.map((b) => (
        <span key={b.id} title={b.title}>
          {b.emoji}
        </span>
      ))}
    </div>
  );
}

// Read-only for the child — motivating, not editable here.
function FamilyGoalStrip() {
  const [goal, setGoal] = useState<FamilyGoal | null>(null);
  useEffect(() => {
    window.familyquest.getFamilyGoal().then(setGoal);
  }, []);
  if (!goal) return null;
  const pct = Math.min(100, Math.round((goal.contributedCoins / goal.targetCoins) * 100));
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: 12,
        padding: '8px 12px',
        marginBottom: 14
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
        <span>
          {goal.emoji} {goal.title}
        </span>
        <span>{goal.completedAt ? 'הושג! 🎉' : `🪙 ${goal.contributedCoins}/${goal.targetCoins}`}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: goal.completedAt ? '#4caf7d' : 'linear-gradient(90deg, #ffd166, #ff9f6e)'
          }}
        />
      </div>
    </div>
  );
}

// Always-present, unobtrusive way into the parent dashboard — independent of the
// system tray (which can be temporarily inaccessible, e.g. while the lock screen
// is on top) and safe to show even on a locked screen, since the dashboard itself
// is PIN-gated. This is the fix for getting permanently stuck with no way out.
function DashboardLink() {
  return (
    <button
      onClick={() => window.familyquest.openDashboard()}
      style={{
        position: 'fixed',
        bottom: 14,
        insetInlineStart: 14,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.16)',
        color: 'rgba(255,255,255,0.6)',
        borderRadius: 999,
        padding: '6px 14px',
        fontSize: 12
      }}
    >
      👪 דשבורד הורים
    </button>
  );
}

// Mirrors DashboardLink's fixed-position pattern, anchored to the opposite
// corner so the two never overlap.
function WheelButton({ childId }: { childId: string }) {
  const [open, setOpen] = useState(false);
  const [canSpin, setCanSpin] = useState(false);

  useEffect(() => {
    window.familyquest.getWheelStatus(childId).then(setCanSpin);
  }, [childId, open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 14,
          insetInlineEnd: 14,
          background: canSpin ? 'rgba(255,209,102,0.22)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${canSpin ? 'rgba(255,209,102,0.5)' : 'rgba(255,255,255,0.16)'}`,
          color: canSpin ? '#ffd166' : 'rgba(255,255,255,0.6)',
          borderRadius: 999,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: canSpin ? 700 : 400
        }}
      >
        🎡 גלגל מזל{canSpin ? '!' : ''}
      </button>
      {open && <PrizeWheel childId={childId} onClose={() => setOpen(false)} />}
    </>
  );
}

export default function LockHome() {
  const [celebrations, setCelebrations] = useState<CelebrationEvent[]>([]);
  const screen = <LockHomeScreen onCelebrate={(e) => setCelebrations((prev) => [...prev, e])} />;
  return (
    <>
      {screen}
      {celebrations[0] && <Celebration event={celebrations[0]} onDone={() => setCelebrations((prev) => prev.slice(1))} />}
    </>
  );
}

function LockHomeScreen({ onCelebrate }: { onCelebrate: (event: CelebrationEvent) => void }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [lockState, setLockState] = useState<LockState>({ status: 'setup' });
  const [tab, setTab] = useState<'quests' | 'redeem' | 'shop' | 'trophies'>('quests');
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState<Level | null>(null);
  const [appFlagged, setAppFlagged] = useState<string | null>(null);

  useEffect(() => {
    const reloadChildren = () => window.familyquest.listChildren().then(setChildren);
    reloadChildren();

    window.familyquest.getLockState().then(setLockState);
    // Coin balance changes (task approved, reward bought, time redeemed) all
    // trigger a lock:state push from main every ~3s — piggyback the children
    // refresh on it instead of a separate poll (a redundant 15s interval used
    // to sit here, permanently behind this push).
    return window.familyquest.onLockState((state) => {
      setLockState(state);
      reloadChildren();
    });
  }, []);

  useEffect(() => {
    if (lockState.status !== 'locked' && lockState.status !== 'unlocked') return;
    window.familyquest.getStreak(lockState.childId).then(setStreak);
    window.familyquest.getLevel(lockState.childId).then(setLevel);
  }, [lockState]);

  useEffect(() => {
    return window.familyquest.onAppFlagged(({ app }) => {
      setAppFlagged(app);
      setTimeout(() => setAppFlagged(null), 6000);
    });
  }, []);

  useEffect(() => {
    return window.familyquest.onCelebrate(onCelebrate);
  }, [onCelebrate]);

  const pickChild = (id: string) => {
    window.familyquest.selectChild(id).then(setLockState);
  };

  const switchProfile = () => {
    window.familyquest.selectChild(null).then(setLockState);
  };

  if (lockState.status === 'setup') {
    return (
      <div className="theme-kid lock-screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 22, textAlign: 'center', maxWidth: 460 }}>
          👋 ברוכים הבאים ל-FamilyQuest PC!
          <br />
          <span style={{ fontSize: 15, opacity: 0.75 }}>
            עוד לא הוגדר קוד הורה או פרופיל ילד — לכן המחשב עדיין לא נעול. פתחו את דשבורד ההורים כדי להתחיל.
          </span>
        </div>
        <button
          onClick={() => window.familyquest.openDashboard()}
          className="quest-btn primary"
          style={{ marginTop: 24, fontSize: 17, padding: '14px 28px' }}
        >
          👪 פתיחת דשבורד הורים
        </button>
      </div>
    );
  }

  if (lockState.status === 'picker') {
    return (
      <div className="theme-kid lock-screen" style={{ justifyContent: 'center' }}>
        <h1 style={{ textAlign: 'center', marginBottom: 32 }}>מי משחק? 🎮</h1>
        <div className="picker-grid">
          {children.map((c) => (
            <button key={c.id} className="picker-card" style={{ border: 'none' }} onClick={() => pickChild(c.id)}>
              <Avatar avatarId={c.avatarId} size={72} />
              <div style={{ fontWeight: 700, fontSize: 17 }}>{c.name}</div>
              <CoinBadge amount={c.coinBalance} size="sm" />
              <PickerBadges childId={c.id} />
            </button>
          ))}
        </div>
        <DashboardLink />
      </div>
    );
  }

  const child = children.find((c) => c.id === lockState.childId);
  if (!child) return null;

  if (lockState.status === 'unlocked') {
    return (
      <div className="theme-kid lock-screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Avatar avatarId={child.avatarId} size={96} />
        <h1 style={{ margin: '20px 0 4px' }}>תיהנה, {child.name}! 🎉</h1>
        <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {formatRemaining(lockState.remainingMs)}
        </div>
        <div className="quest-meta">זמן נותר</div>
        {appFlagged && (
          <div
            style={{
              marginTop: 20,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 12,
              padding: '10px 18px',
              fontSize: 14
            }}
          >
            💡 "{appFlagged}" לא ברשימת האפליקציות המאושרות של ההורים
          </div>
        )}
        <DashboardLink />
      </div>
    );
  }

  return (
    <div className="theme-kid lock-screen" style={themeVars(child.themeColor)}>
      <div className="lock-header">
        <div className="lock-header-child">
          <Avatar avatarId={child.avatarId} size={56} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{child.name}</div>
            <button
              onClick={switchProfile}
              title="חוזר למסך בחירת פרופיל — יציאה מהתוכנה עצמה אפשרית רק דרך דשבורד ההורים עם קוד PIN"
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: 0, fontSize: 12 }}
            >
              להחליף פרופיל
            </button>
            {level && <LevelBar level={level} variant="dark" compact />}
            {streak > 0 && (
              <div style={{ marginTop: 4 }}>
                <span className="streak-pill">🔥 רצף {streak} ימים</span>
              </div>
            )}
          </div>
        </div>
        {level && <Companion companionId={child.companionId} level={level.level} streak={streak} size={64} compact />}
        <CoinBadge amount={child.coinBalance} size="lg" />
      </div>

      {lockState.reason === 'bedtime' && (
        <div style={{ marginBottom: 16, fontSize: 15 }}>🌙 שעת שינה — המחשב נעול עד {child.bedtimeEnd}.</div>
      )}
      {lockState.reason === 'restricted' && (
        <div style={{ marginBottom: 16, fontSize: 15 }}>⛔ {lockState.label} — המחשב נעול כרגע.</div>
      )}

      <FamilyGoalStrip />

      <div className="lock-tabs">
        <button
          className={`lock-tab ${tab === 'quests' ? 'active' : ''}`}
          aria-current={tab === 'quests' ? 'page' : undefined}
          onClick={() => setTab('quests')}
        >
          🎯 משימות
        </button>
        <button
          className={`lock-tab ${tab === 'redeem' ? 'active' : ''}`}
          aria-current={tab === 'redeem' ? 'page' : undefined}
          onClick={() => setTab('redeem')}
        >
          ⏱️ פדיון זמן מסך
        </button>
        <button
          className={`lock-tab ${tab === 'shop' ? 'active' : ''}`}
          aria-current={tab === 'shop' ? 'page' : undefined}
          onClick={() => setTab('shop')}
        >
          🎁 חנות פרסים
        </button>
        <button
          className={`lock-tab ${tab === 'trophies' ? 'active' : ''}`}
          aria-current={tab === 'trophies' ? 'page' : undefined}
          onClick={() => setTab('trophies')}
        >
          🏆 גביעים
        </button>
      </div>

      {tab === 'quests' && <QuestBoard childId={child.id} children={children} />}
      {tab === 'redeem' && (
        <RedeemPanel
          child={child}
          blockedLabel={
            lockState.reason === 'bedtime'
              ? `שעת שינה — ${child.bedtimeStart} עד ${child.bedtimeEnd}.`
              : lockState.reason === 'restricted'
                ? lockState.label
                : null
          }
        />
      )}
      {tab === 'shop' && <RewardShop childId={child.id} coinBalance={child.coinBalance} />}
      {tab === 'trophies' && <TrophyRoom childId={child.id} />}
      <DashboardLink />
      <WheelButton childId={child.id} />
    </div>
  );
}
