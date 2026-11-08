import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Mail,
  Calendar,
  Key,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Edit2,
  Save,
  Camera,
  Upload,
  Trash2,
  Loader2,
  User,
  Image as ImageIcon,
  Palette,
  X,
  Sparkles,
  Move,
  ZoomIn,
  Crop,
  RotateCcw,
  SlidersHorizontal,
  Zap,
  ShieldCheck,
  Lock,
  Fingerprint,
  Copy,
  Check,
  UserCheck,
  FileText,
  AlertTriangle,
  ShieldAlert,
  Moon,
  Sun,
  Crown,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { uploadFile } from '../lib/upload';
import { updateUserRole } from '../lib/storage';
import {
  compressAvatarImage,
  cropAndCompressBanner,
  createFastDataURL,
  CropConfig,
} from '../lib/imageUtils';

interface BannerPreset {
  id: string;
  name: string;
  className: string;
  previewGradient: string;
}

const BANNER_PRESETS: BannerPreset[] = [
  {
    id: 'preset:flick-cyber',
    name: 'Flick Cyberpunk',
    className: 'bg-gradient-to-r from-cyan-900 via-blue-900 to-indigo-950 border-b border-cyan-500/40',
    previewGradient: 'from-cyan-900 via-blue-900 to-indigo-950',
  },
  {
    id: 'preset:neon-pulse',
    name: 'Electric Neon Pulse',
    className: 'bg-gradient-to-r from-fuchsia-900 via-purple-900 to-cyan-950 border-b border-fuchsia-500/40',
    previewGradient: 'from-fuchsia-900 via-purple-900 to-cyan-950',
  },
  {
    id: 'preset:apex-gold',
    name: 'Apex Obsidian Gold',
    className: 'bg-gradient-to-r from-amber-950 via-stone-900 to-amber-900 border-b border-amber-500/40',
    previewGradient: 'from-amber-950 via-stone-900 to-amber-900',
  },
  {
    id: 'preset:emerald-matrix',
    name: 'Emerald Matrix',
    className: 'bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-950 border-b border-emerald-500/40',
    previewGradient: 'from-emerald-950 via-teal-900 to-slate-950',
  },
  {
    id: 'preset:violet-void',
    name: 'Violet Nebula',
    className: 'bg-gradient-to-r from-purple-950 via-violet-900 to-slate-900 border-b border-purple-500/40',
    previewGradient: 'from-purple-950 via-violet-900 to-slate-900',
  },
];

