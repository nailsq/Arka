require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'test';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const adminTokens = new Set();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'public', 'images'),
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, 'product_' + Date.now() + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// HELPERS
// ============================================================

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  rows.forEach(function (r) { result[r.key] = r.value; });
  return result;
}

function validateTelegramInitData(initData) {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    const entries = [];
    params.forEach(function (v, k) { entries.push(k + '=' + v); });
    entries.sort();
    const dataCheckString = entries.join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computed === hash) {
      const userStr = params.get('user');
      return userStr ? JSON.parse(userStr) : null;
    }
  } catch (e) {
    // validation failed
  }
  return null;
}

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ============================================================
// PUBLIC API: Categories & Products
// ============================================================

app.get('/api/cities', function (req, res) {
  res.json(db.prepare('SELECT * FROM cities WHERE is_active = 1').all());
});

app.get('/api/categories', function (req, res) {
  res.json(db.prepare('SELECT * FROM categories').all());
});

function attachImages(products) {
  if (!products || !products.length) return products;
  var ids = products.map(function (p) { return p.id; });
  var placeholders = ids.map(function () { return '?'; }).join(',');
  var stmt = db.prepare('SELECT * FROM product_images WHERE product_id IN (' + placeholders + ') ORDER BY sort_order, id');
  var imgs = stmt.all(...ids);
  var map = {};
  imgs.forEach(function (img) {
    if (!map[img.product_id]) map[img.product_id] = [];
    map[img.product_id].push(img);
  });
  products.forEach(function (p) {
    p.images = map[p.id] || [];
    if (!p.images.length && p.image_url) {
      p.images = [{ id: 0, product_id: p.id, image_url: p.image_url, sort_order: 0 }];
    }
  });
  return products;
}

function attachImagesOne(p) {
  if (!p) return p;
  p.images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order, id').all(p.id);
  if (!p.images.length && p.image_url) {
    p.images = [{ id: 0, product_id: p.id, image_url: p.image_url, sort_order: 0 }];
  }
  return p;
}

app.get('/api/products', function (req, res) {
  var cid = req.query.category_id;
  var products;
  if (!cid) {
    products = db.prepare('SELECT * FROM products').all();
  } else {
    products = db.prepare('SELECT * FROM products WHERE category_id = ?').all(cid);
  }
  res.json(attachImages(products));
});

app.get('/api/products/:id', function (req, res) {
  var p = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(attachImagesOne(p));
});

// ============================================================
// PUBLIC API: Settings (delivery info for client)
// ============================================================

app.get('/api/settings', function (req, res) {
  res.json(getAllSettings());
});

// ============================================================
// AUTH: Telegram
// ============================================================

app.post('/api/auth/telegram', function (req, res) {
  var telegramId = req.body.telegram_id;
  var firstName = req.body.first_name || '';
  var initData = req.body.init_data || '';

  if (!telegramId) {
    return res.status(400).json({ error: 'telegram_id required' });
  }

  if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE' && initData) {
    var validated = validateTelegramInitData(initData);
    if (!validated || String(validated.id) !== String(telegramId)) {
      return res.status(403).json({ error: 'Invalid init data' });
    }
  }

  var existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (existing) {
    if (firstName && firstName !== existing.first_name) {
      db.prepare('UPDATE users SET first_name = ? WHERE id = ?').run(firstName, existing.id);
      existing.first_name = firstName;
    }
    return res.json({ user: existing });
  }

  var info = db.prepare('INSERT INTO users (telegram_id, first_name) VALUES (?, ?)').run(
    String(telegramId), firstName
  );
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ user: user });
});

// ============================================================
// USER: Update profile
// ============================================================

app.post('/api/user/update', function (req, res) {
  var telegramId = req.body.telegram_id;
  if (!telegramId) return res.status(400).json({ error: 'telegram_id required' });
  var user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (!user) return res.status(404).json({ error: 'User not found' });

  var phone = req.body.phone;
  var address = req.body.default_address;
  if (phone !== undefined) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, user.id);
  if (address !== undefined) db.prepare('UPDATE users SET default_address = ? WHERE id = ?').run(address, user.id);

  var updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: updated });
});

// ============================================================
// USER: Saved addresses
// ============================================================

