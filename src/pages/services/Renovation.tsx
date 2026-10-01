import { motion } from 'motion/react';
import { ArrowRight, Palette, Zap, Shield, CheckCircle } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import { Link } from 'react-router-dom';
import { usePageContent, pageImage } from '../../lib/pageContent';
import { renovationPage } from '../../content/pages/services';

// Icon for each scope card position
const ICONS = [Palette, Zap, Shield, CheckCircle];

export default function Renovation() {
  const c = usePageContent(renovationPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'), c.image('hero.image'));
  const gallery = c.list('gallery.images');
  const renovationScope = c.list('scope.items').map((item, i) => ({
    number: String(i + 1).padStart(2, '0'),
    title: item.title,
    description: item.description,
    icon: ICONS[i % ICONS.length],
  }));
  return (
    <div className="bg-[#fbfbfb] dark:bg-[#060F1A] w-full">

      {/* 1. Hero */}
      <section className="relative w-full h-screen overflow-hidden flex items-center bg-black">
        <div className="absolute inset-0">
          <img
            src={c.image('hero.image')}
            alt={c.text('hero.alt')}
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/40 to-transparent" />
        </div>

        <div className="relative z-10 px-8 sm:px-16 md:px-24 lg:px-32 max-w-3xl pt-20">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-serif italic text-[#f9c80e] text-lg md:text-xl mb-3"
          >
            {c.text('hero.eyebrow')}
          </motion.p>
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
            className="w-12 h-0.5 bg-[#f9c80e] mb-6"
          />
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
            className="text-6xl sm:text-7xl md:text-8xl font-display font-light text-white dark:text-brand-gold leading-none mb-8"
          >
            {c.text('hero.title')}<br />
            <span className="text-[#f9c80e]">{c.text('hero.highlight')}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.7 }}
            className="text-base md:text-lg text-slate-200 font-light leading-relaxed max-w-sm"
          >
            {c.text('hero.subtitle')}
          </motion.p>
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="w-px h-16 bg-white/30 relative overflow-hidden">
            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-0 w-full h-full bg-white"
            />
          </div>
        </div>
      </section>

      {/* 2. Philosophy Statement */}
      <section className="py-24 md:py-32 px-6 bg-white dark:bg-[#060F1A]">
        <div className="max-w-5xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-xs tracking-[0.3em] uppercase font-bold text-[#f9c80e] mb-6"
          >
            {c.text('philosophy.eyebrow')}
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="text-3xl md:text-5xl font-display font-light text-slate-900 dark:text-white leading-tight mb-8"
          >
            {c.text('philosophy.heading')}
            <br />
            <span className="font-serif italic text-[#0a5c86] dark:text-white">{c.text('philosophy.highlight')}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl font-light"
          >
            {c.text('philosophy.text')}
          </motion.p>
        </div>
      </section>

      {/* 3. Asymmetric Image Gallery */}
      <section className="py-6 px-6 lg:px-12 bg-[#fbfbfb] dark:bg-[#060F1A]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 auto-rows-[280px] md:auto-rows-[320px] gap-3 md:gap-4">
          {/* Large left — 3 cols × 2 rows */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="md:col-span-3 md:row-span-2 overflow-hidden rounded-2xl"
          >
            <img
              src={pageImage(gallery[0]?.image)}
              alt={gallery[0]?.alt}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
            />
          </motion.div>

          {/* Top right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="md:col-span-2 overflow-hidden rounded-2xl"
          >
            <img
              src={pageImage(gallery[1]?.image)}
              alt={gallery[1]?.alt}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
            />
          </motion.div>

          {/* Bottom right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="md:col-span-2 overflow-hidden rounded-2xl"
          >
            <img
              src={pageImage(gallery[2]?.image)}
              alt={gallery[2]?.alt}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
            />
          </motion.div>
        </div>
      </section>

      {/* 4. Scope Cards */}
      <section className="py-24 md:py-32 px-6 lg:px-12 bg-[#fbfbfb] dark:bg-[#060F1A]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <p className="text-xs tracking-[0.3em] uppercase font-bold text-[#f9c80e] mb-4">{c.text('scope.eyebrow')}</p>
            <h2 className="text-3xl md:text-5xl font-display font-bold text-[#0a5c86] dark:text-white tracking-tight">
              {c.text('scope.heading')}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renovationScope.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: idx * 0.1 }}
                className="group relative p-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-[#0a5c86]/30 dark:hover:border-[#38bdf8]/30 hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <span className="absolute top-6 right-8 text-7xl font-display font-bold text-slate-100 dark:text-slate-800 select-none leading-none group-hover:text-[#0a5c86]/10 dark:group-hover:text-[#38bdf8]/10 transition-colors duration-300">
                  {item.number}
                </span>
                <div className="relative z-10">
                  <item.icon className="w-8 h-8 text-[#0a5c86] dark:text-white mb-6 stroke-[1.5]" />
                  <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-base">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CTA */}
      <section className="py-32 px-6 text-center bg-[#EEF5FF] dark:bg-[#060F1A]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="max-w-3xl mx-auto"
        >
          <p className="text-xs tracking-[0.3em] uppercase font-bold text-[#f9c80e] mb-6">{c.text('cta.eyebrow')}</p>
          <h2 className="text-4xl md:text-6xl font-display font-light text-[#0a5c86] dark:text-white tracking-tight mb-12 leading-tight">
            {c.text('cta.heading')}<br />
            <span className="font-serif italic text-[#f9c80e]">{c.text('cta.highlight')}</span>
          </h2>
          <Link
            to="/contact-swimming-pool-contractor#inquiry"
            className="group inline-flex items-center gap-4 px-10 py-5 border border-[#0a5c86] dark:border-[#38bdf8] text-[#0a5c86] dark:text-white hover:bg-[#0a5c86] dark:hover:bg-[#38bdf8] hover:text-white dark:hover:text-slate-900 transition-all duration-300 uppercase tracking-widest text-sm font-bold"
          >
            {c.text('cta.button')}
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </section>

    </div>
  );
}
