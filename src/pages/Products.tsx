import { useState, useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { motion, AnimatePresence } from 'motion/react';
import { Download, MessageCircle, X, ChevronRight, ShieldCheck, Settings2, Droplets, Headphones, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { IMAGES } from '../config/images';
import { DOCUMENTS } from '../config/documents';
import { usePanelContext } from '../contexts/PanelContext';
import { useLenis } from '../components/SmoothScroll';

const categories = ['All', 'Commercial & Residential Filters', 'Pumps', 'Disinfection System'];

const products = [
  // Commercial & Residential Filters
  { id: 1,  category: 'Commercial & Residential Filters', title: 'F Series Sand Filters',       desc: 'Heavy-duty performance for high-capacity applications.', image: IMAGES.equipment.fSeries,            datasheet: DOCUMENTS.equipment.fSeries,              specs: [{ label: 'Type', value: 'Commercial High-Capacity' }, { label: 'Material', value: 'Fiberglass' }] },
  { id: 2,  category: 'Commercial & Residential Filters', title: 'B Series Filters',            desc: 'Horizontal commercial filtration solutions.',           image: IMAGES.equipment.bSeries,            datasheet: DOCUMENTS.equipment.bSeries,              specs: [{ label: 'Format', value: 'Horizontal' }] },
  { id: 3,  category: 'Commercial & Residential Filters', title: 'M Series Filters',            desc: 'Premium top-mount residential filtration systems.',     image: IMAGES.equipment.mSeries,            datasheet: DOCUMENTS.equipment.mSeries,              specs: [{ label: 'Mount', value: 'Top' }] },
  { id: 4,  category: 'Commercial & Residential Filters', title: 'MS Series Filters',           desc: 'Side-mount residential filtration systems.',           image: IMAGES.equipment.msSeries,                                                                specs: [{ label: 'Mount', value: 'Side' }] },

  // Pumps
  { id: 5,  category: 'Pumps', title: 'MXB Series Pumps', desc: 'Reliable performance for residential pools.',    image: IMAGES.equipment.mxbSeries, datasheet: DOCUMENTS.equipment.mxbSeries, specs: [{ label: 'Application', value: 'Residential' }] },
  { id: 6,  category: 'Pumps', title: 'MRB Series Pumps', desc: 'Heavy-duty commercial flanged pumps.',          image: IMAGES.equipment.mrbSeries, datasheet: DOCUMENTS.equipment.mrbSeries, specs: [{ label: 'Type', value: 'Flanged Commercial' }] },
  { id: 7,  category: 'Pumps', title: 'MTX Series Pumps', desc: 'Compact, high-efficiency circulation.',         image: IMAGES.equipment.mtxSeries, datasheet: DOCUMENTS.equipment.mtxSeries, specs: [{ label: 'Benefit', value: 'High Efficiency' }] },

  // Disinfection System
  { id: 8,  category: 'Disinfection System', title: 'Minderchlor Salt Chlorinator', desc: 'Automated, silky-smooth water sanitation.',             image: IMAGES.equipment.minderchlor,          datasheet: DOCUMENTS.equipment.minderchlor,          specs: [] },
  { id: 9,  category: 'Disinfection System', title: 'Chemical Tablet Feeders',      desc: 'Consistent, regulated chlorine dispersion.',           image: IMAGES.equipment.chemicalTabletFeeder,  datasheet: DOCUMENTS.equipment.chemicalTabletFeeder, specs: [] },
  { id: 10, category: 'Disinfection System', title: 'Dosingstar Dosing Pump',       desc: 'Precise automated liquid chemical injection.',         image: IMAGES.equipment.dosingstar,            datasheet: DOCUMENTS.equipment.dosingstar,           specs: [] },
  { id: 11, category: 'Disinfection System', title: 'BP Series Dosing Pump',        desc: 'Reliable chemical dosing for balanced water.',         image: IMAGES.equipment.bpSeries,              datasheet: DOCUMENTS.equipment.bpSeries,             specs: [] },
  { id: 12, category: 'Disinfection System', title: 'Hydrosmart Pool System',       desc: 'Intelligent, centralized water quality management.',   image: IMAGES.equipment.hydrosmart,            datasheet: DOCUMENTS.equipment.hydrosmart,           specs: [] },
  { id: 13, category: 'Disinfection System', title: 'Pool Vacuum',                  desc: 'Efficient pool floor and wall vacuuming.',             image: IMAGES.equipment.poolVacuum,                                                                   specs: [] },
  { id: 14, category: 'Disinfection System', title: 'Heavy-Duty SS Vacuum Head',    desc: 'Stainless steel vacuum head for commercial pools.',    image: IMAGES.equipment.heavyDutyVacuumHead,                                                          specs: [] },
  { id: 15, category: 'Disinfection System', title: 'Aluminum Vacuum Head',         desc: 'Lightweight aluminum head for residential use.',       image: IMAGES.equipment.aluminumVacuumHead,                                                           specs: [] },
  { id: 16, category: 'Disinfection System', title: 'Vacuum Head with Side Brush',  desc: 'Combined vacuuming and brushing in one pass.',         image: IMAGES.equipment.vacuumHeadSideBrush,                                                          specs: [] },
  { id: 17, category: 'Disinfection System', title: 'SS Algae Brushes',             desc: 'Stainless steel bristles for stubborn algae removal.', image: IMAGES.equipment.ssAlgaeBrushes,                                                               specs: [] },
  { id: 18, category: 'Disinfection System', title: 'Telescopic Poles',             desc: 'Grip-lock telescopic poles for all cleaning tools.',  image: IMAGES.equipment.polesWithGripLock,                                                            specs: [] },
  { id: 19, category: 'Disinfection System', title: 'Pool Hose',                    desc: 'Durable flexible hose for vacuum and cleaning systems.', image: IMAGES.equipment.poolHose,                                                                  specs: [] },
  { id: 20, category: 'Disinfection System', title: 'Pool Plastic Fittings',        desc: 'Essential plastic fittings and accessories for pool systems.', image: IMAGES.equipment.poolPlastic,                                                          specs: [] },
  { id: 21, category: 'Disinfection System', title: 'Swimming Pool Accessories',    desc: 'Complete range of general-purpose pool accessories.', image: IMAGES.equipment.poolGeneral,                                                                   specs: [] },
];

export default function Products() {
  usePageMeta(
    'Swimming Pool Equipment & Accessories',
    'Crystal Pools is a trusted swimming pool equipment supplier and swimming pool manufacturer, offering filtration, pumps, filter systems, and accessories in Pune and across India.',
  );
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { setPanelOpen } = usePanelContext();
  const lenis = useLenis();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory);

  const openPanel = (product: any) => { setSelectedProduct(product); setPanelOpen(true); lenis?.stop(); };
  const closePanel = () => { setSelectedProduct(null); setPanelOpen(false); lenis?.start(); };

  // Close panel on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="bg-[#fbfbfb] dark:bg-[#060F1A] min-h-screen transition-colors duration-500 overflow-x-hidden font-sans">
      
      {/* 1. Hero Section */}
      <section className="relative w-full min-h-screen overflow-hidden bg-[#050d1a] flex flex-col">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src={IMAGES.equipment.hero}
            alt="Premium aquatic equipment"
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-linear-to-r from-[#050d1a]/90 via-[#050d1a]/55 to-transparent" />
        </div>

        {/* Main text content */}
        <div className="relative z-10 flex-1 flex items-center px-8 sm:px-16 md:px-24 lg:px-32 pt-36 pb-12">
          <div className="max-w-2xl">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
              className="text-6xl sm:text-7xl md:text-8xl font-display font-light text-white dark:text-brand-gold leading-none"
            >
              Premium<br />Aquatic
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.35 }}
              className="text-5xl sm:text-6xl md:text-7xl font-serif italic text-[#f9c80e] leading-none mt-1 mb-8"
            >
              Equipment<br />& Supply
            </motion.p>

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.55 }}
              className="flex items-center gap-3 mb-8"
            >
              <div className="w-10 h-0.5 bg-[#f9c80e]" />
              <Waves className="w-5 h-5 text-[#38bdf8]" strokeWidth={1.5} />
              <div className="w-10 h-0.5 bg-[#f9c80e]" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="text-base md:text-lg text-slate-300 font-light leading-relaxed max-w-sm"
            >
              The definitive source for high-performance pool infrastructure and maintenance technology.
            </motion.p>
          </div>
        </div>

        {/* Bottom feature badge strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="relative z-10 border-t border-[#f9c80e]/30 bg-[#050d1a]/85 backdrop-blur-sm"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10 max-w-7xl mx-auto">
            {[
              { icon: ShieldCheck, title: 'Premium Quality',    desc: 'Industry-leading brands and products.' },
              { icon: Settings2,   title: 'High Performance',   desc: 'Engineered for efficiency, built to last.' },
              { icon: Droplets,    title: 'Complete Solutions', desc: 'Everything you need for peak pool performance.' },
              { icon: Headphones,  title: 'Expert Support',     desc: 'Dedicated guidance every step of the way.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 px-6 py-6 md:px-8 md:py-7">
                <Icon className="w-7 h-7 text-[#f9c80e] shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#f9c80e] mb-1">{title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 2. Uncompromising Quality & Sourcing */}
      <section className="py-16 md:py-24 px-6 lg:px-12 max-w-4xl mx-auto text-center">
         <h2 className="text-3xl lg:text-4xl font-display font-medium text-slate-900 dark:text-white mb-6">
           Engineered for Excellence
         </h2>
         <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light">
           Crystal Pools is India's premier swimming pool equipment supplier and manufacturer, importing commercial and residential swimming pool equipment — from filtration and filter systems to pumps, disinfection, and underwater lights. Serving elite hotels, resorts, sports clubs, and advanced water treatment facilities, we provide a comprehensive ecosystem of aquatic technology. Every component in our catalog is procured from world-class global vendors, guaranteeing absolute reliability, uncompromising safety, and peak operational efficiency for your facility.
         </p>
      </section>

      {/* 3. The Equipment Catalog */}
      <section className="px-4 sm:px-6 lg:px-12 pb-32 max-w-400 mx-auto min-h-screen relative">
        
        {/* Sticky Category Pill Bar */}
        <div className="sticky top-20 z-30 bg-[#fbfbfb]/90 dark:bg-[#060F1A]/90 backdrop-blur-md py-4 mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex overflow-x-auto hide-scrollbars space-x-2 md:justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border
                  ${activeCategory === cat 
                    ? 'bg-[#0a5c86] border-[#0a5c86] text-white dark:bg-[#38bdf8] dark:border-[#38bdf8] dark:text-[#060F1A]' 
                    : 'bg-transparent border-slate-200 text-slate-600 hover:border-[#0a5c86] dark:border-slate-800 dark:text-slate-400 dark:hover:border-[#38bdf8]'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Filterable Grid */}
        <motion.div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => (
              <motion.div
                layout="position"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                key={product.id}
                onClick={() => openPanel(product)}
                className="group relative bg-white dark:bg-[#09090b] rounded-2xl md:rounded-4xl overflow-hidden border border-slate-100 dark:border-slate-800 cursor-pointer lg:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] lg:dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] lg:hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
              >
                 {/* Image Container */}
                 <div className="relative w-full aspect-4/3 bg-[#f8fafc] dark:bg-[#0f1724] overflow-hidden">
                   <img 
                     src={product.image} 
                     alt={product.title} 
                     className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal transition-transform duration-700 group-hover:scale-105"
                   />
                   
                   {/* Hover Overlay (Desktop) / Permanent Icons (Mobile) */}
                   <div className={`absolute bottom-0 left-0 right-0 h-1/2 bg-linear-to-t from-black/60 to-transparent flex items-end justify-between p-4 md:p-6 transition-transform duration-300
                     ${selectedProduct ? 'hidden' : ''}
                     ${isMobile ? 'translate-y-0 opacity-100 h-1/3' : 'translate-y-full group-hover:translate-y-0'}`}
                   >
                     <div className="flex space-x-2">
                       {product.datasheet && (
                         <a
                           href={product.datasheet}
                           target="_blank"
                           rel="noopener noreferrer"
                           onClick={(e) => e.stopPropagation()}
                           className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors"
                           title="Download Datasheet"
                         >
                           <Download className="w-4 h-4" />
                         </a>
                       )}
                       <a
                         href={`https://wa.me/919552526371?text=Hi%2C%20I%27m%20interested%20in%20the%20${encodeURIComponent(product.title)}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         onClick={(e) => e.stopPropagation()}
                         className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-[#25D366] transition-colors"
                         title="Inquire on WhatsApp"
                       >
                         <MessageCircle className="w-4 h-4" />
                       </a>
                     </div>
                   </div>
                 </div>

                 {/* Content Container */}
                 <div className="p-4 md:p-6 grow flex flex-col justify-between">
                   <div>
                     <h3 className="text-sm md:text-lg font-medium text-slate-900 dark:text-slate-100 mb-2 leading-tight md:leading-snug line-clamp-2 md:line-clamp-none font-display">
                       {product.title}
                     </h3>
                     <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-light line-clamp-2 leading-relaxed">
                       {product.desc}
                     </p>
                   </div>
                 </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

      </section>

      {/* 4. Footer CTA */}
      <section className="py-24 md:py-32 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-[#09090b] border-t border-slate-100 dark:border-slate-800 relative z-20">
        <h2 className="text-4xl md:text-5xl font-display font-medium text-[#0a5c86] dark:text-white mb-12 tracking-tight">
          Equip Your Facility with the Best.
        </h2>
        <Link to="/contact-swimming-pool-contractor">
          <button className="group inline-flex items-center space-x-4 bg-[#0a5c86] hover:bg-[#084b6e] text-white dark:bg-[#38bdf8] dark:text-[#060F1A] dark:hover:bg-cyan-400 px-8 md:px-12 py-5 rounded-full font-bold uppercase tracking-widest text-sm transition-colors duration-300">
            <span>Request the Full Equipment Catalog</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </Link>
      </section>

      {/* Slide-Over Panel for Details */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 bg-black z-40"
            />
            
            {/* Panel */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-[#09090b] z-50 shadow-2xl flex flex-col"
            >
              <div className="absolute top-6 right-6 z-10 flex space-x-2">
                 <button onClick={closePanel} className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 backdrop-blur flex items-center justify-center text-black dark:text-white hover:bg-black/20 dark:hover:bg-white/20 transition-colors">
                   <X className="w-5 h-5" />
                 </button>
              </div>

              {/* High-Res Image — pinned, never scrolls */}
              <div className="w-full aspect-4/3 shrink-0 bg-[#f8fafc] dark:bg-[#0f1724]">
                <img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.title} 
                  className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal"
                />
              </div>

              {/* Panel Content — scrollable */}
              <div className="flex-1 overflow-y-auto">
              <div className="p-8 flex flex-col min-h-full">
                 <div className="text-xs font-bold uppercase tracking-widest text-[#0a5c86] dark:text-white mb-3">
                   {selectedProduct.category}
                 </div>
                 <h2 className="text-3xl font-display font-medium text-slate-900 dark:text-white mb-6">
                   {selectedProduct.title}
                 </h2>
                 <p className="text-base text-slate-600 dark:text-slate-400 font-light leading-relaxed mb-10">
                   {selectedProduct.desc}
                 </p>

                 {/* Specifications Table styled cleanly */}
                 {selectedProduct.specs && selectedProduct.specs.length > 0 && (
                   <div className="mb-10">
                     <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Technical Specifications</h4>
                     <table className="w-full text-left border-collapse">
                       <tbody>
                         {selectedProduct.specs.map((spec: any, idx: number) => (
                           <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                             <td className="py-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{spec.label}</td>
                             <td className="py-3 px-4 text-slate-900 dark:text-slate-300 font-mono text-sm text-right">{spec.value}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}

                 <div className="mt-auto pt-6 space-y-3">
                   {selectedProduct.datasheet && (
                   <a
                     href={selectedProduct.datasheet}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-medium hover:scale-[1.02] transition-transform"
                   >
                     <Download className="w-5 h-5" />
                     <span>Download Datasheet</span>
                   </a>
                   )}
                   <a
                     href={`https://wa.me/919552526371?text=Hi%2C%20I%27m%20interested%20in%20the%20${encodeURIComponent(selectedProduct.title)}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-4 rounded-xl font-medium hover:bg-[#1ebe5d] transition-colors"
                   >
                     <MessageCircle className="w-5 h-5" />
                     <span>Inquire on WhatsApp</span>
                   </a>
                 </div>

              </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .hide-scrollbars::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbars {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

    </div>
  );
}
