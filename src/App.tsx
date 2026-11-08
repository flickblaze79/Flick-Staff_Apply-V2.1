import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { ApplicationCategory, CustomPanel } from './types';
import { SplashScreen } from './components/SplashScreen';
import { AuthPage } from './components/AuthPage';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { auditAndFixOwnerRoles, subscribeToCustomPanels } from './lib/storage';
import { PageLoadingSkeleton } from './components/PageLoadingSkeleton';
import { ThemeProvider } from './context/ThemeContext';

// Code-Splitting: Lazy load heavy page chunks for fast initial load & low RAM footprint
const HomePage = React.lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const StaffApplyPage = React.lazy(() => import('./pages/StaffApplyPage').then(m => ({ default: m.StaffApplyPage })));
const ApplicationStatusPage = React.lazy(() => import('./pages/ApplicationStatusPage').then(m => ({ default: m.ApplicationStatusPage })));
const AccountPage = React.lazy(() => import('./pages/AccountPage').then(m => ({ default: m.AccountPage })));
const ReportPage = React.lazy(() => import('./pages/ReportPage').then(m => ({ default: m.ReportPage })));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));

const StaffPanel = React.lazy(() => import('./pages/panels/StaffPanel').then(m => ({ default: m.StaffPanel })));
const ModPanel = React.lazy(() => import('./pages/panels/ModPanel').then(m => ({ default: m.ModPanel })));
const AdminPanel = React.lazy(() => import('./pages/panels/AdminPanel').then(m => ({ default: m.AdminPanel })));
const OwnerPanel = React.lazy(() => import('./pages/panels/OwnerPanel').then(m => ({ default: m.OwnerPanel })));
const CustomPanelPage = React.lazy(() => import('./pages/panels/CustomPanelPage').then(m => ({ default: m.CustomPanelPage })));

function MainApp() {
  const { currentUser, loading, isStaff, isMod, isAdmin, isOwner } = useAuth();
  const { theme } = useTheme();
  const [customPanels, setCustomPanels] = useState<CustomPanel[]>([]);
  
  React.useEffect(() => {
    if (currentUser && isOwner) {
      auditAndFixOwnerRoles().then(count => {
        if (count > 0) console.log(`Removed ${count} unauthorized owner roles.`);
      });
    }

    const unsub = subscribeToCustomPanels((panels) => {
      setCustomPanels(panels);
    });
    return () => unsub();
  }, [currentUser, isOwner]);

  const [showSplash, setShowSplash] = useState(true);
  const [currentPage, setCurrentPage] = useState('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [guestBrowsing, setGuestBrowsing] = useState(false);
  const [applyCategory, setApplyCategory] = useState<ApplicationCategory | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = (page: string, category?: ApplicationCategory) => {
    setCurrentPage(page);
    setApplyCategory(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSidebarOpen(false);
  };

  const handleSplashComplete = React.useCallback(() => setShowSplash(false), []);

  // 1. SPLASH SCREEN DISPLAY (~2 SECONDS)
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // 2. AUTHENTICATION PAGE (if user is NOT logged in and hasn't chosen guest view)
  if (!loading && !currentUser && !guestBrowsing) {
    return (
      <AuthPage
        onSuccess={() => {
          setGuestBrowsing(false);
          setCurrentPage('home');
        }}
        onContinueAsGuest={() => setGuestBrowsing(true)}
      />
    );
  }

  // 3. MAIN WEBSITE PORTAL WITH PAGE TRANSITIONS

  return (
    <motion.div 
      key={theme}
      initial={{ opacity: 0.95 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen bg-canvas text-main flex flex-col font-sans selection:bg-primary selection:text-white"
    >
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />

      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
        <React.Suspense fallback={<PageLoadingSkeleton message="Loading portal page..." />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {currentPage === 'home' && (
                <HomePage
                  onNavigate={handleNavigate}
                  onOpenAuth={() => setAuthModalOpen(true)}
                  isAuthenticated={!!currentUser}
                />
              )}

              {currentPage === 'apply' && (
                <StaffApplyPage
                  onNavigate={handleNavigate}
                  onOpenAuth={() => setAuthModalOpen(true)}
                  defaultCategory={applyCategory}
                />
              )}

              {currentPage === 'status' && (
                <ApplicationStatusPage
                  onNavigate={handleNavigate}
                  onOpenAuth={() => setAuthModalOpen(true)}
                />
              )}

              {currentPage === 'account' && <AccountPage />}

              {currentPage === 'reports' && (
                <ReportPage onOpenAuth={() => setAuthModalOpen(true)} />
              )}

              {currentPage === 'notifications' && <NotificationsPage />}

              {/* Role-Based Authorized Panel Access */}
              {currentPage === 'staff-panel' && isStaff && <StaffPanel />}

              {currentPage === 'mod-panel' && isMod && <ModPanel />}

              {currentPage === 'admin-panel' && isAdmin && <AdminPanel />}

              {currentPage === 'owner-panel' && isOwner && <OwnerPanel />}

              {/* Custom Panel Dynamic Access */}
              {currentPage.startsWith('custom-panel:') && (
                (() => {
                  const targetId = currentPage.replace('custom-panel:', '');
                  const targetPanel = customPanels.find(p => p.id === targetId);
                  if (targetPanel) {
                    return <CustomPanelPage panel={targetPanel} onNavigate={handleNavigate} />;
                  }
                  return (
                    <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center text-slate-400 font-bold uppercase text-xs">
                      Custom panel not found or may have been removed by Owner.
                    </div>
                  );
                })()
              )}
            </motion.div>
          </AnimatePresence>
        </React.Suspense>
      </main>

      <Footer onNavigate={handleNavigate} />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </motion.div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
