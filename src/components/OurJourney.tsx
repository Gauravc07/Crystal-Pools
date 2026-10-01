import { useRef } from 'react';
import type { FC } from 'react';
import { motion, useScroll, useTransform, useSpring, MotionValue } from 'motion/react';

import { usePageContent } from '../lib/pageContent';
import { aboutPage } from '../content/pages/about';

interface MilestoneData {
  year: string;
  title: string;
  description: string;
  /** Scroll progress (0–1) at which the milestone lights up */
  position: number;
}

const Milestone: FC<{
  milestone: MilestoneData;
  index: number;
  scrollYProgress: MotionValue<number>;
}> = ({ milestone, index, scrollYProgress }) => {
  const isLeft = index % 2 === 0;
  const { position, year, title, description } = milestone;

  // Fade in content as the global progress passes this milestone's intended position
  const activateStart = position - 0.2;
  const activateEnd = position;

  const contentOpacity = useTransform(scrollYProgress, [activateStart, activateEnd], [0, 1]);
  const contentY = useTransform(scrollYProgress, [activateStart, activateEnd], [30, 0]);
  const scale = useTransform(scrollYProgress, [activateStart, activateEnd], [1, 1.4]);
  const glowOpacity = useTransform(scrollYProgress, [activateStart, activateEnd], [0, 1]);

  return (
    <div className="relative w-full flex items-center justify-center min-h-[250px] py-12 md:py-20 group">
      
      {/* Central Node / Dot */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-20">
        {/* Idle muted dot */}
        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 transition-colors" />
        
        {/* Activated glowing dot */}
        <motion.div
           style={{ scale, opacity: glowOpacity }}
           className="absolute w-3 h-3 rounded-full bg-cyan-500 dark:bg-amber-400 shadow-[0_0_15px_rgba(34,211,238,0.8)] dark:shadow-[0_0_15px_rgba(251,191,36,0.8)]"
        />

        {/* Soft outward glow */}
        <motion.div
           style={{ opacity: glowOpacity }}
           className="absolute w-24 h-24 bg-cyan-400/20 dark:bg-amber-400/20 rounded-full blur-[20px] pointer-events-none mix-blend-screen"
        />
      </div>

      {/* Grid Layout Container */}
      <div className="w-full max-w-5xl mx-auto flex">
        {/* Left Column */}
        <div className="w-1/2 flex justify-end">
          {isLeft && (
            <motion.div 
              style={{ opacity: contentOpacity, y: contentY }}
              className="flex flex-col items-end text-right pr-8 md:pr-16 max-w-xs md:max-w-sm"
            >
              <span className="text-sm font-bold text-cyan-600 dark:text-brand-gold tracking-widest uppercase">{year}</span>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 md:mt-2">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1 md:mt-2">{description}</p>
            </motion.div>
          )}
        </div>
        
        {/* Right Column */}
        <div className="w-1/2 flex justify-start">
          {!isLeft && (
            <motion.div 
              style={{ opacity: contentOpacity, y: contentY }}
              className="flex flex-col items-start text-left pl-8 md:pl-16 max-w-xs md:max-w-sm"
            >
              <span className="text-sm font-bold text-cyan-600 dark:text-brand-gold tracking-widest uppercase">{year}</span>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 md:mt-2">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1 md:mt-2">{description}</p>
            </motion.div>
          )}
        </div>
      </div>

    </div>
  );
}

export default function OurJourney() {
  const c = usePageContent(aboutPage);
  const items = c.list('journey.items');
  // Spread milestones evenly along the scroll track (5 items → 0.1, 0.3, 0.5, 0.7, 0.9)
  const journeyData: MilestoneData[] = items.map((m, i) => ({ year: m.year, title: m.title, description: m.description, position: (i + 0.5) / items.length }));
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  
  // Track the scroll mapping 0 to 1 over the timeline container's bounding box
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start center", "end center"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  
  // The light moves straight down from 0% to 100% of the track height
  const lightPosition = useTransform(smoothProgress, [0, 1], ["0%", "100%"]);
  
  // Fading out the light slightly at the very end
  const lightOpacity = useTransform(smoothProgress, [0, 0.05, 0.9, 1], [0, 1, 1, 0]);
  const lightScale = useTransform(smoothProgress, [0.9, 1], [1, 3]);

  // Cinematic Flood of Light at the end (when progress reaches >0.85)
  const floodOpacity = useTransform(smoothProgress, [0.85, 1], [0, 1]);

  return (
    <section ref={containerRef} className="relative bg-[#f8fcfd] dark:bg-[#04090d] transition-colors duration-1000 py-24 md:py-32 overflow-hidden">

      {/* Cinematic flood overlay */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none bg-cyan-100/60 dark:bg-amber-900/20"
        style={{ opacity: floodOpacity }}
      />
      {/* Light mode flood gradient */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none mix-blend-screen opacity-60 dark:hidden"
        style={{
          opacity: floodOpacity,
          background: 'radial-gradient(circle at 50% 90%, rgba(34, 211, 238, 0.5), transparent 70%)'
        }}
      />
      {/* Dark mode flood gradient — warm gold */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none mix-blend-screen opacity-40 hidden dark:block"
        style={{
          opacity: floodOpacity,
          background: 'radial-gradient(circle at 50% 90%, rgba(251, 191, 36, 0.35), transparent 70%)'
        }}
      />

      {/* 1. Isolate the Header */}
      <div className="relative z-10 text-center px-4 mb-24 md:mb-32">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-4xl md:text-5xl font-bold text-[#0a5c86] dark:text-white mb-4 tracking-tight"
        >
          {c.text('journey.heading')}
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
        >
          {c.text('journey.intro')}
        </motion.p>
      </div>

      {/* 2 & 3. Timeline Track and Grid Alignment */}
      <div ref={trackRef} className="relative w-full max-w-6xl mx-auto z-10 px-4 md:px-8">
        
        {/* Central Base Line */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-slate-200 dark:bg-slate-800" />

        {/* Caustic Light Sweep */}
        <motion.div 
          className="absolute left-1/2 -translate-x-1/2 w-[300px] h-[40vh] max-h-[500px] pointer-events-none z-0 opacity-80"
          style={{ top: lightPosition, y: "-50%", opacity: lightOpacity, scale: lightScale }}
        >
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-cyan-400/30 dark:via-amber-400/30 to-transparent blur-2xl rounded-full transform scale-x-50"></div>
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-cyan-200/40 dark:via-amber-200/35 to-transparent blur-[20px] rounded-full transform scale-x-25"></div>
          <div className="absolute left-1/2 -translate-x-1/2 top-[25%] bottom-[25%] w-0.5 bg-linear-to-b from-transparent via-white/80 to-transparent blur-[2px] shadow-[0_0_15px_rgba(34,211,238,0.8)] dark:shadow-[0_0_15px_rgba(251,191,36,0.7)]"></div>
        </motion.div>

        {/* Milestones Flow */}
        <div className="relative z-10">
          {journeyData.map((milestone, i) => (
            <Milestone 
              key={i} 
              index={i}
              milestone={milestone} 
              scrollYProgress={smoothProgress} 
            />
          ))}
        </div>
      </div>
      
      {/* 4. Clear the Footer Overlap */}
      <div className="relative z-10 mt-32 flex justify-center text-slate-400 dark:text-slate-500 animate-pulse">
          <span className="text-sm tracking-widest uppercase font-semibold">Scroll to explore</span>
      </div>
    </section>
  );
}

