import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface PageLoaderProps {
  onFillComplete?: () => void;
  key?: React.Key;
}

export default function PageLoader({ onFillComplete }: PageLoaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      onFillComplete?.();
      return;
    }
    // 1. Initial State: Blank for 200ms
    const t1 = setTimeout(() => setPhase(1), 200);
    
    // 2. Transition Out: Phase 2 begins to hide "EST YEAR"
    const t2 = setTimeout(() => setPhase(2), 1000);
    
    // 3. Phase 3: Brand Reveal
    const t3 = setTimeout(() => setPhase(3), 1400);
    
    // 4. Trigger completion so parent unmounts and triggers `exit` animation
    const t4 = setTimeout(() => {
        if (onFillComplete) {
            onFillComplete();
        }
    }, 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [shouldReduceMotion, onFillComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-light-bg overflow-hidden"
      initial={{ opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }}
      exit={{
        clipPath: "inset(0% 0% 100% 0%)",
        transition: { duration: 1.0, ease: [0.76, 0, 0.24, 1] }
      }}
    >
      {/* Background ambient lighting */}
      <div 
        className="absolute inset-0 opacity-50 blur-3xl pointer-events-none" 
        style={{ background: 'radial-gradient(circle at center, color-mix(in srgb, var(--color-brand-blue) 5%, transparent) 0%, transparent 60%)' }}
      />

      <AnimatePresence mode="wait">
        {phase === 1 && (
          <motion.div
            key="est"
            initial={{ opacity: 0, y: 15, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -15, filter: "blur(8px)" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute flex items-center justify-center"
          >
            <span className="text-sm md:text-base font-display text-slate-400 tracking-[0.4em] uppercase font-light">
              EST 2000
            </span>
          </motion.div>
        )}
        
        {phase >= 3 && (
          <motion.div
            key="brand"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
            className="absolute flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8"
          >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1] }}
                className="w-20 h-20 md:w-28 md:h-28 relative flex items-center justify-center"
            >
                {/* Subtle reflection/glow under the logo */}
                <div className="absolute -bottom-4 w-full h-4 bg-[#0a5c86]/20 blur-xl rounded-[100%] scale-x-150"></div>
                <img src="/logo.png" alt="Crystal Pools" className="w-full h-full object-contain relative z-10" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              className="flex flex-col items-center md:items-start"
            >
              <p aria-hidden="true" className="text-3xl md:text-5xl font-display text-slate-800 tracking-wider mb-3 font-light uppercase">
                Crystal <span className="text-brand-blue font-semibold">Pools</span>
              </p>
              
              {/* Progress Line Indicator */}
              <div className="w-full h-[2px] bg-slate-100 relative overflow-hidden rounded-full">
                <motion.div 
                  initial={{ x: "-100%" }}
                  animate={{ x: "0%" }}
                  transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
                  className="absolute inset-y-0 left-0 w-full bg-linear-to-r from-[#38bdf8] to-[#0a5c86]"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

