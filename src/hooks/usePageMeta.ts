import { useEffect } from 'react';

const SITE_NAME = 'Crystal Pools';

export function usePageMeta(title: string, description: string, image?: string | null) {
  useEffect(() => {
    document.title = `${title} | ${SITE_NAME}`;

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
    setMeta('og:title', `${title} | ${SITE_NAME}`, 'property');
    setMeta('og:description', description, 'property');
    setMeta('twitter:title', `${title} | ${SITE_NAME}`, 'property');
    setMeta('twitter:description', description, 'property');
    if (image) {
      const absolute = new URL(image, window.location.origin).href;
      setMeta('og:image', absolute, 'property');
      setMeta('twitter:image', absolute, 'property');
    }
  }, [title, description, image]);
}
