import { useRef } from 'react';
import { motion, useInView, type Variants } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import TiltCard from './TiltCard';
import { usePageContent, pageImage } from '../lib/pageContent';
import { homePage } from '../content/pages/home';

// Card layout and link for each position (text and images are edited in the admin panel).
const SLOTS = [
  { colSpanClass: "md:col-span-1 md:row-span-2", path: "/services/turnkey-projects" },
  { colSpanClass: "md:col-span-2 md:row-span-1", path: "/services/waterfall-fountain" },
  { colSpanClass: "md:col-span-1 md:row-span-1", path: "/services/pool-tiles" },
  { colSpanClass: "md:col-span-1 md:row-span-1", path: "/services/accessories" },
  { colSpanClass: "md:col-span-2 md:row-span-1", path: "/services/readymade-pools" },
  { colSpanClass: "md:col-span-1 md:row-span-1", path: "/services/renovation" },
];

export default function ServicesBentoSection() {
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.1 });
  const c = usePageContent(homePage);
  const servicesData = c.list('services.items').map((item, i) => ({
    id: String(i),
    title: item.title,
    description: item.description,
    image: pageImage(item.image),
    ...(SLOTS[i] ?? SLOTS[SLOTS.length - 1]),
  }));

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.15,
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
    }
  };

  return (
    <section ref={containerRef} className="py-16 md:py-24 bg-white dark:bg-[#09090b] transition-colors duration-500 text-[#1a202c] dark:text-gray-100 flex items-center min-h-screen">
      <div className="w-full">
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-16 px-4">
          <h2 className="text-xs md:text-sm font-bold text-[#f9c80e] uppercase tracking-[0.3em] mb-3 md:mb-4">{c.text('services.eyebrow')}</h2>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0a5c86] dark:text-white font-display">{c.text('services.heading')}</h3>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 auto-rows-[320px] lg:auto-rows-[380px] gap-3 sm:gap-4 md:gap-6 lg:gap-8 px-4 md:px-8 lg:px-10"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {servicesData.map((service) => (
            <motion.div 
              key={service.id}
              variants={itemVariants}
              className={`relative w-full h-full min-h-80 ${service.colSpanClass} perspective-[1000px]`}
            >
              <TiltCard className="w-full h-full">
                <div className="relative w-full h-full group rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-shadow duration-500">
                  {/* Background Image */}
                  <div 
                    className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-1000 ease-[0.25,1,0.5,1] group-hover:scale-110"
                    style={{ backgroundImage: `url(${service.image})` }}
                  />
                  
                  {/* Gradient overlays */}
                  {/* Default subtle gradient so title is readable */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent opacity-100 lg:group-hover:opacity-0 transition-opacity duration-700" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/60 to-transparent opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-700" />

                  {/* Content Container */}
                  <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 flex flex-col justify-end z-10 transition-transform duration-700 ease-out transform lg:translate-y-20 lg:group-hover:translate-y-0" style={{ transform: 'translateZ(20px)' }}>
                    <h4 className="text-xl md:text-2xl font-bold text-white font-display tracking-tight mb-2 md:mb-3 drop-shadow-md">
                      {service.title}
                    </h4>
                    
                    <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-500 lg:delay-100">
                      <p className="text-gray-200 text-xs md:text-sm mb-4 line-clamp-2 leading-relaxed">
                        {service.description}
                      </p>
                      <Link 
                        to={service.path || `/products-services`} 
                        className="inline-flex items-center text-[#f9c80e] font-bold text-[10px] md:text-xs uppercase tracking-[0.15em] hover:text-white transition-colors"
                      >
                        Learn More <ArrowRight className="ml-2 w-3 h-3 md:w-4 md:h-4 transition-transform lg:group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>

        {/* View all services link */}
        <div className="text-center mt-10 md:mt-12">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em]
              text-[#0a5c86] dark:text-white hover:text-[#f9c80e] dark:hover:text-[#f9c80e]
              transition-colors duration-300"
          >
            {c.text('services.linkText')}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
