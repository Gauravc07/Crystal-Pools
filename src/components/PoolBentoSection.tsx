import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import TiltCard from './TiltCard';

const POOL_TYPES = [
  {
    id: 'private-swimming-pools',
    title: 'PRIVATE SWIMMING POOLS',
    desc: 'Private swimming pools are usually smaller than public pools, offering personal retreats tailored to your individual style and available space. We focus on bespoke designs.',
    img: '/images/pool-types/private.jpg'
  },
  {
    id: 'commercial-swimming-pools',
    title: 'COMMERCIAL SWIMMING POOLS',
    desc: 'Crystal pool has expertise with Commercial swimming pools for hotels, resorts, and apartment complexes. Designed for high traffic and maximum durability.',
    img: '/images/pool-types/commercial.jpg'
  },
  {
    id: 'recreation-swimming-pools',
    title: 'RECREATION SWIMMING POOLS',
    desc: 'Public pools are often part of a larger leisure center or recreational complex featuring lazy rivers, wave pools, and splash pads.',
    img: '/images/pool-types/recreational.jpg'
  },
  {
    id: 'competition-swimming-pools',
    title: 'COMPETITION SWIMMING POOLS',
    desc: 'FINA-standard competition pools engineered for excellence. We build Olympic-grade pools with precise dimensions, wave-reducing gutters, and compliance with international competition standards.',
    img: '/images/pool-types/competition.jpg'
  },
  {
    id: 'vanishing-edge-swimming-pools',
    title: 'VANISHING EDGE SWIMMING POOLS',
    desc: 'Vanishing edge pool is a swimming or reflecting pool that produces a visual effect of water extending to the horizon. Perfect for scenic locations.',
    img: '/images/pool-types/vanishing-edge.png'
  },
  {
    id: 'overflow-type-swimming-pools',
    title: 'OVERFLOW TYPE SWIMMING POOLS',
    desc: 'A perimeter-overflow pool is a type of vanishing-edge pool designed so that water spills over all four walls, creating a flawless mirror surface.',
    img: '/images/pool-types/overflow.png'
  },
  {
    id: 'skimmer-type-swimming-pools',
    title: 'SKIMMER TYPE SWIMMING POOLS',
    desc: 'A skimmer swimming pool is designed to pull water into the system from the pools surface with a skimming action. Highly efficient and cost-effective.',
    img: '/images/pool-types/skimmer.png'
  },
  {
    id: 'readymade-swimming-pool',
    title: 'READYMADE SWIMMING POOL',
    desc: 'Prefabs and readymade pools offer quick installation. Our service department is available for all equipment repair and replace as well as new readymade installs.',
    img: '/images/pool-types/readymade.png'
  }
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
  return (
    <section className="py-24 bg-white dark:bg-[#060F1A] transition-colors duration-500 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 border-gray-100">
        <div className="max-w-2xl">
          <h2 className="text-sm font-bold text-[#f9c80e] uppercase tracking-[0.3em] mb-4">Portfolio Diversity</h2>
          <h3 className="text-4xl md:text-5xl font-bold text-[#0a5c86] dark:text-white font-display leading-[1.1]">
            Versatile Aquatic Architecture
          </h3>
          <p className="mt-4 text-gray-600 dark:text-slate-400">
            Explore all type of swimming pools in India — click on any pool type to learn more about our construction techniques.
          </p>
        </div>
      </div>

      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 auto-rows-[250px] md:auto-rows-[320px] lg:auto-rows-[350px] grid-flow-dense">
          {POOL_TYPES.map((pool, idx) => (
            <div key={idx} className={`${getBentoClass(idx)} rounded-[20px] perspective-[1000px]`}>
              <TiltCard className="w-full h-full">
                <Link
                  to={pool.id === 'private-swimming-pools' ? '/private-swimming-pools' : pool.id === 'commercial-swimming-pools' ? '/commercial-swimming-pools' : pool.id === 'recreation-swimming-pools' ? '/recreational-swimming-pools' : pool.id === 'competition-swimming-pools' ? '/competition-swimming-pools' : pool.id === 'vanishing-edge-swimming-pools' ? '/vanishing-edge-swimming-pools' : pool.id === 'overflow-type-swimming-pools' ? '/overflow-type-swimming-pools' : pool.id === 'skimmer-type-swimming-pools' ? '/skimmer-type-swimming-pools' : pool.id === 'readymade-swimming-pool' ? '/readymade-swimming-pool' : '/swimming-pool-types'}
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
                      Learn More <ArrowRight size={16} className="ml-2" />
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
