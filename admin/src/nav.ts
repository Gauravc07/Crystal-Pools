import { FileText, Image, Images, Inbox, LayoutDashboard, LayoutTemplate, MessageSquareQuote, MonitorPlay, Settings, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { can, canEditAnyPage } from './lib/supabase';
import type { Profile } from './lib/supabase';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Who can see this section */
  visible: (profile: Profile | null | undefined) => boolean;
}

const superAdmin = (p: Profile | null | undefined) => !!p?.is_active && p.role === 'super_admin';

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview of enquiries and content.', visible: p => !!p?.is_active },
  { to: '/pages', label: 'Pages', icon: LayoutTemplate, description: 'Edit the text and images on each website page.', visible: canEditAnyPage },
  { to: '/media', label: 'Media', icon: Images, description: 'All website images by page, plus a shared image library.', visible: p => !!p?.is_active },
  { to: '/blogs', label: 'Blogs', icon: FileText, description: 'Write, edit and publish blog posts with SEO settings.', visible: p => can(p, 'blogs') },
  { to: '/projects', label: 'Projects', icon: Image, description: 'Manage completed projects and their photo galleries.', visible: p => can(p, 'projects') },
  { to: '/testimonials', label: 'Testimonials', icon: MessageSquareQuote, description: 'Add and edit client reviews and ratings.', visible: p => can(p, 'testimonials') },
  { to: '/enquiries', label: 'Enquiries', icon: Inbox, description: 'Leads submitted through the website contact form.', visible: superAdmin },
  { to: '/banner', label: 'Homepage Banner', icon: MonitorPlay, description: 'Replace the homepage hero video and images.', visible: superAdmin },
  { to: '/settings', label: 'Settings', icon: Settings, description: 'Contact details, SEO and Google integrations.', visible: superAdmin },
  { to: '/users', label: 'Users', icon: Users, description: 'Create admin users, assign roles and access.', visible: superAdmin },
];

/** Sections an Editor can be given access to (page access is chosen per page). */
export const SECTION_PERMISSIONS = [
  { value: 'blogs', label: 'Blogs', hint: 'Drafts only — a Super Admin publishes' },
  { value: 'projects', label: 'Projects' },
  { value: 'testimonials', label: 'Testimonials' },
];
