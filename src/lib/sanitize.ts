import DOMPurify from 'dompurify';

const ALLOWED_IFRAME_HOSTS = ['www.youtube-nocookie.com', 'www.youtube.com', 'youtube.com', 'player.vimeo.com'];

// Only allow video embeds from known providers; drop any other iframe.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'iframe') return;
  const src = (node as Element).getAttribute('src') ?? '';
  try {
    const url = new URL(src, window.location.href);
    if (url.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.includes(url.hostname)) return;
  } catch { /* invalid URL → removed below */ }
  node.parentNode?.removeChild(node);
});

// Links that open a new tab must not give the target page access to window.opener.
DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Cleans admin-authored HTML before it is rendered on the public site. */
export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'target'],
  });
}
