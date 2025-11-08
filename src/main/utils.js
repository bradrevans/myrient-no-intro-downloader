
/**
 * Formats a number of bytes into a human-readable string (e.g., "1.2 GB", "500 MB").
 * @param {number} bytes The number of bytes to format.
 * @param {number} decimals The number of decimal places to include.
 * @returns {string} The human-readable string.
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Calculates the estimated time remaining (ETA) for a task.
 * @param {number} current The current progress of the task.
 * @param {number} total The total amount of work for the task.
 * @param {number} startTime The timestamp (e.g., performance.now()) when the task started.
 * @returns {string} The estimated time remaining in a human-readable format (e.g., "2m 30s", "1h 15m").
 */
export function calculateEta(current, total, startTime) {
  if (current === 0 || total === 0 || current >= total) {
    return '--';
  }

  const now = performance.now();
  const elapsedMilliseconds = now - startTime;
  const progressRatio = current / total;

  if (progressRatio === 0) {
    return '--';
  }

  const estimatedTotalMilliseconds = elapsedMilliseconds / progressRatio;
  const remainingMilliseconds = estimatedTotalMilliseconds - elapsedMilliseconds;

  const seconds = Math.floor(remainingMilliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes % 60 > 0) {
    parts.push(`${minutes % 60}m`);
  }
  if (seconds % 60 > 0 || parts.length === 0) {
    parts.push(`${seconds % 60}s`);
  }

  return parts.join(' ');
}
