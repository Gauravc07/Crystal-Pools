import { IMAGES } from '../../config/images';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

export const poolTypesPage = {
  id: 'pool-types',
  label: 'Swimming Pool Types',
  path: '/swimming-pool-types',
  group: 'Main pages',
  sections: [
    seoSection(
      'Swimming Pool Types',
      'Explore all type of swimming pools in India — private, commercial, competition, vanishing edge, overflow, skimmer, and readymade FRP pools — from Crystal Pools.',
    ),
    {
      title: 'Header',
      fields: {
        'header.eyebrow': { type: 'text', label: 'Small label', default: 'Portfolio Diversity' },
        'header.heading': { type: 'text', label: 'Main heading (H1)', default: 'Versatile Aquatic Architecture' },
        'header.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Explore all type of swimming pools in India — click on any pool type to learn more about our construction techniques.' },
      },
    },
    {
      title: 'Pool type cards',
      fields: {
        'cards.items': {
          type: 'list',
          label: 'Cards (in order — each links to its pool type page)',
          item: { title: { type: 'text', label: 'Title' }, image: { type: 'image', label: 'Image' } },
          default: [
            { title: 'PRIVATE SWIMMING POOLS', image: IMAGES.poolTypes.private },
            { title: 'COMMERCIAL SWIMMING POOLS', image: IMAGES.poolTypes.commercial },
            { title: 'RECREATION SWIMMING POOLS', image: IMAGES.poolTypes.recreational },
            { title: 'COMPETITION SWIMMING POOLS', image: IMAGES.poolTypes.competition },
            { title: 'VANISHING EDGE SWIMMING POOLS', image: IMAGES.poolTypes.vanishingEdge },
            { title: 'OVERFLOW TYPE SWIMMING POOLS', image: IMAGES.poolTypes.overflow },
            { title: 'SKIMMER TYPE SWIMMING POOLS', image: IMAGES.poolTypes.skimmer },
            { title: 'READYMADE SWIMMING POOL', image: IMAGES.poolTypes.readymade },
          ],
        },
        'cards.linkText': { type: 'text', label: 'Link text', default: 'Learn More' },
      },
    },
  ],
} satisfies PageSchema;

export const servicesPage = {
  id: 'services',
  label: 'Services',
  path: '/services',
  group: 'Main pages',
  sections: [
    seoSection(
      'Swimming Pool Construction Services',
      'Crystal Pools offers complete swimming pool construction services in Pune and across India — turnkey projects, water features, tiles, accessories, and readymade pools from a trusted swimming pool company in Pune.',
    ),
    {
      title: 'Header',
      fields: {
        'header.eyebrow': { type: 'text', label: 'Small label', default: 'Our Services' },
        'header.heading': { type: 'text', label: 'Main heading (H1)', default: 'Comprehensive Pool Solutions' },
        'header.intro': { type: 'text', label: 'Intro', multiline: true, default: 'From design and construction to maintenance and spectacular water features, Crystal Pools provides complete swimming pool services in Pune and beyond — everything you need under one roof.' },
      },
    },
    {
      title: 'Service cards',
      fields: {
        'cards.items': {
          type: 'list',
          label: 'Cards (in order — each links to its service page)',
          help: 'Descriptions are shown on the first three (larger) cards only.',
          item: {
            category: { type: 'text', label: 'Category' },
            title: { type: 'text', label: 'Title' },
            description: { type: 'text', label: 'Description', multiline: true },
            image: { type: 'image', label: 'Image' },
          },
          default: [
            { category: 'Swimming Pools', title: 'Turnkey Projects', description: 'End-to-end pool construction from structural civil works to hydraulic engineering and commissioning. One partner, zero compromise.', image: IMAGES.services.turnkeyHero },
            { category: 'Waterfall & Fountain', title: 'Water Features', description: 'Commercial and residential waterfalls, fountains, rain dance, and waterscapes in any shape or scale.', image: IMAGES.waterFeatures.hero },
            { category: 'Pool Tiles', title: 'Glass Mosaic', description: 'Handcut murals and glass mosaic tiles that transform your pool floor into a work of art.', image: IMAGES.tilesHero },
            { category: 'Accessories', title: 'Engineering Equipment', description: 'High-grade ladders, skimmers, overflow grating and specialized pumps.', image: IMAGES.services.accessoriesHero },
            { category: 'Readymade FRP Pools', title: 'Prefabricated', description: 'Uncompromising luxury delivered with unprecedented speed and efficiency.', image: IMAGES.services.readymadeHero },
            { category: 'Renovation', title: 'Repairs & Maintenance', description: 'Give your aging pool a stunning new look with top-notch refurbishment.', image: IMAGES.services.renovationHero },
          ],
        },
        'cards.badge': { type: 'text', label: 'Badge on the first card', default: 'Featured' },
        'cards.linkText': { type: 'text', label: 'Link text', default: 'View Details' },
      },
    },
  ],
} satisfies PageSchema;
