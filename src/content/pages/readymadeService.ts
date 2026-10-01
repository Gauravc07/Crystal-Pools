import { IMAGES } from '../../config/images';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

export const readymadeServicePage = {
  id: 'service-readymade',
  label: 'Readymade FRP Pools',
  path: '/services/readymade-pools',
  group: 'Services',
  sections: [
    seoSection(
      'Readymade & Prefabricated Pools — Crystal Pools',
      "Discover Crystal Pools' premium prefabricated, portable swimming pool range in Pune. Faster installation, zero seepage, architectural customization, and superior ROI across India.",
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: IMAGES.services.readymadeHero },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Elite Prefabricated Pool at Twilight' },
        'hero.eyebrow': { type: 'text', label: 'Small label', default: 'FRP Technology' },
        'hero.title': { type: 'text', label: 'Headline', multiline: true, default: 'Advanced\nPrefabricated', help: 'Press Enter for a line break.' },
        'hero.highlight': { type: 'text', label: 'Headline ending (gold)', default: 'Pools.' },
        'hero.subtitle': { type: 'text', label: 'Subtitle', multiline: true, default: 'Uncompromising luxury, delivered with unprecedented *speed* and *efficiency*.', help: 'Wrap words in *stars* to show them in gold.' },
      },
    },
    {
      title: 'Introduction',
      fields: {
        'intro.eyebrow': { type: 'text', label: 'Small label', default: 'The Crystal Pools Difference' },
        'intro.heading': { type: 'text', label: 'Heading', multiline: true, default: 'Optimize Time.\nMaximize Value.' },
        'intro.text': { type: 'text', label: 'Text', multiline: true, default: 'For elite villas, boutique resorts, and premium wellness centers across India, Crystal Pools engineers prefabricated aquatic solutions that fuse immense architectural flexibility with extraordinary convenience — bypassing the prolonged timelines of traditional concrete construction.' },
        'intro.pillarsEyebrow': { type: 'text', label: 'Advantages small label', default: 'Five Pillars of Excellence' },
        'intro.pillarsHeading': { type: 'text', label: 'Advantages heading', default: 'The FRP Advantage' },
      },
    },
    {
      title: 'Advantages',
      fields: {
        'advantages.items': {
          type: 'list',
          label: 'Advantages (5)',
          item: {
            titleLine1: { type: 'text', label: 'Title' },
            titleLine2: { type: 'text', label: 'Title (gold italic line)' },
            desc: { type: 'text', label: 'Description', multiline: true },
            image: { type: 'image', label: 'Image' },
            features: { type: 'text', label: 'Feature badges — one per line: LABEL | subtitle', multiline: true },
          },
          default: [
            { titleLine1: 'Monolithic', titleLine2: 'Structural Integrity', desc: 'Engineered as a robust, single-piece composite structure. This eliminates vulnerable seams and joints, guaranteeing absolute zero water seepage or leakage.', image: IMAGES.services.readymadeAdvantages[0], features: 'ZERO LEAKAGE | Guaranteed\nNO SEAMS | No Weak Points\nBUILT TO LAST | Maximum Durability' },
            { titleLine1: 'Accelerated', titleLine2: 'Deployment', desc: 'Transform your landscape in a fraction of the time. Our turnkey delivery and installation process ensures incredibly quick project handovers compared to traditional pool construction.', image: IMAGES.services.readymadeAdvantages[1], features: 'FASTER INSTALLATION | Weeks, not months\nTURNKEY SOLUTION | End-to-end service\nQUICK HANDOVER | Enjoy sooner' },
            { titleLine1: 'Architectural', titleLine2: 'Customization', desc: 'Bespoke design is never compromised. Enjoy a high degree of tailoring in dimensions, profiles, and premium interior color finishes to match your specific aesthetic.', image: IMAGES.services.readymadeAdvantages[2], features: 'CUSTOM DIMENSIONS | Tailored to your space\nCUSTOM PROFILES | Edges & steps your way\nPREMIUM FINISHES | Luxury color options\nBESPOKE DESIGN | Crafted for you' },
            { titleLine1: 'Sustainable', titleLine2: 'Performance', desc: 'Designed for the future. Experience zero water wastage, minimized energy consumption, and significantly reduced lifetime maintenance requirements.', image: IMAGES.services.readymadeAdvantages[3], features: 'ZERO WATER WASTAGE | Smart circulation\nMINIMIZED ENERGY | LED & efficient systems\nREDUCED MAINTENANCE | Durable by design' },
            { titleLine1: 'Optimized', titleLine2: 'Investment', desc: 'A highly cost-effective, economical alternative to traditional building methods. We deliver a superior price-to-value ratio without sacrificing the high-end luxury aesthetic.', image: IMAGES.services.readymadeAdvantages[4], features: 'COST-EFFECTIVE | Lower lifecycle costs\nHIGH VALUE | Premium quality\nFASTER ROI | Quick installation\nBUILT TO LAST | Durable, low maintenance' },
          ],
        },
        'advantages.badgePrefix': { type: 'text', label: 'Badge label', default: 'Advantage' },
        'advantages.valueTitle': { type: 'text', label: 'Last card highlight title', default: 'SUPERIOR PRICE-TO-VALUE RATIO' },
        'advantages.valueText': { type: 'text', label: 'Last card highlight text', default: 'Smart investment. Luxury living.' },
      },
    },
    {
      title: 'Call to action',
      fields: {
        'cta.eyebrow': { type: 'text', label: 'Small label', default: 'Get Started' },
        'cta.heading': { type: 'text', label: 'Heading', default: 'Accelerate' },
        'cta.highlight': { type: 'text', label: 'Heading (gold italic line)', default: 'Your Vision.' },
        'cta.button': { type: 'text', label: 'Quote button', default: 'Request a Quote' },
        'cta.brochureButton': { type: 'text', label: 'Brochure button', default: 'Download Brochure' },
      },
    },
  ],
} satisfies PageSchema;
