export const COMPANION_OPTIONS: { id: string; emoji: string; name: string }[] = [
  { id: 'dragon', emoji: '🐉', name: 'דרקון' },
  { id: 'unicorn', emoji: '🦄', name: 'חד-קרן' },
  { id: 'fox', emoji: '🦊', name: 'גור שועל' },
  { id: 'robot', emoji: '🤖', name: 'רובוט' },
  { id: 'phoenix', emoji: '🐦‍🔥', name: 'פניקס' },
  { id: 'turtle', emoji: '🐢', name: 'צב' },
  { id: 'penguin', emoji: '🐧', name: 'פינגווין' },
  { id: 'dino', emoji: '🦖', name: 'דינו' }
];

// Growth stage comes entirely from the child's existing level — no new
// persistence, the companion is just a fun lens on data that already exists.
function stageFor(level: number): { label: string; scale: number; glow: boolean } {
  if (level >= 10) return { label: 'אגדי', scale: 1.25, glow: true };
  if (level >= 5) return { label: 'גדל יפה', scale: 1.1, glow: false };
  if (level >= 3) return { label: 'גור צעיר', scale: 1, glow: false };
  return { label: 'בקליפה', scale: 0.85, glow: false };
}

// Mood comes from the existing streak — always framed positively, never guilt.
function moodFor(streak: number): { emoji: string; label: string } {
  if (streak >= 7) return { emoji: '🎉', label: 'בהתלהבות!' };
  if (streak >= 1) return { emoji: '😊', label: 'מרוצה' };
  return { emoji: '😌', label: 'רגוע/ה, מחכה למשימה הבאה' };
}

export default function Companion({
  companionId,
  level,
  streak,
  size = 96,
  compact = false
}: {
  companionId: string;
  level: number;
  streak: number;
  size?: number;
  compact?: boolean;
}) {
  const companion = COMPANION_OPTIONS.find((c) => c.id === companionId) || COMPANION_OPTIONS[0];
  const stage = stageFor(level);
  const mood = moodFor(streak);
  const finalSize = size * stage.scale;

  return (
    <div style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: 'center', gap: compact ? 8 : 4 }}>
      <div
        className="fq-companion-bob"
        style={{
          width: finalSize,
          height: finalSize,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: finalSize * 0.55,
          flexShrink: 0,
          background: 'rgba(255,255,255,0.1)',
          boxShadow: stage.glow
            ? '0 0 0 3px rgba(255,209,102,0.6), 0 0 24px rgba(255,209,102,0.55)'
            : '0 4px 14px rgba(0,0,0,0.25)'
        }}
      >
        {companion.emoji}
      </div>
      {!compact && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{companion.name} · {stage.label}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {mood.emoji} {mood.label}
          </div>
        </div>
      )}
      {compact && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {companion.name} · {stage.label} {mood.emoji}
        </div>
      )}
    </div>
  );
}
