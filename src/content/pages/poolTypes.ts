import { seoSection } from '../types';
import type { PageSchema } from '../types';

interface PoolTypeDefaults {
  id: string;
  label: string;
  path: string;
  seo: [title: string, description: string];
  hero: { image: string; alt: string; title: string; highlight: string; intro: string };
  story: { heading: string; quote: string; lead?: string; p1?: string; p2?: string };
  craft: { heading: string; intro: string; features: { title: string; text: string }[]; calloutTitle?: string; calloutText?: string };
}

function poolTypeSchema(d: PoolTypeDefaults) {
  return {
    id: d.id,
    label: d.label,
    path: d.path,
    group: 'Pool types',
    sections: [
      seoSection(d.seo[0], d.seo[1]),
      {
        title: 'Hero',
        fields: {
          'hero.image': { type: 'image', label: 'Background image', default: d.hero.image },
          'hero.alt': { type: 'text', label: 'Image description (alt text)', default: d.hero.alt, help: 'Describes the image for Google and screen readers.' },
          'hero.title': { type: 'text', label: 'Headline (first line)', default: d.hero.title },
          'hero.highlight': { type: 'text', label: 'Headline (highlighted line)', default: d.hero.highlight },
          'hero.intro': { type: 'text', label: 'Intro paragraph', default: d.hero.intro, multiline: true },
        },
      },
      {
        title: 'The story',
        fields: {
          'story.eyebrow': { type: 'text', label: 'Small label', default: 'THE STORY' },
          'story.heading': { type: 'text', label: 'Heading', default: d.story.heading },
          'story.quote': { type: 'text', label: 'Large quote', default: d.story.quote, multiline: true },
          'story.lead': { type: 'text', label: 'Bold lead-in (optional)', default: d.story.lead ?? '', help: 'Shown in bold at the start of the first paragraph.' },
          'story.p1': { type: 'text', label: 'Paragraph 1 (optional)', default: d.story.p1 ?? '', multiline: true },
          'story.p2': { type: 'text', label: 'Paragraph 2 (optional)', default: d.story.p2 ?? '', multiline: true },
        },
      },
      {
        title: 'Craftsmanship',
        fields: {
          'craft.eyebrow': { type: 'text', label: 'Small label', default: 'OUR CRAFTSMANSHIP' },
          'craft.heading': { type: 'text', label: 'Heading', default: d.craft.heading, multiline: true, help: 'Press Enter for a line break.' },
          'craft.intro': { type: 'text', label: 'Intro', default: d.craft.intro, multiline: true },
          'craft.features': {
            type: 'list',
            label: 'Feature points',
            item: {
              title: { type: 'text', label: 'Title' },
              text: { type: 'text', label: 'Description', multiline: true },
            },
            default: d.craft.features,
          },
          'craft.calloutTitle': { type: 'text', label: 'Highlight box title (optional)', default: d.craft.calloutTitle ?? '' },
          'craft.calloutText': { type: 'text', label: 'Highlight box text (optional)', default: d.craft.calloutText ?? '', multiline: true },
        },
      },
    ],
  } satisfies PageSchema;
}

export type PoolTypeSchema = ReturnType<typeof poolTypeSchema>;

