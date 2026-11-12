import { useEffect } from 'react';
import { pageTitle } from '../content/types';

export function usePageMeta(title: string, description: string, image?: string | null) {
  useEffect(() => {
    const fullTitle = pageTitle(title);
    document.title = fullTitle;

    const setMeta = (selector: string, content: string, attr = 'name') => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${selector}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, selector);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta('description', description);
    setMeta('og:title', fullTitle, 'property');
    setMeta('og:description', description, 'property');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', description);
    // Canonical URL for this page (on the www domain, without query strings)
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `https://www.crystalpools.in${window.location.pathname.replace(/\/+$/, '') || '/'}`;
    setMeta('og:url', canonical.href, 'property');

    if (image) {
      const absolute = new URL(image, window.location.origin).href;
      setMeta('og:image', absolute, 'property');
      setMeta('twitter:image', absolute);
    }
  }, [title, description, image]);
}
