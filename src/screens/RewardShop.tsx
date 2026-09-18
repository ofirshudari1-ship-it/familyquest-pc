import { useEffect, useState } from 'react';
import type { Redemption, Reward } from '../types';
import { playCoin } from '../sound';
import { ipcErrorMessage } from '../ipcError';

export default function RewardShop({ childId, coinBalance }: { childId: string; coinBalance: number }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [pending, setPending] = useState<Redemption[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    window.familyquest.listRewards(childId).then(setRewards);
    window.familyquest.listRedemptions(childId).then((all) => setPending(all.filter((r) => r.status === 'pending')));
  };

  useEffect(reload, [childId]);

  const request = async (reward: Reward) => {
    setBusyId(reward.id);
    setError(null);
    try {
      await window.familyquest.requestReward(childId, reward.id);
      playCoin();
      reload();
    } catch (e) {
      setError(ipcErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (rewards.length === 0 && pending.length === 0) {
    return <div className="empty-state">ההורה עוד לא הוסיף פרסים לחנות. 🎁</div>;
  }

  return (
    <div>
      {error && <div style={{ color: '#ffb3b3', marginBottom: 12, fontWeight: 600 }}>{error}</div>}

      {pending.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="quest-meta" style={{ marginBottom: 8 }}>
            ממתין למסירה
          </div>
          {pending.map((r) => (
            <div className="quest-card" key={r.id} style={{ opacity: 0.85 }}>
              <div>
                <div className="quest-title">
                  {r.rewardEmoji} {r.rewardTitle}
                </div>
                <div className="quest-meta">ההורה יביא לך את זה בקרוב · 🪙 {r.cost}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="reward-grid">
        {[...rewards]
          .sort((a, b) => ['small', 'medium', 'large'].indexOf(a.tier) - ['small', 'medium', 'large'].indexOf(b.tier))
          .map((r) => (
            <div className={`reward-card tier-${r.tier}`} key={r.id}>
              {r.tier === 'large' && <div className="reward-tier-glow">✨</div>}
              <div className="reward-emoji">{r.emoji}</div>
              <div style={{ fontWeight: 700 }}>{r.title}</div>
              <button disabled={coinBalance < r.cost || busyId === r.id} onClick={() => request(r)}>
                🪙 {r.cost}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
