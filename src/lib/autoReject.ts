import { checkAndProcessAutoRejectionsLocal } from './storage';

export const AUTO_REJECT_MS = 48 * 60 * 60 * 1000; // 48 Hours

let lastCheckTimestamp = 0;
const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks pending/under-review applications and automatically rejects those older than 48 hours.
 * Throttled to run at most once every 5 minutes.
 * Returns the count of processed auto-rejections.
 */
export async function checkAndProcessAutoRejections(): Promise<number> {
  const now = Date.now();
  if (now - lastCheckTimestamp < THROTTLE_MS) {
    return 0;
  }
  lastCheckTimestamp = now;
  try {
    return checkAndProcessAutoRejectionsLocal();
  } catch (err) {
    console.warn('Auto-rejection check error:', err);
    return 0;
  }
}