export const privatePools = poolTypeSchema({
  id: 'private-pools',
  label: 'Private Swimming Pools',
  path: '/private-swimming-pools',
  seo: ['Private Swimming Pools', 'Crystal Pools is a trusted private swimming pool consultant and builder in Pune, offering bespoke private swimming pool design and construction across India.'],
  hero: {
    image: '/images/pool-types/private.webp',
    alt: 'Private Swimming Pool',
    title: 'Your Personal Sanctuary,',
    highlight: 'Redefined.',
    intro: "As India's premier private swimming pool contractors, builders, and consultants in Pune, we blend architectural elegance with 25+ years of engineering mastery to transform your residence into a masterpiece of leisure.",
  },
  story: {
    heading: 'Beyond Concrete and Water',
    quote: 'A private swimming pool is more than just a luxury. It is a liquid landscape where memories are made. At Crystal Pools, we believe your home deserves a graceful touch of luxury that balances peak performance with breathtaking aesthetics.',
    p1: 'While traditional private pools typically range from 12 ft x 24 ft to 20 ft x 40 ft, we don\'t believe in "standard" dimensions. Whether it is an intimate indoor retreat in a refurbished basement or a sprawling garden centerpiece, our private swimming pool design is limited only by your imagination.',
    p2: 'We bridge the gap between cost-efficiency and high-end performance, ensuring that you never have to cut corners to achieve your dream. From private swimming pool construction in our home city of Pune to the most exclusive private estates across India, we bring the "resort life" home.',
  },
  craft: {
    heading: 'Precision Engineering for\nPeace of Mind',
    intro: 'We specialize in the three pillars of premium pool construction:',
    features: [
      { title: 'Concrete Artistry:', text: 'For permanent, bespoke shapes that last a lifetime.' },
      { title: 'One-Piece Fiberglass:', text: 'For those seeking sleek design with rapid installation.' },
    ],
    calloutTitle: 'Safety is our Silent Promise',
    calloutText: 'We recognize that a family pool must be a safe pool. We integrate sophisticated fencing and isolation solutions that meet international standards, ensuring your oasis remains a place of joy for every member of the family, especially the little ones.',
  },
});

export const commercialPools = poolTypeSchema({
  id: 'commercial-pools',
  label: 'Commercial Swimming Pools',
  path: '/commercial-swimming-pools',
  seo: ['Commercial Swimming Pools', 'Crystal Pools is a leading commercial swimming pool consultant and pool builder in Pune, designing high-traffic commercial swimming pools for hotels, resorts, and apartment complexes across India.'],
  hero: {
    image: '/images/pool-types/commercial.webp',
    alt: 'Commercial Swimming Pool',
    title: 'Commercial',
    highlight: 'Swimming Pools.',
    intro: "As India's premier commercial swimming pool contractors and commercial pool consultants in Pune, we blend over 25 years of industry experience with innovative design to maximize productivity, aesthetic appeal, and long-term performance for your project.",
  },
  story: {
    heading: 'An Asset, Not Just an Amenity',
    quote: 'A commercial pool is a powerful business asset that can yield cost-effective performance, boost ROI, aid in branding, and enhance the overall customer experience.',
    lead: 'The Crystal Advantage:',
    p1: "Today's modern leisure centers, luxury hotels, schools, and hydrotherapy facilities need more than an attractive commercial swimming pool design. They demand durable structures equipped to handle the heaviest bathing loads with absolute reliability.",
    p2: "Having successfully completed over 3,100 swimming pools across more than 50 Pan-India locations — including commercial swimming pools in Pune — Crystal Pools adds measurable value to your development. From our in-house AutoCAD drafting to rigorous on-site supervision, we ensure that your aquatic facility becomes a cornerstone of your property's success.",
  },
  craft: {
    heading: 'Complete Environmental and\nStructural Control',
    intro: 'We utilize the latest advancements in pool structures, finishes, and smart features to deliver a seamless operational experience.',
    features: [
      { title: 'Advanced Filtration & Disinfection:', text: 'Precision-engineered systems designed for maximum hygiene and operating efficiency under extreme daily use.' },
      { title: 'Complete Climate Packages:', text: 'Specialized solutions for heated and temperature-controlled pools, ensuring perfectly regulated water conditions year-round.' },
      { title: 'Energy Recovery Systems:', text: 'Eco-friendly pool water heating and heat recovery technology to keep long-term operational costs low.' },
      { title: 'Immersive Attractions:', text: 'From dynamic wave machines to custom architectural finishes, we install features that leave a lasting impression on your guests.' },
    ],
  },
});

