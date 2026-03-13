/**
 * Returns up to 2-letter uppercase initials for a display name.
 * Always returns at least '?' so the avatar never shows empty.
 */
export function getInitials(name: string): string {
  return (
    (name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?'
  );
}
