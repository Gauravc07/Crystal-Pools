import type { FC, ElementType } from 'react';
import { motion } from 'motion/react';
import { Blocks, Award, Handshake, CircleDollarSign, GraduationCap, Zap } from 'lucide-react';

import { usePageContent } from '../lib/pageContent';
import { aboutPage } from '../content/pages/about';

// Icon for each of the 6 positions; titles and descriptions come from the admin panel.
const ICONS: ElementType[] = [Blocks, Award, Handshake, CircleDollarSign, GraduationCap, Zap];

interface Reason { title: string; description: string; icon: ElementType }

const HexagonCard: FC<{ item: Reason; index: number }> = ({ item, index }) => {
  const Icon = item.icon;
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      style={{ filter: 'drop-shadow(0px 10px 30px rgba(6, 15, 26, 0.08))' }}
      className="group"
    >
      <div 
        className="w-[280px] h-[244px] bg-white dark:bg-[#0b1627] flex flex-col items-center justify-center p-8 transition-transform duration-300 group-hover:-translate-y-2 relative"
        style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
      >
        <div className="w-14 h-14 rounded-full bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center mb-5 transition-colors group-hover:bg-brand-gold/10">
          <Icon className="text-brand-gold w-6 h-6" />
        </div>
        <h3 className="font-sans font-bold text-slate-900 dark:text-white mb-2 text-center text-lg">{item.title}</h3>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
          {item.description}
        </p>
      </div>
    </motion.div>
  );
}

export default function WhyChooseUs() {
  const c = usePageContent(aboutPage);
  const whyChooseUsData: Reason[] = c.list('why.items').map((item, i) => ({ title: item.title, description: item.description, icon: ICONS[i % ICONS.length] }));
  // The last word of the heading is highlighted in gold
  const words = c.text('why.heading').trim().split(/\s+/);
  const headingLast = words.pop() ?? '';
  const headingStart = words.join(' ');
  return (
    <section className="py-16 md:py-20 bg-[#f8fcfd] dark:bg-[#020609] relative overflow-hidden min-h-[100dvh] flex flex-col justify-center">
      {/* Background subtleties */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-cyan-100/40 dark:bg-cyan-900/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-brand-gold/10 dark:bg-brand-gold/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10 md:mb-14">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-sans text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4"
          >
            {headingStart}{headingStart && ' '}<span className="text-brand-gold">{headingLast}</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 dark:text-slate-400 text-base md:text-lg font-light max-w-2xl mx-auto"
          >
            {c.text('why.intro')}
          </motion.p>
        </div>

        {/* Responsive Grid Layout */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 md:pb-12">
          
          {/* Desktop Honeycomb Layout (lg and up) */}
          <div className="hidden lg:flex justify-center items-start mx-auto w-fit">
            {/* Column 1 */}
            <div className="flex flex-col gap-4">
              <HexagonCard item={whyChooseUsData[0]} index={0} />
              <HexagonCard item={whyChooseUsData[1]} index={1} />
            </div>
            {/* Column 2 */}
            <div className="flex flex-col gap-4 -ml-[54px] mt-[130px]">
              <HexagonCard item={whyChooseUsData[2]} index={2} />
            </div>
            {/* Column 3 */}
            <div className="flex flex-col gap-4 -ml-[54px]">
              <HexagonCard item={whyChooseUsData[3]} index={3} />
              <HexagonCard item={whyChooseUsData[4]} index={4} />
            </div>
            {/* Column 4 */}
            <div className="flex flex-col gap-4 -ml-[54px] mt-[130px]">
              <HexagonCard item={whyChooseUsData[5]} index={5} />
            </div>
          </div>

          {/* Tablet & Mobile Layout (below lg) */}
          <div className="grid lg:hidden grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 place-items-center">
            {whyChooseUsData.map((item, idx) => (
              <HexagonCard key={idx} item={item} index={idx} />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
