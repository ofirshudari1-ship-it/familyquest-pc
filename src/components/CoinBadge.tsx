export default function CoinBadge({ amount, size = 'md' }: { amount: number; size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'lg' ? 28 : size === 'sm' ? 14 : 18;
  const padding = size === 'lg' ? '10px 20px' : size === 'sm' ? '4px 10px' : '6px 14px';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'linear-gradient(180deg, #ffe08a, #ffc93c)',
        color: '#5c3d00',
        fontWeight: 800,
        borderRadius: 999,
        padding,
        fontSize,
        boxShadow: '0 3px 8px rgba(0,0,0,0.2)'
      }}
    >
      🪙 {amount}
    </span>
  );
}
