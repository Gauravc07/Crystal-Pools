import { motion } from 'motion/react';
import { pageImage, usePageContent } from '../lib/pageContent';
import { galleryPage } from '../content/pages/galleryBlog';
import { useTheme } from '../contexts/ThemeContext';
import { usePageMeta } from '../hooks/usePageMeta';
import ProjectsShowcase from '../components/ProjectsShowcase';

const spans = [
  'col-span-1 md:col-span-2 md:row-span-1', // 01 - 1672×941 landscape
  'col-span-1 md:col-span-2 md:row-span-1', // 02 - 1536×1024 landscape
  'col-span-1 md:col-span-2 md:row-span-1', // 03 - 1448×1086 landscape
  'col-span-1 md:col-span-2 md:row-span-1', // 04 - 1672×941 landscape
  'col-span-1 md:col-span-4 md:row-span-1', // 05 - 1672×941 full-width banner
  'col-span-1 md:col-span-2 md:row-span-1', // 06 - 1672×941 landscape
  'col-span-1 md:col-span-1 md:row-span-2', // 07 - 1023×1537 portrait tall
  'col-span-1 md:col-span-2 md:row-span-2', // 08 - 1335×1178 large square feature
  'col-span-1 md:col-span-1 md:row-span-2', // 09 - 1023×1537 portrait tall
  'col-span-1 md:col-span-2 md:row-span-1', // 10 - 1178×1335 near-square
];

export default function Gallery() {
  const { isDarkMode } = useTheme();
  const c = usePageContent(galleryPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'));
  // Photos can be added in the admin; the grid pattern repeats every 10 photos
  const photos = c.list('grid.images').filter(p => p.light);

  return (
    <div className="bg-[#f8fcfd] dark:bg-[#070d14] min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center"
        >
          <h1 className="text-4xl md:text-5xl font-bold font-display text-[#0a5c86] dark:text-white mb-6">
            {c.text('header.heading')}
          </h1>
          <p className="text-gray-600 dark:text-slate-300 text-lg max-w-2xl mx-auto">
            {c.text('header.intro')}
          </p>
        </motion.div>
      </div>

      <div className="w-full px-2 md:px-4 lg:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
          className="grid grid-cols-1 md:grid-cols-4 grid-flow-row-dense gap-2 md:gap-4 lg:gap-6 auto-rows-[250px] md:auto-rows-[300px]"
        >
          {photos.map((photo, idx) => {
            const lightUrl = pageImage(photo.light);
            const darkUrl = pageImage(photo.dark || photo.light);
            return (
              <motion.div
                key={idx}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
                }}
                className={`relative overflow-hidden rounded-[20px] group cursor-pointer bg-slate-200 dark:bg-slate-800 ${spans[idx % spans.length]}`}
              >
                {/* Light image */}
                <img
                  src={lightUrl}
                  alt={photo.alt}
                  loading="lazy"
                  className={`absolute inset-0 w-full h-full object-cover transition-[opacity,transform] duration-700 md:group-hover:scale-105 ${isDarkMode ? 'opacity-0' : 'opacity-100'}`}
                />
                {/* Dark image */}
                <img
                  src={darkUrl}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 md:group-hover:scale-105 transition-transform duration-[1.5s] ${isDarkMode ? 'opacity-100' : 'opacity-0'}`}
                />

                <div className="absolute inset-0 bg-[#101C2B]/10 z-10 group-hover:bg-transparent transition-colors duration-500" />
                <div className="absolute inset-0 border border-white/10 rounded-[20px] z-20 pointer-events-none" />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <ProjectsShowcase heading={c.text('projects.heading')} intro={c.text('projects.intro')} />
    </div>
  );
}
