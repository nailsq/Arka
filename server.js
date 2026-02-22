require('dotenv').config();
var express = require('express');
var path = require('path');
var crypto = require('crypto');
var multer = require('multer');
var backup = require('./backup');
var db = require('./database');
var gsheets = require('./google-sheets');

var app = express();
var PORT = process.env.PORT || 3000;

var ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
var BOT_TOKEN = process.env.BOT_TOKEN || '';
var PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'test';
var PUBLIC_URL = process.env.PUBLIC_URL || ('http://localhost:' + PORT);
var ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

var TOCHKA_API_URL = process.env.TOCHKA_API_URL || 'https://enter.tochka.com/sandbox/v2';
var TOCHKA_JWT = process.env.TOCHKA_JWT || 'sandbox.jwt.token';
var TOCHKA_CUSTOMER_CODE = process.env.TOCHKA_CUSTOMER_CODE || '';
var TOCHKA_MERCHANT_ID = process.env.TOCHKA_MERCHANT_ID || '';
var TOCHKA_CLIENT_ID = process.env.TOCHKA_CLIENT_ID || '';

var adminTokens = new Set();

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

var https = require('https');

app.use(express.json());
app.use(express.text({ type: 'text/plain' }));
app.use(express.static(path.join(__dirname, 'public')));

function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' || !chatId) return;
  var data = JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' });
  var options = {
    hostname: 'api.telegram.org',
    path: '/bot' + BOT_TOKEN + '/sendMessage',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  };
  var req = https.request(options);
  req.on('error', function (err) { console.error('[TG Notify] Error:', err.message); });
  req.write(data);
  req.end();
}

// ============================================================
// HELPERS
// ============================================================

async function getSetting(key) {
  var row = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

async function getAllSettings() {
  var rows = await db.prepare('SELECT key, value FROM settings').all();
  var result = {};
  rows.forEach(function (r) { result[r.key] = r.value; });
  return result;
}

function validateTelegramInitData(initData) {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return null;
  try {
    var params = new URLSearchParams(initData);
    var hash = params.get('hash');
    params.delete('hash');
    var entries = [];
    params.forEach(function (v, k) { entries.push(k + '=' + v); });
    entries.sort();
    var dataCheckString = entries.join('\n');
    var secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    var computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computed === hash) {
      var userStr = params.get('user');
      return userStr ? JSON.parse(userStr) : null;
    }
  } catch (e) { /* validation failed */ }
  return null;
}

function adminAuth(req, res, next) {
  var token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

async function isAdminUser(telegramId, username) {
  if (ADMIN_TELEGRAM_IDS.includes(String(telegramId))) return true;
  if (telegramId) {
    var byId = await db.prepare('SELECT id FROM admin_users WHERE telegram_id = ?').get(String(telegramId));
    if (byId) return true;
  }
  if (username) {
    var clean = username.replace(/^@/, '').toLowerCase();
    var byName = await db.prepare('SELECT id FROM admin_users WHERE LOWER(telegram_username) = ?').get(clean);
    if (byName) return true;
  }
  return false;
}

function isSuperAdmin(telegramId) {
  return ADMIN_TELEGRAM_IDS.includes(String(telegramId));
}

function superAdminAuth(req, res, next) {
  var token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  var telegramId = req.headers['x-telegram-id'] || '';
  if (!isSuperAdmin(telegramId)) {
    return res.status(403).json({ error: 'Super admin only' });
  }
  next();
}

// ============================================================
// IMAGE SERVING FROM DATABASE
// ============================================================

app.get('/api/images/:id', async function (req, res) {
  try {
    var img = await db.prepare('SELECT image_data FROM product_images WHERE id = ?').get(req.params.id);
    if (!img || !img.image_data) return res.status(404).send('Not found');
    var match = img.image_data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(404).send('Invalid');
    res.set('Content-Type', match[1]);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(match[2], 'base64'));
  } catch (err) {
    res.status(500).send('Error');
  }
});

// ============================================================
// PUBLIC API: Categories & Products
// ============================================================

app.get('/api/cities', async function (req, res) {
  res.json(await db.prepare('SELECT * FROM cities WHERE is_active = 1').all());
});

app.get('/api/categories', async function (req, res) {
  res.json(await db.prepare('SELECT * FROM categories').all());
});