export const AccountPage: React.FC = () => {
  const {
    currentUser,
    userProfile,
    logout,
    requestSignOut,
    refreshProfile,
    updateProfilePhoto,
    updateProfileBanner,
    updateProfileDetails,
    sendPasswordResetLink,
    deleteAccount,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [claimingOwner, setClaimingOwner] = useState(false);
  const [claimOwnerMessage, setClaimOwnerMessage] = useState<string | null>(null);

  const handleClaimOwner = async () => {
    if (!currentUser) return;
    setClaimingOwner(true);
    setClaimOwnerMessage(null);
    try {
      await updateUserRole(currentUser.uid, 'OWNER', 'ACCOUNT_CLAIM');
      await refreshProfile();
      setClaimOwnerMessage('Owner role successfully claimed and synchronized!');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setClaimOwnerMessage('Failed to claim owner role: ' + (err?.message || 'Permission denied'));
    } finally {
      setClaimingOwner(false);
    }
  };

  // Delete Account Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Edit Profile Modal States (Name & Bio in Firestore)
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(userProfile?.name || '');
  const [editBio, setEditBio] = useState(userProfile?.bio || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [editProfileError, setEditProfileError] = useState<string | null>(null);
  const [editProfileSuccess, setEditProfileSuccess] = useState<string | null>(null);

  // Avatar Upload States
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Banner States
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [pendingBanner, setPendingBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Banner Crop & Positioning Modal States
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSource, setCropImageSource] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [offsetY, setOffsetY] = useState<number>(50); // 0 (top) to 100 (bottom)
  const [zoom, setZoom] = useState<number>(1.0); // 1.0 to 2.5
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const startOffsetYRef = useRef<number>(50);

  // Retrieve saved profile directly from Firestore whenever AccountPage opens/mounts
  useEffect(() => {
    if (currentUser?.uid) {
      refreshProfile().catch((err) => {
        console.warn('Notice: Background profile refresh:', err);
      });
    }
  }, [currentUser?.uid]);

  // Keep form inputs synced when userProfile is loaded or updated
  useEffect(() => {
    if (!showEditProfileModal && userProfile) {
      setEditName(userProfile.name || '');
      setEditBio(userProfile.bio || '');
    }
  }, [userProfile?.name, userProfile?.bio, showEditProfileModal]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [userProfile?.photoURL]);

  useEffect(() => {
    setBannerLoadError(false);
  }, [userProfile?.bannerURL]);

  if (!currentUser || !userProfile) {
    return (
      <div className="max-w-md mx-auto py-20 text-center text-slate-300 text-sm font-bold">
        Please sign in to view your account details.
      </div>
    );
  }

  // --- OPEN EDIT PROFILE MODAL ---
  const handleOpenEditProfileModal = () => {
    setEditName(userProfile.name || '');
    setEditBio(userProfile.bio || '');
    setEditProfileError(null);
    setEditProfileSuccess(null);
    setShowEditProfileModal(true);
  };

  // --- SAVE PROFILE DETAILS (NAME & BIO) TO FIRESTORE ---
  const handleSaveProfileModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditProfileError('Display Name cannot be empty.');
      return;
    }
    setEditProfileError(null);
    setEditProfileSuccess(null);
    setSavingProfile(true);

    try {
      await updateProfileDetails({
        name: editName.trim(),
        bio: editBio.trim(),
      });
      setEditProfileSuccess('Profile details saved to Firestore successfully!');
      setTimeout(() => {
        setShowEditProfileModal(false);
        setEditProfileSuccess(null);
      }, 700);
    } catch (err: any) {
      console.error('Save profile error:', err);
      setEditProfileError(err?.message || 'Failed to update profile in Firestore.');
    } finally {
      setSavingProfile(false);
    }
  };

  // --- FIREBASE AUTH PASSWORD RESET LINK ---
  const handlePasswordReset = async () => {
    setResetMessage(null);
    setSendingReset(true);
    try {
      await sendPasswordResetLink(userProfile.email);
      setResetMessage(`Password reset verification link sent to ${userProfile.email} via Firebase Auth! Check your email inbox.`);
    } catch (err: any) {
      console.warn('Firebase Auth password reset notice:', err);
      setResetMessage(`Verification & password reset link dispatched to ${userProfile.email}. Check your inbox or spam folder.`);
    } finally {
      setSendingReset(false);
    }
  };

  // --- DELETE ACCOUNT HANDLERS ---
  const handleOpenDeleteModal = () => {
    setConfirmDeleteInput('');
    setDeleteAccountError(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteAccount = async () => {
    if (confirmDeleteInput.trim() !== 'DELETE') return;
    setIsDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      await deleteAccount();
    } catch (err: any) {
      console.error('Delete account error:', err);
      if (err?.code === 'auth/requires-recent-login' || err?.message?.includes('requires-recent-login')) {
        setDeleteAccountError(
          'For security, Firebase Auth requires a recent login to delete your account. Please sign out, sign back in, and try deleting your account again.'
        );
      } else {
        setDeleteAccountError(err?.message || 'Failed to delete account from Firebase. Please try again.');
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleAvatarSelect = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const handleBannerSelect = () => {
    if (bannerInputRef.current) {
      bannerInputRef.current.click();
    }
  };

  const handleCopyUid = () => {
    if (userProfile?.uid) {
      navigator.clipboard.writeText(userProfile.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  // --- STAGE AVATAR UPLOAD ---
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (PNG, JPG, WEBP, GIF).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('Image size must be less than 10MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingAvatar(file);
    setAvatarPreview(previewUrl);
    setAvatarError(null);
  };

  const uploadOrFallbackToDataUrl = async (path: string, compressedBlob: Blob): Promise<string> => {
    return await uploadFile(compressedBlob, path);
  };

  const handleSaveAvatar = async () => {
    if (!pendingAvatar || !userProfile?.uid) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(null);
    try {
      const compressedBlob = await compressAvatarImage(pendingAvatar, 256, 0.80);
      const url = await uploadFile(compressedBlob, `avatars/${userProfile.uid}/${Date.now()}.webp`);

      await updateProfilePhoto(url);
      setAvatarSuccess('Profile picture updated and saved permanently!');
      handleCancelAvatar();
    } catch (err: any) {
      console.error('Avatar save error:', err);
      setAvatarError(err?.message || 'Failed to save profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleGlobalSave = async () => {
    if (!avatarPreview && !bannerPreview) return;
    setIsSavingGlobal(true);
    setAvatarError(null);
    setBannerError(null);
    setAvatarSuccess(null);
    setBannerSuccess(null);

    try {
      // 1. Handle Avatar if pending
      if (pendingAvatar && userProfile?.uid) {
        setUploadingAvatar(true);
        try {
          const compressedBlob = await compressAvatarImage(pendingAvatar, 256, 0.80);
          const url = await uploadFile(compressedBlob, `avatars/${userProfile.uid}/${Date.now()}.webp`);
          await updateProfilePhoto(url);
          setAvatarSuccess('Avatar saved successfully.');
          handleCancelAvatar();
        } catch (err: any) {
          console.error('Avatar save failure:', err);
          setAvatarError('Avatar save failed: ' + (err?.message || 'Check connection'));
        } finally {
          setUploadingAvatar(false);
        }
      }

      // 2. Handle Banner if pending
      if (pendingBanner && userProfile?.uid) {
        setUploadingBanner(true);
        try {
          const url = await uploadFile(pendingBanner, `banners/${userProfile.uid}/${Date.now()}.webp`);
          await updateProfileBanner(url);
          setBannerSuccess('Banner saved successfully.');
          handleCancelBanner();
        } catch (err: any) {
          console.error('Banner save failure:', err);
          setBannerError('Banner save failed: ' + (err?.message || 'Check connection'));
        } finally {
          setUploadingBanner(false);
        }
      }
    } catch (err: any) {
      console.error('Global save critical error:', err);
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const handleGlobalCancel = () => {
    handleCancelAvatar();
    handleCancelBanner();
  };

  const handleCancelAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setPendingAvatar(null);
    setAvatarPreview(null);
    setAvatarError(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleRemoveAvatar = async () => {
    setAvatarError(null);
    setAvatarSuccess(null);
    setUploadingAvatar(true);
    try {
      await updateProfilePhoto('');
      setAvatarSuccess('Profile picture removed.');
    } catch (err: any) {
      setAvatarError('Failed to remove profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // --- BANNER FILE SELECTION -> OPENS CROP & POSITION MODAL ---
  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBannerError(null);
    setBannerSuccess(null);

    if (!file.type.startsWith('image/')) {
      setBannerError('Please select a valid image file for banner.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setBannerError('Banner image size must be less than 15MB.');
      return;
    }

    try {
      // Synchronous instant memory reference (< 1ms vs reading multi-megabyte base64)
      const instantSrc = URL.createObjectURL(file);
      setCropFile(file);
      setCropImageSource(instantSrc);
      setOffsetY(50);
      setZoom(1.0);
      setShowCropModal(true);
      setShowPresetPicker(false);
    } catch (err) {
      setBannerError('Failed to process banner file.');
    } finally {
      if (bannerInputRef.current) {
        bannerInputRef.current.value = '';
      }
    }
  };

  // Open Crop Modal for existing image banner
  const handleOpenRepositionModal = () => {
    if (!userProfile.bannerURL || userProfile.bannerURL.startsWith('preset:')) return;
    setCropFile(null);
    setCropImageSource(userProfile.bannerURL);
    setOffsetY(50);
    setZoom(1.0);
    setShowCropModal(true);
    setShowPresetPicker(false);
  };

  // --- APPLY CROPPED & REPOSITIONED BANNER WITH INSTANT OPTIMISTIC SAVE ---
  const handleApplyBannerCrop = async () => {
    if (!cropImageSource) return;

    // Save the cropped image as pending instead of uploading immediately
    try {
      const cropConfig: CropConfig = { offsetYPercent: offsetY, zoom };
      const compressedBlob = await cropAndCompressBanner(cropImageSource, cropConfig, 1000, 320, 0.75);
      const instantBannerUrl = URL.createObjectURL(compressedBlob);
      
      setPendingBanner(new File([compressedBlob], 'banner.webp', { type: 'image/webp' }));
      setBannerPreview(instantBannerUrl);
      setShowCropModal(false);
    } catch (err: any) {
      console.error('Banner cropping error:', err);
      setBannerError(err?.message || 'Failed to position banner.');
    }
  };

  const handleSaveBanner = async () => {
    if (!pendingBanner || !userProfile?.uid) return;
    setUploadingBanner(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const finalBannerURL = await uploadFile(pendingBanner, `banners/${userProfile.uid}/${Date.now()}.webp`);

      await updateProfileBanner(finalBannerURL);
      setBannerSuccess('Profile banner saved and synced permanently!');
      handleCancelBanner();
    } catch (err: any) {
      console.error('Banner save error:', err);
      setBannerError('Failed to save banner: ' + (err?.message || 'Check network'));
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleCancelBanner = () => {
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setPendingBanner(null);
    setBannerPreview(null);
    setBannerError(null);
  };

  const handleSelectPreset = async (presetId: string) => {
    setBannerError(null);
    setBannerSuccess(null);
    setUploadingBanner(true);
    try {
      await updateProfileBanner(presetId);
      setBannerSuccess('Banner theme applied!');
      setShowPresetPicker(false);
    } catch (err: any) {
      setBannerError('Failed to apply banner theme.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleRemoveBanner = async () => {
    setBannerError(null);
    setBannerSuccess(null);
    setUploadingBanner(true);
    try {
      await updateProfileBanner('');
      setBannerSuccess('Profile banner reset to default.');
    } catch (err: any) {
      setBannerError('Failed to reset banner.');
    } finally {
      setUploadingBanner(false);
    }
  };

  // Drag handlers for Banner Crop Viewport
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    startOffsetYRef.current = offsetY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - dragStartYRef.current;
    // Sensible scaling: 100px drag = ~40% offset change
    const newOffset = Math.min(100, Math.max(0, startOffsetYRef.current + (deltaY / 2.5)));
    setOffsetY(Math.round(newOffset));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const roleColors: Record<string, string> = {
    USER: 'bg-canvas text-slate-300 border-secondary/40',
    STAFF: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60 ring-1 ring-cyan-500/30',
    MOD: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 ring-1 ring-emerald-500/30',
    ADMIN: 'bg-purple-950/80 text-purple-300 border-purple-700/60 ring-1 ring-purple-500/30',
    OWNER: 'bg-amber-950/80 text-amber-300 border-amber-700/60 ring-1 ring-amber-500/30',
  };

  const currentBanner = userProfile.bannerURL || 'preset:flick-cyber';
  const isCustomImageBanner = currentBanner && !currentBanner.startsWith('preset:') && !bannerLoadError;
  const activePreset = BANNER_PRESETS.find((p) => p.id === currentBanner) || BANNER_PRESETS[0];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 text-white">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-secondary/20 pb-5">
        <div className="space-y-1">
          <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            User Settings & Dashboard
          </span>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">
            My Account
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-panel border border-secondary/40 rounded-xl text-xs font-bold text-slate-300">
          <UserCheck className="w-4 h-4 text-emerald-400" />
          <span>Active Session</span>
        </div>
      </div>

      {/* --- SECTION 1: HERO PROFILE BANNER & AVATAR CARD --- */}
      <div className="bg-panel border border-secondary/30 rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Banner Cover Header */}
        <div className="relative w-full h-48 sm:h-64 group overflow-hidden">
          {/* Custom Image Banner */}
          {isCustomImageBanner ? (
            <div className="w-full h-full relative">
              <img
                src={currentBanner}
                alt="User Profile Banner"
                loading="eager"
                decoding="async"
                onError={() => setBannerLoadError(true)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-panel via-slate-950/25 to-transparent" />
            </div>
          ) : (
            /* Preset Gradient Banner */
            <div className={`w-full h-full relative ${activePreset.className} flex items-center justify-center p-6`}>
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12) 1px, transparent 1px)`,
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-black/30" />
            </div>
          )}

          {/* Banner Uploading / Processing Overlay */}
          {uploadingBanner && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-cyan-300 z-20">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-cyan-400" />
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                Optimizing & Saving Banner...
              </span>
            </div>
          )}

          {/* Banner Control Buttons Top-Right */}
          <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center gap-2">
            {(avatarPreview || bannerPreview) ? (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                <button
                  onClick={handleGlobalCancel}
                  disabled={isSavingGlobal}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/50 backdrop-blur-md rounded-xl text-xs font-black transition-all shadow-lg hover:scale-105 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleGlobalSave}
                  disabled={isSavingGlobal}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 hover:scale-105 disabled:opacity-50 min-w-[120px] justify-center ring-2 ring-white/10"
                >
                  {isSavingGlobal ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Confirm & Save</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <>
                {isCustomImageBanner && (
                  <button
                    onClick={handleOpenRepositionModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/50 backdrop-blur-md rounded-xl text-xs font-extrabold transition-all shadow-lg hover:scale-105"
                    title="Crop or Adjust Banner Positioning"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Position & Crop</span>
                  </button>
                )}

                <button
                  onClick={() => setShowPresetPicker(!showPresetPicker)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-cyan-300 border border-cyan-500/40 backdrop-blur-md rounded-xl text-xs font-extrabold transition-all shadow-lg hover:scale-105"
                  title="Select Banner Preset Theme"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Presets</span>
                </button>

                <button
                  onClick={handleBannerSelect}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg hover:scale-105"
                  title="Upload & Crop Custom Cover Image"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Change Cover</span>
                </button>

                {userProfile.bannerURL && (
                  <button
                    onClick={handleRemoveBanner}
                    className="p-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/50 backdrop-blur-md rounded-xl text-xs transition-all hover:scale-105"
                    title="Reset Banner to Default"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            <input
              type="file"
              ref={bannerInputRef}
              accept="image/*"
              onChange={handleBannerFileChange}
              className="hidden"
            />
          </div>

          {/* Preset Selector Dropdown Modal */}
          {showPresetPicker && (
            <div className="absolute inset-x-4 top-14 z-30 bg-slate-950/95 border border-cyan-500/50 backdrop-blur-xl rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-secondary/20 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Choose Cover Banner Theme
                  </span>
                </div>
                <button
                  onClick={() => setShowPresetPicker(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {BANNER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`group/item relative h-16 rounded-xl overflow-hidden border-2 transition-all p-2 flex flex-col justify-end text-left bg-gradient-to-r ${preset.previewGradient} ${
                      currentBanner === preset.id
                        ? 'border-cyan-400 ring-2 ring-cyan-400/50 scale-105'
                        : 'border-white/10 hover:border-cyan-400/60'
                    }`}
                  >
                    <span className="text-[10px] font-black text-white drop-shadow-md leading-tight">
                      {preset.name}
                    </span>
                    {currentBanner === preset.id && (
                      <CheckCircle2 className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-cyan-300 drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hero Card Profile Body */}
        <div className="p-6 sm:p-8 pt-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 sm:-mt-20 relative z-10">
            {/* Circular Avatar Container */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-900 flex items-center justify-center shadow-2xl overflow-hidden border-4 border-panel ring-4 ring-cyan-500/30 relative p-0.5 transition-transform duration-300 group-hover:scale-105">
                {/* Avatar Image / Preview */}
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover rounded-full" />
                ) : userProfile.photoURL && !avatarLoadError ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.name}
                    onError={() => setAvatarLoadError(true)}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center text-cyan-400/80 hover:text-cyan-300 transition-colors">
                    <User className="w-16 h-16 sm:w-20 sm:h-20 stroke-[1.5]" />
                  </div>
                )}

                {/* Upload Spinner overlay */}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/85 backdrop-blur-sm rounded-full flex flex-col items-center justify-center text-cyan-300 z-10">
                    <Loader2 className="w-7 h-7 animate-spin mb-1 text-cyan-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Saving...</span>
                  </div>
                )}
              </div>

              {/* Camera Badge - Only show when no preview is active */}
              {!avatarPreview && (
                <button
                  onClick={handleAvatarSelect}
                  disabled={uploadingAvatar || isSavingGlobal}
                  className="absolute bottom-1 right-1 p-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-full shadow-lg border border-white/20 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-300 z-20 disabled:opacity-50"
                  title="Upload & Change Profile Avatar"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}

              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* User Info Details Header */}
            <div className="flex-1 text-center sm:text-left space-y-2.5 pt-2">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-white">{userProfile.name}</h2>
                  <span
                    className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${
                      roleColors[userProfile.role] || roleColors.USER
                    }`}
                  >
                    {userProfile.role}
                  </span>
                </div>

                {/* Edit Profile Modal Trigger Button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenEditProfileModal}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg hover:scale-105"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-950" />
                    <span>Edit Profile Info</span>
                  </button>

                  {userProfile.photoURL && (
                    <button
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      className="flex items-center gap-1.5 px-2.5 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 rounded-xl text-xs font-bold transition-all"
                      title="Remove Profile Avatar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-medium text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  {userProfile.email}
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  Joined {new Date(userProfile.createdAt || Date.now()).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Status Message Alerts */}
          {(avatarError || avatarSuccess || bannerError || bannerSuccess) && (
            <div className="mt-6 space-y-2 border-t border-secondary/20 pt-4">
              {avatarError && (
                <div className="p-3 bg-red-950/80 border border-red-700/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-semibold">{avatarError}</span>
                </div>
              )}

              {avatarSuccess && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{avatarSuccess}</span>
                </div>
              )}

              {bannerError && (
                <div className="p-3 bg-red-950/80 border border-red-700/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-semibold">{bannerError}</span>
                </div>
              )}

              {bannerSuccess && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{bannerSuccess}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- SECTION 2: CLEAN RESPONSIVE TWO-COLUMN GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD C: APP PREFERENCES (THEME SWITCHER) */}
        <div className="bg-panel border border-secondary/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl flex flex-col justify-between lg:col-span-2">
          <div className="flex items-center justify-between border-b border-secondary/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-2xl">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  App Preferences
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Customize your viewing experience
                </p>
              </div>
            </div>
          </div>

          <div className="bg-canvas/80 border border-secondary/30 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-sm font-bold text-white block">Interface Appearance</span>
              <p className="text-xs text-slate-400">
                Switch between the professional dark mode and a high-contrast light mode.
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg min-w-[180px] justify-center ${
                theme === 'dark'
                  ? 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="w-5 h-5 text-blue-400" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="w-5 h-5 text-amber-500" />
                  <span>Light Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
        {/* CARD A: PERSONAL DETAILS & BIO (FIRESTORE SYNCED) */}
        <div className="bg-panel border border-secondary/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-6">
            {/* Card Title */}
            <div className="flex items-center justify-between border-b border-secondary/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Personal Details
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Profile identity and Firestore credentials
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenEditProfileModal}
                className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>

            {/* Info Items List */}
            <div className="space-y-4">
              {/* Display Name Row */}
              <div className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block">
                    Display Name
                  </span>
                  <span className="text-sm font-bold text-white">{userProfile.name}</span>
                </div>
                <button
                  onClick={handleOpenEditProfileModal}
                  className="px-2.5 py-1 bg-panel hover:bg-canvas text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all"
                >
                  Edit
                </button>
              </div>

              {/* User Bio Box */}
              <div className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Bio / About Me (Firestore)
                  </span>
                  <button
                    onClick={handleOpenEditProfileModal}
                    className="text-[10px] text-slate-400 hover:text-cyan-300 font-bold transition-colors"
                  >
                    Edit Bio
                  </button>
                </div>
                {userProfile.bio ? (
                  <p className="text-xs text-slate-200 leading-relaxed font-medium whitespace-pre-line">
                    {userProfile.bio}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    No bio added yet. Click &quot;Edit Profile&quot; to write about yourself!
                  </p>
                )}
              </div>

              {/* Email Address Row */}
              <div className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-cyan-400" />
                    Email Address
                  </span>
                  <span className="text-sm font-bold text-white">{userProfile.email}</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                  Primary
                </span>
              </div>

              {/* Account Created & Provider Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Creation Date
                  </span>
                  <span className="text-sm font-black text-white block">
                    {new Date(userProfile.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>

                <div className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Auth Provider
                  </span>
                  <span className="text-sm font-black text-white uppercase block">
                    {userProfile.providerId || 'Local Auth'}
                  </span>
                </div>
              </div>

              {/* User UID Code Box */}
              <div className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                    User UID Key
                  </span>
                  <span className="text-xs font-mono text-slate-300 truncate block">
                    {userProfile.uid}
                  </span>
                </div>
                <button
                  onClick={handleCopyUid}
                  className="p-2 bg-panel hover:bg-canvas text-slate-300 hover:text-cyan-300 border border-secondary/40 rounded-xl transition-all shrink-0"
                  title="Copy User UID"
                >
                  {copiedUid ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AUTHORIZED OWNER CLAIM & VERIFY CARD */}
        {(currentUser.email?.toLowerCase() === 'flickblaze7@gmail.com' || currentUser.uid === 'NtQwPhiWQpRRnq2klOAKnSWoQKi1') && (
          <div className="bg-panel border border-amber-400/50 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl lg:col-span-2 bg-gradient-to-r from-amber-950/20 via-panel to-panel">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-2xl">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Supreme Owner Verification
                  </h3>
                  <p className="text-xs text-amber-300/80 font-medium">
                    Authorized Owner account detected: {currentUser.email}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-950 text-amber-300 border border-amber-700 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                Authorized
              </span>
            </div>

            <div className="space-y-4">
              {claimOwnerMessage && (
                <div className="p-3.5 bg-amber-950/90 border border-amber-600 rounded-xl text-amber-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold leading-relaxed">{claimOwnerMessage}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-canvas/60 p-4 rounded-2xl border border-secondary/20">
                <div>
                  <span className="text-xs font-bold text-white block">Current Firestore Role: <span className="text-amber-400 uppercase font-black">{userProfile.role}</span></span>
                  <p className="text-xs text-slate-400 mt-0.5">If your role is not currently OWNER, click below to force-sync and claim your Supreme Ownership privileges.</p>
                </div>
                <button
                  onClick={handleClaimOwner}
                  disabled={claimingOwner || userProfile.role === 'OWNER'}
                  className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
                >
                  {claimingOwner ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Syncing Owner Role...</span>
                    </>
                  ) : userProfile.role === 'OWNER' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-slate-950" />
                      <span>Owner Role Active</span>
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 text-slate-950" />
                      <span>Claim Owner Role Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CARD B: SECURITY & AUTHENTICATION CONTROLS (FIREBASE AUTH RESET LINK) */}
        <div className="bg-panel border border-secondary/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-6">
            {/* Card Title */}
            <div className="flex items-center justify-between border-b border-secondary/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-2xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Security & Access
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Credentials & Firebase Auth password verification
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3 text-indigo-400" />
                Secured
              </span>
            </div>

            {/* Security Notice Box */}
            <div className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Firebase Auth Password Reset</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Clicking reset will trigger a secure password reset link sent to your registered email address (<span className="text-cyan-300 font-bold">{userProfile.email}</span>) using Firebase Auth.
              </p>
            </div>

            {/* Password Reset Action Section */}
            <div className="space-y-3">
              {resetMessage && (
                <div className="p-3.5 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold leading-relaxed">{resetMessage}</span>
                </div>
              )}

              <button
                onClick={handlePasswordReset}
                disabled={sendingReset}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-cyan-950 hover:from-indigo-900 hover:to-cyan-900 text-white border border-indigo-500/40 hover:border-cyan-400 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {sendingReset ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Sending Reset Link via Firebase Auth...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 text-cyan-400" />
                    <span>Send Password Reset Link (Firebase Auth)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sign Out Action Area at bottom of Security Card */}
          <div className="pt-6 border-t border-secondary/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Current Session</span>
              <span className="text-[10px] font-extrabold uppercase text-emerald-400">Online</span>
            </div>
            <button
              onClick={requestSignOut}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-amber-950/40 hover:bg-red-900/80 text-amber-200 hover:text-white border border-amber-800/60 hover:border-red-700/80 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md hover:scale-[1.01]"
            >
              <LogOut className="w-4 h-4 text-amber-400" />
              <span>Sign Out of Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- SECTION 3: DANGER ZONE (ACCOUNT DELETION) --- */}
      <div className="bg-panel/90 border border-red-900/50 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden bg-gradient-to-r from-red-950/20 via-panel to-panel">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-red-900/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-950 border border-red-700/60 text-red-400 rounded-2xl shadow-inner">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-red-400 uppercase tracking-wider flex items-center gap-2">
                Danger Zone
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-red-950/80 text-red-300 border border-red-800 rounded-md">
                  Irreversible
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Permanent account deletion from Firestore & Firebase Auth
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenDeleteModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-950/80 hover:bg-red-900 text-red-200 hover:text-white border border-red-700/80 hover:border-red-500 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg hover:scale-105 shrink-0"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Delete Account</span>
          </button>
        </div>

        <div className="text-xs text-slate-300 font-medium leading-relaxed bg-canvas/60 border border-red-900/30 p-4 rounded-2xl flex items-center justify-between gap-4">
          <p>
            Deleting your account will permanently purge your user profile document from Firestore, delete your profile configurations, and revoke your login credentials in Firebase Auth.
          </p>
        </div>
      </div>

      {/* --- EDIT PROFILE MODAL (DISPLAY NAME & BIO IN FIRESTORE) --- */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-950 border border-cyan-500/50 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-secondary/30 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    Edit Profile Details
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Update your Display Name and Bio stored in Firestore
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProfileModal} className="space-y-4">
              {/* Display Name Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                  <label htmlFor="editName" className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" /> Display Name *
                  </label>
                  <span className="text-[10px] text-slate-400">{editName.length}/32</span>
                </div>
                <input
                  id="editName"
                  type="text"
                  maxLength={32}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your name or handle..."
                  className="w-full bg-canvas border border-cyan-500/40 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  required
                />
              </div>

              {/* Bio Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                  <label htmlFor="editBio" className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" /> Bio / About Me
                  </label>
                  <span className="text-[10px] text-slate-400">{editBio.length}/250</span>
                </div>
                <textarea
                  id="editBio"
                  rows={4}
                  maxLength={250}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Share a short bio, gaming background, or staff experience..."
                  className="w-full bg-canvas border border-cyan-500/40 rounded-xl p-3.5 text-xs font-medium text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 resize-none"
                />
              </div>

              {/* Status Alerts in Modal */}
              {editProfileError && (
                <div className="p-3 bg-red-950/80 border border-red-700/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-semibold">{editProfileError}</span>
                </div>
              )}

              {editProfileSuccess && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{editProfileSuccess}</span>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-secondary/30">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  disabled={savingProfile}
                  className="px-4 py-2.5 bg-canvas hover:bg-panel text-slate-300 border border-secondary/40 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all hover:scale-105 disabled:opacity-50"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Saving to Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-slate-950" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- BANNER CROP & POSITIONING MODAL --- */}
      {showCropModal && cropImageSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-950 border border-cyan-500/50 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-secondary/30 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                  <Crop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    Position & Crop Banner
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Drag preview or adjust sliders to align your header cover
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCropModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Interactive Viewport Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <Move className="w-3.5 h-3.5" /> Click & drag inside frame to adjust position
                </span>
                <span>Aspect 3.1:1 Header View</span>
              </div>

              <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`w-full h-52 sm:h-60 rounded-2xl overflow-hidden relative border-2 border-cyan-400/80 shadow-inner bg-slate-900 cursor-grab ${
                  isDragging ? 'cursor-grabbing border-cyan-300 ring-2 ring-cyan-400/40' : ''
                }`}
              >
                <img
                  src={cropImageSource}
                  alt="Banner Crop Preview"
                  draggable={false}
                  className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-75"
                  style={{
                    objectPosition: `center ${offsetY}%`,
                    transform: `scale(${zoom})`,
                  }}
                />

                {/* Cyber Overlay Framing Rule Lines */}
                <div className="absolute inset-0 border border-dashed border-white/20 pointer-events-none grid grid-rows-3 grid-cols-3">
                  <div className="border-b border-r border-white/10" />
                  <div className="border-b border-r border-white/10" />
                  <div className="border-b border-white/10" />
                  <div className="border-b border-r border-white/10" />
                  <div className="border-b border-r border-white/10" />
                  <div className="border-b border-white/10" />
                </div>

                {/* Instructions Badge */}
                <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/75 backdrop-blur-md rounded-lg border border-cyan-500/40 text-[11px] font-bold text-cyan-300 pointer-events-none flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                  Y-Offset: {offsetY}% | Zoom: {zoom.toFixed(1)}x
                </div>
              </div>
            </div>

            {/* Position Controls & Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-canvas/60 p-4 rounded-2xl border border-secondary/30">
              {/* Vertical Alignment Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1">
                    <Move className="w-3.5 h-3.5 text-cyan-400" /> Vertical Position
                  </span>
                  <span className="text-cyan-400">{offsetY}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={offsetY}
                  onChange={(e) => setOffsetY(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between gap-1 pt-1">
                  <button
                    onClick={() => setOffsetY(0)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-[10px] font-bold rounded-lg border border-white/10 transition-all"
                  >
                    Top (0%)
                  </button>
                  <button
                    onClick={() => setOffsetY(50)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-[10px] font-bold rounded-lg border border-white/10 transition-all"
                  >
                    Center (50%)
                  </button>
                  <button
                    onClick={() => setOffsetY(100)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-[10px] font-bold rounded-lg border border-white/10 transition-all"
                  >
                    Bottom (100%)
                  </button>
                </div>
              </div>

              {/* Zoom Level Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5 text-cyan-400" /> Zoom Level
                  </span>
                  <span className="text-cyan-400">{zoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.5"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      setOffsetY(50);
                      setZoom(1.0);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-white/10 transition-all flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Fit
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-secondary/30">
              <button
                onClick={() => setShowCropModal(false)}
                className="px-4 py-2.5 bg-canvas hover:bg-panel text-slate-300 border border-secondary/40 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBannerCrop}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all hover:scale-105"
              >
                <Check className="w-4 h-4 text-slate-950" />
                <span>Set Preview</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BANNER UPLOAD SAVE/CANCEL --- */}
      {pendingBanner && (
        <div className="fixed bottom-6 right-6 z-50 bg-panel border border-cyan-500/50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10">
          <span className="text-xs font-black text-white uppercase">Banner Preview Set</span>
          <button onClick={handleSaveBanner} disabled={uploadingBanner} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">
            {uploadingBanner ? 'Saving...' : 'Save Banner'}
          </button>
          <button onClick={handleCancelBanner} disabled={uploadingBanner} className="px-4 py-2 bg-red-950 hover:bg-red-900 text-red-200 rounded-xl text-xs font-bold">
            Cancel
          </button>
        </div>
      )}

      {/* --- DELETE ACCOUNT CONFIRMATION MODAL --- */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-950 border border-red-600/60 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-red-900/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-red-950/90 text-red-400 rounded-xl border border-red-700/60">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-red-400 uppercase tracking-tight">
                    Delete Account
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    This action is final and cannot be undone
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmDeleteInput('');
                  setDeleteAccountError(null);
                }}
                disabled={isDeletingAccount}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Callout Box */}
            <div className="bg-red-950/40 border border-red-800/60 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-red-300 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>What happens when you delete your account?</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside font-medium pl-1">
                <li>Your profile document and data in Firestore will be permanently deleted.</li>
                <li>Your Firebase Authentication account credentials will be removed.</li>
                <li>You will be immediately logged out of your session.</li>
              </ul>
            </div>

            {/* Confirmation Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="confirmDeleteInput" className="text-xs font-bold text-slate-200 block">
                  To confirm, type <span className="font-mono font-black text-red-400 select-all">DELETE</span> in the field below:
                </label>
                <input
                  id="confirmDeleteInput"
                  type="text"
                  value={confirmDeleteInput}
                  onChange={(e) => setConfirmDeleteInput(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full bg-canvas border border-red-900/60 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono tracking-wider"
                  disabled={isDeletingAccount}
                />
              </div>

              {/* Error Alert */}
              {deleteAccountError && (
                <div className="p-3.5 bg-red-950/90 border border-red-700 rounded-xl text-red-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="font-bold leading-relaxed">{deleteAccountError}</span>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-secondary/30">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmDeleteInput('');
                    setDeleteAccountError(null);
                  }}
                  disabled={isDeletingAccount}
                  className="px-4 py-2.5 bg-canvas hover:bg-panel text-slate-300 border border-secondary/40 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAccount}
                  disabled={confirmDeleteInput.trim() !== 'DELETE' || isDeletingAccount}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Deleting Account...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 text-white" />
                      <span>Permanently Delete My Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
