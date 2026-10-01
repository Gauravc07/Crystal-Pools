import { useRef } from 'react';
import { motion, useInView, type Variants } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import TiltCard from './TiltCard';
import { usePageContent, pageImage } from '../lib/pageContent';
import { homePage } from '../content/pages/home';

// Link for each card position (text and images are edited in the admin panel).
const PRODUCT_PATHS = ['/products', '/products/specialty-installations'];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export default function ProductsBentoSection() {
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.1 });
  const c = usePageContent(homePage);
  const products = c.list('products.items').map((item, i) => ({
    id: String(i),
    num: String(i + 1).padStart(2, '0'),
    category: item.category,
    title: item.title,
    description: item.description,
    image: pageImage(item.image),
    path: PRODUCT_PATHS[i] ?? '/products',
  }));

  return (
    <section
      ref={containerRef}
      className="py-16 md:py-24 bg-[#f0f4f8] dark:bg-[#07111d] transition-colors duration-500"
    >
      <div className="w-full">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-16 px-4">
          <h2 className="text-xs md:text-sm font-bold text-[#f9c80e] uppercase tracking-[0.3em] mb-3 md:mb-4">
            {c.text('products.eyebrow')}
          </h2>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0a5c86] dark:text-white font-display">
            {c.text('products.heading')}
          </h3>
        </div>

        {/* 2-card grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-[480px] gap-3 sm:gap-4 md:gap-6 lg:gap-8 px-4 md:px-8 lg:px-10"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {products.map((product) => (
            <motion.div
              key={product.id}
              variants={itemVariants}
              className="relative w-full min-h-80 md:h-full perspective-[1000px]"
            >
              <TiltCard className="w-full h-full">
                <div className="relative w-full h-full group rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-shadow duration-500">

                  {/* Background image */}
                  <img
                    src={product.image}
                    alt={product.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-[0.25,1,0.5,1] group-hover:scale-[1.06]"
                  />

                  {/* Base gradient */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
                  {/* Hover gradient */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/55 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Content */}
                  <div
                    className="absolute inset-0 z-10 flex flex-col justify-between p-8 md:p-10"
                    style={{ transform: 'translateZ(20px)' }}
                  >
                    {/* Card number */}
                    <span className="font-mono text-[10px] font-bold tracking-[0.25em] text-[#f9c80e]/55">
                      {product.num}
                    </span>

                    {/* Text block */}
                    <div>
                      <div className="w-8 h-0.5 bg-[#f9c80e] mb-4 opacity-75" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#f9c80e] mb-2">
                        {product.category}
                      </p>
                      <h4 className="font-display font-bold text-white tracking-tight leading-tight text-2xl md:text-3xl lg:text-4xl mb-4">
                        {product.title}
                      </h4>
                      <p className="text-white/60 text-sm md:text-base leading-relaxed max-w-sm mb-6">
                        {product.description}
                      </p>
                      <Link
                        to={product.path}
                        className="inline-flex items-center gap-1.5 font-bold uppercase text-white hover:text-[#f9c80e] transition-colors duration-300 group/link"
                        style={{ fontSize: '0.6rem', letterSpacing: '0.2em' }}
                      >
                        Explore
                        <ArrowUpRight className="w-3 h-3 transition-transform duration-300 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Hover ring */}
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/0 group-hover:ring-white/10 transition-all duration-500 pointer-events-none z-20" />
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>

        {/* View all */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="text-center mt-10 md:mt-12"
        >
          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em]
              text-[#0a5c86] dark:text-white hover:text-[#f9c80e] dark:hover:text-[#f9c80e]
              transition-colors duration-300"
          >
            {c.text('products.linkText')}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
