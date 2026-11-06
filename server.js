const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load mock / scraped data
const dataDir = path.join(__dirname, 'data');
const categories = JSON.parse(fs.readFileSync(path.join(dataDir, 'api_categories.json'), 'utf-8'));
const products = JSON.parse(fs.readFileSync(path.join(dataDir, 'api_products.json'), 'utf-8'));
const wholesaleCategories = JSON.parse(fs.readFileSync(path.join(dataDir, 'api_wholesale_categories.json'), 'utf-8'));
const wholesaleProducts = JSON.parse(fs.readFileSync(path.join(dataDir, 'api_wholesale_products.json'), 'utf-8'));
let combos = [];
if (fs.existsSync(path.join(dataDir, 'api_combos.json'))) {
  try {
    combos = JSON.parse(fs.readFileSync(path.join(dataDir, 'api_combos.json'), 'utf-8'));
  } catch (e) {
    combos = [];
  }
}

// In-memory cart store per session
const carts = new Map();

function getOrCreateCart(sessionId = 'default-session') {
  if (!carts.has(sessionId)) {
    carts.set(sessionId, {
      sessionId,
      items: [],
      total: 0,
      itemCount: 0
    });
  }
  return carts.get(sessionId);
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

// In-memory orders store
const orders = new Map();

// API Routes
// 1. Categories
app.get('/api/categories', (req, res) => {
  res.json(categories);
});

app.get('/api/wholesale/categories', (req, res) => {
  res.json(wholesaleCategories);
});

// Campaigns
app.get('/api/campaigns/active', (req, res) => {
  res.json({ campaign: null });
});

app.get('/api/campaigns', (req, res) => {
  res.json([]);
});

// 2. Products
app.get('/api/products', (req, res) => {
  const { category, q, id } = req.query;
  let result = products;

  if (id) {
    const p = products.find(prod => String(prod.id) === String(id));
    return res.json(p ? [p] : []);
  }

  if (category) {
    // category could be slug or name
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

  res.json(result);
});

app.get('/api/products/:id', (req, res) => {
  const idOrCode = req.params.id;
  const product = products.find(p => String(p.id) === idOrCode || p.code === idOrCode);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// 3. Wholesale Products
app.get('/api/wholesale/products', (req, res) => {
  const { category, q } = req.query;
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

  res.json(result);
});

app.get('/api/wholesale/products/:id', (req, res) => {
  const idOrCode = req.params.id;
  const product = wholesaleProducts.find(p => String(p.id) === idOrCode || p.code === idOrCode);
  if (!product) {
    return res.status(404).json({ error: 'Wholesale product not found' });
  }
  res.json(product);
});

// 4. Combos
app.get('/api/combos', (req, res) => {
  res.json(combos);
});

// 5. Cart Management
app.get('/api/cart', (req, res) => {
  const sessionId = req.query.sessionId || 'default-session';
  const cart = getOrCreateCart(sessionId);
  res.json(cart);
});

app.post('/api/cart/items', (req, res) => {
  const sessionId = req.body.sessionId || req.query.sessionId || 'default-session';
  const { productId, quantity = 1 } = req.body;
  const cart = getOrCreateCart(sessionId);
  const product = products.find(p => String(p.id) === String(productId));

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

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
  res.json(cart);
});

app.patch('/api/cart/items/:id', (req, res) => {
  const sessionId = req.body.sessionId || req.query.sessionId || 'default-session';
  const itemId = req.params.id;
  const { quantity } = req.body;
  const cart = getOrCreateCart(sessionId);

  const item = cart.items.find(i => String(i.id) === itemId || String(i.productId) === itemId);
  if (item) {
    item.quantity = Math.max(1, Number(quantity));
  }
  recalculateCart(cart);
  res.json(cart);
});

app.delete('/api/cart/items/:id', (req, res) => {
  const sessionId = req.body.sessionId || req.query.sessionId || 'default-session';
  const itemId = req.params.id;
  const cart = getOrCreateCart(sessionId);

  cart.items = cart.items.filter(i => String(i.id) !== itemId && String(i.productId) !== itemId);
  recalculateCart(cart);
  res.json(cart);
});

// 6. Orders & Checkout
app.post('/api/checkout/email-verification/request', (req, res) => {
  res.json({ success: true, message: 'Verification code sent to email.' });
});

app.post('/api/checkout/email-verification/verify', (req, res) => {
  res.json({ success: true, verified: true });
});

app.get('/api/checkout/customer-profile', (req, res) => {
  res.json({ saved: false });
});

app.post('/api/orders', (req, res) => {
  const orderId = `MG-${Date.now().toString().slice(-6)}`;
  const order = {
    id: orderId,
    orderNumber: orderId,
    createdAt: new Date().toISOString(),
    status: 'Pending Confirmation',
    ...req.body
  };
  orders.set(orderId, order);
  
  // Clear cart
  const cart = getOrCreateCart();
  cart.items = [];
  recalculateCart(cart);

  res.json(order);
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

app.post('/api/orders/track', (req, res) => {
  const { orderNumber } = req.body;
  const order = orders.get(orderNumber);
  if (!order) {
    return res.status(404).json({ error: 'No order found with the provided details.' });
  }
  res.json(order);
});

app.post('/api/orders/:id/initialize-payment', (req, res) => {
  res.json({ success: true, authorization_url: null, message: 'Payment gateway initialized' });
});

app.post('/api/orders/:id/reconcile-payment', (req, res) => {
  const order = orders.get(req.params.id);
  if (order) {
    order.status = 'Paid';
  }
  res.json({ success: true, status: 'Paid' });
});

// 7. Resellers stubs
app.post('/api/resellers/login', (req, res) => {
  res.status(400).json({ message: 'Reseller portal login not configured in local sandbox.' });
});
app.get('/api/resellers/me', (req, res) => {
  res.status(401).json({ error: 'Unauthorized' });
});

// Static assets serving
const publicDir = path.join(__dirname, 'public');

// Serve supplier catalog objects explicitly
app.use('/api/storage/public-objects/supplier-catalog', express.static(
  path.join(publicDir, 'api', 'storage', 'public-objects', 'supplier-catalog')
));

// Admin Portal Routes
app.get('/admin-page', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin-page/index.html'));
});

app.get('/api/admin/products', (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== 'Bearer morgan') return res.status(401).json({ error: 'Unauthorized' });
  res.json(products);
});

app.post('/api/admin/products', (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== 'Bearer morgan') return res.status(401).json({ error: 'Unauthorized' });

  const { name, category, price, originalPrice, code, description, features, inStock, image } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'name, price, and category are required' });
  }

  const newId = Date.now();
  const newProduct = {
    id: newId,
    name,
    code: code || `ADM-${newId.toString().slice(-6)}`,
    price: Number(price),
    originalPrice: originalPrice ? Number(originalPrice) : null,
    category,
    inStock: inStock !== false,
    images: image ? [image] : [],
    description: description || '',
    features: Array.isArray(features) ? features : [],
    rating: 0,
    reviewCount: 0,
    isFeatured: false
  };

  products.unshift(newProduct);
  try {
    fs.writeFileSync('./data/api_products.json', JSON.stringify(products, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write products:', err);
  }

  res.json({ success: true, product: newProduct });
});

app.delete('/api/admin/products/:id', (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== 'Bearer morgan') return res.status(401).json({ error: 'Unauthorized' });

  const idx = products.findIndex(p => String(p.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  products.splice(idx, 1);
  try {
    fs.writeFileSync('./data/api_products.json', JSON.stringify(products, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write products:', err);
  }

  res.json({ success: true, deletedId: req.params.id });
});

// Serve static directory
app.use(express.static(publicDir));

// Fallback for SPA (HTML5 History API)
app.use((req, res) => {
  // If it's an API route or file with extension that was not found, return 404
  if (req.path.startsWith('/api/') || path.extname(req.path)) {
    return res.status(404).send('Not Found');
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start listening
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`Morgan Retail replica server running!`);
  console.log(`Local URL: http://localhost:${PORT}`);
  console.log(`Static assets from: ${publicDir}`);
  console.log(`Products loaded: ${products.length}`);
  console.log(`Wholesale products loaded: ${wholesaleProducts.length}`);
  console.log(`Categories loaded: ${categories.length}`);
  console.log(`====================================================`);
});
