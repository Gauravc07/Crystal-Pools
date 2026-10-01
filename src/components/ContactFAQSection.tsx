import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

import { usePageContent } from '../lib/pageContent';
import { contactPage } from '../content/pages/contact';

export default function ContactFAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const c = usePageContent(contactPage);
  const faqs = c.list('faq.items').filter(f => f.question.trim());

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 bg-white dark:bg-[#070d14] relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-display font-bold text-brand-blue dark:text-white mb-4"
          >
            {c.text('faq.heading')}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-600 dark:text-slate-400 text-lg md:text-xl font-light"
          >
            {c.text('faq.intro')}
          </motion.p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors duration-300 ${isOpen ? 'bg-slate-50 dark:bg-slate-900/50' : 'bg-white dark:bg-transparent'}`}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className="text-lg font-medium text-slate-900 dark:text-slate-100 pr-6">
                    {faq.question}
                  </span>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-transform duration-300 ${isOpen ? 'bg-cyan-500 border-cyan-500 text-white rotate-180' : 'text-slate-500 dark:text-slate-400'}`}>
                    <ChevronDown size={16} />
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="p-6 pt-0 text-slate-600 dark:text-slate-400 leading-relaxed font-light">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
