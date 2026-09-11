export const colors = {
  background: '#0b0f10',
  card: '#111617',
  border: '#1c2326',
  text: '#ffffff',
  muted: '#6b7280',
  primary: '#00d4a4',
  primaryFg: '#0b0f10',
  destructive: '#ef4444',
  amber: '#fbbf24',
  amberBg: 'rgba(245, 158, 11, 0.12)',
  amberBorder: 'rgba(245, 158, 11, 0.3)',
  blue: '#60a5fa',
  red: '#f87171',
  secondary: '#1c2326',
} as const;

export const poolAccent = {
  routine: { text: '#34d399', tileBg: 'rgba(16,185,129,0.1)', tileBorder: 'rgba(16,185,129,0.5)' },
  open: { text: '#38bdf8', tileBg: 'rgba(14,165,233,0.1)', tileBorder: 'rgba(14,165,233,0.5)' },
  ingoing: { text: '#fb923c', tileBg: 'rgba(249,115,22,0.1)', tileBorder: 'rgba(249,115,22,0.5)' },
  outgoing: { text: '#fdba74', tileBg: 'rgba(251,146,60,0.1)', tileBorder: 'rgba(251,146,60,0.5)' },
  tribunal: { text: '#fb7185', tileBg: 'rgba(244,63,94,0.1)', tileBorder: 'rgba(244,63,94,0.5)' },
} as const;

export const typeAccent = {
  routine: { text: '#34d399', bar: '#34d399', badgeBg: '#10b981', tileBg: 'rgba(16,185,129,0.1)', tileBorder: 'rgba(16,185,129,0.5)' },
  open: { text: '#38bdf8', bar: '#38bdf8', badgeBg: '#0ea5e9', tileBg: 'rgba(14,165,233,0.1)', tileBorder: 'rgba(14,165,233,0.5)' },
  ingoing: { text: '#38bdf8', bar: '#38bdf8', badgeBg: '#0ea5e9', tileBg: 'rgba(249,115,22,0.1)', tileBorder: 'rgba(249,115,22,0.5)', pool: '#fb923c' },
  outgoing: { text: '#a78bfa', bar: '#a78bfa', badgeBg: '#8b5cf6', tileBg: 'rgba(251,146,60,0.1)', tileBorder: 'rgba(251,146,60,0.5)', pool: '#fdba74' },
  tribunal: { text: '#fb7185', bar: '#fb7185', badgeBg: '#f43f5e', tileBg: 'rgba(244,63,94,0.1)', tileBorder: 'rgba(244,63,94,0.5)' },
} as const;
