import { useEffect, useState } from 'react';
import { supabase, mediaUrl } from './supabase';

export interface SiteSettings {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  branches: string[];
  social_links: { instagram?: string; facebook?: string; youtube?: string; linkedin?: string };
  hero_video: string | null;
  hero_image_light: string | null;
  hero_image_dark: string | null;
}

// Used until the settings load, and if Supabase is unreachable — the site never shows blanks.
export const DEFAULT_SETTINGS: SiteSettings = {
  phone: '+91 95525 26371',
  whatsapp: '919552526371',
  email: 'sales@crystalpools.in',
  address: '',
  branches: ['Pune', 'Mumbai', 'Nashik', 'Kolhapur', 'Rajasthan', 'Goa'],
  social_links: {
    instagram: 'https://www.instagram.com/crystalpoolspune/',
    facebook: 'https://www.facebook.com/crystalpoolspune/',
    linkedin: 'https://www.linkedin.com/company/crystal-swimming-pools/',
  },
  hero_video: null,
  hero_image_light: null,
  hero_image_dark: null,
};

let resolved: SiteSettings | null = null;
let pending: Promise<SiteSettings> | null = null;

/** Fetches settings once per page load; every component shares the result. */
export function loadSiteSettings(): Promise<SiteSettings> {
  if (resolved) return Promise.resolve(resolved);
  pending ??= (async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('phone, whatsapp, email, address, branches, social_links, hero_video, hero_image_light, hero_image_dark')
      .eq('id', 1)
      .maybeSingle();
    resolved = data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
    return resolved;
  })().catch(() => (resolved = DEFAULT_SETTINGS));
  return pending;
}

export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(resolved ?? DEFAULT_SETTINGS);
  useEffect(() => {
    let active = true;
    loadSiteSettings().then(s => active && setSettings(s));
    return () => { active = false; };
  }, []);
  return settings;
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export const whatsappHref = (number: string, text?: string) =>
  `https://wa.me/${number.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const siteMedia = (value: string | null) => mediaUrl('site', value);
