import { useEffect, useState } from 'react';
import type { BadgeProgress } from '../types';

export default function TrophyRoom({ childId }: { childId: string }) {
  const [badges, setBadges] = useState<BadgeProgress[]>([]);

  useEffect(() => {
    window.familyquest.getBadgeProgress(childId).then(setBadges);
  }, [childId]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>🏆 חדר גביעים</h2>
        <span style={{ fontSize: 14, opacity: 0.85 }}>
          {unlockedCount}/{badges.length} גביעים
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
        {badges.map((b) => (
          <div
            key={b.id}
            className={b.unlocked ? 'fq-trophy-shine' : ''}
            style={{
              borderRadius: 14,
              padding: '16px 10px',
              textAlign: 'center',
              background: b.unlocked ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${b.unlocked ? 'rgba(255,209,102,0.5)' : 'rgba(255,255,255,0.12)'}`,
              opacity: b.unlocked ? 1 : 0.65
            }}
          >
            <div style={{ fontSize: 34, filter: b.unlocked ? 'none' : 'grayscale(1)' }}>{b.unlocked ? b.emoji : '🔒'}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{b.title}</div>
            {!b.unlocked && (
              <>
                <div
                  style={{
                    marginTop: 8,
                    height: 6,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.15)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((b.current / b.target) * 100))}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #ffd166, #ff9770)'
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                  {b.current}/{b.target}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
