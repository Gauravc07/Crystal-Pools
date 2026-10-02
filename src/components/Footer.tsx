import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import Logo from './Logo';

import ScrollToTopButton from './ScrollToTopButton';
import { IMAGES } from '../config/images';
import { DOCUMENTS } from '../config/documents';
import { telHref, useSiteSettings } from '../lib/siteSettings';
import { usePageContent } from '../lib/pageContent';
import { footerContent } from '../content/pages/footer';

const SOCIAL_ICONS = { instagram: Instagram, facebook: Facebook, linkedin: Linkedin, youtube: Youtube } as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const settings = useSiteSettings();
  const c = usePageContent(footerContent);

  return (
    <footer className="relative text-slate-100 min-h-screen pt-20 lg:pt-28 pb-0 overflow-hidden bg-slate-900 border-none flex flex-col">
      {/* Background Image & Gradient */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${IMAGES.sections.footer})` }} 
      >
         <div className="absolute inset-0 bg-linear-to-b from-transparent via-slate-900/80 to-[rgba(15,23,42,0.95)]" />
      </div>

      {/* Top Edge Water Surface SVG Divider */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none z-10 pointer-events-none">
        <svg viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 w-full h-[60px] md:h-[120px] -mt-[1px]" preserveAspectRatio="none">
          <path fill="#f8fcfd" fillOpacity="1" className="dark:fill-[#070d14]" d="M0,160L48,176C96,192,192,224,288,208C384,192,480,128,576,133.3C672,139,768,213,864,229.3C960,245,1056,203,1152,181.3C1248,160,1344,160,1392,160L1440,160L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex-grow flex items-center">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 w-full py-16">
          {/* Col 1: Logo & Brand */}
          <div className="flex flex-col items-start">
            <Link to="/" className="flex items-center space-x-3 mb-4 group">
              <Logo className="w-14 h-14 shrink-0 transform transition-transform group-hover:scale-105" />
              <span className="font-display font-bold text-xl tracking-tight text-white">Crystal Pools</span>
            </Link>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              {c.text('about')}
            </p>
          </div>

          {/* Col 2: Downloads */}
          <div className="lg:pl-8">
            <h4 className="text-base tracking-wider mb-4 font-semibold uppercase text-white border-b border-cyan-500/30 pb-2 inline-block">{c.text('downloads.heading')}</h4>
            <ul className="space-y-3 text-[14px] text-slate-300">
              <li>
                <a href={DOCUMENTS.companyBrochure} target="_blank" rel="noopener noreferrer" className="flex items-center group hover:text-cyan-400 transition-colors w-fit">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 mr-3 group-hover:bg-cyan-400 group-hover:scale-150 transition-all" />
                  Company Brochure
                </a>
              </li>
              <li>
                <a href={DOCUMENTS.companyProfile} target="_blank" rel="noopener noreferrer" className="flex items-center group hover:text-cyan-400 transition-colors w-fit">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 mr-3 group-hover:bg-cyan-400 group-hover:scale-150 transition-all" />
                  Company Profile
                </a>
              </li>
              <li>
                <a href={DOCUMENTS.glassMosaicCatalogue} target="_blank" rel="noopener noreferrer" className="flex items-center group hover:text-cyan-400 transition-colors w-fit">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 mr-3 group-hover:bg-cyan-400 group-hover:scale-150 transition-all" />
                  Glass Mosaic Catalogue
                </a>
              </li>
              <li>
                <a href={DOCUMENTS.frpPoolBrochure} target="_blank" rel="noopener noreferrer" className="flex items-center group hover:text-cyan-400 transition-colors w-fit">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 mr-3 group-hover:bg-cyan-400 group-hover:scale-150 transition-all" />
                  FRP Pool Brochure
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Branches */}
          <div>
            <h4 className="text-base tracking-wider mb-4 font-semibold uppercase text-white border-b border-cyan-500/30 pb-2 inline-block">{c.text('branches.heading')}</h4>
            <ul className="grid grid-cols-2 gap-y-3 gap-x-2 text-[14px] text-slate-300 mb-6">
              {settings.branches.map(branch => (
                <li key={branch} className="flex items-center group cursor-default">
                  <MapPin size={14} className="mr-2 text-cyan-500/70 group-hover:text-cyan-400 transition-colors" />
                  <span className="group-hover:text-cyan-400 transition-colors">{branch}</span>
                </li>
              ))}
            </ul>

            <h4 className="text-base tracking-wider mb-4 font-semibold uppercase text-white border-b border-cyan-500/30 pb-2 inline-block">{c.text('hours.heading')}</h4>
            <ul className="space-y-2 text-slate-300 text-[14px]">
              {c.list('hours.items').map((h, i) => (
                <li key={i} className="flex justify-between items-center group cursor-default">
                  <span className="group-hover:text-cyan-400 transition-colors">{h.day}</span>
                  <span className={/^closed$/i.test(h.time.trim()) ? 'text-[#0a5c86]' : 'text-white'}>{h.time}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Contact & Social */}
          <div>
            <h4 className="text-base tracking-wider mb-4 font-semibold uppercase text-white border-b border-cyan-500/30 pb-2 inline-block">{c.text('contact.heading')}</h4>
            <div className="space-y-3 text-slate-300 text-[14px] mb-6">
              <a href={telHref(settings.phone)} className="flex items-center group hover:text-cyan-400 transition-colors w-fit">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mr-3 group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-all">
                   <Phone size={14} />
                </div>
                {settings.phone}
              </a>
              <a href={`mailto:${settings.email}`} className="flex items-center group hover:text-cyan-400 transition-colors w-fit">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mr-3 group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-all">
                   <Mail size={14} />
                </div>
                {settings.email}
              </a>
            </div>

            <h4 className="text-sm tracking-wider mb-3 font-semibold uppercase text-white">{c.text('follow.heading')}</h4>
            <div className="flex space-x-3">
              {(Object.keys(SOCIAL_ICONS) as (keyof typeof SOCIAL_ICONS)[]).filter(k => settings.social_links[k]).map(k => {
                const Icon = SOCIAL_ICONS[k];
                return (
                  <a key={k} href={settings.social_links[k]} target="_blank" rel="noopener noreferrer" aria-label={k} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:bg-cyan-500 hover:text-white transition-all transform hover:-translate-y-1">
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Center Floating Scroll To Top */}
      <div className="relative z-20 flex justify-center w-full -mb-8 pointer-events-none">
        <div className="pointer-events-auto">
          <ScrollToTopButton />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="relative z-10 border-t border-white/10 pt-16 pb-6 bg-slate-900/50 backdrop-blur-sm w-full mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-slate-400 text-sm font-light">
          <p className="mb-4 md:mb-0">© {currentYear} {c.text('copyright')}</p>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-cyan-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>

      </footer>
  );
}

