import { useEffect, useState } from 'react';
import type { Child } from '../types';
import { playCoin } from '../sound';
import { ipcErrorMessage } from '../ipcError';

const OPTIONS = [15, 30, 60];

export default function RedeemPanel({ child, blockedLabel }: { child: Child; blockedLabel: string | null }) {
  const [coinsPerMinute, setCoinsPerMinute] = useState(1);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(10);
  const [usedToday, setUsedToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(child.dailyTimeLimitMins);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    window.familyquest.getSettings().then((s) => {
      setCoinsPerMinute(s.coinsPerMinute);
      setLowBalanceThreshold(s.lowBalanceThreshold);
    });
    window.familyquest.usageByDay(child.id, 1).then((days) => setUsedToday(days[0]?.minutes || 0));
    window.familyquest.getTodayLimit(child.id).then(setDailyLimit);
  };

  useEffect(reload, [child.id]);

  const remainingDaily = Math.max(0, dailyLimit - usedToday);

  const redeem = async (minutes: number) => {
    setBusy(true);
    setError(null);
    try {
      await window.familyquest.redeemMinutes(child.id, minutes);
      playCoin();
      reload();
    } catch (e) {
      setError(ipcErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (blockedLabel) {
    return (
      <div className="empty-state">
        ⛔ {blockedLabel}
        <br />
        אי אפשר לפדות זמן מסך עכשיו.
      </div>
    );
  }

  if (remainingDaily <= 0) {
    return <div className="empty-state">המכסה היומית שלך נוצלה במלואה. נתראה מחר! 👋</div>;
  }

  return (
    <div>
      <div className="quest-meta" style={{ marginBottom: 16 }}>
        נותרו {remainingDaily} דקות למכסה היומית · עלות: {coinsPerMinute} מטבע/דקה
      </div>
      {error && <div style={{ color: '#ffb3b3', marginBottom: 12, fontWeight: 600 }}>{error}</div>}
      {child.coinBalance < lowBalanceThreshold && (
        <div style={{ color: 'var(--accent)', marginBottom: 12, fontSize: 13 }}>
          💡 נשארו לך רק {child.coinBalance} מטבעות — בצע עוד משימות כדי לצבור עוד!
        </div>
      )}
      <div className="redeem-grid">
        {OPTIONS.map((mins) => {
          const cost = Math.ceil(Math.min(mins, remainingDaily) * coinsPerMinute);
          const affordable = child.coinBalance >= cost;
          return (
            <div className="redeem-card" key={mins}>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{Math.min(mins, remainingDaily)}</div>
              <div className="quest-meta">דקות</div>
              <button disabled={!affordable || busy} onClick={() => redeem(mins)}>
                🪙 {cost}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
