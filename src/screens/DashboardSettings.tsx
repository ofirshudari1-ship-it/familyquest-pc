import { useEffect, useState } from 'react';
import type { SecurityQuestion, Settings, UpdateStatus } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import { setSoundEnabled } from '../sound';

function BackupCard() {
  const [msg, setMsg] = useState('');
  const [confirmImport, setConfirmImport] = useState(false);

  const doExport = async () => {
    const result = await window.familyquest.exportBackup();
    if (result.message) {
      setMsg(result.message);
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const doImport = async () => {
    setConfirmImport(false);
    const result = await window.familyquest.importBackup();
    if (result.message) setMsg(result.message);
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>גיבוי ושחזור</h3>
      <p className="dim" style={{ marginTop: 0 }}>
        כל הנתונים (ילדים, משימות, מטבעות, היסטוריה) שמורים רק על המחשב הזה — לא בענן. מומלץ לגבות לקובץ
        מדי פעם, ובוודאות לפני החלפת מחשב. התוכנה גם שומרת אוטומטית עד 5 גיבויים אחרונים בכל הפעלה, כרשת ביטחון.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-secondary" onClick={doExport}>
          💾 שמירת גיבוי לקובץ
        </button>
        <button className="btn-secondary" onClick={() => setConfirmImport(true)}>
          📂 שחזור מגיבוי
        </button>
      </div>
      {msg && <div className="dim" style={{ marginTop: 10 }}>{msg}</div>}
      {confirmImport && (
        <ConfirmDialog
          title="שחזור מגיבוי?"
          message="הפעולה תחליף את כל הנתונים הנוכחיים בתוכן הקובץ שתבחרו (ילדים, משימות, מטבעות, היסטוריה). לא ניתן לבטל."
          danger
          confirmLabel="בחירת קובץ ושחזור"
          onCancel={() => setConfirmImport(false)}
          onConfirm={doImport}
        />
      )}
    </div>
  );
}

function SecurityQuestionCard() {
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [questionId, setQuestionId] = useState('');
  const [answer, setAnswer] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    window.familyquest.getSecurityQuestions().then(setQuestions);
    window.familyquest.getSecurityQuestion().then((q) => q && setQuestionId(q.id));
  }, []);

  const save = async () => {
    if (!questionId || answer.trim().length < 2) return;
    await window.familyquest.setSecurityQuestion(questionId, answer);
    setAnswer('');
    setMsg('עודכן ✓');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>שאלת אבטחה לשחזור קוד PIN</h3>
      <p className="dim" style={{ marginTop: 0 }}>
        משמשת רק אם שוכחים את קוד ה-PIN — ללא אימייל, ללא שרת. עדכון כאן דורש הזנת תשובה חדשה מלאה.
      </p>
      <select
        value={questionId}
        onChange={(e) => setQuestionId(e.target.value)}
        style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }}
      >
        {questions.map((q) => (
          <option key={q.id} value={q.id}>
            {q.text}
          </option>
        ))}
      </select>
      <input
        placeholder="תשובה חדשה"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="field"
      />
      {msg && <div className="dim" style={{ marginBottom: 8 }}>{msg}</div>}
      <button className="btn-secondary" onClick={save} disabled={answer.trim().length < 2}>
        עדכון שאלת האבטחה
      </button>
    </div>
  );
}

