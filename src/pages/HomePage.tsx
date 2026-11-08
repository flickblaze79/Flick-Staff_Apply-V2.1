import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { getApplications, getSystemSettings } from '../lib/storage';
import { ApplicationCategory, SystemSettings } from '../types';
import {
  Shield,
  Users,
  Award,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Sparkles,
  FileCheck,
  UserCheck,
  Code,
  Hammer,
  HelpCircle,
  FileText
} from 'lucide-react';
import { FlickLogo } from '../components/FlickLogo';

interface HomePageProps {
  onNavigate: (page: string, category?: ApplicationCategory) => void;
  onOpenAuth: () => void;
  isAuthenticated: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onOpenAuth, isAuthenticated }) => {
  const [stats, setStats] = useState({
    totalApplications: 0,
    acceptedStaff: 0,
    pendingReviews: 0,
    activePositions: 0,
  });
  const [loadingStats, setStatusLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const DISCORD_URL = 'https://discord.gg/BRDwvqbFf';

  useEffect(() => {
    async function loadRealStats() {
      setStatusLoading(true);
      try {
        const { fetchGlobalStats, fetchSystemSettings } = await import('../lib/storage');
        
        const [liveStats, sysSettings] = await Promise.all([
          fetchGlobalStats(),
          fetchSystemSettings()
        ]);

        setSettings(sysSettings);
        
        setStats({
          totalApplications: liveStats.pendingApps + liveStats.underReviewApps + liveStats.acceptedApps + liveStats.rejectedApps,
          acceptedStaff: liveStats.acceptedApps,
          pendingReviews: liveStats.pendingApps + liveStats.underReviewApps,
          activePositions: Object.values(sysSettings.categoryToggles || {}).filter(v => v).length,
        });
      } catch (err) {
        console.warn('Live stats fetch notice:', err);
      } finally {
        setStatusLoading(false);
      }
    }
    loadRealStats();
  }, []);

  const categories: {
    title: ApplicationCategory;
    icon: any;
    color: string;
    description: string;
    requirements: string[];
  }[] = [
    {
      title: 'Developer Apply',
      icon: Code,
      color: 'from-blue-600 to-indigo-600',
      description: 'Build and maintain our web applications, optimize server infrastructure, and code custom features.',
      requirements: ['Programming Experience', 'GitHub / Portfolio', 'Problem-Solving Mindset'],
    },
    {
      title: 'Staff Apply',
      icon: Shield,
      color: 'from-blue-500 to-cyan-500',
      description: 'General staff operations, ticket management, event organization, and supporting players daily.',
      requirements: ['Proven Track Record', 'Active Communication', 'Team Leadership Mindset'],
    },
    {
      title: 'Moderator Apply',
      icon: Hammer,
      color: 'from-cyan-500 to-blue-600',
      description: 'Community oversight, enforcing server guidelines fairly, resolving disputes, and investigating reports.',
      requirements: ['Min. Age: 15+', 'Impartial Judgement', 'De-escalation Skills'],
    },
    {
      title: 'Helper Apply',
      icon: HelpCircle,
      color: 'from-sky-400 to-blue-500',
      description: 'Welcome new community members, answer player questions, and guide new users across our platforms.',
      requirements: ['Min. Age: 14+', 'Active on Discord', 'Friendly & Patient Attitude'],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-16 py-6 text-main"
    >
      {/* HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl bg-panel border border-secondary/30 p-8 sm:p-12 lg:p-16 text-center shadow-2xl">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-primary/30 via-secondary/15 to-transparent blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          {/* Logo Crest */}
          <FlickLogo size="2xl" showText={false} className="mb-4" />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/25 border border-cyan-400/40 text-cyan-300 text-xs font-black uppercase tracking-widest shadow-inner"
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span>Official Portal — Flick Staff Apply V2.1</span>
          </motion.div>

          <motion.h1
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter uppercase italic leading-none flex flex-col items-center justify-center gap-1 sm:gap-2"
          >
            <span className="text-white drop-shadow-lg">FLICK</span>
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent drop-shadow-md">STAFF APPLY</span>
            <span className="text-secondary opacity-90 text-2xl sm:text-3xl tracking-[0.3em] font-black -mt-1">V2</span>
          </motion.h1>

          <motion.p
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-lg sm:text-xl text-slate-200 font-medium leading-relaxed max-w-2xl mx-auto"
          >
            Join the official team, protect our community, assist players, and shape the future of Flick.
          </motion.p>

          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (!isAuthenticated) {
                  onOpenAuth();
                } else {
                  onNavigate('apply');
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-gradient-to-r from-primary to-secondary hover:from-blue-600 hover:to-cyan-400 text-white font-black text-base uppercase tracking-wider rounded-2xl shadow-xl shadow-primary/30 transition-all border border-cyan-300/40"
            >
              <FileText className="w-5 h-5 text-white" />
              <span>Apply Now</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>

            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-panel hover:bg-secondary/15 text-cyan-300 border border-secondary/50 font-black text-base rounded-2xl transition-all uppercase tracking-wider"
            >
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              <span>Join Discord</span>
            </motion.a>
          </motion.div>
        </div>

        {/* REAL STATISTICS DISPLAY */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12 pt-8 border-t border-secondary/20 text-left max-w-4xl mx-auto">
          <motion.div whileHover={{ y: -3 }} className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl">
            <div className="text-slate-300 text-xs font-bold uppercase tracking-wider">Total Submissions</div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {loadingStats ? '...' : stats.totalApplications}
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -3 }} className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl">
            <div className="text-slate-300 text-xs font-bold uppercase tracking-wider">Accepted Staff</div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
              {loadingStats ? '...' : stats.acceptedStaff}
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -3 }} className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl">
            <div className="text-slate-300 text-xs font-bold uppercase tracking-wider">Pending / Under Review</div>
            <div className="text-2xl sm:text-3xl font-black text-cyan-400 mt-1">
              {loadingStats ? '...' : stats.pendingReviews}
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -3 }} className="bg-canvas/80 border border-secondary/30 p-4 rounded-2xl">
            <div className="text-slate-300 text-xs font-bold uppercase tracking-wider">Active Categories</div>
            <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
              {stats.activePositions}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOUR APPLICATION CATEGORIES SECTION */}
      <section className="space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">
            Recruitment Openings
          </span>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">
            Application Categories
          </h2>
          <p className="text-sm text-slate-300">
            Select a category below to view detailed requirements and submit your application.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.filter(cat => settings?.categoryToggles?.[cat.title] !== false).map((cat) => {
            const Icon = cat.icon;
            return (
              <motion.div
                key={cat.title}
                whileHover={{ y: -6 }}
                className="bg-panel border border-secondary/30 p-6 rounded-3xl flex flex-col justify-between space-y-5 hover:border-cyan-400/60 transition-colors shadow-xl relative overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-2xl bg-primary/20 border border-cyan-400/30 text-cyan-300">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-full uppercase">
                      Open Now
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mt-2 font-medium">
                      {cat.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-secondary/20">
                    <div className="text-[11px] font-black text-cyan-300 uppercase tracking-wider">
                      Prerequisites:
                    </div>
                    {cat.requirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (!isAuthenticated) {
                      onOpenAuth();
                    } else {
                      onNavigate('apply', cat.title);
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-primary to-secondary hover:from-blue-600 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all text-center shadow-md shadow-primary/20"
                >
                  Apply for {cat.title.replace(' Apply', '')}
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ABOUT THE TEAM */}
      <section className="space-y-6">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">
            About The Staff Team
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Our staff works around the clock to provide a safe, respectful, and engaging environment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div whileHover={{ y: -4 }} className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-3 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white uppercase">Community Protection</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Enforce server rules fairly, prevent harassment or malicious behavior, and maintain community safety across all platforms.
            </p>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-3 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white uppercase">Member Support</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Assist members with technical questions, answer support tickets, resolve player disputes, and host events.
            </p>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-3 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white uppercase">Growth & Leadership</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Gain real team leadership experience, unlock internal staff ranks, and build a solid moderation portfolio.
            </p>
          </motion.div>
        </div>
      </section>

      {/* REQUIREMENTS & PROCESS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div whileHover={{ y: -3 }} className="bg-panel border border-secondary/30 p-6 sm:p-8 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/20 border border-cyan-400/30 text-cyan-300">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white uppercase">General Staff Requirements</h3>
          </div>
          <ul className="space-y-3 text-xs text-slate-200 font-medium">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>Must be an active member of the Flick community with a clean record.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>Possess strong command of written English and clear communication habits.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>Demonstrate emotional maturity, impartiality, and discretion under pressure.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>Working Discord account with Two-Factor Authentication (2FA) enabled.</span>
            </li>
          </ul>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-panel border border-secondary/30 p-6 sm:p-8 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/20 border border-cyan-400/30 text-cyan-300">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white uppercase">Application Process</h3>
          </div>
          <ol className="space-y-4 text-xs text-slate-200 font-medium">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-white font-black flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <strong className="text-white block font-bold text-sm">Select Category & Submit Form</strong>
                Choose among Developer, Staff, Moderator, or Helper Apply and complete all required questions.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-white font-black flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <strong className="text-white block font-bold text-sm">Review & 48-Hour Decision Window</strong>
                Authorized team members review your answers. Applications older than 48 hours without decision are auto-processed.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-white font-black flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <strong className="text-white block font-bold text-sm">Live Result Tracking</strong>
                Track your live application status under "Your Application" and receive direct decision notifications.
              </div>
            </li>
          </ol>
        </motion.div>
      </section>
    </motion.div>
  );
};
