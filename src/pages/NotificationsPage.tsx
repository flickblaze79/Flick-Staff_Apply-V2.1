import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationItem,
  fetchNotificationsFromFirestore,
  addNotification,
} from '../lib/storage';
import { NotificationItem } from '../types';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Loader2,
  Sparkles,
  Sliders,
  Globe,
  Monitor,
  ExternalLink,
  Shield,
  FileText,
  MessageCircle,
  Crown,
  RefreshCw,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { currentUser, userProfile, updateNotificationPreference } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Browser Notification States
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [browserNotificationsActive, setBrowserNotificationsActive] = useState(false);
  const [browserMessage, setBrowserMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [requestingBrowser, setRequestingBrowser] = useState(false);

  // Website Notifications State (Persisted in Firestore userProfile)
  const websiteNotificationsActive = userProfile?.notificationsEnabled ?? true;
  const [savingWebsiteNotif, setSavingWebsiteNotif] = useState(false);
  const [websiteMessage, setWebsiteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const savingTimeoutRef = useRef<number | null>(null);

  // Detect browser permission automatically on mount
  useEffect(() => {
    checkBrowserNotificationStatus();
  }, []);

  const checkBrowserNotificationStatus = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported');
      setBrowserNotificationsActive(false);
      return;
    }

    const currentPerm = Notification.permission;
    setBrowserPermission(currentPerm);

    // CRITICAL: Never display ON when browser permission is not granted!
    if (currentPerm === 'granted') {
      const storedPref = localStorage.getItem('flick_browser_notifications');
      // If user explicitly turned it off in website, respect that; otherwise enabled
      setBrowserNotificationsActive(storedPref !== 'false');
    } else {
      setBrowserNotificationsActive(false);
      if (currentPerm === 'denied') {
        localStorage.setItem('flick_browser_notifications', 'false');
      }
    }
  };

  // Fetch notifications for current user from Firestore and local store
  useEffect(() => {
    async function loadNotifications() {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // Try fetching live notifications from Firestore
        const notifs = await fetchNotificationsFromFirestore(currentUser.uid);
        
        // If empty, auto-seed a welcome notification so the user has something to interact with
        if (notifs.length === 0) {
          const welcomeNotif = await addNotification({
            recipientUid: currentUser.uid,
            title: 'Welcome to Flick Staff Apply V2.1',
            message: 'Your notification center is active. Updates about your staff applications and reports will appear here.',
            type: 'system',
            read: false,
            createdAt: new Date().toISOString(),
          });
          setNotifications([welcomeNotif]);
        } else {
          setNotifications(notifs);
        }
      } catch (err) {
        console.warn('Notifications fetch notice:', err);
        const fallback = getNotifications(currentUser.uid);
        setNotifications(fallback);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [currentUser]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (savingTimeoutRef.current) {
        window.clearTimeout(savingTimeoutRef.current);
      }
    };
  }, []);

  // --- 1. BROWSER NOTIFICATIONS TOGGLE HANDLER ---
  const handleToggleBrowserNotifications = async () => {
    setBrowserMessage(null);

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported');
      setBrowserNotificationsActive(false);
      setBrowserMessage({
        type: 'error',
        text: 'Browser notifications are not supported in your current browser or context.',
      });
      return;
    }

    // If currently ON, turning OFF
    if (browserNotificationsActive) {
      localStorage.setItem('flick_browser_notifications', 'false');
      setBrowserNotificationsActive(false);
      setBrowserMessage({
        type: 'info',
        text: 'Website browser alerts turned OFF. (Browser permissions can be reset in Chrome settings).',
      });
      return;
    }

    // Turning ON
    const currentPerm = Notification.permission;

    if (currentPerm === 'denied') {
      setBrowserNotificationsActive(false);
      setBrowserPermission('denied');
      setBrowserMessage({
        type: 'error',
        text: 'Notifications are blocked in your browser settings. To enable: click the Lock / Tune icon in your Chrome address bar, set Notifications to "Allow", and refresh this page.',
      });
      return;
    }

    if (currentPerm === 'granted') {
      localStorage.setItem('flick_browser_notifications', 'true');
      setBrowserNotificationsActive(true);
      setBrowserPermission('granted');
      sendTestBrowserNotification('Browser notifications are enabled for Flick Staff Apply V2.1!');
      setBrowserMessage({
        type: 'success',
        text: 'Browser notifications successfully enabled and confirmed!',
      });
      return;
    }

    // If permission is 'default', request directly from this user gesture
    try {
      setRequestingBrowser(true);
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);

      if (perm === 'granted') {
        localStorage.setItem('flick_browser_notifications', 'true');
        setBrowserNotificationsActive(true);
        sendTestBrowserNotification('Browser notifications enabled! You will receive system alerts here.');
        setBrowserMessage({
          type: 'success',
          text: 'Browser notification permission granted!',
        });
      } else if (perm === 'denied') {
        localStorage.setItem('flick_browser_notifications', 'false');
        setBrowserNotificationsActive(false);
        setBrowserMessage({
          type: 'error',
          text: 'Notification permission was denied. You can change this anytime in Chrome Site Settings.',
        });
      } else {
        // Dismissed prompt
        localStorage.setItem('flick_browser_notifications', 'false');
        setBrowserNotificationsActive(false);
        setBrowserMessage({
          type: 'info',
          text: 'Permission request was closed without granting.',
        });
      }
    } catch (err: any) {
      console.warn('Notification permission request notice:', err);
      setBrowserMessage({
        type: 'error',
        text: err?.message || 'Failed to request notification permission.',
      });
    } finally {
      setRequestingBrowser(false);
    }
  };

  const sendTestBrowserNotification = (bodyText: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Flick Staff Apply V2.1', {
          body: bodyText,
          icon: `${import.meta.env.BASE_URL}flick-logo.png`,
        });
      } catch (err) {
        console.warn('Notice sending test notification:', err);
      }
    }
  };

  // --- 2. WEBSITE NOTIFICATIONS TOGGLE HANDLER (FIRESTORE) ---
  const handleToggleWebsiteNotifications = async () => {
    if (!currentUser || !userProfile) return;
    setWebsiteMessage(null);
    setSavingWebsiteNotif(true);

    const newPreference = !websiteNotificationsActive;

    // Safety timeout to avoid infinite loading if Firestore is temporarily offline
    if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    savingTimeoutRef.current = window.setTimeout(() => {
      setSavingWebsiteNotif(false);
      setWebsiteMessage({
        type: 'error',
        text: 'Save timed out. Changes cached locally until Firestore reconnects.',
      });
    }, 6000);

    try {
      await updateNotificationPreference(newPreference);
      if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
      setSavingWebsiteNotif(false);
      setWebsiteMessage({
        type: 'success',
        text: `In-website notifications turned ${newPreference ? 'ON' : 'OFF'} and saved to your profile!`,
      });
    } catch (err: any) {
      if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
      setSavingWebsiteNotif(false);
      setWebsiteMessage({
        type: 'error',
        text: err?.message || 'Failed to save preference to Firestore.',
      });
    }
  };

  // --- 3. NOTIFICATION ACTIONS ---
  const handleMarkAsRead = async (id?: string) => {
    if (!id) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await markNotificationAsRead(id);
  };

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsAsRead(currentUser.uid);
  };

  const handleDeleteNotification = async (id?: string) => {
    if (!id) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotificationItem(id);
  };

  const handleSendTestNotification = async () => {
    if (!currentUser) return;
    const testTypes: NotificationItem['type'][] = ['application', 'report', 'system', 'role'];
    const chosenType = testTypes[Math.floor(Math.random() * testTypes.length)];

    const titles: Record<NotificationItem['type'], string> = {
      application: 'Staff Application Update',
      report: 'Community Safety Report Logged',
      system: 'Flick Security Alert',
      role: 'Staff Credentials Verified',
    };

    const messages: Record<NotificationItem['type'], string> = {
      application: 'Your application for the Flick staff team is currently under active review by the leadership team.',
      report: 'A report ticket you submitted has been assigned to a moderator for priority investigation.',
      system: 'Flick Staff Apply V2.1 successfully verified your secure session tokens.',
      role: 'Your account permissions and staff privileges have been refreshed and confirmed.',
    };

    const newNotif = await addNotification({
      recipientUid: currentUser.uid,
      title: titles[chosenType],
      message: messages[chosenType],
      type: chosenType,
      read: false,
      createdAt: new Date().toISOString(),
    });

    setNotifications((prev) => [newNotif, ...prev]);

    // Also fire a browser notification if active
    if (browserNotificationsActive && browserPermission === 'granted') {
      sendTestBrowserNotification(`${titles[chosenType]}: ${messages[chosenType]}`);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="p-4 bg-panel border border-secondary/30 rounded-3xl inline-block">
          <Bell className="w-10 h-10 text-cyan-400 mx-auto" />
        </div>
        <h2 className="text-xl font-black text-white uppercase">Authentication Required</h2>
        <p className="text-xs text-slate-300 font-bold">
          Please sign in to view your notification inbox and manage alert settings.
        </p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 text-white">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-secondary/20 pb-6">
        <div className="space-y-1">
          <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-cyan-400" />
            Alerts & Activity Stream
          </span>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">
            Notification Center
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-panel border border-secondary/30 rounded-xl text-xs font-bold text-slate-300">
            <span className="text-slate-400">Total:</span>
            <span className="font-mono text-white font-black">{notifications.length}</span>
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-950/80 border border-cyan-500/40 rounded-xl text-xs font-black text-cyan-300 animate-pulse">
              <span>{unreadCount} Unread</span>
            </div>
          )}
        </div>
      </div>

      {/* --- SECTION 1: NOTIFICATION CONTROLS & SETTINGS (BROWSER & WEBSITE) --- */}
      <div className="bg-panel border border-secondary/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-secondary/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl">
              <Sliders className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Notification Preferences
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Configure browser-level push alerts and in-website activity notifications
              </p>
            </div>
          </div>
        </div>

        {/* Toggles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Browser Notifications */}
          <div className="bg-canvas/80 border border-secondary/30 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Monitor className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Browser Notifications
                  </span>
                </div>

                {/* Permission Badge based on real Notification.permission */}
                {browserPermission === 'granted' && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Granted
                  </span>
                )}
                {browserPermission === 'default' && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Not Requested
                  </span>
                )}
                {browserPermission === 'denied' && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    Blocked
                  </span>
                )}
                {browserPermission === 'unsupported' && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    Unsupported
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Receive desktop or system banner notifications when new reports are logged or applications are reviewed.
              </p>
            </div>

            {/* Toggle switch for Browser Notifications */}
            <div className="pt-3 border-t border-secondary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">Status:</span>
                <span
                  className={`text-xs font-black uppercase ${
                    browserNotificationsActive ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {browserNotificationsActive ? 'ON' : 'OFF'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleToggleBrowserNotifications}
                disabled={requestingBrowser || browserPermission === 'unsupported'}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/50 ${
                  browserNotificationsActive ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-slate-800'
                } ${browserPermission === 'unsupported' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                aria-label="Toggle Browser Notifications"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                    browserNotificationsActive ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Card 2: Website Notifications (Firestore Persisted) */}
          <div className="bg-canvas/80 border border-secondary/30 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Website Notifications
                  </span>
                </div>

                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-indigo-400" />
                  Firestore Sync
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Store and display in-app activity notifications inside the Flick portal, linked to your Firebase user UID.
              </p>
            </div>

            {/* Toggle switch for Website Notifications */}
            <div className="pt-3 border-t border-secondary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">Status:</span>
                {savingWebsiteNotif ? (
                  <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </span>
                ) : (
                  <span
                    className={`text-xs font-black uppercase ${
                      websiteNotificationsActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {websiteNotificationsActive ? 'ON' : 'OFF'}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleWebsiteNotifications}
                disabled={savingWebsiteNotif}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400/50 ${
                  websiteNotificationsActive ? 'bg-gradient-to-r from-indigo-500 to-cyan-500' : 'bg-slate-800'
                } ${savingWebsiteNotif ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                aria-label="Toggle Website Notifications"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                    websiteNotificationsActive ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Browser Feedback Alert Banner */}
        {browserMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
              browserMessage.type === 'error'
                ? 'bg-red-950/80 border-red-700/80 text-red-200'
                : browserMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-200'
                : 'bg-cyan-950/80 border-cyan-700/80 text-cyan-200'
            }`}
          >
            {browserMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : browserMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <span className="font-semibold leading-relaxed">{browserMessage.text}</span>
          </div>
        )}

        {/* Website Feedback Alert Banner */}
        {websiteMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
              websiteMessage.type === 'error'
                ? 'bg-red-950/80 border-red-700/80 text-red-200'
                : 'bg-emerald-950/80 border-emerald-700/80 text-emerald-200'
            }`}
          >
            {websiteMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <span className="font-semibold leading-relaxed">{websiteMessage.text}</span>
          </div>
        )}
      </div>

      {/* --- SECTION 2: NOTIFICATION CENTER INBOX & FEED --- */}
      <div className="space-y-4">
        {/* Feed Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-panel p-1 rounded-2xl border border-secondary/30">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                filter === 'all'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                filter === 'unread'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 px-3 py-2 bg-panel hover:bg-canvas text-cyan-300 hover:text-cyan-200 border border-secondary/30 hover:border-cyan-400/40 rounded-xl text-xs font-bold transition-all"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>
            )}

            <button
              onClick={handleSendTestNotification}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-primary/30 to-cyan-500/30 hover:from-primary/50 hover:to-cyan-500/50 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all"
              title="Generate a test system notification"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Send Test Alert</span>
            </button>
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center space-y-3">
            <Loader2 className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400">Loading your notification feed...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 bg-canvas/80 border border-secondary/40 rounded-2xl flex items-center justify-center mx-auto text-cyan-400">
              <Bell className="w-7 h-7 text-cyan-400 opacity-60" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {filter === 'unread' ? 'No unread notifications' : 'Your inbox is clear'}
              </h3>
              <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                {filter === 'unread'
                  ? 'All notifications have been marked as read. Check the "All" tab to view past alerts.'
                  : 'You have no system notifications right now. Click "Send Test Alert" to test the system.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredNotifications.map((n) => {
                const isApplication = n.type === 'application';
                const isReport = n.type === 'report';
                const isRole = n.type === 'role';

                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                      n.read
                        ? 'bg-canvas/70 border-secondary/20 text-slate-300'
                        : 'bg-panel border-cyan-400/50 text-white shadow-xl shadow-cyan-950/20'
                    }`}
                  >
                    {/* Left Icon */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                          isApplication
                            ? 'bg-blue-950/80 text-cyan-400 border-cyan-500/30'
                            : isReport
                            ? 'bg-amber-950/80 text-amber-400 border-amber-500/30'
                            : isRole
                            ? 'bg-purple-950/80 text-purple-400 border-purple-500/30'
                            : 'bg-indigo-950/80 text-indigo-400 border-indigo-500/30'
                        }`}
                      >
                        {isApplication && <FileText className="w-4 h-4" />}
                        {isReport && <MessageCircle className="w-4 h-4" />}
                        {isRole && <Crown className="w-4 h-4" />}
                        {!isApplication && !isReport && !isRole && <Bell className="w-4 h-4" />}
                      </div>

                      {/* Content */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white truncate">
                            {n.title}
                          </span>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono block pt-1">
                          {new Date(n.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!n.read && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          className="p-2 text-xs text-cyan-300 hover:text-white bg-slate-900/60 hover:bg-cyan-950 rounded-xl transition-colors border border-cyan-400/30"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteNotification(n.id)}
                        className="p-2 text-xs text-slate-400 hover:text-red-400 bg-slate-900/60 hover:bg-red-950/40 rounded-xl transition-colors border border-secondary/20"
                        title="Delete notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
