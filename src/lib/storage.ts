import {
  UserProfile,
  UserRole,
  StaffApplication,
  UserReport,
  NotificationItem,
  AuditLogEntry,
  SystemSettings,
  Task,
  ApplicationStatus,
  RoleDefinition,
  CustomPanel,
  PanelFeature,
  ApplicationCooldown,
} from '../types';
import { deduplicateApplications } from './applicationUtils';
import { db, storage, handleFirestoreError, OperationType } from './firebase';
import { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc, getCountFromServer, onSnapshot } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

const STORAGE_KEYS = {
  USERS: 'flick_users_db',
  APPLICATIONS: 'flick_applications_db',
  REPORTS: 'flick_reports_db',
  NOTIFICATIONS: 'flick_notifications_db',
  AUDIT_LOGS: 'flick_audit_logs_db',
  SETTINGS: 'flick_settings_db',
  CURRENT_USER: 'flick_current_session',
  TASKS: 'flick_tasks_db',
  ROLES: 'flick_roles_db',
  CUSTOM_PANELS: 'flick_custom_panels_db',
};

export const DEFAULT_OWNER_EMAILS = ['flickblaze7@gmail.com', 'nxtawais95@gmail.com'];
export const DEFAULT_OWNER_UIDS = ['NtQwPhiWQpRRnq2klOAKnSWoQKi1'];

// Initial Seed Data
const SEED_USERS: UserProfile[] = [
  {
    uid: 'owner-uid-001',
    name: 'Flick Owner',
    email: 'flickblaze7@gmail.com',
    role: 'OWNER',
    createdAt: new Date('2025-01-01T00:00:00.000Z').toISOString(),
    isSuspended: false,
    providerId: 'google.com',
  },
  {
    uid: 'admin-uid-001',
    name: 'Executive Admin',
    email: 'admin@flick.gg',
    role: 'ADMIN',
    createdAt: new Date('2025-01-02T00:00:00.000Z').toISOString(),
    isSuspended: false,
    providerId: 'local',
  },
  {
    uid: 'mod-uid-001',
    name: 'Lead Moderator',
    email: 'mod@flick.gg',
    role: 'MOD',
    createdAt: new Date('2025-01-03T00:00:00.000Z').toISOString(),
    isSuspended: false,
    providerId: 'local',
  },
  {
    uid: 'staff-uid-001',
    name: 'Senior Staff',
    email: 'staff@flick.gg',
    role: 'STAFF',
    createdAt: new Date('2025-01-04T00:00:00.000Z').toISOString(),
    isSuspended: false,
    providerId: 'local',
  },
];

const SEED_SETTINGS: SystemSettings = {
  applicationsOpen: true,
  categoryToggles: {
    'Developer Apply': true,
    'Staff Apply': true,
    'Moderator Apply': true,
    'Helper Apply': true,
  },
  announcementText: 'FLICK Staff Applications V2 are currently OPEN with Active Firebase & Google Auth.',
  requirementsText: 'Min. Age: 14+, Active on Discord, Clean disciplinary history.',
  positions: ['Developer Apply', 'Staff Apply', 'Moderator Apply', 'Helper Apply'],
  autoRejectHours: 48,
  updatedAt: new Date().toISOString(),
  maintenanceMode: false,
  registrationLocked: false,
  publicAnnouncement: '',
};

export async function fetchGlobalStats() {
  try {
    const [
      usersCount,
      pendingApps,
      underReviewApps,
      acceptedApps,
      rejectedApps,
      openReports,
      resolvedReports
    ] = await Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(query(collection(db, 'applications'), where('status', '==', 'Pending'))),
      getCountFromServer(query(collection(db, 'applications'), where('status', '==', 'Under Review'))),
      getCountFromServer(query(collection(db, 'applications'), where('status', '==', 'Accepted'))),
      getCountFromServer(query(collection(db, 'applications'), where('status', '==', 'Rejected'))),
      getCountFromServer(query(collection(db, 'reports'), where('status', 'in', ['Open', 'Under Review', 'Reviewing']))),
      getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'Resolved')))
    ]);

    return {
      totalUsers: usersCount.data().count,
      pendingApps: pendingApps.data().count,
      underReviewApps: underReviewApps.data().count,
      acceptedApps: acceptedApps.data().count,
      rejectedApps: rejectedApps.data().count,
      openReports: openReports.data().count,
      resolvedReports: resolvedReports.data().count,
    };
  } catch (err) {
    console.warn('Notice: Global stats fetch failed, using local fallback.', err);
    
    // Fallback to local storage counting if Firestore fails/offline
    const users = getUsers();
    const apps = getApplications();
    const reports = getReports();

    return {
      totalUsers: users.length,
      pendingApps: apps.filter(a => a.status === 'Pending').length,
      underReviewApps: apps.filter(a => a.status === 'Under Review').length,
      acceptedApps: apps.filter(a => a.status === 'Accepted').length,
      rejectedApps: apps.filter(a => a.status === 'Rejected').length,
      openReports: reports.filter(r => r.status === 'Open' || r.status === 'Under Review' || r.status === 'Reviewing').length,
      resolvedReports: reports.filter(r => r.status === 'Resolved').length,
    };
  }
}

