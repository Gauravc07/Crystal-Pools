import { useState, useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { motion, AnimatePresence } from 'motion/react';
import { Download, MessageCircle, X, ChevronRight, ShieldCheck, Settings2, Droplets, Headphones, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Lines, pageImage, parsePairs, usePageContent } from '../lib/pageContent';
import { productsPage } from '../content/pages/products';
import { usePanelContext } from '../contexts/PanelContext';
import { useLenis } from '../components/SmoothScroll';
import { useSiteSettings, whatsappHref } from '../lib/siteSettings';

// Icon for each hero feature-strip position
const BADGE_ICONS = [ShieldCheck, Settings2, Droplets, Headphones];

interface Product { id: number; category: string; title: string; desc: string; image: string; datasheet: string; specs: { label: string; value: string }[] }

export default function Products() {
  const c = usePageContent(productsPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'), c.image('hero.image'));
  const allLabel = c.text('catalog.allLabel');
  const categories = [allLabel, ...c.list('catalog.categories').map(cat => cat.name).filter(Boolean)];
  const products: Product[] = c.list('catalog.products').map((p, i) => ({
    id: i,
    category: p.category,
    title: p.title,
    desc: p.desc,
    image: pageImage(p.image),
    datasheet: p.datasheet ? pageImage(p.datasheet) : '',
    specs: parsePairs(p.specs).map(s => ({ label: s.label, value: s.sub })),
  }));
  const inquiry = (title: string) => `${c.text('catalog.whatsappMessage')} ${title}`;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { setPanelOpen } = usePanelContext();
  const { whatsapp } = useSiteSettings();
  const lenis = useLenis();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentCategory = activeCategory ?? allLabel;
  const filteredProducts = currentCategory === allLabel
    ? products
    : products.filter(p => p.category === currentCategory);

  const openPanel = (product: Product) => { setSelectedProduct(product); setPanelOpen(true); lenis?.stop(); };
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
            src={c.image('hero.image')}
            alt={c.text('hero.alt')}
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
              <Lines text={c.text('hero.title')} />
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.35 }}
              className="text-5xl sm:text-6xl md:text-7xl font-serif italic text-[#f9c80e] leading-none mt-1 mb-8"
            >
              <Lines text={c.text('hero.highlight')} />
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
              {c.text('hero.subtitle')}
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
            {c.list('hero.badges').map(({ title, desc }, i) => ({ icon: BADGE_ICONS[i % BADGE_ICONS.length], title, desc })).map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="flex items-start gap-4 px-6 py-6 md:px-8 md:py-7">
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
           {c.text('intro.heading')}
         </h2>
         <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light">
           {c.text('intro.text')}
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
                  ${currentCategory === cat 
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
                         href={whatsappHref(whatsapp, inquiry(product.title))}
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
          {c.text('cta.heading')}
        </h2>
        <Link to="/contact-swimming-pool-contractor">
          <button className="group inline-flex items-center space-x-4 bg-[#0a5c86] hover:bg-[#084b6e] text-white dark:bg-[#38bdf8] dark:text-[#060F1A] dark:hover:bg-cyan-400 px-8 md:px-12 py-5 rounded-full font-bold uppercase tracking-widest text-sm transition-colors duration-300">
            <span>{c.text('cta.button')}</span>
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
                     <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">{c.text('catalog.specsHeading')}</h4>
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
                     <span>{c.text('catalog.datasheetButton')}</span>
                   </a>
                   )}
                   <a
                     href={whatsappHref(whatsapp, inquiry(selectedProduct.title))}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-4 rounded-xl font-medium hover:bg-[#1ebe5d] transition-colors"
                   >
                     <MessageCircle className="w-5 h-5" />
                     <span>{c.text('catalog.whatsappButton')}</span>
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
