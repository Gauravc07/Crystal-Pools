import type { PageSchema } from '../types';

/** Site-wide footer (contact details, branches and social links live in Settings). */
export const footerContent = {
  id: 'footer',
  label: 'Footer (all pages)',
  path: '/',
  group: 'Main pages',
  sections: [
    {
      title: 'Footer',
      fields: {
        'about': { type: 'text', label: 'Company description', multiline: true, default: "India's leading swimming pool construction company. We create luxurious, state-of-the-art swimming pools for commercial and residential sectors across the nation." },
        'downloads.heading': { type: 'text', label: 'Downloads heading', default: 'Downloads' },
        'branches.heading': { type: 'text', label: 'Branches heading', default: 'Our Branches' },
        'hours.heading': { type: 'text', label: 'Working hours heading', default: 'Working Hours' },
        'hours.items': {
          type: 'list',
          label: 'Working hours',
          help: 'Write "Closed" to show it in the brand colour.',
          resizable: true,
          item: { day: { type: 'text', label: 'Day(s)' }, time: { type: 'text', label: 'Hours' } },
          default: [
            { day: 'Mon - Fri', time: '10:00 AM - 06:00 PM' },
            { day: 'Saturday', time: '10:00 AM - 06:00 PM' },
            { day: 'Sunday', time: 'Closed' },
          ],
        },
        'contact.heading': { type: 'text', label: 'Contact heading', default: 'Contact Us' },
        'follow.heading': { type: 'text', label: 'Social heading', default: 'Follow Us' },
        'copyright': { type: 'text', label: 'Copyright line (the year is added automatically)', default: 'Crystal Swimming Pools India Pvt Ltd. All rights reserved.' },
      },
    },
  ],
} satisfies PageSchema;
