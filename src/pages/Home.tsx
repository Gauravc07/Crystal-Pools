import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';

import { TypeAnimation } from 'react-type-animation';

import { useTheme } from '../contexts/ThemeContext';
import PoolAnimatedSection from '../components/PoolAnimatedSection';
import CompanyStatsSection from '../components/CompanyStatsSection';
import ServicesBentoSection from '../components/ServicesBentoSection';
import ProductsBentoSection from '../components/ProductsBentoSection';
import EsteemedClientsSection from '../components/EsteemedClientsSection';
import TestimonialsSection from '../components/TestimonialsSection';

import CrossfadeVideo from '../components/CrossfadeVideo';
import { IMAGES } from '../config/images';
import { siteMedia, useSiteSettings } from '../lib/siteSettings';
import { usePageContent } from '../lib/pageContent';
import { homePage } from '../content/pages/home';

export default function Home() {
  const content = usePageContent(homePage);
  usePageMeta(content.text('seo.title'), content.text('seo.description'));
  const words = content.list('hero.words').map(w => w.word).filter(Boolean);
  const typeSequence = words.flatMap(w => [w, 2000]);

  const shouldReduceMotion = useReducedMotion();
  const { isDarkMode } = useTheme();
  // Homepage banner media can be replaced from the admin panel; the built-in files are the fallback.
  const settings = useSiteSettings();
  const hero = {
    light: siteMedia(settings.hero_image_light) ?? IMAGES.hero.lightMode,
    dark: siteMedia(settings.hero_image_dark) ?? IMAGES.hero.darkMode,
    video: siteMedia(settings.hero_video) ?? IMAGES.hero.video,
  };
  const { scrollY } = useScroll();
  const indicatorOpacity = useTransform(scrollY, [0, 200], [1, 0]);

  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const buildOpacity = useTransform(scrollYProgress, [0.0, 0.3], [1, 0]);

  return (
    <div className="bg-light-bg dark:bg-dark-bg text-[#1a202c] dark:text-slate-50 transition-colors duration-500">
      {/* 1. Hero Section */}
      <section ref={heroRef} className={`relative h-svh min-h-175 flex flex-col justify-end overflow-hidden pt-40 transition-colors duration-1000 ${isDarkMode ? "bg-black" : "bg-blue-50"}`}>
        <div className="absolute inset-0">
          {/* Static images load instantly; video layers on top when ready */}
          <img
            src={hero.light}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isDarkMode ? 'opacity-0' : 'opacity-100'}`}
          />
          <CrossfadeVideo
            src={hero.video}
            className="absolute inset-0 w-full h-full object-cover"
            isVisible={!isDarkMode}
          />
          <img
            src={hero.dark}
            alt={content.text('hero.alt')}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isDarkMode ? 'opacity-100' : 'opacity-0'}`}
          />
          <div className={`absolute inset-0 transition-opacity duration-1000 ${isDarkMode ? 'bg-linear-to-b from-black/80 via-black/10 to-transparent' : 'bg-linear-to-t from-black/60 via-transparent to-black/30'}`}></div>
        </div>

        {/* Animated Headline */}
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="max-w-4xl text-left"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } }
              }}
            >
              <h1 className="text-4xl md:text-7xl lg:text-8xl font-display font-black leading-[1.1] md:leading-[0.9] tracking-tighter drop-shadow-xl">
                <motion.span
                  className="block mb-2 text-white dark:text-brand-gold"
                  variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                >
                  <motion.span style={{ opacity: shouldReduceMotion ? 1 : buildOpacity, display: 'block' }}>
                    {content.text('hero.lead')}
                  </motion.span>
                </motion.span>
                <motion.span
                  className="text-brand-gold block drop-shadow-2xl"
                  variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                >
                  {/* aria-live announces rotating text to screen readers */}
                  <span aria-live="polite" aria-atomic="true">
                    <TypeAnimation
                      key={words.join('|')}
                      sequence={typeSequence}
                      wrapper="span"
                      speed={50}
                      repeat={Infinity}
                    />
                  </span>
                </motion.span>
              </h1>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          style={{ opacity: indicatorOpacity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
        >
          <span className="text-white/50 text-[9px] uppercase tracking-[0.4em] font-bold">Scroll</span>
          <div className="w-px h-10 bg-white/30 relative overflow-hidden">
            {!shouldReduceMotion && (
              <motion.div
                className="absolute top-0 left-0 w-full bg-brand-gold"
                animate={{ height: ['0%', '100%', '0%'], top: ['0%', '0%', '100%'] }}
                transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
              />
            )}
          </div>
        </motion.div>
      </section>

      <PoolAnimatedSection />

      {/* 3. Projects / Experience (Stats) */}
      <CompanyStatsSection />

      {/* 4. Services (Bento Grid) */}
      <ServicesBentoSection />

      {/* 5. Products (Bento Grid) */}
      <ProductsBentoSection />

      {/* 6. Testimonials (managed in the admin panel) */}
      <TestimonialsSection />

      {/* 7. Esteemed Clients */}
      <EsteemedClientsSection />
    </div>
  );
}
