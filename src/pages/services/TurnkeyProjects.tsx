import { motion } from 'motion/react';
import { Compass, Droplets, PenTool, Wrench, Settings, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { IMAGES } from '../../config/images';
import { usePageMeta } from '../../hooks/usePageMeta';
import { Lines, usePageContent } from '../../lib/pageContent';
import { turnkeyPage } from '../../content/pages/services';

// Icon and colours for each scope step position
const SCOPE_STYLES = [
  { icon: Compass, color: "text-rose-500", borderColor: "border-rose-400", dotColor: "text-rose-400" },
  { icon: Wrench, color: "text-amber-500", borderColor: "border-amber-400", dotColor: "text-amber-400" },
  { icon: Droplets, color: "text-teal-500", borderColor: "border-teal-400", dotColor: "text-teal-400" },
  { icon: Settings, color: "text-blue-500", borderColor: "border-blue-400", dotColor: "text-blue-400" },
  { icon: PenTool, color: "text-green-500", borderColor: "border-green-400", dotColor: "text-green-400" },
  { icon: RotateCcw, color: "text-indigo-500", borderColor: "border-indigo-400", dotColor: "text-indigo-400" },
];

export default function TurnkeyProjects() {
  const c = usePageContent(turnkeyPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'), c.image('hero.image'));
  const benefits = c.list('philosophy.benefits');

  const scopeItems = c.list('scope.items').map((item, i) => ({ ...SCOPE_STYLES[i % SCOPE_STYLES.length], title: item.title, description: item.description }));

  return (
    <div className="bg-[#fbfbfb] dark:bg-[#060F1A] min-h-screen text-slate-900 dark:text-slate-50 transition-colors duration-500">
      {/* 1. Hero */}
      <section className="relative w-full h-screen min-h-160 overflow-hidden bg-black">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img
            src={c.image('hero.image')}
            alt={c.text('hero.alt')}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Left vignette */}
        <div className="absolute inset-0 z-10 bg-linear-to-r from-black/85 via-black/50 to-transparent" />
        {/* Bottom vignette for badge strip */}
        <div className="absolute inset-x-0 bottom-0 h-48 z-10 bg-linear-to-t from-black/80 to-transparent" />

        {/* Left-aligned content */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center px-8 sm:px-14 md:px-20 lg:px-28 pt-24">
          <div className="max-w-2xl">
            {/* Eyebrow */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-xs sm:text-sm font-bold tracking-[0.35em] uppercase text-[#f9c80e] mb-3 md:mb-4"
            >
              {c.text('hero.eyebrow')}
            </motion.p>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="font-display font-bold leading-none tracking-tight"
            >
              <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white dark:text-brand-gold uppercase">
                {c.text('hero.line1')}
              </span>
              <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif italic font-normal normal-case text-[#f9c80e]">
                {c.text('hero.line2')}
              </span>
              <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif italic font-normal normal-case text-[#f9c80e]">
                {c.text('hero.line3')}
              </span>
            </motion.h1>

            {/* Gold rule */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="origin-left h-0.5 w-16 bg-[#f9c80e] mt-6 mb-6"
            />

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="text-base sm:text-lg text-white/80 leading-relaxed max-w-md"
            >
              {c.text('hero.subtitle')}{' '}
              <span className="text-[#f9c80e]">{c.text('hero.subtitleHighlight')}</span>
            </motion.p>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center opacity-0 pointer-events-none" />
      </section>

      {/* 2. The Turnkey Philosophy (Problem/Solution) */}
      <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-24">
          <div className="relative">
            <div className="md:sticky md:top-32">
              <h2 className="font-display text-4xl md:text-5xl font-bold text-[#0a5c86] dark:text-white mb-6 tracking-tight">
                {c.text('philosophy.heading')}
                <br />
                <span className="font-serif italic text-cyan-700 dark:text-brand-gold font-normal">{c.text('philosophy.highlight')}</span>
              </h2>
              <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed max-w-md">
                <Lines text={c.text('philosophy.text')} />
              </p>
            </div>
          </div>
          <div className="flex flex-col border-t border-slate-200 dark:border-slate-800">
            {benefits.map((benefit, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="p-8 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-300 group"
              >
                <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-3 group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors">{benefit.title}</h3>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. The Scope of Work (The Details) - Infographic Style */}
      <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white dark:bg-[#09090b]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-24">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#0a5c86] dark:text-white mb-6 tracking-tight">
              {c.text('scope.heading')} <span className="font-serif italic text-cyan-700 dark:text-brand-gold font-normal">{c.text('scope.highlight')}</span>
            </h2>
            <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
              {c.text('scope.intro')}
            </p>
          </div>

          {/* Desktop/Tablet Infographic */}
          <div className="hidden lg:flex w-full relative justify-between items-start pt-10">
            {scopeItems.map((item, index) => {
              const isTop = index % 2 === 0;
              return (
                <div key={index} className="flex-1 relative flex flex-col items-center group">
                  {/* 1. Graphic Area */}
                  <div className="relative w-full h-44 flex items-center justify-center">
                    {/* The Dashed Wave */}
                    {isTop ? (
                      <div className={`absolute top-0 -left-[1px] w-[calc(100%+2px)] h-1/2 border-t-[2px] border-l-[2px] border-r-[2px] border-dashed ${item.borderColor} rounded-t-[120px] transition-colors duration-500`} style={{ borderBottom: 'none' }}></div>
                    ) : (
                      <div className={`absolute bottom-0 -left-[1px] w-[calc(100%+2px)] h-1/2 border-b-[2px] border-l-[2px] border-r-[2px] border-dashed ${item.borderColor} rounded-b-[120px] transition-colors duration-500`} style={{ borderTop: 'none' }}></div>
                    )}

                    {/* Connection Dots (Start / End) */}
                    {index === 0 && (
                       <div className={`absolute left-[-5px] top-1/2 -translate-y-[1px] w-2.5 h-2.5 rounded-full border bg-white dark:bg-[#09090b] ${item.borderColor} z-20`}></div>
                    )}
                    {index === scopeItems.length - 1 && (
                       <div className={`absolute right-[calc(-5px+2px)] top-1/2 -translate-y-[1px] w-2.5 h-2.5 rounded-full border bg-white dark:bg-[#09090b] ${item.borderColor} z-20`}></div>
                    )}

                    {/* The Center Icon Circle */}
                    <div className="z-10 w-28 h-28 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center relative shadow-sm cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-300">
                       {/* Subtle inner dashed indicator for "creativity" look */}
                       <div className="absolute inset-2 border border-slate-100 dark:border-slate-700 rounded-full transition-colors duration-300 group-hover:border-slate-200 dark:group-hover:border-slate-600"></div>
                       <item.icon className={`w-10 h-10 stroke-[1] ${item.color} transition-transform duration-500 group-hover:scale-110`} />
                    </div>
                  </div>

                  {/* 2. Text Content */}
                  <div className="text-center px-4 mt-8">
                    <h3 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest mb-3">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-wider max-w-[140px] mx-auto">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden flex flex-col space-y-12 relative max-w-sm mx-auto before:absolute before:inset-0 before:ml-12 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-200 before:to-transparent">
             {scopeItems.map((item, index) => (
                <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                   <div className="flex items-center justify-center w-24 h-24 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 relative">
                     <div className="absolute inset-2 border border-slate-100 dark:border-slate-700 rounded-full"></div>
                     <item.icon className={`w-8 h-8 stroke-[1] ${item.color}`} />
                   </div>
                   <div className="w-[calc(100%-7rem)] md:w-[calc(50%-4rem)] p-4 rounded bg-slate-50 dark:bg-[#0a111a] shadow-sm border border-slate-100 dark:border-slate-800">
                     <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">{item.title}</h3>
                     <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed uppercase">{item.description}</p>
                   </div>
                </div>
             ))}
          </div>
        </div>
      </section>

      {/* 5. The Footer / Call to Action (The Conversion) */}
      <section className="h-[50vh] flex flex-col justify-center items-center text-center px-4 sm:px-6 bg-[#fbfbfb] dark:bg-[#060F1A] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/services/hub/swimming-pool.webp')] bg-cover bg-center opacity-[0.03] dark:opacity-10 grayscale pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-[#0a5c86] dark:text-white mb-6 tracking-tight">
            {c.text('cta.heading')}
          </h2>
          <p className="text-lg text-slate-700 dark:text-slate-300 mb-10 max-w-2xl leading-relaxed">
            {c.text('cta.text')}
          </p>
          <Link 
            to="/contact-swimming-pool-contractor#inquiry" 
            className="group relative inline-flex items-center justify-center bg-black dark:bg-white text-white dark:text-slate-900 px-8 py-4 uppercase tracking-[0.2em] text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors duration-300 overflow-hidden"
          >
            <span className="relative z-10 pt-[2px] group-hover:text-white transition-colors duration-300">{c.text('cta.button')}</span>
            <div className="absolute inset-x-0 bottom-0 h-0 group-hover:h-full bg-cyan-900 dark:bg-[#0a5c86] transition-all duration-300 ease-out z-0"></div>
            <span className="relative z-10 pt-[2px] ml-3 mt-[-2px] group-hover:text-white transition-colors duration-300">{`→`}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
