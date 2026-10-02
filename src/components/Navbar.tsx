import { useState, useRef, useEffect } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from 'motion/react';
import { ChevronRight, ArrowLeft, X, ChevronDown } from 'lucide-react';
import Logo from './Logo';
import { useTheme } from '../contexts/ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface DropdownItem {
  name: string;
  subtitle: string;
  path: string;
}

interface NavLink {
  name: string;
  path: string;
  dropdown?: DropdownItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Static nav data — defined outside component so it's never re-created
// ─────────────────────────────────────────────────────────────────────────────
const NAV_LINKS: NavLink[] = [
  { name: 'Home',  path: '/' },
  { name: 'About', path: '/about' },
  {
    name: 'Pool Types',
    path: '/swimming-pool-types',
    dropdown: [
      { name: 'Types Overview', subtitle: 'View all designs',  path: '/swimming-pool-types' },
      { name: 'Private',        subtitle: 'Swimming pools',    path: '/private-swimming-pools' },
      { name: 'Commercial',     subtitle: 'Swimming pools',    path: '/commercial-swimming-pools' },
      { name: 'Recreational',   subtitle: 'Swimming pools',    path: '/recreational-swimming-pools' },
      { name: 'Competition',    subtitle: 'Swimming pools',    path: '/competition-swimming-pools' },
      { name: 'Vanishing Edge', subtitle: 'Swimming pools',    path: '/vanishing-edge-swimming-pools' },
      { name: 'Overflow Type',  subtitle: 'Swimming pools',    path: '/overflow-type-swimming-pools' },
      { name: 'Skimmer Type',   subtitle: 'Swimming pools',    path: '/skimmer-type-swimming-pools' },
      { name: 'Readymade FRP',      subtitle: 'Swimming pools',    path: '/readymade-swimming-pool' },
    ],
  },
  {
    name: 'Services',
    path: '/services',
    dropdown: [
      { name: 'Services Overview',    subtitle: 'Full project catalog',  path: '/services' },
      { name: 'Swimming pools',       subtitle: 'Turnkey projects',      path: '/services/turnkey-projects' },
      { name: 'Waterfall & fountain', subtitle: 'Water features',        path: '/services/waterfall-fountain' },
      { name: 'Readymade FRP pools',      subtitle: 'Prefabricated',         path: '/services/readymade-pools' },
      { name: 'Pool tiles',           subtitle: 'Glass mosaic',          path: '/services/pool-tiles' },
      { name: 'Accessories',          subtitle: 'Engineering equipment', path: '/services/accessories' },
      { name: 'Renovation',           subtitle: 'Repairs & maintenance', path: '/services/renovation' },
    ],
  },
  {
    name: 'Products',
    path: '/products',
    dropdown: [
      { name: 'Equipment Catalog',    subtitle: 'Pumps & Accessories', path: '/products' },
      { name: 'Bathtubs & Jacuzzis', subtitle: 'Installations',       path: '/products/specialty-installations' },
    ],
  },
  { name: 'Gallery', path: '/gallery-swimming-pool-construction' },
  { name: 'Blog',    path: '/blogs' },
  { name: 'Contact', path: '/contact-swimming-pool-contractor' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sun / Moon SVG icons
// ─────────────────────────────────────────────────────────────────────────────
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
    </svg>
  );
}

// Unified theme toggle — renders pill on md+, icon-only on mobile
function ThemeToggle({ isDarkMode, onToggle }: { isDarkMode: boolean; onToggle: () => void }) {
  return (
    <>
      {/* md+ pill */}
      <button
        onClick={onToggle}
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`hidden md:flex items-center gap-2 px-5 py-2 rounded-full border transition-all duration-300 shadow-sm
          ${isDarkMode
            ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700 hover:border-slate-600'
            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300'
          }`}
      >
        {isDarkMode
          ? <><MoonIcon className="w-4 h-4 text-blue-400" /><span className="text-sm font-medium tracking-wide">Dark Mode</span></>
          : <><SunIcon  className="w-5 h-5 text-amber-500" /><span className="text-sm font-medium tracking-wide">Light Mode</span></>
        }
      </button>

      {/* mobile icon-only */}
      <button
        onClick={onToggle}
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`md:hidden flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300 shadow-sm
          ${isDarkMode
            ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
            : 'bg-white border-slate-200 text-amber-500 hover:bg-slate-50'
          }`}
      >
        {isDarkMode ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
      </button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hamburger → X animated toggle
// Three bars: top rotates +45°/slides down, middle fades, bottom rotates -45°/slides up
// ─────────────────────────────────────────────────────────────────────────────
function MenuToggle({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={isOpen}
      aria-controls="mobile-nav"
      aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
      className="lg:hidden w-9 h-9 flex flex-col justify-center items-center gap-[5px] rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {/* Bar 1 */}
      <motion.span
        animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
        className="block w-[18px] h-0.5 bg-white rounded-full"
      />
      {/* Bar 2 */}
      <motion.span
        animate={isOpen ? { scaleX: 0, opacity: 0 } : { scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeInOut' }}
        className="block w-[18px] h-0.5 bg-white rounded-full"
      />
      {/* Bar 3 */}
      <motion.span
        animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
        className="block w-[18px] h-0.5 bg-white rounded-full"
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Navbar
// ─────────────────────────────────────────────────────────────────────────────
export default function Navbar() {
  const [isScrolled, setIsScrolled]           = useState(false);
  const [isHovered, setIsHovered]             = useState(false);
  const [mobileOpen, setMobileOpen]           = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [hoveredDropdown, setHoveredDropdown] = useState<string | null>(null);

  const location      = useLocation();
  const navRef        = useRef<HTMLDivElement>(null);
  const mobileNavRef  = useRef<HTMLElement>(null);
  const { isDarkMode, toggleDarkMode } = useTheme();

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest) => setIsScrolled(latest > 50));

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
    setExpandedSection(null);
  }, [location.pathname]);

  // Escape key closes the mobile panel
  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = '';
      return;
    }
    
    // Lock body scroll
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMobileOpen(false); setExpandedSection(null); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Focus trap: keep Tab/Shift+Tab inside the panel while it is open
  useEffect(() => {
    if (!mobileOpen || !mobileNavRef.current) return;
    const panel = mobileNavRef.current;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    first?.focus();
    return () => document.removeEventListener('keydown', trap);
  }, [mobileOpen]);

  // 3-D tilt values for the pill
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const mxSpring = useSpring(mx, { stiffness: 300, damping: 25 });
  const mySpring = useSpring(my, { stiffness: 300, damping: 25 });
  const rotateX  = useTransform(mySpring, [-0.5, 0.5], ['10deg', '-10deg']);
  const rotateY  = useTransform(mxSpring, [-0.5, 0.5], ['-10deg', '10deg']);

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!navRef.current) return;
    const r = navRef.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top)  / r.height - 0.5);
  };
  const handlePointerLeave = () => {
    mx.set(0);
    my.set(0);
    setIsHovered(false);
  };

  const isActive = (link: NavLink): boolean => {
    if (link.path === '/') return location.pathname === '/';
    if (link.dropdown) {
      return (
        location.pathname === link.path ||
        location.pathname.startsWith(link.path + '/') ||
        link.dropdown.some((sub) => sub.path === location.pathname)
      );
    }
    return location.pathname === link.path;
  };

  return (
    <>
      {/* ── Invisible hover-reveal trigger (for scrolled state) ─────────── */}
      <div
        className={`fixed top-0 left-0 w-full h-8 z-[90] ${
          isScrolled ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      />

      {/* ── Floating Pill Navbar ─────────────────────────────────────────── */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-[100] w-max max-w-[95vw] pointer-events-none transition-all duration-500 ease-in-out top-4 sm:top-6 opacity-100`}
        style={{ perspective: 1000 }}
      >
        <motion.div
          ref={navRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerEnter={() => setIsHovered(true)}
          style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
          className="flex items-center justify-between bg-[#101C2B]/40 backdrop-blur-xl rounded-full px-4 sm:px-5 lg:px-6 py-2 sm:py-2.5 border border-white/10 shadow-2xl shadow-cyan-900/20 pointer-events-auto w-full gap-3"
        >
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0" style={{ transform: 'translateZ(30px)' }}>
            <Logo className="w-10 h-10 md:w-11 md:h-11 mr-2.5 shrink-0" />
            <span className="text-slate-50 font-display font-bold text-base sm:text-lg tracking-wide whitespace-nowrap lg:hidden xl:inline xl:mr-3">Crystal Pools</span>
          </Link>

          {/* Desktop links — hidden below lg */}
          <div
            className="hidden lg:flex items-center space-x-6 flex-1 px-4 lg:px-0"
            style={{ transform: 'translateZ(20px)' }}
          >
            {NAV_LINKS.map((link) => (
              <div
                key={link.name}
                className="shrink-0 relative group"
                onMouseEnter={() => link.dropdown && setHoveredDropdown(link.name)}
                onMouseLeave={() => setHoveredDropdown(null)}
              >
                <Link
                  to={link.path}
                  className={`text-sm tracking-wide transition-colors whitespace-nowrap py-2 flex items-center gap-1 relative ${
                    isActive(link)
                      ? 'text-white font-semibold after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#06B6D4] after:rounded-full'
                      : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {link.name}
                  {link.dropdown && (
                    <motion.div
                      animate={{ rotate: hoveredDropdown === link.name ? 180 : 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    >
                      <ChevronDown className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  )}
                </Link>
                <AnimatePresence>
                  {link.dropdown && hoveredDropdown === link.name && (
                    <motion.div
                      className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-64 z-[110]"
                      initial={{ opacity: 0, y: -10, scale: 0.95, pointerEvents: "none" }}
                      animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }}
                      exit={{ opacity: 0, y: -10, scale: 0.95, pointerEvents: "none" }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 1 }}
                      style={{ transform: 'translateZ(50px)' }}
                    >
                      <motion.div
                        className="bg-white dark:bg-[#060F1A] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col p-2"
                      >
                        {link.dropdown.map((sub, idx) => (
                          <motion.div
                            key={sub.name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{
                              type: 'spring',
                              stiffness: 400,
                              damping: 30,
                              delay: idx * 0.05
                            }}
                          >
                            <Link
                              to={sub.path}
                              className={`flex flex-col px-4 py-3 rounded-xl transition-colors ${
                                location.pathname === sub.path
                                  ? 'bg-[#06B6D4]/10 dark:bg-[#06B6D4]/20'
                                  : 'hover:bg-gray-100 dark:hover:bg-white/[0.07]'
                              }`}
                            >
                              <span className={`text-sm font-semibold mb-0.5 flex items-center justify-between ${
                                location.pathname === sub.path
                                  ? 'text-[#06B6D4]'
                                  : 'text-gray-900 dark:text-white'
                              }`}>
                                {sub.name}
                                {location.pathname === sub.path && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] shrink-0" />
                                )}
                              </span>
                              <span className={`text-xs ${
                                location.pathname === sub.path
                                  ? 'text-[#06B6D4]/70'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {sub.subtitle}
                              </span>
                            </Link>
                          </motion.div>
                        ))}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Right section: hamburger (mobile/tablet) + theme toggle */}
          <div className="flex items-center gap-2 shrink-0 ml-auto lg:ml-0" style={{ transform: 'translateZ(30px)' }}>
            <MenuToggle isOpen={mobileOpen} onClick={() => setMobileOpen((o) => !o)} />

            <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleDarkMode} />
          </div>
        </motion.div>
      </div>

      {/* ── Mobile / Tablet Menu Panel ───────────────────────────────────── */}
      {/*
          z-index stack:
            pill navbar  → z-[100]
            panel        → z-[102]
            backdrop     → z-[101]
          When a dropdown is opened the pill hides and the panel shows a
          back-nav header so the user can return to the main list.
      */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop — sm+ only */}
            <motion.div
              key="mob-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[101] lg:hidden bg-black/30 dark:bg-black/50 backdrop-blur-[2px]"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-in panel */}
            <motion.nav
              ref={mobileNavRef}
              id="mobile-nav"
              key="mob-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              initial={{ x: '100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 h-[100svh] w-full sm:w-[340px] z-[102] lg:hidden flex flex-col bg-white dark:bg-[#060F1A] sm:border-l sm:border-gray-200 dark:sm:border-white/10"
            >
              {/* ── Unified back-nav header ─────────────────────────────────
                  Always shown when the panel is open.
                  Back behaviour:
                    main menu  → closes the panel (returns to current page)
                    submenu    → collapses to main menu list
                  Right side: X only shown in submenu so user has a clear
                  "close everything" escape; in main menu Back is enough.
              ── */}
              <div className="shrink-0 border-b border-gray-200 dark:border-white/10">
                {/* Status-bar / notch safe area */}
                <div className="h-10 sm:h-12" />

                <div className="flex items-center justify-between px-4 pb-4">
                  {/* Back button */}
                  <button
                    onClick={() => expandedSection ? setExpandedSection(null) : setMobileOpen(false)}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 active:text-gray-400 dark:text-white/60 dark:hover:text-white dark:active:text-white/40 transition-colors"
                    aria-label={expandedSection ? 'Back to menu' : 'Close menu'}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back</span>
                  </button>

                  {/* Centre label — section name or generic "Menu" */}
                  <span className="text-gray-900 dark:text-white font-semibold text-[15px] tracking-tight">
                    {expandedSection ?? 'Menu'}
                  </span>

                  {/* X close — only in submenu so there is always a quick exit */}
                  {expandedSection ? (
                    <button
                      onClick={() => { setMobileOpen(false); setExpandedSection(null); }}
                      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-white/10 dark:active:bg-white/15 transition-colors"
                      aria-label="Close navigation menu"
                    >
                      <X className="w-4 h-4 text-gray-400 dark:text-white/50" />
                    </button>
                  ) : (
                    <div className="w-8" aria-hidden="true" />
                  )}
                </div>
              </div>

              {/* ── Sliding two-panel body ──────────────────────────────────
                  width: 200% container with two 50%-width children.
                  translateX(-50%) reveals the right child (submenu).
                  Each child is independently scrollable.
              ── */}
              <div className="flex-1 overflow-hidden relative">
                <div
                  className="flex h-full"
                  style={{
                    width: '200%',
                    transform: expandedSection ? 'translateX(-50%)' : 'translateX(0)',
                    transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                    willChange: 'transform',
                  }}
                >
                  {/* ── Left panel: main nav list ── */}
                  <div
                    className="overflow-y-auto overscroll-contain px-3 py-3 h-full"
                    style={{ width: '50%', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
                  >
                    <ul className="space-y-0.5">
                      {NAV_LINKS.map((link) => (
                        <li key={link.name}>
                          {link.dropdown ? (
                            /* Tappable row that slides to the submenu view */
                            <button
                              onClick={() => setExpandedSection(link.name)}
                              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors ${
                                isActive(link)
                                  ? 'bg-[#06B6D4]/10 dark:bg-[#06B6D4]/20 text-[#06B6D4]'
                                  : 'text-gray-800 hover:bg-gray-100 active:bg-gray-200 dark:text-white/90 dark:hover:bg-white/[0.07] dark:active:bg-white/10'
                              }`}
                            >
                              <span className="font-semibold text-[15px] tracking-tight">{link.name}</span>
                              <ChevronRight className={`w-4 h-4 ${isActive(link) ? 'text-[#06B6D4]/60' : 'text-gray-400 dark:text-white/30'}`} />
                            </button>
                          ) : (
                            <Link
                              to={link.path}
                              className={`flex items-center justify-between px-4 py-3.5 rounded-2xl font-semibold text-[15px] tracking-tight transition-colors ${
                                location.pathname === link.path
                                  ? 'bg-[#06B6D4]/10 text-[#06B6D4]'
                                  : 'text-gray-800 hover:bg-gray-100 active:bg-gray-200 hover:text-gray-900 dark:text-white/90 dark:hover:bg-white/[0.07] dark:active:bg-white/10 dark:hover:text-white'
                              }`}
                            >
                              {link.name}
                              {location.pathname === link.path && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] shrink-0" />
                              )}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ── Right panel: submenu items ── */}
                  <div
                    className="overflow-y-auto overscroll-contain px-3 py-3 h-full"
                    style={{ width: '50%', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
                  >
                    <ul className="space-y-0.5">
                      {NAV_LINKS
                        .find((l) => l.name === expandedSection)
                        ?.dropdown?.map((sub) => (
                          <li key={sub.name}>
                            <Link
                              to={sub.path}
                              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors group ${
                                location.pathname === sub.path
                                  ? 'bg-[#06B6D4]/10 dark:bg-[#06B6D4]/20'
                                  : 'hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-white/[0.07] dark:active:bg-white/10'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                                location.pathname === sub.path
                                  ? 'bg-[#06B6D4]'
                                  : 'bg-[#06B6D4]/40 group-hover:bg-[#06B6D4]'
                              }`} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-[14px] font-semibold leading-snug transition-colors ${
                                  location.pathname === sub.path
                                    ? 'text-[#06B6D4]'
                                    : 'text-gray-700 group-hover:text-gray-900 dark:text-white/85 dark:group-hover:text-white'
                                }`}>
                                  {sub.name}
                                </p>
                                <p className={`text-[11px] mt-0.5 ${
                                  location.pathname === sub.path
                                    ? 'text-[#06B6D4]/70'
                                    : 'text-gray-400 dark:text-white/30'
                                }`}>{sub.subtitle}</p>
                              </div>
                              <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                location.pathname === sub.path
                                  ? 'text-[#06B6D4]/60'
                                  : 'text-gray-300 group-hover:text-gray-500 dark:text-white/20 dark:group-hover:text-white/50'
                              }`} />
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* ── Panel footer ── */}
              <div className="px-4 pb-8 pt-4 border-t border-gray-100 dark:border-white/10 space-y-3 shrink-0">
                <Link
                  to="/contact-swimming-pool-contractor"
                  className="block w-full text-center px-4 py-3.5 bg-[#f9c80e] text-[#060F1A] font-bold rounded-2xl hover:brightness-105 active:scale-[0.98] transition-all text-sm tracking-wide"
                >
                  Get a Free Quote
                </Link>
                <p className="text-center text-gray-400 dark:text-white/20 text-[10px] tracking-[0.25em] uppercase">
                  Crystal Pools · Premium Services
                </p>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
