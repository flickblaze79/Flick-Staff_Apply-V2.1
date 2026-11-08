import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { CustomPanel } from '../types';
import { subscribeToCustomPanels } from '../lib/storage';
import {
  X,
  MessageSquare,
  Home,
  FileText,
  ClipboardList,
  MessageCircle,
  User,
  Crown,
  Settings,
  Hammer,
  Shield,
  Bell,
  LogOut,
  Sparkles
} from 'lucide-react';
import { FlickLogo } from './FlickLogo';


interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentPage, onNavigate }) => {
  const { currentUser, userProfile, isStaff, isMod, isAdmin, isOwner, requestSignOut } = useAuth();
  const [customPanels, setCustomPanels] = useState<CustomPanel[]>([]);
  const DISCORD_URL = 'https://discord.gg/BRDwvqbFf';

  useEffect(() => {
    const unsub = subscribeToCustomPanels((panels) => {
      setCustomPanels(panels);
    });
    return () => unsub();
  }, []);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'apply', label: 'Apply Now', icon: FileText },
    { id: 'status', label: 'Your Application', icon: ClipboardList },
    { id: 'reports', label: 'Report', icon: MessageCircle },
    { id: 'account', label: 'Account', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'discord', label: 'Join Discord', icon: MessageSquare },
  ];

  // Role-based panel entries inside hamburger menu
  const panelItems = [
    ...(isOwner ? [{ id: 'owner-panel', label: 'Owner Panel', icon: Crown, color: 'text-amber-400', badge: 'OWNER' }] : []),
    ...(isAdmin ? [{ id: 'admin-panel', label: 'Admin Panel', icon: Settings, color: 'text-purple-400', badge: 'ADMIN' }] : []),
    ...(isMod ? [{ id: 'mod-panel', label: 'Moderator Panel', icon: Hammer, color: 'text-emerald-400', badge: 'MOD' }] : []),
    ...(isStaff ? [{ id: 'staff-panel', label: 'Staff Panel', icon: Shield, color: 'text-cyan-400', badge: 'STAFF' }] : []),
  ];

  // Custom panels matching user's role and visibility, ordered by sidebarOrder
  const accessibleCustomPanels = customPanels
    .filter((p) => {
      if (p.visibility === 'hidden') {
        return isOwner;
      }
      if (p.visibility === 'public') {
        return true;
      }
      if (isOwner) return true;
      const userRole = (userProfile?.role || 'USER').toUpperCase();
      const assigned = (p.assignedRole || '').toUpperCase();
      return userRole === assigned || (isStaff && assigned === 'STAFF') || (isMod && assigned === 'MOD') || (isAdmin && assigned === 'ADMIN');
    })
    .sort((a, b) => (a.sidebarOrder ?? 99) - (b.sidebarOrder ?? 99));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />

          {/* Hamburger Drawer */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 left-0 h-full w-80 bg-panel border-r border-secondary/30 z-50 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto"
          >
            <div className="space-y-6">
              {/* Header with Close Button */}
              <div className="flex items-center justify-between border-b border-secondary/20 pb-4">
                <FlickLogo size="md" showText={true} />

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-canvas text-white hover:text-cyan-400 border border-secondary/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Authorized User Profile Badge */}
              {currentUser && (
                <div className="bg-canvas/80 p-3.5 rounded-2xl border border-secondary/30 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center font-black text-sm text-white shadow-md shrink-0 border border-cyan-400/30">
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt={userProfile.name} className="w-full h-full object-cover" />
                    ) : (
                      userProfile?.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-xs font-bold text-white truncate">
                      {userProfile?.name || 'User Account'}
                    </span>
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest leading-none mt-0.5">
                      {userProfile?.role || 'USER'}
                    </span>
                  </div>
                </div>
              )}

              {/* Main Navigation Items */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">
                  Navigation Menu
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (item.id === 'discord') {
                          window.open(DISCORD_URL, '_blank', 'noopener,noreferrer');
                        } else {
                          onNavigate(item.id);
                        }
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left ${
                        isActive
                          ? 'bg-primary text-white shadow-md shadow-primary/30 border border-cyan-400/50'
                          : 'text-white hover:text-cyan-300 hover:bg-canvas/60 border border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Authorized Panels Section in Hamburger Menu */}
              {panelItems.length > 0 && (
                <div className="pt-4 border-t border-secondary/20 space-y-2">
                  <div className="text-[10px] font-black text-amber-300 uppercase tracking-widest px-3 mb-2 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                    <span>Authorized Staff Panels</span>
                  </div>
                  {panelItems.map((panel) => {
                    const Icon = panel.icon;
                    const isActive = currentPage === panel.id;
                    return (
                      <motion.button
                        key={panel.id}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          onNavigate(panel.id);
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg border border-cyan-300/80'
                            : 'bg-canvas text-white hover:bg-primary/20 border border-secondary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${panel.color}`} />
                          <span className="text-white">{panel.label}</span>
                        </div>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-panel/80 text-cyan-300 border border-cyan-500/30 uppercase">
                          {panel.badge}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Custom Panels Created by Owner */}
              {accessibleCustomPanels.length > 0 && (
                <div className="pt-4 border-t border-secondary/20 space-y-2">
                  <div className="text-[10px] font-black text-cyan-300 uppercase tracking-widest px-3 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Custom Role Panels</span>
                  </div>
                  {accessibleCustomPanels.map((panel) => {
                    const navId = `custom-panel:${panel.id}`;
                    const isActive = currentPage === navId;
                    return (
                      <motion.button
                        key={panel.id}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          onNavigate(navId);
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg border border-cyan-300/80'
                            : 'bg-canvas text-white hover:bg-primary/20 border border-secondary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black border shrink-0"
                            style={{
                              backgroundColor: `${panel.color || '#06b6d4'}25`,
                              borderColor: `${panel.color || '#06b6d4'}50`,
                              color: panel.color || '#06b6d4',
                            }}
                          >
                            <Sparkles className="w-3 h-3" />
                          </div>
                          <span className="text-white truncate max-w-[130px] font-bold">{panel.name}</span>
                        </div>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-panel/80 text-cyan-300 border border-cyan-500/30 uppercase">
                          {panel.assignedRole}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="pt-6 border-t border-secondary/20 space-y-3">
              {currentUser ? (
                <button
                  onClick={() => {
                    onClose();
                    requestSignOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-amber-950/40 hover:bg-red-900/60 text-amber-200 hover:text-white font-extrabold text-xs uppercase tracking-wider rounded-xl border border-amber-800/40 hover:border-red-700/60 transition-all"
                  title="Sign Out of Flick"
                >
                  <LogOut className="w-4 h-4 text-amber-400" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onNavigate('home');
                    onClose();
                  }}
                  className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-primary/30"
                >
                  Sign In / Register
                </button>
              )}
              <div className="text-[10px] text-center text-slate-400 uppercase tracking-widest font-bold">
                Flick Staff Apply V2.1
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
