import { IMAGES } from '../../config/images';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

const ctaSection = (heading: string, text: string, button: string) => ({
  title: 'Call to action',
  fields: {
    'cta.heading': { type: 'text', label: 'Heading', default: heading },
    'cta.text': { type: 'text', label: 'Text', multiline: true, default: text },
    'cta.button': { type: 'text', label: 'Button text', default: button },
  },
} as const);

export const turnkeyPage = {
  id: 'service-turnkey',
  label: 'Turnkey Projects',
  path: '/services/turnkey-projects',
  group: 'Services',
  sections: [
    seoSection(
      'Turnkey Swimming Pool Construction',
      'Crystal Pools delivers end-to-end swimming pool construction services in Pune and across India — from design and civil works to hydraulic engineering and commissioning, all from one swimming pool contractor.',
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: IMAGES.services.turnkeyHero },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Turnkey pool project' },
        'hero.eyebrow': { type: 'text', label: 'Small label', default: 'Crafting' },
        'hero.line1': { type: 'text', label: 'Headline line 1', default: 'Unforgettable' },
        'hero.line2': { type: 'text', label: 'Headline line 2 (gold)', default: 'Aquatic' },
        'hero.line3': { type: 'text', label: 'Headline line 3 (gold)', default: 'Experiences.' },
        'hero.subtitle': { type: 'text', label: 'Subtitle', default: 'Premier Turnkey Swimming Pool Construction & Total Lifecycle Support across' },
        'hero.subtitleHighlight': { type: 'text', label: 'Subtitle ending (gold)', default: 'India.' },
      },
    },
    {
      title: 'Turnkey philosophy',
      fields: {
        'philosophy.heading': { type: 'text', label: 'Heading', default: 'Total Aquatic Solutions.' },
        'philosophy.highlight': { type: 'text', label: 'Heading (second line, italic)', default: 'Unifying Expertise, Eliminating Complexity.' },
        'philosophy.text': { type: 'text', label: 'Text', multiline: true, default: 'Instead of navigating the complexities of multiple vendors for your aquatic vision, you can partner with a single, reliable entity. Crystal Pools offers integrated, turnkey solutions that eliminate multivendor dependency. By choosing an end-to-end partnership, we optimize every facet of your project.\n\nOur integrated approach directly leads to:' },
        'philosophy.benefits': {
          type: 'list', resizable: true,
          label: 'Benefits',
          item: { title: { type: 'text', label: 'Title' }, description: { type: 'text', label: 'Description', multiline: true } },
          default: [
            { title: 'Accelerated Project Rollouts', description: 'Seamless scheduling and in-house coordination mean swift project lifecycles.' },
            { title: 'Consistent, High-Caliber Quality', description: 'A single team ensures uniform standards of excellence from the initial sketch to the final polish.' },
            { title: 'Cost-Effectiveness', description: 'We deliver highly effective, economical solutions within your given cost-and-time framework.' },
            { title: 'Greater Convenience', description: 'You deal with one dedicated partner for design, engineering, construction, and beyond.' },
          ],
        },
      },
    },
    {
      title: 'Project scope',
      fields: {
        'scope.heading': { type: 'text', label: 'Heading', default: 'Our Full-Spectrum' },
        'scope.highlight': { type: 'text', label: 'Heading (italic part)', default: 'Project Scope' },
        'scope.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Our partnership encompasses anything and everything related to swimming pools, from the initial consultation to decommissioning. We manage the entire lifecycle with single-point accountability.' },
        'scope.items': {
          type: 'list', resizable: true,
          label: 'Scope steps',
          item: { title: { type: 'text', label: 'Title' }, description: { type: 'text', label: 'Description' } },
          default: [
            { title: 'Design', description: 'Aesthetic visions and robust hydraulic plans.' },
            { title: 'Engineering', description: 'Advanced excavation to total structural works.' },
            { title: 'Filtration', description: 'Energy-efficient treatment and sanitation.' },
            { title: 'Equipment', description: 'Modern heating and mechanical systems.' },
            { title: 'Finishing', description: 'Premium mosaics and luxurious accessories.' },
            { title: 'Support', description: 'Lifecycle maintenance and spares supply.' },
          ],
        },
      },
    },
    ctaSection(
      'Transform Your Vision into Reality',
      'Do not settle for the ordinary. Engage the trustworthy team at Crystal Pools to get on-time, on-budget project delivery from initial concept to handover and beyond, with absolute peace of mind at every stage.',
      'Start Your Project',
    ),
  ],
} satisfies PageSchema;

