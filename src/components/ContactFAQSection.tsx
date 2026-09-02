import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "How long does it take to build a luxury swimming pool?",
    answer: "The timeline for building a luxury swimming pool depends on the complexity of the design, size, and location. Generally, a standard concrete pool takes 8-12 weeks from excavation to completion. Custom features, intricate landscaping, and permit approvals may extend the timeframe. We provide a detailed project schedule during our initial consultation."
  },
  {
    question: "What is the swimming pool construction cost in Pune?",
    answer: "Swimming pool prices vary based on size, depth, materials, and features such as tiling, filtration, and lighting. As a general guide, private pool construction typically starts from a few lakhs and scales up with custom design elements, while commercial and readymade FRP pools follow their own pricing tiers. Share your requirements with our team for a detailed, no-obligation quote tailored to your project in Pune or anywhere in India."
  },
  {
    question: "Do you offer pool maintenance and aftercare services?",
    answer: "Yes, we offer comprehensive pool maintenance and aftercare services to ensure your pool remains in pristine condition. Our team handles everything from water chemistry balancing, equipment inspection, and seasonal openings/closings to full-service cleaning and repairs."
  },
  {
    question: "What kind of warranty do you provide on your pools?",
    answer: "We stand behind the quality of our craftsmanship with industry-leading warranties. This typically includes a structural warranty for the pool shell, along with specific manufacturer warranties for premium equipment like pumps, filters, and heaters. Exact warranty details are outlined in your personalized contract."
  },
  {
    question: "Can I customize the design and features of my swimming pool?",
    answer: "Absolutely. We specialize in fully bespoke luxury swimming pools. Our design team works closely with you to integrate custom features such as infinity edges, integrated spas, custom lighting, automation systems, underwater acoustic systems, and high-end materials that match your vision and landscape."
  },
  {
    question: "Are your swimming pools eco-friendly and energy-efficient?",
    answer: "We prioritize sustainability and energy efficiency in our designs. We incorporate variable-speed pumps, LED lighting, effective covers, and advanced filtration systems that significantly reduce energy and water consumption without compromising on luxury or performance."
  }
];

export default function ContactFAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
            Frequently Asked Questions
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-600 dark:text-slate-400 text-lg md:text-xl font-light"
          >
            Find answers to common questions about our process, timeline, and services.
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
