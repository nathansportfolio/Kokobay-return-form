/** Human-friendly duration for pick walk times. */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) {
    return "—";
  }
  if (ms < 1000) {
    return "<1s";
  }
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const remS = s % 60;
  const remM = m % 60;
  if (h > 0) {
    return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
  }
  if (m > 0) {
    return remS > 0 ? `${m}m ${remS}s` : `${m}m`;
  }
  return `${remS}s`;
}
