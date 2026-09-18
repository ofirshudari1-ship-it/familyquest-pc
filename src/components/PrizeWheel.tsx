import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpinPrize, SpinResult } from '../types';
import { useModalA11y } from '../hooks/useModalA11y';

const SEGMENT_COLORS = ['#4834a3', '#6c5ce7', '#8a63d2', '#4dabf7', '#38a3a5', '#ffb347', '#ff6b9d', '#ffd166'];

interface Segment {
  prize: SpinPrize;
  startDeg: number;
  endDeg: number;
  midDeg: number;
  color: string;
}

function buildSegments(catalog: SpinPrize[]): Segment[] {
  const total = catalog.reduce((sum, p) => sum + p.weight, 0) || 1;
  let cursor = 0;
  return catalog.map((prize, i) => {
    const span = (prize.weight / total) * 360;
    const startDeg = cursor;
    const endDeg = cursor + span;
    cursor = endDeg;
    return { prize, startDeg, endDeg, midDeg: (startDeg + endDeg) / 2, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] };
  });
}

export default function PrizeWheel({ childId, onClose }: { childId: string; onClose: () => void }) {
  const [catalog, setCatalog] = useState<SpinPrize[]>([]);
  const [canSpin, setCanSpin] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState('');
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    window.familyquest.getWheelCatalog().then(setCatalog);
    window.familyquest.getWheelStatus(childId).then(setCanSpin);
  }, [childId]);

  const segments = useMemo(() => buildSegments(catalog), [catalog]);

  const gradient = useMemo(() => {
    if (segments.length === 0) return 'conic-gradient(#4834a3, #4834a3)';
    const stops = segments.map((s) => `${s.color} ${s.startDeg}deg ${s.endDeg}deg`);
    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  }, [segments]);

  const spin = async () => {
    if (!canSpin || spinning || segments.length === 0) return;
    setError('');
    setSpinning(true);
    try {
      const res = await window.familyquest.spinWheel(childId);
      const segment = segments.find((s) => s.prize.id === res.prizeId);
      const mid = segment ? segment.midDeg : 0;
      setRotation(5 * 360 + (360 - mid));
      setTimeout(() => {
        if (!isMounted.current) return;
        setSpinning(false);
        setResult(res);
        setCanSpin(false);
      }, 3600);
    } catch (e) {
      if (!isMounted.current) return;
      setSpinning(false);
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(20,20,30,0.55)'
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fq-wheel-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, rgba(72,52,163,0.97), rgba(43,45,99,0.97))',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 20,
          padding: '26px 30px',
          textAlign: 'center',
          color: '#fff',
          width: 320,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        <h3 id="fq-wheel-title" style={{ margin: '0 0 14px' }}>🎡 גלגל מזל יומי</h3>

        <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 18px' }}>
          <div
            style={{
              position: 'absolute',
              top: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '16px solid #ffd166',
              zIndex: 2
            }}
          />
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: gradient,
              border: '4px solid rgba(255,255,255,0.35)',
              position: 'relative',
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3.5s cubic-bezier(0.15, 0.8, 0.2, 1)' : 'none'
            }}
          >
            {segments.map((s) => {
              const rad = ((s.midDeg - 90) * Math.PI) / 180;
              const x = 50 + 36 * Math.cos(rad);
              const y = 50 + 36 * Math.sin(rad);
              return (
                <div
                  key={s.prize.id}
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: 20
                  }}
                  title={s.prize.label}
                >
                  {s.prize.emoji}
                </div>
              );
            })}
          </div>
        </div>

        {!canSpin && !result && <div style={{ opacity: 0.85, marginBottom: 12 }}>כבר סובבתם היום — נסו שוב מחר! 🌅</div>}
        {error && <div style={{ color: '#ff9d9d', marginBottom: 12 }}>{error}</div>}
        {result && (
          <div aria-live="polite" style={{ marginBottom: 14, fontSize: 15 }}>
            <span style={{ fontSize: 26 }}>{result.emoji}</span>
            <div style={{ fontWeight: 700, marginTop: 4 }}>זכית ב-{result.label}! 🎊</div>
          </div>
        )}

        {!result && (
          <button
            onClick={spin}
            disabled={!canSpin || spinning}
            className="quest-btn primary"
            style={{ width: '100%', marginBottom: 10, opacity: !canSpin || spinning ? 0.5 : 1 }}
          >
            {spinning ? 'מסתובב...' : 'סובבו את הגלגל!'}
          </button>
        )}
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}
        >
          סגירה
        </button>
      </div>
    </div>
  );
}
