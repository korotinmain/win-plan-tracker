/**
 * Extracts a human-readable message from an unknown caught error.
 * Use in all catch blocks instead of casting `e: any`.
 *
 * @example
 * } catch (e: unknown) {
 *   this.error.set(getErrorMessage(e, 'Login failed. Please try again.'));
 * }
 */
export function getErrorMessage(
  e: unknown,
  fallback = 'Something went wrong',
): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string' && e.length > 0) return e;
  return fallback;
}
