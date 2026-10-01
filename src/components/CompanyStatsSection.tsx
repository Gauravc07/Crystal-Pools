import { useRef, useEffect } from 'react';
import { motion, useInView, useMotionValue, animate, useTransform } from 'motion/react';
import LiquidBackground from './LiquidBackground';
import { usePageContent, pageImage } from '../lib/pageContent';
import { homePage } from '../content/pages/home';

const ANIMATION_DURATION = 4.0;

const RisingStat = ({ target, label, suffix = '', isInView }: { target: number, label: string, suffix?: string, isInView: boolean }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const formattedCount = useTransform(rounded, (latest) => `${latest}${suffix}`);

  useEffect(() => {
    if (isInView) {
      animate(count, target, {
        duration: ANIMATION_DURATION,
        ease: [0.25, 1, 0.5, 1], // Smooth ease-out
      });
    }
  }, [isInView, count, target]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1], delay: 0.2 }}
      className="flex flex-col items-center justify-center p-4 md:p-6 text-center group z-10 relative"
    >
      <div className="relative font-display font-bold text-5xl md:text-6xl lg:text-7xl tracking-tighter select-none flex justify-center w-full min-w-37.5">
        <motion.div className="text-white drop-shadow-md dark:drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
          {formattedCount}
        </motion.div>
      </div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="text-[#0a5c86] dark:text-white uppercase tracking-[0.2em] mt-6 font-semibold text-sm md:text-base relative z-10 drop-shadow-sm"
      >
        {label}
      </motion.p>
    </motion.div>
  );
};

export default function CompanyStatsSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  const bgProgressMotion = useMotionValue(0);
  const stats = usePageContent(homePage).list('stats.items');

  useEffect(() => {
    if (isInView) {
      const controls = animate(bgProgressMotion, 100, {
        duration: ANIMATION_DURATION,
        ease: [0.25, 1, 0.5, 1], // Match the number easing
      });
      return () => controls.stop();
    }
  }, [isInView, bgProgressMotion]);

  return (
    <section ref={ref} className="py-24 md:py-32 transition-colors duration-500 relative overflow-hidden min-h-[500px]">
      <LiquidBackground fillProgress={bgProgressMotion} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center pt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 w-full">
          {stats.map((s, i) => (
            <RisingStat key={i} target={Number(s.value.replace(/[^\d.]/g, '')) || 0} label={s.label} suffix={s.suffix} isInView={isInView} />
          ))}
        </div>
      </div>
    </section>
  );
}
