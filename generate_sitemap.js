const fs = require('fs');

const prods = JSON.parse(fs.readFileSync('data/api_products.json', 'utf8'));
const cats = JSON.parse(fs.readFileSync('data/api_categories.json', 'utf8'));

const baseUrl = 'https://morganappliance.online';
const today = new Date().toISOString().split('T')[0];

const urls = [
  // Core pages
  { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
  { loc: `${baseUrl}/products`, priority: '0.9', changefreq: 'daily' },
  { loc: `${baseUrl}/combos`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${baseUrl}/wholesale`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${baseUrl}/wholesale/price-list`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${baseUrl}/about`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${baseUrl}/testimonials`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${baseUrl}/reseller-program`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${baseUrl}/privacy`, priority: '0.3', changefreq: 'yearly' },
  { loc: `${baseUrl}/terms`, priority: '0.3', changefreq: 'yearly' }
];

// Add categories
cats.forEach(c => {
  const catSlug = encodeURIComponent(c.name.toLowerCase());
  urls.push({
    loc: `${baseUrl}/products?category=${catSlug}`,
    priority: '0.8',
    changefreq: 'weekly'
  });
});

// Add all 175 products
prods.forEach(p => {
  urls.push({
    loc: `${baseUrl}/products/${p.id}`,
    priority: '0.7',
    changefreq: 'weekly'
  });
});

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`),
  '</urlset>'
].join('\n');

fs.writeFileSync('public/sitemap.xml', xml, 'utf8');
console.log(`Generated sitemap.xml with ${urls.length} URLs!`);