// Helper: Safe JSON Parse / Stringify
function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`Error reading localStorage key "${key}":`, e);
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Error writing localStorage key "${key}":`, e);
  }
}

// Initialize seed data if empty
export function initLocalStorage(): void {
  const existingUsers = getItem<UserProfile[] | null>(STORAGE_KEYS.USERS, null);
  if (!existingUsers || existingUsers.length === 0) {
    setItem(STORAGE_KEYS.USERS, SEED_USERS);
  }

  const existingSettings = getItem<SystemSettings | null>(STORAGE_KEYS.SETTINGS, null);
  if (!existingSettings) {
    setItem(STORAGE_KEYS.SETTINGS, SEED_SETTINGS);
  }

  const existingApps = getItem<StaffApplication[] | null>(STORAGE_KEYS.APPLICATIONS, null);
  if (!existingApps) {
    setItem(STORAGE_KEYS.APPLICATIONS, []);
  }

  const existingReports = getItem<UserReport[] | null>(STORAGE_KEYS.REPORTS, null);
  if (!existingReports) {
    setItem(STORAGE_KEYS.REPORTS, []);
  }

  const existingNotifs = getItem<NotificationItem[] | null>(STORAGE_KEYS.NOTIFICATIONS, null);
  if (!existingNotifs) {
    setItem(STORAGE_KEYS.NOTIFICATIONS, []);
  }

  const existingLogs = getItem<AuditLogEntry[] | null>(STORAGE_KEYS.AUDIT_LOGS, null);
  if (!existingLogs) {
    setItem(STORAGE_KEYS.AUDIT_LOGS, []);
  }
}

// Call initialization immediately on module load
initLocalStorage();

// --- ROLE MANAGEMENT ---
export function getRoles(): RoleDefinition[] {
  // Built-in system roles are not stored in Firestore/localStorage as definable records, but assumed.
  // Custom roles can be fetched from Firestore.
  return getItem<RoleDefinition[]>(STORAGE_KEYS.ROLES, []);
}

export function saveRoles(roles: RoleDefinition[]): void {
  setItem(STORAGE_KEYS.ROLES, roles);
}

export async function fetchRolesFromFirestore(): Promise<RoleDefinition[]> {
  try {
    const snap = await getDocs(collection(db, 'roles'));
    const roles = snap.docs.map(d => ({ ...d.data(), id: d.id } as RoleDefinition));
    saveRoles(roles);
    return roles;
  } catch (err) {
    console.warn('Firestore fetchRoles error:', err);
    return getRoles();
  }
}

export async function addCustomRole(roleData: Omit<RoleDefinition, 'id'>): Promise<RoleDefinition> {
  const roles = getRoles();
  const id = `role-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newRole: RoleDefinition = {
    ...roleData,
    id,
    isSystemRole: false,
  };
  roles.push(newRole);
  saveRoles(roles);

  try {
    await setDoc(doc(db, 'roles', id), newRole);
  } catch (err) {
    console.warn('Firestore addCustomRole notice:', err);
  }
  return newRole;
}

export async function updateCustomRole(id: string, updates: Partial<RoleDefinition>): Promise<RoleDefinition | null> {
  const roles = getRoles();
  const idx = roles.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const updated: RoleDefinition = { ...roles[idx], ...updates };
  roles[idx] = updated;
  saveRoles(roles);

  try {
    await updateDoc(doc(db, 'roles', id), updates);
  } catch (err) {
    console.warn('Firestore updateCustomRole notice:', err);
  }
  return updated;
}

export async function deleteCustomRole(id: string): Promise<void> {
  const roles = getRoles().filter((r) => r.id !== id);
  saveRoles(roles);

  try {
    await deleteDoc(doc(db, 'roles', id));
  } catch (err) {
    console.warn('Firestore deleteCustomRole notice:', err);
  }
}

export function getUsers(): UserProfile[] {
  return getItem<UserProfile[]>(STORAGE_KEYS.USERS, SEED_USERS);
}

export function saveUsers(users: UserProfile[]): void {
  setItem(STORAGE_KEYS.USERS, users);
}

export function getUserByUid(uid: string): UserProfile | null {
  const users = getUsers();
  return users.find((u) => u.uid === uid) || null;
}

export function getUserByEmail(email: string): UserProfile | null {
  const users = getUsers();
  const target = email.trim().toLowerCase();
  return users.find((u) => u.email.trim().toLowerCase() === target) || null;
}

export async function fetchUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      const completeProfile: UserProfile = {
        ...data,
        uid,
      };

      // Synchronize with local storage
      const users = getUsers();
      const existingIdx = users.findIndex((u) => u.uid === uid);
      if (existingIdx >= 0) {
        users[existingIdx] = { ...users[existingIdx], ...completeProfile };
      } else {
        users.push(completeProfile);
      }
      saveUsers(users);

      const current = getStoredSession();
      if (current && current.uid === uid) {
        saveStoredSession({ ...current, ...completeProfile });
      }

      return completeProfile;
    }
  } catch (err) {
    console.warn('Notice: Firestore user lookup warning:', err);
  }

  return getUserByUid(uid) || getStoredSession();
}

export async function saveUserProfileToFirestore(
  uid: string,
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  if (!uid) throw new Error('User UID is required to save profile.');

  // 1. Fetch current profile to ensure no data is lost
  let current: UserProfile | null = await fetchUserProfileFromFirestore(uid);
  if (!current) {
    current = getUserByUid(uid) || getStoredSession();
  }

  // 2. Filter and clean updates: prevent undefined and temporary blob: URLs
  const cleanUpdates: Record<string, any> = {};
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      if (typeof val === 'string' && val.startsWith('blob:')) {
        console.warn(`Prevented saving temporary blob URL in persistent profile field: ${key}`);
        continue;
      }
      cleanUpdates[key] = val;
    }
  }

  // Role and suspension cannot be updated through general profile save
  delete cleanUpdates.role;
  delete cleanUpdates.isSuspended;
  delete cleanUpdates.suspensionReason;
  delete cleanUpdates.suspensionDate;
  delete cleanUpdates.suspendedBy;

  cleanUpdates.updatedAt = new Date().toISOString();

  // 3. Write to Firestore and await confirmation
  const userDocRef = doc(db, 'users', uid);
  await setDoc(userDocRef, cleanUpdates, { merge: true });

  // 4. Create merged object
  const merged: UserProfile = {
    ...(current || {
      uid,
      name: updates.name || 'User',
      email: updates.email || '',
      role: 'USER',
      createdAt: new Date().toISOString(),
      isSuspended: false,
    }),
    ...cleanUpdates,
  };

  // 5. Update local storage caches
  const users = getUsers();
  const existingIdx = users.findIndex((u) => u.uid === uid);
  if (existingIdx >= 0) {
    users[existingIdx] = merged;
  } else {
    users.push(merged);
  }
  saveUsers(users);

  const currentSession = getStoredSession();
  if (currentSession && currentSession.uid === uid) {
    saveStoredSession(merged);
  }

  return merged;
}

