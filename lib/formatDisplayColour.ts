/**
 * Title-cases each alphabetic run for human-facing colour labels
 * (e.g. `camel` → `Camel`, `NAVY & black` → `Navy & Black`). Digits and
 * punctuation are left as-is.
 */
export function formatDisplayColour(s: string): string {
  return s.replace(/[A-Za-z][A-Za-z]*/g, (m) => {
    if (m.length === 0) return m;
    return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  });
}
