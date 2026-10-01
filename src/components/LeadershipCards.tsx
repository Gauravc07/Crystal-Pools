import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { usePageContent } from '../lib/pageContent';
import { aboutPage } from '../content/pages/about';

export default function LeadershipCards() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const shouldReduceMotion = useReducedMotion();
  const leaders = usePageContent(aboutPage).list('leadership.people').map((p, i) => ({ id: String(i), name: p.name, role: p.role, initials: p.initials, description: p.description }));

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const handleTap = (id: string) => {
    if (!isDesktop) {
      setHoveredId(prev => (prev === id ? null : id));
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 perspective-[2000px]">
      <div className="flex flex-col lg:flex-row gap-6 w-full h-auto lg:h-125">
        {leaders.map((leader, index) => {
          const hoveredIndex = hoveredId !== null ? leaders.findIndex(l => l.id === hoveredId) : -1;
          const isHovered = hoveredId === leader.id;
          const isAnyHovered = hoveredId !== null;

          return (
            <motion.div
              key={leader.id}
              className={`relative overflow-hidden rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#070d14] ${!isDesktop ? 'cursor-pointer' : 'cursor-default'}`}
              onMouseEnter={() => isDesktop && setHoveredId(leader.id)}
              onMouseLeave={() => isDesktop && setHoveredId(null)}
              onClick={() => handleTap(leader.id)}
              initial={false}
              animate={{
                flex: isHovered ? 2.5 : isAnyHovered ? 0.8 : 1,
                rotateY: shouldReduceMotion ? 0 : (isHovered ? 0 : isAnyHovered ? (hoveredIndex > index ? 4 : -4) : 0),
                scale: shouldReduceMotion ? 1 : (isHovered ? 1.02 : isAnyHovered ? 0.95 : 1),
                z: shouldReduceMotion ? 0 : (isHovered ? 30 : 0),
                filter: shouldReduceMotion
                  ? 'none'
                  : (isAnyHovered && !isHovered ? 'blur(2px) brightness(0.8)' : 'blur(0px) brightness(1)'),
              }}
              transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
              style={{ transformStyle: 'preserve-3d', transformOrigin: 'center center' }}
            >
              <div className="flex w-full h-full min-h-100 lg:min-h-full flex-col lg:flex-row">

                {/* Image Section */}
                <motion.div
                  className="relative overflow-hidden shrink-0"
                  initial={false}
                  animate={{
                    width: isDesktop ? (isHovered ? '40%' : '100%') : '100%',
                    height: !isDesktop ? (isHovered ? '50%' : '100%') : '100%',
                  }}
                  transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                >
                  <motion.div
                    className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-linear-to-br from-brand-blue via-[#0e7ab5] to-brand-cyan"
                    initial={false}
                    animate={{ scale: isHovered ? 1.05 : 1 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  >
                    <div className="w-24 h-24 rounded-full bg-white/15 border-2 border-white/30 flex items-center justify-center mb-3">
                      <span className="text-white text-3xl font-bold font-display tracking-wide">{leader.initials}</span>
                    </div>
                    {!isDesktop && !isHovered && (
                      <span className="text-white/50 text-[10px] uppercase tracking-widest mt-1">Tap to read bio</span>
                    )}
                  </motion.div>
                </motion.div>

                {/* Content Section */}
                <div className="relative flex-1 flex items-center justify-center p-8 bg-white dark:bg-[#070d14] overflow-hidden">
                  <AnimatePresence mode="popLayout">
                    {isHovered ? (
                      <motion.div
                        key="expanded"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="flex flex-col justify-center w-full"
                      >
                        <h3 className="font-display text-2xl lg:text-3xl font-bold text-brand-blue dark:text-white mb-1">{leader.name}</h3>
                        <p className="text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400 mb-4">{leader.role}</p>
                        <div className="w-10 h-1 bg-linear-to-r from-brand-cyan to-[#2563eb] mb-4 rounded-full shrink-0" />
                        <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                          <p className="text-sm lg:text-base text-slate-700 dark:text-slate-300 leading-relaxed font-light">
                            {leader.description}
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="collapsed-placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="absolute bottom-6 left-6 right-6 lg:left-8 lg:right-8 z-10 hidden lg:block text-white"
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Always-visible name overlay when collapsed */}
                <AnimatePresence>
                  {!isHovered && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-end p-8 bg-linear-to-t from-black/80 via-black/0 to-transparent"
                    >
                      <h3 className="font-display text-2xl font-bold text-white mb-1">{leader.name}</h3>
                      <p className="text-sm uppercase tracking-widest text-white/80">{leader.role}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
