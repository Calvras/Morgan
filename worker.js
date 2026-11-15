// Last deployed: 2026-11-15 18:30:00 UTC
const BUILD_ID = '20261115-kv-v2';
import categoriesData from './data/api_categories.json';
import seedProductsData from './data/api_products.json';
import wholesaleCategories from './data/api_wholesale_categories.json';
import wholesaleProducts from './data/api_wholesale_products.json';

const KV_PRODUCTS_KEY = 'products_list';
const KV_IMAGE_PREFIX = 'img_'; // separate KV key per admin-uploaded image
const memoryCarts = new Map();

// ─────────────────────────────────────────────────────────────
//  KV helpers — single source of truth for the product list
// ─────────────────────────────────────────────────────────────

/**
 * Read the product list from KV.
 * Falls back to the bundled seed JSON on first run (if KV is empty).
 * Also auto-migrates any inline base64 images to separate KV keys.
 */
async function getProducts(env) {
  if (env && env.PRODUCTS_KV) {
    try {
      const raw = await env.PRODUCTS_KV.get(KV_PRODUCTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Auto-migrate: move any inline base64 images to separate KV keys
          let needsSave = false;
          for (const p of parsed) {
            if (p.images && p.images.length > 0 && typeof p.images[0] === 'string' && p.images[0].startsWith('data:')) {
              try {
                await env.PRODUCTS_KV.put(`${KV_IMAGE_PREFIX}${p.id}`, p.images[0]);
                p.images = [`/api/admin/image/${p.id}`];
                needsSave = true;
              } catch {
                // If migration fails for this image, keep it as is
              }
            }
          }
          if (needsSave) {
            try { await env.PRODUCTS_KV.put(KV_PRODUCTS_KEY, JSON.stringify(parsed)); } catch {}
          }
          return parsed;
        }
      }
      // If KV key does not exist yet, seed it with the bundled products
      await env.PRODUCTS_KV.put(KV_PRODUCTS_KEY, JSON.stringify(seedProductsData));
    } catch (err) {
      console.error('[KV] Error in getProducts:', err);
    }
  }
  return seedProductsData;
}

/**
 * Write the product list to KV.
 * This is the ONLY place we persist — no in-memory mutable state.
 */
async function saveProducts(env, products) {
  if (!env || !env.PRODUCTS_KV) {
    throw new Error('PRODUCTS_KV namespace binding is missing');
  }
  const payload = JSON.stringify(products);
  await env.PRODUCTS_KV.put(KV_PRODUCTS_KEY, payload);
}

// ─────────────────────────────────────────────────────────────
//  Cart helpers (session-scoped, in-memory is fine for carts)
// ─────────────────────────────────────────────────────────────

function getOrCreateCart(sessionId = 'default-session') {
  if (!memoryCarts.has(sessionId)) {
    memoryCarts.set(sessionId, { sessionId, items: [], total: 0, itemCount: 0 });
  }
  return memoryCarts.get(sessionId);
}

function recalculateCart(cart) {
  let total = 0, count = 0;
  for (const item of cart.items) {
    const price = item.product ? (item.product.price || 0) : (item.price || 0);
    total += price * (item.quantity || 1);
    count += (item.quantity || 1);
  }
  cart.total = Math.round(total * 100) / 100;
  cart.itemCount = count;
  return cart;
}

// ─────────────────────────────────────────────────────────────
//  Response helper
// ─────────────────────────────────────────────────────────────

const jsonResponse = (data, status = 200, cacheControl = 'no-store, no-cache, must-revalidate, max-age=0') =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });

