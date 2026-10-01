import { usePageMeta } from '../../hooks/usePageMeta';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight, Download,
  Droplets, Link, Gem,
  Clock, Settings, CalendarCheck,
  Ruler, Palette, PenLine, Layers,
  RefreshCw, Zap, Wrench,
  CircleDollarSign, Award, Timer, Shield, Check,
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { Highlighted, Lines, parsePairs, pageImage, usePageContent } from '../../lib/pageContent';
import { readymadeServicePage } from '../../content/pages/readymadeService';
import { DOCUMENTS } from '../../config/documents';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Feature { icon: LucideIcon; label: string; sub: string; }
interface Advantage {
  id: string;
  titleLine1: string;
  titleLine2: string;
  desc: string;
  image: string;
  dividerVariant: 'lotus' | 'leaf' | 'chart';
  features: Feature[];
  valueProp?: string;
  valueText?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────
// Icons and divider style per advantage position (text and images are edited in the admin panel).
const ADVANTAGE_STYLES: { icons: LucideIcon[]; dividerVariant: Advantage['dividerVariant'] }[] = [
  { icons: [Droplets, Link, Gem], dividerVariant: 'lotus' },
  { icons: [Clock, Settings, CalendarCheck], dividerVariant: 'lotus' },
  { icons: [Ruler, Layers, Palette, PenLine], dividerVariant: 'lotus' },
  { icons: [RefreshCw, Zap, Wrench], dividerVariant: 'leaf' },
  { icons: [CircleDollarSign, Award, Timer, Shield], dividerVariant: 'chart' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Decorative gold shield badge with number */
function ShieldBadge({ n, prefix }: { n: number; prefix: string }) {
  const label = String(n).padStart(2, '0');
  return (
    <div className="flex items-center gap-3 mb-8">
      {/* SVG shield */}
      <div className="relative w-11 h-12 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full">
          <path
            d="M22 1.5L41 9.5V26C41 38 32.5 47.5 22 50.5C11.5 47.5 3 38 3 26V9.5L22 1.5Z"
            stroke="#c9963c"
            strokeWidth="1.5"
          />
          <path
            d="M22 6L37 12.5V26C37 36 30 44 22 46.5C14 44 7 36 7 26V12.5L22 6Z"
            stroke="#c9963c"
            strokeWidth="0.75"
            strokeDasharray="2 2"
            opacity="0.5"
          />
        </svg>
        <span className="relative text-[#c9963c] font-bold text-sm font-display leading-none">{label}</span>
      </div>
      <span className="text-[#c9963c] font-sans font-bold tracking-[0.35em] text-[11px] uppercase">
        {prefix} {label}
      </span>
    </div>
  );
}

/** Inline SVG lotus / leaf / chart icons for the decorative divider */
function DividerIcon({ variant }: { variant: Advantage['dividerVariant'] }) {
  if (variant === 'lotus') {
    return (
      <svg viewBox="0 0 24 20" fill="none" className="w-5 h-4 text-[#c9963c] fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1C10 4 9 7 9 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0-2-1-5-3-8zm-5 7c-1.3 1.5-1.5 3.2-.8 4.8 1.2-.8 2.2-2 2.7-3.5C8 9.8 7.5 9.3 7 8zm10 0c-.5.5-1 1.7-1.9 1.3.5 1.5 1.5 2.7 2.7 3.5.7-1.6.5-3.3-.8-4.8zM5.5 14c.8 1.2 2.5 1.5 6.5 1.5s5.7-.3 6.5-1.5c-1.5.4-3.5.5-6.5.5s-5-.1-6.5-.5z"/>
      </svg>
    );
  }
  if (variant === 'leaf') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-[#c9963c]" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
      </svg>
    );
  }
  // chart
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-[#c9963c]" xmlns="http://www.w3.org/2000/svg">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}

function GoldDivider({ variant }: { variant: Advantage['dividerVariant'] }) {
  return (
    <div className="flex items-center gap-3 my-7">
      <div className="w-10 h-px bg-[#c9963c]" />
      <DividerIcon variant={variant} />
      <div className="w-10 h-px bg-[#c9963c]" />
    </div>
  );
}

function FeatureRow({ features }: { features: Feature[] }) {
  return (
    <div className="flex flex-wrap items-start gap-x-0 gap-y-6 mt-10 pt-8 border-t border-[#c9963c]/20">
      {features.map((feat, i) => (
        <div key={i} className="flex items-start gap-0">
          {i > 0 && (
            <div className="self-stretch w-px bg-[#c9963c]/30 mx-5 mt-1 hidden sm:block" />
          )}
          <div className="flex flex-col items-center text-center min-w-18 max-w-22.5">
            <div className="w-9 h-9 rounded-full border border-[#c9963c]/60 flex items-center justify-center mb-2 bg-[#c9963c]/5">
              <feat.icon className="w-4 h-4 text-[#c9963c]" />
            </div>
            <p className="text-[9px] font-extrabold tracking-[0.15em] uppercase text-slate-800 dark:text-slate-200 leading-tight">
              {feat.label}
            </p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
              {feat.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Single editorial advantage card */
function AdvantageSection({ adv, index, badgePrefix }: { adv: Advantage; index: number; badgePrefix: string; key?: React.Key }) {
  const isEven = index % 2 === 0;

  return (
    <motion.section
      className="w-full flex flex-col lg:flex-row min-h-screen"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
    >
      {/* ── Text panel ── */}
      <div
        className={`lg:w-[42%] bg-white dark:bg-[#050d18] flex flex-col justify-center px-8 sm:px-14 lg:px-16 xl:px-20 py-16 lg:py-24 ${
          !isEven ? 'lg:order-2' : ''
        }`}
      >
        <motion.div
          initial={{ opacity: 0, x: isEven ? -30 : 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1], delay: 0.1 }}
        >
          <ShieldBadge n={index + 1} prefix={badgePrefix} />

          <h2 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-display font-bold text-[#0a1628] dark:text-white leading-tight mb-1">
            {adv.titleLine1}
          </h2>
          <h2 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-serif italic text-[#c9963c] leading-tight font-normal">
            {adv.titleLine2}
          </h2>

          <GoldDivider variant={adv.dividerVariant} />

          <p className="text-base lg:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light max-w-sm">
            {adv.desc}
          </p>

          <FeatureRow features={adv.features} />

          {/* Optional value-prop badge (last card) */}
          {adv.valueProp && (
            <div className="mt-8 inline-flex items-center gap-3 border border-[#c9963c]/40 px-5 py-3">
              <Check className="w-4 h-4 text-[#c9963c] shrink-0" />
              <div>
                <p className="text-[10px] font-extrabold tracking-[0.25em] uppercase text-slate-800 dark:text-slate-200">
                  {adv.valueProp}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {adv.valueText}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Image panel ── */}
      <div
        className={`lg:w-[58%] h-[55vw] lg:h-auto overflow-hidden bg-slate-800 ${
          !isEven ? 'lg:order-1' : ''
        }`}
      >
        <motion.img
          src={adv.image}
          alt={`${adv.titleLine1} ${adv.titleLine2}`}
          className="w-full h-full object-cover"
          initial={{ scale: 1.06 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1.2, ease: [0.33, 1, 0.68, 1] }}
        />
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ReadymadePools() {
  const c = usePageContent(readymadeServicePage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'), c.image('hero.image'));
  const items = c.list('advantages.items');
  const ADVANTAGES: Advantage[] = items.map((item, i) => {
    const style = ADVANTAGE_STYLES[i % ADVANTAGE_STYLES.length];
    const isLast = i === items.length - 1;
    return {
      id: String(i),
      titleLine1: item.titleLine1,
      titleLine2: item.titleLine2,
      desc: item.desc,
      image: pageImage(item.image),
      dividerVariant: style.dividerVariant,
      features: parsePairs(item.features).map((f, j) => ({ icon: style.icons[j % style.icons.length], label: f.label, sub: f.sub })),
      valueProp: isLast ? c.text('advantages.valueTitle') : undefined,
      valueText: isLast ? c.text('advantages.valueText') : undefined,
    };
  });

  return (
    <div className="bg-white dark:bg-[#060F1A] font-sans selection:bg-brand-blue selection:text-white">

      {/* ── 1. Hero ── */}
      <section className="relative w-full h-screen overflow-hidden flex items-center bg-black">
        <div className="absolute inset-0">
          <img
            src={c.image('hero.image')}
            alt={c.text('hero.alt')}
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-linear-to-r from-[#050d1a]/90 via-[#050d1a]/50 to-transparent" />
        </div>

        <div className="relative z-10 px-8 sm:px-16 md:px-24 lg:px-32 max-w-3xl pt-20">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="w-8 h-px bg-[#c9963c]" />
            <span className="text-[#c9963c] font-bold text-xs tracking-[0.35em] uppercase">
              {c.text('hero.eyebrow')}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.33, 1, 0.68, 1] }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-light text-white leading-none mb-6"
          >
            <Lines text={c.text('hero.title')} /><br />
            <span className="text-[#c9963c] font-serif italic font-normal">{c.text('hero.highlight')}</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="w-10 h-px bg-[#c9963c]" />
            <DividerIcon variant="lotus" />
            <div className="w-10 h-px bg-[#c9963c]" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="text-base md:text-lg text-slate-200 font-light leading-relaxed max-w-sm"
          >
            <Highlighted text={c.text('hero.subtitle')} className="text-[#c9963c]" />
          </motion.p>
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 1 }}
        >
          <span className="text-white/30 text-[10px] tracking-[0.3em] uppercase">Scroll</span>
          <div className="w-px h-12 bg-white/20 relative overflow-hidden">
            <motion.div
              className="absolute inset-x-0 top-0 w-full bg-white/60 h-full"
              animate={{ y: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      </section>

      {/* ── 2. Paradigm intro ── */}
      <section className="py-20 md:py-28 px-6 bg-white dark:bg-[#060F1A]">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 1.2, ease: [0.33, 1, 0.68, 1] }}
          className="max-w-4xl mx-auto text-center"
        >
          <p className="text-[#c9963c] font-bold text-xs tracking-[0.35em] uppercase mb-5">
            {c.text('intro.eyebrow')}
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-[#0a1628] dark:text-white mb-8 tracking-tight leading-tight">
            {c.text('intro.heading').split('\n').map((line, i) => (
              <span key={i}>{i > 0 && <><br className="hidden sm:block" /> </>}{line}</span>
            ))}
          </h2>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 leading-relaxed font-light max-w-3xl mx-auto">
            {c.text('intro.text')}
          </p>
        </motion.div>
      </section>

      {/* ── 3. Section header ── */}
      <div className="bg-[#faf8f4] dark:bg-[#050d18] py-12 px-8 text-center border-y border-[#c9963c]/15">
        <p className="text-[#c9963c] font-bold text-[10px] tracking-[0.4em] uppercase mb-2">
          {c.text('intro.pillarsEyebrow')}
        </p>
        <h3 className="text-2xl md:text-3xl font-display font-bold text-[#0a1628] dark:text-white">
          {c.text('intro.pillarsHeading')}
        </h3>
      </div>

      {/* ── 4. Advantage sections ── */}
      {ADVANTAGES.map((adv, i) => (
        <AdvantageSection key={adv.id} adv={adv} index={i} badgePrefix={c.text('advantages.badgePrefix')} />
      ))}

      {/* ── 5. CTA ── */}
      <section className="py-32 px-6 bg-[#faf8f4] dark:bg-[#060F1A] flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="max-w-3xl w-full"
        >
          <p className="text-[#c9963c] font-bold text-[10px] tracking-[0.4em] uppercase mb-6">
            {c.text('cta.eyebrow')}
          </p>
          <h2 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-4 leading-none text-[#0a1628] dark:text-white">
            {c.text('cta.heading')}
          </h2>
          <h2 className="text-5xl md:text-7xl font-serif italic font-normal text-[#c9963c] mb-16 leading-none">
            {c.text('cta.highlight')}
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <RouterLink
              to="/contact-swimming-pool-contractor#inquiry"
              className="group inline-flex items-center gap-4 px-10 py-5 bg-[#0a1628] dark:bg-[#c9963c] text-white dark:text-[#0a1628] hover:bg-[#c9963c] dark:hover:bg-[#b8852a] hover:text-[#0a1628] transition-all duration-300 uppercase tracking-[0.2em] text-sm font-bold"
            >
              {c.text('cta.button')}
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </RouterLink>

            <a
              href={DOCUMENTS.frpPoolBrochure}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 border border-[#c9963c]/50 text-[#c9963c] hover:border-[#c9963c] hover:bg-[#c9963c]/5 transition-all duration-300 uppercase tracking-[0.2em] text-sm font-bold px-8 py-5"
            >
              <Download size={16} />
              {c.text('cta.brochureButton')}
            </a>
          </div>
        </motion.div>
      </section>

    </div>
  );
}
