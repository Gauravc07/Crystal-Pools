import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePageContent, pageImage } from '../lib/pageContent';
import { servicesPage } from '../content/pages/hubs';

// Layout and link for each card position; text and images come from the admin panel.
const SLOTS = [
  { path: '/services/turnkey-projects', variant: 'hero' as const },
  { path: '/services/waterfall-fountain', variant: 'side' as const },
  { path: '/services/pool-tiles', variant: 'side' as const },
  { path: '/services/accessories', variant: 'base' as const },
  { path: '/services/readymade-pools', variant: 'base' as const },
  { path: '/services/renovation', variant: 'base' as const },
];

const colClass = {
  hero: 'md:col-span-2 md:row-span-2',
  side: 'md:col-span-1 md:row-span-1',
  base: 'md:col-span-1 md:row-span-1',
};

const minH = {
  hero: 'min-h-[400px]',
  side: 'min-h-[260px]',
  base: 'min-h-[240px]',
};

const gradientClass = {
  hero: 'bg-linear-to-t from-black/90 via-black/45 to-black/10',
  side: 'bg-linear-to-t from-black/85 via-black/30 to-transparent',
  base: 'bg-linear-to-t from-black/80 via-black/20 to-transparent',
};

export default function Services() {
  const c = usePageContent(servicesPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'));
  const services = c.list('cards.items').slice(0, SLOTS.length).map((item, i) => ({
    num: String(i + 1).padStart(2, '0'),
    category: item.category,
    title: item.title,
    description: item.description,
    image: pageImage(item.image),
    ...SLOTS[i],
  }));
  return (
    <div className="bg-[#f8fafc] dark:bg-[#060F1A] min-h-screen pt-32 pb-24 transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <p className="text-xs font-bold text-[#f9c80e] uppercase tracking-[0.3em] mb-4">{c.text('header.eyebrow')}</p>
          <h1 className="text-5xl md:text-6xl font-display font-bold text-[#0a5c86] dark:text-white mb-5 tracking-tight">
            {c.text('header.heading')}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            {c.text('header.intro')}
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-[440px_440px_300px] gap-3 md:gap-3.5">
          {services.map((service, i) => {
            const isHero = service.variant === 'hero';
            const isSide = service.variant === 'side';

            return (
              <motion.div
                key={service.num}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer
                  ${colClass[service.variant]} ${minH[service.variant]}`}
              >
                {/* Background image */}
                <div className="absolute inset-0 z-0">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-[0.25,1,0.5,1] group-hover:scale-[1.06]"
                  />
                </div>

                {/* Gradient overlay */}
                <div className={`absolute inset-0 z-10 ${gradientClass[service.variant]}`} />

                {/* Content */}
                <div className={`absolute inset-0 z-20 flex flex-col justify-between
                  ${isHero ? 'p-8 md:p-10' : isSide ? 'p-6 md:p-7' : 'p-5 md:p-6'}`}
                >
                  {/* Top row: card number + optional badge */}
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-[10px] font-bold tracking-[0.25em] text-[#f9c80e]/60">
                      {service.num}
                    </span>
                    {isHero && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50 border border-white/20 px-2.5 py-1 rounded-full backdrop-blur-sm">
                        {c.text('cards.badge')}
                      </span>
                    )}
                  </div>

                  {/* Bottom: text */}
                  <div>
                    {/* Gold divider (hero only) */}
                    {isHero && (
                      <div className="w-8 h-0.5 bg-[#f9c80e] mb-4 opacity-80" />
                    )}

                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#f9c80e] mb-2">
                      {service.category}
                    </p>

                    <h3 className={`font-display font-bold text-white tracking-tight leading-tight
                      ${isHero ? 'text-3xl md:text-4xl lg:text-[2.6rem] mb-4' : isSide ? 'text-xl md:text-2xl mb-3' : 'text-lg md:text-xl mb-3'}`}
                    >
                      {service.title}
                    </h3>

                    {/* Description only on hero and side cards */}
                    {(isHero || isSide) && (
                      <p className={`text-white/65 leading-relaxed
                        ${isHero ? 'text-base md:text-[1.05rem] max-w-sm mb-7' : 'text-xs md:text-sm max-w-[220px] mb-5'}`}
                      >
                        {service.description}
                      </p>
                    )}

                    {/* CTA */}
                    <Link
                      to={service.path}
                      className="inline-flex items-center gap-1.5 font-bold uppercase text-white
                        hover:text-[#f9c80e] transition-colors duration-300 group/link"
                      style={{ fontSize: isHero ? '0.65rem' : '0.6rem', letterSpacing: '0.2em' }}
                    >
                      {c.text('cards.linkText')}
                      <ArrowUpRight className={`transition-transform duration-300
                        group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5
                        ${isHero ? 'w-4 h-4' : 'w-3 h-3'}`}
                      />
                    </Link>
                  </div>
                </div>

                {/* Hover ring */}
                <div className="absolute inset-0 z-30 rounded-2xl ring-1 ring-inset ring-white/0 group-hover:ring-white/10 transition-all duration-500 pointer-events-none" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
