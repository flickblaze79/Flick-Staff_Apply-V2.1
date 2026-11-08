import { StaffApplication } from '../types';

/**
 * Deduplicates a list of staff applications by applicantUid, retaining only the latest submission timestamp record.
 * Uses a JavaScript Map keyed by applicantUid for $O(N)$ performance and absolute uniqueness.
 */
export function deduplicateApplications(apps: StaffApplication[]): StaffApplication[] {
  if (!Array.isArray(apps) || apps.length === 0) return [];

  const appMap = new Map<string, StaffApplication>();

  for (const app of apps) {
    if (!app || !app.applicantUid) {
      // If an application lacks an applicantUid, fall back to its id to prevent dropping it
      if (app && app.id) {
        appMap.set(app.id, app);
      }
      continue;
    }

    const existing = appMap.get(app.applicantUid);
    if (!existing) {
      appMap.set(app.applicantUid, app);
    } else {
      // Compare timestamps and keep the latest one
      const existingTime = new Date(existing.createdAt || 0).getTime();
      const currentTime = new Date(app.createdAt || 0).getTime();

      if (currentTime >= existingTime) {
        appMap.set(app.applicantUid, app);
      }
    }
  }

  // Convert map values back to an array and sort by createdAt descending
  const uniqueApps = Array.from(appMap.values());
  uniqueApps.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return uniqueApps;
}
