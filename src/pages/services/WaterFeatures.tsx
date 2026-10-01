import { useRef, useState } from 'react';
import { usePageMeta } from '../../hooks/usePageMeta';
import { motion } from 'motion/react';
import { ArrowUp, Cloud, Bell, Aperture, Droplets, ArrowDown, Activity, Layers, Music } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Lines, usePageContent, pageImage } from '../../lib/pageContent';
import { waterFeaturesPage } from '../../content/pages/services';

// Icon for each fountain card position
const ICONS = [ArrowUp, Cloud, Bell, Aperture, Droplets, ArrowDown, Activity, Layers, Music];

export default function WaterFeatures() {
  const c = usePageContent(waterFeaturesPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'), c.image('hero.image'));
  const signatureCollection = c.list('collection.items').map((item, i) => ({
    title: item.title,
    description: item.description,
    image: pageImage(item.image),
    icon: ICONS[i % ICONS.length],
  }));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    if (scrollRef.current) {
      const parent = scrollRef.current;
      const viewportCenter = parent.scrollLeft + (parent.clientWidth / 2);
      
      let closestIndex = 0;
      let minDistance = Infinity;

      Array.from(parent.children).forEach((child, index) => {
        if (index < signatureCollection.length) {
          const childElement = child as HTMLElement;
          // Calculate the child's center relative to its scroll parent
          const childCenter = childElement.offsetLeft - parent.offsetLeft + (childElement.clientWidth / 2);
          const distance = Math.abs(viewportCenter - childCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
          }
        }
      });

      if (closestIndex !== activeIndex) {
        setActiveIndex(closestIndex);
      }
    }
  };

  return (
    <div className="bg-[#fbfbfb] dark:bg-[#060F1A] w-full font-sans transition-colors duration-500 overflow-x-hidden">
      
      {/* 1. The Hero Section (The Fluid Hook) */}
      <section className="relative w-full h-screen overflow-hidden flex items-center bg-black">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={c.image('hero.image')}
            alt={c.text('hero.alt')}
            className="w-full h-full object-cover opacity-80"
          />
          {/* Left-side vignette so text stays readable */}
          <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/30 to-transparent" />
        </div>

        {/* Content — left-aligned */}
        <div className="relative z-10 px-8 sm:px-16 md:px-24 lg:px-32 max-w-3xl pt-20">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-light text-white dark:text-brand-gold leading-none mb-6"
          >
            <Lines text={c.text('hero.title')} />
          </motion.h1>

          {/* Gold rule */}
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
            className="w-16 h-0.5 bg-[#f9c80e] mb-6"
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="text-base md:text-lg font-light text-slate-200 leading-relaxed max-w-sm"
          >
            {c.text('hero.subtitle')}
          </motion.p>
        </div>

        {/* Scroll Cue */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="w-px h-16 bg-white/30 relative overflow-hidden">
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-0 w-full h-full bg-white"
            />
          </div>
        </div>
      </section>

      {/* 2. The Architectural Statement (The Breath of Space) */}
      <section className="py-32 md:py-48 px-6 lg:px-8 bg-transparent flex justify-center">
        <div className="max-w-3xl text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-3xl md:text-5xl font-display font-bold tracking-tight text-[#0a5c86] dark:text-white mb-10"
          >
            {c.text('statement.heading')} <span className="font-serif italic font-normal text-cyan-700 dark:text-white">{c.text('statement.highlight')}</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 leading-relaxed font-light"
          >
            {c.text('statement.text')}
          </motion.p>
        </div>
      </section>

      {/* 3. The Signature Collection (The Hybrid Showcase) */}
      <section className="py-24 md:py-32 bg-white dark:bg-[#09090b]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 mb-16 text-center md:text-left">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-[#0a5c86] dark:text-white mb-4">
            {c.text('collection.heading')} <br className="hidden md:block" />
            <span className="font-serif italic font-normal text-cyan-700 dark:text-white">{c.text('collection.highlight')}</span>
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 tracking-wide uppercase max-w-2xl">
            {c.text('collection.intro')}
          </p>
        </div>

        {/* Horizontal Scroll on Mobile/Tablet, Grid on Desktop */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="w-full overflow-x-auto pb-12 snap-x snap-mandatory hide-scrollbars pl-6 lg:pl-0 md:px-8 max-w-7xl mx-auto flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {signatureCollection.map((item, index) => (
            <div 
              key={index}
              className="flex-none w-[85vw] sm:w-[50vw] md:w-auto min-h-[400px] snap-center group relative overflow-hidden rounded-xl bg-slate-900"
            >
              <img 
                src={item.image} 
                alt={item.title} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-70 group-hover:opacity-100" 
              />
              <div className="absolute inset-0 bg-linear-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>

              <div className="relative z-10 flex flex-col justify-end h-full p-8">
                <div className="transform transition-transform duration-500 group-hover:-translate-y-2">
                  <item.icon className="w-8 h-8 text-cyan-400 stroke-[1.5] mb-4 opacity-80" />
                  <h3 className="text-2xl font-bold tracking-tight text-white mb-3 font-display drop-shadow-md">
                    {item.title}
                  </h3>
                  <p className="text-slate-200 leading-relaxed text-sm md:text-base line-clamp-4">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {/* Spacer for mobile scroll ending nicely */}
          <div className="flex-none w-4 md:hidden"></div>
        </div>

        {/* Mobile/Tablet Scroll Indicator */}
        <div className="md:hidden flex flex-col items-center justify-center space-y-4 mt-2">
          <div className="flex space-x-2">
            {signatureCollection.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeIndex ? 'w-8 bg-cyan-600 dark:bg-cyan-400' : 'w-2 bg-slate-200 dark:bg-slate-700'}`}
              />
            ))}
          </div>
          <div className="text-xs font-bold text-slate-400 font-sans tracking-[0.2em] uppercase">
            {activeIndex + 1} / {signatureCollection.length}
          </div>
        </div>
      </section>

      {/* 4. The Call to Action (The Final Anchor) */}
      <section className="py-32 md:py-48 px-6 lg:px-8 bg-[#EEF5FF] dark:bg-[#060F1A] text-center">
        <div className="flex flex-col items-center">
          <p className="text-xs tracking-[0.3em] uppercase font-bold text-[#f9c80e] mb-6">{c.text('cta.eyebrow')}</p>
          <h2 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-[#0a5c86] dark:text-white mb-12">
            {c.text('cta.heading')}
          </h2>
          <Link
            to="/contact-swimming-pool-contractor#inquiry"
            className="group relative inline-flex items-center justify-center px-10 py-5 text-sm uppercase tracking-widest border border-[#0a5c86] dark:border-[#38bdf8] text-[#0a5c86] dark:text-white overflow-hidden transition-colors duration-300"
          >
            <span className="absolute inset-0 w-full h-full bg-[#0a5c86] dark:bg-[#38bdf8] translate-y-[101%] group-hover:translate-y-0 transition-transform duration-300 ease-out z-0" />
            <span className="relative z-10 group-hover:text-white dark:group-hover:text-slate-900 transition-colors duration-300 font-medium">
              {c.text('cta.button')}
            </span>
          </Link>
        </div>
      </section>
      
      {/* Global styles for hiding scrollbar inside the element */}
      <style>{`
        .hide-scrollbars::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbars {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