export async function createOrUpdateUser(profile: Partial<UserProfile> & { email: string; name: string }): Promise<UserProfile> {
  const users = getUsers();
  const existingIndex = users.findIndex(
    (u) => (profile.uid && u.uid === profile.uid) || u.email.toLowerCase() === profile.email.toLowerCase()
  );

  const isOwnerEmail = DEFAULT_OWNER_EMAILS.some((e) => e.toLowerCase() === profile.email.toLowerCase());
  const isOwnerUid = DEFAULT_OWNER_UIDS.includes(profile.uid || '');

  // Check Firestore first if uid is known, to preserve existing bio, banner, photo, and role
  let existingFirestoreData: UserProfile | null = null;
  if (profile.uid) {
    try {
      const snap = await getDoc(doc(db, 'users', profile.uid));
      if (snap.exists()) {
        existingFirestoreData = snap.data() as UserProfile;
      }
    } catch (err) {
      console.warn('Notice: Firestore profile check on createOrUpdate:', err);
    }
  }

  const baseUser = existingFirestoreData || (existingIndex >= 0 ? users[existingIndex] : null) || (getStoredSession()?.uid === profile.uid ? getStoredSession() : null);

  const finalUid = profile.uid || baseUser?.uid || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const finalName = (profile.name !== undefined && profile.name.trim() !== '') ? profile.name.trim() : (baseUser?.name || 'User');
  const finalEmail = profile.email ? profile.email.trim().toLowerCase() : (baseUser?.email || '');
  const finalPhotoURL = profile.photoURL !== undefined ? profile.photoURL : (baseUser?.photoURL || '');
  const finalBannerURL = profile.bannerURL !== undefined ? profile.bannerURL : (baseUser?.bannerURL || '');
  const finalBio = profile.bio !== undefined ? profile.bio : (baseUser?.bio || '');
  const finalRole = (isOwnerEmail || isOwnerUid || DEFAULT_OWNER_UIDS.includes(finalUid)) ? 'OWNER' : (baseUser?.role || 'USER');
  const finalCreatedAt = baseUser?.createdAt || new Date().toISOString();
  const finalLastSignInAt = new Date().toISOString();
  const finalIsSuspended = baseUser?.isSuspended || false;
  const finalProviderId = profile.providerId || baseUser?.providerId || 'google.com';

  const updatedUser: UserProfile = {
    uid: finalUid,
    name: finalName,
    email: finalEmail,
    photoURL: finalPhotoURL,
    bannerURL: finalBannerURL,
    bio: finalBio,
    role: finalRole,
    createdAt: finalCreatedAt,
    lastSignInAt: finalLastSignInAt,
    isSuspended: finalIsSuspended,
    providerId: finalProviderId,
    ...(baseUser?.roleAssignedAt ? { roleAssignedAt: baseUser.roleAssignedAt } : {}),
    ...(baseUser?.roleAssignedBy ? { roleAssignedBy: baseUser.roleAssignedBy } : {}),
    ...(baseUser?.suspensionReason ? { suspensionReason: baseUser.suspensionReason } : {}),
  };

  // Update local storage
  const updatedIndex = users.findIndex((u) => u.uid === finalUid);
  if (updatedIndex >= 0) {
    users[updatedIndex] = updatedUser;
  } else {
    users.push(updatedUser);
  }
  saveUsers(users);

  // Sync to Firestore and await to ensure data integrity
  if (updatedUser.uid) {
    try {
      const docToSync: Record<string, any> = { ...updatedUser };
      // Strip temporary blob: URLs
      if (typeof docToSync.bannerURL === 'string' && docToSync.bannerURL.startsWith('blob:')) {
        delete docToSync.bannerURL;
      }
      if (typeof docToSync.photoURL === 'string' && docToSync.photoURL.startsWith('blob:')) {
        delete docToSync.photoURL;
      }

      await setDoc(doc(db, 'users', updatedUser.uid), docToSync, { merge: true });
    } catch (err) {
      console.warn('Firestore user sync failure:', err);
    }
  }

  return updatedUser;
}

export async function updateUserProfileDetails(
  uid: string,
  updates: { name?: string; bio?: string }
): Promise<UserProfile> {
  return saveUserProfileToFirestore(uid, {
    ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
    ...(updates.bio !== undefined ? { bio: updates.bio.trim() } : {}),
  });
}

export async function deleteUserProfile(uid: string): Promise<void> {
  const users = getUsers();
  const updatedUsers = users.filter((u) => u.uid !== uid);
  saveUsers(updatedUsers);

  const currentSession = getStoredSession();
  if (currentSession && currentSession.uid === uid) {
    saveStoredSession(null);
  }

  // Delete from Firestore
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (err) {
    console.warn('Firestore deleteUserProfile warning:', err);
  }
}