export const recreationalPools = poolTypeSchema({
  id: 'recreational-pools',
  label: 'Recreational Swimming Pools',
  path: '/recreational-swimming-pools',
  seo: ['Recreational Swimming Pools', 'Public and recreational swimming pools featuring lazy rivers, wave pools, and splash pads. Designed for leisure centres and large complexes.'],
  hero: {
    image: '/images/pool-types/recreational.webp',
    alt: 'Recreational Swimming Pool',
    title: 'The Ultimate Aquatic Destination,',
    highlight: 'Crafted for Joy.',
    intro: 'As India’s leading recreational swimming pool builders, we merge over 25 years of engineering excellence with innovative design to construct dynamic leisure complexes that delight guests and families alike.',
  },
  story: {
    heading: 'A Hub of Community and Leisure',
    quote: 'A recreational pool is more than a facility. It is the vibrant, beating heart of a luxury hotel, holiday resort, or community center where lifelong memories are made.',
    lead: 'The Crystal Approach:',
    p1: 'At Crystal Pools, we ensure you achieve the perfect synergy of cost-efficiency and uncompromising quality. Having successfully delivered over 3,100 swimming pools, we understand that large-scale natatoriums and public aquatic centers require multi-faceted engineering.',
    p2: 'Whether your vision involves an expansive indoor heated retreat or a sun-drenched outdoor complex, we integrate the most innovative features into a single, cohesive pool system.',
  },
  craft: {
    heading: 'Multi-Faceted Aquatic Experiences',
    intro: 'We specialize in designing comprehensive recreational environments that cater to every age and activity level:',
    features: [
      { title: 'Dynamic Leisure Centers:', text: 'Seamlessly combining expansive adult pools with shallower children’s zones and safe paddling areas for toddlers.' },
      { title: 'Advanced Water Treatment:', text: 'Deploying sophisticated chlorinated, saltwater, or ozonated systems to guarantee pristine, hygienic water for heavy bathing loads.' },
      { title: 'Premium Wellness Additions:', text: 'Elevating the complex with integrated, high-standard saunas, steam baths, and hydro-massage Jacuzzis.' },
      { title: 'Resort-Style Amenities:', text: 'Incorporating specialized diving tanks and architectural water features to enhance the prestige of upscale hotels and natatoriums.' },
    ],
  },
});

export const competitionPools = poolTypeSchema({
  id: 'competition-pools',
  label: 'Competition Swimming Pools',
  path: '/competition-swimming-pools',
  seo: ['Competition Swimming Pools', 'Olympic-grade competition swimming pools with precise lane dimensions, wave-reducing gutters, and certified timing systems. Built to FINA standards.'],
  hero: {
    image: '/images/pool-types/competition.webp',
    alt: 'Competition Swimming Pool',
    title: 'The Pinnacle of Aquatic Performance,',
    highlight: 'Engineered for Champions.',
    intro: 'As India’s premier builders of Olympic and FINA-standard competition pools, we merge over 25 years of engineering mastery with elite sports science to deliver high-performance aquatic arenas without compromising on quality or safety.',
  },
  story: {
    heading: 'Where Records Are Broken',
    quote: 'A competition pool is more than a body of water. It is a highly calibrated arena where athletic potential meets hydrodynamic perfection.',
    lead: 'Designing the "Fast Pool":',
    p1: 'Aquatic competitions held at colleges, universities, and mega sporting events require specialized environments. At Crystal Pools, we possess the precise capabilities to build "fast pools." By meticulously manipulating the physical layout, we significantly reduce swimming resistance.',
    p2: 'This is achieved through proper pool depth, the total elimination of currents, increased lane widths, and the integration of advanced hydraulic, acoustic, and illumination designs.',
  },
  craft: {
    heading: 'Exacting FINA Standards & Dimensions',
    intro: 'We engineer our competition pools to strictly adhere to international FINA guidelines, ensuring your facility is fully equipped to host official tournaments year-round:',
    features: [
      { title: 'Olympic-Grade Dimensions:', text: 'Constructing precise 50 m (160 ft) x 25 m (82 ft) configurations divided into eight optimal 2.5 m lanes, alongside standard 25 m short-course designs.' },
      { title: 'Hydrodynamic Speed Systems:', text: 'Installing energy-absorbing racing lane lines and advanced gutter systems to neutralize water turbulence and enhance swimmer speed.' },
      { title: 'Environmental Precision:', text: 'Maintaining rigorous water temperatures of 25-28°C (77-82°F) and engineering lighting levels greater than 1500 lux for ultimate visibility.' },
      { title: 'Professional Officiating Readiness:', text: 'Seamlessly integrating automated touchpads on pool walls, exact backstroke flag positioning (5 meters from each wall), and regulatory lane rope coloring.' },
    ],
  },
});

