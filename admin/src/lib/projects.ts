export const POOL_TYPES = [
  { value: 'private', label: 'Private' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'recreational', label: 'Recreational' },
  { value: 'competition', label: 'Competition' },
  { value: 'vanishing-edge', label: 'Vanishing Edge' },
  { value: 'overflow', label: 'Overflow' },
  { value: 'skimmer', label: 'Skimmer' },
  { value: 'readymade', label: 'Readymade' },
] as const;

export type PoolType = (typeof POOL_TYPES)[number]['value'];

export const poolTypeLabel = (value: string) => POOL_TYPES.find(t => t.value === value)?.label ?? value;

export interface GalleryImage {
  path: string;
  alt: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  location: string;
  pool_type: PoolType;
  description: string;
  cover_image: string | null;
  images: GalleryImage[];
  is_published: boolean;
  sort_order: number;
  updated_at: string;
}

export const PROJECT_COLUMNS = 'id, name, slug, location, pool_type, description, cover_image, images, is_published, sort_order, updated_at';
