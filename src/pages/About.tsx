import { motion, useScroll, useTransform, type Variants } from "motion/react";
import { usePageMeta } from '../hooks/usePageMeta';
import { ShieldCheck, Handshake, Zap, Target, FileText, Download } from "lucide-react";
import LeadershipCards from "../components/LeadershipCards";
import OurJourney from "../components/OurJourney";
import WhyChooseUs from "../components/WhyChooseUs";
import GlowCard from "../components/GlowCard";
import { IMAGES } from "../config/images";
import { DOCUMENTS } from "../config/documents";
import { Lines, usePageContent } from '../lib/pageContent';
import { aboutPage } from '../content/pages/about';

export default function About() {
  const c = usePageContent(aboutPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'), c.image('hero.image'));
  const cornerstoneIcons = [Handshake, ShieldCheck, Zap];

  const fadeUpVariant: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" as const },
    },
  };

  const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 },
    },
  };

  return (
    <div className="bg-[#f8fcfd] dark:bg-[#070d14] min-h-screen w-full">
      {/* 1. Hero Section */}
      <section className="relative w-full h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 w-full h-full">
          <img
            alt={c.text('hero.alt')}
            className="w-full h-full object-cover saturate-[1.1] brightness-[1.05]"
            src={c.image('hero.image')}
          />
          {/* Base overlay for text readability without making it dark and dull */}
          <div className="absolute inset-0 bg-black/20"></div>
        </div>
        <motion.div
          className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-16"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.h1
            variants={fadeUpVariant}
            className="text-3xl md:text-5xl lg:text-7xl font-sans font-bold text-white dark:text-brand-gold mb-6 leading-[1.2] drop-shadow-lg"
          >
            {c.text('hero.title')}<br />
            <span className="font-serif italic text-[#f9c80e] font-normal text-5xl md:text-7xl lg:text-[80px]">{c.text('hero.highlight')}</span>
          </motion.h1>
          <motion.p
            variants={fadeUpVariant}
            className="text-xl md:text-2xl text-white font-medium max-w-3xl mx-auto drop-shadow-xl"
          >
            {c.text('hero.intro')}
          </motion.p>
        </motion.div>
      </section>

      {/* 2. Philosophy Section */}
      <section className="py-24 bg-white dark:bg-[#070d14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <motion.h2
                variants={fadeUpVariant}
                className="font-display text-4xl md:text-5xl font-bold text-[#0a5c86] dark:text-white mb-6 tracking-tight"
              >
                {c.text('philosophy.heading')}
              </motion.h2>
              <motion.div
                variants={fadeUpVariant}
                className="w-20 h-1 bg-linear-to-r from-[#06b6d4] to-[#2563eb] mb-8"
              ></motion.div>
              <motion.p
                variants={fadeUpVariant}
                className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed mb-6"
              >
                {c.text('philosophy.p1')}
              </motion.p>
              <motion.p
                variants={fadeUpVariant}
                className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed"
              >
                {c.text('philosophy.p2')}
              </motion.p>
            </motion.div>
            <motion.div
              className="relative rounded-2xl overflow-hidden shadow-2xl h-[500px]"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <img
                alt={c.text('philosophy.alt')}
                className="w-full h-full object-cover"
                src={c.image('philosophy.image')}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. Cornerstones Section */}
      <section className="py-24 bg-[#f8fcfd] dark:bg-[#0a111a] border-y border-slate-200 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.h2
              variants={fadeUpVariant}
              className="font-display text-4xl md:text-5xl font-bold text-[#0a5c86] dark:text-white mb-4 tracking-tight"
            >
              {c.text('cornerstones.heading')}
            </motion.h2>
            <motion.p
              variants={fadeUpVariant}
              className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto"
            >
              {c.text('cornerstones.intro')}
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {c.list('cornerstones.items').map((item, i) => {
              const Icon = cornerstoneIcons[i % cornerstoneIcons.length];
              return (
                <motion.div key={i} variants={fadeUpVariant} className="h-full">
                  <GlowCard className="h-full">
                    <Icon className="w-12 h-12 text-[#06b6d4] mb-6 group-hover:scale-110 transition-transform duration-300" />
                    <h3 className="font-display text-2xl font-bold text-[#0a5c86] dark:text-white mb-4">
                      {item.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.text}
                    </p>
                  </GlowCard>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* 4. Corporate Resources */}
      <section className="py-24 bg-[#f8fcfd] dark:bg-[#0a111a] border-y border-slate-200 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-6 tracking-tight text-[#0a5c86] dark:text-white">
                {c.text('resources.heading')}
              </h2>
              <div className="w-20 h-1 bg-linear-to-r from-[#06b6d4] to-[#2563eb] mb-8" />
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                {c.text('resources.intro')}
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href={DOCUMENTS.companyProfile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-[#0a5c86] dark:bg-white text-white dark:text-slate-900 font-bold rounded-sm hover:bg-[#034466] dark:hover:bg-cyan-400 transition-colors duration-300"
                >
                  <FileText size={20} />
                  {c.text('resources.profileButton')}
                </a>
                <a
                  href={DOCUMENTS.companyBrochure}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 border border-[#0a5c86]/40 dark:border-white/20 text-[#0a5c86] dark:text-white font-bold rounded-sm hover:bg-[#0a5c86]/10 dark:hover:bg-white/10 transition-colors duration-300"
                >
                  <Download size={20} />
                  {c.text('resources.brochureButton')}
                </a>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative aspect-video rounded-2xl overflow-hidden shadow-xl bg-white dark:bg-slate-800 flex items-center justify-center p-12 border border-slate-200 dark:border-white/10"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-[#0a5c86]/10 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText size={40} className="text-[#0a5c86] dark:text-brand-gold" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">{c.text('resources.cardTitle')}</h3>
                <p className="text-slate-500 dark:text-slate-400">{c.text('resources.cardText')}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. Leadership Section */}
      <section className="py-12 md:py-16 min-h-screen flex flex-col justify-center bg-white dark:bg-[#070d14] relative z-10 w-full overflow-hidden">
        <motion.div
          className="max-w-4xl mx-auto px-4 text-center mb-10 lg:mb-12 shrink-0"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2
            variants={fadeUpVariant}
            className="font-display text-4xl md:text-5xl font-bold text-[#0a5c86] dark:text-white mb-4 tracking-tight"
          >
            {c.text('leadership.heading')}
          </motion.h2>
          <motion.p
            variants={fadeUpVariant}
            className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            {c.text('leadership.intro')}
          </motion.p>
        </motion.div>

        <div className="shrink-0">
          <LeadershipCards />
        </div>
      </section>

      {/* 5.5. Our Journey */}
      <OurJourney />

      {/* 6. Why Choose Us Section */}
      <WhyChooseUs />
    </div>
  );
}
