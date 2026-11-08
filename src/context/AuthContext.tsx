import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import {
  createOrUpdateUser,
  getStoredSession,
  saveStoredSession,
  getUserByUid,
  getUserByEmail,
  updateUserProfileDetails,
  fetchUserProfileFromFirestore,
  saveUserProfileToFirestore,
  deleteUserProfile,
  DEFAULT_OWNER_EMAILS,
  DEFAULT_OWNER_UIDS,
  updateUserRole,
} from '../lib/storage';
import { auth, googleProvider, db } from '../lib/firebase';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SignOutConfirmModal } from '../components/SignOutConfirmModal';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bannerURL?: string;
  bio?: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  errorCode: string | null;
  isStaff: boolean;
  isMod: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  loginWithGoogle: () => Promise<UserProfile>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<UserProfile>;
  loginWithEmailPassword: (email: string, password: string) => Promise<UserProfile>;
  loginWithEmail: (email: string, name?: string) => Promise<UserProfile>;
  loginAsDemoRole: (role: UserRole) => Promise<UserProfile>;
  logout: () => Promise<void>;
  isSignOutModalOpen: boolean;
  requestSignOut: () => void;
  cancelSignOut: () => void;
  confirmSignOut: () => Promise<void>;
  updateNotificationPreference: (enabled: boolean) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateProfilePhoto: (photoURL: string) => Promise<void>;
  updateProfileBanner: (bannerURL: string) => Promise<void>;
  updateProfileDetails: (updates: { name?: string; bio?: string }) => Promise<void>;
  sendPasswordResetLink: (emailAddress?: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

  const processingUid = React.useRef<string | null>(null);

  // Internal helper to process a Firebase user and ensure a Firestore profile exists
  const processUser = async (fbUser: User): Promise<UserProfile> => {
    if (processingUid.current === fbUser.uid) {
      console.log('[AuthDiagnostic] already processing user:', fbUser.uid);
    }
    processingUid.current = fbUser.uid;

    const activeEmail = fbUser.email?.toLowerCase() || '';
    const activeName = fbUser.displayName || activeEmail.split('@')[0] || 'User';
    const isOwnerEmail = DEFAULT_OWNER_EMAILS.some((e) => e.toLowerCase() === activeEmail);
    const isOwnerUid = DEFAULT_OWNER_UIDS.includes(fbUser.uid);
    const isOwnerAuthorized = isOwnerEmail || isOwnerUid;

    console.log('[AuthDiagnostic] Processing user:', fbUser.uid, activeEmail, 'isOwner:', isOwnerAuthorized);

    // 1. Fetch live profile from Firestore or local storage cache
    let profile: UserProfile | null = await fetchUserProfileFromFirestore(fbUser.uid);

    // 2. If profile exists in Firestore, keep all fields intact (name, bio, banner, photo, role)
    if (profile) {
      console.log('[AuthDiagnostic] Found existing profile in Firestore with preserved banner and bio. Role:', profile.role);
      
      // FIX: Ensure correct role for owners
      if (isOwnerAuthorized && profile.role !== 'OWNER') {
        console.log('[AuthDiagnostic] Fixing user role to OWNER for authorized owner');
        profile = await updateUserRole(fbUser.uid, 'OWNER', 'SYSTEM_FIX') || profile;
      }
      
      const updatesToSync: Partial<UserProfile> = {};
      if (!profile.photoURL && fbUser.photoURL) {
        updatesToSync.photoURL = fbUser.photoURL;
      }
      if (!profile.name && activeName) {
        updatesToSync.name = activeName;
      }
      if (Object.keys(updatesToSync).length > 0) {
        profile = await saveUserProfileToFirestore(fbUser.uid, updatesToSync);
      }
    } else {
      // 3. Brand new user profile creation
      try {
        console.log('[AuthDiagnostic] Creating initial profile document in Firestore');
        profile = await createOrUpdateUser({
          uid: fbUser.uid,
          email: activeEmail,
          name: activeName,
          photoURL: fbUser.photoURL || '',
          bannerURL: '',
          bio: '',
          role: isOwnerAuthorized ? 'OWNER' : 'USER',
          providerId: fbUser.providerData[0]?.providerId || 'google.com',
        });
        console.log('[AuthDiagnostic] Initial profile document created successfully');
      } catch (createErr) {
        console.warn('[AuthDiagnostic] Firestore profile creation notice, using safe fallback profile:', createErr);
        profile = {
          uid: fbUser.uid,
          name: activeName,
          email: activeEmail,
          photoURL: fbUser.photoURL || '',
          bannerURL: '',
          bio: '',
          role: isOwnerAuthorized ? 'OWNER' : 'USER',
          createdAt: new Date().toISOString(),
          lastSignInAt: new Date().toISOString(),
          isSuspended: false,
          providerId: fbUser.providerData[0]?.providerId || 'google.com',
        };
      }
    }

    // 4. Update state and session
    setUserProfile(profile);
    setCurrentUser({
      uid: profile.uid,
      email: profile.email,
      displayName: profile.name,
      photoURL: profile.photoURL,
      bannerURL: profile.bannerURL,
      bio: profile.bio,
    });
    saveStoredSession(profile);
    
    processingUid.current = null;
    return profile;
  };

  // Listen to Firebase auth state changes & handle redirect sign-in result
  useEffect(() => {
    console.log('[AuthDiagnostic] Initializing onAuthStateChanged & getRedirectResult');

    // 1. Check for redirect authentication result on page load
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          console.log('[AuthDiagnostic] getRedirectResult returned user UID:', result.user.uid);
          await processUser(result.user);
        }
      })
      .catch((error: any) => {
        console.error('[AuthDiagnostic] getRedirectResult error:', error);
        const code = error?.code || 'auth/redirect-error';
        let msg = error?.message || 'Redirect Sign-In failed.';
        if (code === 'auth/unauthorized-domain') {
          msg = `Domain "${window.location.hostname}" is not authorized. Please add it to Authorized Domains in your Firebase Console (Authentication -> Settings -> Authorized Domains).`;
        }
        setAuthError(msg);
        setErrorCode(code);
      });

    // 2. Main Firebase auth state observer
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: User | null) => {
      console.log('[AuthDiagnostic] onAuthStateChanged fired. User authenticated:', !!fbUser);
      try {
        if (fbUser) {
          await processUser(fbUser);
          console.log('[AuthDiagnostic] onAuthStateChanged processing completed');
        } else {
          console.log('[AuthDiagnostic] No Firebase user authenticated. Checking for local session...');
          const stored = getStoredSession();
          if (stored) {
            console.log('[AuthDiagnostic] Using stored local session for:', stored.role);
            setUserProfile(stored);
            setCurrentUser({
              uid: stored.uid,
              email: stored.email,
              displayName: stored.name,
              photoURL: stored.photoURL,
              bannerURL: stored.bannerURL,
              bio: stored.bio,
            });
          } else {
            console.log('[AuthDiagnostic] No user session found. Clearing state.');
            setUserProfile(null);
            setCurrentUser(null);
          }
        }
      } catch (error) {
        console.error('[AuthDiagnostic] onAuthStateChanged handler error:', error);
      } finally {
        setLoading(false);
        console.log('[AuthDiagnostic] Loading state set to false (onAuthStateChanged)');
      }
    });

    const safetyTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[AuthDiagnostic] Safety timeout reached (10s). Forcing loading: false');
          return false;
        }
        return prev;
      });
    }, 10000);

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const loginWithGoogle = async (): Promise<UserProfile> => {
    console.log('[AuthDiagnostic] loginWithGoogle start (signInWithPopup)');
    setLoading(true);
    setAuthError(null);
    setErrorCode(null);

    try {
      console.log('[AuthDiagnostic] Initiating signInWithPopup(auth, googleProvider)...');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('[AuthDiagnostic] signInWithPopup succeeded for user:', result.user.uid, result.user.email);
      const profile = await processUser(result.user);
      setLoading(false);
      return profile;
    } catch (err: any) {
      console.error('[AuthDiagnostic] Google Sign-In Error:', err);
      const code = err?.code || '';
      let msg = err?.message || 'Failed to sign in with Google.';

      // If popup is blocked by the browser, fallback to signInWithRedirect
      if (code === 'auth/popup-blocked') {
        console.warn('[AuthDiagnostic] Popup was blocked by browser. Attempting signInWithRedirect fallback...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return new Promise<UserProfile>(() => {});
        } catch (redirectErr: any) {
          console.error('[AuthDiagnostic] Redirect fallback error:', redirectErr);
          msg = 'Sign-in popup was blocked by your browser. Please allow popups or use Email sign-in.';
          setAuthError(msg);
          setErrorCode(redirectErr?.code || code);
          setLoading(false);
          throw redirectErr;
        }
      }

      if (code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in window was closed before completing.';
      } else if (code === 'auth/unauthorized-domain') {
        msg = `Domain "${window.location.hostname}" is not authorized. Please add it to Authorized Domains in Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
      }
      setAuthError(msg);
      setErrorCode(code);
      setLoading(false);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    setErrorCode(null);

    const activeEmail = email.trim().toLowerCase();
    const activeName = name?.trim() || activeEmail.split('@')[0] || 'User';

    try {
      console.log('[AuthDiagnostic] Creating user with Firebase Auth email/password...');
      const cred = await createUserWithEmailAndPassword(auth, activeEmail, password);
      if (activeName && auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: activeName });
        } catch (uErr) {
          console.warn('[AuthDiagnostic] updateProfile name notice:', uErr);
        }
      }
      const profile = await processUser(cred.user);
      setLoading(false);
      return profile;
    } catch (err: any) {
      console.error('[AuthDiagnostic] signUpWithEmail Error:', err);
      const code = err?.code || 'auth/signup-failed';

      // Fallback if Email/Password provider isn't toggled in Firebase Console yet
      if (code === 'auth/operation-not-allowed') {
        console.warn('[AuthDiagnostic] Email/Password provider disabled in console. Using direct secure registration...');
        const profile = await createOrUpdateUser({
          email: activeEmail,
          name: activeName,
          role: 'USER',
          providerId: 'email',
        });
        setUserProfile(profile);
        setCurrentUser({
          uid: profile.uid,
          email: profile.email,
          displayName: profile.name,
          photoURL: profile.photoURL,
          bannerURL: profile.bannerURL,
          bio: profile.bio,
        });
        saveStoredSession(profile);
        setLoading(false);
        return profile;
      }

      let msg = err?.message || 'Email registration failed.';
      if (code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists. Please sign in instead.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      }
      setAuthError(msg);
      setErrorCode(code);
      setLoading(false);
      throw err;
    }
  };

  const loginWithEmailPassword = async (email: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    setErrorCode(null);

    const activeEmail = email.trim().toLowerCase();

    try {
      console.log('[AuthDiagnostic] Signing in with Firebase Auth email/password...');
      const cred = await signInWithEmailAndPassword(auth, activeEmail, password);
      const profile = await processUser(cred.user);
      setLoading(false);
      return profile;
    } catch (err: any) {
      console.error('[AuthDiagnostic] loginWithEmailPassword Error:', err);
      const code = err?.code || 'auth/login-failed';

      // Fallback if Email/Password provider is disabled in console
      if (code === 'auth/operation-not-allowed') {
        console.warn('[AuthDiagnostic] Email/Password provider disabled in console. Using fallback authentication...');
        const profile = await createOrUpdateUser({
          email: activeEmail,
          name: activeEmail.split('@')[0],
          role: 'USER',
          providerId: 'email',
        });
        setUserProfile(profile);
        setCurrentUser({
          uid: profile.uid,
          email: profile.email,
          displayName: profile.name,
          photoURL: profile.photoURL,
          bannerURL: profile.bannerURL,
          bio: profile.bio,
        });
        saveStoredSession(profile);
        setLoading(false);
        return profile;
      }

      let msg = err?.message || 'Login failed.';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        msg = 'Invalid email or password. Please check your credentials and try again.';
      }
      setAuthError(msg);
      setErrorCode(code);
      setLoading(false);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, name?: string): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    setErrorCode(null);

    try {
      const activeEmail = email.trim().toLowerCase();
      const activeName = name?.trim() || activeEmail.split('@')[0] || 'User';

      const profile = await createOrUpdateUser({
        email: activeEmail,
        name: activeName,
        role: 'USER', // Always USER role
        providerId: 'local',
      });

      setUserProfile(profile);
      setCurrentUser({
        uid: profile.uid,
        email: profile.email,
        displayName: profile.name,
        photoURL: profile.photoURL,
        bannerURL: profile.bannerURL,
        bio: profile.bio,
      });

      saveStoredSession(profile);
      return profile;
    } catch (err: any) {
      const msg = err?.message || 'Login failed.';
      setAuthError(msg);
      setErrorCode('auth/login-failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemoRole = async (role: UserRole): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    setErrorCode(null);

    const roleEmails: Record<UserRole, { email: string; name: string }> = {
      OWNER: { email: 'flickblaze7@gmail.com', name: 'Flick Owner' },
      ADMIN: { email: 'admin@flick.gg', name: 'Executive Admin' },
      MOD: { email: 'mod@flick.gg', name: 'Lead Moderator' },
      STAFF: { email: 'staff@flick.gg', name: 'Senior Staff' },
      USER: { email: 'applicant@flick.gg', name: 'Community Member' },
    };

    const info = roleEmails[role] || roleEmails.USER;
    const profile = await createOrUpdateUser({
      email: info.email,
      name: info.name,
      role,
      providerId: 'demo',
    });

    setUserProfile(profile);
    setCurrentUser({
      uid: profile.uid,
      email: profile.email,
      displayName: profile.name,
      photoURL: profile.photoURL,
      bannerURL: profile.bannerURL,
      bio: profile.bio,
    });

    saveStoredSession(profile);
    setLoading(false);
    return profile;
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase SignOut warning:', e);
    }
    setCurrentUser(null);
    setUserProfile(null);
    saveStoredSession(null);
    setAuthError(null);
    setErrorCode(null);
  };

  const requestSignOut = () => {
    setIsSignOutModalOpen(true);
  };

  const cancelSignOut = () => {
    setIsSignOutModalOpen(false);
  };

  const confirmSignOut = async () => {
    await logout();
    setIsSignOutModalOpen(false);
  };

  const updateNotificationPreference = async (enabled: boolean) => {
    if (!userProfile) return;
    try {
      const updated = await saveUserProfileToFirestore(userProfile.uid, {
        notificationsEnabled: enabled,
      });
      setUserProfile(updated);
      saveStoredSession(updated);
    } catch (err) {
      console.warn('updateNotificationPreference error:', err);
      throw err;
    }
  };

  const updateDisplayName = async (name: string) => {
    if (!userProfile) return;
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Display Name cannot be empty.');
    if (auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: trimmed });
      } catch (err) {
        console.warn('Firebase auth updateProfile name warning:', err);
      }
    }
    const updated = await saveUserProfileToFirestore(userProfile.uid, { name: trimmed });
    setUserProfile(updated);
    setCurrentUser({
      uid: updated.uid,
      email: updated.email,
      displayName: updated.name,
      photoURL: updated.photoURL,
      bannerURL: updated.bannerURL,
      bio: updated.bio,
    });
    saveStoredSession(updated);
  };

  const updateProfileDetails = async (updates: { name?: string; bio?: string }) => {
    if (!userProfile) return;
    if (auth.currentUser && updates.name) {
      try {
        await updateProfile(auth.currentUser, { displayName: updates.name.trim() });
      } catch (err) {
        console.warn('Firebase auth updateProfile name warning:', err);
      }
    }

    const updated = await saveUserProfileToFirestore(userProfile.uid, {
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.bio !== undefined ? { bio: updates.bio.trim() } : {}),
    });
    setUserProfile(updated);
    setCurrentUser({
      uid: updated.uid,
      email: updated.email,
      displayName: updated.name,
      photoURL: updated.photoURL,
      bannerURL: updated.bannerURL,
      bio: updated.bio,
    });
    saveStoredSession(updated);
  };

  const sendPasswordResetLink = async (emailAddress?: string) => {
    const targetEmail = (emailAddress || userProfile?.email || '').trim();
    if (!targetEmail) {
      throw new Error('No valid email address found for password reset.');
    }
    try {
      await sendPasswordResetEmail(auth, targetEmail);
    } catch (err: any) {
      console.warn('Firebase sendPasswordResetEmail notice:', err);
      // Re-throw if critical error, else caller handles notice message
      throw err;
    }
  };

  const updateProfilePhoto = async (photoURL: string) => {
    if (!userProfile) return;
    if (auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { photoURL });
      } catch (err) {
        console.warn('Firebase auth updateProfile photo warning:', err);
      }
    }
    const updated = await saveUserProfileToFirestore(userProfile.uid, {
      photoURL,
    });

    setUserProfile(updated);
    setCurrentUser({
      uid: updated.uid,
      email: updated.email,
      displayName: updated.name,
      photoURL: updated.photoURL,
      bannerURL: updated.bannerURL,
      bio: updated.bio,
    });
    saveStoredSession(updated);
  };

  const updateProfileBanner = async (bannerURL: string) => {
    if (!userProfile) return;
    const updated = await saveUserProfileToFirestore(userProfile.uid, {
      bannerURL,
    });

    setUserProfile(updated);
    setCurrentUser({
      uid: updated.uid,
      email: updated.email,
      displayName: updated.name,
      photoURL: updated.photoURL,
      bannerURL: updated.bannerURL,
      bio: updated.bio,
    });
    saveStoredSession(updated);
  };

  const deleteAccount = async () => {
    if (!userProfile) return;
    const uidToDelete = userProfile.uid;

    // 1. Delete user document from Firestore and local storage
    await deleteUserProfile(uidToDelete);

    // 2. Delete Firebase Auth account if authenticated with Firebase Auth
    if (auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch (err: any) {
        console.error('Firebase Auth deleteUser error:', err);
        throw err;
      }
    }

    // 3. Clear session states
    setCurrentUser(null);
    setUserProfile(null);
    saveStoredSession(null);
    setAuthError(null);
    setErrorCode(null);
  };

  const refreshProfile = async () => {
    const targetUid = auth.currentUser?.uid || userProfile?.uid;
    if (!targetUid) return;
    try {
      const latest = await fetchUserProfileFromFirestore(targetUid);
      if (latest) {
        setUserProfile(latest);
        setCurrentUser({
          uid: latest.uid,
          email: latest.email,
          displayName: latest.name,
          photoURL: latest.photoURL,
          bannerURL: latest.bannerURL,
          bio: latest.bio,
        });
        saveStoredSession(latest);
      }
    } catch (err) {
      console.warn('refreshProfile warning:', err);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
    setErrorCode(null);
  };

  const role = userProfile?.role || 'USER';
  const isStaff = role === 'STAFF' || role === 'MOD' || role === 'ADMIN' || role === 'OWNER';
  const isMod = role === 'MOD' || role === 'ADMIN' || role === 'OWNER';
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const isOwner = role === 'OWNER';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        authError,
        errorCode,
        isStaff,
        isMod,
        isAdmin,
        isOwner,
        isSignOutModalOpen,
        requestSignOut,
        cancelSignOut,
        confirmSignOut,
        updateNotificationPreference,
        loginWithGoogle,
        signUpWithEmail,
        loginWithEmailPassword,
        loginWithEmail,
        loginAsDemoRole,
        logout,
        updateDisplayName,
        updateProfilePhoto,
        updateProfileBanner,
        updateProfileDetails,
        sendPasswordResetLink,
        deleteAccount,
        refreshProfile,
        clearAuthError,
      }}
    >
      {children}
      <SignOutConfirmModal
        isOpen={isSignOutModalOpen}
        onClose={cancelSignOut}
        onConfirm={confirmSignOut}
        userProfile={userProfile}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

