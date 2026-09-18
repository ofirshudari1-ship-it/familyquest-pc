import { useEffect, useState, type CSSProperties } from 'react';
import type { SecurityQuestion } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  marginBottom: 14,
  fontSize: 15,
  textAlign: 'center'
};

const primaryBtn: CSSProperties = {
  width: '100%',
  padding: '10px 0',
  borderRadius: 10,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 16
};

export default function PinRecovery({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<SecurityQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');

  useEffect(() => {
    window.familyquest.getSecurityQuestion().then((q) => {
      setQuestion(q);
      setLoading(false);
    });
  }, []);

  const verify = async () => {
    setError('');
    const ok = await window.familyquest.verifySecurityAnswer(answer);
    if (ok) setVerified(true);
    else setError('התשובה שגויה');
  };

  const resetPin = async () => {
    setError('');
    if (newPin.length < 4) return setError('הקוד חייב 4 ספרות לפחות');
    if (newPin !== newPinConfirm) return setError('הקודים לא תואמים');
    await window.familyquest.resetPinViaRecovery(answer, newPin);
    onDone();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="theme-parent" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', width: 300 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
        <h2 style={{ margin: '0 0 4px' }}>שחזור קוד PIN</h2>

        {!question ? (
          <>
            <p style={{ color: 'var(--text-dim)' }}>
              בהתקנה הזו לא הוגדרה שאלת אבטחה — אין דרך לשחזר את הקוד ללא שרת חיצוני. אם המידע חשוב, ניתן
              לשחזר אותו מקובץ גיבוי (אם קיים) דרך תיקיית הנתונים.
            </p>
          </>
        ) : !verified ? (
          <>
            <p style={{ color: 'var(--text-dim)' }}>{question.text}</p>
            <input
              autoFocus
              value={answer}
              onChange={(e) => {
                setError('');
                setAnswer(e.target.value);
              }}
              onKeyDown={(e) => e.key === 'Enter' && answer && verify()}
              style={inputStyle}
              placeholder="התשובה שלכם"
            />
            {error && <div style={{ color: 'var(--bad)', marginBottom: 10 }}>{error}</div>}
            <button style={primaryBtn} disabled={!answer} onClick={verify}>
              אימות
            </button>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--good)' }}>התשובה אומתה ✓ — הגדירו קוד חדש</p>
            <input
              type="password"
              inputMode="numeric"
              placeholder="קוד PIN חדש"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              style={inputStyle}
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="אימות קוד חדש"
              value={newPinConfirm}
              onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, ''))}
              style={inputStyle}
            />
            {error && <div style={{ color: 'var(--bad)', marginBottom: 10 }}>{error}</div>}
            <button style={primaryBtn} disabled={!newPin || !newPinConfirm} onClick={resetPin}>
              עדכון קוד
            </button>
          </>
        )}

        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', marginTop: 14, fontSize: 13 }}
        >
          חזרה לכניסה עם קוד
        </button>
      </div>
    </div>
  );
}
