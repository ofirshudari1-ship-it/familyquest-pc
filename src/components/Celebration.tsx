import { useEffect, useRef } from 'react';
import type { CelebrationEvent } from '../types';
import { useModalA11y } from '../hooks/useModalA11y';

const COLORS = ['#ffd166', '#ff6b6b', '#06d6a0', '#4dabf7', '#c77dff', '#ffe08a'];

function ConfettiCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const count = 90;
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight * 0.5,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 2 + Math.random() * 3,
      vx: -1.5 + Math.random() * 3,
      rot: Math.random() * 360,
      vr: -6 + Math.random() * 12,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));

    let raf: number;
    let elapsed = 0;
    const start = performance.now();

    function frame(now: number) {
      elapsed = now - start;
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rot * Math.PI) / 180);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = elapsed > 3200 ? Math.max(0, 1 - (elapsed - 3200) / 500) : 1;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }
      if (elapsed < 3700) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 998 }} />;
}

export default function Celebration({ event, onDone }: { event: CelebrationEvent; onDone: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(onDone);

  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [event, onDone]);

  let icon: string;
  let title: string;
  let sub: string;
  switch (event.type) {
    case 'level_up':
      icon = '⭐';
      title = `עלית לרמה ${event.payload.level}!`;
      sub = event.payload.title;
      break;
    case 'streak_milestone':
      icon = '🔥';
      title = `רצף של ${event.payload.days} ימים!`;
      sub = `בונוס של ${event.payload.bonus} מטבעות 🪙`;
      break;
    case 'coop_complete':
      icon = '🤝';
      title = `שיתוף הפעולה הצליח! ${event.payload.title}`;
      sub = event.payload.bonusCoins > 0 ? `בונוס של ${event.payload.bonusCoins} מטבעות לכל אחד 🪙` : 'כל הכבוד לצוות! 🎉';
      break;
    default:
      icon = '🎯';
      title = `היעד המשפחתי הושג! ${event.payload.title}`;
      sub = event.payload.rewardText || 'כל הכבוד לכל המשפחה! 🎉';
  }

  return (
    <>
      <ConfettiCanvas />
      <div
        onClick={onDone}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          aria-live="polite"
          tabIndex={-1}
          style={{
            background: 'linear-gradient(180deg, rgba(72,52,163,0.96), rgba(43,45,99,0.96))',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 20,
            padding: '30px 44px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            animation: 'fq-pop 0.4s ease'
          }}
        >
          <div style={{ fontSize: 46 }}>{icon}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 6 }}>{title}</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{sub}</div>
        </div>
      </div>
    </>
  );
}
