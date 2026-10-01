import { IMAGES } from '../../config/images';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

export const aboutPage = {
  id: 'about',
  label: 'About',
  path: '/about',
  group: 'Main pages',
  sections: [
    seoSection(
      'About Crystal Pools',
      "Established in 1993, Crystal Pools is India's trusted swimming pool consultant, builder, and one of the leading swimming pool contractors in Pune. Meet our leadership team and discover our 25+ year journey of engineering excellence.",
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: IMAGES.about.hero },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Cinematic infinity pool at sunset' },
        'hero.title': { type: 'text', label: 'Headline (first line)', default: 'Committed to' },
        'hero.highlight': { type: 'text', label: 'Headline (highlighted line)', default: 'Excellence.' },
        'hero.intro': { type: 'text', label: 'Intro', multiline: true, default: 'For over three decades, we have been crafting iconic aquatic experiences that redefine the boundaries of engineering and design.' },
      },
    },
    {
      title: 'Philosophy',
      fields: {
        'philosophy.heading': { type: 'text', label: 'Heading', default: 'Our Philosophy' },
        'philosophy.p1': { type: 'text', label: 'Paragraph 1', multiline: true, default: 'At Crystal Pools, we believe that true luxury lies in the perfect harmony between aesthetic brilliance and uncompromising functionality. Every project is a testament to our dedication to balancing beauty and performance.' },
        'philosophy.p2': { type: 'text', label: 'Paragraph 2', multiline: true, default: "As swimming pool builders in Pune and contractors across India, we don't just build pools; we engineer aquatic environments. Our rigorous approach ensures structural integrity and hydrodynamic precision, resulting in spaces that are as enduring as they are breathtaking." },
        'philosophy.image': { type: 'image', label: 'Image', default: IMAGES.about.construction },
        'philosophy.alt': { type: 'text', label: 'Image description (alt text)', default: 'Detail shot of pool construction' },
      },
    },
    {
      title: 'Cornerstones',
      fields: {
        'cornerstones.heading': { type: 'text', label: 'Heading', default: 'Our Cornerstones' },
        'cornerstones.intro': { type: 'text', label: 'Intro', default: 'The principles that guide our every endeavor.' },
        'cornerstones.items': {
          type: 'list',
          label: 'Cornerstones',
          item: { title: { type: 'text', label: 'Title' }, text: { type: 'text', label: 'Description', multiline: true } },
          default: [
            { title: 'Commitment', text: 'A relentless pursuit of perfection, ensuring every project is delivered to the highest standards of excellence.' },
            { title: 'Excellence', text: 'Uncompromising quality in design, engineering, and execution. We pursue superior craftsmanship and innovative solutions in every aquatic project.' },
            { title: 'Efficiency', text: 'Optimized processes and innovative engineering that maximize resources without compromising on quality.' },
          ],
        },
      },
    },
    {
      title: 'Corporate resources',
      fields: {
        'resources.heading': { type: 'text', label: 'Heading', default: 'Corporate Resources' },
        'resources.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Access our official documentation and corporate literature to learn more about our engineering standards, project methodologies, and 30-year legacy of excellence.' },
        'resources.profileButton': { type: 'text', label: 'Company profile button', default: 'Download Company Profile' },
        'resources.brochureButton': { type: 'text', label: 'Brochure button', default: 'Corporate Brochure' },
        'resources.cardTitle': { type: 'text', label: 'Card title', default: 'Technical Specifications' },
        'resources.cardText': { type: 'text', label: 'Card text', default: 'Detailed insights into our construction processes and quality benchmarks.' },
      },
    },
    {
      title: 'Leadership',
      fields: {
        'leadership.heading': { type: 'text', label: 'Heading', default: 'The Architects of Fluidity' },
        'leadership.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Behind every structure of technical perfection is a foundation of human vision. Meet the leadership driving the future of aquatic architecture.' },
        'leadership.people': {
          type: 'list',
          label: 'Leaders',
          item: {
            name: { type: 'text', label: 'Name' },
            role: { type: 'text', label: 'Role' },
            initials: { type: 'text', label: 'Initials' },
            description: { type: 'text', label: 'Bio', multiline: true },
          },
          default: [
            { name: 'Nilesh D. Shukla', role: 'Founder-Director', initials: 'NS', description: 'A proficient civil engineer by qualification, Nilesh is also a creatively gifted individual who is passionate about swimming pools. Backed by 25+ years of industry experience, he brings to the table strong ideation and designing skills that lead to the development of innovative swimming pools. With his eye for detail and pursuit of excellence, he is an acknowledged authority for quality inspection of swimming pools. Combining his technical expertise, business acumen, and leadership abilities, he is helping take the business to newer heights of success.' },
            { name: 'Deepali N. Shukla', role: 'Director', initials: 'DS', description: "Holding a master's degree in commerce, Deepali is the financial genius in the organization, who is successfully heading the Accounts & Finance function since the last 22 years. Applying her excellent financial planning and taxation skills, she has played an instrumental role in placing the company on a strong financial footing. She is also a prolific administrator, whose other areas of interest include import-export and HR." },
            { name: 'Sarthak Shukla', role: 'CEO', initials: 'SS', description: 'A dynamic young entrepreneur and a BE Mechanical graduate with distinction, Sarthak Shukla is the visionary behind Crystal Pools. Passionate about innovation and excellence, he aims to position the brand as a top-class manufacturer under the Make in India initiative. With a commitment to high-quality production of world-class swimming pool equipment, he is leading Crystal Pools toward global expansion — proudly blending Indian manufacturing strength with international standards.' },
          ],
        },
      },
    },
    {
      title: 'Our journey',
      fields: {
        'journey.heading': { type: 'text', label: 'Heading', default: 'Our Journey' },
        'journey.intro': { type: 'text', label: 'Intro', default: 'A legacy built on precision, spanning decades of redefining aquatic architecture.' },
        'journey.items': {
          type: 'list',
          label: 'Milestones (5)',
          item: {
            year: { type: 'text', label: 'Year' },
            title: { type: 'text', label: 'Title' },
            description: { type: 'text', label: 'Description', multiline: true },
          },
          default: [
            { year: '1998', title: 'The Foundation', description: 'Nilesh Shukla laid the foundation of Crystal Pools with a vision to redefine aquatic architecture.' },
            { year: '2005', title: 'Pioneering Technology', description: 'Introduced advanced filtration and structural technologies to the Indian market.' },
            { year: '2010', title: 'Expanding Reach', description: 'Successfully completed milestone projects across multiple states, establishing a national footprint.' },
            { year: '2015', title: 'Global Standards', description: 'Achieved complete adherence to international manufacturing standards under Make in India.' },
            { year: '2024', title: 'Expanding Horizons', description: 'Sarthak Shukla leads the next phase of global expansion and sustainable innovations.' },
          ],
        },
      },
    },
    {
      title: 'Why choose us',
      fields: {
        'why.heading': { type: 'text', label: 'Heading (the last word is highlighted)', default: 'Why Choose Us' },
        'why.intro': { type: 'text', label: 'Intro', multiline: true, default: "India's leading experts in premium aquatic architecture, combining innovative engineering with robust support." },
        'why.items': {
          type: 'list',
          label: 'Reasons (6)',
          item: { title: { type: 'text', label: 'Title' }, description: { type: 'text', label: 'Description', multiline: true } },
          default: [
            { title: 'Integrated Solutions', description: 'Concept to completion under one roof, maximizing convenience and reliability.' },
            { title: 'Quality Focus', description: 'Rigorous quality checks at every stage from material selection to execution.' },
            { title: 'Long-term Support', description: 'The close of a sale is just the beginning of a long-lasting partnership.' },
            { title: 'Cost Competitive', description: 'Streamlined workflows ensure optimal use of resources for better cost benefits.' },
            { title: 'Training Options', description: 'Intensive Owner-Operator training for seamless end-to-end daily functioning.' },
            { title: 'Rapid Response', description: 'Swift and professional response to demands for spares, repairs, and servicing.' },
          ],
        },
      },
    },
  ],
} satisfies PageSchema;
