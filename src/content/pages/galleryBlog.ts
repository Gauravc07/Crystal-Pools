import { IMAGES } from '../../config/images';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

export const galleryPage = {
  id: 'gallery',
  label: 'Gallery',
  path: '/gallery-swimming-pool-construction',
  group: 'Main pages',
  sections: [
    seoSection(
      'Swimming Pool Gallery',
      'Browse photos of luxury private, commercial, infinity and resort swimming pools designed and built by Crystal Pools across Pune and India.',
    ),
    {
      title: 'Header',
      fields: {
        'header.heading': { type: 'text', label: 'Main heading (H1)', default: 'Our Masterpieces' },
        'header.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Explore a showcase of our luxurious swimming pools, from residential sanctuaries to resort scale designs.' },
      },
    },
    {
      title: 'Photo grid',
      fields: {
        'grid.images': {
          type: 'list', resizable: true,
          label: 'Photos (in grid order)',
          help: 'The dark-mode photo is shown when visitors use dark mode; leave it empty to use the light photo.',
          item: {
            light: { type: 'image', label: 'Photo' },
            dark: { type: 'image', label: 'Dark-mode photo (optional)' },
            alt: { type: 'text', label: 'Description (alt text)' },
          },
          default: IMAGES.gallery.light.map((light, i) => ({
            light,
            dark: IMAGES.gallery.dark[i] ?? '',
            alt: `Crystal Pools swimming pool project ${i + 1}`,
          })),
        },
        'projects.heading': { type: 'text', label: 'Completed projects heading', default: 'Completed Projects', help: 'Shown when projects are published under Projects.' },
        'projects.intro': { type: 'text', label: 'Completed projects intro', default: 'A selection of pools we have designed and built across India.' },
      },
    },
  ],
} satisfies PageSchema;

export const blogListPage = {
  id: 'blog',
  label: 'Blog (listing page)',
  path: '/blogs',
  group: 'Main pages',
  sections: [
    seoSection(
      'Insights & Architecture',
      'Expert perspectives on luxury pool construction, wellness routines, and cutting-edge water technology from the Crystal Pools team.',
    ),
    {
      title: 'Header',
      fields: {
        'header.heading': { type: 'text', label: 'Main heading (H1)', default: 'Insights & Architecture' },
        'header.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Expert perspectives on luxury pool construction, wellness routines, and cutting-edge water technology.' },
        'header.searchPlaceholder': { type: 'text', label: 'Search box placeholder', default: 'Search articles...' },
      },
    },
  ],
} satisfies PageSchema;
