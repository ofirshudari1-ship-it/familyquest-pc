import { useEffect, useState } from 'react';
import type { Badge, Child, Level, RestrictedWindow } from '../types';
import Avatar, { AVATAR_OPTIONS } from '../components/Avatar';
import CoinBadge from '../components/CoinBadge';
import Companion, { COMPANION_OPTIONS } from '../components/Companion';
import ConfirmDialog from '../components/ConfirmDialog';
import LevelBar from '../components/LevelBar';
import { THEME_PRESETS } from '../data/themes';

const DAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function ChildForm({
  initial,
  onSave,
  onCancel
}: {
  initial?: Partial<Child>;
  onSave: (data: Partial<Child>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [avatarId, setAvatarId] = useState(initial?.avatarId || AVATAR_OPTIONS[0].id);
  const [companionId, setCompanionId] = useState(initial?.companionId || COMPANION_OPTIONS[0].id);
  const [themeColor, setThemeColor] = useState(initial?.themeColor || THEME_PRESETS[0].id);
  const [dailyTimeLimitMins, setDailyTimeLimitMins] = useState(initial?.dailyTimeLimitMins ?? 120);
  const [bedtimeStart, setBedtimeStart] = useState(initial?.bedtimeStart || '20:30');
  const [bedtimeEnd, setBedtimeEnd] = useState(initial?.bedtimeEnd || '07:00');
  const [weekendEnabled, setWeekendEnabled] = useState(initial?.weekendDailyLimitMins != null);
  const [weekendDailyLimitMins, setWeekendDailyLimitMins] = useState(initial?.weekendDailyLimitMins ?? 180);
  const [allowedAppsText, setAllowedAppsText] = useState((initial?.allowedApps || []).join(', '));

  return (
    <div className="card">
      <input
        placeholder="שם"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="field"
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
        {AVATAR_OPTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAvatarId(a.id)}
            style={{
              border: avatarId === a.id ? '3px solid var(--primary)' : '3px solid transparent',
              borderRadius: '50%',
              padding: 0,
              background: 'none'
            }}
          >
            <Avatar avatarId={a.id} size={40} />
          </button>
        ))}
      </div>
      <label className="label">בן/בת לוויה</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 10px' }}>
        {COMPANION_OPTIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCompanionId(c.id)}
            title={c.name}
            style={{
              border: companionId === c.id ? '3px solid var(--primary)' : '3px solid transparent',
              borderRadius: '50%',
              padding: 0,
              background: 'none'
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--primary-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20
              }}
            >
              {c.emoji}
            </div>
          </button>
        ))}
      </div>
      <label className="label">ערכת נושא למסך הילד/ה</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 10px' }}>
        {THEME_PRESETS.map((t) => (
          <button
            key={t.id}
            onClick={() => setThemeColor(t.id)}
            title={t.label}
            style={{
              border: themeColor === t.id ? '3px solid var(--primary)' : '3px solid transparent',
              borderRadius: '50%',
              padding: 2,
              background: 'none'
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${t.bg2}, ${t.bg1})`
              }}
            />
          </button>
        ))}
      </div>
      <label className="label">מגבלה יומית (דקות)</label>
      <input
        type="number"
        min={0}
        value={dailyTimeLimitMins}
        onChange={(e) => setDailyTimeLimitMins(Number(e.target.value))}
        className="field"
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 10 }}>
        <input type="checkbox" checked={weekendEnabled} onChange={(e) => setWeekendEnabled(e.target.checked)} />
        מגבלה שונה לסוף שבוע (שישי-שבת)
      </label>
      {weekendEnabled && (
        <input
          type="number"
          min={0}
          value={weekendDailyLimitMins}
          onChange={(e) => setWeekendDailyLimitMins(Number(e.target.value))}
          className="field"
          placeholder="דקות בסוף שבוע"
        />
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="label">שעת שינה מ-</label>
          <input type="time" value={bedtimeStart} onChange={(e) => setBedtimeStart(e.target.value)} className="field" />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">עד</label>
          <input type="time" value={bedtimeEnd} onChange={(e) => setBedtimeEnd(e.target.value)} className="field" />
        </div>
      </div>
      <label className="label">אפליקציות מאושרות בזמן משחק (מופרד בפסיקים — ריק = בלי הגבלה)</label>
      <input
        placeholder="למשל: chrome, minecraft, steam"
        value={allowedAppsText}
        onChange={(e) => setAllowedAppsText(e.target.value)}
        className="field"
        dir="ltr"
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="btn-primary"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              avatarId,
              companionId,
              themeColor,
              dailyTimeLimitMins,
              bedtimeStart,
              bedtimeEnd,
              weekendDailyLimitMins: weekendEnabled ? weekendDailyLimitMins : null,
              allowedApps: allowedAppsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            })
          }
        >
          שמירה
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </div>
  );
}

function ChildBadges({ childId }: { childId: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  useEffect(() => {
    window.familyquest.getBadges(childId).then(setBadges);
  }, [childId]);
  if (badges.length === 0) return null;
  return (
    <div style={{ fontSize: 16, marginTop: 4 }} title={badges.map((b) => b.title).join(', ')}>
      {badges.map((b) => b.emoji).join(' ')}
    </div>
  );
}

function ChildCompanion({ child }: { child: Child }) {
  const [level, setLevel] = useState<Level | null>(null);
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    window.familyquest.getLevel(child.id).then(setLevel);
    window.familyquest.getStreak(child.id).then(setStreak);
  }, [child.id]);
  if (!level) return null;
  return <Companion companionId={child.companionId} level={level.level} streak={streak} size={44} compact />;
}

function ChildLevelBar({ childId }: { childId: string }) {
  const [level, setLevel] = useState<Level | null>(null);
  useEffect(() => {
    window.familyquest.getLevel(childId).then(setLevel);
  }, [childId]);
  if (!level) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <LevelBar level={level} variant="light" compact />
    </div>
  );
}

const MULTIPLIER_DURATIONS = [
  { label: 'שעה', ms: 3600000 },
  { label: '24 שעות', ms: 24 * 3600000 },
  { label: 'סוף שבוע (48 שעות)', ms: 48 * 3600000 }
];

function MultiplierControl({ child, onChanged }: { child: Child; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(2);
  const [durationMs, setDurationMs] = useState(MULTIPLIER_DURATIONS[1].ms);

  const active = child.coinMultiplier && new Date(child.coinMultiplier.expiresAt) > new Date();

  if (active) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginInlineEnd: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn)' }}>
          🎉 פי {child.coinMultiplier!.value} עד{' '}
          {new Date(child.coinMultiplier!.expiresAt).toLocaleString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
        <button
          className="btn-secondary"
          onClick={async () => {
            await window.familyquest.clearMultiplier(child.id);
            onChanged();
          }}
        >
          ביטול
        </button>
      </div>
    );
  }

  if (open) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginInlineEnd: 10 }}>
        <select value={value} onChange={(e) => setValue(Number(e.target.value))} style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border)' }}>
          <option value={1.5}>פי 1.5</option>
          <option value={2}>פי 2</option>
          <option value={3}>פי 3</option>
        </select>
        <select value={durationMs} onChange={(e) => setDurationMs(Number(e.target.value))} style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border)' }}>
          {MULTIPLIER_DURATIONS.map((d) => (
            <option key={d.ms} value={d.ms}>
              {d.label}
            </option>
          ))}
        </select>
        <button
          className="btn-primary"
          onClick={async () => {
            await window.familyquest.grantMultiplier(child.id, value, durationMs);
            setOpen(false);
            onChanged();
          }}
        >
          הענק
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <button className="btn-secondary" style={{ marginInlineEnd: 10 }} onClick={() => setOpen(true)}>
      🎉 בונוס מטבעות
    </button>
  );
}

function RestrictedWindowsPanel({ child, onChanged }: { child: Child; onChanged: () => void }) {
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('15:00');

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const create = async () => {
    if (!label.trim() || days.length === 0) return;
    await window.familyquest.createRestrictedWindow({ childId: child.id, label: label.trim(), days, start, end });
    setLabel('');
    onChanged();
  };

  return (
    <div className="card" style={{ background: 'var(--bg)' }}>
      <div className="label">חלונות נעילה נוספים (מעבר לשעת שינה) — למשל שעות לימודים</div>
      {(child.restrictedWindows || []).map((w: RestrictedWindow) => (
        <div key={w.id} className="row" style={{ display: 'flex', alignItems: 'center', padding: '6px 0' }}>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{w.label}</strong> · {w.days.map((d) => DAY_LABELS[d]).join('')} · {w.start}–{w.end}
          </div>
          <button
            className="btn-danger"
            style={{ marginRight: 0 }}
            onClick={async () => {
              await window.familyquest.removeRestrictedWindow(child.id, w.id);
              onChanged();
            }}
          >
            מחיקה
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input placeholder="שם (למשל: שעות לימודים)" value={label} onChange={(e) => setLabel(e.target.value)} className="field" style={{ marginBottom: 0, flex: '1 1 160px' }} />
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ padding: 9, borderRadius: 8, border: '1px solid var(--border)' }} />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ padding: 9, borderRadius: 8, border: '1px solid var(--border)' }} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        {DAY_LABELS.map((label2, d) => (
          <button
            key={d}
            onClick={() => toggleDay(d)}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: days.includes(d) ? 'var(--primary)' : 'var(--primary-dim)',
              color: days.includes(d) ? '#fff' : 'var(--primary)',
              fontSize: 12
            }}
          >
            {label2}
          </button>
        ))}
        <button className="btn-primary" style={{ marginRight: 8 }} onClick={create} disabled={!label.trim()}>
          הוספה
        </button>
      </div>
    </div>
  );
}

export default function DashboardChildren({ children, onChanged }: { children: Child[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [passFor, setPassFor] = useState<string | null>(null);
  const [passMinutes, setPassMinutes] = useState(30);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>ילדים</h2>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + הוספת ילד
        </button>
      </div>

      {adding && (
        <ChildForm
          onCancel={() => setAdding(false)}
          onSave={async (data) => {
            await window.familyquest.addChild(data);
            setAdding(false);
            onChanged();
          }}
        />
      )}

      {children.map((c) =>
        editingId === c.id ? (
          <ChildForm
            key={c.id}
            initial={c}
            onCancel={() => setEditingId(null)}
            onSave={async (data) => {
              await window.familyquest.updateChild(c.id, data);
              setEditingId(null);
              onChanged();
            }}
          />
        ) : (
          <div key={c.id}>
            <div className="card row">
              <Avatar avatarId={c.avatarId} size={52} />
              <ChildCompanion child={c} />
              <div style={{ flex: 1, marginRight: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{c.name}</div>
                <div className="dim">
                  {c.dailyTimeLimitMins} דק׳/יום
                  {c.weekendDailyLimitMins != null ? ` (${c.weekendDailyLimitMins} בסופ"ש)` : ''} · שינה {c.bedtimeStart}–
                  {c.bedtimeEnd}
                </div>
                <ChildLevelBar childId={c.id} />
                <ChildBadges childId={c.id} />
              </div>
              <CoinBadge amount={c.coinBalance} />
              {passFor === c.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 14 }}>
                  <input
                    type="number"
                    min={5}
                    value={passMinutes}
                    onChange={(e) => setPassMinutes(Number(e.target.value))}
                    style={{ width: 70, padding: 6, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      await window.familyquest.grantHomeworkPass(c.id, passMinutes);
                      setPassFor(null);
                      onChanged();
                    }}
                  >
                    הענק
                  </button>
                  <button className="btn-secondary" onClick={() => setPassFor(null)}>
                    ✕
                  </button>
                </div>
              ) : (
                <button className="btn-secondary" style={{ marginRight: 10 }} onClick={() => setPassFor(c.id)}>
                  📚 מעבר שיעורי בית
                </button>
              )}
              <MultiplierControl child={c} onChanged={onChanged} />
              <button className="btn-secondary" style={{ marginRight: 10 }} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                {expandedId === c.id ? 'סגירה ▲' : 'הגבלות נוספות ▼'}
              </button>
              <button className="btn-secondary" onClick={() => setEditingId(c.id)}>
                עריכה
              </button>
              <button className="btn-danger" onClick={() => setDeletingId(c.id)}>
                מחיקה
              </button>
            </div>
            {expandedId === c.id && <RestrictedWindowsPanel child={c} onChanged={onChanged} />}
          </div>
        )
      )}

      {deletingId && (
        <ConfirmDialog
          title="מחיקת פרופיל"
          message="כל המשימות, הסשנים והמטבעות של הילד הזה יימחקו לצמיתות. להמשיך?"
          danger
          confirmLabel="מחיקה"
          onCancel={() => setDeletingId(null)}
          onConfirm={async () => {
            await window.familyquest.removeChild(deletingId);
            setDeletingId(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
