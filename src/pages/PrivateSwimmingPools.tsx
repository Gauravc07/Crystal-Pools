import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import AnimatedTextReveal from '../components/AnimatedTextReveal';
import LiquidWaterEffect from '../components/LiquidWaterEffect';
import { IMAGES } from '../config/images';
import PoolFooterGallery from '../components/PoolFooterGallery';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { usePageMeta } from '../hooks/usePageMeta';

export default function PrivateSwimmingPools() {
  usePageMeta(
    'Private Swimming Pools',
    'Crystal Pools is a trusted private swimming pool consultant and builder in Pune, offering bespoke private swimming pool design and construction across India.',
  );
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#060F1A] overflow-hidden">
      
      {/* 1. The Hero Section */}
      <section className="relative w-full min-h-[100dvh] md:min-h-[800px] flex flex-col justify-end pb-16 md:pb-24 px-4 sm:px-6 lg:px-8 pt-24">
        {/* Background Layer */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#060F1A]">
          <img 
            src={IMAGES.poolTypes.private}
            alt="Private Swimming Pool" 
            className="absolute inset-0 w-full h-full object-cover object-center md:object-[center_20%] opacity-90"
          />
        </div>

        {/* Foreground Content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-end gap-6 md:gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="max-w-2xl"
          >
            <h1 className="text-3xl md:text-5xl lg:text-6xl text-white dark:text-brand-gold font-sans font-bold leading-[1.2] mb-2 md:mb-4">
              Your Personal Sanctuary,<br />
              <span className="font-serif italic text-[#f9c80e] font-normal text-5xl md:text-7xl lg:text-8xl">Redefined.</span>
            </h1>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="max-w-lg pb-0 md:pb-4"
          >
            <p className="text-lg md:text-xl text-white font-medium drop-shadow-xl leading-relaxed">
              As India's premier private swimming pool contractors, builders, and consultants in Pune, we blend architectural elegance with 25+ years of engineering mastery to transform your residence into a masterpiece of leisure.
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
              THE STORY
            </span>
          </div>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-serif text-slate-900 dark:text-white font-medium mb-16">
            Beyond Concrete and Water
          </h2>
        </div>

        <div className="grid md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-12 lg:col-span-10 lg:col-start-2">
            <div className="relative mb-12">
              <span className="absolute -top-12 -left-8 text-8xl text-cyan-500/20 font-serif z-10 hidden md:block">"</span>
              <AnimatedTextReveal 
                text="A private swimming pool is more than just a luxury. It is a liquid landscape where memories are made. At Crystal Pools, we believe your home deserves a graceful touch of luxury that balances peak performance with breathtaking aesthetics."
                className="text-3xl md:text-4xl lg:text-5xl font-serif italic text-cyan-900 dark:text-white leading-relaxed"
                containerClassName="py-0"
              />
            </div>
            
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 font-sans font-light leading-relaxed mb-8">
              While traditional private pools typically range from 12 ft x 24 ft to 20 ft x 40 ft, we don't believe in "standard" dimensions. Whether it is an intimate indoor retreat in a refurbished basement or a sprawling garden centerpiece, our private swimming pool design is limited only by your imagination.
            </p>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 font-sans font-light leading-relaxed">
              We bridge the gap between cost-efficiency and high-end performance, ensuring that you never have to cut corners to achieve your dream. From private swimming pool construction in our home city of Pune to the most exclusive private estates across India, we bring the "resort life" home.
            </p>
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
                OUR CRAFTSMANSHIP
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-serif text-slate-900 dark:text-white font-medium mb-8">
              Precision Engineering for<br />Peace of Mind
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 font-sans font-light">
              We specialize in the three pillars of premium pool construction:
            </p>
          </div>

          <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-16 mb-20">
            <ul className="space-y-12">
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-cyan-500"></span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Concrete Artistry:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">For permanent, bespoke shapes that last a lifetime.</span>
              </li>
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-[#f9c80e]"></span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">One-Piece Fiberglass:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">For those seeking sleek design with rapid installation.</span>
              </li>
            </ul>

            <div className="bg-white dark:bg-[#101C2B] p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-cyan-900/30">
              <h3 className="text-2xl font-serif italic text-cyan-600 dark:text-brand-gold mb-6">
                Safety is our Silent Promise
              </h3>
              <p className="text-lg text-slate-600 dark:text-slate-300 font-light leading-relaxed">
                We recognize that a family pool must be a safe pool. We integrate sophisticated fencing and isolation solutions that meet international standards, ensuring your oasis remains a place of joy for every member of the family, especially the little ones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Footer Gallery Section */}
      <PoolFooterGallery 
        images={POOL_GALLERIES.private} 
        poolName="Private Swimming Pools" 
      />

    </div>
  );
}
