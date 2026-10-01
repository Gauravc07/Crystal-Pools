import { useState } from 'react';
import { usePageMeta } from '../../hooks/usePageMeta';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, ChevronRight, CheckCircle2 } from 'lucide-react';
import { usePageContent } from '../../lib/pageContent';
import { accessoriesPage } from '../../content/pages/accessories';

// Tab ids in order; tab names come from the admin panel.
const TAB_IDS = ['ladders', 'skimmers', 'pumps', 'filters'];

// --- Components ---

const TechnicalTable = ({ headers, data, renderRow }: any) => (
  <div className="w-full overflow-x-auto mt-8 mb-12 relative pb-4 custom-scrollbar">
    <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-white dark:from-[#0a111a] to-transparent pointer-events-none lg:hidden"></div>
    <table className="w-full text-left border-collapse min-w-[700px]">
      <thead>
        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          {headers.map((h: string, i: number) => (
            <th key={i} className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-sm">
        {data.map((item: any, i: number) => renderRow(item, i))}
      </tbody>
    </table>
  </div>
);

// --- Main Page ---

export default function Accessories() {
  const c = usePageContent(accessoriesPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'), c.image('hero.image'));
  const categories = c.list('range.tabs').slice(0, TAB_IDS.length).map((t, i) => ({ id: TAB_IDS[i], label: t.label }));
  const marathonSpecs = c.list('pumps.specs');
  const lsmSpecs = c.list('filters.lsmSpecs');
  const ltmSpecs = c.list('filters.ltmSpecs');
  const [activeTab, setActiveTab] = useState('ladders');
  const [modalImage, setModalImage] = useState<string | null>(null);

  const openSchematic = (type: string) => {
    const images: Record<string, string> = {
      pump: c.image('pumps.curveImage')
    };
    setModalImage(images[type]);
  };

  const closeSchematic = () => setModalImage(null);

  // Content renderers
  const renderContent = () => {
    switch (activeTab) {
      case 'ladders':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="max-w-4xl space-y-8">
            <div>
              <h2 className="text-3xl lg:text-4xl font-display font-medium text-[#0a5c86] dark:text-white mb-4 tracking-tight">{c.text('ladders.heading')}</h2>
              <div className="w-12 h-0.5 bg-[#f9c80e] mb-8"></div>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light">
                {c.text('ladders.intro')}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-8 lg:p-10 border border-slate-100 dark:border-slate-800">
              <h3 className="text-sm tracking-widest uppercase font-bold text-slate-400 dark:text-slate-500 mb-8">{c.text('ladders.featuresHeading')}</h3>
              <ul className="space-y-6">
                {c.list('ladders.features').map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-cyan-600 dark:text-brand-gold mt-1 mr-4 shrink-0" />
                    <div>
                      <strong className="block text-slate-900 dark:text-slate-200 font-medium mb-1">{feature.title}</strong>
                      <span className="text-slate-600 dark:text-slate-400 font-light">{feature.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            <img src={c.image('ladders.image')} alt={c.text('ladders.heading')} className="w-full h-80 object-cover rounded-xl" />
          </motion.div>
        );

      case 'skimmers':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="max-w-4xl space-y-12">
            <div>
              <h2 className="text-3xl lg:text-4xl font-display font-medium text-[#0a5c86] dark:text-white mb-4 tracking-tight">{c.text('skimmers.heading')}</h2>
              <div className="w-12 h-0.5 bg-[#f9c80e] mb-8"></div>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light">
                {c.text('skimmers.intro')}
              </p>
            </div>

            {/* Skimmers */}
            <div className="space-y-6">
              <h3 className="text-2xl font-medium text-slate-900 dark:text-slate-100">{c.text('skimmers.skimmerHeading')}</h3>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light">
                {c.text('skimmers.skimmerText')}
              </p>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-lg border-l-4 border-cyan-500">
                <strong className="block text-slate-900 dark:text-slate-200 font-medium mb-2">{c.text('skimmers.valveTitle')}</strong>
                <p className="text-slate-600 dark:text-slate-400 font-light text-sm md:text-base">
                  {c.text('skimmers.valveText')} <em className="text-slate-800 dark:text-slate-200">{c.text('skimmers.valveModes')}</em>
                </p>
              </div>
            </div>

            {/* Overflow Grating */}
            <div className="space-y-6">
              <h3 className="text-2xl font-medium text-slate-900 dark:text-slate-100">{c.text('skimmers.overflowHeading')}</h3>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light">
                {c.text('skimmers.overflowText')}
              </p>
            </div>

            {/* Visual Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
              <div className="space-y-4">
                <div className="relative h-64 rounded-xl overflow-hidden group">
                  <img src={c.image('skimmers.image1')} alt={c.text('skimmers.caption1')} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>
                  <h4 className="absolute bottom-4 left-6 text-white font-medium tracking-wide">{c.text('skimmers.caption1')}</h4>
                </div>
              </div>
              <div className="space-y-4">
                <div className="relative h-64 rounded-xl overflow-hidden group">
                  <img src={c.image('skimmers.image2')} alt={c.text('skimmers.caption2')} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>
                  <h4 className="absolute bottom-4 left-6 text-white font-medium tracking-wide">{c.text('skimmers.caption2')}</h4>
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'pumps':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="max-w-5xl space-y-12">
             <div>
              <h2 className="text-3xl lg:text-4xl font-display font-medium text-[#0a5c86] dark:text-white mb-4 tracking-tight">{c.text('pumps.heading')}</h2>
              <div className="w-12 h-0.5 bg-[#f9c80e] mb-8"></div>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light max-w-4xl">
                {c.text('pumps.intro')}
              </p>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl font-medium text-slate-900 dark:text-slate-100">{c.text('pumps.seriesHeading')}</h3>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light max-w-4xl">
                {c.text('pumps.seriesText')}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
                {c.list('pumps.features').map((feature, i) => (
                   <div key={i} className="flex flex-col">
                      <strong className="text-slate-900 dark:text-slate-200 font-medium mb-1 font-display">{feature.title}</strong>
                      <span className="text-slate-600 dark:text-slate-400 font-light text-sm leading-relaxed">{feature.desc}</span>
                   </div>
                ))}
              </div>
            </div>

            <div>
               <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">{c.text('pumps.tableHeading')}</h4>
               <TechnicalTable 
                 headers={['Code', 'Description', 'Model', 'HP', 'Flow (m³/h)']}
                 data={marathonSpecs}
                 renderRow={(item: any, i: number) => (
                   <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                     <td className="py-4 px-6 text-slate-900 dark:text-slate-300 font-mono text-sm">{item.code}</td>
                     <td className="py-4 px-6 text-slate-600 dark:text-slate-400 font-medium">{item.desc}</td>
                     <td className="py-4 px-6 text-slate-500 dark:text-slate-400">{item.model}</td>
                     <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-mono text-center">{item.hp}</td>
                     <td className="py-4 px-6 text-slate-900 dark:text-slate-300 font-mono text-right">{item.flow}</td>
                   </tr>
                 )}
               />
            </div>

            <div>
              <button 
                onClick={() => openSchematic('pump')}
                className="inline-flex items-center space-x-2 text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white px-8 py-4 transition-colors rounded-sm"
              >
                <span>{c.text('pumps.curveButton')}</span>
                <ExternalLink className="w-4 h-4 text-cyan-600 dark:text-brand-gold" />
              </button>
            </div>

          </motion.div>
        );

      case 'filters':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="max-w-6xl space-y-12">
             <div>
              <h2 className="text-3xl lg:text-4xl font-display font-medium text-[#0a5c86] dark:text-white mb-4 tracking-tight">{c.text('filters.heading')}</h2>
              <div className="w-12 h-0.5 bg-[#f9c80e] mb-8"></div>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-light max-w-4xl">
                {c.text('filters.intro')}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 p-8 lg:p-10 rounded-xl border border-slate-100 dark:border-slate-800">
               <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-6 font-display">{c.text('filters.featuresHeading')}</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                 {c.list('filters.features').map((feature, i) => (
                    <div key={i} className="flex flex-col">
                       <strong className="text-slate-800 dark:text-slate-300 font-medium mb-1 text-sm uppercase tracking-wider">{feature.title}</strong>
                       <span className="text-slate-600 dark:text-slate-400 font-light text-sm">{feature.desc}</span>
                    </div>
                  ))}
               </div>
            </div>

            <div>
               <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">{c.text('filters.lsmHeading')}</h4>
               <TechnicalTable 
                 headers={['Code', 'Description', 'Sand (Kgs)', 'Filter D (mm)', 'Max Pressure (Kg/cm²)', 'N.W (Kgs)']}
                 data={lsmSpecs}
                 renderRow={(item: any, i: number) => (
                   <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                     <td className="py-4 px-6 text-slate-900 dark:text-slate-300 font-mono text-sm">{item.code}</td>
                     <td className="py-4 px-6 text-slate-600 dark:text-slate-400 font-medium">{item.desc}</td>
                     <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-mono text-center">{item.sand}</td>
                     <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-mono text-center">{item.diameter}</td>
                     <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-mono text-center">{item.pressure}</td>
                     <td className="py-4 px-6 text-slate-900 dark:text-slate-300 font-mono text-right">{item.nw}</td>
                   </tr>
                 )}
               />
            </div>

            <div>
               <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">{c.text('filters.ltmHeading')}</h4>
               <TechnicalTable 
                 headers={['Code', 'Description', 'Sand (Kgs)', 'H (mm)', 'Max Pressure (Kg/cm²)', 'N.W (Kgs)']}
                 data={ltmSpecs}
                 renderRow={(item: any, i: number) => (
                   <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                     <td className="py-4 px-6 text-slate-900 dark:text-slate-300 font-mono text-sm">{item.code}</td>
                     <td className="py-4 px-6 text-slate-600 dark:text-slate-400 font-medium">{item.desc}</td>
                     <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-mono text-center">{item.sand}</td>
                     <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-mono text-center">{item.height}</td>
                     <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-mono text-center">{item.pressure}</td>
                     <td className="py-4 px-6 text-slate-900 dark:text-slate-300 font-mono text-right">{item.nw}</td>
                   </tr>
                 )}
               />
            </div>


          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-[#fbfbfb] dark:bg-[#060F1A] w-full font-sans transition-colors duration-500 overflow-x-hidden min-h-screen">

      {/* 1. Hero */}
      <section className="relative w-full h-screen min-h-160 overflow-hidden flex items-center bg-black">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img
            src={c.image('hero.image')}
            alt={c.text('hero.alt')}
            className="w-full h-full object-cover"
          />
        </div>
        {/* Left vignette */}
        <div className="absolute inset-0 z-10 bg-linear-to-r from-black/85 via-black/55 to-transparent" />

        {/* Content */}
        <div className="relative z-20 px-8 sm:px-14 md:px-20 lg:px-28 pt-24 max-w-3xl">
          {/* Brand eyebrow */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="font-serif italic text-[#38bdf8] text-lg md:text-xl mb-3"
          >
            {c.text('hero.eyebrow')}
          </motion.p>

          {/* Gold rule */}
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
            className="w-10 h-0.5 bg-[#f9c80e] mb-6"
          />

          {/* Main heading — all white */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="font-display font-light text-white dark:text-brand-gold leading-none tracking-tight"
          >
            {c.text('hero.title').split('\n').map((line, i) => (
              <span key={i} className="block text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem]">{line}</span>
            ))}
          </motion.h1>

          {/* Second gold rule */}
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.5 }}
            className="w-10 h-0.5 bg-[#f9c80e] mt-7 mb-5"
          />

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.65 }}
            className="text-base md:text-lg text-white/75 font-light leading-relaxed max-w-sm"
          >
            {c.text('hero.subtitle')}
          </motion.p>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="w-px h-16 bg-white/30 relative overflow-hidden">
            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-0 w-full h-full bg-white"
            />
          </div>
        </div>
      </section>

      {/* 2. Interactive Equipment Ledger */}
      <section className="pt-20 md:pt-28 pb-32 px-6 lg:px-12 max-w-7xl mx-auto">

        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16"
        >
          <p className="text-xs tracking-[0.3em] uppercase font-bold text-[#f9c80e] mb-3">{c.text('range.eyebrow')}</p>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-[#0a5c86] dark:text-white tracking-tight mb-4">
            {c.text('range.heading')}
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 font-light max-w-2xl">
            {c.text('range.intro')}
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 relative">
        
        {/* Sticky Sidebar (Desktop) / Horizontal Swipe (Mobile) */}
        <div className="lg:w-1/4 shrink-0">
          <div className="lg:sticky lg:top-32 w-full overflow-x-auto hide-scrollbars border-b lg:border-b-0 border-slate-200 dark:border-slate-800 pb-4 lg:pb-0">
            <div className="flex lg:flex-col min-w-max lg:min-w-0 space-x-6 lg:space-x-0 lg:space-y-4 px-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`relative text-left px-4 py-4 rounded-lg transition-all duration-300 flex items-center justify-between group outline-none
                    ${activeTab === cat.id 
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                >
                  <span className="font-medium text-sm tracking-wide uppercase">{cat.label}</span>
                  <ChevronRight className={`w-4 h-4 transition-transform duration-300 hidden lg:block
                    ${activeTab === cat.id ? 'translate-x-1 opacity-100 text-cyan-400 dark:text-brand-gold' : 'opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0'}`} 
                  />
                  {activeTab === cat.id && (
                     <div className="absolute top-0 bottom-0 left-0 w-1 bg-cyan-400 dark:bg-cyan-600 rounded-l-lg hidden lg:block"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="lg:w-3/4 min-h-[60vh]">
          <AnimatePresence mode="wait">
             <div key={activeTab}>
               {renderContent()}
             </div>
          </AnimatePresence>
        </div>

        </div>
      </section>

      {/* Lightbox Modal for Schematics */}
      <AnimatePresence>
        {modalImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4 md:p-12"
          >
             <button 
               onClick={closeSchematic}
               className="absolute top-6 right-6 md:top-10 md:right-10 text-white hover:text-cyan-400 transition-colors bg-black/50 p-2 rounded-full"
             >
               <X className="w-8 h-8" />
             </button>
             
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.95, opacity: 0 }}
               transition={{ duration: 0.4, delay: 0.1 }}
               className="w-full max-w-6xl max-h-full overflow-hidden rounded-xl border border-slate-700 shadow-2xl relative"
             >
               <div className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/60 to-transparent pointer-events-none p-6">
                 <p className="text-white font-mono text-sm tracking-widest uppercase opacity-80">Tech Diagram #4902-A</p>
               </div>
               {/* Replace this with actual schematic images */}
               <div className="w-full h-full bg-slate-800 flex items-center justify-center p-8 overflow-auto max-h-[85vh]">
                 <img src={modalImage} alt="Technical Schematic" className="w-full h-auto object-contain" />
               </div>
             </motion.div>
          </motion.div>
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
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.02);
          border-radius: 4px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-track {
           background: rgba(255,255,255,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(10, 92, 134, 0.2); 
          border-radius: 4px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(56, 189, 248, 0.4); 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(10, 92, 134, 0.4); 
        }
      `}</style>
    </div>
  );
}
