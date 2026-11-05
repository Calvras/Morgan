import categoriesData from './data/api_categories.json';
import productsData from './data/api_products.json';
import wholesaleCategories from './data/api_wholesale_categories.json';
import wholesaleProducts from './data/api_wholesale_products.json';

// Mutable in-memory product list (seeded from bundled JSON at startup)
let liveProducts = [...productsData];
const memoryCarts = new Map();

// GitHub repo details for persistent sync
const GH_OWNER = 'Calvras';
const GH_REPO = 'Morgan';
const GH_PATH = 'data/api_products.json';
// GH_TOKEN is loaded from env.GH_TOKEN (Cloudflare Worker secret)

// Upload product image to GitHub and return a public URL
async function uploadImageToGitHub(base64DataUrl, productId, ghToken) {
  try {
    // Strip data URL prefix: "data:image/webp;base64,..."
    const match = base64DataUrl.match(/^data:([a-zA-Z0-9+\/]+\/[a-zA-Z0-9+\/]+);base64,(.+)$/);
    if (!match) return null;
    const ext = match[1].includes('png') ? 'png' : match[1].includes('webp') ? 'webp' : 'jpg';
    const content = match[2];
    const filename = `public/products/admin-${productId}.${ext}`;

    const uploadRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${ghToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MorganWorker/1.0'
      },
      body: JSON.stringify({
        message: `Upload product image ${filename}`,
        content: content
      })
    });

    if (!uploadRes.ok) return null;
    const uploadData = await uploadRes.json();
    // Return the path relative to the site (Cloudflare serves /products/...)
    return uploadData.content ? `/products/admin-${productId}.${ext}` : null;
  } catch {
    return null;
  }
}

