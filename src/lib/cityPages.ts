import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface CityLink { slug: string; city: string; region: string }

let pending: Promise<CityLink[]> | null = null;

/** Published city pages (Row Level Security hides drafts), fetched once per visit. */
function loadCityLinks() {
  pending ??= (async () => {
    const { data, error } = await supabase.from('city_pages').select('slug, city, region').order('sort_order');
    return error ? [] : ((data ?? []) as CityLink[]);
  })().catch(() => []);
  return pending;
}

export function useCityLinks(): CityLink[] {
  const [links, setLinks] = useState<CityLink[]>([]);
  useEffect(() => {
    let active = true;
    loadCityLinks().then(l => active && setLinks(l));
    return () => { active = false; };
  }, []);
  return links;
}

/**
 * The published city page for a branch name from the footer, e.g. "Kolhapur" → kolhapur,
 * "Rajasthan" → the Udaipur page (its state). Undefined when no page is published yet.
 */
export function cityPathFor(branch: string, links: CityLink[]): string | undefined {
  const name = branch.trim().toLowerCase().replace(/\s*\(.*\)$/, '');
  const match = links.find(l => l.city.toLowerCase() === name || l.slug === name)
    ?? links.find(l => l.region.toLowerCase() === name);
  return match ? `/swimming-pool-contractor/${match.slug}` : undefined;
}
