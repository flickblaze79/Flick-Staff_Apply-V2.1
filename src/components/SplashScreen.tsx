import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FlickLogo } from './FlickLogo';


interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1500);

    // Fallback safety timer: ensures app never stays stuck on splash screen
    const safetyTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <AnimatePresence onExitComplete={() => onCompleteRef.current()}>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          onClick={() => setIsVisible(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0e17] text-white cursor-pointer select-none"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center space-y-5 text-center"
          >
            <motion.div
              animate={{
                filter: [
                  'drop-shadow(0 0 10px rgba(8,123,255,0.4))',
                  'drop-shadow(0 0 25px rgba(0,217,255,0.6))',
                  'drop-shadow(0 0 10px rgba(8,123,255,0.4))',
                ],
              }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
              <FlickLogo size="xl" showText={false} />
            </motion.div>

            <div className="text-center space-y-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase italic leading-none flex items-center justify-center gap-2 flex-wrap">
                <span className="text-white">FLICK</span>
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">STAFF APPLY</span>
                <span className="text-cyan-400 opacity-90">V2</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                Official Portal
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
