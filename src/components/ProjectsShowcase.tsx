import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';
import { POOL_TYPE_LABELS, projectImage, useProjects } from '../lib/content';
import type { Project } from '../lib/content';
import { usePanelContext } from '../contexts/PanelContext';

function ProjectViewer({ project, onClose }: { project: Project; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const { setPanelOpen } = usePanelContext();
  const images = project.images.length ? project.images : project.cover_image ? [{ path: project.cover_image, alt: project.name }] : [];
  const count = images.length;

  useEffect(() => {
    setPanelOpen(true);
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex(i => (i + 1) % count);
      if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + count) % count);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      setPanelOpen(false);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [count, onClose, setPanelOpen]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={project.name}
      data-lenis-prevent
    >
      <div className="flex items-start justify-between gap-4 p-4 md:p-6 text-white">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-semibold">{project.name}</h2>
          <p className="mt-1 text-sm text-white/70 flex items-center gap-1.5">
            {project.location && <><MapPin className="w-4 h-4" />{project.location} · </>}
            {POOL_TYPE_LABELS[project.pool_type] ?? project.pool_type} pool
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 md:px-16">
        {count > 0 && (
          <img
            key={images[index].path}
            src={projectImage(images[index].path) ?? ''}
            alt={images[index].alt || project.name}
            className="max-h-full max-w-full object-contain rounded-xl"
          />
        )}
        {count > 1 && (
          <>
            <button onClick={() => setIndex(i => (i - 1 + count) % count)} className="absolute left-2 md:left-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Previous photo">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={() => setIndex(i => (i + 1) % count)} className="absolute right-2 md:right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Next photo">
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      <div className="p-4 md:p-6 text-white/80 text-sm max-w-3xl mx-auto w-full">
        {count > 1 && <p className="text-center text-white/50 mb-2">{index + 1} / {count}</p>}
        {project.description && <p className="text-center leading-relaxed whitespace-pre-line">{project.description}</p>}
      </div>
    </motion.div>
  );
}

/** Completed projects managed in the admin panel. Renders nothing until at least one is published. */
export default function ProjectsShowcase({ heading, intro }: { heading: string; intro: string }) {
  const projects = useProjects();
  const [open, setOpen] = useState<Project | null>(null);

  if (!projects?.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold font-display text-[#0a5c86] dark:text-white">{heading}</h2>
        <p className="mt-4 text-gray-600 dark:text-slate-300 text-lg max-w-2xl mx-auto">
          {intro}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p, i) => {
          const cover = projectImage(p.cover_image ?? p.images[0]?.path);
          return (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => setOpen(p)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="group text-left rounded-[20px] overflow-hidden bg-white dark:bg-[#0f1724] border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-shadow"
            >
              <div className="relative aspect-4/3 overflow-hidden bg-slate-200 dark:bg-slate-800">
                {cover && <img src={cover} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />}
                <span className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md text-white text-xs font-bold uppercase tracking-widest rounded-full">
                  {POOL_TYPE_LABELS[p.pool_type] ?? p.pool_type}
                </span>
                {p.images.length > 1 && (
                  <span className="absolute bottom-4 right-4 px-2.5 py-1 bg-black/50 backdrop-blur-md text-white text-xs rounded-full">
                    {p.images.length} photos
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-white group-hover:text-[#0a5c86] dark:group-hover:text-[#38bdf8] transition-colors">{p.name}</h3>
                {p.location && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><MapPin className="w-4 h-4" />{p.location}</p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {open && <ProjectViewer key={open.id} project={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </section>
  );
}
