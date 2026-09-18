import { useEffect, useState } from 'react';
import type { Child, CoopQuest, Recurrence, Task } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { QUEST_PACKS, QUEST_TEMPLATES } from '../data/templates';

const RECURRENCE_LABEL: Record<Recurrence, string> = { once: 'חד פעמי', daily: 'יומי', weekly: 'שבועי' };
const STATUS_LABEL: Record<Task['status'], string> = {
  pending: 'ממתין לביצוע',
  submitted: 'ממתין לאישור',
  approved: 'אושר',
  rejected: 'נדחה'
};
const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function DayPicker({ activeDays, onChange }: { activeDays: number[]; onChange: (days: number[]) => void }) {
  const toggle = (day: number) => {
    onChange(activeDays.includes(day) ? activeDays.filter((d) => d !== day) : [...activeDays, day].sort());
  };
  return (
    <div>
      <label className="label">באילו ימים</label>
      <div style={{ display: 'flex', gap: 4 }}>
        {DAY_LABELS.map((label, day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontSize: 12.5,
              background: activeDays.includes(day) ? 'var(--primary)' : 'var(--surface)',
              color: activeDays.includes(day) ? '#fff' : 'var(--text)'
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NewTaskForm({ childId, onCreated }: { childId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [rewardCoins, setRewardCoins] = useState(10);
  const [requiresProof, setRequiresProof] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence>('once');
  const [activeDays, setActiveDays] = useState<number[]>(ALL_DAYS);
  const [showTemplates, setShowTemplates] = useState(false);
  const [applyingPack, setApplyingPack] = useState<(typeof QUEST_PACKS)[number] | null>(null);

  const applyTemplate = (t: (typeof QUEST_TEMPLATES)[number]) => {
    setTitle(t.title);
    setRewardCoins(t.rewardCoins);
    setRequiresProof(t.requiresProof === true);
    setRecurrence(t.recurrence);
    setActiveDays(t.recurrence === 'weekly' ? [new Date().getDay()] : ALL_DAYS);
  };

  const changeRecurrence = (r: Recurrence) => {
    setRecurrence(r);
    setActiveDays(r === 'weekly' ? [new Date().getDay()] : ALL_DAYS);
  };

  const create = async () => {
    if (!title.trim()) return;
    const days = recurrence === 'once' ? null : activeDays;
    await window.familyquest.createTask({ childId, title: title.trim(), rewardCoins, requiresProof, recurrence, activeDays: days });
    setTitle('');
    setRewardCoins(10);
    onCreated();
  };

  const applyPack = async (pack: (typeof QUEST_PACKS)[number]) => {
    const templates = pack.questTitles.map((qt) => QUEST_TEMPLATES.find((t) => t.title === qt)).filter(Boolean) as typeof QUEST_TEMPLATES;
    for (const t of templates) {
      await window.familyquest.createTask({
        childId,
        title: t.title,
        rewardCoins: t.rewardCoins,
        requiresProof: t.requiresProof === true,
        recurrence: t.recurrence,
        activeDays: t.recurrence === 'weekly' ? [new Date().getDay()] : t.recurrence === 'daily' ? ALL_DAYS : null
      });
    }
    setApplyingPack(null);
    onCreated();
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => setShowTemplates((v) => !v)}>
          💡 הצעות מהירות {showTemplates ? '▲' : '▼'}
        </button>
        {QUEST_PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            className="btn-secondary"
            style={{ fontSize: 12.5 }}
            onClick={() => setApplyingPack(pack)}
          >
            {pack.icon} {pack.title} ({pack.questTitles.length})
          </button>
        ))}
      </div>
      {showTemplates && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {QUEST_TEMPLATES.map((t) => (
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
              {t.title} · 🪙{t.rewardCoins}
            </button>
          ))}
        </div>
      )}
      <input placeholder="שם המשימה (למשל: לסדר את החדר)" value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="label">מטבעות</label>
          <input
            type="number"
            min={0}
            value={rewardCoins}
            onChange={(e) => setRewardCoins(Number(e.target.value))}
            style={{ width: 90, padding: 9, borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
        <div>
          <label className="label">חזרתיות</label>
          <select
            value={recurrence}
            onChange={(e) => changeRecurrence(e.target.value as Recurrence)}
            style={{ padding: 9, borderRadius: 8, border: '1px solid var(--border)' }}
          >
            <option value="once">חד פעמי</option>
            <option value="daily">יומי</option>
            <option value="weekly">שבועי</option>
          </select>
        </div>
        {recurrence !== 'once' && <DayPicker activeDays={activeDays} onChange={setActiveDays} />}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={requiresProof} onChange={(e) => setRequiresProof(e.target.checked)} />
          📷 דורש תמונה כהוכחה
        </label>
        <button className="btn-primary" onClick={create} disabled={!title.trim() || (recurrence !== 'once' && activeDays.length === 0)}>
          יצירת משימה
        </button>
      </div>

      {applyingPack && (
        <ConfirmDialog
          title={`${applyingPack.icon} ${applyingPack.title}`}
          confirmLabel={`יצירת ${applyingPack.questTitles.length} משימות`}
          onCancel={() => setApplyingPack(null)}
          onConfirm={() => applyPack(applyingPack)}
        >
          <div className="dim">ייווצרו: {applyingPack.questTitles.join(', ')}</div>
        </ConfirmDialog>
      )}
    </div>
  );
}

function NewCoopQuestForm({ children, onCreated }: { children: Child[]; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [rewardCoins, setRewardCoins] = useState(10);
  const [bonusCoins, setBonusCoins] = useState(20);
  const [requiresProof, setRequiresProof] = useState(false);
  const [childIds, setChildIds] = useState<string[]>([]);

  const toggleChild = (id: string) => {
    setChildIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const create = async () => {
    if (!title.trim() || childIds.length < 2) return;
    await window.familyquest.createCoopQuest({ title: title.trim(), rewardCoins, bonusCoins, requiresProof, childIds });
    setTitle('');
    setRewardCoins(10);
    setBonusCoins(20);
    setChildIds([]);
    onCreated();
  };

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 8 }}>🤝 משימת שיתוף פעולה חדשה</div>
      <div className="dim" style={{ marginBottom: 10, fontSize: 13 }}>
        כל ילד שתבחרו יקבל את אותה המשימה. כשכולם יסיימו, כולם יקבלו גם בונוס משותף.
      </div>
      <input placeholder="שם המשימה (למשל: לסדר את הסלון יחד)" value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
      <div style={{ marginBottom: 10 }}>
        <label className="label">מי משתתף (לפחות שני ילדים)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleChild(c.id)}
              style={{
                fontSize: 13,
                padding: '6px 14px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: childIds.includes(c.id) ? 'var(--primary)' : 'var(--surface)',
                color: childIds.includes(c.id) ? '#fff' : 'var(--text)'
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="label">מטבעות לכל ילד</label>
          <input
            type="number"
            min={0}
            value={rewardCoins}
            onChange={(e) => setRewardCoins(Number(e.target.value))}
            style={{ width: 90, padding: 9, borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
        <div>
          <label className="label">בונוס משותף בסיום</label>
          <input
            type="number"
            min={0}
            value={bonusCoins}
            onChange={(e) => setBonusCoins(Number(e.target.value))}
            style={{ width: 90, padding: 9, borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={requiresProof} onChange={(e) => setRequiresProof(e.target.checked)} />
          📷 דורש תמונה כהוכחה
        </label>
        <button className="btn-primary" onClick={create} disabled={!title.trim() || childIds.length < 2}>
          יצירת משימת שיתוף פעולה
        </button>
      </div>
    </div>
  );
}

function EditCoopQuestDialog({ coop, onDone, onCancel }: { coop: CoopQuest; onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(coop.title);
  const [rewardCoins, setRewardCoins] = useState(coop.rewardCoins);
  const [bonusCoins, setBonusCoins] = useState(coop.bonusCoins);
  const [requiresProof, setRequiresProof] = useState(coop.requiresProof);

  const save = async () => {
    if (!title.trim()) return;
    await window.familyquest.updateCoopQuest(coop.id, { title: title.trim(), rewardCoins, bonusCoins, requiresProof });
    onDone();
  };

  return (
    <ConfirmDialog title={`עריכת "${coop.title}"`} confirmLabel="שמירה" onCancel={onCancel} onConfirm={save}>
      <div className="dim" style={{ marginBottom: 10, fontSize: 13 }}>
        השינוי חל על משתתפים שעדיין לא דיווחו על ביצוע — מי שכבר דיווח/אושר/נדחה נשאר בתנאים המקוריים.
      </div>
      <input placeholder="שם המשימה" value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="label">מטבעות לכל ילד (למי שעדיין לא ביצע)</label>
          <input
            type="number"
            min={0}
            value={rewardCoins}
            onChange={(e) => setRewardCoins(Number(e.target.value))}
            style={{ width: 90, padding: 9, borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
        <div>
          <label className="label">בונוס משותף בסיום</label>
          <input
            type="number"
            min={0}
            value={bonusCoins}
            onChange={(e) => setBonusCoins(Number(e.target.value))}
            style={{ width: 90, padding: 9, borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={requiresProof} onChange={(e) => setRequiresProof(e.target.checked)} />
          📷 דורש תמונה כהוכחה
        </label>
      </div>
    </ConfirmDialog>
  );
}

function ActiveCoopQuests({ children, onTasksChanged }: { children: Child[]; onTasksChanged: () => void }) {
  const [coopQuests, setCoopQuests] = useState<CoopQuest[]>([]);
  const [editing, setEditing] = useState<CoopQuest | null>(null);
  const [canceling, setCanceling] = useState<CoopQuest | null>(null);

  const reload = () => {
    window.familyquest.listCoopQuests().then(setCoopQuests);
  };

  useEffect(reload, []);

  const active = coopQuests.filter((c) => !c.completedAt);

  const nameFor = (id: string) => children.find((c) => c.id === id)?.name || '?';

  return (
    <>
      {active.length > 0 && <h3>שיתופי פעולה פעילים</h3>}
      {active.map((c) => (
        <div className="card row" key={c.id}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>🤝 {c.title}</div>
            <div className="dim" style={{ marginTop: 4 }}>
              {c.approvedCount}/{c.totalCount} השלימו · {c.childIds.map(nameFor).join(', ')}
              {c.bonusCoins > 0 ? ` · בונוס 🪙${c.bonusCoins} בסיום` : ''}
              {c.requiresProof ? ' · 📷 דורש תמונה' : ''}
            </div>
          </div>
          <button className="btn-secondary" onClick={() => setEditing(c)}>
            ✏️ עריכה
          </button>
          <button className="btn-danger" onClick={() => setCanceling(c)}>
            🗑️ ביטול
          </button>
        </div>
      ))}

      {editing && (
        <EditCoopQuestDialog
          coop={editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            reload();
            onTasksChanged();
          }}
        />
      )}

      {canceling && (
        <ConfirmDialog
          title={`ביטול "${canceling.title}"`}
          confirmLabel="ביטול שיתוף הפעולה"
          danger
          onCancel={() => setCanceling(null)}
          onConfirm={async () => {
            await window.familyquest.cancelCoopQuest(canceling.id);
            setCanceling(null);
            reload();
            onTasksChanged();
          }}
        >
          <div className="dim" style={{ fontSize: 13 }}>
            המשימות של מי שעדיין לא ביצע יימחקו. מי שכבר דיווח/אושר/נדחה — הרשומה שלו/ה נשארת, רק לא כחלק משיתוף הפעולה.
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}

// Shows the proof photo attached to a submitted task as a real thumbnail
// (fetched as a data: URL via getProofImage — a plain file:// <img> is
// fragile: blocked from the http://localhost dev server and inconsistent
// across platforms in the packaged build) instead of just "צורפה תמונה"
// text, so a parent can verify at a glance. Click to see it full-size.
function ProofThumbnail({ proofPath }: { proofPath: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    window.familyquest.getProofImage(proofPath).then(setSrc);
  }, [proofPath]);

  if (!src) return <span className="dim">📷 טוען תמונה...</span>;

  return (
    <>
      <img
        src={src}
        alt="הוכחת ביצוע"
        onClick={() => setExpanded(true)}
        style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--border)' }}
      />
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,30,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer'
          }}
        >
          <img src={src} alt="הוכחת ביצוע" style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 12 }} />
        </div>
      )}
    </>
  );
}

export default function DashboardQuests({ children, selectedChildId, onSelectChild }: {
  children: Child[];
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rejecting, setRejecting] = useState<Task | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [coopRefreshKey, setCoopRefreshKey] = useState(0);

  const reload = () => {
    if (selectedChildId) window.familyquest.listTasks(selectedChildId).then(setTasks);
    setCoopRefreshKey((k) => k + 1);
  };

  useEffect(reload, [selectedChildId]);

  if (!selectedChildId) return <div className="dim">הוסיפו ילד קודם בכרטיסייה "ילדים".</div>;

  const submitted = tasks.filter((t) => t.status === 'submitted');
  const others = tasks.filter((t) => t.status !== 'submitted').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>משימות</h2>
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

      <NewTaskForm childId={selectedChildId} onCreated={reload} />

      <NewCoopQuestForm children={children} onCreated={reload} />
      <ActiveCoopQuests key={coopRefreshKey} children={children} onTasksChanged={reload} />

      {submitted.length > 0 && (
        <>
          <h3>ממתין לאישור ({submitted.length})</h3>
          {submitted.map((t) => (
            <div className="card row" key={t.id}>
              {t.proofPath && <ProofThumbnail proofPath={t.proofPath} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{t.title}</div>
                <div className="dim">🪙 {t.rewardCoins} · {RECURRENCE_LABEL[t.recurrence]}</div>
              </div>
              <button
                className="btn-primary"
                onClick={async () => {
                  await window.familyquest.approveTask(t.id);
                  reload();
                }}
              >
                ✅ אישור
              </button>
              <button className="btn-danger" onClick={() => setRejecting(t)}>
                ❌ דחייה
              </button>
            </div>
          ))}
        </>
      )}

      <h3>כל המשימות</h3>
      {others.length === 0 && <div className="dim">אין עדיין משימות.</div>}
      {others.map((t) => (
        <div className="card row" key={t.id}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{t.title}</div>
            <div className="dim">
              🪙 {t.rewardCoins} · {RECURRENCE_LABEL[t.recurrence]} · {STATUS_LABEL[t.status]}
              {t.requiresProof ? ' · 📷 דורש תמונה' : ''}
            </div>
          </div>
          <button className="btn-danger" onClick={() => setDeleting(t)}>
            מחיקה
          </button>
        </div>
      ))}

      {rejecting && (
        <ConfirmDialog
          title={`דחיית "${rejecting.title}"`}
          confirmLabel="דחייה"
          danger
          onCancel={() => {
            setRejecting(null);
            setRejectNote('');
          }}
          onConfirm={async () => {
            await window.familyquest.rejectTask(rejecting.id, rejectNote);
            setRejecting(null);
            setRejectNote('');
            reload();
          }}
        >
          <input
            placeholder="הערה קצרה לילד (אופציונלי)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="field"
            style={{ marginBottom: 0 }}
          />
        </ConfirmDialog>
      )}

      {deleting && (
        <ConfirmDialog
          title="מחיקת משימה"
          danger
          confirmLabel="מחיקה"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await window.familyquest.removeTask(deleting.id);
            setDeleting(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
