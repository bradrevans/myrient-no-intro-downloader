/**
 * Formats a given number of seconds into a human-readable time string (e.g., "1h 2m 3s").
 * @param {number} seconds The number of seconds to format.
 * @returns {string} The human-readable time string.
 */
export function formatTime(seconds) {
  if (seconds < 0) seconds = 0;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (h > 0) {
    parts.push(`${h}h`);
  }
  if (m > 0) {
    parts.push(`${m}m`);
  }
  if (s > 0 || parts.length === 0) {
    parts.push(`${s}s`);
  }

  return parts.join(' ');
}