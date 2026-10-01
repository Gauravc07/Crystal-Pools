import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import AnimatedTextReveal from './AnimatedTextReveal';
import PoolFooterGallery from './PoolFooterGallery';
import type { PoolGalleryImage } from './PoolFooterGallery';
import { usePageMeta } from '../hooks/usePageMeta';
import { Lines, usePageContent } from '../lib/pageContent';
import type { PoolTypeSchema } from '../content/pages/poolTypes';

interface Props {
  schema: PoolTypeSchema;
  /** Matches projects.pool_type, so admin projects appear in the bottom gallery */
  poolType: string;
  poolName: string;
  gallery: PoolGalleryImage[];
  /** Wide headline + lower image focus (most pages) vs narrow + higher focus */
  layout?: 'wide' | 'narrow';
  /** Check-mark bullets instead of dots */
  checkIcons?: boolean;
}

/** Shared layout for the 8 pool type pages. All text and images come from the admin panel (with defaults). */
export default function PoolTypePage({ schema, poolType, poolName, gallery, layout = 'wide', checkIcons }: Props) {
  const c = usePageContent(schema);
  usePageMeta(c.text('seo.title'), c.text('seo.description'), c.image('hero.image'));

  const features = c.list('craft.features').filter(f => f.title || f.text);
  const calloutTitle = c.text('craft.calloutTitle');
  const calloutText = c.text('craft.calloutText');
  const hasCallout = Boolean(calloutTitle || calloutText);
  // With a highlight box, all points sit in the left column; otherwise they split into two columns.
  const split = hasCallout ? features.length : Math.ceil(features.length / 2);
  const columns = [features.slice(0, split), hasCallout ? [] : features.slice(split)];

  const lead = c.text('story.lead');
  const p1 = c.text('story.p1');
  const p2 = c.text('story.p2');

  const bullet = (i: number) => checkIcons ? (
    <span className="absolute -left-[14px] top-1 px-1 bg-slate-50 dark:bg-[#0a1526]">
      <CheckCircle2 className={`w-6 h-6 ${i % 2 ? 'text-[#f9c80e]' : 'text-cyan-500'}`} />
    </span>
  ) : (
    <span className={`absolute -left-[9px] top-2 w-4 h-4 rounded-full ${i % 2 ? 'bg-[#f9c80e]' : 'bg-cyan-500'}`}></span>
  );

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#060F1A] overflow-hidden">

      {/* 1. The Hero Section */}
      <section className="relative w-full min-h-[100dvh] md:min-h-[800px] flex flex-col justify-end pb-16 md:pb-24 px-4 sm:px-6 lg:px-8 pt-24">
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#060F1A]">
          <img
            src={c.image('hero.image')}
            alt={c.text('hero.alt')}
            className={`absolute inset-0 w-full h-full object-cover object-center ${layout === 'narrow' ? 'md:object-[center_20%]' : 'md:object-[center_30%]'} opacity-90`}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-end gap-6 md:gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className={layout === 'narrow' ? 'max-w-2xl' : 'max-w-3xl'}
          >
            <h1 className="text-3xl md:text-5xl lg:text-6xl text-white dark:text-brand-gold font-sans font-bold leading-[1.2] mb-2 md:mb-4">
              {c.text('hero.title')}<br />
              <span className="font-serif italic text-[#f9c80e] font-normal text-5xl md:text-7xl lg:text-8xl">{c.text('hero.highlight')}</span>
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="max-w-lg pb-0 md:pb-4"
          >
            <p className="text-lg md:text-xl text-white font-medium drop-shadow-xl leading-relaxed">
              {c.text('hero.intro')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* 2. The Story Section */}
      <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px w-12 bg-[#f9c80e]"></div>
            <span className="font-sans font-bold uppercase tracking-[0.2em] text-[#f9c80e] text-sm">
              {c.text('story.eyebrow')}
            </span>
          </div>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-serif text-slate-900 dark:text-white font-medium mb-16">
            {c.text('story.heading')}
          </h2>
        </div>

        <div className="grid md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-12 lg:col-span-10 lg:col-start-2">
            <div className={`relative ${p1 || p2 || lead ? 'mb-12' : ''}`}>
              <span className="absolute -top-12 -left-8 text-8xl text-cyan-500/20 font-serif z-10 hidden md:block">"</span>
              <AnimatedTextReveal
                key={c.text('story.quote')}
                text={c.text('story.quote')}
                className="text-3xl md:text-4xl lg:text-5xl font-serif italic text-cyan-900 dark:text-white leading-relaxed"
                containerClassName="py-0"
              />
            </div>

            {(lead || p1) && (
              <p className={`text-lg md:text-xl text-slate-600 dark:text-slate-300 font-sans font-light leading-relaxed ${p2 ? 'mb-8' : ''}`}>
                {lead && <><span className="font-bold text-slate-900 dark:text-white">{lead}</span> </>}
                {p1}
              </p>
            )}
            {p2 && (
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 font-sans font-light leading-relaxed">
                {p2}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 3. The Craftsmanship Section */}
      <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-[#0a1526] w-full">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px w-12 bg-[#f9c80e]"></div>
              <span className="font-sans font-bold uppercase tracking-[0.2em] text-[#f9c80e] text-sm">
                {c.text('craft.eyebrow')}
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-serif text-slate-900 dark:text-white font-medium mb-8">
              <Lines text={c.text('craft.heading')} />
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 font-sans font-light">
              {c.text('craft.intro')}
            </p>
          </div>

          <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-16 mb-20">
            {columns.map((col, colIndex) => col.length > 0 && (
              <ul key={colIndex} className={colIndex === 0 ? 'space-y-12' : 'space-y-12 lg:mt-0 mt-[-2rem]'}>
                {col.map((f, i) => (
                  <li key={i} className="relative pl-8 border-l-2 border-cyan-500/30">
                    {bullet(i)}
                    <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">{f.title}</span>
                    <span className="block text-xl font-serif italic text-slate-600 dark:text-white">{f.text}</span>
                  </li>
                ))}
              </ul>
            ))}

            {hasCallout && (
              <div className="bg-white dark:bg-[#101C2B] p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-cyan-900/30">
                {calloutTitle && (
                  <h3 className="text-2xl font-serif italic text-cyan-600 dark:text-brand-gold mb-6">{calloutTitle}</h3>
                )}
                {calloutText && (
                  <p className="text-lg text-slate-600 dark:text-slate-300 font-light leading-relaxed">{calloutText}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Footer Gallery Section */}
      <PoolFooterGallery images={gallery} poolType={poolType} poolName={poolName} />
    </div>
  );
}