async function attachImages(products) {
  if (!products || !products.length) return products;
  var ids = products.map(function (p) { return p.id; });
  var placeholders = ids.map(function () { return '?'; }).join(',');
  var imgs = await db.prepare('SELECT id, product_id, image_url, sort_order FROM product_images WHERE product_id IN (' + placeholders + ') ORDER BY sort_order, id').all.apply(null, ids);
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

async function attachImagesOne(p) {
  if (!p) return p;
  p.images = await db.prepare('SELECT id, product_id, image_url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id').all(p.id);
  if (!p.images.length && p.image_url) {
    p.images = [{ id: 0, product_id: p.id, image_url: p.image_url, sort_order: 0 }];
  }
  return p;
}

var SIZE_ORDER = { 'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5, 'XXXL': 6 };

function sizeSortKey(label) {
  var upper = (label || '').trim().toUpperCase();
  return SIZE_ORDER.hasOwnProperty(upper) ? SIZE_ORDER[upper] : 100;
}

function sortSizes(arr) {
  return arr.slice().sort(function (a, b) {
    var ka = sizeSortKey(a.label);
    var kb = sizeSortKey(b.label);
    if (ka !== kb) return ka - kb;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

async function attachSizes(products) {
  if (!products || !products.length) return products;
  var ids = products.map(function (p) { return p.id; });
  var placeholders = ids.map(function () { return '?'; }).join(',');
  var sizes = await db.prepare('SELECT * FROM product_sizes WHERE product_id IN (' + placeholders + ') ORDER BY sort_order, id').all.apply(null, ids);
  var map = {};
  sizes.forEach(function (s) {
    if (!map[s.product_id]) map[s.product_id] = [];
    map[s.product_id].push(s);
  });
  products.forEach(function (p) {
    p.sizes = sortSizes(map[p.id] || []);
  });
  return products;
}

async function attachSizesOne(p) {
  if (!p) return p;
  p.sizes = await db.prepare('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order, id').all(p.id);
  p.sizes = sortSizes(p.sizes);
  return p;
}

app.get('/api/products', async function (req, res) {
  var cid = req.query.category_id;
  var products;
  if (!cid) {
    products = await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.hidden = 0').all();
  } else {
    products = await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.category_id = ? AND p.hidden = 0').all(cid);
  }
  products = await attachImages(products);
  products = await attachSizes(products);
  res.json(products);
});

app.get('/api/products/:id', async function (req, res) {
  var p = await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  await attachImagesOne(p);
  await attachSizesOne(p);
  res.json(p);
});

// ============================================================
// PUBLIC API: Settings
// ============================================================

app.get('/api/settings', async function (req, res) {
  res.json(await getAllSettings());
});

// ============================================================
// AUTH: Telegram
// ============================================================

app.post('/api/auth/telegram', async function (req, res) {
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

  var existing = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (existing) {
    if (firstName && firstName !== existing.first_name) {
      await db.prepare('UPDATE users SET first_name = ? WHERE id = ?').run(firstName, existing.id);
      existing.first_name = firstName;
    }
    return res.json({ user: existing });
  }

  var info = await db.prepare('INSERT INTO users (telegram_id, first_name) VALUES (?, ?)').run(String(telegramId), firstName);
  var user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ user: user });
});

// ============================================================
// USER: Update profile
// ============================================================

app.post('/api/user/update', async function (req, res) {
  var telegramId = req.body.telegram_id;
  if (!telegramId) return res.status(400).json({ error: 'telegram_id required' });
  var user = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (!user) return res.status(404).json({ error: 'User not found' });

  var phone = req.body.phone;
  var address = req.body.default_address;
  if (phone !== undefined) await db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, user.id);
  if (address !== undefined) await db.prepare('UPDATE users SET default_address = ? WHERE id = ?').run(address, user.id);

  var updated = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: updated });
});

// ============================================================
// USER: Saved addresses
// ============================================================

