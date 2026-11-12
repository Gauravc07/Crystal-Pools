// Remembers where a visitor came from, so an enquiry can say "Google search" or "Google Ads".
// Stored for this browser tab only. Invisible to visitors; failures are ignored.
const KEY = 'cp-attribution';

export interface Attribution {
  traffic_source: string;
  referrer: string;
  landing_page: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

function classify(host: string, params: URLSearchParams) {
  const source = (params.get('utm_source') ?? '').toLowerCase();
  const medium = (params.get('utm_medium') ?? '').toLowerCase();
  if (params.has('gclid') || (source === 'google' && /cpc|ppc|paid/.test(medium))) return 'google_ads';
  if (source === 'gbp' || source === 'google_business' || /maps\.google|google\.[a-z.]+\/maps/.test(host)) return 'google_business';
  if (/(^|\.)google\./.test(host) || source === 'google') return 'google_search';
  if (/(^|\.)(bing|yahoo|duckduckgo)\./.test(host)) return 'other_search';
  if (/(facebook|instagram|linkedin|youtube|t\.co|twitter|x\.com)/.test(host) || medium === 'social') return 'social';
  if (source) return 'campaign';
  if (host && !host.endsWith('crystalpools.in')) return 'referral';
  return 'direct';
}

const clip = (s: string, n: number) => s.slice(0, n);

export function captureAttribution() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const params = new URLSearchParams(location.search);
    let host = '';
    try { host = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ''; } catch { /* no referrer */ }
    const value: Attribution = {
      traffic_source: classify(host, params),
      referrer: clip(host, 300),
      landing_page: clip(location.pathname, 300),
      utm_source: clip(params.get('utm_source') ?? '', 100),
      utm_medium: clip(params.get('utm_medium') ?? '', 100),
      utm_campaign: clip(params.get('utm_campaign') ?? '', 100),
    };
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch { /* storage blocked: the enquiry simply has no source */ }
}

export function getAttribution(): Partial<Attribution> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Partial<Attribution>;
  } catch {
    return {};
  }
}
