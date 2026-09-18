export const AVATAR_OPTIONS: { id: string; emoji: string }[] = [
  { id: 'fox', emoji: '🦊' },
  { id: 'cat', emoji: '🐱' },
  { id: 'dragon', emoji: '🐉' },
  { id: 'astronaut', emoji: '🧑‍🚀' },
  { id: 'robot', emoji: '🤖' },
  { id: 'unicorn', emoji: '🦄' },
  { id: 'dino', emoji: '🦖' },
  { id: 'ninja', emoji: '🥷' }
];

const COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4dabf7', '#c77dff', '#ff9770', '#70e0c9', '#b8b8ff'];

function colorFor(avatarId: string) {
  const idx = AVATAR_OPTIONS.findIndex((a) => a.id === avatarId);
  return COLORS[idx >= 0 ? idx % COLORS.length : 0];
}

export default function Avatar({ avatarId, size = 64 }: { avatarId: string; size?: number }) {
  const emoji = AVATAR_OPTIONS.find((a) => a.id === avatarId)?.emoji || '🙂';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colorFor(avatarId),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.55,
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        flexShrink: 0
      }}
    >
      {emoji}
    </div>
  );
}
