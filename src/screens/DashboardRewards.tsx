import { useEffect, useState } from 'react';
import type { Child, Redemption, Reward } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { REWARD_TEMPLATES } from '../data/templates';

const EMOJI_OPTIONS = ['🎁', '🍕', '🎬', '🧸', '🍦', '📱', '🎮', '🚲', '🛌', '🎨'];
const TIER_LABEL: Record<Reward['tier'], string> = { small: 'קטן', medium: 'בינוני', large: 'גדול' };
const TIER_COLOR: Record<Reward['tier'], string> = { small: '#8a94a6', medium: '#c78f0f', large: '#7c3aed' };

function TierBadge({ tier }: { tier: Reward['tier'] }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: '#fff',
        background: TIER_COLOR[tier],
        borderRadius: 999,
        padding: '2px 9px'
      }}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

function NewRewardForm({ childId, onCreated }: { childId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState(30);
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);
  const [tier, setTier] = useState<Reward['tier']>('small');
  const [showTemplates, setShowTemplates] = useState(false);

  const applyTemplate = (t: (typeof REWARD_TEMPLATES)[number]) => {
    setTitle(t.title);
    setCost(t.cost);
    setEmoji(t.emoji);
    setTier(t.tier);
  };

  const create = async () => {
    if (!title.trim()) return;
    await window.familyquest.createReward({ childId, title: title.trim(), cost, emoji, tier });
    setTitle('');
    onCreated();
  };

  return (
    <div className="card">
      <button
        type="button"
        className="btn-secondary"
        style={{ marginBottom: 10, fontSize: 12.5 }}
        onClick={() => setShowTemplates((v) => !v)}
      >
        💡 הצעות מהירות {showTemplates ? '▲' : '▼'}
      </button>
      {showTemplates && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {REWARD_TEMPLATES.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => applyTemplate(t)}
              style={{
                fontSize: 12.5,
                padding: '5px 12px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: title === t.title ? 'var(--primary-dim)' : 'var(--surface)',
                color: title === t.title ? 'var(--primary)' : 'var(--text)'
              }}
            >
              {t.emoji} {t.title} · 🪙{t.cost}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {EMOJI_OPTIONS.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            style={{
              fontSize: 20,
              padding: '4px 8px',
              borderRadius: 8,
              border: emoji === e ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'var(--primary-dim)'
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <input placeholder="שם הפרס (למשל: פיצה ביום שישי)" value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="label">עלות במטבעות</label>
          <input
            type="number"
            min={1}
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
            style={{ width: 100, padding: 9, borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
        <div>
          <label className="label">גודל הפרס</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['small', 'medium', 'large'] as const).map((tKey) => (
              <button
                key={tKey}
                type="button"
                onClick={() => setTier(tKey)}
                style={{
                  fontSize: 12.5,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: tier === tKey ? `2px solid ${TIER_COLOR[tKey]}` : '2px solid transparent',
                  background: 'var(--primary-dim)',
                  color: tier === tKey ? TIER_COLOR[tKey] : 'var(--text)',
                  fontWeight: tier === tKey ? 700 : 400
                }}
              >
                {TIER_LABEL[tKey]}
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary" onClick={create} disabled={!title.trim()}>
          הוספת פרס
        </button>
      </div>
    </div>
  );
}

export default function DashboardRewards({ children, selectedChildId, onSelectChild }: {
  children: Child[];
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
}) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [deleting, setDeleting] = useState<Reward | null>(null);

  const reload = () => {
    if (!selectedChildId) return;
    window.familyquest.listRewards(selectedChildId).then(setRewards);
    window.familyquest.listRedemptions(selectedChildId).then(setRedemptions);
  };

  useEffect(reload, [selectedChildId]);

  if (!selectedChildId) return <div className="dim">הוסיפו ילד קודם בכרטיסייה "ילדים".</div>;

  const pendingRedemptions = redemptions.filter((r) => r.status === 'pending');
  const fulfilledRedemptions = redemptions
    .filter((r) => r.status === 'fulfilled')
    .sort((a, b) => (b.fulfilledAt! > a.fulfilledAt! ? 1 : -1))
    .slice(0, 5);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>חנות פרסים</h2>
        <select
          value={selectedChildId}
          onChange={(e) => onSelectChild(e.target.value)}
          style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {pendingRedemptions.length > 0 && (
        <>
          <h3>ממתין למסירה ({pendingRedemptions.length})</h3>
          {pendingRedemptions.map((r) => (
            <div className="card row" key={r.id}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {r.rewardEmoji} {r.rewardTitle}
                </div>
                <div className="dim">🪙 {r.cost} · נפדה ב-{new Date(r.requestedAt).toLocaleDateString('he-IL')}</div>
              </div>
              <button
                className="btn-primary"
                onClick={async () => {
                  await window.familyquest.fulfillRedemption(r.id);
                  reload();
                }}
              >
                ✅ נמסר
              </button>
            </div>
          ))}
        </>
      )}

      <NewRewardForm childId={selectedChildId} onCreated={reload} />

      <h3>קטלוג פרסים</h3>
      {rewards.length === 0 && <div className="dim">אין עדיין פרסים בחנות.</div>}
      {rewards.map((r) => (
        <div className="card row" key={r.id}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              {r.emoji} {r.title} <TierBadge tier={r.tier} />
            </div>
            <div className="dim">🪙 {r.cost}</div>
          </div>
          <button className="btn-danger" onClick={() => setDeleting(r)}>
            מחיקה
          </button>
        </div>
      ))}

      {fulfilledRedemptions.length > 0 && (
        <>
          <h3>נמסרו לאחרונה</h3>
          {fulfilledRedemptions.map((r) => (
            <div className="card row" key={r.id} style={{ opacity: 0.7 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {r.rewardEmoji} {r.rewardTitle}
                </div>
                <div className="dim">נמסר ב-{new Date(r.fulfilledAt!).toLocaleDateString('he-IL')}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title={`מחיקת "${deleting.title}"`}
          danger
          confirmLabel="מחיקה"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await window.familyquest.removeReward(deleting.id);
            setDeleting(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
