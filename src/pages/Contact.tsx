import { useLayoutEffect, useState, type ChangeEvent, type SyntheticEvent } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { motion } from 'motion/react';
import { Send, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import ContactMap from '../components/ContactMap';
import { IMAGES } from '../config/images';

import LiquidWaterEffect from '../components/LiquidWaterEffect';
import ContactFAQSection from '../components/ContactFAQSection';

// ---------------------------------------------------------------------------
// Form types & helpers
// ---------------------------------------------------------------------------
interface FormFields {
  name: string;
  email: string;
  phone: string;
  projectType: string;
  message: string;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const EMPTY_FORM: FormFields = { name: '', email: '', phone: '', projectType: '', message: '' };

function validate(f: FormFields): Partial<Record<keyof FormFields, string>> {
  const errors: Partial<Record<keyof FormFields, string>> = {};
  if (!f.name.trim())                          errors.name        = 'Full name is required.';
  if (!f.email.trim())                         errors.email       = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))
                                               errors.email       = 'Enter a valid email address.';
  if (f.phone && !/^[\d\s\+\-\(\)]{7,15}$/.test(f.phone))
                                               errors.phone       = 'Enter a valid phone number.';
  if (!f.projectType)                          errors.projectType = 'Please select a project type.';
  if (!f.message.trim())                       errors.message     = 'Message is required.';
  return errors;
}

