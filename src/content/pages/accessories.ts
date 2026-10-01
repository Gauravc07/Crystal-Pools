import { IMAGES } from '../../config/images';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

const feature = { title: { type: 'text', label: 'Title' }, desc: { type: 'text', label: 'Description', multiline: true } } as const;

export const accessoriesPage = {
  id: 'service-accessories',
  label: 'Accessories',
  path: '/services/accessories',
  group: 'Services',
  sections: [
    seoSection(
      'Swimming Pool Accessories & Equipment',
      'Crystal Pools supplies swimming pool accessories, filtration and filter systems, and swimming pool pumps in Pune and across India — ladders, skimmers, sand filters, and more.',
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: IMAGES.services.accessoriesHero },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Premium pool accessories and engineering equipment' },
        'hero.eyebrow': { type: 'text', label: 'Small label', default: 'Crystal Pools' },
        'hero.title': { type: 'text', label: 'Headline (one line per row)', multiline: true, default: 'Premium\nAccessories\n& Engineering\nEquipment', help: 'Each line is shown on its own row.' },
        'hero.subtitle': { type: 'text', label: 'Subtitle', multiline: true, default: 'Swimming pool accessories, filtration, and pumps in Pune — the uncompromising components behind world-class aquatic facilities.' },
      },
    },
    {
      title: 'Catalogue header',
      fields: {
        'range.eyebrow': { type: 'text', label: 'Small label', default: 'Our Range' },
        'range.heading': { type: 'text', label: 'Heading', default: 'Equipment Catalogue' },
        'range.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Browse our full range of high-grade accessories, filtration systems, and engineering equipment — each engineered for durability and peak performance.' },
        'range.tabs': {
          type: 'list',
          label: 'Tab names (Ladders, Skimmers, Pumps, Filters)',
          item: { label: { type: 'text', label: 'Tab name' } },
          default: [{ label: 'Ladders' }, { label: 'Skimmers & Grating' }, { label: 'Pumps' }, { label: 'Sand Filters' }],
        },
      },
    },
    {
      title: 'Ladders tab',
      fields: {
        'ladders.heading': { type: 'text', label: 'Heading', default: 'Structural Swimming Pool Ladders' },
        'ladders.intro': { type: 'text', label: 'Intro', multiline: true, default: "Ladders are a critical safety and accessibility parameter for any aquatic space. Fabricated from premium stainless steel and high-grade polymers, our ladders are engineered to provide secure, effortless entry and exit. We offer customizable finishes to seamlessly match your pool's interior lining and architectural style." },
        'ladders.featuresHeading': { type: 'text', label: 'Features heading', default: 'Core Features' },
        'ladders.features': {
          type: 'list', label: 'Features', item: feature,
          default: [
            { title: 'Engineered Safety', desc: 'High-traction, non-skid grips on all steps to prevent slipping.' },
            { title: 'Ergonomic Design', desc: 'Appropriately spaced, comfortable steps with secure handrails.' },
            { title: 'Material Excellence', desc: 'Available in rust-resistant Stainless Steel (S.S.) or heavy-duty architectural plastic.' },
            { title: 'Design Variations', desc: 'Standard S.S. Ladders, specialized in-pool ladders, and Custom Designer Ladders.' },
          ],
        },
        'ladders.image': { type: 'image', label: 'Image', default: IMAGES.services.accessoriesLadder },
      },
    },
    {
      title: 'Skimmers tab',
      fields: {
        'skimmers.heading': { type: 'text', label: 'Heading', default: 'Advanced Skimmers & Architectural Overflow Grating' },
        'skimmers.intro': { type: 'text', label: 'Intro', multiline: true, default: 'We provide state-of-the-art water circulation components designed to maintain immaculate water surfaces and enhance overall filtration speed.' },
        'skimmers.skimmerHeading': { type: 'text', label: 'Skimmers heading', default: 'Swimming Pool Skimmers' },
        'skimmers.skimmerText': { type: 'text', label: 'Skimmers text', multiline: true, default: 'Ideal for private and public pools with reduced dimensions, our UV-resistant ABS skimmers meet rigorous international standards. They feature a specially designed strainer basket that collects suspended particles, serving as the first line of defense in your recirculation system.' },
        'skimmers.valveTitle': { type: 'text', label: 'Highlight box title', default: 'The 6-Way Valve Process:' },
        'skimmers.valveText': { type: 'text', label: 'Highlight box text', multiline: true, default: "Our skimmer systems integrate flawlessly with pressure sand filters equipped with a 6-way valve, allowing for precise control over the pool's operating modes:" },
        'skimmers.valveModes': { type: 'text', label: 'Highlight box ending (italic)', default: 'Filtration, Rinsing, Backwash, Recirculation, and Waste.' },
        'skimmers.overflowHeading': { type: 'text', label: 'Overflow heading', default: 'Overflow Grating Systems' },
        'skimmers.overflowText': { type: 'text', label: 'Overflow text', multiline: true, default: 'For a truly luxurious, unique aesthetic, the overflow (or "deck-level") pool design allows water to sit perfectly flush with the surrounding floor. Our premium overflow grating systems capture the cascading water seamlessly, offering a sophisticated, highly aesthetic alternative to traditional skimmers.' },
        'skimmers.image1': { type: 'image', label: 'Comparison image 1', default: IMAGES.services.skimmerEdge },
        'skimmers.caption1': { type: 'text', label: 'Comparison caption 1', default: 'Standard Skimmer Edge' },
        'skimmers.image2': { type: 'image', label: 'Comparison image 2', default: IMAGES.services.overflowEdge },
        'skimmers.caption2': { type: 'text', label: 'Comparison caption 2', default: 'Deck-Level Overflow Edge' },
      },
    },
    {
      title: 'Pumps tab',
      fields: {
        'pumps.heading': { type: 'text', label: 'Heading', default: 'High-Efficiency Swimming Pool Pumps' },
        'pumps.intro': { type: 'text', label: 'Intro', multiline: true, default: "The heart of your pool's circulation system. We supply a robust range of above-ground, in-ground, and specialized cover pumps across Pan-India to ensure optimal water turnover." },
        'pumps.seriesHeading': { type: 'text', label: 'Series heading', default: 'The Pump Series' },
        'pumps.seriesText': { type: 'text', label: 'Series text', multiline: true, default: 'A heavy-duty, self-priming pump designed to operate flawlessly under a vast array of conditions.' },
        'pumps.features': {
          type: 'list', label: 'Features', item: feature,
          default: [
            { title: 'Durable & Certified', desc: 'TUV GS Certified and rigorously pressure-tested prior to shipment.' },
            { title: 'Easy Maintenance', desc: 'Features a see-through lid, a large strainer, and easy-to-remove drain plugs for fast winterization.' },
            { title: 'Versatile Power', desc: 'Available from ½ HP up to 2 HP.' },
            { title: 'Custom Upgrades', desc: 'Options available for a 316SS shaft (ideal for saltwater pools), 230V/60Hz motors, and international connections.' },
          ],
        },
        'pumps.tableHeading': { type: 'text', label: 'Table heading', default: 'Pump Specifications' },
        'pumps.specs': {
          type: 'list',
          label: 'Specification table rows',
          item: {
            code: { type: 'text', label: 'Code' }, desc: { type: 'text', label: 'Description' },
            model: { type: 'text', label: 'Model' }, hp: { type: 'text', label: 'HP' }, flow: { type: 'text', label: 'Flow (m³/h)' },
          },
          default: [
            { code: '04010D01', desc: 'Pump 1/2 HP', model: 'Single Phase', hp: '1/2', flow: '10.4' },
            { code: '04010D02', desc: 'Pump 3/4 HP', model: 'Single Phase', hp: '3/4', flow: '12.7' },
            { code: '04010D03', desc: 'Pump 1 HP', model: 'Single Phase', hp: '1', flow: '16.4' },
            { code: '04010D04', desc: 'Pump 1 1/2 HP', model: 'Single Phase', hp: '1 1/2', flow: '21.3' },
            { code: '04010D05', desc: 'Pump 2 HP', model: 'Single Phase', hp: '2', flow: '23.0' },
            { code: '04010D06', desc: 'Pump 3 HP', model: 'Single Phase', hp: '3', flow: '27.0' },
          ],
        },
        'pumps.curveButton': { type: 'text', label: 'Performance curve button', default: 'View Performance Curve' },
        'pumps.curveImage': { type: 'image', label: 'Performance curve image', default: '/images/services/accessories/pump-performance-curve.png' },
      },
    },
    {
      title: 'Sand filters tab',
      fields: {
        'filters.heading': { type: 'text', label: 'Heading', default: 'Laminated Sand Filters' },
        'filters.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Recognized for their immense durability and reliance on the latest European technology, our laminated sand filters are the industry standard for maintaining crystal-clear water.' },
        'filters.featuresHeading': { type: 'text', label: 'Features heading', default: 'Filter Architecture & Features' },
        'filters.features': {
          type: 'list', label: 'Features', item: feature,
          default: [
            { title: 'Premium Construction', desc: 'Manufactured from heavy-duty polyester resin and fiberglass.' },
            { title: 'High-Gloss Finish', desc: 'An external colored-gel coating guarantees a watertight seal while providing a sleek, high-gloss surface.' },
            { title: 'Advanced Internals', desc: 'Inner components are crafted from the latest generation of plastic resins.' },
            { title: 'Operational Specs', desc: 'Maximum working pressure of 2.5 kg/cm².' },
            { title: 'Versatile Sizing', desc: 'Available from 500mm (20") up to 1200mm (48"), with 1.5", 2", or 3" flange valve connections.' },
          ],
        },
        'filters.lsmHeading': { type: 'text', label: 'Side-mount table heading', default: 'LSM Series – Side Mount Specifications' },
        'filters.lsmSpecs': {
          type: 'list',
          label: 'Side-mount table rows',
          item: {
            code: { type: 'text', label: 'Code' }, desc: { type: 'text', label: 'Description' }, sand: { type: 'text', label: 'Sand (Kgs)' },
            diameter: { type: 'text', label: 'Filter D (mm)' }, pressure: { type: 'text', label: 'Max Pressure' }, nw: { type: 'text', label: 'N.W (Kgs)' },
          },
          default: [
            { code: '03010101', desc: '500mm (20") Sand filter with 1.5" valve', sand: '85', diameter: '500', pressure: '2.5', nw: '19' },
            { code: '03010102', desc: '650mm (26") Sand filter with 1.5" valve', sand: '150', diameter: '650', pressure: '2.5', nw: '27.5' },
            { code: '03010103', desc: '800mm (32") Sand filter with 2" valve', sand: '330', diameter: '800', pressure: '2.5', nw: '47.7' },
            { code: '03010104', desc: '950mm (38") Sand filter with 2" valve', sand: '480', diameter: '950', pressure: '2.5', nw: '58' },
            { code: '03010106', desc: '1050mm (42") Sand filter with 2" valve', sand: '680', diameter: '1050', pressure: '2.5', nw: '60.5' },
            { code: '03010116', desc: '1050mm (42") Sand filter with 3" flange', sand: '680', diameter: '1050', pressure: '2.5', nw: '84.7' },
            { code: '03010105', desc: '1200mm (48") Sand filter with 2" valve', sand: '850', diameter: '1200', pressure: '2.5', nw: '87.5' },
            { code: '03010115', desc: '1200mm (48") Sand filter with 3" flange', sand: '850', diameter: '1200', pressure: '2.5', nw: '91.7' },
          ],
        },
        'filters.ltmHeading': { type: 'text', label: 'Top-mount table heading', default: 'LTM Series – Top Mount Specifications' },
        'filters.ltmSpecs': {
          type: 'list',
          label: 'Top-mount table rows',
          item: {
            code: { type: 'text', label: 'Code' }, desc: { type: 'text', label: 'Description' }, sand: { type: 'text', label: 'Sand (Kgs)' },
            height: { type: 'text', label: 'H (mm)' }, pressure: { type: 'text', label: 'Max Pressure' }, nw: { type: 'text', label: 'N.W (Kgs)' },
          },
          default: [
            { code: '03010111', desc: '500mm (20") Sand filter with 1.5" valve', sand: '85', height: '880', pressure: '2.5', nw: '21' },
            { code: '03010112', desc: '650mm (26") Sand filter with 1.5" valve', sand: '150', height: '1030', pressure: '2.5', nw: '29' },
            { code: '03010113', desc: '800mm (32") Sand filter with 2" valve', sand: '330', height: '1100', pressure: '2.5', nw: '48.6' },
            { code: '03010114', desc: '950mm (38") Sand filter with 2" valve', sand: '480', height: '1160', pressure: '2.5', nw: '57' },
          ],
        },
      },
    },
  ],
} satisfies PageSchema;
