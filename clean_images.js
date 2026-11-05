const fs = require('fs');

const prods = JSON.parse(fs.readFileSync('data/api_products.json', 'utf8'));

let updatedCount = 0;
let totalImagesFixed = 0;

const cleanedProducts = prods.map(product => {
  const oldImages = product.images || [];
  const newImages = [];

  for (const raw of oldImages) {
    let img = raw;
    // 1. Replace remote domains with local path
    if (img.startsWith('https://morgan.dzncm.com/')) {
      img = '/external/' + img.replace('https://morgan.dzncm.com/', '');
    } else if (img.startsWith('https://dronesset.com/')) {
      img = '/external/' + img.replace('https://dronesset.com/', '');
    } else if (img.startsWith('https://cb-electronics.com/')) {
      img = '/external/' + img.replace('https://cb-electronics.com/', '');
    }

    // 2. Check if local file exists on disk and is non-empty
    if (img.startsWith('/')) {
      const localDiskPath = 'public' + img;
      if (fs.existsSync(localDiskPath) && fs.statSync(localDiskPath).size > 100) {
        if (!newImages.includes(img)) {
          newImages.push(img);
          totalImagesFixed++;
        }
      }
    }
  }

  // Sanity check: must have at least one image
  if (newImages.length === 0) {
    console.error(`WARNING: Product ${product.id} (${product.code} - ${product.name}) has NO valid images!`);
  } else {
    updatedCount++;
  }

  return {
    ...product,
    images: newImages
  };
});

console.log(`Processed ${cleanedProducts.length} products.`);
console.log(`Products with verified images: ${updatedCount}`);
console.log(`Total valid images across all products: ${totalImagesFixed}`);

// Verify every product has at least one valid image
const missing = cleanedProducts.filter(p => !p.images || p.images.length === 0);
if (missing.length === 0) {
  fs.writeFileSync('data/api_products.json', JSON.stringify(cleanedProducts, null, 2), 'utf8');
  console.log('Successfully wrote cleaned products to data/api_products.json');
} else {
  console.error('Cannot save: Some products are missing images!', missing);
}
