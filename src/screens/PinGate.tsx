import { useState } from 'react';

export default function PinGate({ onUnlock, onForgot }: { onUnlock: () => void; onForgot: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setChecking(true);
    const ok = await window.familyquest.verifyPin(pin);
    setChecking(false);
    if (ok) {
      onUnlock();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div
      className="theme-parent"
      style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ textAlign: 'center', width: 280 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <h2 style={{ margin: '0 0 4px' }}>דשבורד הורים</h2>
        <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>הזן קוד PIN</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setError(false);
            setPin(e.target.value.replace(/\D/g, ''));
          }}
          onKeyDown={(e) => e.key === 'Enter' && pin && submit()}
          style={{
            width: '100%',
            fontSize: 28,
            letterSpacing: 8,
            textAlign: 'center',
            padding: '10px 0',
            borderRadius: 10,
            border: `1px solid ${error ? 'var(--bad)' : 'var(--border)'}`,
            marginBottom: 14
          }}
        />
        {error && <div style={{ color: 'var(--bad)', marginBottom: 10 }}>PIN שגוי</div>}
        <button
          disabled={!pin || checking}
          onClick={submit}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 10,
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16
          }}
        >
          כניסה
        </button>
        <button
          onClick={onForgot}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', marginTop: 14, fontSize: 13 }}
        >
          שכחת קוד?
        </button>
      </div>
    </div>
  );
}
