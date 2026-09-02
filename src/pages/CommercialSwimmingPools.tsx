import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import AnimatedTextReveal from '../components/AnimatedTextReveal';
import LiquidWaterEffect from '../components/LiquidWaterEffect';
import PoolFooterGallery from '../components/PoolFooterGallery';
import { IMAGES } from '../config/images';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { usePageMeta } from '../hooks/usePageMeta';

export default function CommercialSwimmingPools() {
  usePageMeta(
    'Commercial Swimming Pools',
    'Crystal Pools is a leading commercial swimming pool consultant and pool builder in Pune, designing high-traffic commercial swimming pools for hotels, resorts, and apartment complexes across India.',
  );
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#060F1A] overflow-hidden">
      
      {/* 1. The Hero Section */}
      <section className="relative w-full min-h-[100dvh] md:min-h-[800px] flex flex-col justify-end pb-16 md:pb-24 px-4 sm:px-6 lg:px-8 pt-24">
        {/* Background Layer */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#060F1A]">
          <img 
            src={IMAGES.poolTypes.commercial}
            alt="Commercial Swimming Pool" 
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
              Commercial<br />
              <span className="font-serif italic text-[#f9c80e] font-normal text-5xl md:text-7xl lg:text-8xl">Swimming Pools.</span>
            </h1>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="max-w-lg pb-0 md:pb-4"
          >
            <p className="text-lg md:text-xl text-white font-medium drop-shadow-xl leading-relaxed">
              As India's premier commercial swimming pool contractors and commercial pool consultants in Pune, we blend over 25 years of industry experience with innovative design to maximize productivity, aesthetic appeal, and long-term performance for your project.
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
            An Asset, Not Just an Amenity
          </h2>
        </div>

        <div className="grid md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-12 lg:col-span-10 lg:col-start-2">
            <div className="relative mb-12">
              <span className="absolute -top-12 -left-8 text-8xl text-cyan-500/20 font-serif z-10 hidden md:block">"</span>
              <AnimatedTextReveal 
                text="A commercial pool is a powerful business asset that can yield cost-effective performance, boost ROI, aid in branding, and enhance the overall customer experience."
                className="text-3xl md:text-4xl lg:text-5xl font-serif italic text-cyan-900 dark:text-white leading-relaxed"
                containerClassName="py-0"
              />
            </div>
            
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 font-sans font-light leading-relaxed mb-8">
              <span className="font-bold text-slate-900 dark:text-white">The Crystal Advantage:</span> Today's modern leisure centers, luxury hotels, schools, and hydrotherapy facilities need more than an attractive commercial swimming pool design. They demand durable structures equipped to handle the heaviest bathing loads with absolute reliability.
            </p>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 font-sans font-light leading-relaxed">
              Having successfully completed over 3,100 swimming pools across more than 50 Pan-India locations — including commercial swimming pools in Pune — Crystal Pools adds measurable value to your development. From our in-house AutoCAD drafting to rigorous on-site supervision, we ensure that your aquatic facility becomes a cornerstone of your property's success.
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
              Complete Environmental and<br />Structural Control
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 font-sans font-light">
              We utilize the latest advancements in pool structures, finishes, and smart features to deliver a seamless operational experience.
            </p>
          </div>

          <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-16 mb-20">
            <ul className="space-y-12">
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-cyan-500"></span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Advanced Filtration & Disinfection:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">Precision-engineered systems designed for maximum hygiene and operating efficiency under extreme daily use.</span>
              </li>
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-[#f9c80e]"></span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Complete Climate Packages:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">Specialized solutions for heated and temperature-controlled pools, ensuring perfectly regulated water conditions year-round.</span>
              </li>
            </ul>

            <ul className="space-y-12 lg:mt-0 mt-[-2rem]">
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-cyan-500"></span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Energy Recovery Systems:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">Eco-friendly pool water heating and heat recovery technology to keep long-term operational costs low.</span>
              </li>
              <li className="relative pl-8 border-l-2 border-cyan-500/30">
                <span className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-[#f9c80e]"></span>
                <span className="block text-2xl font-sans font-bold text-slate-900 dark:text-white mb-2">Immersive Attractions:</span>
                <span className="block text-xl font-serif italic text-slate-600 dark:text-white">From dynamic wave machines to custom architectural finishes, we install features that leave a lasting impression on your guests.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Footer Gallery Section */}
      <PoolFooterGallery 
        images={POOL_GALLERIES.commercial} 
        poolName="Commercial Pools" 
      />

    </div>
  );
}
