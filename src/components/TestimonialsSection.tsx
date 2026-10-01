import { motion } from 'motion/react';
import { Quote, Star } from 'lucide-react';
import { testimonialPhoto, useTestimonials } from '../lib/content';
import { usePageContent } from '../lib/pageContent';
import { homePage } from '../content/pages/home';

/** Client reviews managed in the admin panel. Renders nothing until at least one is published. */
export default function TestimonialsSection() {
  const items = useTestimonials();
  const c = usePageContent(homePage);
  if (!items?.length) return null;

  return (
    <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#070d14] transition-colors duration-500">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 md:mb-20">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-cyan mb-4">{c.text('testimonials.eyebrow')}</p>
          <h2 className="text-4xl md:text-5xl font-display font-medium text-slate-900 dark:text-white tracking-tight">
            {c.text('testimonials.heading')}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((t, i) => {
            const photo = testimonialPhoto(t.photo);
            const initials = t.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
            return (
              <motion.figure
                key={t.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
                className="relative flex flex-col rounded-3xl p-8 bg-slate-50 dark:bg-[#0f1724] border border-slate-100 dark:border-slate-800"
              >
                <Quote className="absolute top-6 right-6 w-10 h-10 text-brand-blue/10 dark:text-white/5" aria-hidden="true" />
                <div className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`w-4 h-4 ${n <= t.rating ? 'fill-brand-gold text-brand-gold' : 'text-slate-300 dark:text-slate-700'}`} aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="mt-5 flex-1 text-slate-700 dark:text-slate-300 leading-relaxed font-light">
                  “{t.review}”
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-3">
                  {photo ? (
                    <img src={photo} alt="" loading="lazy" className="w-11 h-11 rounded-full object-cover" />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-brand-blue/10 dark:bg-[#38bdf8]/10 text-brand-blue dark:text-[#38bdf8] text-sm font-semibold flex items-center justify-center">
                      {initials}
                    </span>
                  )}
                  <span>
                    <span className="block font-semibold text-slate-900 dark:text-white">{t.name}</span>
                    {t.designation && <span className="block text-sm text-slate-500 dark:text-slate-400">{t.designation}</span>}
                  </span>
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
