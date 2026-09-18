import { useEffect, useState } from 'react';
import type { Child, Settings } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import PinGate from './PinGate';
import PinRecovery from './PinRecovery';
import Onboarding from './Onboarding';
import DashboardOverview from './DashboardOverview';
import DashboardChildren from './DashboardChildren';
import DashboardQuests from './DashboardQuests';
import DashboardRewards from './DashboardRewards';
import DashboardReports from './DashboardReports';
import DashboardSettings from './DashboardSettings';
import '../styles/dashboard.css';

type Tab = 'overview' | 'children' | 'quests' | 'rewards' | 'reports' | 'settings';
const TABS: [Tab, string][] = [
  ['overview', 'בית'],
  ['children', 'ילדים'],
  ['quests', 'משימות'],
  ['rewards', 'פרסים'],
  ['reports', 'דוחות'],
  ['settings', 'הגדרות']
];

// Convenience: reopening the dashboard resumes where the parent left off,
// instead of always resetting to Overview + the first child.
function readStoredTab(): Tab {
  try {
    const stored = localStorage.getItem('fq-dashboard-tab');
    return TABS.some(([key]) => key === stored) ? (stored as Tab) : 'overview';
  } catch {
    return 'overview';
  }
}

export default function ParentDashboard() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [tab, setTabState] = useState<Tab>(readStoredTab);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('fq-dashboard-child');
    } catch {
      return null;
    }
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRewardsCount, setPendingRewardsCount] = useState(0);

  const setTab = (next: Tab) => {
    setTabState(next);
    try {
      localStorage.setItem('fq-dashboard-tab', next);
    } catch {
      /* ignore */
    }
  };

  const setSelectedChildId = (value: string | null | ((prev: string | null) => string | null)) => {
    setSelectedChildIdState((prev) => {
      const next = typeof value === 'function' ? (value as (p: string | null) => string | null)(prev) : value;
      try {
        if (next) localStorage.setItem('fq-dashboard-child', next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const reloadChildren = () => {
    window.familyquest.listChildren().then((list) => {
      setChildren(list);
      setSelectedChildId((prev) => prev && list.some((c) => c.id === prev) ? prev : list[0]?.id || null);
    });
    window.familyquest.listTasks().then((tasks) => setPendingCount(tasks.filter((t) => t.status === 'submitted').length));
    window.familyquest.listRedemptions().then((r) => setPendingRewardsCount(r.filter((x) => x.status === 'pending').length));
    window.familyquest.getSettings().then(setSettings);
  };

  useEffect(() => {
    window.familyquest.hasPin().then(setHasPin);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    reloadChildren();
    // lockManager's tick already pushes a lock:state event every 3s — no
    // separate poll needed on top of it (a redundant 8s interval used to
    // sit here, permanently behind the push and never actually the one
    // driving a refresh).
    return window.familyquest.onLockState(reloadChildren);
  }, [unlocked]);

  if (hasPin === null) return <LoadingSpinner />;

  if (!hasPin) {
    return (
      <Onboarding
        onDone={() => {
          setHasPin(true);
          setUnlocked(true);
        }}
      />
    );
  }

  if (!unlocked) {
    if (showRecovery) {
      return (
        <PinRecovery
          onDone={() => {
            setShowRecovery(false);
            setUnlocked(true);
          }}
          onCancel={() => setShowRecovery(false)}
        />
      );
    }
    return <PinGate onUnlock={() => setUnlocked(true)} onForgot={() => setShowRecovery(true)} />;
  }

  const activeChildId = settings?.activeChildId || null;
  const activeChild = children.find((c) => c.id === activeChildId);

  return (
    <div className="theme-parent dashboard-shell">
      <nav className="dashboard-nav" aria-label="ניווט ראשי">
        <div className="dashboard-brand" style={{ padding: '0 14px 16px', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'linear-gradient(160deg, #5c48c9, #2b2d63)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14
            }}
          >
            🪙
          </span>
          FamilyQuest PC
        </div>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={`dashboard-nav-item ${tab === key ? 'active' : ''}`}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'quests' && pendingCount > 0 && <span className="badge">{pendingCount}</span>}
            {key === 'rewards' && pendingRewardsCount > 0 && <span className="badge">{pendingRewardsCount}</span>}
          </button>
        ))}

        <div className="dashboard-spacer" style={{ flex: 1 }} />

        <div className="dashboard-freeze" style={{ padding: '0 14px 10px' }}>
          <div className="dim" style={{ marginBottom: 8 }}>
            {activeChild ? `כרגע במחשב: ${activeChild.name}` : 'אין ילד פעיל במחשב'}
          </div>
          <button
            className="btn-danger"
            style={{ width: '100%', marginRight: 0 }}
            disabled={!activeChildId}
            onClick={() => activeChildId && window.familyquest.freeze(activeChildId)}
          >
            ⛔ הקפא מחשב עכשיו
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        {tab === 'overview' && (
          <DashboardOverview
            children={children}
            selectedChildId={selectedChildId}
            onSelectChild={setSelectedChildId}
            pendingCount={pendingCount}
            pendingRewardsCount={pendingRewardsCount}
            onGoToQuests={() => setTab('quests')}
            onGoToRewards={() => setTab('rewards')}
          />
        )}
        {tab === 'children' && <DashboardChildren children={children} onChanged={reloadChildren} />}
        {tab === 'quests' && (
          <DashboardQuests children={children} selectedChildId={selectedChildId} onSelectChild={setSelectedChildId} />
        )}
        {tab === 'rewards' && (
          <DashboardRewards children={children} selectedChildId={selectedChildId} onSelectChild={setSelectedChildId} />
        )}
        {tab === 'reports' && (
          <DashboardReports children={children} selectedChildId={selectedChildId} onSelectChild={setSelectedChildId} />
        )}
        {tab === 'settings' && <DashboardSettings />}
      </div>
    </div>
  );
}
