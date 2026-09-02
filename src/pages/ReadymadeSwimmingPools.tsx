import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import AnimatedTextReveal from '../components/AnimatedTextReveal';
import LiquidWaterEffect from '../components/LiquidWaterEffect';
import { CheckCircle2 } from 'lucide-react';
import { IMAGES } from '../config/images';
import PoolFooterGallery from '../components/PoolFooterGallery';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { usePageMeta } from '../hooks/usePageMeta';

export default function ReadymadeSwimmingPools() {
  usePageMeta(
    'Readymade Swimming Pools',
    'Prefabricated FRP readymade and portable swimming pools in Pune for fast installation. Quick setup, durable construction, and full equipment support from Crystal Pools.',
  );
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#060F1A] overflow-hidden">
      
      {/* 1. The Hero Section */}
      <section className="relative w-full min-h-[100dvh] md:min-h-[800px] flex flex-col justify-end pb-16 md:pb-24 px-4 sm:px-6 lg:px-8 pt-24">
        {/* Background Layer */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#060F1A]">
          <img 
            src={IMAGES.poolTypes.readymade}
            alt="Readymade Swimming Pool" 
            className="absolute inset-0 w-full h-full object-cover object-center md:object-[center_30%] opacity-90"
          />
        </div>

        {/* Foreground Content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-end gap-6 md:gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="max-w-3xl"
          >
            <h1 className="text-3xl md:text-5xl lg:text-6xl text-white dark:text-brand-gold font-sans font-bold leading-[1.2] mb-2 md:mb-4">
              Efficient and Elegant,<br />
              <span className="font-serif italic text-[#f9c80e] font-normal text-5xl md:text-7xl lg:text-8xl">Readymade FRP Pools.</span>
            </h1>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="max-w-lg pb-0 md:pb-4"
          >
            <p className="text-lg md:text-xl text-white font-medium drop-shadow-xl leading-relaxed">
              The trend of portable, readymade swimming pools is catching up fast in the Indian market, including in Pune. From villas and resorts to sports clubs and wellness centers, clients prefer them for their immense flexibility.
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
            Best Readymade FRP Pools in India
          </h2>
        </div>

        <div className="grid md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-12 lg:col-span-10 lg:col-start-2">
            <div className="relative mb-12">
              <span className="absolute -top-12 -left-8 text-8xl text-cyan-500/20 font-serif z-10 hidden md:block">"</span>
              <AnimatedTextReveal 
                text="As a rapidly emerging supplier in India, Crystal Pools offers premium quality pre-fabricated pools that benefit owners with amazing convenience and distinct advantages."
                className="text-3xl md:text-4xl lg:text-5xl font-serif italic text-cyan-900 dark:text-white leading-relaxed"
                containerClassName="py-0"
              />
            </div>
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
              Readymade Swimming Pool Benefits
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 font-sans font-light">
              Experience the future of aquatic luxury with these distinct advantages over traditional construction:
            </p>
          </div>

          <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-16 mb-20">
            <ul className="space-y-12">
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[14px] top-1 px-1 bg-slate-50 dark:bg-[#0a1526]">
                  <CheckCircle2 className="w-6 h-6 text-cyan-500" />
                </span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Bespoke Designs:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">High degree of customization in terms of shape, colour, size, and finishes to match your unique vision.</span>
              </li>
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[14px] top-1 px-1 bg-slate-50 dark:bg-[#0a1526]">
                  <CheckCircle2 className="w-6 h-6 text-[#f9c80e]" />
                </span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Faster Turnaround:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">Quick project delivery and installation as compared to traditional swimming pools, minimizing disruption.</span>
              </li>
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[14px] top-1 px-1 bg-slate-50 dark:bg-[#0a1526]">
                  <CheckCircle2 className="w-6 h-6 text-cyan-500" />
                </span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Excellent Performance:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">Zero water wastage; lesser energy consumption; low maintenance over the pool's lifetime.</span>
              </li>
            </ul>

            <ul className="space-y-12 lg:mt-0 mt-[-2rem]">
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[14px] top-1 px-1 bg-slate-50 dark:bg-[#0a1526]">
                  <CheckCircle2 className="w-6 h-6 text-cyan-500" />
                </span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Single-piece Structure:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">Seamless construction guarantees no water seepage or leakage, ensuring long-term structural integrity.</span>
              </li>
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[14px] top-1 px-1 bg-slate-50 dark:bg-[#0a1526]">
                  <CheckCircle2 className="w-6 h-6 text-[#f9c80e]" />
                </span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Cost-effective Solution:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">An economical alternative to traditional pools. You will be surprised to know about the readymade swimming pool price in India!</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Footer Gallery Section */}
      <PoolFooterGallery 
        images={POOL_GALLERIES.readymade} 
        poolName="Readymade Pools" 
      />

    </div>
  );
}