export const waterFeaturesPage = {
  id: 'service-water-features',
  label: 'Waterfall & Fountain',
  path: '/services/waterfall-fountain',
  group: 'Services',
  sections: [
    seoSection(
      'Waterfalls, Fountains & Water Features',
      'Bespoke fountains, waterfalls, rain dance and architectural waterscapes for commercial and residential spaces — designed and built by Crystal Pools, Pune.',
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: IMAGES.waterFeatures.hero },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Architectural Waterscape' },
        'hero.title': { type: 'text', label: 'Headline', multiline: true, default: 'The\nAquascape\nExperience.', help: 'Press Enter for a line break.' },
        'hero.subtitle': { type: 'text', label: 'Subtitle', multiline: true, default: 'Bespoke fountains, waterfalls, and architectural waterscapes for commercial and residential spaces.' },
      },
    },
    {
      title: 'Statement',
      fields: {
        'statement.heading': { type: 'text', label: 'Heading', default: 'End-to-End' },
        'statement.highlight': { type: 'text', label: 'Heading (italic part)', default: 'Waterscape Construction' },
        'statement.text': { type: 'text', label: 'Text', multiline: true, default: 'Elevate the architectural finesse of your property with custom aquatic features. Recognized as India’s premier manufacturer and contractor for waterscapes, Crystal Pools specializes in the design and construction of breathtaking fountains, indoor and outdoor waterfalls, and immersive rain dance installations. From striking entrance fountains to serene indoor cascades, we engineer water features in any scale, shape, or configuration. Our dedicated team assumes absolute responsibility for the entire construction lifecycle, expertly managing structural formwork, complex plumbing, electrical integration, premium tile finishing, and flawless waterproofing.' },
      },
    },
    {
      title: 'Signature collection',
      fields: {
        'collection.heading': { type: 'text', label: 'Heading', default: 'Our Signature Collection:' },
        'collection.highlight': { type: 'text', label: 'Heading (italic part)', default: 'Precision Fountain Jets' },
        'collection.intro': { type: 'text', label: 'Intro', default: 'Engineered for high efficiency, durability, and spectacular visual impact.' },
        'collection.items': {
          type: 'list', resizable: true,
          label: 'Fountain types',
          item: {
            title: { type: 'text', label: 'Title' },
            description: { type: 'text', label: 'Description', multiline: true },
            image: { type: 'image', label: 'Image' },
          },
          default: [
            { title: 'Geyser Jets', description: 'Crafted from solid gunmetal, these highly efficient nozzles deliver robust, dramatic vertical water columns perfect for making a bold architectural statement.', image: IMAGES.waterFeatures.geyser },
            { title: 'Foam Jets', description: 'Creating a highly visible, textured water display, these nozzles produce an eye-catching, foggy cascade. Paired with LED lighting, they are ideal for luxury mall exteriors and corporate lobbies.', image: IMAGES.waterFeatures.foam },
            { title: 'Bell Jets', description: 'Serene and virtually splash-free. Cast from premium bronze and brass, this adjustable nozzle delivers a crystal-clear, wind-resistant sheet of water in the elegant shape of a bell.', image: IMAGES.waterFeatures.bell },
            { title: 'Dandelion Spheres', description: 'An elegant, multi-directional display. These innovative nozzles create captivating, perfectly spherical water patterns that brilliantly capture integrated LED lighting.', image: IMAGES.waterFeatures.dandelion },
            { title: 'Bubbler Jets', description: 'Engineered for tranquil indoor and outdoor environments, these high-quality nozzles provide a highly aesthetic look accompanied by a gentle, soothing acoustic presence.', image: IMAGES.waterFeatures.bubbler },
            { title: 'Architectural Water Curtains', description: 'Delivering a seamless, cascading sheet of water, these features serve as stunning spatial dividers or focal points, blending ambient sound with captivating modern design.', image: IMAGES.waterFeatures.curtains },
            { title: 'Laminar Jumping Jets', description: 'Creating a flawless, glass-like rod of water that arched gracefully into the air, these jets add a dramatic, interactive element with optional RGB lighting synchronization.', image: IMAGES.waterFeatures.laminar },
            { title: 'Tiered Cascade Fountains', description: 'A testament to classic architectural beauty, cascading tiered fountains produce a rich, highly visible water flow that significantly enhances the prestige of grand entrances.', image: IMAGES.waterFeatures.tiered },
            { title: 'Floating Musical Fountains', description: 'Perfect for lakes and large water bodies, these dynamic floating systems offer fully choreographed displays, synchronizing soaring water patterns with majestic music and light.', image: IMAGES.waterFeatures.musical },
          ],
        },
      },
    },
    {
      title: 'Call to action',
      fields: {
        'cta.eyebrow': { type: 'text', label: 'Small label', default: "Let's build together" },
        'cta.heading': { type: 'text', label: 'Heading', default: 'Elevate Your Landscape.' },
        'cta.button': { type: 'text', label: 'Button text', default: 'Consult Our Waterscape Engineers' },
      },
    },
  ],
} satisfies PageSchema;

