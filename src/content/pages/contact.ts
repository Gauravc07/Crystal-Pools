import { IMAGES } from '../../config/images';
import { seoSection } from '../types';
import type { PageSchema } from '../types';

export const contactPage = {
  id: 'contact',
  label: 'Contact',
  path: '/contact-swimming-pool-contractor',
  group: 'Main pages',
  sections: [
    seoSection(
      'Contact Crystal Pools — Get a Free Quote',
      'Reach out to Crystal Pools, a trusted swimming pool consultant and contractor in Pune, for luxury pool construction, renovation, and equipment across Pune, Mumbai, Nashik, and all India. Call or send an inquiry today.',
    ),
    {
      title: 'Hero',
      fields: {
        'hero.image': { type: 'image', label: 'Background image', default: IMAGES.services.swimmingPool },
        'hero.alt': { type: 'text', label: 'Image description (alt text)', default: 'Luxury Pool at Sunset' },
        'hero.title': { type: 'text', label: 'Headline (first line)', default: "Let's Build Your" },
        'hero.highlight': { type: 'text', label: 'Headline (gold italic line)', default: 'Dream Pool.' },
        'hero.subtitle': { type: 'text', label: 'Subtitle', multiline: true, default: 'Reach out to our experts across India for luxury pool construction, renovation, and premium equipment.' },
      },
    },
    {
      title: 'Branches map',
      fields: {
        'map.heading': { type: 'text', label: 'Heading', default: 'Our Presence Across India' },
        'map.intro': { type: 'text', label: 'Intro', multiline: true, default: 'Find an expert near you. Click on the map markers to view details for our operational branches and get in touch with local representatives.' },
        'map.selectTitle': { type: 'text', label: 'Card title before a branch is chosen', default: 'Select Location' },
        'map.selectText': { type: 'text', label: 'Card text before a branch is chosen', default: 'Click on a map marker to view branch details and contact information.' },
        'map.zoomOut': { type: 'text', label: 'Zoom-out button', default: 'Zoom Out to India' },
        'map.locations': {
          type: 'list',
          label: 'Branches',
          help: 'Latitude/longitude: right-click the place in Google Maps to copy them.',
          resizable: true,
          item: {
            city: { type: 'text', label: 'City / branch name' },
            contactName: { type: 'text', label: 'Contact person' },
            phone: { type: 'text', label: 'Phone' },
            address: { type: 'text', label: 'Address', multiline: true },
            lat: { type: 'text', label: 'Latitude' },
            lng: { type: 'text', label: 'Longitude' },
            image: { type: 'image', label: 'Photo (optional)' },
          },
          default: [
            { city: 'Pune (Head Office)', contactName: 'Mr. Nilesh Shukla (Managing Director)', phone: '+(91) 9850997486 / (020) 24690602', address: 'Sr. No. 10/1/1, Shed No. 3&4, Nr. Kailash Jeevan Factory, Dhayari, Pune 411041', lat: '18.4372', lng: '73.8052', image: '' },
            { city: 'Nashik', contactName: 'Mr. Sarang Sukenkar', phone: '+91 98502 37502', address: 'Block no 2, Ambarai Apartment, Vise mala, Canada corner, Nashik 422005', lat: '20.0075', lng: '73.7663', image: '' },
            { city: 'Kolhapur', contactName: 'Mr. Prasad Vaidya', phone: '+91 98221 16662', address: 'B305, Anant Pride, Kolhapur, Maharashtra 416002', lat: '16.7050', lng: '74.2433', image: '' },
            { city: 'Sindhudurg', contactName: 'Sales & Support', phone: '+91 95525 26371', address: 'Sindhudurg, Maharashtra 416812', lat: '16.0543', lng: '73.5274', image: '' },
            { city: 'Goa', contactName: 'Mr. Ashis Patel', phone: '+91 93242 29688', address: '101/A4 Saldhana Kyle Gardens, near Church of Piety, Khobra Waddo, Calangute, Goa 403516', lat: '15.5447', lng: '73.7554', image: '' },
            { city: 'Rajasthan (Udaipur)', contactName: 'Shri Siddhi Vinayak Associates', phone: '+91 96940 99801', address: '20 Nakoda complex, Hansa Palace Lane, Hiran Magri Sec 4, Udaipur 313002', lat: '24.5712', lng: '73.7125', image: '' },
          ],
        },
      },
    },
    {
      title: 'Enquiry form',
      fields: {
        'inquiry.heading': { type: 'text', label: 'Heading (first line)', default: 'Dive into your' },
        'inquiry.highlight': { type: 'text', label: 'Heading (italic line)', default: 'dream project.' },
        'inquiry.text': { type: 'text', label: 'Text', multiline: true, default: 'Reach out to our experts for luxury pool construction, renovation, and premium equipment.' },
        'form.title': { type: 'text', label: 'Form title', default: 'Send an Inquiry' },
        'form.subtitle': { type: 'text', label: 'Form subtitle', default: 'Fill out the form below and our team will get back to you promptly.' },
        'form.projectTypes': {
          type: 'list',
          label: 'Project type options',
          resizable: true,
          item: { option: { type: 'text', label: 'Option' } },
          default: [
            { option: 'New Pool Construction' }, { option: 'Renovation' }, { option: 'Premium Equipment' },
            { option: 'Commercial Pool' }, { option: 'Other' },
          ],
        },
        'form.submit': { type: 'text', label: 'Submit button', default: 'Submit Inquiry' },
        'form.successTitle': { type: 'text', label: 'Success title', default: 'Inquiry Sent!' },
        'form.successText': { type: 'text', label: 'Success message', default: 'Thank you — our team will get back to you within 24 hours.' },
        'form.error': { type: 'text', label: 'Error message', default: 'Something went wrong. Please try again or contact us directly.' },
      },
    },
    {
      title: 'FAQ',
      fields: {
        'faq.heading': { type: 'text', label: 'Heading', default: 'Frequently Asked Questions' },
        'faq.intro': { type: 'text', label: 'Intro', default: 'Find answers to common questions about our process, timeline, and services.' },
        'faq.items': {
          type: 'list',
          label: 'Questions',
          resizable: true,
          item: { question: { type: 'text', label: 'Question' }, answer: { type: 'text', label: 'Answer', multiline: true } },
          default: [
            { question: 'How long does it take to build a luxury swimming pool?', answer: 'The timeline for building a luxury swimming pool depends on the complexity of the design, size, and location. Generally, a standard concrete pool takes 8-12 weeks from excavation to completion. Custom features, intricate landscaping, and permit approvals may extend the timeframe. We provide a detailed project schedule during our initial consultation.' },
            { question: 'What is the swimming pool construction cost in Pune?', answer: 'Swimming pool prices vary based on size, depth, materials, and features such as tiling, filtration, and lighting. As a general guide, private pool construction typically starts from a few lakhs and scales up with custom design elements, while commercial and readymade FRP pools follow their own pricing tiers. Share your requirements with our team for a detailed, no-obligation quote tailored to your project in Pune or anywhere in India.' },
            { question: 'Do you offer pool maintenance and aftercare services?', answer: 'Yes, we offer comprehensive pool maintenance and aftercare services to ensure your pool remains in pristine condition. Our team handles everything from water chemistry balancing, equipment inspection, and seasonal openings/closings to full-service cleaning and repairs.' },
            { question: 'What kind of warranty do you provide on your pools?', answer: 'We stand behind the quality of our craftsmanship with industry-leading warranties. This typically includes a structural warranty for the pool shell, along with specific manufacturer warranties for premium equipment like pumps, filters, and heaters. Exact warranty details are outlined in your personalized contract.' },
            { question: 'Can I customize the design and features of my swimming pool?', answer: 'Absolutely. We specialize in fully bespoke luxury swimming pools. Our design team works closely with you to integrate custom features such as infinity edges, integrated spas, custom lighting, automation systems, underwater acoustic systems, and high-end materials that match your vision and landscape.' },
            { question: 'Are your swimming pools eco-friendly and energy-efficient?', answer: 'We prioritize sustainability and energy efficiency in our designs. We incorporate variable-speed pumps, LED lighting, effective covers, and advanced filtration systems that significantly reduce energy and water consumption without compromising on luxury or performance.' },
          ],
        },
      },
    },
  ],
} satisfies PageSchema;