export async function updateUserRole(uid: string, role: UserRole, assignedBy: string): Promise<UserProfile | null> {
  const users = getUsers();
  let index = users.findIndex((u) => u.uid === uid);
  
  let targetUser: UserProfile | null = index !== -1 ? users[index] : null;

  if (!targetUser) {
    try {
      targetUser = await fetchUserProfileFromFirestore(uid);
    } catch (e) {
      console.warn('Notice: fetchUserProfileFromFirestore in updateUserRole:', e);
    }
  }

  if (!targetUser) {
    targetUser = {
      uid,
      name: 'Owner',
      email: 'flickblaze7@gmail.com',
      role,
      createdAt: new Date().toISOString(),
      isSuspended: false,
      providerId: 'google.com',
    };
  }

  const now = new Date().toISOString();
  targetUser = {
    ...targetUser,
    role,
    roleAssignedAt: now,
    roleAssignedBy: assignedBy,
  };

  if (index !== -1) {
    users[index] = targetUser;
  } else {
    users.push(targetUser);
  }
  saveUsers(users);

  // Firestore update / setDoc merge
  try {
    await setDoc(doc(db, 'users', uid), {
      role,
      roleAssignedAt: now,
      roleAssignedBy: assignedBy,
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore role update notice:', err);
  }

  return targetUser;
}

export async function setUserSuspension(uid: string, isSuspended: boolean, reason?: string, suspendedBy?: string): Promise<UserProfile | null> {
  const users = getUsers();
  const index = users.findIndex((u) => u.uid === uid);
  if (index === -1) return null;

  const now = new Date().toISOString();
  users[index] = {
    ...users[index],
    isSuspended,
    suspensionReason: isSuspended ? reason || 'Policy Violation' : '',
    suspensionDate: isSuspended ? now : '',
    suspendedBy: isSuspended ? suspendedBy || 'System' : '',
  };
  saveUsers(users);

  // Firestore update
  try {
    await updateDoc(doc(db, 'users', uid), {
      isSuspended,
      suspensionReason: users[index].suspensionReason,
      suspensionDate: users[index].suspensionDate,
      suspendedBy: users[index].suspendedBy,
    });
  } catch (err) {
    console.warn('Firestore suspension update notice:', err);
  }

  return users[index];
}

// --- APPLICATIONS MANAGEMENT ---
export function getApplications(): StaffApplication[] {
  return getItem<StaffApplication[]>(STORAGE_KEYS.APPLICATIONS, []);
}

export function saveApplications(apps: StaffApplication[]): void {
  setItem(STORAGE_KEYS.APPLICATIONS, apps);
}

export async function addApplication(appData: Omit<StaffApplication, 'id'>): Promise<StaffApplication> {
  const settings = getSystemSettings();
  if (settings.categoryToggles[appData.category] === false) {
    throw new Error(`Applications for ${appData.category} are currently closed.`);
  }

  const id = `app-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const newApp: StaffApplication = {
    ...appData,
    id,
  };

  // Build clean object for Firestore to avoid passing undefined values
  const firestoreDoc: Record<string, any> = {};
  Object.entries(newApp).forEach(([key, val]) => {
    if (val !== undefined) {
      firestoreDoc[key] = val;
    }
  });

  // Sync to Firestore FIRST and await confirmation
  try {
    await setDoc(doc(db, 'applications', id), firestoreDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `applications/${id}`);
  }

  // Update local storage only after Firestore write confirms success
  const apps = getApplications();
  const existingIndex = apps.findIndex((a) => a.id === id);
  if (existingIndex >= 0) {
    apps[existingIndex] = newApp;
  } else {
    apps.unshift(newApp);
  }
  saveApplications(apps);

  return newApp;
}

export async function updateApplication(id: string, updates: Partial<StaffApplication>): Promise<StaffApplication | null> {
  if (!id) throw new Error('Application ID is required');

  const apps = getApplications();
  const index = apps.findIndex((a) => a.id === id);
  const currentApp = index >= 0 ? apps[index] : null;
  const now = new Date().toISOString();

  const updatedApp: StaffApplication = {
    ...(currentApp || ({ id } as any)),
    ...updates,
    id,
    updatedAt: now,
  };

  // Build clean object for Firestore update
  const firestoreUpdates: Record<string, any> = {};
  Object.entries(updatedApp).forEach(([key, val]) => {
    if (val !== undefined) {
      firestoreUpdates[key] = val;
    }
  });

  // Sync to Firestore FIRST and await write confirmation
  try {
    await setDoc(doc(db, 'applications', id), firestoreUpdates, { merge: true });
  } catch (err) {
    console.error(`Firestore application update failed for ID ${id}:`, err);
    handleFirestoreError(err, OperationType.UPDATE, `applications/${id}`);
  }

  if (index >= 0) {
    apps[index] = updatedApp;
  } else {
    apps.unshift(updatedApp);
  }
  saveApplications(apps);

  return updatedApp;
}

export async function updateApplicationStatus(
  appId: string,
  newStatus: ApplicationStatus,
  reviewer: { uid: string; name: string; role: UserRole },
  reviewNotes?: string
): Promise<StaffApplication | null> {
  if (!appId) throw new Error('Application ID is required');

  // Permission check based on role
  if (reviewer.role !== 'OWNER' && reviewer.role !== 'ADMIN' && reviewer.role !== 'MOD' && reviewer.role !== 'STAFF') {
    throw new Error('Unauthorized: Insufficient permissions to review applications.');
  }

  const apps = getApplications();
  const existingApp = apps.find((a) => a.id === appId);
  const now = new Date().toISOString();

  const updates: Partial<StaffApplication> = {
    status: newStatus,
    reviewerUid: reviewer.uid,
    reviewerRole: reviewer.role,
    reviewedBy: reviewer.name || reviewer.uid,
    reviewedAt: now,
    reviewNotes: reviewNotes !== undefined ? reviewNotes : (existingApp?.reviewNotes || ''),
    decisionAt: now,
    updatedAt: now,
  };

  return await updateApplication(appId, updates);
}

export function checkAndProcessAutoRejectionsLocal(): number {
  const apps = getApplications();
  const AUTO_DELETE_MS = 24 * 60 * 60 * 1000; // 24 Hours / 1 Day
  const now = Date.now();

  const filteredApps = apps.filter((app) => {
    if (app.status === 'Pending' || app.status === 'Under Review') {
      const lastActivityTime = new Date(app.updatedAt || app.createdAt).getTime();
      if (now - lastActivityTime >= AUTO_DELETE_MS) {
        addNotification({
          recipientUid: app.applicantUid,
          title: 'Application Expired & Removed',
          message: `Your application for ${app.position} in status '${app.status}' was automatically removed after 24 hours without further action.`,
          type: 'application',
          read: false,
          createdAt: new Date().toISOString(),
        });
        return false; // delete
      }
    }
    return true;
  });

  const deletedCount = apps.length - filteredApps.length;
  if (deletedCount > 0) {
    saveApplications(filteredApps);
  }
  return deletedCount;
}

// --- REPORTS MANAGEMENT ---
export function getReports(): UserReport[] {
  return getItem<UserReport[]>(STORAGE_KEYS.REPORTS, []);
}

export function saveReports(reports: UserReport[]): void {
  setItem(STORAGE_KEYS.REPORTS, reports);
}

export async function fetchReports(): Promise<UserReport[]> {
  try {
    const fetchPromise = getDocs(collection(db, 'reports'));
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    const snap = await Promise.race([fetchPromise, timeoutPromise]);

    if (snap && 'docs' in snap) {
      const liveReports: UserReport[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserReport, 'id'>),
      }));

      // Merge with any unsynced local reports
      const local = getReports();
      const liveIds = new Set(liveReports.map((r) => r.id));
      const unsynced = local.filter((r) => r.id && !liveIds.has(r.id));
      const combined = [...liveReports, ...unsynced];

      saveReports(combined);
      return combined;
    }
  } catch (err) {
    console.warn('Firestore fetchReports error or timeout, using local cache:', err);
  }
  return getReports();
}

export async function fetchUserReports(uid: string): Promise<UserReport[]> {
  try {
    const q = query(collection(db, 'reports'), where('authorUid', '==', uid));
    const fetchPromise = getDocs(q);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    const snap = await Promise.race([fetchPromise, timeoutPromise]);

    if (snap && 'docs' in snap) {
      const userReports: UserReport[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserReport, 'id'>),
      }));

      // Update local storage for these reports
      const local = getReports();
      const otherReports = local.filter((r) => r.authorUid !== uid);
      saveReports([...userReports, ...otherReports]);
      return userReports;
    }
  } catch (err) {
    console.warn('Firestore fetchUserReports error or timeout, using local cache:', err);
  }
  return getReports().filter((r) => r.authorUid === uid);
}

export async function addReport(reportData: Omit<UserReport, 'id'>): Promise<UserReport> {
  const reports = getReports();
  const id = `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newReport: UserReport = {
    ...reportData,
    id,
    savedBy: reportData.savedBy || [],
  };
  reports.unshift(newReport);
  saveReports(reports);

  // Sync to Firestore and await to ensure data integrity
  try {
    await setDoc(doc(db, 'reports', id), newReport);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `reports/${id}`);
  }

  return newReport;
}

export async function updateReport(id: string, updates: Partial<UserReport>): Promise<UserReport | null> {
  const reports = getReports();
  const index = reports.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const updated: UserReport = {
    ...reports[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  reports[index] = updated;
  saveReports(reports);

  // Sync to Firestore and await to ensure data integrity
  try {
    await updateDoc(doc(db, 'reports', id), updated);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reports/${id}`);
  }

  return updated;
}

export async function toggleSaveReport(
  reportId: string,
  uid: string
): Promise<{ isSaved: boolean; updatedReport: UserReport | null }> {
  const reports = getReports();
  const index = reports.findIndex((r) => r.id === reportId);
  if (index === -1) {
    throw new Error('Report not found');
  }

  const report = reports[index];
  const currentSavedBy = Array.isArray(report.savedBy) ? [...report.savedBy] : [];
  const isAlreadySaved = currentSavedBy.includes(uid);
  const newSavedBy = isAlreadySaved
    ? currentSavedBy.filter((id) => id !== uid)
    : [...currentSavedBy, uid];

  const updated: UserReport = {
    ...report,
    savedBy: newSavedBy,
    updatedAt: new Date().toISOString(),
  };

  reports[index] = updated;
  saveReports(reports);

  // Sync to Firestore
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      savedBy: newSavedBy,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
  }

  return { isSaved: !isAlreadySaved, updatedReport: updated };
}

export async function deleteReport(
  reportId: string,
  actor: { uid: string; name?: string; email?: string; role?: UserRole }
): Promise<void> {
  const reports = getReports();
  const targetReport = reports.find((r) => r.id === reportId);

  // Permission check: regular USER can only delete their own report
  if (actor.role === 'USER' && targetReport && targetReport.authorUid !== actor.uid) {
    throw new Error('Unauthorized: You can only delete your own submitted reports.');
  }

  // 1. Storage cleanup for any media associated with this report
  if (targetReport) {
    const urlsToDelete = [targetReport.evidenceUrl, targetReport.videoLink].filter(Boolean) as string[];
    for (const url of urlsToDelete) {
      if (
        typeof url === 'string' &&
        (url.includes('firebasestorage.googleapis.com') || url.startsWith('gs://') || url.startsWith('reports/'))
      ) {
        try {
          const fileRef = ref(storage, url);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.warn('Storage file deletion warning (non-fatal):', storageErr);
        }
      }
    }
  }

  // 2. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'reports', reportId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `reports/${reportId}`);
    throw err;
  }

  // 3. Remove from local storage
  const remaining = reports.filter((r) => r.id !== reportId);
  saveReports(remaining);

  // 4. Log audit entry
  try {
    if (actor && actor.uid) {
      await addAuditLog({
        action: 'REPORT_DELETED',
        actorUid: actor.uid,
        actorName: actor.name || 'User',
        actorEmail: actor.email || '',
        actorRole: actor.role || 'USER',
        targetResource: 'reports',
        targetUid: reportId,
        timestamp: new Date().toISOString(),
        metadata: {
          deletedReportSubject: targetReport?.subject || 'Report',
          deletedReportAuthorUid: targetReport?.authorUid || '',
        },
      });
    }
  } catch (logErr) {
    console.warn('Audit log write warning:', logErr);
  }
}

// --- NOTIFICATIONS MANAGEMENT ---
export function getNotifications(recipientUid?: string): NotificationItem[] {
  const allNotifs = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  if (!recipientUid) return allNotifs;
  return allNotifs.filter((n) => n.recipientUid === recipientUid);
}

export async function addNotification(notifData: Omit<NotificationItem, 'id'>): Promise<NotificationItem> {
  const notifs = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newNotif: NotificationItem = {
    ...notifData,
    id,
  };
  notifs.unshift(newNotif);
  setItem(STORAGE_KEYS.NOTIFICATIONS, notifs);

  // Sync to Firestore and await to ensure data integrity
  try {
    await setDoc(doc(db, 'notifications', id), newNotif);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notifications/${id}`);
  }

  return newNotif;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const notifs = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const updated = notifs.map((n) => (n.id === id ? { ...n, read: true } : n));
  setItem(STORAGE_KEYS.NOTIFICATIONS, updated);

  // Sync to Firestore
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (err) {
    console.warn('Notif update warn:', err);
  }
}

export async function markAllNotificationsAsRead(recipientUid: string): Promise<void> {
  if (!recipientUid) return;
  const notifs = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const unreadToUpdate = notifs.filter((n) => n.recipientUid === recipientUid && !n.read && n.id);
  const updated = notifs.map((n) => (n.recipientUid === recipientUid ? { ...n, read: true } : n));
  setItem(STORAGE_KEYS.NOTIFICATIONS, updated);

  try {
    await Promise.allSettled(
      unreadToUpdate.map((n) => updateDoc(doc(db, 'notifications', n.id!), { read: true }))
    );
  } catch (err) {
    console.warn('markAllNotificationsAsRead warning:', err);
  }
}

export async function deleteNotificationItem(id: string): Promise<void> {
  if (!id) return;
  const notifs = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const updated = notifs.filter((n) => n.id !== id);
  setItem(STORAGE_KEYS.NOTIFICATIONS, updated);

  try {
    await deleteDoc(doc(db, 'notifications', id));
  } catch (err) {
    console.warn('deleteNotificationItem warning:', err);
  }
}

export async function fetchNotificationsFromFirestore(recipientUid: string): Promise<NotificationItem[]> {
  const localNotifs = getNotifications(recipientUid);
  if (!recipientUid) return localNotifs;

  try {
    const q = query(collection(db, 'notifications'), where('recipientUid', '==', recipientUid));
    const snap = await getDocs(q);
    const firestoreNotifs: NotificationItem[] = [];
    snap.forEach((d) => {
      firestoreNotifs.push({ id: d.id, ...d.data() } as NotificationItem);
    });

    if (firestoreNotifs.length > 0) {
      const allNotifs = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
      const otherNotifs = allNotifs.filter((n) => n.recipientUid !== recipientUid);
      const merged = [...firestoreNotifs, ...otherNotifs];
      setItem(STORAGE_KEYS.NOTIFICATIONS, merged);
      return firestoreNotifs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  } catch (err) {
    console.warn('fetchNotificationsFromFirestore notice:', err);
  }

  return localNotifs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// --- AUDIT LOGS MANAGEMENT ---
export function getAuditLogs(): AuditLogEntry[] {
  return getItem<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, []);
}

export async function fetchAuditLogsFromFirestore(): Promise<AuditLogEntry[]> {
  try {
    const q = query(collection(db, 'audit_logs'), where('timestamp', '!=', ''));
    const fetchPromise = getDocs(q);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    const snap = await Promise.race([fetchPromise, timeoutPromise]);

    if (snap && 'docs' in snap) {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));
      setItem(STORAGE_KEYS.AUDIT_LOGS, logs);
      return logs;
    }
  } catch (err) {
    console.warn('Firestore fetchAuditLogs error:', err);
  }
  return getAuditLogs();
}

export async function fetchUsersFromFirestore(): Promise<UserProfile[]> {
  try {
    const fetchPromise = getDocs(collection(db, 'users'));
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    const snap = await Promise.race([fetchPromise, timeoutPromise]);

    if (snap && 'docs' in snap) {
      const users = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      saveUsers(users);
      return users;
    }
  } catch (err) {
    console.warn('Firestore fetchUsers error:', err);
  }
  return getUsers();
}

export async function fetchApplicationsFromFirestore(): Promise<StaffApplication[]> {
  try {
    const fetchPromise = getDocs(collection(db, 'applications'));
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    const snap = await Promise.race([fetchPromise, timeoutPromise]);

    if (snap && 'docs' in snap) {
      const appMap = new Map<string, StaffApplication>();
      snap.docs.forEach(d => {
        const app = { ...d.data(), id: d.id } as StaffApplication;
        if (app.id) {
          appMap.set(app.id, app);
        }
      });
      const apps = deduplicateApplications(Array.from(appMap.values()));
      saveApplications(apps);
      return apps;
    }
  } catch (err) {
    console.warn('Firestore fetchApplications error:', err);
  }
  return deduplicateApplications(getApplications());
}

export function subscribeToApplications(onUpdate: (apps: StaffApplication[]) => void): () => void {
  try {
    const colRef = collection(db, 'applications');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const appMap = new Map<string, StaffApplication>();
        snapshot.forEach((docSnap) => {
          const app = { ...docSnap.data(), id: docSnap.id } as StaffApplication;
          if (app.id) {
            appMap.set(app.id, app);
          }
        });
        const appsList = deduplicateApplications(Array.from(appMap.values()));
        saveApplications(appsList);
        onUpdate(appsList);
      },
      (error) => {
        console.warn('Real-time application subscription notice:', error);
        onUpdate(deduplicateApplications(getApplications()));
      }
    );
  } catch (err) {
    console.warn('subscribeToApplications initialization failed:', err);
    onUpdate(deduplicateApplications(getApplications()));
    return () => {};
  }
}

