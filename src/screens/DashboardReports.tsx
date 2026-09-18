import { useEffect, useState } from 'react';
import type { AuditEntry, Child, CompletionRate, CoinsDay, FamilyWeeklyRow, Level, UsageDay } from '../types';
import BarChart from '../components/BarChart';

const RANGE_OPTIONS = [7, 14, 30, 90];

function average(days: UsageDay[]) {
  if (days.length === 0) return 0;
  return Math.round(days.reduce((s, d) => s + d.minutes, 0) / days.length);
}

function FamilyWeeklySummary({ children }: { children: Child[] }) {
  const [rows, setRows] = useState<FamilyWeeklyRow[]>([]);

  useEffect(() => {
    window.familyquest.familyWeeklySummary().then(setRows);
  }, [children]);

  if (children.length < 2 || rows.length === 0) return null;
  const maxCoins = Math.max(1, ...rows.map((r) => r.coinsThisWeek));

  return (
    <div className="card no-print">
      <h3 style={{ marginTop: 0 }}>סיכום משפחתי השבועי</h3>
      <div className="dim" style={{ marginBottom: 12 }}>
        7 הימים האחרונים, לצד — לא מול. אין כאן "ראשון/אחרון".
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <div key={r.childId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 70, fontSize: 13, fontWeight: 600 }}>{r.name}</div>
            <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, overflow: 'hidden', height: 22 }}>
              <div
                style={{
                  width: `${(r.coinsThisWeek / maxCoins) * 100}%`,
                  minWidth: r.coinsThisWeek > 0 ? 4 : 0,
                  height: '100%',
                  background: 'linear-gradient(90deg, #4834a3, #6c5ce7)'
                }}
              />
            </div>
            <div style={{ width: 110, fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'left' }}>
              🪙 {r.coinsThisWeek} · {r.tasksApprovedThisWeek} משימות
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardReports({ children, selectedChildId, onSelectChild }: {
  children: Child[];
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
}) {
  const [rangeDays, setRangeDays] = useState(14);
  const [usage, setUsage] = useState<UsageDay[]>([]);
  const [coinsByDay, setCoinsByDay] = useState<CoinsDay[]>([]);
  const [completion, setCompletion] = useState<CompletionRate | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [level, setLevel] = useState<Level | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedChildId) return;
    window.familyquest.usageByDay(selectedChildId, rangeDays).then(setUsage);
    window.familyquest.coinsEarnedByDay(selectedChildId, rangeDays).then(setCoinsByDay);
    window.familyquest.completionRate(selectedChildId, rangeDays).then(setCompletion);
    window.familyquest.getAudit(selectedChildId, 100).then(setAudit);
    window.familyquest.getLevel(selectedChildId).then(setLevel);
  }, [selectedChildId, rangeDays]);

  if (!selectedChildId) return <div className="dim">הוסיפו ילד קודם בכרטיסייה "ילדים".</div>;
  const child = children.find((c) => c.id === selectedChildId);
  if (!child) return null;

  const thisWeek = usage.slice(-7);
  const prevWeek = usage.slice(-14, -7);
  const avgMinutes = average(usage);
  const thisWeekAvg = average(thisWeek);
  const prevWeekAvg = average(prevWeek);
  const trend = prevWeekAvg === 0 ? null : Math.round(((thisWeekAvg - prevWeekAvg) / prevWeekAvg) * 100);

  const exportCsv = async () => {
    const result = await window.familyquest.exportReportCsv(selectedChildId, rangeDays);
    setExportMsg(result.ok ? 'הקובץ נשמר בהצלחה ✅' : null);
    if (result.ok) setTimeout(() => setExportMsg(null), 4000);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }} className="no-print">
        <h2 style={{ margin: 0 }}>דוחות</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
            style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
          >
            {RANGE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} ימים אחרונים
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={exportCsv}>
            📄 ייצוא ל-CSV
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            🖨️ הדפסת דוח
          </button>
        </div>
      </div>
      {exportMsg && <div className="dim no-print" style={{ marginBottom: 12 }}>{exportMsg}</div>}

      <h2 className="print-only" style={{ display: 'none' }}>
        דוח FamilyQuest PC — {child.name} — {new Date().toLocaleDateString('he-IL')}
      </h2>

      <div className="stat-row">
        <div className="stat-card">
          <div className="dim">ממוצע יומי ({rangeDays} יום)</div>
          <div className="stat-value">{avgMinutes} דק׳</div>
        </div>
        <div className="stat-card">
          <div className="dim">מגמה שבועית</div>
          <div className="stat-value">
            {trend === null ? '—' : (
              <span style={{ color: trend > 0 ? 'var(--warn)' : trend < 0 ? 'var(--good)' : 'inherit' }}>
                {trend > 0 ? '▲' : trend < 0 ? '▼' : '–'} {Math.abs(trend)}%
              </span>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="dim">אחוז ביצוע משימות ({rangeDays} יום)</div>
          <div className="stat-value">
            {completion?.rate === null || completion === null ? '—' : `${Math.round(completion.rate * 100)}%`}
          </div>
        </div>
        <div className="stat-card">
          <div className="dim">רמה</div>
          <div className="stat-value">{level ? `${level.level} · ${level.title}` : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="dim">יתרת מטבעות</div>
          <div className="stat-value">🪙 {child.coinBalance}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>זמן מסך יומי ({rangeDays} יום, דקות)</h3>
        <BarChart
          data={usage.map((d) => ({ date: d.date, value: d.minutes }))}
          limit={child.dailyTimeLimitMins}
          label="שימוש בזמן מסך"
        />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>מטבעות שהורווחו ליום ({rangeDays} יום)</h3>
        <BarChart
          data={coinsByDay.map((d) => ({ date: d.date, value: d.coins }))}
          color="#c99a2e"
          overColor="#c99a2e"
          label="מטבעות שהורווחו ליום"
        />
      </div>

      <FamilyWeeklySummary children={children} />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>יומן פעילות</h3>
        {audit.length === 0 && <div className="dim">אין עדיין רשומות.</div>}
        {audit.map((a) => (
          <div className="audit-row" key={a.id}>
            <span>{a.message}</span>
            <span className="dim">{new Date(a.ts).toLocaleString('he-IL')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
