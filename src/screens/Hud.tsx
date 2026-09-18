import { useEffect, useRef, useState } from 'react';
import type { LockState } from '../types';

function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Hud() {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [warn, setWarn] = useState<1 | 5 | null>(null);
  const lastSyncRef = useRef<{ ms: number; at: number } | null>(null);

  useEffect(() => {
    const applyState = (state: LockState) => {
      if (state.status === 'unlocked') {
        lastSyncRef.current = { ms: state.remainingMs, at: Date.now() };
        setRemainingMs(state.remainingMs);
      } else {
        lastSyncRef.current = null;
        setRemainingMs(null);
      }
    };

    window.familyquest.getLockState().then(applyState);
    const offState = window.familyquest.onLockState(applyState);
    const offWarn = window.familyquest.onWarning(({ minutesLeft }) => {
      setWarn(minutesLeft as 1 | 5);
      setTimeout(() => setWarn(null), 8000);
    });

    const ticker = setInterval(() => {
      if (!lastSyncRef.current) return;
      const elapsed = Date.now() - lastSyncRef.current.at;
      setRemainingMs(Math.max(0, lastSyncRef.current.ms - elapsed));
    }, 1000);

    return () => {
      offState();
      offWarn();
      clearInterval(ticker);
    };
  }, []);

  if (remainingMs === null) return null;

  const urgent = remainingMs <= 60000;

  return (
    <div
      style={
        {
          WebkitAppRegion: 'drag',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 10
        } as any
      }
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 16,
          background: urgent ? 'rgba(214,69,69,0.92)' : 'rgba(26,29,58,0.88)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Segoe UI, sans-serif',
          boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
          transition: 'background 0.4s',
          animation: warn ? 'pulse 1s ease-in-out infinite' : undefined
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>זמן מסך נותר</div>
        <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {formatRemaining(remainingMs)}
        </div>
        <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.6 } }`}</style>
      </div>
    </div>
  );
}