app.get('/api/user/addresses', function (req, res) {
  var telegramId = req.query.telegram_id;
  if (!telegramId) return res.json([]);
  var user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (!user) return res.json([]);
  var addresses = db.prepare('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  res.json(addresses);
});

app.post('/api/user/addresses', function (req, res) {
  var telegramId = req.body.telegram_id;
  if (!telegramId) return res.status(400).json({ error: 'telegram_id required' });
  var user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (!user) return res.status(404).json({ error: 'User not found' });
  var b = req.body;
  var fullAddr = (b.city || '') + ', ' + (b.district || '') + ', ' + (b.street || '') + ', кв./оф. ' + (b.apartment || '') + (b.note ? ', ' + b.note : '');
  var r = db.prepare('INSERT INTO user_addresses (user_id, label, city, district, street, apartment, note, full_address) VALUES (?,?,?,?,?,?,?,?)').run(
    user.id, b.label || '', b.city || '', b.district || '', b.street || '', b.apartment || '', b.note || '', fullAddr
  );
  res.json({ id: Number(r.lastInsertRowid), full_address: fullAddr });
});

app.delete('/api/user/addresses/:id', function (req, res) {
  db.prepare('DELETE FROM user_addresses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// USER: Order history
// ============================================================

app.get('/api/user/orders', function (req, res) {
  var telegramId = req.query.telegram_id;
  if (!telegramId) return res.status(400).json({ error: 'telegram_id required' });
  var user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (!user) return res.json([]);

  var orders = db.prepare(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'
  ).all(user.id);

  orders.forEach(function (o) {
    o.items = db.prepare(
      'SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?'
    ).all(o.id);
  });

  res.json(orders);
});

// ============================================================
// PUBLIC API: Create order
// ============================================================

app.post('/api/orders', function (req, res) {
  var body = req.body;
  var userName = body.user_name;
  var userPhone = body.user_phone;
  var items = body.items;

  if (!userName || !userPhone || !items || !items.length) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  var goodsTotal = items.reduce(function (s, i) { return s + i.price * i.quantity; }, 0);
  var deliveryCost = parseInt(body.delivery_cost) || 0;
  var totalAmount = goodsTotal + deliveryCost;

  var userId = null;
  if (body.telegram_id) {
    var user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(String(body.telegram_id));
    if (user) userId = user.id;
  }

  var insertOrder = db.prepare(
    'INSERT INTO orders (user_id, city_id, user_name, user_phone, user_email, user_telegram, receiver_name, receiver_phone, delivery_address, delivery_type, delivery_zone, delivery_cost, delivery_interval, delivery_date, exact_time, comment, total_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  var insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, price, flower_count) VALUES (?,?,?,?,?)'
  );

  var createOrder = db.transaction(function () {
    var r = insertOrder.run(
      userId,
      body.city_id || null,
      userName,
      userPhone,
      body.user_email || '',
      body.user_telegram || '',
      body.receiver_name || '',
      body.receiver_phone || '',
      body.delivery_address || '',
      body.delivery_type || 'delivery',
      body.delivery_zone || '',
      deliveryCost,
      body.delivery_interval || '',
      body.delivery_date || '',
      body.exact_time || '',
      body.comment || '',
      totalAmount
    );
    var orderId = r.lastInsertRowid;
    items.forEach(function (item) {
      insertItem.run(orderId, item.product_id, item.quantity, item.price, item.flower_count || 0);
    });
    return orderId;
  });

  try {
    var orderId = createOrder();
    res.json({ success: true, order_id: orderId, total_amount: totalAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Order creation failed' });
  }
});

// ============================================================
// PAYMENT
// ============================================================

app.post('/api/payments/create', function (req, res) {
  var orderId = req.body.order_id;
  if (!orderId) return res.status(400).json({ error: 'order_id required' });

  var order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  var paymentId = 'pay_' + Date.now() + '_' + orderId;

  if (PAYMENT_PROVIDER === 'test') {
    db.prepare('UPDATE orders SET payment_id = ? WHERE id = ?').run(paymentId, orderId);
    var confirmUrl = PUBLIC_URL + '/api/payments/test-complete/' + orderId + '?payment_id=' + paymentId;
    return res.json({
      payment_id: paymentId,
      payment_url: confirmUrl,
      provider: 'test'
    });
  }

  if (PAYMENT_PROVIDER === 'yookassa') {
    db.prepare('UPDATE orders SET payment_id = ? WHERE id = ?').run(paymentId, orderId);
    return res.json({
      payment_id: paymentId,
      payment_url: PUBLIC_URL + '/api/payments/test-complete/' + orderId + '?payment_id=' + paymentId,
      provider: 'yookassa',
      note: 'Configure YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY in .env for real integration'
    });
  }

  if (PAYMENT_PROVIDER === 'tinkoff') {
    db.prepare('UPDATE orders SET payment_id = ? WHERE id = ?').run(paymentId, orderId);
    return res.json({
      payment_id: paymentId,
      payment_url: PUBLIC_URL + '/api/payments/test-complete/' + orderId + '?payment_id=' + paymentId,
      provider: 'tinkoff',
      note: 'Configure TINKOFF_TERMINAL_KEY and TINKOFF_SECRET_KEY in .env for real integration'
    });
  }

  res.status(400).json({ error: 'Unknown payment provider' });
});

app.get('/api/payments/test-complete/:orderId', function (req, res) {
  var orderId = req.params.orderId;
  var paymentId = req.query.payment_id;
  var order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).send('Order not found');

  db.prepare('UPDATE orders SET is_paid = 1, paid_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?')
    .run('Оплачен', orderId);

  res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Оплата</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#000}div{text-align:center;border:1px solid #000;padding:40px}</style></head><body><div><p>Оплата прошла успешно</p><p>Заказ N ' + orderId + '</p><p>Можно закрыть эту страницу</p></div></body></html>');
});

app.post('/api/payments/webhook', function (req, res) {
  var body = req.body;
  var paymentId = body.payment_id || body.PaymentId || '';

  if (paymentId) {
    var order = db.prepare('SELECT * FROM orders WHERE payment_id = ?').get(String(paymentId));
    if (order && !order.is_paid) {
      db.prepare('UPDATE orders SET is_paid = 1, paid_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?')
        .run('Оплачен', order.id);
    }
  }

  res.json({ ok: true });
});

// ============================================================
// ADMIN: Auth
// ============================================================

app.post('/api/admin/login', function (req, res) {
  var login = req.body.login;
  var password = req.body.password;
  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    var token = crypto.randomBytes(32).toString('hex');
    adminTokens.add(token);
    return res.json({ token: token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/admin/logout', adminAuth, function (req, res) {
  var token = req.headers['x-admin-token'];
  adminTokens.delete(token);
  res.json({ ok: true });
});

app.post('/api/admin/telegram-login', function (req, res) {
  var telegramId = String(req.body.telegram_id || '');
  if (!telegramId) {
    return res.status(400).json({ error: 'telegram_id required' });
  }
  if (!ADMIN_TELEGRAM_IDS.includes(telegramId)) {
    return res.status(403).json({ error: 'Not an admin' });
  }
  var token = crypto.randomBytes(32).toString('hex');
  adminTokens.add(token);
  res.json({ token: token });
});

app.get('/api/user/is-admin', function (req, res) {
  var telegramId = String(req.query.telegram_id || '');
  var isAdmin = ADMIN_TELEGRAM_IDS.includes(telegramId);
  res.json({ is_admin: isAdmin });
});

// ============================================================
// ADMIN: Orders
// ============================================================

app.get('/api/admin/orders', adminAuth, function (req, res) {
  var status = req.query.status;
  var sql = 'SELECT * FROM orders';
  var params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  var orders = params.length ? db.prepare(sql).all(params[0]) : db.prepare(sql).all();

  orders.forEach(function (o) {
    o.items = db.prepare(
      'SELECT oi.*, p.name as product_name, p.image_url FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?'
    ).all(o.id);
  });

  res.json(orders);
});

app.post('/api/admin/orders/:id/status', adminAuth, function (req, res) {
  var validStatuses = ['Новый', 'Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Доставлен'];
  var newStatus = req.body.status;
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, req.params.id);
  res.json({ ok: true });
});

// ============================================================
// ADMIN: Categories CRUD
// ============================================================

app.get('/api/admin/categories', adminAuth, function (req, res) {
  res.json(db.prepare('SELECT * FROM categories').all());
});

app.post('/api/admin/categories', adminAuth, function (req, res) {
  var name = req.body.name;
  if (!name) return res.status(400).json({ error: 'Name required' });
  var info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
  res.json({ id: info.lastInsertRowid, name: name });
});

app.put('/api/admin/categories/:id', adminAuth, function (req, res) {
  var name = req.body.name;
  if (!name) return res.status(400).json({ error: 'Name required' });
  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/categories/:id', adminAuth, function (req, res) {
  var products = db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ?').get(req.params.id);
  if (products.c > 0) {
    return res.status(400).json({ error: 'Category has products. Remove them first.' });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// ADMIN: Products CRUD
// ============================================================

app.get('/api/admin/products', adminAuth, function (req, res) {
  var products = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC').all();
  res.json(attachImages(products));
});

app.post('/api/admin/products', adminAuth, upload.array('images', 10), function (req, res) {
  var b = req.body;
  if (!b.name || !b.price || !b.category_id) {
    return res.status(400).json({ error: 'name, price, category_id required' });
  }
  var mainImage = '';
  if (req.files && req.files.length) {
    mainImage = '/images/' + req.files[0].filename;
  } else if (b.image_url) {
    mainImage = b.image_url;
  }
  var info = db.prepare(
    'INSERT INTO products (category_id, name, description, price, image_url, is_bouquet, flower_min, flower_max, flower_step, price_per_flower) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(parseInt(b.category_id), b.name, b.description || '', parseInt(b.price), mainImage,
    parseInt(b.is_bouquet) || 0, parseInt(b.flower_min) || 0, parseInt(b.flower_max) || 0,
    parseInt(b.flower_step) || 1, parseInt(b.price_per_flower) || 0);

  var productId = info.lastInsertRowid;
  if (req.files && req.files.length) {
    var insertImg = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?,?,?)');
    req.files.forEach(function (f, idx) {
      insertImg.run(productId, '/images/' + f.filename, idx);
    });
    db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run('/images/' + req.files[0].filename, productId);
  }
  res.json({ id: productId });
});

app.put('/api/admin/products/:id', adminAuth, upload.array('images', 10), function (req, res) {
  var b = req.body;
  var product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });

  db.prepare(
    'UPDATE products SET category_id=?, name=?, description=?, price=?, is_bouquet=?, flower_min=?, flower_max=?, flower_step=?, price_per_flower=? WHERE id=?'
  ).run(
    parseInt(b.category_id || product.category_id),
    b.name || product.name,
    b.description !== undefined ? b.description : product.description,
    parseInt(b.price || product.price),
    b.is_bouquet !== undefined ? parseInt(b.is_bouquet) : product.is_bouquet,
    b.flower_min !== undefined ? parseInt(b.flower_min) : product.flower_min,
    b.flower_max !== undefined ? parseInt(b.flower_max) : product.flower_max,
    b.flower_step !== undefined ? parseInt(b.flower_step) : product.flower_step,
    b.price_per_flower !== undefined ? parseInt(b.price_per_flower) : product.price_per_flower,
    req.params.id
  );

  if (req.files && req.files.length) {
    var insertImg = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?,?,?)');
    var maxSort = db.prepare('SELECT COALESCE(MAX(sort_order),0) as ms FROM product_images WHERE product_id = ?').get(req.params.id);
    var startSort = (maxSort ? maxSort.ms : 0) + 1;
    req.files.forEach(function (f, idx) {
      insertImg.run(req.params.id, '/images/' + f.filename, startSort + idx);
    });
    var first = db.prepare('SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1').get(req.params.id);
    if (first) {
      db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(first.image_url, req.params.id);
    }
  }
  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', adminAuth, function (req, res) {
  db.prepare('DELETE FROM product_images WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/product-images/:imgId', adminAuth, function (req, res) {
  var img = db.prepare('SELECT * FROM product_images WHERE id = ?').get(req.params.imgId);
  if (!img) return res.status(404).json({ error: 'Image not found' });
  db.prepare('DELETE FROM product_images WHERE id = ?').run(req.params.imgId);
  var first = db.prepare('SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1').get(img.product_id);
  db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(first ? first.image_url : '', img.product_id);
  res.json({ ok: true });
});

// ============================================================
// ADMIN: Settings
// ============================================================

app.get('/api/admin/settings', adminAuth, function (req, res) {
  res.json(getAllSettings());
});

app.post('/api/admin/settings', adminAuth, function (req, res) {
  var entries = req.body;
  var upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  var run = db.transaction(function () {
    Object.entries(entries).forEach(function (pair) {
      upsert.run(pair[0], String(pair[1]));
    });
  });
  run();
  res.json({ ok: true });
});

// ============================================================
// SERVE ADMIN PAGE
// ============================================================

app.get('/admin', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/*', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============================================================
// SPA FALLBACK
// ============================================================

app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, function () {
  console.log('Server running on http://localhost:' + PORT);
});