export const vanishingEdgePools = poolTypeSchema({
  id: 'vanishing-edge-pools',
  label: 'Vanishing Edge Swimming Pools',
  path: '/vanishing-edge-swimming-pools',
  seo: ['Vanishing Edge Swimming Pools', 'Infinity and vanishing edge pools that create a seamless water-horizon effect. Perfect for hillside, rooftop, and scenic villa locations.'],
  hero: {
    image: '/images/pool-types/vanishing-edge.webp',
    alt: 'Vanishing Edge Swimming Pool',
    title: 'Limitless Horizons,',
    highlight: 'Crafted in Water.',
    intro: 'As India’s premier builders of advanced specialty pools, we bring over 25 years of industry experience to design superior vanishing edge and infinity pools that add unparalleled grace and grandeur to your estate.',
  },
  story: {
    heading: 'Where Water Meets the Sky',
    quote: 'Imagine a swimming pool that knows no boundaries, seamlessly blending into the sky, the ocean, or the hillside to inspire the Art of Lavish Living.',
    lead: 'The Visual Illusion:',
    p1: 'A vanishing edge pool, often referred to as a zero edge or infinity pool, is a masterful reflecting pool that produces the visual effect of water extending directly to the horizon.',
    p2: 'This specialized category also encompasses perimeter overflow pools, where water flows over one or more edges flush with the decking, creating a seamless, mirror-like lake effect. The illusion is particularly awe-inspiring when the edge appears to merge with a larger body of water or a sweeping green hillside, making it a staple of exotic resorts and exclusive private estates.',
  },
  craft: {
    heading: 'Uncompromising Structural Integrity',
    intro: 'Because these advanced setups are almost always built in precarious locations such as cliffs, mountaintops, or beachfronts, sound structural engineering is paramount:',
    features: [
      { title: 'Geotechnical Precision:', text: 'Commissioning thorough geotechnical reports prior to structural engineering to ensure perfect alignment with prevailing geological conditions.' },
      { title: 'Advanced Hydraulics:', text: 'Implementing complex mechanical and hydraulic engineering to maintain the flawless, continuous overflow effect.' },
      { title: 'Custom Foundation Systems:', text: 'Developing highly specialized anchoring foundations required to safely secure the immense weight of the pool to challenging hillsides and elevated terrains.' },
    ],
  },
});

export const overflowPools = poolTypeSchema({
  id: 'overflow-pools',
  label: 'Overflow Type Swimming Pools',
  path: '/overflow-type-swimming-pools',
  seo: ['Overflow Type Swimming Pools', 'Perimeter-overflow pools where water spills over all four walls, creating a flawless mirror surface. The pinnacle of aquatic architecture.'],
  hero: {
    image: '/images/pool-types/overflow.webp',
    alt: 'Overflow Type Swimming Pool',
    title: 'The Mirror Lake Effect,',
    highlight: 'Crafted in Tranquility.',
    intro: 'As India’s trusted experts in advanced aquatic architecture, we bring over 25 years of pan-India experience to design superior perimeter-overflow pools that transform your space into a soothing, reflective sanctuary.',
  },
  story: {
    heading: 'A Flawless Reflection of Elegance',
    quote: "Because surface water doesn't have a chance to bounce off the walls, a perimeter-overflow pool possesses the calmest, most reflective surface. A true mirror on the ground.",
    lead: 'The Visual Illusion:',
    p1: 'A perimeter-overflow pool is a highly specialized variant of the vanishing edge design where water gracefully spills over all four walls. This continuous flow gives the water a breathtaking, glazed appearance.',
    p2: 'Popularly used as expansive reflecting pools or ponds, their incredibly sleek finish makes them a centerpiece in luxury contemporary designs where reflecting the sky and surrounding landscape is paramount.',
  },
  craft: {
    heading: 'Engineering the Perfect Stillness',
    intro: "To create this flawless 'lake effect,' our engineering team meticulously controls water flow and elevation through advanced structural design:",
    features: [
      { title: '360-Degree Spillover:', text: 'Setting the tops of all four walls precisely below the water level to ensure a uniform, continuous flow into a hidden containment vessel.' },
      { title: 'Stealth Drainage Systems:', text: 'Integrating elegant, minimalist slots or grates flush with the decking for ground-level designs, preserving the pristine architectural appearance without visual disruption.' },
      { title: 'Elevated Catch Basins:', text: 'Constructing raised structural walls where water cascades gracefully into an open basin or customized gutter system.' },
      { title: 'Advanced Recirculation:', text: "Installing remote holding and surge tanks engineered to perfectly manage and recirculate the water capacity without disrupting the pool's tranquility." },
    ],
  },
});

