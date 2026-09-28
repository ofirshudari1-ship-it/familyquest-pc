/**
 * Locally generated (hand-authored SVG, no external/AI image service) onboarding
 * illustration. Colors are pulled from the app's real brand tokens defined in
 * src/styles/global.css (--primary #4834a3, --accent #ffd166, --accent-2 #ff6b6b,
 * --good #06d6a0, --bg-1 #2b2d63) so it matches the rest of the parent dashboard
 * theme exactly instead of introducing new colors.
 */
export default function OnboardingHero({ size = 168 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="הורה וילד חוגגים משימה שהושלמה עם מטבעות וגביע"
      style={{ display: 'block', margin: '0 auto 8px' }}
    >
      <defs>
        <radialGradient id="ob-bg" cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#efeaff" />
          <stop offset="100%" stopColor="#e3dcff" />
        </radialGradient>
        <radialGradient id="ob-coin" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="60%" stopColor="#ffd166" />
          <stop offset="100%" stopColor="#e8a83a" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r="96" fill="url(#ob-bg)" />

      {/* trophy */}
      <g transform="translate(100,70)">
        <path d="M-18 0 H18 V10 C18 26 10 34 0 35 C-10 34 -18 26 -18 10 Z" fill="url(#ob-coin)" />
        <rect x="-24" y="-4" width="10" height="10" rx="4" fill="#e8a83a" />
        <rect x="14" y="-4" width="10" height="10" rx="4" fill="#e8a83a" />
        <rect x="-6" y="35" width="12" height="9" fill="#c98a2c" />
        <rect x="-12" y="44" width="24" height="7" rx="3" fill="#8a5a00" />
      </g>

      {/* parent (left) */}
      <g transform="translate(62,148)">
        <path d="M-20 10 C-20 -10 20 -10 20 10 L17 40 C8 48 -8 48 -17 40 Z" fill="#4834a3" />
        <circle cx="0" cy="-16" r="18" fill="#ffd8b3" />
        <path d="M-18 -18 C-18 -36 18 -36 18 -18 C10 -25 -10 -25 -18 -18 Z" fill="#2b2333" />
      </g>

      {/* child (right, arms up) */}
      <g transform="translate(140,150)">
        <path d="M-16 8 C-16 -8 16 -8 16 8 L14 34 C6 40 -6 40 -14 34 Z" fill="#ff6b6b" />
        <path d="M-15 8 C-26 -2 -30 -14 -25 -24" stroke="#ff6b6b" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M15 8 C26 -2 30 -14 25 -24" stroke="#ff6b6b" strokeWidth="9" fill="none" strokeLinecap="round" />
        <circle cx="-26" cy="-27" r="6" fill="url(#ob-coin)" />
        <circle cx="26" cy="-27" r="6" fill="url(#ob-coin)" />
        <circle cx="0" cy="-14" r="15" fill="#ffd8b3" />
        <path d="M-15 -16 C-15 -30 15 -30 15 -16 C8 -21 -8 -21 -15 -16 Z" fill="#4a2e12" />
      </g>

      {/* sparkles */}
      <g fill="#06d6a0">
        <circle cx="45" cy="55" r="3" />
        <circle cx="158" cy="60" r="2.4" />
        <circle cx="168" cy="120" r="2.6" />
      </g>
    </svg>
  );
}
