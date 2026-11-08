import React from 'react';
import { MessageSquare, ShieldCheck, Heart } from 'lucide-react';
import { FlickLogo } from './FlickLogo';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const DISCORD_URL = 'https://discord.gg/BRDwvqbFf';

  return (
    <footer className="bg-panel border-t border-secondary/20 text-muted py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand info */}
        <div className="space-y-4 md:col-span-2">
          <FlickLogo size="md" showText={true} />

          <p className="text-xs text-muted max-w-sm leading-relaxed">
            Official staff application and community management portal for Flick Staff Apply V2.1. Join our team, support players, and shape the community.
          </p>
          <div className="flex items-center gap-2 text-xs text-secondary font-semibold bg-secondary/10 border border-secondary/20 px-3 py-1.5 rounded-lg w-fit">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure Role-Based Staff System</span>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-xs font-bold text-main uppercase tracking-wider mb-3">
            Quick Navigation
          </h3>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => onNavigate('home')} className="hover:text-main transition-colors">
                Home Dashboard
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('apply')} className="hover:text-white transition-colors">
                Apply for Staff
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('status')} className="hover:text-white transition-colors">
                Application Status
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('reports')} className="hover:text-white transition-colors">
                Submit Report
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('account')} className="hover:text-white transition-colors">
                My Account
              </button>
            </li>
          </ul>
        </div>

        {/* Community Links */}
        <div>
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-3">
            Community & Support
          </h3>
          <p className="text-xs text-zinc-400 mb-3">
            Connect with our moderation team and community on Discord.
          </p>
          <div className="space-y-3">
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Join Discord Server</span>
            </a>
            <div className="text-xs text-zinc-400">
              <span className="block text-zinc-500 font-semibold mb-1">Owner Contact:</span>
              <a href="mailto:flickblaze7@gmail.com" className="text-orange-400 hover:text-orange-300 transition-colors">
                flickblaze7@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 gap-4">
        <p>© {new Date().getFullYear()} Flick Staff Apply V2.1. All rights reserved.</p>
        <div className="flex items-center gap-1 text-zinc-500">
          <span>Crafted with</span>
          <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
          <span>for the Flick Community</span>
        </div>
      </div>
    </footer>
  );
};
