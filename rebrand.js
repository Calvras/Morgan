const fs = require('fs');
const path = require('path');

const BASE = 'c:/Users/darka/Desktop/morgan';

// Files to do text replacement in
const textFiles = [
  `${BASE}/public/index.html`,
  `${BASE}/public/404.html`,
  `${BASE}/public/admin-page/index.html`,
  `${BASE}/public/assets/index-B7yQPykp.js`,
  `${BASE}/data/api_products.json`,
  `${BASE}/server.js`,
  `${BASE}/worker.js`,
];

const replacements = [
  // Brand name changes - order matters (longer/more specific first)
  ['Morgan Appliances Ghana', 'Morgan Retail Ghana'],
  ['Morgan Appliances | Morgan Electronics Ghana', 'Morgan Retail Ghana'],
  ['Morgan Appliances | Morgan Electronics', 'Morgan Retail'],
  ['Morgan Appliances (Morgan Electronics)', 'Morgan Retail'],
  ['Morgan Appliances', 'Morgan Retail'],
  // Logo URL update (svg -> jpg)
  ['https://morganappliance.online/logo.svg', 'https://morganappliance.online/logo.jpg'],
  ['/logo.svg', '/logo.jpg'],
];

let totalChanges = 0;

for (const filePath of textFiles) {
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${path.basename(filePath)}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = 0;
  for (const [from, to] of replacements) {
    const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const newContent = content.replace(regex, to);
    const count = (content.match(regex) || []).length;
    if (count > 0) {
      content = newContent;
      changed += count;
      console.log(`  [${path.basename(filePath)}] "${from}" → "${to}" (${count}x)`);
    }
  }
  if (changed > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalChanges += changed;
    console.log(`  ✅ Saved ${path.basename(filePath)} (${changed} replacements)`);
  } else {
    console.log(`  — No changes in ${path.basename(filePath)}`);
  }
}

console.log(`\nTotal replacements: ${totalChanges}`);

// Now copy logo.jpeg as the new favicon and logo
// Replace logo.svg with a redirect to logo.jpg (or just copy)
// Also copy as favicon.ico placeholder (browsers will use the link tag)
fs.copyFileSync(`${BASE}/logo.jpeg`, `${BASE}/public/logo.jpg`);
fs.copyFileSync(`${BASE}/logo.jpeg`, `${BASE}/public/favicon.jpg`);

// Create a simple SVG that references the jpg (for backward compat with /logo.svg requests)
// Actually better to just copy the jpg over
console.log('\n✅ Logo files copied to public/');
console.log('Done!');