app.get('/api/user/addresses', async function (req, res) {
  var telegramId = req.query.telegram_id;
  if (!telegramId) return res.json([]);
  var user = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (!user) return res.json([]);
  var addresses = await db.prepare('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  res.json(addresses);
});

app.post('/api/user/addresses', async function (req, res) {
  var telegramId = req.body.telegram_id;
  if (!telegramId) return res.status(400).json({ error: 'telegram_id required' });
  var user = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (!user) return res.status(404).json({ error: 'User not found' });
  var b = req.body;
  var fullAddr = (b.city || '') + ', ' + (b.district || '') + ', ' + (b.street || '') + ', кв./оф. ' + (b.apartment || '') + (b.note ? ', ' + b.note : '');
  var r = await db.prepare('INSERT INTO user_addresses (user_id, label, city, district, street, apartment, note, full_address) VALUES (?,?,?,?,?,?,?,?)').run(
    user.id, b.label || '', b.city || '', b.district || '', b.street || '', b.apartment || '', b.note || '', fullAddr
  );
  res.json({ id: Number(r.lastInsertRowid), full_address: fullAddr });
});

app.delete('/api/user/addresses/:id', async function (req, res) {
  await db.prepare('DELETE FROM user_addresses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// USER: Order history
// ============================================================

app.get('/api/user/orders', async function (req, res) {
  var telegramId = req.query.telegram_id;
  if (!telegramId) return res.status(400).json({ error: 'telegram_id required' });
  var user = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  console.log('[UserOrders] telegram_id=' + telegramId + ', user=' + (user ? 'id=' + user.id : 'NOT FOUND'));
  if (!user) return res.json([]);

  var orders = await db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  console.log('[UserOrders] Found ' + orders.length + ' orders for user_id=' + user.id);

  for (var i = 0; i < orders.length; i++) {
    orders[i].items = await db.prepare(
      'SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?'
    ).all(orders[i].id);
  }

  res.json(orders);
});

// ============================================================
// PUBLIC API: Abandoned cart
// ============================================================

var _recentAbandoned = {};

app.post('/api/abandoned-cart', async function (req, res) {
  var body = req.body;
  var userId = String(body.user_id || '');
  if (!userId) return res.json({ ok: true });

  var now = Date.now();
  if (_recentAbandoned[userId] && now - _recentAbandoned[userId] < 15 * 60 * 1000) {
    return res.json({ ok: true });
  }
  _recentAbandoned[userId] = now;

  var cart = body.cart || [];
  if (!cart.length) return res.json({ ok: true });

  gsheets.appendAbandonedCart({
    user_id: userId,
    username: body.username ? '@' + body.username : null,
    phone: body.phone || '',
    cart: cart,
    total: body.total || 0
  });

  res.json({ ok: true });
});

// ============================================================
// PUBLIC API: Create order
// ============================================================

app.post('/api/orders', async function (req, res) {
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
    var tgId = String(body.telegram_id);
    var user = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(tgId);
    if (!user) {
      var newUser = await db.prepare('INSERT INTO users (telegram_id, first_name) VALUES (?, ?)').run(tgId, userName);
      userId = Number(newUser.lastInsertRowid);
      console.log('[Order] Auto-created user id=' + userId + ' for telegram_id=' + tgId);
    } else {
      userId = user.id;
    }
    console.log('[Order] telegram_id=' + tgId + ', userId=' + userId);
  } else {
    console.log('[Order] No telegram_id provided, order will be anonymous');
  }

  var cityId = null;
  if (body.city_id) {
    var cityRow = await db.prepare('SELECT id FROM cities WHERE id = ?').get(body.city_id);
    if (cityRow) cityId = cityRow.id;
  }

  try {
    var r = await db.prepare(
      'INSERT INTO orders (user_id, city_id, user_name, user_phone, user_email, user_telegram, receiver_name, receiver_phone, delivery_address, delivery_type, delivery_zone, delivery_cost, delivery_interval, delivery_date, exact_time, comment, total_amount, delivery_distance, status_updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)'
    ).run(
      userId,
      cityId,
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
      totalAmount,
      parseFloat(body.delivery_distance) || 0
    );
    var orderId = Number(r.lastInsertRowid);

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      await db.prepare(
        'INSERT INTO order_items (order_id, product_id, quantity, price, flower_count, size_label) VALUES (?,?,?,?,?,?)'
      ).run(orderId, item.product_id, item.quantity, item.price, item.flower_count || 0, item.size_label || '');
    }

    res.json({ success: true, order_id: orderId, total_amount: totalAmount });

    try {
      var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      var orderItems = await db.prepare(
        'SELECT oi.*, p.name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?'
      ).all(orderId);
      gsheets.appendOrder(order, orderItems);
    } catch (gsErr) {
      console.error('Google Sheets export error:', gsErr.message);
    }
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Order creation failed: ' + err.message });
  }
});

// ============================================================
// PAYMENT
// ============================================================

app.post('/api/payments/create', async function (req, res) {
  var orderId = req.body.order_id;
  if (!orderId) return res.status(400).json({ error: 'order_id required' });

  var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (PAYMENT_PROVIDER === 'test') {
    var paymentId = 'pay_' + Date.now() + '_' + orderId;
    await db.prepare('UPDATE orders SET payment_id = ? WHERE id = ?').run(paymentId, orderId);
    var baseUrl = PUBLIC_URL !== 'http://localhost:3000' ? PUBLIC_URL : (req.protocol + '://' + req.get('host'));
    var confirmUrl = baseUrl + '/api/payments/test-complete/' + orderId + '?payment_id=' + paymentId;
    return res.json({ payment_id: paymentId, payment_url: confirmUrl, provider: 'test' });
  }

  if (PAYMENT_PROVIDER === 'tochka') {
    try {
      var orderItems = await db.prepare(
        'SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?'
      ).all(orderId);

      var receiptItems = [];
      orderItems.forEach(function (item) {
        if (item.price > 0) {
          receiptItems.push({
            name: item.product_name || 'Товар',
            quantity: item.quantity,
            amount: item.price,
            paymentMethod: 'full_payment',
            paymentObject: 'goods',
            vatType: 'none'
          });
        }
      });

      if (order.delivery_cost && order.delivery_cost > 0) {
        receiptItems.push({
          name: 'Доставка',
          quantity: 1,
          amount: order.delivery_cost,
          paymentMethod: 'full_payment',
          paymentObject: 'service',
          vatType: 'none'
        });
      }

      var basePublicUrl = PUBLIC_URL.replace(/^http:\/\//, 'https://');
      var redirectUrl = basePublicUrl + '/api/payments/tochka-success/' + orderId;

      var tochkaBody = {
        Data: {
          customerCode: TOCHKA_CUSTOMER_CODE,
          amount: order.total_amount,
          purpose: 'Оплата заказа №' + orderId,
          paymentMode: ['sbp', 'card', 'tinkoff'],
          redirectUrl: redirectUrl,
          ttl: 60,
          paymentLinkId: String(orderId),
          Client: {
            email: order.user_email || undefined
          },
          Items: receiptItems
        }
      };

      if (TOCHKA_MERCHANT_ID) {
        tochkaBody.Data.merchantId = TOCHKA_MERCHANT_ID;
      }

      console.log('[Tochka] Creating payment for order #' + orderId + ', amount=' + order.total_amount);

      var tochkaUrl = TOCHKA_API_URL + '/acquiring/v1.0/payments_with_receipt';
      var response = await fetch(tochkaUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + TOCHKA_JWT,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tochkaBody)
      });

      var result = await response.json();
      console.log('[Tochka] Response status=' + response.status, JSON.stringify(result).substring(0, 500));

      if (!response.ok) {
        console.error('[Tochka] Error:', JSON.stringify(result));
        return res.status(502).json({ error: 'Payment service error', details: result });
      }

      var data = result.Data || result.data || result;
      var paymentLink = data.paymentLink || data.PaymentLink || data.payment_link || '';
      var operationId = data.operationId || data.OperationId || data.operation_id || '';

      if (!paymentLink) {
        console.error('[Tochka] No paymentLink in response:', JSON.stringify(result));
        return res.status(502).json({ error: 'No payment link received' });
      }

      await db.prepare('UPDATE orders SET payment_id = ? WHERE id = ?').run(String(operationId || paymentLink), orderId);

      return res.json({
        payment_id: operationId,
        payment_url: paymentLink,
        provider: 'tochka'
      });
    } catch (err) {
      console.error('[Tochka] Exception:', err.message);
      return res.status(500).json({ error: 'Payment creation failed: ' + err.message });
    }
  }

  res.status(400).json({ error: 'Unknown payment provider: ' + PAYMENT_PROVIDER });
});

app.get('/api/payments/test-complete/:orderId', async function (req, res) {
  var orderId = req.params.orderId;
  var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).send('Order not found');

  await db.prepare('UPDATE orders SET is_paid = 1, paid_at = CURRENT_TIMESTAMP, status = ?, status_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('Оплачен', orderId);

  res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Оплата</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#000}div{text-align:center;border:1px solid #000;padding:40px}a{display:inline-block;margin-top:20px;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px}</style></head><body><div><p>Оплата прошла успешно</p><p>Заказ N ' + orderId + '</p><p>Статус заказа обновлен на "Оплачен"</p><a href="/">Вернуться в магазин</a></div></body></html>');
});

app.get('/api/payments/tochka-success/:orderId', async function (req, res) {
  var orderId = req.params.orderId;
  var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).send('Заказ не найден');

  if (!order.is_paid) {
    await db.prepare('UPDATE orders SET is_paid = 1, paid_at = CURRENT_TIMESTAMP, status = ?, status_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Оплачен', orderId);
    console.log('[Tochka] Order #' + orderId + ' marked as paid via redirect');

    if (BOT_TOKEN && order.user_id) {
      try {
        var u = await db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(order.user_id);
        if (u && u.telegram_id) {
          sendTelegramMessage(u.telegram_id, 'Ваш заказ №' + orderId + ' успешно оплачен! Сумма: ' + order.total_amount + ' ₽');
        }
      } catch (e) {}
    }
  }

  res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Оплата</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#000}div{text-align:center;padding:40px;max-width:400px}h2{margin-bottom:16px}p{color:#555;margin-bottom:24px}a{display:inline-block;padding:14px 28px;background:#000;color:#fff;text-decoration:none;border-radius:10px;font-size:15px}</style></head><body><div><h2>Оплата прошла успешно!</h2><p>Заказ №' + orderId + ' уже в работе. Спасибо, что выбрали нас!</p><a href="/">Вернуться в магазин</a></div></body></html>');
});