export default function Contact() {
  usePageMeta(
    'Contact Crystal Pools — Get a Free Quote',
    'Reach out to Crystal Pools, a trusted swimming pool consultant and contractor in Pune, for luxury pool construction, renovation, and equipment across Pune, Mumbai, Nashik, and all India. Call or send an inquiry today.',
  );

  const { hash } = useLocation();

  const [fields, setFields]   = useState<FormFields>(EMPTY_FORM);
  const [errors, setErrors]   = useState<Partial<Record<keyof FormFields, string>>>({});
  const [status, setStatus]   = useState<FormStatus>('idle');

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFields(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormFields]) {
      setErrors(prev => { const next = { ...prev }; delete next[name as keyof FormFields]; return next; });
    }
  };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fieldErrors = validate(fields);
    if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

    setStatus('submitting');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_KEY ?? '',
          subject: `New Pool Inquiry — ${fields.projectType}`,
          ...fields,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setFields(EMPTY_FORM);
        setErrors({});
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  useLayoutEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'auto' });
        // Also ensure a follow-up in case AnimatePresence overrides it
        setTimeout(() => element.scrollIntoView({ behavior: 'auto' }), 50);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="w-full bg-white dark:bg-[#070d14]">
      {/* 1. Hero Section */}
      <section className="relative min-h-screen pt-24 pb-12 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={IMAGES.services.swimmingPool} 
            alt="Luxury Pool at Sunset" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/40 to-[#070d14] dark:to-[#070d14] bg-[#f8fcfd]/0 dark:bg-transparent"></div>
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-20">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl lg:text-7xl font-display font-bold text-white dark:text-brand-gold mb-6 leading-[1.2] drop-shadow-lg"
          >
            Let's Build Your<br />
            <span className="font-serif italic text-[#f9c80e] font-normal text-5xl md:text-7xl lg:text-[80px]">Dream Pool.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-white font-medium drop-shadow-xl"
          >
            Reach out to our experts across India for luxury pool construction, renovation, and premium equipment.
          </motion.p>
        </div>
      </section>

      {/* 2. Interactive Map Hub */}
      <section className="min-h-screen flex items-center justify-center overflow-hidden bg-[#f8fcfd] dark:bg-[#020609] pt-24 pb-16 lg:py-0 lg:pt-24 lg:pb-12">
        <ContactMap />
      </section>

      {/* 3. Direct Inquiry Form */}
      <section id="inquiry" className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
        {/* Layer 1: Background Water Effect */}
        <div className="absolute inset-0 z-0">
          <LiquidWaterEffect />
        </div>

        {/* Layer 2: Foreground UI Grid */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 h-full flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-center">

            {/* Left Column: Headline */}
            <div className="flex flex-col justify-center text-center lg:text-left pt-10 lg:pt-0">
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-5xl md:text-6xl lg:text-7xl font-serif text-white mb-6 drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] leading-tight"
              >
                Dive into your<br/>
                <span className="italic text-cyan-100 font-light">dream project.</span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-lg md:text-xl text-cyan-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] max-w-lg mx-auto lg:mx-0 font-sans font-light leading-relaxed"
              >
                Reach out to our experts for luxury pool construction, renovation, and premium equipment.
              </motion.p>
            </div>

            {/* Right Column: Glassmorphism Form Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-black/40 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent opacity-50 pointer-events-none"></div>

              <div className="text-center sm:text-left mb-8 relative z-10">
                <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">Send an Inquiry</h3>
                <p className="text-cyan-100 text-sm md:text-base font-light">Fill out the form below and our team will get back to you promptly.</p>
              </div>

              {/* Success state */}
              {status === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 gap-4 text-center relative z-10"
                >
                  <CheckCircle className="w-14 h-14 text-emerald-400" />
                  <h4 className="text-xl font-display font-bold text-white">Inquiry Sent!</h4>
                  <p className="text-cyan-100 text-sm font-light max-w-xs">
                    Thank you — our team will get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => setStatus('idle')}
                    className="mt-2 text-sm text-cyan-300 underline underline-offset-4 hover:text-white transition-colors"
                  >
                    Send another inquiry
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-4 md:space-y-5 relative z-10">
                  {/* Error banner */}
                  {status === 'error' && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/20 border border-red-400/30 text-red-200 text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      Something went wrong. Please try again or contact us directly.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                    <div>
                      <label htmlFor="name" className="block text-xs font-medium text-cyan-100 uppercase tracking-wider mb-1.5">Full Name *</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={fields.name}
                        onChange={handleChange}
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                        className={`w-full px-5 py-3.5 rounded-2xl border bg-white/5 text-white placeholder-white/40 focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all outline-none shadow-sm ${errors.name ? 'border-red-400/60' : 'border-white/20'}`}
                      />
                      {errors.name && <p id="name-error" className="mt-1 text-xs text-red-300">{errors.name}</p>}
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-xs font-medium text-cyan-100 uppercase tracking-wider mb-1.5">Email Address *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={fields.email}
                        onChange={handleChange}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        className={`w-full px-5 py-3.5 rounded-2xl border bg-white/5 text-white placeholder-white/40 focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all outline-none shadow-sm ${errors.email ? 'border-red-400/60' : 'border-white/20'}`}
                      />
                      {errors.email && <p id="email-error" className="mt-1 text-xs text-red-300">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                    <div>
                      <label htmlFor="phone" className="block text-xs font-medium text-cyan-100 uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={fields.phone}
                        onChange={handleChange}
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone ? 'phone-error' : undefined}
                        className={`w-full px-5 py-3.5 rounded-2xl border bg-white/5 text-white placeholder-white/40 focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all outline-none shadow-sm ${errors.phone ? 'border-red-400/60' : 'border-white/20'}`}
                      />
                      {errors.phone && <p id="phone-error" className="mt-1 text-xs text-red-300">{errors.phone}</p>}
                    </div>
                    <div>
                      <label htmlFor="projectType" className="block text-xs font-medium text-cyan-100 uppercase tracking-wider mb-1.5">Project Type *</label>
                      <select
                        id="projectType"
                        name="projectType"
                        value={fields.projectType}
                        onChange={handleChange}
                        aria-invalid={!!errors.projectType}
                        aria-describedby={errors.projectType ? 'type-error' : undefined}
                        className={`w-full px-5 py-3.5 rounded-2xl border bg-white/5 text-white focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all outline-none shadow-sm appearance-none [&>option]:bg-slate-900 ${errors.projectType ? 'border-red-400/60' : 'border-white/20'}`}
                      >
                        <option value="" disabled className="text-slate-500">Select Type</option>
                        <option value="New Pool Construction">New Pool Construction</option>
                        <option value="Renovation">Renovation</option>
                        <option value="Premium Equipment">Premium Equipment</option>
                        <option value="Commercial Pool">Commercial Pool</option>
                        <option value="Other">Other</option>
                      </select>
                      {errors.projectType && <p id="type-error" className="mt-1 text-xs text-red-300">{errors.projectType}</p>}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-xs font-medium text-cyan-100 uppercase tracking-wider mb-1.5">Message *</label>
                    <textarea
                      id="message"
                      name="message"
                      rows={3}
                      value={fields.message}
                      onChange={handleChange}
                      aria-invalid={!!errors.message}
                      aria-describedby={errors.message ? 'message-error' : undefined}
                      className={`w-full px-5 py-3.5 rounded-2xl border bg-white/5 text-white placeholder-white/40 focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all outline-none resize-none shadow-sm ${errors.message ? 'border-red-400/60' : 'border-white/20'}`}
                      placeholder="Tell us about your requirements, dimensions, or vision..."
                    />
                    {errors.message && <p id="message-error" className="mt-1 text-xs text-red-300">{errors.message}</p>}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="inline-flex items-center justify-center px-8 py-4 bg-cyan-500 text-white font-medium text-lg rounded-2xl hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:-translate-y-0.5 transition-all duration-300 w-full shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                      {status === 'submitting' ? (
                        <><Loader size={20} className="mr-3 animate-spin" />Sending…</>
                      ) : (
                        <><Send size={20} className="mr-3" />Submit Inquiry</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4. FAQ Section */}
      <ContactFAQSection />

    </div>
  );
}