export async function addAuditLog(entryData: Omit<AuditLogEntry, 'id'>): Promise<AuditLogEntry> {
  const logs = getAuditLogs();
  const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newLog: AuditLogEntry = {
    ...entryData,
    id,
  };
  logs.unshift(newLog);
  setItem(STORAGE_KEYS.AUDIT_LOGS, logs);

  // Sync to Firestore
  try {
    await setDoc(doc(db, 'audit_logs', id), newLog);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `audit_logs/${id}`);
  }

  return newLog;
}

// --- SYSTEM SETTINGS MANAGEMENT ---
export function getSystemSettings(): SystemSettings {
  const settings = getItem<SystemSettings | null>(STORAGE_KEYS.SETTINGS, null);
  return { ...SEED_SETTINGS, ...(settings || {}) };
}

export async function fetchSystemSettings(): Promise<SystemSettings> {
  try {
    const docRef = doc(db, 'settings', 'global');
    
    // 4 second timeout for settings fetch
    const settingsPromise = getDoc(docRef);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
    
    const docSnap = await Promise.race([settingsPromise, timeoutPromise]);
    
    if (docSnap && 'exists' in docSnap && docSnap.exists()) {
      const settings = docSnap.data() as SystemSettings;
      setItem(STORAGE_KEYS.SETTINGS, settings);
      return settings;
    }
    
    // If not in Firestore or timed out, use local storage/seed
    const local = getSystemSettings();
    
    // If we have a connected Firestore but no doc, try to seed it
    if (docSnap && 'exists' in docSnap && !docSnap.exists()) {
       try {
         await setDoc(docRef, SEED_SETTINGS);
       } catch (e) {
         console.warn('Failed to seed settings to Firestore:', e);
       }
    }
    
    return local;
  } catch (err) {
    console.warn('Notice: Using local settings (Firestore offline or busy).');
    return getSystemSettings();
  }
}

