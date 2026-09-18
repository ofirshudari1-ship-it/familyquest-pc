import type { Level } from '../types';

export default function LevelBar({ level, variant = 'dark', compact = false }: { level: Level; variant?: 'dark' | 'light'; compact?: boolean }) {
  const dark = variant === 'dark';
  const trackBg = dark ? 'rgba(255,255,255,0.12)' : 'var(--border, #e2e6f0)';
  const fillGradient = 'linear-gradient(90deg, #ffb703, #ffd166)';
  const textColor = dark ? '#fff' : 'var(--text, #1c2333)';
  const dimColor = dark ? 'rgba(255,255,255,0.65)' : 'var(--text-dim, #6b7386)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: compact ? 110 : 150 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: compact ? 12 : 13, fontWeight: 800, color: textColor }}>
          ⭐ רמה {level.level} · {level.title}
        </span>
        {!compact && (
          <span style={{ fontSize: 10.5, color: dimColor }}>
            {level.coinsToNextLevel} מטבעות לרמה הבאה
          </span>
        )}
      </div>
      <div style={{ height: 6, borderRadius: 999, background: trackBg, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.round(level.progress * 100)}%`,
            background: fillGradient,
            borderRadius: 999,
            transition: 'width 0.4s ease'
          }}
        />
      </div>
    </div>
  );
}
