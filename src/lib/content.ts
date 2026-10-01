import { useEffect, useState } from 'react';
import { supabase, mediaUrl } from './supabase';

// ── Projects ──

export interface Project {
  id: string;
  name: string;
  slug: string;
  location: string;
  pool_type: string;
  description: string;
  cover_image: string | null;
  images: { path: string; alt: string }[];
}

export const POOL_TYPE_LABELS: Record<string, string> = {
  private: 'Private', commercial: 'Commercial', recreational: 'Recreational', competition: 'Competition',
  'vanishing-edge': 'Vanishing Edge', overflow: 'Overflow', skimmer: 'Skimmer', readymade: 'Readymade',
};

let projectsPromise: Promise<Project[]> | null = null;

/** Published projects (RLS hides unpublished), fetched once per page load. */
function loadProjects() {
  projectsPromise ??= (async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, slug, location, pool_type, description, cover_image, images')
      .order('sort_order')
      .order('created_at', { ascending: false });
    return error ? [] : (data as Project[]);
  })().catch(() => []);
  return projectsPromise;
}

export function useProjects(): Project[] | null {
  const [projects, setProjects] = useState<Project[] | null>(null);
  useEffect(() => {
    let active = true;
    loadProjects().then(p => active && setProjects(p));
    return () => { active = false; };
  }, []);
  return projects;
}

export const projectImage = (value: string | null | undefined) => mediaUrl('projects', value);

// ── Testimonials ──

export interface Testimonial {
  id: string;
  name: string;
  designation: string;
  photo: string | null;
  review: string;
  rating: number;
}

export function useTestimonials(): Testimonial[] | null {
  const [items, setItems] = useState<Testimonial[] | null>(null);
  useEffect(() => {
    let active = true;
    supabase
      .from('testimonials')
      .select('id, name, designation, photo, review, rating')
      .order('sort_order')
      .order('created_at', { ascending: false })
      .then(({ data }) => active && setItems((data as Testimonial[]) ?? []), () => active && setItems([]));
    return () => { active = false; };
  }, []);
  return items;
}

export const testimonialPhoto = (value: string | null) => mediaUrl('testimonials', value);