app.post('/api/payments/webhook', async function (req, res) {
  var body = req.body;
  console.log('[Webhook] Received, content-type:', req.headers['content-type'], ', body type:', typeof body);

  try {
    var jwtPayload = null;

    var tokenStr = (typeof body === 'string') ? body.trim() : '';

    if (!tokenStr && body && typeof body === 'object') {
      tokenStr = body.token || body.jwt || '';
    }

    if (tokenStr && tokenStr.split('.').length === 3) {
      var parts = tokenStr.split('.');
      var payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      jwtPayload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));
      console.log('[Webhook] Decoded JWT payload:', JSON.stringify(jwtPayload).substring(0, 500));
    }

    if (!jwtPayload && typeof body === 'object') {
      jwtPayload = body.Data || body.data || body;
    }

    if (jwtPayload) {
      var opId = jwtPayload.operationId || jwtPayload.OperationId || jwtPayload.operation_id || '';
      var status = jwtPayload.status || jwtPayload.Status || '';

      console.log('[Webhook] operationId=' + opId + ', status=' + status);

      if (opId && (status === 'APPROVED' || status === 'approved')) {
        var order = await db.prepare('SELECT * FROM orders WHERE payment_id = ?').get(String(opId));
        if (order && !order.is_paid) {
          await db.prepare('UPDATE orders SET is_paid = 1, paid_at = CURRENT_TIMESTAMP, status = ?, status_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run('Оплачен', order.id);
          console.log('[Webhook] Order #' + order.id + ' marked as paid');

          if (BOT_TOKEN && order.user_id) {
            try {
              var u = await db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(order.user_id);
              if (u && u.telegram_id) {
                sendTelegramMessage(u.telegram_id, 'Ваш заказ №' + order.id + ' успешно оплачен! Сумма: ' + order.total_amount + ' ₽');
              }
            } catch (e) {}
          }
        }
      }
    }
  } catch (err) {
    console.error('[Webhook] Error:', err.message);
  }

  res.status(200).send('OK');
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

app.post('/api/admin/telegram-login', async function (req, res) {
  var telegramId = String(req.body.telegram_id || '');
  var username = String(req.body.username || '');
  if (!telegramId) {
    return res.status(400).json({ error: 'telegram_id required' });
  }
  var isAdmin = await isAdminUser(telegramId, username);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Not an admin' });
  }
  if (username) {
    var clean = username.replace(/^@/, '').toLowerCase();
    var row = await db.prepare('SELECT id FROM admin_users WHERE LOWER(telegram_username) = ?').get(clean);
    if (row) {
      await db.prepare('UPDATE admin_users SET telegram_id = ? WHERE id = ?').run(String(telegramId), row.id);
    }
  }
  var canDelete = false;
  if (!isSuperAdmin(telegramId)) {
    var clean2 = (username || '').replace(/^@/, '').toLowerCase();
    var adminRow = await db.prepare('SELECT can_delete_orders FROM admin_users WHERE telegram_id = ? OR LOWER(telegram_username) = ?').get(String(telegramId), clean2);
    if (adminRow) canDelete = !!adminRow.can_delete_orders;
  } else {
    canDelete = true;
  }
  var token = crypto.randomBytes(32).toString('hex');
  adminTokens.add(token);
  res.json({ token: token, is_super_admin: isSuperAdmin(telegramId), can_delete_orders: canDelete });
});

