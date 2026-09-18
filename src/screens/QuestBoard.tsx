import { useCallback, useEffect, useState } from 'react';
import type { Child, CoopQuest, Task } from '../types';

const RECURRENCE_LABEL: Record<Task['recurrence'], string> = {
  once: 'חד פעמי',
  daily: 'יומי',
  weekly: 'שבועי'
};

function coopBadge(task: Task, coopQuests: CoopQuest[], children: Child[]) {
  if (!task.coopId) return null;
  const coop = coopQuests.find((c) => c.id === task.coopId);
  if (!coop) return null;
  const names = coop.childIds.map((id) => children.find((c) => c.id === id)?.name || '?').join(', ');
  return (
    <div className="quest-meta" style={{ marginTop: 2 }}>
      🤝 שיתוף פעולה — {coop.approvedCount}/{coop.totalCount} השלימו · {names}
    </div>
  );
}

export default function QuestBoard({ childId, children }: { childId: string; children: Child[] }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [coopQuests, setCoopQuests] = useState<CoopQuest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    window.familyquest.listTasks(childId).then(setTasks);
    window.familyquest.listCoopQuests(childId).then(setCoopQuests);
  }, [childId]);

  useEffect(() => {
    reload();
    // lockManager's tick already pushes a lock:state event every 3s — no
    // separate poll needed on top of it (a redundant 10s interval used to
    // sit here, permanently behind the push and never actually the one
    // driving a refresh).
    const off = window.familyquest.onLockState(() => reload());
    return off;
  }, [reload]);

  const markDone = async (task: Task) => {
    setBusyId(task.id);
    try {
      // A proof-required task always opens the photo picker (no way to skip);
      // otherwise it's the child's choice whether to attach one voluntarily.
      const attach = task.requiresProof || window.confirm(`לצרף תמונה כהוכחה למשימה "${task.title}"? (אופציונלי)`);
      await window.familyquest.submitTask(task.id, attach);
      reload();
    } catch {
      // economy.submitTask throws when a required photo wasn't actually picked
      // (dialog canceled) — the task stays pending so the child can try again.
      window.alert('תמונה נדרשת להשלמת המשימה הזו — נסו שוב ובחרו תמונה.');
    } finally {
      setBusyId(null);
    }
  };

  const pending = tasks.filter((t) => t.status === 'pending');
  const submitted = tasks.filter((t) => t.status === 'submitted');
  const recentDecided = tasks
    .filter((t) => (t.status === 'approved' || t.status === 'rejected') && t.decidedAt)
    .sort((a, b) => (b.decidedAt! > a.decidedAt! ? 1 : -1))
    .slice(0, 4);

  if (tasks.length === 0) {
    return <div className="empty-state">אין עדיין משימות. ההורה שלך יוסיף בקרוב! 🎯</div>;
  }

  return (
    <div>
      {submitted.map((t) => (
        <div className="quest-card" key={t.id} style={{ opacity: 0.8 }}>
          <div>
            <div className="quest-title">{t.title}</div>
            <div className="quest-meta">
              ⏳ ממתין לאישור הורה · {RECURRENCE_LABEL[t.recurrence]} · 🪙 {t.rewardCoins}
            </div>
            {coopBadge(t, coopQuests, children)}
          </div>
        </div>
      ))}

      {pending.map((t) => (
        <div className="quest-card" key={t.id}>
          <div>
            <div className="quest-title">{t.title}</div>
            <div className="quest-meta">
              {RECURRENCE_LABEL[t.recurrence]} · 🪙 {t.rewardCoins}
              {t.requiresProof ? ' · 📷 דורש תמונה' : ''}
            </div>
            {coopBadge(t, coopQuests, children)}
          </div>
          <button className="quest-btn primary" disabled={busyId === t.id} onClick={() => markDone(t)}>
            {busyId === t.id ? '...' : 'סיימתי! ✅'}
          </button>
        </div>
      ))}

      {recentDecided.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="quest-meta" style={{ marginBottom: 8 }}>
            לאחרונה
          </div>
          {recentDecided.map((t) => (
            <div className="quest-card" key={t.id} style={{ opacity: 0.6 }}>
              <div>
                <div className="quest-title">{t.title}</div>
                <div className="quest-meta">
                  {t.status === 'approved' ? `✅ אושר (+${t.rewardCoins})` : `❌ נדחה${t.notes ? `: ${t.notes}` : ''}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
