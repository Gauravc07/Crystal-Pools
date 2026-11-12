// Old URLs from the previous websites (found in the Wayback Machine) that still have a real new home.
// Keys are lower-case with no trailing slash. Anything not listed returns a real 404, which is right
// for old junk such as /news123.html, /cart.html or /team/... .
// Redirects added in the admin panel (table seo_redirects) take priority over this list.

const CONTACT = '/contact-swimming-pool-contractor';
const TILES = '/services/pool-tiles';
const ACCESSORIES = '/services/accessories';
const WATER = '/services/waterfall-fountain';
const SPECIALTY = '/products/specialty-installations';
const READYMADE = '/readymade-swimming-pool';
const COST_GUIDE = '/blogs/swimming-pool-construction-cost-in-pune-factors-that-affect-the-budget';

const GROUPS: [string, string[]][] = [
  ['/', ['/index.html', '/home.html', '/user', '/user/index.html']],
  ['/about', ['/about.html', '/about-us.html', '/aboutus.html', '/user/about', '/user/about.html', '/clientle.html', '/clients.htm', '/user/clientele', '/user/clientele.html', '/best-swimming-pool-builder-in-india']],
  [CONTACT, [
    '/contact.html', '/contactus.html', '/enquiry.aspx', '/makeavisit.aspx', '/user/contacts', '/user/contacts.html', '/user/contact-us.aspx',
    '/contact-swimming-pool-contractors-in-alibag', '/contact-swimming-pool-contractors-in-goa',
    '/contact-swimming-pool-contractors-in-kolhapur', '/contact-swimming-pool-contractors-in-mumbai',
    '/contact-swimming-pool-contractors-in-nashik', '/contact-swimming-pool-contractors-in-rajasthan',
  ]],
  ['/gallery-swimming-pool-construction', ['/gallery.html', '/showcase.html', '/user/gallery', '/user/gallery.html', '/user/gallery.aspx']],
  ['/blogs', ['/blog', '/choosing-swimming-pool-contractor-in-india', '/how-to-apply-for-swimming-pool-certificate-in-pune']],
  [COST_GUIDE, ['/swimming-pool-construction-cost-in-india-check-now']],
  ['/swimming-pool-types', ['/pooltype.html', '/swimmingpools.html', '/swimming-pools.html', '/user/pool_type', '/user/pool-type.html', '/user/swimming_pool', '/user/swimming-pool.html', '/products-services/swimming-pool']],
  ['/private-swimming-pools', ['/user/private_swimming_pool', '/user/private-swimming-pool.html']],
  ['/commercial-swimming-pools', ['/comercial.html', '/benefits-of-swimming-pool-in-hotel', '/services/commercial-swimming-pool-contractors', '/user/commercial_swimming_pool', '/user/commercial-swimming-pool.html']],
  ['/recreational-swimming-pools', ['/recreational.html', '/water-parks.html', '/waterparks.html', '/services/recreation-swimming-pool', '/services/recreation-swimming-pool-duplicate-1', '/user/recreational_swimming_pool', '/user/recreational-swimming-pool.html']],
  ['/competition-swimming-pools', ['/competition.html', '/services/competition-swimming-pools', '/user/competition_swimming_pool', '/user/competition-swimming-pool.html']],
  ['/vanishing-edge-swimming-pools', ['/vanishing.html', '/services/vanishing-edge-swimming-pools', '/user/vanishing_edge_swimming_pool', '/user/vanishing-edge-swimming-pool.html']],
  ['/overflow-type-swimming-pools', ['/overflow.html', '/services/overflow-type-swimming-pools', '/user/overflow_type_swimming_pool', '/user/overflow-type-swimming-pool.html']],
  ['/skimmer-type-swimming-pools', ['/skimmer.html', '/services/skimmer-type-swimming-pools', '/user/skimmer_type_swimming_pool', '/user/skimmer-type-swimming-pool.html']],
  [READYMADE, ['/readymade-swimming-pools', '/fiberglass-swimming-pool', '/client-portable-swimming-pool', '/frp-articals.html', '/products-services/frp-swmming-pool', '/products-services/readymade-swimming-pools', '/products-services/readymade-swimming-pools/readymade-swimming-pools-2']],
  ['/services', ['/swimming-pool-services.html', '/swimming-pool-solutions.html', '/weoffer.html', '/products-and-services.html', '/services_group/services', '/user/services-products.html', '/products-services']],
  ['/services/turnkey-projects', ['/turnkey.html']],
  [TILES, ['/tiles.html', '/pooltilling.html', '/swimming-pool-tiles.html', '/swimmingpooltiles.html', '/products-services/pool-tiles', '/user/pool_tiles', '/user/pool-tiles.html']],
  [ACCESSORIES, ['/filteration.html', '/swimmingpoolfilters.html', '/swimming-pool-filtration-accessories.html', '/products-services/filtration-accessories', '/user/filtration_accessories', '/user/filtration-accessories.html']],
  [WATER, ['/waterfall.html', '/pool-water-slides.html', '/products-services/waterfall-fountain-services', '/user/waterfall_fountain', '/user/waterfall-fountain.html']],
  ['/services/renovation', ['/waterproofing.html']],
  ['/products', ['/swimming-pool-equipments', '/otherproducts.html', '/playpark.html', '/products-services/other-products', '/products-services/play-park-equipment', '/user/other_products', '/user/other-products.html', '/user/playpark', '/user/playpark.html', '/user/fiberoptic_lights', '/user/fiberoptic-lights.html']],
  [SPECIALTY, ['/hydrotherapy.html', '/steam-sauna-and-jacuzzi.html', '/services/specialty-services']],
];

export const LEGACY_REDIRECTS: Record<string, string> = Object.fromEntries(
  GROUPS.flatMap(([to, froms]) => froms.map(from => [from, to])),
);
