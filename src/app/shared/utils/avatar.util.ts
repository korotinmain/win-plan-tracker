/** Deterministic colour palette used for avatar badges. */
export const AVATAR_COLOR_PALETTE: readonly string[] = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#ef4444',
] as const;

/** Deterministic gradient pairs for avatar backgrounds. */
const AVATAR_GRADIENTS: readonly [string, string][] = [
  ['#6366f1', '#8b5cf6'],
  ['#0ea5e9', '#6366f1'],
  ['#14b8a6', '#0ea5e9'],
  ['#f59e0b', '#ef4444'],
  ['#ec4899', '#8b5cf6'],
] as const;

/** Returns a stable colour string for a given uid. */
export function getAvatarColor(uid: string): string {
  const hash = hashString(uid);
  return AVATAR_COLOR_PALETTE[hash % AVATAR_COLOR_PALETTE.length];
}

/** Returns a stable CSS `linear-gradient` string for a given uid. */
export function getAvatarGradient(uid: string): string {
  const hash = hashString(uid);
  const [c1, c2] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}

function hashString(s: string): number {
  return s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}
