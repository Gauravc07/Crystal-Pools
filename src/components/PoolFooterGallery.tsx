import { useAnimationFrame } from 'motion/react';
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Phone, Mail, Instagram, Facebook, Linkedin, Youtube, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { telHref, useSiteSettings } from '../lib/siteSettings';
import { projectImage, useProjects } from '../lib/content';

const SOCIAL_ICONS = { facebook: Facebook, instagram: Instagram, linkedin: Linkedin, youtube: Youtube } as const;

export interface PoolGalleryImage {
  src: string;
  alt: string;
  title?: string;
}

/**
 * Marquee gallery at the bottom of each pool type page.
 * Shows photos from published admin projects of this pool type; falls back to the built-in images.
 */
export default function PoolFooterGallery({ images: fallbackImages, poolName, poolType }: { images: PoolGalleryImage[], poolName: string, poolType?: string }) {
  const projects = useProjects();
  const images = useMemo(() => {
    const fromProjects = (projects ?? [])
      .filter(p => p.pool_type === poolType)
      .flatMap(p => p.images.map(img => ({ src: projectImage(img.path) ?? '', alt: img.alt || p.name, title: p.name })));
    return fromProjects.length ? fromProjects : fallbackImages;
  }, [projects, poolType, fallbackImages]);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const settings = useSiteSettings();
  
  const [isHovered, setIsHovered] = useState(false);
  const x = useRef(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  
  const loopImages = [...images, ...images, ...images, ...images, ...images, ...images, ...images];

  const updateDOM = () => {
    if (!containerRef.current || !trackRef.current) return;
    
    const track = trackRef.current;
    const items = track.children;
    if (items.length === 0) return;
    
    const firstItem = items[0] as HTMLElement;
    const itemWidth = firstItem.offsetWidth;
    const gap = window.innerWidth < 1024 ? 16 : 32; // gap-4 mobile, gap-8 lg
    const setWidth = images.length * (itemWidth + gap);
    
    if (x.current <= -setWidth) {
      x.current += setWidth;
    } else if (x.current > 0) {
      x.current -= setWidth;
    }
    
    track.style.transform = `translateX(${x.current}px)`;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    
    for (let i = 0; i < items.length; i++) {
        const el = items[i] as HTMLElement;
        const unscaledCenter = containerRect.left + x.current + i * (itemWidth + gap) + itemWidth / 2;
        const dist = Math.abs(containerCenter - unscaledCenter);
        const maxDist = itemWidth + gap;
        
        let progress = 1 - Math.min(dist / maxDist, 1);
        
        // Base normal scrolling calculations
        let scale = 0.93 + (0.22 * progress); // 0.93 to 1.15
        let opacity = 0.75 + (0.25 * progress); // 0.75 to 1.0
        let grayscale = 25 - (25 * progress); // 25% to 0%
        let brightness = 0.95 + (0.1 * progress); // 0.95 to 1.05

        if (el.classList.contains('is-hovered')) {
          // Hover state override
          scale = 1.12;
          opacity = 1;
          grayscale = 0;
          brightness = 1.08;
          el.style.boxShadow = '0 20px 40px -10px rgba(6, 182, 212, 0.4)'; // Cyan tinted soft glow
          el.style.zIndex = '50';
        } else {
          el.style.boxShadow = '0 10px 20px -5px rgba(0, 0, 0, 0.3)';
          el.style.zIndex = '1';
        }
        
        el.style.transform = `scale(${scale})`;
        el.style.opacity = `${opacity}`;
        el.style.filter = `grayscale(${grayscale}%) brightness(${brightness})`;
    }
  };

  useAnimationFrame((_, delta) => {
    if (isHovered || isDragging.current) return;
    x.current -= delta * 0.05; // Base auto-scroll speed
    updateDOM();
  });

  useEffect(() => {
    const handleResize = () => updateDOM();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startX.current = e.pageX - x.current;
    if (trackRef.current) {
      trackRef.current.style.transition = 'none';
      trackRef.current.style.cursor = 'grabbing';
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    x.current = e.pageX - startX.current;
    updateDOM();
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    if (trackRef.current) {
      trackRef.current.style.cursor = 'grab';
    }
  };

  const handlePointerLeave = () => {
    isHovered && setIsHovered(false);
    if (isDragging.current) {
      isDragging.current = false;
      if (trackRef.current) trackRef.current.style.cursor = 'grab';
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full flex md:min-h-[500px] flex-col lg:flex-row bg-[#060F1A] border-t border-cyan-900/30 overflow-hidden relative">
      
      {/* 1. Left Section: Footer Content (50%) */}
      <div className="w-full lg:w-1/2 p-8 md:p-16 xl:p-24 flex flex-col justify-between relative z-10 text-white border-b lg:border-b-0 lg:border-r border-cyan-900/30">
        <div>
           {/* Replace this with dynamic Logo if available or text */}
           <div className="mb-10 text-3xl font-display font-medium uppercase tracking-widest text-[#f9c80e]">
               Crystal <span className="text-white font-serif italic text-4xl">Pools</span>
           </div>
           
           <h3 className="text-3xl md:text-5xl font-sans font-bold leading-tight mb-4 text-slate-100">
             Building <span className="text-cyan-400 font-serif italic font-normal">{poolName}</span><br />
             With Excellence.
           </h3>
           <p className="text-slate-400 font-light text-lg mb-8 max-w-sm">
             India’s leading aquatic engineers bringing a quarter-century of mastery to every project.
           </p>

           <Link 
             to="/contact-swimming-pool-contractor" 
             className="inline-flex items-center gap-3 text-[#f9c80e] font-medium tracking-widest uppercase hover:text-white transition-colors group text-sm md:text-base border-b border-[#f9c80e]/30 hover:border-white pb-1"
           >
             Start Your Project 
             <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
           </Link>
        </div>

        <div className="mt-16 flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end w-full">
           <div className="space-y-3">
              <a href={telHref(settings.phone)} className="flex items-center gap-3 text-slate-300 hover:text-cyan-400 transition-colors text-sm font-medium tracking-widest">
                <div className="w-8 h-8 rounded-full border border-cyan-900/50 flex flex-col items-center justify-center bg-cyan-900/20">
                  <Phone size={14} />
                </div>
                {settings.phone}
              </a>
              <a href={`mailto:${settings.email}`} className="flex items-center gap-3 text-slate-300 hover:text-cyan-400 transition-colors text-sm font-medium tracking-widest">
                <div className="w-8 h-8 rounded-full border border-cyan-900/50 flex flex-col items-center justify-center bg-cyan-900/20">
                  <Mail size={14} />
                </div>
                {settings.email}
              </a>
           </div>

           <div className="flex flex-col items-start md:items-end gap-6">
              <div className="flex gap-4">
                {(Object.keys(SOCIAL_ICONS) as (keyof typeof SOCIAL_ICONS)[]).filter(k => settings.social_links[k]).map(k => {
                  const Icon = SOCIAL_ICONS[k];
                  return (
                    <a key={k} href={settings.social_links[k]} target="_blank" rel="noopener noreferrer" aria-label={k} className="text-slate-500 hover:text-white transition-colors">
                      <Icon size={18} />
                    </a>
                  );
                })}
              </div>
              <p className="text-slate-600 text-xs tracking-widest font-light">
                © {currentYear} CRYSTAL POOLS.
              </p>
           </div>
        </div>
      </div>

      {/* 2. Right Section: Marquee Gallery (50%) */}
      <div 
        className="w-full lg:w-1/2 h-[400px] md:h-[500px] lg:h-auto py-12 lg:py-0 relative overflow-hidden bg-slate-900/50 flex items-center justify-center"
        ref={containerRef}
      >
        <div className="absolute inset-y-0 left-0 w-24 bg-linear-to-r from-[#060F1A] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-linear-to-l from-[#060F1A] to-transparent z-10 pointer-events-none" />

        <div 
          ref={trackRef}
          className="flex items-center gap-4 lg:gap-8 w-fit shrink-0 cursor-grab px-[50%]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onMouseEnter={() => setIsHovered(true)}
          style={{ willChange: 'transform' }}
        >
          {loopImages.map((img, idx) => (
            <div 
              key={idx} 
              className="relative shrink-0 w-[260px] h-[340px] md:w-[300px] md:h-[400px] lg:w-[320px] lg:h-[420px] rounded-2xl overflow-hidden shadow-2xl items-center justify-center transform-gpu cursor-pointer transition-none"
              style={{ transformOrigin: 'center center' }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.classList.add('is-hovered');
                el.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s ease-out, filter 0.4s ease-out, box-shadow 0.4s ease-out';
                updateDOM();
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.classList.remove('is-hovered');
                updateDOM();
                setTimeout(() => {
                  if (!el.classList.contains('is-hovered')) {
                    el.style.transition = 'none';
                  }
                }, 400);
              }}
            >
              <img 
                src={img.src} 
                alt={img.alt} 
                className="w-full h-full object-cover object-center pointer-events-none" 
              />
              {img.title && (
                <div className="absolute bottom-0 left-0 w-full p-6 bg-linear-to-t from-[#040B14]/80 via-[#040B14]/30 to-transparent pointer-events-none">
                  <span className="text-white font-medium tracking-widest drop-shadow-sm text-sm uppercase">{img.title}</span>
                </div>
              )}
              {/* Optional elegant border reflection overlay */}
              <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none" />
            </div>
          ))}
        </div>
      </div>

    </footer>
  );
}