export async function saveSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const current = getSystemSettings();
  const updated: SystemSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  
  // Update Local Storage first for immediate UI update if needed
  setItem(STORAGE_KEYS.SETTINGS, updated);

  // Sync to Firestore and wait for completion
  try {
    await setDoc(doc(db, 'settings', 'global'), updated, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'settings/global');
  }

  return updated;
}

export async function auditAndFixOwnerRoles(): Promise<number> {
  const users = await fetchUsersFromFirestore();
  let removedCount = 0;
  for (const user of users) {
    const isOwnerEmail = DEFAULT_OWNER_EMAILS.some((e) => e.toLowerCase() === user.email.toLowerCase());
    const isOwnerUid = DEFAULT_OWNER_UIDS.includes(user.uid);
    if (user.role === 'OWNER' && !isOwnerEmail && !isOwnerUid) {
      console.log('Downgrading unauthorized owner:', user.email, user.uid);
      await updateUserRole(user.uid, 'USER', 'SYSTEM_AUDIT_FIX');
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    await addAuditLog({
      action: 'OWNER_ROLE_AUDIT',
      actorUid: 'SYSTEM',
      actorName: 'System Audit',
      actorEmail: 'system@flick.gg',
      actorRole: 'OWNER',
      targetResource: 'users',
      targetUid: 'multiple',
      timestamp: new Date().toISOString(),
      metadata: {
        removedCount,
      },
    });
  }
  return removedCount;
}

// --- CURRENT SESSION PERSISTENCE ---
export function getStoredSession(): UserProfile | null {
  return getItem<UserProfile | null>(STORAGE_KEYS.CURRENT_USER, null);
}

export function saveStoredSession(user: UserProfile | null): void {
  if (user) {
    setItem(STORAGE_KEYS.CURRENT_USER, user);
  } else {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }
}

export async function deleteAllApplications(): Promise<void> {
  saveApplications([]);
  try {
    const snap = await getDocs(collection(db, 'applications'));
    const deletePromises = snap.docs.map((docSnap) => deleteDoc(doc(db, 'applications', docSnap.id)));
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Error deleting all applications from Firestore:', err);
  }
}
// --- TASK MANAGEMENT ---
export function getTasks(): Task[] {
  return getItem<Task[]>(STORAGE_KEYS.TASKS, []);
}

export function saveTasks(tasks: Task[]): void {
  setItem(STORAGE_KEYS.TASKS, tasks);
}

export async function addTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  const tasks = getTasks();
  const id = `task-${Date.now()}`;
  const now = new Date().toISOString();
  const newTask: Task = {
    ...taskData,
    id,
    createdAt: now,
    updatedAt: now,
  };
  tasks.unshift(newTask);
  saveTasks(tasks);
  
  try {
    await setDoc(doc(db, 'tasks', id), newTask);
  } catch (err) {
    console.error('Error saving task to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `tasks/${id}`);
  }
  return newTask;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  const tasks = getTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...updates, updatedAt: new Date().toISOString() };
    saveTasks(tasks);
    try {
      await updateDoc(doc(db, 'tasks', id), { ...updates, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Error updating task in Firestore:', err);
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${id}`);
    }
  }
}

export async function fetchTasksFromFirestore(): Promise<Task[]> {
  try {
    const q = query(collection(db, 'tasks'));
    const snap = await getDocs(q);
    const tasks: Task[] = [];
    snap.forEach((d) => {
      tasks.push({ ...d.data() } as Task);
    });
    // Sort by createdAt descending
    tasks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    saveTasks(tasks);
    return tasks;
  } catch (err) {
    console.warn('Firestore fetchTasks error, using local fallback:', err);
    return getTasks();
  }
}

export function subscribeToTasks(onUpdate: (tasks: Task[]) => void): () => void {
  try {
    const colRef = collection(db, 'tasks');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const tasksList: Task[] = [];
        snapshot.forEach((docSnap) => {
          tasksList.push({ ...docSnap.data() } as Task);
        });
        tasksList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        saveTasks(tasksList);
        onUpdate(tasksList);
      },
      (error) => {
        console.warn('Real-time task subscription notice:', error);
        onUpdate(getTasks());
      }
    );
  } catch (err) {
    console.warn('subscribeToTasks initialization failed:', err);
    onUpdate(getTasks());
    return () => {};
  }
}

export async function deleteTask(id: string): Promise<void> {
  if (!id) return;
  
  // 1. Clear from local storage cache immediately
  const tasks = getTasks();
  const remaining = tasks.filter(t => t.id !== id);
  saveTasks(remaining);

  // 2. Delete document from Firestore
  try {
    await deleteDoc(doc(db, 'tasks', id));
  } catch (err) {
    console.warn('Warning deleting task from Firestore (handled gracefully):', err);
  }
}

// --- CUSTOM PANELS MANAGEMENT ---
export function getCustomPanels(): CustomPanel[] {
  return getItem<CustomPanel[]>(STORAGE_KEYS.CUSTOM_PANELS, []);
}

export function saveCustomPanels(panels: CustomPanel[]): void {
  setItem(STORAGE_KEYS.CUSTOM_PANELS, panels);
}

export async function fetchCustomPanelsFromFirestore(): Promise<CustomPanel[]> {
  try {
    const q = query(collection(db, 'custom_panels'));
    const snap = await getDocs(q);
    const panels: CustomPanel[] = [];
    snap.forEach((d) => {
      panels.push({ id: d.id, ...d.data() } as CustomPanel);
    });
    panels.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    saveCustomPanels(panels);
    return panels;
  } catch (err) {
    console.warn('Firestore fetchCustomPanels error, using local fallback:', err);
    return getCustomPanels();
  }
}

export function subscribeToCustomPanels(onUpdate: (panels: CustomPanel[]) => void): () => void {
  try {
    const colRef = collection(db, 'custom_panels');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const panels: CustomPanel[] = [];
        snapshot.forEach((docSnap) => {
          panels.push({ id: docSnap.id, ...docSnap.data() } as CustomPanel);
        });
        panels.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        saveCustomPanels(panels);
        onUpdate(panels);
      },
      (error) => {
        console.warn('Real-time custom panels subscription notice:', error);
        onUpdate(getCustomPanels());
      }
    );
  } catch (err) {
    console.warn('subscribeToCustomPanels initialization failed:', err);
    onUpdate(getCustomPanels());
    return () => {};
  }
}

export async function addCustomPanel(
  panelData: Omit<CustomPanel, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CustomPanel> {
  const panels = getCustomPanels();
  const id = `panel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const newPanel: CustomPanel = {
    ...panelData,
    id,
    createdAt: now,
    updatedAt: now,
  };
  panels.unshift(newPanel);
  saveCustomPanels(panels);

  try {
    await setDoc(doc(db, 'custom_panels', id), newPanel);
  } catch (err) {
    console.error('Error saving custom panel to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `custom_panels/${id}`);
  }
  return newPanel;
}

export async function updateCustomPanel(id: string, updates: Partial<CustomPanel>): Promise<CustomPanel | null> {
  const panels = getCustomPanels();
  const idx = panels.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const updated: CustomPanel = {
    ...panels[idx],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  panels[idx] = updated;
  saveCustomPanels(panels);

  try {
    await setDoc(doc(db, 'custom_panels', id), updated, { merge: true });
  } catch (err) {
    console.error('Error updating custom panel in Firestore:', err);
    handleFirestoreError(err, OperationType.UPDATE, `custom_panels/${id}`);
  }
  return updated;
}

export async function deleteCustomPanel(id: string): Promise<void> {
  if (!id) return;
  const panels = getCustomPanels().filter((p) => p.id !== id);
  saveCustomPanels(panels);

  try {
    await deleteDoc(doc(db, 'custom_panels', id));
  } catch (err) {
    console.warn('Warning deleting custom panel from Firestore:', err);
  }
}

// --- SYSTEM PANELS CONFIGURATION MANAGEMENT ---
export interface SystemPanelConfig {
  id: string; // 'admin' | 'mod' | 'staff' | 'owner'
  name: string;
  description: string;
  color: string;
  emoji: string;
  features: PanelFeature[];
}

export const DEFAULT_SYSTEM_PANELS: Record<string, SystemPanelConfig> = {
  admin: {
    id: 'admin',
    name: 'Admin Panel V2',
    description: 'Executive administration, applications review, incident reports, and role assignments.',
    color: '#a855f7',
    emoji: '🛡️',
    features: ['Dashboard', 'Applications', 'Reports', 'Users', 'Task Management'],
  },
  mod: {
    id: 'mod',
    name: 'Moderator Panel',
    description: 'Investigate incident reports and review active application queues.',
    color: '#10b981',
    emoji: '🔨',
    features: ['Dashboard', 'Reports', 'Applications', 'Task Management'],
  },
  staff: {
    id: 'staff',
    name: 'Staff Panel',
    description: 'Review active applicants and handle assigned investigation tasks.',
    color: '#06b6d4',
    emoji: '⚡',
    features: ['Dashboard', 'Reports', 'Applications', 'Task Management'],
  },
  owner: {
    id: 'owner',
    name: 'Owner Command',
    description: 'Supreme command center, user management, global settings, audit logs, and panel builder.',
    color: '#fbbf24',
    emoji: '👑',
    features: ['Dashboard', 'Users', 'Reports', 'Applications', 'Settings', 'Task Management'],
  },
};

export async function fetchSystemPanelsConfig(): Promise<Record<string, SystemPanelConfig>> {
  try {
    const docRef = doc(db, 'settings', 'system_panels');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_SYSTEM_PANELS, ...(snap.data() as Record<string, SystemPanelConfig>) };
    }
  } catch (err) {
    console.warn('Notice: fetchSystemPanelsConfig fallback to defaults', err);
  }
  return DEFAULT_SYSTEM_PANELS;
}

export async function saveSystemPanelsConfig(config: Record<string, SystemPanelConfig>): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'system_panels'), config, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'settings/system_panels');
  }
}

// --- COOLDOWN MANAGEMENT ---
export async function getApplicationCooldown(uid: string): Promise<ApplicationCooldown | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'application_settings', 'cooldown'));
    if (snap.exists()) {
      return snap.data() as ApplicationCooldown;
    }
  } catch (err) {
    console.warn('Firestore getApplicationCooldown error:', err);
  }
  return null;
}

export async function setApplicationCooldown(uid: string, cooldownData: ApplicationCooldown): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid, 'application_settings', 'cooldown'), cooldownData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/application_settings/cooldown`);
    throw err;
  }
}