export const skimmerPools = poolTypeSchema({
  id: 'skimmer-pools',
  label: 'Skimmer Type Swimming Pools',
  path: '/skimmer-type-swimming-pools',
  seo: ['Skimmer Type Swimming Pools', 'Efficient skimmer swimming pools that draw surface water for filtration. Cost-effective, low-maintenance, and ideal for residential builds.'],
  hero: {
    image: '/images/pool-types/skimmer.png',
    alt: 'Skimmer Type Swimming Pool',
    title: 'Skimmer Type Pools,',
    highlight: 'Crafted for Clarity.',
    intro: 'Swimming Pool Construction Services that Stand Out from the Clutter. Everyone likes a clean swimming pool. As a leading provider in India, we construct pools that effectively manage the issue of external elements.',
  },
  story: {
    heading: 'A Pristine Surface',
    quote: 'A skimmer swimming pool is designed to pull water into the system from the pool’s surface with a skimming action, pulling in floating objects like leaves and dirt before they sink.',
    lead: 'Exceptional Cleanliness:',
    p1: 'Dirt, debris and many other substances can make the pool look dirty and affect water chemistry, thus rendering it unsuitable for users. Skimmers are also used to vacuum the pool with a manual vacuum or suction-side automatic pool cleaner.',
    p2: 'Standard in-ground pool skimmers are built into the deck, accessible through a cover on the deck to remove the skimmer basket and empty debris that has been skimmed from the pool.',
  },
  craft: {
    heading: 'Engineered Filtration Dynamics',
    intro: 'As part of our best design practice, we recommend customized skimmer configurations for optimal surface clearing:',
    features: [
      { title: 'Optimal Placement:', text: 'We recommend at least two skimmers for pools over 700 square feet to ensure comprehensive surface coverage.' },
      { title: 'Intelligent Weir Systems:', text: 'Water pours over the weir allowing debris to enter; when the pump stops, the weir floats into a closed position to trap debris.' },
      { title: 'Safe Operation:', text: 'Rigorous safety standards ensure components are securely integrated, though caution is always advised when interacting with active suction lines.' },
    ],
  },
});

export const readymadePools = poolTypeSchema({
  id: 'readymade-pools',
  label: 'Readymade Swimming Pools',
  path: '/readymade-swimming-pool',
  seo: ['Readymade Swimming Pools', 'Prefabricated FRP readymade and portable swimming pools in Pune for fast installation. Quick setup, durable construction, and full equipment support from Crystal Pools.'],
  hero: {
    image: '/images/pool-types/readymade.webp',
    alt: 'Readymade Swimming Pool',
    title: 'Efficient and Elegant,',
    highlight: 'Readymade FRP Pools.',
    intro: 'The trend of portable, readymade swimming pools is catching up fast in the Indian market, including in Pune. From villas and resorts to sports clubs and wellness centers, clients prefer them for their immense flexibility.',
  },
  story: {
    heading: 'Best Readymade FRP Pools in India',
    quote: 'As a rapidly emerging supplier in India, Crystal Pools offers premium quality pre-fabricated pools that benefit owners with amazing convenience and distinct advantages.',
  },
  craft: {
    heading: 'Readymade Swimming Pool Benefits',
    intro: 'Experience the future of aquatic luxury with these distinct advantages over traditional construction:',
    features: [
      { title: 'Bespoke Designs:', text: 'High degree of customization in terms of shape, colour, size, and finishes to match your unique vision.' },
      { title: 'Faster Turnaround:', text: 'Quick project delivery and installation as compared to traditional swimming pools, minimizing disruption.' },
      { title: 'Excellent Performance:', text: "Zero water wastage; lesser energy consumption; low maintenance over the pool's lifetime." },
      { title: 'Single-piece Structure:', text: 'Seamless construction guarantees no water seepage or leakage, ensuring long-term structural integrity.' },
      { title: 'Cost-effective Solution:', text: 'An economical alternative to traditional pools. You will be surprised to know about the readymade swimming pool price in India!' },
    ],
  },
});