function UpdatesCard() {
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
  const [feedUrl, setFeedUrl] = useState('');
  const [feedSaved, setFeedSaved] = useState(false);

  useEffect(() => {
    window.familyquest.appInfo().then((i) => setVersion(i.version));
    window.familyquest.getUpdateStatus().then(setStatus);
    window.familyquest.getSettings().then((s) => setFeedUrl(s.updateFeedUrl || ''));
    return window.familyquest.onUpdateStatus(setStatus);
  }, []);

  const saveFeedUrl = async () => {
    await window.familyquest.setSettings({ updateFeedUrl: feedUrl.trim() || null });
    setFeedSaved(true);
    setTimeout(() => setFeedSaved(false), 2000);
  };

  const statusText = (): string => {
    switch (status.state) {
      case 'idle':
        return '';
      case 'dev-mode':
        return status.message;
      case 'checking':
        return 'בודק גרסה חדשה...';
      case 'available':
        return `גרסה ${status.version} זמינה!`;
      case 'not-available':
        return 'אתם מריצים את הגרסה העדכנית ביותר ✓';
      case 'downloading':
        return `מוריד עדכון... ${status.percent}%`;
      case 'downloaded':
        return `גרסה ${status.version} מוכנה להתקנה`;
      case 'error':
        return status.message;
      default:
        return '';
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>עדכוני תוכנה</h3>
      <p className="dim" style={{ marginTop: 0 }}>
        גרסה נוכחית: {version || '—'}
      </p>
      {statusText() && (
        <p style={{ fontSize: 13, color: status.state === 'error' ? 'var(--bad)' : 'var(--text-dim)' }}>{statusText()}</p>
      )}
      <label className="label">כתובת שרת עדכונים (מתקדם — ריק = לא מוגדר)</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          className="field"
          style={{ marginBottom: 0 }}
          placeholder="https://..."
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          dir="ltr"
        />
        <button className="btn-secondary" onClick={saveFeedUrl}>
          {feedSaved ? 'נשמר ✓' : 'שמירה'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-secondary"
          disabled={status.state === 'checking' || status.state === 'downloading'}
          onClick={() => window.familyquest.checkForUpdates()}
        >
          🔄 בדוק עדכונים
        </button>
        {status.state === 'available' && (
          <button className="btn-primary" onClick={() => window.familyquest.downloadUpdate()}>
            הורדה
          </button>
        )}
        {status.state === 'downloaded' && (
          <button className="btn-primary" onClick={() => window.familyquest.installUpdate()}>
            התקנה והפעלה מחדש
          </button>
        )}
      </div>
    </div>
  );
}

export default function DashboardSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [whitelistInput, setWhitelistInput] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    window.familyquest.getSettings().then(setSettings);
  }, []);

  const flash = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const save = async (patch: Partial<Settings>) => {
    const updated = await window.familyquest.setSettings(patch);
    setSettings(updated);
    flash('נשמר ✓');
  };

  const changePin = async () => {
    setPinMsg('');
    if (!(await window.familyquest.verifyPin(currentPin))) return setPinMsg('קוד נוכחי שגוי');
    if (newPin.length < 4) return setPinMsg('קוד חדש חייב 4 ספרות לפחות');
    if (newPin !== newPinConfirm) return setPinMsg('הקודים החדשים לא תואמים');
    await window.familyquest.setPin(newPin);
    setCurrentPin('');
    setNewPin('');
    setNewPinConfirm('');
    setPinMsg('הקוד עודכן ✓');
  };

  if (!settings) return <LoadingSpinner />;

  const whitelist = settings.whitelist || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>הגדרות</h2>
        {savedMsg && <span style={{ color: 'var(--good)', fontWeight: 600 }}>{savedMsg}</span>}
      </div>

      <UpdatesCard />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>כלכלת מטבעות</h3>
        <label className="label">עלות מטבעות לדקת זמן מסך</label>
        <input
          type="number"
          min={0.1}
          step={0.1}
          defaultValue={settings.coinsPerMinute}
          onBlur={(e) => save({ coinsPerMinute: Number(e.target.value) })}
          style={{ width: 100, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
        />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>חוויית שימוש</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={settings.soundEffectsEnabled}
            onChange={(e) => {
              setSoundEnabled(e.target.checked);
              save({ soundEffectsEnabled: e.target.checked });
            }}
          />
          צלילי אפקטים (מטבעות, אישור משימות)
        </label>
        <label className="label">התראת יתרה נמוכה (מתחת ל-)</label>
        <input
          type="number"
          min={0}
          defaultValue={settings.lowBalanceThreshold}
          onBlur={(e) => save({ lowBalanceThreshold: Number(e.target.value) })}
          style={{ width: 100, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
        />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>הכרה בין אחים</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.siblingRecognitionEnabled}
            onChange={(e) => save({ siblingRecognitionEnabled: e.target.checked })}
          />
          הצג "כוכב/ת השבוע" בכרטיסיית הבית (חיובי בלבד — אין דירוג או "מקום אחרון")
        </label>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>הפעלה אוטומטית ורקע</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={settings.autostart}
            onChange={(e) => save({ autostart: e.target.checked })}
          />
          הפעל את FamilyQuest PC אוטומטית עם הפעלת המחשב
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(e) => save({ minimizeToTray: e.target.checked })}
          />
          סגירת דשבורד ההורים (X) ממזערת לסמל במגש המערכת, במקום לסגור אותו
        </label>
        <p className="dim" style={{ marginTop: 0, marginBottom: 12 }}>
          הבקרה על זמן המסך פעילה תמיד ברקע כל עוד התוכנה פועלת, גם כשהאפשרות הזו כבויה — היא קובעת רק אם
          חלון דשבורד ההורים עצמו נסגר או רק מוסתר. יציאה מלאה מהתוכנה תמיד אפשרית מקליק ימני על סמל המגש
          ← "יציאה", או מכפתור היציאה למטה בעמוד הזה.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.notifyOnSessionChange}
            onChange={(e) => save({ notifyOnSessionChange: e.target.checked })}
          />
          התראת מערכת כשזמן מסך של ילד/ה מתחיל או נגמר, אם דשבורד ההורים לא פתוח
        </label>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>רשימה לבנה (מידע להורה בלבד)</h3>
        <p className="dim" style={{ marginTop: 0 }}>
          חסימה סלקטיבית ברמת אפליקציה (לאפשר Zoom ולחסום משחקים בו-זמנית) אינה נתמכת ב-v1 — ראו
          "מעבר שיעורי בית" בכרטיסיית הילדים. הרשימה כאן היא תיעוד בלבד.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="field"
            style={{ marginBottom: 0 }}
            placeholder="שם אפליקציה/אתר"
            value={whitelistInput}
            onChange={(e) => setWhitelistInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && whitelistInput.trim()) {
                save({ whitelist: [...whitelist, whitelistInput.trim()] });
                setWhitelistInput('');
              }
            }}
          />
          <button
            className="btn-primary"
            onClick={() => {
              if (whitelistInput.trim()) {
                save({ whitelist: [...whitelist, whitelistInput.trim()] });
                setWhitelistInput('');
              }
            }}
          >
            הוספה
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {whitelist.map((w, i) => (
            <span
              key={i}
              style={{ background: 'var(--primary-dim)', color: 'var(--primary)', borderRadius: 999, padding: '4px 12px', fontSize: 13 }}
            >
              {w}{' '}
              <button
                onClick={() => save({ whitelist: whitelist.filter((_, idx) => idx !== i) })}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginRight: 4 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שינוי קוד PIN</h3>
        <input type="password" inputMode="numeric" placeholder="קוד נוכחי" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))} className="field" />
        <input type="password" inputMode="numeric" placeholder="קוד חדש" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} className="field" />
        <input type="password" inputMode="numeric" placeholder="אימות קוד חדש" value={newPinConfirm} onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, ''))} className="field" />
        {pinMsg && <div className="dim" style={{ marginBottom: 8 }}>{pinMsg}</div>}
        <button className="btn-primary" onClick={changePin} disabled={!currentPin || !newPin || !newPinConfirm}>
          עדכון קוד
        </button>
      </div>

      <SecurityQuestionCard />
      <BackupCard />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>הגנת "לא ניתן לסגור" (מתקדם, אופציונלי)</h3>
        <p className="dim" style={{ marginTop: 0 }}>
          התקנה חד-פעמית שדורשת הרשאות מנהל, כדי שהתוכנה תחזור לפעול תוך כדקה אם הילד סוגר אותה
          דרך Task Manager. ראו הסבר מלא ב-README בתיקייה שתיפתח.
        </p>
        <button className="btn-secondary" onClick={() => window.familyquest.openServiceFolder()}>
          📂 פתיחת תיקיית ההתקנה
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, color: 'var(--bad)' }}>יציאה מהתוכנה</h3>
        <p className="dim" style={{ marginTop: 0 }}>
          כל עוד התוכנה סגורה, אין אכיפה של זמן מסך. הפעילו מחדש מתפריט ההתחלה כשתרצו לחדש את הבקרה.
        </p>
        <button className="btn-danger" onClick={() => setConfirmQuit(true)}>
          יציאה מ-FamilyQuest PC
        </button>
      </div>

      {confirmQuit && (
        <ConfirmDialog
          title="יציאה מהתוכנה?"
          message="הבקרה על זמן המסך תיפסק עד שתפעילו את התוכנה מחדש."
          danger
          confirmLabel="יציאה"
          onCancel={() => setConfirmQuit(false)}
          onConfirm={() => window.familyquest.quitApp()}
        />
      )}
    </div>
  );
}