// ─────────────────────────────────────────────────────────────
//  Worker entry point
// ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // CORS preflight
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

    // robots.txt
    if (pathname === '/robots.txt') {
      return new Response(
        `User-agent: *\nAllow: /\nDisallow: /admin-page/\nDisallow: /cart\nDisallow: /checkout\nDisallow: /orders/\n\nSitemap: https://morganappliance.online/sitemap.xml\n`,
        { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Google Search Console verification
    if (pathname === '/googlec3eb02de72e21254.html' || pathname === '/googlec3eb02de72e21254') {
      return new Response('google-site-verification: googlec3eb02de72e21254.html', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
      });
    }

    // Admin page HTML
    if (pathname === '/admin-page' || pathname === '/admin-page/') {
      return env.ASSETS.fetch(new Request(new URL('/admin-page/index.html', request.url), request));
    }

    // ── API routes ──────────────────────────────────────────────
    if (pathname.startsWith('/api/')) {
      const apiPath = pathname.replace(/^\/api\//, '');

      // Version probe (public)
      if (apiPath === 'version') {
        const prods = await getProducts(env);
        return jsonResponse({
          build: BUILD_ID,
          has_kv: Boolean(env && env.PRODUCTS_KV),
          products_count: prods.length,
          ts: Date.now()
        });
      }

      // 0. Admin-uploaded product images (public, no auth needed)
      if (apiPath.startsWith('admin/image/') && method === 'GET') {
        if (!env || !env.PRODUCTS_KV) return new Response('Storage unavailable', { status: 503 });
        const imgId = apiPath.replace('admin/image/', '');
        const dataUrl = await env.PRODUCTS_KV.get(`${KV_IMAGE_PREFIX}${imgId}`);
        if (!dataUrl) return new Response('Not found', { status: 404 });
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) return new Response('Invalid image data', { status: 500 });
        const [, mimeType, base64Data] = match;
        const binary = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        return new Response(binary, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // 1. Categories
      if (apiPath === 'categories') return jsonResponse(categoriesData);
      if (apiPath === 'wholesale/categories') return jsonResponse(wholesaleCategories);

      // 2. Campaigns & Combos
      if (apiPath === 'campaigns/active') return jsonResponse({ campaign: null });
      if (apiPath === 'campaigns' || apiPath === 'combos') return jsonResponse([]);

      // 3. Products — read from KV
      if (apiPath === 'products') {
        const liveProducts = await getProducts(env);
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
        const liveProducts = await getProducts(env);
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

      // 5. Cart Management (in-memory carts are fine — session-scoped)
      if (apiPath === 'cart') {
        const sessionId = url.searchParams.get('sessionId') || 'default-session';
        return jsonResponse(getOrCreateCart(sessionId));
      }

      if (apiPath === 'cart/items') {
        if (method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const sessionId = body.sessionId || url.searchParams.get('sessionId') || 'default-session';
          const { productId, quantity = 1 } = body;
          const cart = getOrCreateCart(sessionId);
          const liveProducts = await getProducts(env);
          const product = liveProducts.find(p => String(p.id) === String(productId));
          if (!product) return jsonResponse({ error: 'Product not found' }, 404);

          const existingIdx = cart.items.findIndex(item => String(item.productId) === String(productId));
          if (existingIdx > -1) {
            cart.items[existingIdx].quantity += Number(quantity);
          } else {
            cart.items.push({
              id: `cart-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              productId: product.id,
              quantity: Number(quantity),
              productType: 'retail',
              product
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
          const cart = getOrCreateCart(sessionId);
          const item = cart.items.find(i => String(i.id) === itemId || String(i.productId) === itemId);
          if (item) item.quantity = Math.max(1, Number(body.quantity));
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
      if (apiPath === 'checkout/email-verification/request') return jsonResponse({ success: true, message: 'Verification code sent.' });
      if (apiPath === 'checkout/email-verification/verify') return jsonResponse({ success: true, verified: true });
      if (apiPath === 'checkout/customer-profile') return jsonResponse({ saved: false });

      if (apiPath === 'orders' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const orderId = `MG-${Date.now().toString().slice(-6)}`;
        return jsonResponse({ id: orderId, orderNumber: orderId, createdAt: new Date().toISOString(), status: 'Pending Confirmation', ...body });
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

      // ── Admin API (Bearer token protected) ───────────────────
      if (apiPath.startsWith('admin/')) {
        const authHeader = request.headers.get('Authorization') || '';
        if (authHeader !== 'Bearer morgan') return jsonResponse({ error: 'Unauthorized' }, 401);

        // GET /api/admin/kv-debug — check KV read/write directly
        if (apiPath === 'admin/kv-debug' && method === 'GET') {
          try {
            const raw = await env.PRODUCTS_KV.get(KV_PRODUCTS_KEY);
            const products = raw ? JSON.parse(raw) : null;
            const testKey = 'kv_debug_test';
            await env.PRODUCTS_KV.put(testKey, 'ok_' + Date.now());
            const readBack = await env.PRODUCTS_KV.get(testKey);
            return jsonResponse({
              kv_binding_exists: !!env.PRODUCTS_KV,
              products_key_exists: raw !== null,
              products_count: products ? products.length : 0,
              write_test: readBack
            });
          } catch (e) {
            return jsonResponse({ error: e.message, stack: e.stack }, 500);
          }
        }

        // GET /api/admin/products
        if (apiPath === 'admin/products' && method === 'GET') {
          return jsonResponse(await getProducts(env));
        }

        // POST /api/admin/products
        if (apiPath === 'admin/products' && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const { name, category, price, originalPrice, code, description, features, inStock, image } = body;

          if (!name || !price || !category) {
            return jsonResponse({ error: 'name, price, and category are required' }, 400);
          }

          const newId = Date.now();
          const newCode = code || `ADM-${newId.toString().slice(-6)}`;

          // Store image in KV under separate key so main products list stays compact
          let imageUrl = null;
          if (image && typeof image === 'string' && image.startsWith('data:')) {
            try {
              if (env && env.PRODUCTS_KV) {
                await env.PRODUCTS_KV.put(`${KV_IMAGE_PREFIX}${newId}`, image);
                imageUrl = `/api/admin/image/${newId}`;
              }
            } catch (imgErr) {
              console.error('[Admin POST] image KV save error:', imgErr);
            }
          } else if (image && typeof image === 'string' && (image.startsWith('http') || image.startsWith('/'))) {
            imageUrl = image;
          }

          const newProduct = {
            id: newId,
            name,
            code: newCode,
            price: Number(price),
            originalPrice: originalPrice ? Number(originalPrice) : null,
            category,
            inStock: inStock !== false,
            images: imageUrl ? [imageUrl] : [],
            description: description || '',
            features: Array.isArray(features) ? features : [],
            rating: 0,
            reviewCount: 0,
            isFeatured: false
          };

          // Read → prepend → save atomically in KV
          const products = await getProducts(env);
          products.unshift(newProduct);
          try {
            await saveProducts(env, products);
          } catch (kvErr) {
            console.error('[Admin POST] KV save error:', kvErr);
            return jsonResponse({ error: 'Failed to save product: ' + kvErr.message }, 500);
          }

          return jsonResponse({ success: true, product: newProduct });
        }

        // DELETE /api/admin/products/:id
        if (apiPath.startsWith('admin/products/') && method === 'DELETE') {
          const productId = apiPath.replace('admin/products/', '');
          const products = await getProducts(env);
          const idx = products.findIndex(p => String(p.id) === String(productId));
          if (idx === -1) return jsonResponse({ error: 'Product not found' }, 404);

          products.splice(idx, 1);
          await saveProducts(env, products);

          // Also clean up any separately-stored image for this product
          if (env && env.PRODUCTS_KV) {
            try { await env.PRODUCTS_KV.delete(`${KV_IMAGE_PREFIX}${productId}`); } catch {}
          }

          return jsonResponse({ success: true, deletedId: productId });
        }
      }
    }

    // Everything else → Cloudflare Static Assets (SPA)
    return env.ASSETS.fetch(request);
  }
};
