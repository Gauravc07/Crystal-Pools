import { IMAGES } from '../../config/images';
import { DOCUMENTS } from '../../config/documents';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

const product = (category: string, title: string, desc: string, image: string, datasheet: string, specs: string) =>
  ({ category, title, desc, image, datasheet, specs });

const FILTERS = 'Commercial & Residential Filters';
const PUMPS = 'Pumps';
const DISINFECTION = 'Disinfection System';
const E = IMAGES.equipment;
const D = DOCUMENTS.equipment;

export const productsPage = {
  id: 'products',
  label: 'Products (Equipment Catalogue)',
  path: '/products',
  group: 'Products',
  sections: [
    seoSection(
      'Swimming Pool Equipment & Accessories',
      'Crystal Pools is a trusted swimming pool equipment supplier and swimming pool manufacturer, offering filtration, pumps, filter systems, and accessories in Pune and across India.',
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: E.hero },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Premium aquatic equipment' },
        'hero.title': { type: 'text', label: 'Headline', multiline: true, default: 'Premium\nAquatic' },
        'hero.highlight': { type: 'text', label: 'Headline (gold italic)', multiline: true, default: 'Equipment\n& Supply' },
        'hero.subtitle': { type: 'text', label: 'Subtitle', multiline: true, default: 'The definitive source for high-performance pool infrastructure and maintenance technology.' },
        'hero.badges': {
          type: 'list',
          label: 'Feature strip (4)',
          item: { title: { type: 'text', label: 'Title' }, desc: { type: 'text', label: 'Description' } },
          default: [
            { title: 'Premium Quality', desc: 'Industry-leading brands and products.' },
            { title: 'High Performance', desc: 'Engineered for efficiency, built to last.' },
            { title: 'Complete Solutions', desc: 'Everything you need for peak pool performance.' },
            { title: 'Expert Support', desc: 'Dedicated guidance every step of the way.' },
          ],
        },
      },
    },
    {
      title: 'Introduction',
      fields: {
        'intro.heading': { type: 'text', label: 'Heading', default: 'Engineered for Excellence' },
        'intro.text': { type: 'text', label: 'Text', multiline: true, default: "Crystal Pools is India's premier swimming pool equipment supplier and manufacturer, importing commercial and residential swimming pool equipment — from filtration and filter systems to pumps, disinfection, and underwater lights. Serving elite hotels, resorts, sports clubs, and advanced water treatment facilities, we provide a comprehensive ecosystem of aquatic technology. Every component in our catalog is procured from world-class global vendors, guaranteeing absolute reliability, uncompromising safety, and peak operational efficiency for your facility." },
      },
    },
    {
      title: 'Catalogue',
      fields: {
        'catalog.allLabel': { type: 'text', label: '"All" filter label', default: 'All' },
        'catalog.categories': {
          type: 'list',
          label: 'Categories (filter buttons)',
          help: "A product appears under a category when its Category matches the name exactly.",
          resizable: true,
          item: { name: { type: 'text', label: 'Category name' } },
          default: [{ name: FILTERS }, { name: PUMPS }, { name: DISINFECTION }],
        },
        'catalog.products': {
          type: 'list',
          label: 'Products',
          resizable: true,
          item: {
            category: { type: 'text', label: 'Category (must match a category name)' },
            title: { type: 'text', label: 'Product name' },
            desc: { type: 'text', label: 'Short description', multiline: true },
            image: { type: 'image', label: 'Image' },
            datasheet: { type: 'file', label: 'Datasheet (PDF, optional)' },
            specs: { type: 'text', label: 'Specifications — one per line: Label | Value', multiline: true },
          },
          default: [
            product(FILTERS, 'F Series Sand Filters', 'Heavy-duty performance for high-capacity applications.', E.fSeries, D.fSeries, 'Type | Commercial High-Capacity\nMaterial | Fiberglass'),
            product(FILTERS, 'B Series Filters', 'Horizontal commercial filtration solutions.', E.bSeries, D.bSeries, 'Format | Horizontal'),
            product(FILTERS, 'M Series Filters', 'Premium top-mount residential filtration systems.', E.mSeries, D.mSeries, 'Mount | Top'),
            product(FILTERS, 'MS Series Filters', 'Side-mount residential filtration systems.', E.msSeries, '', 'Mount | Side'),
            product(PUMPS, 'MXB Series Pumps', 'Reliable performance for residential pools.', E.mxbSeries, D.mxbSeries, 'Application | Residential'),
            product(PUMPS, 'MRB Series Pumps', 'Heavy-duty commercial flanged pumps.', E.mrbSeries, D.mrbSeries, 'Type | Flanged Commercial'),
            product(PUMPS, 'MTX Series Pumps', 'Compact, high-efficiency circulation.', E.mtxSeries, D.mtxSeries, 'Benefit | High Efficiency'),
            product(DISINFECTION, 'Minderchlor Salt Chlorinator', 'Automated, silky-smooth water sanitation.', E.minderchlor, D.minderchlor, ''),
            product(DISINFECTION, 'Chemical Tablet Feeders', 'Consistent, regulated chlorine dispersion.', E.chemicalTabletFeeder, D.chemicalTabletFeeder, ''),
            product(DISINFECTION, 'Dosingstar Dosing Pump', 'Precise automated liquid chemical injection.', E.dosingstar, D.dosingstar, ''),
            product(DISINFECTION, 'BP Series Dosing Pump', 'Reliable chemical dosing for balanced water.', E.bpSeries, D.bpSeries, ''),
            product(DISINFECTION, 'Hydrosmart Pool System', 'Intelligent, centralized water quality management.', E.hydrosmart, D.hydrosmart, ''),
            product(DISINFECTION, 'Pool Vacuum', 'Efficient pool floor and wall vacuuming.', E.poolVacuum, '', ''),
            product(DISINFECTION, 'Heavy-Duty SS Vacuum Head', 'Stainless steel vacuum head for commercial pools.', E.heavyDutyVacuumHead, '', ''),
            product(DISINFECTION, 'Aluminum Vacuum Head', 'Lightweight aluminum head for residential use.', E.aluminumVacuumHead, '', ''),
            product(DISINFECTION, 'Vacuum Head with Side Brush', 'Combined vacuuming and brushing in one pass.', E.vacuumHeadSideBrush, '', ''),
            product(DISINFECTION, 'SS Algae Brushes', 'Stainless steel bristles for stubborn algae removal.', E.ssAlgaeBrushes, '', ''),
            product(DISINFECTION, 'Telescopic Poles', 'Grip-lock telescopic poles for all cleaning tools.', E.polesWithGripLock, '', ''),
            product(DISINFECTION, 'Pool Hose', 'Durable flexible hose for vacuum and cleaning systems.', E.poolHose, '', ''),
            product(DISINFECTION, 'Pool Plastic Fittings', 'Essential plastic fittings and accessories for pool systems.', E.poolPlastic, '', ''),
            product(DISINFECTION, 'Swimming Pool Accessories', 'Complete range of general-purpose pool accessories.', E.poolGeneral, '', ''),
          ],
        },
        'catalog.specsHeading': { type: 'text', label: 'Detail panel: specifications heading', default: 'Technical Specifications' },
        'catalog.datasheetButton': { type: 'text', label: 'Detail panel: datasheet button', default: 'Download Datasheet' },
        'catalog.whatsappButton': { type: 'text', label: 'Detail panel: WhatsApp button', default: 'Inquire on WhatsApp' },
        'catalog.whatsappMessage': { type: 'text', label: 'WhatsApp message (product name is added at the end)', default: "Hi, I'm interested in the" },
      },
    },
    {
      title: 'Call to action',
      fields: {
        'cta.heading': { type: 'text', label: 'Heading', default: 'Equip Your Facility with the Best.' },
        'cta.button': { type: 'text', label: 'Button text', default: 'Request the Full Equipment Catalog' },
      },
    },
  ],
} satisfies PageSchema;