export const poolTilesPage = {
  id: 'service-pool-tiles',
  label: 'Pool Tiles',
  path: '/services/pool-tiles',
  group: 'Services',
  sections: [
    seoSection(
      'Glass Mosaic Pool Tiles & Murals',
      'Bespoke ceramic pool murals and premium glass mosaic tiles by Element Mosaics, a Crystal Pools brand. Luminous, durable, chemical-resistant finishes for swimming pools.',
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: IMAGES.tilesHero },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Bespoke ceramic pool mural underwater' },
        'hero.eyebrow': { type: 'text', label: 'Small label', default: 'The Magic of Murals' },
        'hero.title': { type: 'text', label: 'Headline', multiline: true, default: 'Aquatic\nArtistry', help: 'Press Enter for a line break.' },
        'hero.subtitle': { type: 'text', label: 'Subtitle', multiline: true, default: 'Transforming pools into breathtaking works of art through bespoke ceramic murals and premium glass mosaic craftsmanship.' },
      },
    },
    {
      title: 'Glass mosaic',
      fields: {
        'mosaic.image': { type: 'image', label: 'Side image', default: IMAGES.tiles[1] },
        'mosaic.alt': { type: 'text', label: 'Side image description (alt text)', default: 'Glass Mosaic Tiles Texture' },
        'mosaic.heading': { type: 'text', label: 'Heading', default: 'Premium Glass Mosaic Tiles' },
        'mosaic.mobileHeading': { type: 'text', label: 'Heading on mobile', default: 'Premium Glass Mosaic' },
        'mosaic.brand': { type: 'text', label: 'Brand line', default: 'by Element Mosaics' },
        'mosaic.p1': { type: 'text', label: 'Paragraph 1', multiline: true, default: 'Elevate your swimming pool with the luminous elegance of designer glass mosaic tiles. Proudly manufactured by Element Mosaics—a signature brand of Crystal Pools—our collections are engineered for uncompromising quality and spectacular visual impact.' },
        'mosaic.p2': { type: 'text', label: 'Paragraph 2', multiline: true, default: 'Crafted from superior raw materials under strict quality control, these tiles offer an exclusive aesthetic grace characterized by brilliant light reflection and vibrant, lasting color.' },
        'mosaic.advantagesHeading': { type: 'text', label: 'Advantages heading', default: 'The Element Mosaics Advantage' },
        'mosaic.advantages': {
          type: 'list', resizable: true,
          label: 'Advantages',
          item: { title: { type: 'text', label: 'Title' }, description: { type: 'text', label: 'Description', multiline: true } },
          default: [
            { title: 'Luminous Aesthetics', description: 'A brilliant, radiant finish that catches the light and dramatically enhances water clarity.' },
            { title: 'Exceptional Durability', description: 'A sturdy, long-lasting composition that is highly resistant to pool chemicals, wear, and fading.' },
            { title: 'Eco-Friendly Engineering', description: 'Sustainable manufacturing processes for an environmentally conscious, premium choice.' },
            { title: 'Effortless Maintenance', description: 'Smooth, non-porous surfaces designed for easy cleaning and optimal hygiene.' },
            { title: 'Comprehensive Project Support', description: 'Complimentary design consultations, including expert recommendations for adhesives and custom grout color matching to ensure a flawless finish.' },
          ],
        },
        'mosaic.primaryButton': { type: 'text', label: 'Main button', default: 'Explore Element Mosaics' },
        'mosaic.catalogueButton': { type: 'text', label: 'Catalogue button', default: 'Download Catalogue' },
      },
    },
    {
      title: 'Collection gallery',
      fields: {
        'collection.heading': { type: 'text', label: 'Heading', default: 'Our Collection' },
        'collection.intro': { type: 'text', label: 'Intro', multiline: true, default: 'A curated selection from our signature glass mosaic range — each tile a testament to colour, light, and craftsmanship.' },
        'collection.images': {
          type: 'list',
          label: 'Gallery images (6, in grid order)',
          item: { image: { type: 'image', label: 'Image' }, alt: { type: 'text', label: 'Description (alt text)' } },
          default: [
            { image: IMAGES.tiles[2], alt: 'Tile design 3' },
            { image: IMAGES.tiles[3], alt: 'Tile design 4' },
            { image: IMAGES.tiles[4], alt: 'Tile design 5' },
            { image: IMAGES.tiles[5], alt: 'Tile design 6' },
            { image: IMAGES.tiles[6], alt: 'Tile design 7' },
            { image: IMAGES.tiles[7], alt: 'Tile design 8' },
          ],
        },
      },
    },
  ],
} satisfies PageSchema;

