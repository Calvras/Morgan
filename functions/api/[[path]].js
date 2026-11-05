import categories from '../../data/api_categories.json';
import products from '../../data/api_products.json';
import wholesaleCategories from '../../data/api_wholesale_categories.json';
import wholesaleProducts from '../../data/api_wholesale_products.json';

// In-memory fallback cart (Cloudflare edge instance)
const memoryCarts = new Map();

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

export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  const pathArr = params.path || [];
  const pathname = pathArr.join('/');
  const method = request.method;

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

  // 1. Categories
  if (pathname === 'categories') {
    return jsonResponse(categories);
  }
  if (pathname === 'wholesale/categories') {
    return jsonResponse(wholesaleCategories);
  }

  // 2. Campaigns
  if (pathname === 'campaigns/active') {
    return jsonResponse({ campaign: null });
  }
  if (pathname === 'campaigns') {
    return jsonResponse([]);
  }
  if (pathname === 'combos') {
    return jsonResponse([]);
  }

  // 3. Products
  if (pathname === 'products') {
    const category = url.searchParams.get('category');
    const q = url.searchParams.get('q');
    const id = url.searchParams.get('id');

    let result = products;
    if (id) {
      const p = products.find(prod => String(prod.id) === String(id));
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

  // Single product: products/:id
  if (pathname.startsWith('products/')) {
    const idOrCode = pathname.replace('products/', '');
    const product = products.find(p => String(p.id) === idOrCode || p.code === idOrCode);
    if (!product) return jsonResponse({ error: 'Product not found' }, 404);
    return jsonResponse(product);
  }

  // 4. Wholesale Products
  if (pathname === 'wholesale/products') {
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

  if (pathname.startsWith('wholesale/products/')) {
    const idOrCode = pathname.replace('wholesale/products/', '');
    const product = wholesaleProducts.find(p => String(p.id) === idOrCode || p.code === idOrCode);
    if (!product) return jsonResponse({ error: 'Wholesale product not found' }, 404);
    return jsonResponse(product);
  }

  // 5. Cart Management
  if (pathname === 'cart') {
    const sessionId = url.searchParams.get('sessionId') || 'default-session';
    const cart = getOrCreateCart(sessionId);
    return jsonResponse(cart);
  }

  if (pathname === 'cart/items') {
    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const sessionId = body.sessionId || url.searchParams.get('sessionId') || 'default-session';
      const { productId, quantity = 1 } = body;
      const cart = getOrCreateCart(sessionId);
      const product = products.find(p => String(p.id) === String(productId));

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

  if (pathname.startsWith('cart/items/')) {
    const itemId = pathname.replace('cart/items/', '');
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
  if (pathname === 'checkout/email-verification/request') {
    return jsonResponse({ success: true, message: 'Verification code sent.' });
  }
  if (pathname === 'checkout/email-verification/verify') {
    return jsonResponse({ success: true, verified: true });
  }
  if (pathname === 'checkout/customer-profile') {
    return jsonResponse({ saved: false });
  }

  if (pathname === 'orders') {
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

  if (pathname.startsWith('orders/') && pathname.includes('initialize-payment')) {
    return jsonResponse({ success: true, authorization_url: null, message: 'Payment gateway initialized' });
  }

  if (pathname.startsWith('orders/') && pathname.includes('reconcile-payment')) {
    return jsonResponse({ success: true, status: 'Paid' });
  }

  if (pathname === 'orders/track') {
    return jsonResponse({ error: 'No order found with the provided details.' }, 404);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}