// Sync liveProducts to GitHub so changes persist across redeployments
async function syncProductsToGitHub(ghToken) {
  try {
    // Get current SHA
    const getRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PATH}`, {
      headers: {
        'Authorization': `token ${ghToken}`,
        'User-Agent': 'MorganWorker/1.0'
      }
    });
    const existing = await getRes.json();
    const sha = existing.sha;

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(liveProducts, null, 2))));

    await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PATH}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${ghToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MorganWorker/1.0'
      },
      body: JSON.stringify({
        message: 'Admin: sync product list',
        content,
        sha
      })
    });
  } catch (e) {
    // Non-fatal: in-memory state is already updated
    console.error('GitHub sync failed:', e);
  }
}

function getOrCreateCart(sessionId = 'default-session') {
  if (!memoryCarts.has(sessionId)) {
    memoryCarts.set(sessionId, {
      sessionId,
      items: [],
      total: 0,
      itemCount: 0
    });
  }
  return memoryCarts.get(sessionId);
}

function recalculateCart(cart) {
  let total = 0;
  let count = 0;
  for (const item of cart.items) {
    const price = item.product ? (item.product.price || 0) : (item.price || 0);
    total += price * (item.quantity || 1);
    count += (item.quantity || 1);
  }
  cart.total = Math.round(total * 100) / 100;
  cart.itemCount = count;
  return cart;
}

const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // Google Search Console verification
    if (pathname === '/googlec3eb02de72e21254.html' || pathname === '/googlec3eb02de72e21254') {
      return new Response('google-site-verification: googlec3eb02de72e21254.html', {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Serve admin page HTML for /admin-page and /admin-page/
    if (pathname === '/admin-page' || pathname === '/admin-page/') {
      return env.ASSETS.fetch(new Request(new URL('/admin-page/index.html', request.url), request));
    }

    // Only intercept /api/ routes; let env.ASSETS handle all static files & SPA
    if (pathname.startsWith('/api/')) {
      const apiPath = pathname.replace(/^\/api\//, '');

      // 1. Categories
      if (apiPath === 'categories') {
        return jsonResponse(categoriesData);
      }
      if (apiPath === 'wholesale/categories') {
        return jsonResponse(wholesaleCategories);
      }

      // 2. Campaigns & Combos
      if (apiPath === 'campaigns/active') {
        return jsonResponse({ campaign: null });
      }
      if (apiPath === 'campaigns' || apiPath === 'combos') {
        return jsonResponse([]);
      }

      // 3. Products
      if (apiPath === 'products') {
        const category = url.searchParams.get('category');
        const q = url.searchParams.get('q');
        const id = url.searchParams.get('id');

        let result = liveProducts;
        if (id) {
          const p = liveProducts.find(prod => String(prod.id) === String(id));
          return jsonResponse(p ? [p] : []);
        }
        if (category) {
          const catLower = category.toLowerCase();
          result = result.filter(p => {
            const pCat = (p.category || '').toLowerCase();
            return pCat === catLower || pCat.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '') === catLower;
          });
        }
        if (q) {
          const qLower = q.toLowerCase();
          result = result.filter(p => 
            (p.name && p.name.toLowerCase().includes(qLower)) ||
            (p.description && p.description.toLowerCase().includes(qLower)) ||
            (p.code && p.code.toLowerCase().includes(qLower))
          );
        }
        return jsonResponse(result);
      }

      if (apiPath.startsWith('products/')) {
        const idOrCode = apiPath.replace('products/', '');
        const product = liveProducts.find(p => String(p.id) === idOrCode || p.code === idOrCode);
        if (!product) return jsonResponse({ error: 'Product not found' }, 404);
        return jsonResponse(product);
      }

      // 4. Wholesale Products
      if (apiPath === 'wholesale/products') {
        const category = url.searchParams.get('category');
        const q = url.searchParams.get('q');

        let result = wholesaleProducts;
        if (category) {
          const catLower = category.toLowerCase();
          result = result.filter(p => {
            const pCat = (p.category || '').toLowerCase();
            return pCat === catLower || pCat.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '') === catLower;
          });
        }
        if (q) {
          const qLower = q.toLowerCase();
          result = result.filter(p => 
            (p.name && p.name.toLowerCase().includes(qLower)) ||
            (p.code && p.code.toLowerCase().includes(qLower))
          );
        }
        return jsonResponse(result);
      }

      if (apiPath.startsWith('wholesale/products/')) {
        const idOrCode = apiPath.replace('wholesale/products/', '');
        const product = wholesaleProducts.find(p => String(p.id) === idOrCode || p.code === idOrCode);
        if (!product) return jsonResponse({ error: 'Wholesale product not found' }, 404);
        return jsonResponse(product);
      }

      // 5. Cart Management
      if (apiPath === 'cart') {
        const sessionId = url.searchParams.get('sessionId') || 'default-session';
        const cart = getOrCreateCart(sessionId);
        return jsonResponse(cart);
      }

      if (apiPath === 'cart/items') {
        if (method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const sessionId = body.sessionId || url.searchParams.get('sessionId') || 'default-session';
          const { productId, quantity = 1 } = body;
          const cart = getOrCreateCart(sessionId);
          const product = liveProducts.find(p => String(p.id) === String(productId));

          if (!product) return jsonResponse({ error: 'Product not found' }, 404);

          const existingItemIndex = cart.items.findIndex(item => String(item.productId) === String(productId));
          if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += Number(quantity);
          } else {
            cart.items.push({
              id: `cart-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              productId: product.id,
              quantity: Number(quantity),
              productType: 'retail',
              product: product
            });
          }
          recalculateCart(cart);
          return jsonResponse(cart);
        }
      }

      if (apiPath.startsWith('cart/items/')) {
        const itemId = apiPath.replace('cart/items/', '');
        if (method === 'PATCH') {
          const body = await request.json().catch(() => ({}));
          const sessionId = body.sessionId || url.searchParams.get('sessionId') || 'default-session';
          const { quantity } = body;
          const cart = getOrCreateCart(sessionId);
          const item = cart.items.find(i => String(i.id) === itemId || String(i.productId) === itemId);
          if (item) {
            item.quantity = Math.max(1, Number(quantity));
          }
          recalculateCart(cart);
          return jsonResponse(cart);
        }
        if (method === 'DELETE') {
          const body = await request.json().catch(() => ({}));
          const sessionId = body.sessionId || url.searchParams.get('sessionId') || 'default-session';
          const cart = getOrCreateCart(sessionId);
          cart.items = cart.items.filter(i => String(i.id) !== itemId && String(i.productId) !== itemId);
          recalculateCart(cart);
          return jsonResponse(cart);
        }
      }

      // 6. Orders & Checkout
      if (apiPath === 'checkout/email-verification/request') {
        return jsonResponse({ success: true, message: 'Verification code sent.' });
      }
      if (apiPath === 'checkout/email-verification/verify') {
        return jsonResponse({ success: true, verified: true });
      }
      if (apiPath === 'checkout/customer-profile') {
        return jsonResponse({ saved: false });
      }

      if (apiPath === 'orders') {
        if (method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const orderId = `MG-${Date.now().toString().slice(-6)}`;
          const order = {
            id: orderId,
            orderNumber: orderId,
            createdAt: new Date().toISOString(),
            status: 'Pending Confirmation',
            ...body
          };
          return jsonResponse(order);
        }
      }

      if (apiPath.startsWith('orders/') && apiPath.includes('initialize-payment')) {
        return jsonResponse({ success: true, authorization_url: null, message: 'Payment gateway initialized' });
      }

      if (apiPath.startsWith('orders/') && apiPath.includes('reconcile-payment')) {
        return jsonResponse({ success: true, status: 'Paid' });
      }

      if (apiPath === 'orders/track') {
        return jsonResponse({ error: 'No order found with the provided details.' }, 404);
      }

      // =====================================================
      // 7. ADMIN API — Protected with Bearer token
      // =====================================================

      if (apiPath.startsWith('admin/')) {
        const authHeader = request.headers.get('Authorization') || '';
        if (authHeader !== 'Bearer morgan') {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // GET /api/admin/products — List all products
        if (apiPath === 'admin/products' && method === 'GET') {
          return jsonResponse(liveProducts);
        }

        // POST /api/admin/products — Add a new product
        if (apiPath === 'admin/products' && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const { name, category, price, originalPrice, code, description, features, inStock, image } = body;

          if (!name || !price || !category) {
            return jsonResponse({ error: 'name, price, and category are required' }, 400);
          }

          const newId = Date.now();
          const newCode = code || `ADM-${newId.toString().slice(-6)}`;

          // Try to upload image to GitHub repo for permanent hosting
          let imageUrl = null;
          if (image && image.startsWith('data:')) {
            const uploaded = await uploadImageToGitHub(image, newId, env.GH_TOKEN);
            imageUrl = uploaded; // may be null if upload failed
          }

          const newProduct = {
            id: newId,
            name,
            code: newCode,
            price: Number(price),
            originalPrice: originalPrice ? Number(originalPrice) : null,
            category,
            inStock: inStock !== false,
            images: imageUrl ? [imageUrl] : (image ? [image] : []),
            description: description || '',
            features: Array.isArray(features) ? features : [],
            rating: 0,
            reviewCount: 0,
            isFeatured: false
          };

          liveProducts.unshift(newProduct);

          // Sync to GitHub (async background task)
          syncProductsToGitHub(env.GH_TOKEN);

          return jsonResponse({ success: true, product: newProduct });
        }

        // DELETE /api/admin/products/:id — Remove a product
        if (apiPath.startsWith('admin/products/') && method === 'DELETE') {
          const productId = apiPath.replace('admin/products/', '');
          const idx = liveProducts.findIndex(p => String(p.id) === String(productId));
          if (idx === -1) {
            return jsonResponse({ error: 'Product not found' }, 404);
          }

          liveProducts.splice(idx, 1);

          syncProductsToGitHub(env.GH_TOKEN);

          return jsonResponse({ success: true, deletedId: productId });
        }
      }
    }

    // Pass everything else to Cloudflare Static Assets (HTML, JS, CSS, images)
    return env.ASSETS.fetch(request);
  }
};
