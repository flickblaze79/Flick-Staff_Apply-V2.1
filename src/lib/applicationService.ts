import { StaffApplication, ApplicationStatus, UserRole, ApplicationCooldown } from '../types';
import {
  getApplications as storageGetApplications,
  fetchApplicationsFromFirestore as storageFetchApplications,
  subscribeToApplications as storageSubscribeToApplications,
  updateApplication as storageUpdateApplication,
  updateApplicationStatus as storageUpdateApplicationStatus,
  addApplication as storageAddApplication,
  addNotification,
  getApplicationCooldown,
  setApplicationCooldown,
} from './storage';
import { logAuditEvent } from './auditLogger';

/**
 * Centralized Application Management Service
 * Provides standardized operations for querying, updating, reviewing, and tracking applications.
 */

export async function getApplications(): Promise<StaffApplication[]> {
  return await storageFetchApplications();
}

export function getApplicationsLocal(): StaffApplication[] {
  return storageGetApplications();
}

export async function getApplicationById(id: string): Promise<StaffApplication | null> {
  const apps = await getApplications();
  return apps.find((a) => a.id === id) || null;
}

export async function markApplicationSeen(
  id: string,
  reviewerUid: string
): Promise<StaffApplication | null> {
  if (!id || !reviewerUid) return null;

  const currentApp = await getApplicationById(id);
  if (!currentApp) return null;

  const currentList: string[] = Array.isArray(currentApp.seenBy)
    ? [...currentApp.seenBy]
    : currentApp.seenBy && typeof currentApp.seenBy === 'object'
    ? Object.keys(currentApp.seenBy)
    : [];

  if (!currentList.includes(reviewerUid)) {
    currentList.push(reviewerUid);
  }

  const currentCounts = { ...(currentApp.viewCounts || {}) };
  currentCounts[reviewerUid] = (currentCounts[reviewerUid] || 0) + 1;

  return await storageUpdateApplication(id, {
    seenBy: currentList,
    viewCounts: currentCounts,
  });
}

export async function acceptApplication(
  id: string,
  reviewer: { uid: string; name: string; role: UserRole },
  notes?: string
): Promise<StaffApplication | null> {
  const updatedApp = await storageUpdateApplicationStatus(id, 'Accepted', reviewer, notes);

  if (updatedApp) {
    try {
      // Set 48-hour cooldown
      const now = new Date();
      const cooldownUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      await setApplicationCooldown(updatedApp.applicantUid, {
        cooldownUntil: cooldownUntil.toISOString(),
        lastDecision: 'Accepted',
        lastApplicationId: id,
        updatedAt: now.toISOString(),
      });

      await addNotification({
        recipientUid: updatedApp.applicantUid,
        title: 'Application Decision: Accepted',
        message: `Your application for ${updatedApp.position || updatedApp.category} has been accepted by ${reviewer.name}.`,
        type: 'application',
        read: false,
        createdAt: new Date().toISOString(),
      });

      await logAuditEvent({
        action: 'APP_DECISION_ACCEPTED',
        actorUid: reviewer.uid,
        actorName: reviewer.name,
        actorEmail: '',
        actorRole: reviewer.role,
        targetResource: 'applications',
        targetUid: id,
        metadata: { position: updatedApp.position, category: updatedApp.category, notes },
      });
    } catch (err) {
      console.warn('Notice logging acceptance notification/audit event:', err);
    }
  }

  return updatedApp;
}

export async function rejectApplication(
  id: string,
  reviewer: { uid: string; name: string; role: UserRole },
  notes?: string
): Promise<StaffApplication | null> {
  const updatedApp = await storageUpdateApplicationStatus(id, 'Rejected', reviewer, notes);

  if (updatedApp) {
    try {
      // Set 48-hour cooldown
      const now = new Date();
      const cooldownUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      await setApplicationCooldown(updatedApp.applicantUid, {
        cooldownUntil: cooldownUntil.toISOString(),
        lastDecision: 'Rejected',
        lastApplicationId: id,
        updatedAt: now.toISOString(),
      });

      await addNotification({
        recipientUid: updatedApp.applicantUid,
        title: 'Application Decision: Rejected',
        message: `Your application for ${updatedApp.position || updatedApp.category} was reviewed and rejected by ${reviewer.name}.`,
        type: 'application',
        read: false,
        createdAt: new Date().toISOString(),
      });

      await logAuditEvent({
        action: 'APP_DECISION_REJECTED',
        actorUid: reviewer.uid,
        actorName: reviewer.name,
        actorEmail: '',
        actorRole: reviewer.role,
        targetResource: 'applications',
        targetUid: id,
        metadata: { position: updatedApp.position, category: updatedApp.category, notes },
      });
    } catch (err) {
      console.warn('Notice logging rejection notification/audit event:', err);
    }
  }

  return updatedApp;
}

export async function moveApplicationToReview(
  id: string,
  reviewer: { uid: string; name: string; role: UserRole },
  notes?: string
): Promise<StaffApplication | null> {
  const updatedApp = await storageUpdateApplicationStatus(id, 'Under Review', reviewer, notes);

  if (updatedApp) {
    try {
      await logAuditEvent({
        action: 'APP_DECISION_UNDER_REVIEW',
        actorUid: reviewer.uid,
        actorName: reviewer.name,
        actorEmail: '',
        actorRole: reviewer.role,
        targetResource: 'applications',
        targetUid: id,
        metadata: { position: updatedApp.position, category: updatedApp.category, notes },
      });
    } catch (err) {
      console.warn('Notice logging review audit event:', err);
    }
  }

  return updatedApp;
}

export function subscribeToApplications(
  onUpdate: (apps: StaffApplication[]) => void
): () => void {
  return storageSubscribeToApplications(onUpdate);
}

export async function updateApplication(
  id: string,
  updates: Partial<StaffApplication>
): Promise<StaffApplication | null> {
  return await storageUpdateApplication(id, updates);
}

export async function createApplication(
  appData: Omit<StaffApplication, 'id'>
): Promise<StaffApplication> {
  return await storageAddApplication(appData);
}
