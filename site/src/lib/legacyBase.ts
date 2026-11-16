/**
 * The site used to live at /home/ (when the repository was called "home"). Old links (Facebook
 * posts, printed QR codes, emails) still point there; this maps them to the current address.
 */
export const LEGACY_BASE = '/home';

/** The new URL for an old /home/... address, or null when no redirect is needed. */
export function legacyRedirect(pathname: string, base: string, legacy = LEGACY_BASE): string | null {
  const b = base.replace(/\/+$/, '');
  if (b === legacy) return null;
  if (pathname !== legacy && !pathname.startsWith(`${legacy}/`)) return null;
  const rest = pathname.slice(legacy.length) || '/';
  return `${b}${rest}`;
}
