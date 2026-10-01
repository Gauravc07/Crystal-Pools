import { Download } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import { motion } from 'motion/react';
import { DOCUMENTS } from '../../config/documents';
import { LinkButton } from '../../components/Button';
import { Lines, usePageContent, pageImage } from '../../lib/pageContent';
import { poolTilesPage } from '../../content/pages/services';

// Bento grid cell for each gallery position: [size classes, animation delay]
const GALLERY_CELLS: [string, number][] = [
  ['col-span-2 row-span-2', 0],
  ['col-span-1 row-span-1', 0.1],
  ['col-span-1 row-span-1', 0.15],
  ['col-span-2 row-span-1', 0.2],
  ['col-span-1 row-span-1', 0.25],
  ['col-span-1 md:col-span-3 row-span-1', 0.3],
];

export default function PoolTiles() {
  const c = usePageContent(poolTilesPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'), c.image('hero.image'));
  const advantages = c.list('mosaic.advantages');
  const gallery = c.list('collection.images').slice(0, GALLERY_CELLS.length);
  return (
    <div className="bg-[#fbfbfb] dark:bg-[#060F1A] w-full">
      {/* 1. The Mural Component (Immersive Visuals) */}
      <section className="min-h-screen w-full relative flex items-center bg-black">
        <div className="absolute inset-0 z-0">
          <img
            src={c.image('hero.image')}
            alt={c.text('hero.alt')}
            className="w-full h-full object-cover opacity-90"
          />
          {/* Left vignette for text legibility */}
          <div className="absolute inset-0 bg-linear-to-r from-[#0a1628]/80 via-[#0a1628]/30 to-transparent" />
        </div>

        <div className="relative z-10 px-8 sm:px-16 md:px-24 lg:px-32 max-w-3xl pt-20">
          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="font-serif italic text-[#f9c80e] text-lg md:text-xl mb-3"
          >
            {c.text('hero.eyebrow')}
          </motion.p>

          {/* Gold rule */}
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
            className="w-12 h-0.5 bg-[#f9c80e] mb-6"
          />

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-display font-light text-white dark:text-brand-gold leading-none mb-8 drop-shadow-lg"
          >
            <Lines text={c.text('hero.title')} />
          </motion.h1>

          {/* Body */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.7 }}
            className="text-base md:text-lg text-slate-200 font-light leading-relaxed max-w-sm"
          >
            {c.text('hero.subtitle')}
          </motion.p>
        </div>
      </section>

      {/* 2. The Mosaic Tiles Component (Split-Screen Elegance) */}
      <section className="w-full flex flex-col lg:flex-row bg-[#fbfbfb] dark:bg-[#060F1A]">
        {/* Left Column (Sticky Visuals) */}
        <div className="lg:w-1/2 relative sticky-col lg:top-0 h-[50vh] lg:h-screen overflow-hidden">
          <img
            src={c.image('mosaic.image')}
            alt={c.text('mosaic.alt')}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent lg:hidden pointer-events-none"></div>
          {/* Mobile Overlay Text */}
          <div className="absolute bottom-8 left-6 right-6 lg:hidden z-10">
            <h2 className="text-3xl font-light tracking-wide text-white mb-2 drop-shadow-md">{c.text('mosaic.mobileHeading')}</h2>
            <p className="text-sm tracking-widest text-[#f9c80e] uppercase">{c.text('mosaic.brand')}</p>
          </div>
        </div>
        
        {/* Right Column (Scrolling Content) */}
        <div className="lg:w-1/2 py-16 md:py-24 lg:py-32 px-6 sm:px-12 lg:px-20 lg:min-h-screen bg-[#fbfbfb] dark:bg-[#060F1A]">
          <motion.div
             initial={{ opacity: 0, x: 30 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.8 }}
             className="max-w-xl mx-auto lg:mx-0"
          >
             <div className="hidden lg:block">
                 <h2 className="text-3xl md:text-4xl font-display font-bold text-[#0a5c86] dark:text-white mb-2 tracking-tight">
                   {c.text('mosaic.heading')}
                 </h2>
                 <p className="text-sm tracking-widest text-[#f9c80e] uppercase mb-8 font-bold font-sans">{c.text('mosaic.brand')}</p>
             </div>
             
             <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-sans">
               {c.text('mosaic.p1')}
             </p>
             <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-16 font-sans">
               {c.text('mosaic.p2')}
             </p>

             <div className="space-y-4 border-t border-slate-200 dark:border-slate-800/80 pt-8">
                <h3 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2 mb-6 font-display">
                  {c.text('mosaic.advantagesHeading')}
                </h3>
                {advantages.map((adv, i) => (
                  <div key={i} className="group p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:-translate-y-1 hover:shadow-lg transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3 group-hover:text-[#0a5c86] dark:group-hover:text-[#38bdf8] transition-colors">{adv.title}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-sans leading-relaxed">{adv.description}</p>
                  </div>
                ))}
             </div>
             
              <div className="mt-16 flex flex-wrap gap-4">
                <LinkButton href="/contact-swimming-pool-contractor#inquiry" variant="primary" size="lg">
                  {c.text('mosaic.primaryButton')}
                </LinkButton>
                <LinkButton
                  href={DOCUMENTS.glassMosaicCatalogue}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="lg"
                >
                  <Download size={18} />
                  {c.text('mosaic.catalogueButton')}
                </LinkButton>
              </div>
          </motion.div>
        </div>
      </section>

      {/* 3. Tile Collection Gallery */}
      <section className="py-24 md:py-32 px-6 lg:px-12 bg-slate-100 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold text-slate-900 dark:text-white tracking-tight mb-4">
              {c.text('collection.heading')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg font-light max-w-2xl mx-auto">
              {c.text('collection.intro')}
            </p>
          </motion.div>

          {/* Bento grid — 4 columns, 3 rows */}
          <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[200px] md:auto-rows-[230px] gap-3 md:gap-4">

            {gallery.map((cell, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: GALLERY_CELLS[i][1] }}
                className={`${GALLERY_CELLS[i][0]} overflow-hidden rounded-2xl`}
              >
                <img src={pageImage(cell.image)} alt={cell.alt} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
              </motion.div>
            ))}

          </div>
        </div>
      </section>
    </div>
  );
}
