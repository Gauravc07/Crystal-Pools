import { IMAGES } from '../../config/images';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

export const homePage = {
  id: 'home',
  label: 'Home',
  path: '/',
  group: 'Main pages',
  sections: [
    seoSection(
      'Premium Swimming Pool Construction',
      'Crystal Pools is a leading swimming pool consultant, builder, and construction company in Pune since 1993. Luxury private, commercial, and competition swimming pools construction across Pune, Mumbai, Nashik, and beyond.',
    ),
    {
      title: 'Hero',
      fields: {
        'hero.lead': { type: 'text', label: 'Headline (first line)', default: 'We build' },
        'hero.words': {
          type: 'list', resizable: true,
          label: 'Rotating words',
          help: 'These type out one after another in the headline.',
          item: { word: { type: 'text', label: 'Word / phrase' } },
          default: [{ word: 'Bespoke Pools' }, { word: 'Luxury Retreats' }, { word: 'Aquatic Artistry' }, { word: 'Elegant Spas' }],
        },
        'hero.alt': { type: 'text', label: 'Banner image description (alt text)', default: 'Crystal Pools View', help: 'The banner video and images themselves are changed under Homepage Banner.' },
      },
    },
    {
      title: 'Pool types showcase',
      fields: {
        'pools.eyebrow': { type: 'text', label: 'Small label', default: 'Swimming Pools' },
        'pools.title': { type: 'text', label: 'Heading', default: 'Dive into Excellence' },
        'pools.desc': { type: 'text', label: 'Intro (desktop)', multiline: true, default: 'Discover our diverse range of luxury pools, engineered for beauty, durability, and a pristine swimming experience. Scroll seamlessly to explore our architectural designs.' },
        'pools.mobileDesc': { type: 'text', label: 'Intro (mobile)', multiline: true, default: 'Discover our diverse range of luxury pools, engineered for beauty, durability, and a pristine swimming experience.' },
        'pools.introImage': { type: 'image', label: 'Intro image (desktop)', default: IMAGES.services.swimmingPool },
        'pools.items': {
          type: 'list',
          label: 'Pool types (in order — each links to its page)',
          item: {
            title: { type: 'text', label: 'Title' },
            desc: { type: 'text', label: 'Description', multiline: true },
            image: { type: 'image', label: 'Image' },
          },
          default: [
            { title: 'PRIVATE SWIMMING POOLS', desc: 'Private swimming pools are usually smaller than public pools, offering personal retreats tailored to your individual style and available space. We focus on bespoke designs.', image: IMAGES.poolTypes.private },
            { title: 'COMMERCIAL SWIMMING POOLS', desc: 'Crystal pool has expertise with Commercial swimming pools for hotels, resorts, and apartment complexes. Designed for high traffic and maximum durability.', image: IMAGES.poolTypes.commercial },
            { title: 'RECREATION SWIMMING POOLS', desc: 'Public pools are often part of a larger leisure center or recreational complex featuring lazy rivers, wave pools, and splash pads.', image: IMAGES.poolTypes.recreational },
            { title: 'COMPETITION SWIMMING POOLS', desc: 'FINA-standard competition pools engineered for excellence. We build Olympic-grade pools with precise dimensions, wave-reducing gutters, and compliance with international competition standards.', image: IMAGES.poolTypes.competition },
            { title: 'VANISHING EDGE SWIMMING POOLS', desc: 'Vanishing edge pool is a swimming or reflecting pool that produces a visual effect of water extending to the horizon. Perfect for scenic locations.', image: IMAGES.poolTypes.vanishingEdge },
            { title: 'OVERFLOW TYPE SWIMMING POOLS', desc: 'A perimeter-overflow pool is a type of vanishing-edge pool designed so that water spills over all four walls, creating a flawless mirror surface.', image: IMAGES.poolTypes.overflow },
            { title: 'SKIMMER TYPE SWIMMING POOLS', desc: 'A skimmer swimming pool is designed to pull water into the system from the pools surface with a skimming action. Highly efficient and cost-effective.', image: IMAGES.poolTypes.skimmer },
            { title: 'READYMADE SWIMMING POOL', desc: 'Prefabs and readymade pools offer quick installation. Our service department is available for all equipment repair and replace as well as new readymade installs.', image: IMAGES.poolTypes.readymade },
          ],
        },
      },
    },
    {
      title: 'Company stats',
      fields: {
        'stats.items': {
          type: 'list', resizable: true,
          label: 'Counters',
          help: 'Number must be digits only, e.g. 2000. Suffix is optional, e.g. +',
          item: {
            value: { type: 'text', label: 'Number' },
            suffix: { type: 'text', label: 'Suffix' },
            label: { type: 'text', label: 'Label' },
          },
          default: [
            { value: '2000', suffix: '+', label: 'Pools' },
            { value: '8', suffix: '', label: 'Categories' },
            { value: '2000', suffix: '+', label: 'Happy Clients' },
            { value: '25', suffix: '+', label: 'Years Of Experience' },
          ],
        },
      },
    },
    {
      title: 'Services',
      fields: {
        'services.eyebrow': { type: 'text', label: 'Small label', default: 'Engineering Precision' },
        'services.heading': { type: 'text', label: 'Heading', default: 'Our Premium Services' },
        'services.items': {
          type: 'list',
          label: 'Service cards (in order — each links to its service page)',
          item: {
            title: { type: 'text', label: 'Title' },
            description: { type: 'text', label: 'Subtitle' },
            image: { type: 'image', label: 'Image' },
          },
          default: [
            { title: 'Swimming pools', description: 'Turnkey projects', image: IMAGES.services.turnkeyHero },
            { title: 'Waterfall & fountain', description: 'Water features', image: IMAGES.waterFeatures.hero },
            { title: 'Pool tiles', description: 'Glass mosaic', image: IMAGES.tilesHero },
            { title: 'Accessories', description: 'Engineering equipment', image: IMAGES.services.accessoriesHero },
            { title: 'Readymade FRP pools', description: 'Prefabricated', image: IMAGES.services.readymadeHero },
            { title: 'Renovation', description: 'Pool & spa upgrades', image: IMAGES.services.renovationHero },
          ],
        },
        'services.linkText': { type: 'text', label: '"View all" link text', default: 'View All Services' },
      },
    },
    {
      title: 'Products',
      fields: {
        'products.eyebrow': { type: 'text', label: 'Small label', default: 'Premium Range' },
        'products.heading': { type: 'text', label: 'Heading', default: 'Our Products' },
        'products.items': {
          type: 'list',
          label: 'Product cards',
          item: {
            category: { type: 'text', label: 'Category' },
            title: { type: 'text', label: 'Title' },
            description: { type: 'text', label: 'Description', multiline: true },
            image: { type: 'image', label: 'Image' },
          },
          default: [
            { category: 'Filtration & Circulation', title: 'Equipment Catalogue', description: 'Commercial-grade sand filters, high-efficiency pumps, and intelligent disinfection systems — the backbone of every world-class pool.', image: IMAGES.equipment.hero },
            { category: 'Wellness & Lifestyle', title: 'Specialty Installations', description: 'Jacuzzis, sunbath decks, and premium adhesive systems crafted for total aquatic wellness.', image: IMAGES.specialty.hero },
          ],
        },
        'products.linkText': { type: 'text', label: '"View all" link text', default: 'View Full Product Range' },
      },
    },
    {
      title: 'Testimonials',
      fields: {
        'testimonials.eyebrow': { type: 'text', label: 'Small label', default: 'Testimonials' },
        'testimonials.heading': { type: 'text', label: 'Heading', default: 'What our clients say', help: 'The reviews themselves are managed under Testimonials.' },
      },
    },
    {
      title: 'Clients',
      fields: {
        'clients.eyebrow': { type: 'text', label: 'Small label', default: 'Trusted Worldwide' },
        'clients.heading': { type: 'text', label: 'Heading', default: 'Our Esteemed Clients' },
        'clients.items': {
          type: 'list', resizable: true,
          label: 'Client names',
          help: 'Add, remove or reorder clients. The first half scrolls in the top row, the rest in the bottom row. Logos look best as transparent PNG/SVG.',
          item: { name: { type: 'text', label: 'Client name' }, logo: { type: 'image', label: 'Logo (optional — an icon is shown if empty)' } },
          default: [
            { name: 'Marriott' }, { name: 'Hilton' }, { name: 'Taj Hotels' }, { name: 'Ritz-Carlton' }, { name: 'Oberoi' },
            { name: 'Club Mahindra' }, { name: 'Four Seasons' }, { name: 'Hyatt' }, { name: 'ITC Hotels' }, { name: 'Leela Palaces' },
          ],
        },
      },
    },
  ],
} satisfies PageSchema;
