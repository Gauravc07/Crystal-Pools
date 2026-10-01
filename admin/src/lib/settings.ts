import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface SiteSettings {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  map_lat: number | null;
  map_lng: number | null;
  branches: string[];
  social_links: Partial<Record<SocialKey, string>>;
  seo_title: string;
  seo_description: string;
  og_image: string | null;
  hero_video: string | null;
  hero_image_light: string | null;
  hero_image_dark: string | null;
  ga_measurement_id: string;
  gsc_verification: string;
  gbp_url: string;
  updated_at: string;
}

export const SOCIAL_KEYS = ['instagram', 'facebook', 'youtube', 'linkedin'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

const COLUMNS =
  'phone, whatsapp, email, address, map_lat, map_lng, branches, social_links, seo_title, seo_description, og_image, hero_video, hero_image_light, hero_image_dark, ga_measurement_id, gsc_verification, gbp_url, updated_at';

/** Loads the single site_settings row and saves partial updates to it. */
export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('site_settings').select(COLUMNS).eq('id', 1).single().then(({ data, error }) => {
      if (error) setError(error.message);
      else setSettings(data as SiteSettings);
    });
  }, []);

  const save = useCallback(async (patch: Partial<SiteSettings>, userId: string) => {
    const { data, error } = await supabase
      .from('site_settings')
      .update({ ...patch, updated_by: userId })
      .eq('id', 1)
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    setSettings(data as SiteSettings);
  }, []);

  return { settings, error, save };
}
