const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let text = fs.readFileSync(filePath, 'utf8');
  let original = text;

  // Exact brand names
  text = text.replace(/MORGAN GOODS/g, 'MORGAN APPLIANCES');
  text = text.replace(/Morgan Goods/g, 'Morgan Appliances');
  text = text.replace(/morgan goods/g, 'morgan appliances');
  text = text.replace(/MorganGoods/g, 'MorganAppliances');
  text = text.replace(/morgangoods\.com/g, 'morganappliance.online');
  text = text.replace(/morgangoods/g, 'morganappliances');

  if (text !== original) {
    fs.writeFileSync(filePath, text, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

const files = [
  'public/index.html',
  'public/404.html',
  'public/admin-page/index.html',
  'public/robots.txt',
  'public/sitemap.xml',
  'public/assets/index-B7yQPykp.js',
  'data/api_products.json',
  'data/api_wholesale_products.json',
  'server.js',
  'worker.js'
];

files.forEach(replaceInFile);

console.log('Finished renaming morgangoods -> morganappliances across the site.');
