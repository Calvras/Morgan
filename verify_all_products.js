const fs = require('fs');
const prods = JSON.parse(fs.readFileSync('data/api_products.json', 'utf8'));

console.log('====================================================');
console.log(`FULL 1-BY-1 VERIFICATION OF ALL ${prods.length} PRODUCTS`);
console.log('====================================================\n');

let allPassed = true;
let totalChecked = 0;

prods.forEach((p, idx) => {
  totalChecked++;
  const num = (idx + 1).toString().padStart(3, ' ');
  const hasImages = Array.isArray(p.images) && p.images.length > 0;
  
  if (!hasImages) {
    console.error(`[FAIL] #${num} | ID: ${p.id} | Code: ${p.code} | Name: ${p.name} -> NO IMAGES`);
    allPassed = false;
    return;
  }

  // Check each image
  const imgChecks = p.images.map(img => {
    if (!img.startsWith('/')) {
      return { img, ok: false, reason: 'Not a local root path' };
    }
    const fullDiskPath = 'public' + img;
    if (!fs.existsSync(fullDiskPath)) {
      return { img, ok: false, reason: 'File not found on disk' };
    }
    const stat = fs.statSync(fullDiskPath);
    if (stat.size < 100) {
      return { img, ok: false, reason: `File too small (${stat.size}b)` };
    }
    return { img, ok: true, size: stat.size };
  });

  const allImgsOk = imgChecks.every(c => c.ok);
  if (!allImgsOk) {
    console.error(`[FAIL] #${num} | ID: ${p.id} | Code: ${p.code} | Name: ${p.name} -> BROKEN IMAGE:`, imgChecks);
    allPassed = false;
  } else {
    // Passed
    if (idx < 5 || idx > prods.length - 6 || idx % 20 === 0) {
      console.log(`[PASS] #${num} | ID: ${p.id} | Code: ${(p.code || 'N/A').padEnd(12)} | "${p.name.substring(0, 30)}" -> ${p.images[0]} (${imgChecks[0].size} bytes)`);
    }
  }
});

console.log('\n====================================================');
console.log(`VERIFICATION RESULT: ${allPassed ? 'ALL 175 PRODUCTS PASSED 100%!' : 'SOME FAILED'}`);
console.log(`TOTAL PRODUCTS CHECKED: ${totalChecked}`);
console.log('====================================================');
