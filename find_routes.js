const fs = require('fs');
const js = fs.readFileSync('public/assets/index-B7yQPykp.js', 'utf8');

const matches = js.match(/["']\/products\/:[a-zA-Z0-9]+["']/g) || js.match(/["']\/product\/:[a-zA-Z0-9]+["']/g);
console.log('Product route matches:', matches);

// Check links to products in JSX
const linkMatches = js.match(/\/products\/[a-zA-Z0-9_-]+/g);
console.log('Sample product links:', [...new Set(linkMatches)].slice(0, 10));
