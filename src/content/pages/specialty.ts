import { IMAGES } from '../../config/images';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

const S = IMAGES.specialty;
const imageItem = { image: { type: 'image', label: 'Image' }, alt: { type: 'text', label: 'Description (alt text)' } } as const;

export const specialtyPage = {
  id: 'specialty-installations',
  label: 'Specialty Installations',
  path: '/products/specialty-installations',
  group: 'Products',
  sections: [
    seoSection(
      'Specialty Installations — Saunas, Jacuzzis & Tile Adhesives',
      'Bespoke saunas, steam rooms, jacuzzis and hydrotherapy tubs, plus premium pool tile adhesive and grout systems — designed and installed by Crystal Pools across India.',
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: S.hero },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Specialty Installations & Wellness' },
        'hero.title': { type: 'text', label: 'Headline', multiline: true, default: 'Specialty\nInstallations' },
        'hero.highlight': { type: 'text', label: 'Headline (gold italic)', default: '& Wellness' },
        'hero.subtitle': { type: 'text', label: 'Subtitle', multiline: true, default: 'Elevating every detail of your aquatic and wellness environments.' },
      },
    },
    {
      title: 'Adhesives & grout',
      fields: {
        'adhesives.heading': { type: 'text', label: 'Heading', default: 'Advanced Tile Adhesive & Grout Systems' },
        'adhesives.intro': { type: 'text', label: 'Intro', multiline: true, default: 'The foundation of a flawless, enduring finish lies beneath the surface. Crystal Pools provides high-performance, polymer-modified white adhesives specifically engineered for the permanent installation of premium glass mosaics and tiles.' },
        'adhesives.benefits': {
          type: 'list',
          label: 'Benefit cards (3)',
          item: { title: { type: 'text', label: 'Title' }, text: { type: 'text', label: 'Text', multiline: true } },
          default: [
            { title: 'Superior Adhesion', text: 'Highly flexible, non-shrink formulas that guarantee a permanent bond.' },
            { title: 'Extreme Durability', text: 'Heatproof, self-curing, and structurally resilient under heavy water loads.' },
            { title: 'Absolute Waterproofing', text: 'Forms an impenetrable barrier, protecting the structural integrity of the pool shell.' },
          ],
        },
        'adhesives.products': {
          type: 'list',
          label: 'Products',
          resizable: true,
          item: { name: { type: 'text', label: 'Product name' }, image: { type: 'image', label: 'Image' } },
          default: [
            { name: 'Premium White Adhesive', image: S.adhesiveGrout[0] },
            { name: 'Polymer-Modified Grout', image: S.adhesiveGrout[1] },
            { name: 'Epoxy Grout System', image: S.adhesiveGrout[2] },
            { name: 'Waterproofing Membrane', image: S.adhesiveGrout[3] },
          ],
        },
      },
    },
    {
      title: 'Wellness intro',
      fields: {
        'wellness.heading': { type: 'text', label: 'Heading', default: 'Bespoke Wellness Retreats' },
        'wellness.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Beyond the pool, Crystal Pools is a premier architect of immersive relaxation spaces. From private residences to elite spa chains and health clubs, we design and install world-class wellness environments that harmonize beautifully with your lifestyle, with an absolute focus on safety and superior efficacy.' },
      },
    },
    {
      title: 'Sauna & steam',
      fields: {
        'sauna.eyebrow': { type: 'text', label: 'Small label', default: 'Sauna & Steam Rooms' },
        'sauna.heading': { type: 'text', label: 'Heading', multiline: true, default: 'Splendidly Stylish,\nExceptionally Efficient' },
        'sauna.text': { type: 'text', label: 'Text', multiline: true, default: 'Step into ultimate rejuvenation. We design and construct bespoke therapeutic, enclosed wooden saunas and modern glass-enclosed steam baths using tested materials and the latest production technology.' },
        'sauna.boxTitle': { type: 'text', label: 'Highlight box title', default: 'The Sauna Experience' },
        'sauna.boxText': { type: 'text', label: 'Highlight box text', multiline: true, default: 'Utilizing dry heat typically ranging from 70° to 100° Celsius, our saunas offer profound health benefits, including improved blood circulation, lowered blood pressure, and enhanced skin health, while infusing a deep sense of relaxation.' },
        'sauna.images': {
          type: 'list',
          label: 'Images (5: large, then four smaller)',
          item: imageItem,
          default: [
            { image: S.sunbath[0], alt: 'Sauna Main' },
            { image: S.sunbath[1], alt: 'Sauna Detail' },
            { image: S.sunbath[2], alt: 'Steam Room' },
            { image: S.sunbath[3], alt: 'Sauna Interior' },
            { image: S.sunbath[4], alt: 'Steam Detail' },
          ],
        },
      },
    },
    {
      title: 'Jacuzzis & hydrotherapy',
      fields: {
        'jacuzzi.eyebrow': { type: 'text', label: 'Small label', default: 'Jacuzzis & Hydrotherapy Tubs' },
        'jacuzzi.heading': { type: 'text', label: 'Heading', default: 'Experience Seasonal Pinnacle.' },
        'jacuzzi.text': { type: 'text', label: 'Text', multiline: true, default: 'Experience the pinnacle of hydrotherapy. As a leading manufacturer of Hydro Massage Bath Tubs and Systems, we deliver units that meet the highest industrial standards. Whether integrated into your primary swimming pool design or installed as a standalone oasis, our Hydrotherapy units are widely acclaimed for their robust construction, superior architectural finish, and a high degree of customization.' },
        'jacuzzi.images': {
          type: 'list',
          label: 'Images (5: four smaller, then one large)',
          item: imageItem,
          default: [
            { image: S.jacuzzi[0], alt: 'Jacuzzi 1' },
            { image: S.jacuzzi[1], alt: 'Jacuzzi 2' },
            { image: S.jacuzzi[2], alt: 'Jacuzzi 3' },
            { image: S.jacuzzi[3], alt: 'Jacuzzi 4' },
            { image: S.jacuzzi[4], alt: 'Hydrotherapy Main' },
          ],
        },
      },
    },
    {
      title: 'Call to action',
      fields: {
        'cta.eyebrow': { type: 'text', label: 'Small label', default: 'Start the conversation' },
        'cta.heading': { type: 'text', label: 'Heading', default: 'Complete Your Oasis.' },
        'cta.button': { type: 'text', label: 'Button text', default: 'Inquire About Wellness & Finishes' },
      },
    },
  ],
} satisfies PageSchema;
