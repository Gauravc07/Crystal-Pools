import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useLenis } from './SmoothScroll';
import { AnimatePresence, motion } from 'motion/react';
import PageLoader from './PageLoader';
import NotFound from '../pages/NotFound';

const Home                     = lazy(() => import('../pages/Home'));
const About                    = lazy(() => import('../pages/About'));
const PoolTypes                = lazy(() => import('../pages/PoolTypes'));
const PrivateSwimmingPools     = lazy(() => import('../pages/PrivateSwimmingPools'));
const CommercialSwimmingPools  = lazy(() => import('../pages/CommercialSwimmingPools'));
const RecreationalSwimmingPools= lazy(() => import('../pages/RecreationalSwimmingPools'));
const CompetitionSwimmingPools = lazy(() => import('../pages/CompetitionSwimmingPools'));
const VanishingEdgeSwimmingPools= lazy(() => import('../pages/VanishingEdgeSwimmingPools'));
const OverflowTypeSwimmingPools = lazy(() => import('../pages/OverflowTypeSwimmingPools'));
const SkimmerTypeSwimmingPools  = lazy(() => import('../pages/SkimmerTypeSwimmingPools'));
const ReadymadeSwimmingPools    = lazy(() => import('../pages/ReadymadeSwimmingPools'));
const Services                  = lazy(() => import('../pages/Services'));
const Products                  = lazy(() => import('../pages/Products'));
const Gallery                   = lazy(() => import('../pages/Gallery'));
const Blog                      = lazy(() => import('../pages/Blog'));
const BlogPost                  = lazy(() => import('../pages/BlogPost'));
const Contact                   = lazy(() => import('../pages/Contact'));
const TurnkeyProjects           = lazy(() => import('../pages/services/TurnkeyProjects'));
const WaterFeatures             = lazy(() => import('../pages/services/WaterFeatures'));
const PoolTiles                 = lazy(() => import('../pages/services/PoolTiles'));
const Accessories               = lazy(() => import('../pages/services/Accessories'));
const Renovation                = lazy(() => import('../pages/services/Renovation'));
const ReadymadePools            = lazy(() => import('../pages/services/ReadymadePools'));
const SpecialtyInstallations    = lazy(() => import('../pages/products/SpecialtyInstallations'));

// Old /blog/:slug links (before the move to /blogs) keep working.
function LegacyBlogRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/blogs/${slug}`} replace />;
}

function PageFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-light-bg dark:bg-[#060F1A]">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const PageWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};

export default function AnimatedRoutes() {
  const location = useLocation();
  const lenis = useLenis();
  const fillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Google Analytics (added by the server when configured) only records the first page load;
  // report later in-app navigations as page views too.
  const firstPath = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname === firstPath.current) return;
    firstPath.current = '';
    const t = setTimeout(() => {
      (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', 'page_view', {
        page_path: location.pathname,
        page_location: window.location.href,
        page_title: document.title,
      });
    }, 300); // after usePageMeta has set the new title
    return () => clearTimeout(t);
  }, [location.pathname]);

  const [isInitialLoad, setIsInitialLoad] = useState(() => {
    try { return sessionStorage.getItem('cp-loaded') === null; }
    catch { return true; }
  });

  useEffect(() => {
    return () => {
      if (fillTimerRef.current !== null) clearTimeout(fillTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isInitialLoad && !location.hash) {
      if (lenis) {
        lenis.scrollTo(0, { immediate: true });
      } else {
        window.scrollTo(0, 0);
      }
    }
  }, [location.pathname, isInitialLoad, location.hash, lenis]);

  const handleFillComplete = () => {
    fillTimerRef.current = setTimeout(() => {
      try { sessionStorage.setItem('cp-loaded', '1'); } catch {}
      setIsInitialLoad(false);
    }, 500);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {isInitialLoad && (
          <PageLoader 
            key="loader"
            onFillComplete={handleFillComplete} 
          />
        )}
      </AnimatePresence>

      <Suspense fallback={<PageFallback />}>
        <AnimatePresence mode="wait">
          <Routes location={location}>
            <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
            <Route path="/about" element={<PageWrapper><About /></PageWrapper>} />
            <Route path="/swimming-pool-types" element={<PageWrapper><PoolTypes /></PageWrapper>} />
            <Route path="/private-swimming-pools" element={<PageWrapper><PrivateSwimmingPools /></PageWrapper>} />
            <Route path="/commercial-swimming-pools" element={<PageWrapper><CommercialSwimmingPools /></PageWrapper>} />
            <Route path="/recreational-swimming-pools" element={<PageWrapper><RecreationalSwimmingPools /></PageWrapper>} />
            <Route path="/competition-swimming-pools" element={<PageWrapper><CompetitionSwimmingPools /></PageWrapper>} />
            <Route path="/vanishing-edge-swimming-pools" element={<PageWrapper><VanishingEdgeSwimmingPools /></PageWrapper>} />
            <Route path="/overflow-type-swimming-pools" element={<PageWrapper><OverflowTypeSwimmingPools /></PageWrapper>} />
            <Route path="/skimmer-type-swimming-pools" element={<PageWrapper><SkimmerTypeSwimmingPools /></PageWrapper>} />
            <Route path="/readymade-swimming-pool" element={<PageWrapper><ReadymadeSwimmingPools /></PageWrapper>} />

            <Route path="/services" element={<PageWrapper><Services /></PageWrapper>} />
            <Route path="/services/turnkey-projects" element={<PageWrapper><TurnkeyProjects /></PageWrapper>} />
            <Route path="/services/waterfall-fountain" element={<PageWrapper><WaterFeatures /></PageWrapper>} />
            <Route path="/services/readymade-pools" element={<PageWrapper><ReadymadePools /></PageWrapper>} />
            <Route path="/services/pool-tiles" element={<PageWrapper><PoolTiles /></PageWrapper>} />
            <Route path="/services/accessories" element={<PageWrapper><Accessories /></PageWrapper>} />
            <Route path="/services/renovation" element={<PageWrapper><Renovation /></PageWrapper>} />

            <Route path="/products" element={<PageWrapper><Products /></PageWrapper>} />
            <Route path="/products/specialty-installations" element={<PageWrapper><SpecialtyInstallations /></PageWrapper>} />

            <Route path="/gallery-swimming-pool-construction" element={<PageWrapper><Gallery /></PageWrapper>} />
            <Route path="/blogs" element={<PageWrapper><Blog /></PageWrapper>} />
            <Route path="/blogs/:slug" element={<PageWrapper><BlogPost /></PageWrapper>} />
            <Route path="/blog" element={<Navigate to="/blogs" replace />} />
            <Route path="/blog/:slug" element={<LegacyBlogRedirect />} />
            <Route path="/contact-swimming-pool-contractor" element={<PageWrapper><Contact /></PageWrapper>} />
            <Route path="*" element={<PageWrapper><NotFound /></PageWrapper>} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </>
  );
}
