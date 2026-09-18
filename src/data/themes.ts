import type { CSSProperties } from 'react';

export interface ThemePreset {
  id: string;
  label: string;
  bg1: string;
  bg2: string;
  accent: string;
  accent2: string;
}

// 'purple' matches the exact hardcoded values .theme-kid already used before
// per-child themes existed (see src/styles/global.css) — existing children
// look identical until a parent picks something new.
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'purple', label: 'סגול קלאסי', bg1: '#2b2d63', bg2: '#4834a3', accent: '#ffd166', accent2: '#ff6b6b' },
  { id: 'ocean', label: 'אוקיינוס', bg1: '#0a3d62', bg2: '#1e6091', accent: '#38e0d0', accent2: '#ffd166' },
  { id: 'forest', label: 'יער', bg1: '#1b3a2b', bg2: '#2f6b4f', accent: '#a8e063', accent2: '#ffd166' },
  { id: 'sunset', label: 'שקיעה', bg1: '#4a1942', bg2: '#a3306b', accent: '#ffb347', accent2: '#ff6b9d' },
  { id: 'candy', label: 'ממתק', bg1: '#5b2a86', bg2: '#c060d6', accent: '#ffe08a', accent2: '#ff9ecf' },
  { id: 'midnight', label: 'חצות', bg1: '#0d1321', bg2: '#1d2b53', accent: '#7de1ff', accent2: '#b8b8ff' }
];

export function themeVars(themeColor: string | undefined): CSSProperties {
  const preset = THEME_PRESETS.find((t) => t.id === themeColor) || THEME_PRESETS[0];
  return {
    '--bg-1': preset.bg1,
    '--bg-2': preset.bg2,
    '--accent': preset.accent,
    '--accent-2': preset.accent2
  } as CSSProperties;
}