export const renovationPage = {
  id: 'service-renovation',
  label: 'Renovation',
  path: '/services/renovation',
  group: 'Services',
  sections: [
    seoSection(
      'Swimming Pool Renovation & Repairs',
      'Expert swimming pool renovation in Pune and across India — leak repairs, waterproofing, mosaic re-tiling, lighting and filtration upgrades that restore and modernise aging pools.',
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: IMAGES.services.renovationHero },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Renovated luxury pool' },
        'hero.eyebrow': { type: 'text', label: 'Small label', default: 'Crystal Pools' },
        'hero.title': { type: 'text', label: 'Headline (first line)', default: 'Masterful' },
        'hero.highlight': { type: 'text', label: 'Headline (gold line)', default: 'Renovations.' },
        'hero.subtitle': { type: 'text', label: 'Subtitle', multiline: true, default: 'Transforming aging pools into modern masterpieces through expert restoration and premium craftsmanship.' },
      },
    },
    {
      title: 'Philosophy',
      fields: {
        'philosophy.eyebrow': { type: 'text', label: 'Small label', default: 'Our Philosophy' },
        'philosophy.heading': { type: 'text', label: 'Heading', default: "We don't just repair pools." },
        'philosophy.highlight': { type: 'text', label: 'Heading (italic line)', default: 'We revive them entirely.' },
        'philosophy.text': { type: 'text', label: 'Text', multiline: true, default: "Over time, even the most exquisitely crafted pools lose their original brilliance. Aging filtration equipment, structural wear, and fading surfaces quietly compromise both the experience and safety of your pool. At Crystal Pools, we bring sophisticated technology and architectural vision to your existing setup — restoring your pool's glory while elevating it to contemporary standards of luxury and performance." },
      },
    },
    {
      title: 'Gallery',
      fields: {
        'gallery.images': {
          type: 'list',
          label: 'Images (3: large, top right, bottom right)',
          item: { image: { type: 'image', label: 'Image' }, alt: { type: 'text', label: 'Description (alt text)' } },
          default: [
            { image: IMAGES.services.renovation[0], alt: 'Renovation project showcase' },
            { image: IMAGES.services.renovation[1], alt: 'Renovation detail' },
            { image: IMAGES.services.renovation[2], alt: 'Renovation finish' },
          ],
        },
      },
    },
    {
      title: 'Renovation scope',
      fields: {
        'scope.eyebrow': { type: 'text', label: 'Small label', default: 'What We Cover' },
        'scope.heading': { type: 'text', label: 'Heading', default: 'Our Renovation Scope' },
        'scope.items': {
          type: 'list', resizable: true,
          label: 'Scope cards',
          item: { title: { type: 'text', label: 'Title' }, description: { type: 'text', label: 'Description', multiline: true } },
          default: [
            { title: 'Aesthetic Transformations', description: 'Replacing worn surfaces with premium glass mosaic tiling, modernizing deck coping, and integrating elegant, energy-efficient underwater lighting.' },
            { title: 'Advanced System Upgrades', description: 'Swapping out outdated pumps and plumbing for high-efficiency, state-of-the-art filtration and sanitation plants that guarantee crystal-clear water.' },
            { title: 'Structural Refurbishment', description: 'Expertly diagnosing and resolving leaks, addressing structural wear, and applying advanced waterproofing techniques to ensure decades of renewed longevity.' },
            { title: 'Safety & Hygiene Optimization', description: 'Modernizing drains, handrails, and anti-slip surfaces to meet the absolute highest benchmarks for user safety.' },
          ],
        },
      },
    },
    {
      title: 'Call to action',
      fields: {
        'cta.eyebrow': { type: 'text', label: 'Small label', default: 'Ready to begin' },
        'cta.heading': { type: 'text', label: 'Heading (first line)', default: 'Give Your Pool the' },
        'cta.highlight': { type: 'text', label: 'Heading (gold line)', default: 'Renewal It Deserves.' },
        'cta.button': { type: 'text', label: 'Button text', default: 'Start Your Renovation' },
      },
    },
  ],
} satisfies PageSchema;
