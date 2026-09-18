import { useEffect, useState, type CSSProperties } from 'react';
import type { SecurityQuestion } from '../types';
import Avatar, { AVATAR_OPTIONS } from '../components/Avatar';

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [questionId, setQuestionId] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    window.familyquest.getSecurityQuestions().then((qs) => {
      setQuestions(qs);
      if (qs[0]) setQuestionId(qs[0].id);
    });
  }, []);

  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(AVATAR_OPTIONS[0].id);
  const [dailyLimit, setDailyLimit] = useState(120);
  const [bedtimeStart, setBedtimeStart] = useState('20:30');
  const [bedtimeEnd, setBedtimeEnd] = useState('07:00');
  const [saving, setSaving] = useState(false);

  const confirmPin = () => {
    if (pin.length < 4) return setPinError('לפחות 4 ספרות');
    if (pin !== pinConfirm) return setPinError('הקודים לא תואמים');
    if (!questionId) return setPinError('בחרו שאלת אבטחה');
    if (answer.trim().length < 2) return setPinError('תשובה קצרה מדי');
    setPinError('');
    setStep(2);
  };

  const finish = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await window.familyquest.setPin(pin);
    await window.familyquest.setSecurityQuestion(questionId, answer);
    await window.familyquest.addChild({
      name: name.trim(),
      avatarId,
      dailyTimeLimitMins: dailyLimit,
      bedtimeStart,
      bedtimeEnd
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="theme-parent" style={{ height: '100%', overflowY: 'auto', padding: '40px 24px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center' }}>ברוכים הבאים ל-FamilyQuest PC 🎉</h1>

        {step === 1 && (
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, border: '1px solid var(--border)' }}>
            <h3>שלב 1: קוד PIN להורה</h3>
            <p style={{ color: 'var(--text-dim)' }}>
              קוד זה יגן על דשבורד ההורים ועל האפשרות לצאת מהתוכנה, כך שהילדים לא יוכלו לשנות הגדרות.
            </p>
            <input
              type="password"
              inputMode="numeric"
              placeholder="קוד PIN (4+ ספרות)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              style={inputStyle}
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="אימות קוד PIN"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              style={inputStyle}
            />
            <label style={labelStyle}>שאלת אבטחה — למקרה ששוכחים את הקוד (ללא צורך באימייל)</label>
            <select value={questionId} onChange={(e) => setQuestionId(e.target.value)} style={inputStyle}>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.text}
                </option>
              ))}
            </select>
            <input
              placeholder="התשובה שלכם"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              style={inputStyle}
            />
            <p style={{ color: 'var(--text-dim)', fontSize: 12.5, marginTop: -6 }}>
              בחרו תשובה שהילד/ה לא בהכרח יודע/ת — זו הדרך היחידה לשחזר גישה, בלי שרת חיצוני.
            </p>
            {pinError && <div style={{ color: 'var(--bad)', marginBottom: 10 }}>{pinError}</div>}
            <button style={primaryBtn} onClick={confirmPin} disabled={!pin || !pinConfirm}>
              המשך
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, border: '1px solid var(--border)' }}>
            <h3>שלב 2: הוספת ילד ראשון</h3>
            <input
              placeholder="שם הילד/ה"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
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
                  <Avatar avatarId={a.id} size={48} />
                </button>
              ))}
            </div>
            <label style={labelStyle}>מגבלת זמן מסך יומית (דקות)</label>
            <input
              type="number"
              min={0}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>שעת שינה מ-</label>
                <input type="time" value={bedtimeStart} onChange={(e) => setBedtimeStart(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>עד</label>
                <input type="time" value={bedtimeEnd} onChange={(e) => setBedtimeEnd(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <button style={primaryBtn} onClick={finish} disabled={!name.trim() || saving}>
              {saving ? 'שומר...' : 'סיום ⚡'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  marginBottom: 14,
  fontSize: 15
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--text-dim)',
  marginBottom: 4
};

const primaryBtn: CSSProperties = {
  width: '100%',
  padding: '12px 0',
  borderRadius: 10,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 16
};
