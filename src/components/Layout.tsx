import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppButton from './WhatsAppButton';
import ErrorBoundary from './ErrorBoundary';

const NO_FOOTER_PATHS = new Set([
  '/private-swimming-pools',
  '/commercial-swimming-pools',
  '/recreational-swimming-pools',
  '/competition-swimming-pools',
  '/vanishing-edge-swimming-pools',
  '/overflow-type-swimming-pools',
  '/skimmer-type-swimming-pools',
  '/readymade-swimming-pool',
]);

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen relative">
      <ErrorBoundary>
        <Navbar />
      </ErrorBoundary>
      <main className="flex-grow relative w-full flex flex-col min-h-screen">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
      {!NO_FOOTER_PATHS.has(location.pathname) && (
        <ErrorBoundary>
          <Footer />
        </ErrorBoundary>
      )}
      <ErrorBoundary>
        <WhatsAppButton />
      </ErrorBoundary>
    </div>
  );
}


