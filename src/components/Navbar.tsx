import React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { getNotifications } from '../lib/storage';

import {
  Home,
  FileText,
  ClipboardList,
  MessageSquare,
  User,
  LogOut,
  Bell,
  Menu,
  MessageCircle,
  Shield,
  Hammer,
  Settings,
  Crown
} from 'lucide-react';
import { FlickLogo } from './FlickLogo';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenAuth: () => void;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate, onOpenAuth, onToggleSidebar }) => {
  const { currentUser, userProfile, isStaff, isMod, isAdmin, isOwner, requestSignOut } = useAuth();
  
  const unreadNotifCount = currentUser
    ? getNotifications(currentUser.uid).filter((n) => !n.read).length
    : 0;

  const DISCORD_URL = 'https://discord.gg/BRDwvqbFf';

  const handleNavClick = (page: string) => {
    onNavigate(page);
  };

  const handleDiscordClick = () => {
    window.open(DISCORD_URL, '_blank', 'noopener,noreferrer');
  };

  const mainNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'apply', label: 'Apply Now', icon: FileText },
    { id: 'status', label: 'Your Application', icon: ClipboardList },
    { id: 'reports', label: 'Report', icon: MessageCircle },
    { id: 'account', label: 'Account', icon: User },
  ];

  // Authorized panel entry for navbar (also present in hamburger menu)
  const panelNavItems = [
    ...(isOwner ? [{ id: 'owner-panel', label: 'Owner Panel', icon: Crown }] :
       isAdmin ? [{ id: 'admin-panel', label: 'Admin Panel', icon: Settings }] :
       isMod ? [{ id: 'mod-panel', label: 'Moderator Panel', icon: Hammer }] :
       isStaff ? [{ id: 'staff-panel', label: 'Staff Panel', icon: Shield }] : [])
  ];

  return (
    <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-md border-b border-secondary/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            {/* Three-line Hamburger Menu Button */}
            <button
              onClick={onToggleSidebar}
              className="p-2.5 rounded-xl text-white hover:text-cyan-300 bg-panel hover:bg-panel/80 border border-secondary/30 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-secondary/50"
              title="Open Navigation Menu"
            >
              <Menu className="w-6 h-6 text-cyan-400" />
            </button>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={() => handleNavClick('home')}
            >
              <FlickLogo size="sm" showText={true} />
            </motion.div>
          </div>

          {/* Desktop Links */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-lg shadow-primary/30 border border-cyan-400/50'
                      : 'text-white hover:text-cyan-300 hover:bg-panel/60 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span>{item.label}</span>
                </motion.button>
              );
            })}

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleDiscordClick}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-300 hover:text-white hover:bg-indigo-900/40 border border-indigo-500/40 transition-all"
            >
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Join Discord</span>
            </motion.button>

            {/* Render authorized panel link if accessible */}
            {panelNavItems.map((panel) => {
              const Icon = panel.icon;
              const isActive = currentPage === panel.id;
              return (
                <motion.button
                  key={panel.id}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleNavClick(panel.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg border border-cyan-300/80'
                      : 'bg-panel text-cyan-300 hover:text-white hover:bg-primary/30 border border-secondary/40'
                  }`}
                >
                  <Icon className="w-4 h-4 text-amber-300" />
                  <span>{panel.label}</span>
                </motion.button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleNavClick('notifications')}
                  className="p-2.5 rounded-xl text-white hover:text-cyan-300 bg-panel hover:bg-panel/80 border border-secondary/20 transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4 text-cyan-400" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-[9px] font-black text-white rounded-full flex items-center justify-center animate-pulse shadow-md shadow-red-600/50">
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </span>
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNavClick('account')}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-panel border border-secondary/30 hover:border-cyan-400/60 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg overflow-hidden bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center font-black text-xs text-white shadow-sm shrink-0 border border-cyan-400/30">
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt={userProfile.name} className="w-full h-full object-cover" />
                    ) : (
                      userProfile?.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-white leading-tight">
                      {userProfile?.name || 'Account'}
                    </span>
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest leading-none mt-0.5">
                      {userProfile?.role || 'USER'}
                    </span>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={requestSignOut}
                  className="p-2.5 rounded-xl text-muted hover:text-amber-400 bg-panel hover:bg-amber-950/30 border border-secondary/20 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onOpenAuth}
                className="bg-gradient-to-r from-primary to-secondary hover:from-blue-600 hover:to-cyan-400 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-primary/30 uppercase tracking-wider"
              >
                Sign In / Register
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
