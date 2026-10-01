import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import TiltCard from './TiltCard';
import { usePageContent, pageImage } from '../lib/pageContent';
import { poolTypesPage } from '../content/pages/hubs';

// Each card position links to its pool type page.
const POOL_PATHS = [
  '/private-swimming-pools',
  '/commercial-swimming-pools',
  '/recreational-swimming-pools',
  '/competition-swimming-pools',
  '/vanishing-edge-swimming-pools',
  '/overflow-type-swimming-pools',
  '/skimmer-type-swimming-pools',
  '/readymade-swimming-pool',
];

const getBentoClass = (idx: number) => {
  switch (idx) {
    case 0: return 'col-span-1 md:col-span-2 lg:col-span-2 row-span-1 md:row-span-2 lg:row-span-2';
    case 1: return 'col-span-1 lg:col-span-1 row-span-1';
    case 2: return 'col-span-1 lg:col-span-1 row-span-1';
    case 3: return 'col-span-1 md:col-span-2 lg:col-span-2 row-span-1';
    case 4: return 'col-span-1 lg:col-span-1 row-span-1 lg:row-span-2';
    case 5: return 'col-span-1 md:col-span-2 lg:col-span-2 row-span-1';
    case 6: return 'col-span-1 lg:col-span-1 row-span-1';
    case 7: return 'col-span-1 md:col-span-2 lg:col-span-3 row-span-1';
    default: return 'col-span-1 row-span-1';
  }
};

export default function PoolBentoSection() {
  const c = usePageContent(poolTypesPage);
  const POOL_TYPES = c.list('cards.items').map((item, i) => ({
    title: item.title,
    img: pageImage(item.image),
    path: POOL_PATHS[i] ?? '/swimming-pool-types',
  }));
  return (
    <section className="py-24 bg-white dark:bg-[#060F1A] transition-colors duration-500 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 border-gray-100">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-[#f9c80e] uppercase tracking-[0.3em] mb-4">{c.text('header.eyebrow')}</p>
          <h1 className="text-4xl md:text-5xl font-bold text-[#0a5c86] dark:text-white font-display leading-[1.1]">
            {c.text('header.heading')}
          </h1>
          <p className="mt-4 text-gray-600 dark:text-slate-400">
            {c.text('header.intro')}
          </p>
        </div>
      </div>

      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 auto-rows-[250px] md:auto-rows-[320px] lg:auto-rows-[350px] grid-flow-dense">
          {POOL_TYPES.map((pool, idx) => (
            <div key={idx} className={`${getBentoClass(idx)} rounded-[20px] perspective-[1000px]`}>
              <TiltCard className="w-full h-full">
                <Link
                  to={pool.path}
                  className="group relative block w-full h-full rounded-[20px] overflow-hidden cursor-pointer bg-[#101C2B]"
                >
                  <img 
                    src={pool.img} 
                    alt={pool.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent" />
                  
                  <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col justify-end" style={{ transform: 'translateZ(30px)' }}>
                    <h4 
                      className="text-white text-xl md:text-2xl font-bold font-display tracking-tight mb-2"
                    >
                      {pool.title}
                    </h4>
                    <div className="flex items-center text-[#f9c80e] font-bold text-sm tracking-widest uppercase animate-pulse">
                      {c.text('cards.linkText')} <ArrowRight size={16} className="ml-2" />
                    </div>
                  </div>
                </Link>
              </TiltCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
