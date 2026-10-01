// Registry of every editable page. The admin panel builds its "Pages" section from this list,
// and the production server uses it for per-page SEO tags.
import type { PageSchema } from './types';
import { homePage } from './pages/home';
import { aboutPage } from './pages/about';
import { poolTypesPage, servicesPage } from './pages/hubs';
import {
  privatePools, commercialPools, recreationalPools, competitionPools,
  vanishingEdgePools, overflowPools, skimmerPools, readymadePools,
} from './pages/poolTypes';
import { turnkeyPage, waterFeaturesPage, poolTilesPage, renovationPage } from './pages/services';
import { accessoriesPage } from './pages/accessories';
import { readymadeServicePage } from './pages/readymadeService';
import { productsPage } from './pages/products';
import { specialtyPage } from './pages/specialty';
import { galleryPage, blogListPage } from './pages/galleryBlog';
import { contactPage } from './pages/contact';
import { footerContent } from './pages/footer';

export const PAGES: PageSchema[] = [
  homePage, aboutPage, poolTypesPage, servicesPage, galleryPage, blogListPage, contactPage, footerContent,
  privatePools, commercialPools, recreationalPools, competitionPools,
  vanishingEdgePools, overflowPools, skimmerPools, readymadePools,
  turnkeyPage, waterFeaturesPage, poolTilesPage, accessoriesPage, readymadeServicePage, renovationPage,
  productsPage, specialtyPage,
];

export const PAGE_GROUPS: PageSchema['group'][] = ['Main pages', 'Pool types', 'Services', 'Products'];

export const pageById = (id: string) => PAGES.find(p => p.id === id);
