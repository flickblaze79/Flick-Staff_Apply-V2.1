import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

interface ApplicationActionAnimationProps {
  status: 'Accepted' | 'Rejected';
  applicantName: string;
  position: string;
}

export const ApplicationActionAnimation: React.FC<ApplicationActionAnimationProps> = ({
  status,
  applicantName,
  position,
}) => {
  const isAccepted = status === 'Accepted';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md rounded-3xl p-6 text-center shadow-2xl"
    >
      {/* Outer Glowing Ring */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`relative flex items-center justify-center w-24 h-24 rounded-full border-2 shadow-2xl mb-4 ${
          isAccepted
            ? 'bg-emerald-950/80 border-emerald-500 shadow-emerald-500/40 text-emerald-400'
            : 'bg-red-950/80 border-red-500 shadow-red-500/40 text-red-400'
        }`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 15 }}
        >
          {isAccepted ? (
            <CheckCircle2 className="w-12 h-12" />
          ) : (
            <XCircle className="w-12 h-12" />
          )}
        </motion.div>
      </motion.div>

      {/* Text Animation */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="space-y-1 max-w-sm"
      >
        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Real-Time Decision Saved</span>
        </div>
        <h3 className={`text-2xl font-black uppercase tracking-tight ${isAccepted ? 'text-emerald-400' : 'text-red-400'}`}>
          Application {status}!
        </h3>
        <p className="text-xs text-zinc-300 font-medium">
          {applicantName}'s application for <strong className="text-white">{position}</strong> has been marked as <span className="uppercase font-bold">{status}</span>.
        </p>
        <p className="text-[10px] text-zinc-500 pt-2 font-mono">
          Applicant notified via Firebase • Timestamp: {new Date().toLocaleTimeString()}
        </p>
      </motion.div>
    </motion.div>
  );
};
