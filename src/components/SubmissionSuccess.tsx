import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, MessageCircle, ExternalLink, Calendar } from 'lucide-react';

interface SubmissionSuccessProps {
  isOpen: boolean;
  onClose: () => void;
  category: string;
  submissionDate: string;
}

export const SubmissionSuccess: React.FC<SubmissionSuccessProps> = ({ isOpen, onClose, category, submissionDate }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-emerald-600/10 blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center gap-6 text-white">
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                className="w-20 h-20 rounded-full bg-emerald-950 border-4 border-emerald-500/30 flex items-center justify-center"
              >
                <Check className="w-10 h-10 text-emerald-400" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase text-white">Application Submitted Successfully!</h2>
                <p className="text-sm text-zinc-300">Your {category} has been submitted successfully.</p>
              </div>

              <div className="text-left bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-xs space-y-4 w-full">
                <h3 className="font-black uppercase text-white">Next Steps</h3>
                <p className="text-zinc-400 leading-relaxed">
                  You have applied for the <span className="text-cyan-400 font-bold">{category.replace(' Apply', '')}</span> position. Click Join Discord and join our official server. 
                  Then open the <span className="text-white font-bold">Staff Apply</span> channel and create an application ticket.
                </p>
                <p className="text-zinc-400 leading-relaxed">Inside your ticket, show your relevant experience and work, for example:</p>
                <ul className="list-disc list-inside text-zinc-400 space-y-1 pl-1">
                  <li>Portfolio or previous projects</li>
                  <li>GitHub repositories (for Developers)</li>
                  <li>Proof of previous staff experience</li>
                  <li>Active community contributions</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <a 
                  href="https://discord.gg/s5fKfhN9V" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                  <MessageCircle className="w-4 h-4" />
                  Join Discord
                </a>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-sm uppercase rounded-xl transition-all border border-zinc-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Application
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 w-full bg-zinc-900/50 p-4 rounded-xl text-[10px] border border-zinc-800">
                <div>
                  <div className="text-zinc-500 uppercase font-black tracking-widest mb-1">Category</div>
                  <div className="text-white font-bold">{category}</div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase font-black tracking-widest mb-1">Status</div>
                  <div className="text-amber-400 font-bold uppercase">Pending Review</div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase font-black tracking-widest mb-1">Submitted</div>
                  <div className="text-white font-bold">{new Date(submissionDate).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