app.get('/api/user/is-admin', async function (req, res) {
  var telegramId = String(req.query.telegram_id || '');
  var username = String(req.query.username || '');
  var admin = await isAdminUser(telegramId, username);
  var superAdmin = isSuperAdmin(telegramId);
  res.json({ is_admin: admin, is_super_admin: superAdmin });
});

// ============================================================
// ADMIN: Orders
// ============================================================

app.get('/api/admin/orders', adminAuth, async function (req, res) {
  var status = req.query.status;
  var search = (req.query.search || '').trim();
  var sql = 'SELECT * FROM orders';
  var conditions = [];
  var params = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(CAST(id AS TEXT) LIKE ? OR user_phone LIKE ? OR receiver_phone LIKE ?)');
    var like = '%' + search + '%';
    params.push(like, like, like);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  var stmt = await db.prepare(sql);
  var orders = params.length ? await stmt.all.apply(stmt, params) : await stmt.all();

  for (var i = 0; i < orders.length; i++) {
    orders[i].items = await db.prepare(
      'SELECT oi.*, p.name as product_name, p.image_url FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?'
    ).all(orders[i].id);
  }

  res.json(orders);
});

app.post('/api/admin/orders/:id/status', adminAuth, async function (req, res) {
  var validStatuses = ['Новый', 'Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Доставлен', 'Готов к выдаче', 'Выполнен'];
  var newStatus = req.body.status;
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await db.prepare('UPDATE orders SET status = ?, status_updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, req.params.id);
  res.json({ ok: true });

  try {
    var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (order && order.user_id) {
      var u = await db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(order.user_id);
      if (u && u.telegram_id) {
        var statusEmoji = {
          'Новый': '🆕', 'Оплачен': '✅', 'Собирается': '💐',
          'Собран': '📦', 'Отправлен': '🚗', 'Доставлен': '🎉',
          'Готов к выдаче': '🏪', 'Выполнен': '✔️'
        };
        var emoji = statusEmoji[newStatus] || '📋';
        var msg = emoji + ' <b>Заказ #' + order.id + '</b>\n\n' +
          'Статус: <b>' + newStatus + '</b>\n';
        if (order.delivery_type === 'pickup') {
          msg += 'Тип: Самовывоз\n';
        } else if (order.delivery_address) {
          msg += 'Адрес: ' + order.delivery_address + '\n';
        }
        if (order.delivery_date) msg += 'Дата: ' + order.delivery_date + '\n';
        msg += 'Сумма: ' + order.total_amount + ' ₽';
        sendTelegramMessage(u.telegram_id, msg);
      }
    }
  } catch (notifErr) {
    console.error('[TG Notify] Status notification error:', notifErr.message);
  }
});

// ============================================================
// ADMIN: Update order fields
// ============================================================

app.put('/api/admin/orders/:id', adminAuth, async function (req, res) {
  var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  var b = req.body;
  var fields = [];
  var params = [];
  var allowedFields = {
    comment: 'TEXT', user_name: 'TEXT', user_phone: 'TEXT', user_email: 'TEXT',
    user_telegram: 'TEXT', receiver_name: 'TEXT', receiver_phone: 'TEXT',
    delivery_address: 'TEXT', delivery_date: 'TEXT', delivery_interval: 'TEXT',
    exact_time: 'TEXT', delivery_cost: 'INT', delivery_type: 'TEXT'
  };

  Object.keys(allowedFields).forEach(function (key) {
    if (b[key] !== undefined) {
      fields.push(key + ' = ?');
      params.push(allowedFields[key] === 'INT' ? parseInt(b[key]) || 0 : String(b[key]));
    }
  });

  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  await db.prepare('UPDATE orders SET ' + fields.join(', ') + ' WHERE id = ?').run.apply(null, params);
  res.json({ ok: true });
});

// ============================================================
// ADMIN: Categories CRUD
// ============================================================

app.get('/api/admin/categories', adminAuth, async function (req, res) {
  res.json(await db.prepare('SELECT * FROM categories').all());
});

app.post('/api/admin/categories', adminAuth, async function (req, res) {
  var name = req.body.name;
  if (!name) return res.status(400).json({ error: 'Name required' });
  var info = await db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
  res.json({ id: info.lastInsertRowid, name: name });
});

app.put('/api/admin/categories/:id', adminAuth, async function (req, res) {
  var name = req.body.name;
  if (!name) return res.status(400).json({ error: 'Name required' });
  await db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/categories/:id', adminAuth, async function (req, res) {
  var products = await db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ?').get(req.params.id);
  if (products.c > 0) {
    return res.status(400).json({ error: 'Category has products. Remove them first.' });
  }
  await db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// ADMIN: Products CRUD
// ============================================================

app.get('/api/admin/products', adminAuth, async function (req, res) {
  var products = await db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC').all();
  products = await attachImages(products);
  products = await attachSizes(products);
  res.json(products);
});

app.post('/api/admin/products', adminAuth, upload.array('images', 10), async function (req, res) {
  var b = req.body;
  if (!b.name || !b.price || !b.category_id) {
    return res.status(400).json({ error: 'name, price, category_id required' });
  }
  var mainImage = b.image_url || '';
  var info = await db.prepare(
    'INSERT INTO products (category_id, name, description, price, image_url, is_bouquet, flower_min, flower_max, flower_step, price_per_flower, in_stock, dimensions) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(parseInt(b.category_id), b.name, b.description || '', parseInt(b.price), mainImage,
    parseInt(b.is_bouquet) || 0, parseInt(b.flower_min) || 0, parseInt(b.flower_max) || 0,
    parseInt(b.flower_step) || 1, parseInt(b.price_per_flower) || 0,
    b.in_stock !== undefined ? parseInt(b.in_stock) : 1,
    b.dimensions || '');

  var productId = Number(info.lastInsertRowid);

  if (req.files && req.files.length) {
    for (var i = 0; i < req.files.length; i++) {
      var f = req.files[i];
      var base64 = 'data:' + f.mimetype + ';base64,' + f.buffer.toString('base64');
      var imgInfo = await db.prepare('INSERT INTO product_images (product_id, image_url, image_data, sort_order) VALUES (?,?,?,?)').run(productId, '', base64, i);
      var imgId = Number(imgInfo.lastInsertRowid);
      await db.prepare('UPDATE product_images SET image_url = ? WHERE id = ?').run('/api/images/' + imgId, imgId);
    }
    var firstImg = await db.prepare('SELECT id FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1').get(productId);
    if (firstImg) {
      await db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run('/api/images/' + firstImg.id, productId);
    }
    backup.backup();
  }
  res.json({ id: productId });
});

app.put('/api/admin/products/:id', adminAuth, upload.array('images', 10), async function (req, res) {
  var b = req.body;
  var product = await db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });

  await db.prepare(
    'UPDATE products SET category_id=?, name=?, description=?, price=?, is_bouquet=?, flower_min=?, flower_max=?, flower_step=?, price_per_flower=?, in_stock=?, hidden=?, dimensions=?, is_recommended=? WHERE id=?'
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
    b.in_stock !== undefined ? parseInt(b.in_stock) : product.in_stock,
    b.hidden !== undefined ? parseInt(b.hidden) : product.hidden,
    b.dimensions !== undefined ? b.dimensions : (product.dimensions || ''),
    b.is_recommended !== undefined ? parseInt(b.is_recommended) : (product.is_recommended || 0),
    req.params.id
  );

  if (req.files && req.files.length) {
    var maxSort = await db.prepare('SELECT COALESCE(MAX(sort_order),0) as ms FROM product_images WHERE product_id = ?').get(req.params.id);
    var startSort = (maxSort ? maxSort.ms : 0) + 1;
    for (var i = 0; i < req.files.length; i++) {
      var f = req.files[i];
      var base64 = 'data:' + f.mimetype + ';base64,' + f.buffer.toString('base64');
      var imgInfo = await db.prepare('INSERT INTO product_images (product_id, image_url, image_data, sort_order) VALUES (?,?,?,?)').run(req.params.id, '', base64, startSort + i);
      var imgId = Number(imgInfo.lastInsertRowid);
      await db.prepare('UPDATE product_images SET image_url = ? WHERE id = ?').run('/api/images/' + imgId, imgId);
    }
    var first = await db.prepare('SELECT id, image_url FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1').get(req.params.id);
    if (first) {
      await db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(first.image_url, req.params.id);
    }
    backup.backup();
  }
  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', adminAuth, async function (req, res) {
  await db.prepare('DELETE FROM product_images WHERE product_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  backup.backup();
  res.json({ ok: true });
});

app.delete('/api/admin/product-images/:imgId', adminAuth, async function (req, res) {
  var img = await db.prepare('SELECT * FROM product_images WHERE id = ?').get(req.params.imgId);
  if (!img) return res.status(404).json({ error: 'Image not found' });
  await db.prepare('DELETE FROM product_images WHERE id = ?').run(req.params.imgId);
  var first = await db.prepare('SELECT id, image_url FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1').get(img.product_id);
  await db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(first ? first.image_url : '', img.product_id);
  backup.backup();
  res.json({ ok: true });
});

// ============================================================
// ADMIN: Product Sizes
// ============================================================

app.get('/api/admin/product-sizes/:productId', adminAuth, async function (req, res) {
  var sizes = await db.prepare('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order, id').all(req.params.productId);
  res.json(sortSizes(sizes));
});

app.post('/api/admin/product-sizes', adminAuth, async function (req, res) {
  var b = req.body;
  if (!b.product_id || !b.label || !b.price) {
    return res.status(400).json({ error: 'product_id, label, price required' });
  }
  var maxSort = await db.prepare('SELECT COALESCE(MAX(sort_order),0) as ms FROM product_sizes WHERE product_id = ?').get(b.product_id);
  var info = await db.prepare(
    'INSERT INTO product_sizes (product_id, label, flower_count, price, sort_order, dimensions) VALUES (?,?,?,?,?,?)'
  ).run(b.product_id, b.label, parseInt(b.flower_count) || 0, parseInt(b.price), (maxSort ? maxSort.ms : 0) + 1, b.dimensions || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/product-sizes/:id', adminAuth, async function (req, res) {
  var b = req.body;
  await db.prepare(
    'UPDATE product_sizes SET label=?, flower_count=?, price=?, sort_order=?, dimensions=? WHERE id=?'
  ).run(b.label, parseInt(b.flower_count) || 0, parseInt(b.price), parseInt(b.sort_order) || 0, b.dimensions || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/product-sizes/:id', adminAuth, async function (req, res) {
  await db.prepare('DELETE FROM product_sizes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// ADMIN: Settings
// ============================================================

app.get('/api/admin/settings', adminAuth, async function (req, res) {
  res.json(await getAllSettings());
});

app.post('/api/admin/settings', adminAuth, async function (req, res) {
  var entries = req.body;
  var keys = Object.keys(entries);
  for (var i = 0; i < keys.length; i++) {
    await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(keys[i], String(entries[keys[i]]));
  }
  backup.backup();
  res.json({ ok: true });
});

// ============================================================
// ADMIN: Manage admin users (super admin only)
// ============================================================

app.get('/api/admin/admins', adminAuth, async function (req, res) {
  var telegramId = req.headers['x-telegram-id'] || '';
  if (!isSuperAdmin(telegramId)) {
    return res.status(403).json({ error: 'Super admin only' });
  }
  var admins = await db.prepare('SELECT * FROM admin_users ORDER BY created_at DESC').all();
  res.json(admins);
});

app.post('/api/admin/admins', adminAuth, async function (req, res) {
  var telegramId = req.headers['x-telegram-id'] || '';
  if (!isSuperAdmin(telegramId)) {
    return res.status(403).json({ error: 'Super admin only' });
  }
  var username = (req.body.username || '').replace(/^@/, '').trim();
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }
  var existing = await db.prepare('SELECT id FROM admin_users WHERE LOWER(telegram_username) = ?').get(username.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'This user is already an admin' });
  }
  var info = await db.prepare('INSERT INTO admin_users (telegram_username, added_by) VALUES (?, ?)').run(username.toLowerCase(), telegramId);
  res.json({ id: info.lastInsertRowid, username: username });
});

app.delete('/api/admin/admins/:id', adminAuth, async function (req, res) {
  var telegramId = req.headers['x-telegram-id'] || '';
  if (!isSuperAdmin(telegramId)) {
    return res.status(403).json({ error: 'Super admin only' });
  }
  await db.prepare('DELETE FROM admin_users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.put('/api/admin/admins/:id/permissions', adminAuth, async function (req, res) {
  var telegramId = req.headers['x-telegram-id'] || '';
  if (!isSuperAdmin(telegramId)) {
    return res.status(403).json({ error: 'Super admin only' });
  }
  var canDelete = parseInt(req.body.can_delete_orders) ? 1 : 0;
  await db.prepare('UPDATE admin_users SET can_delete_orders = ? WHERE id = ?').run(canDelete, req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/orders/cleanup', adminAuth, async function (req, res) {
  var telegramId = req.headers['x-telegram-id'] || '';
  var months = parseInt(req.body.months) || 6;
  if (months < 1) months = 1;

  var allowed = false;
  if (isSuperAdmin(telegramId)) {
    allowed = true;
  } else {
    var adminRow = await db.prepare(
      'SELECT can_delete_orders FROM admin_users WHERE telegram_id = ?'
    ).get(String(telegramId));
    if (adminRow && adminRow.can_delete_orders) allowed = true;
  }
  if (!allowed) {
    return res.status(403).json({ error: 'Нет прав на удаление заказов' });
  }

  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  var cutoffStr = cutoff.toISOString();

  var completedStatuses = ['Выполнен', 'Доставлен'];
  var oldOrders = await db.prepare(
    "SELECT id FROM orders WHERE status IN ('" + completedStatuses.join("','") + "') AND created_at < ?"
  ).all(cutoffStr);

  var deletedCount = 0;
  for (var i = 0; i < oldOrders.length; i++) {
    await db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oldOrders[i].id);
    await db.prepare('DELETE FROM orders WHERE id = ?').run(oldOrders[i].id);
    deletedCount++;
  }

  res.json({ ok: true, deleted: deletedCount });
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
// HEALTH CHECK
// ============================================================

app.get('/api/health', async function (req, res) {
  try {
    var count = await db.prepare('SELECT COUNT(*) as c FROM products').get();
    res.json({ status: 'ok', products: count.c, time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================
// SPA FALLBACK
// ============================================================

app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// START SERVER (init DB first)
// ============================================================

async function start() {
  await backup.restore();
  await db.init();
  app.listen(PORT, function () {
    console.log('Server running on http://localhost:' + PORT);
    backup.startPeriodicBackup();

    if (PAYMENT_PROVIDER === 'tochka' && TOCHKA_CLIENT_ID && TOCHKA_JWT && PUBLIC_URL) {
      setTimeout(function () { registerTochkaWebhook(); }, 5000);
    }
  });
}

async function registerTochkaWebhook() {
  try {
    var webhookUrl = PUBLIC_URL.replace(/^http:\/\//, 'https://') + '/api/payments/webhook';
    var url = TOCHKA_API_URL + '/webhook/v1.0/' + TOCHKA_CLIENT_ID;

    console.log('[Tochka] Registering webhook: ' + webhookUrl);

    var response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + TOCHKA_JWT,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhooksList: ['acquiringInternetPayment']
      })
    });

    var result = await response.text();
    console.log('[Tochka] Webhook registration status=' + response.status + ', response: ' + result.substring(0, 300));
  } catch (err) {
    console.error('[Tochka] Webhook registration error:', err.message);
  }
}

start().catch(function (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
});
