require('dotenv').config();
var express = require('express');
var fs = require('fs');
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
var BOT_TOKEN = String(process.env.BOT_TOKEN || process.env.CLIENT_BOT_TOKEN || '').trim();
var ADMIN_BOT_TOKEN = String(process.env.ADMIN_BOT_TOKEN || '').trim();
var TELEGRAM_BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
var TELEGRAM_BOT_ID = String(process.env.TELEGRAM_BOT_ID || '').trim();

function isTelegramTokenPlaceholder(t) {
  return !t || t === 'YOUR_BOT_TOKEN_HERE';
}
var PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'test';
var PUBLIC_URL = process.env.PUBLIC_URL || ('http://localhost:' + PORT);
/** Супер-админы (полный доступ + вкладка «Администраторы»): ID в коде объединяются с ADMIN_TELEGRAM_IDS из .env */
var MAIN_ADMIN_TELEGRAM_IDS_HARDCODED = ['6769165941', '6889346649'];
var ADMIN_TELEGRAM_IDS = (function () {
  var fromEnv = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var map = {};
  MAIN_ADMIN_TELEGRAM_IDS_HARDCODED.forEach(function (id) {
    if (id) map[String(id)] = true;
  });
  fromEnv.forEach(function (id) {
    if (id) map[String(id)] = true;
  });
  return Object.keys(map);
})();

var WEB_LOGIN_CHALLENGE_COOKIE = 'arka_web_challenge';

var WEB_SESSION_COOKIE = 'arka_web_session';
var WEB_SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;
var WEB_SESSION_SECRET = String(process.env.WEB_SESSION_SECRET || '').trim();
if (!WEB_SESSION_SECRET) {
  if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    WEB_SESSION_SECRET = crypto.createHash('sha256').update('arka_web_sess_v1|' + BOT_TOKEN).digest('hex');
  } else {
    WEB_SESSION_SECRET = 'arka-flowers-web-dev-session-not-for-production';
  }
}

var TOCHKA_API_URL = process.env.TOCHKA_API_URL || 'https://enter.tochka.com/sandbox/v2';
var TOCHKA_JWT = String(process.env.TOCHKA_JWT || '').trim();
if (!TOCHKA_JWT && process.env.TOCHKA_JWT_FILE) {
  try {
    var jwtPath = String(process.env.TOCHKA_JWT_FILE || '').trim();
    if (jwtPath && fs.existsSync(jwtPath)) {
      TOCHKA_JWT = fs.readFileSync(jwtPath, 'utf8').replace(/^\uFEFF/, '').trim();
    }
  } catch (jwtReadErr) {
    console.error('[Tochka] TOCHKA_JWT_FILE read error:', jwtReadErr.message);
  }
}
if (!TOCHKA_JWT) {
  TOCHKA_JWT = 'sandbox.jwt.token';
}
var TOCHKA_CUSTOMER_CODE = process.env.TOCHKA_CUSTOMER_CODE || '';
var TOCHKA_MERCHANT_ID = process.env.TOCHKA_MERCHANT_ID || '';
var TOCHKA_CLIENT_ID = process.env.TOCHKA_CLIENT_ID || '';
var TOCHKA_FALLBACK_EMAIL = process.env.TOCHKA_FALLBACK_EMAIL || 'no-reply@shoparkaflowers.ru';

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

var resolveBotUsernamePromise = null;
/** Подставляет username и bot_id из getMe, если их нет в .env (нужен BOT_TOKEN). */
function resolveTelegramBotUsernameFromApi() {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return Promise.resolve();
  if (TELEGRAM_BOT_USERNAME && TELEGRAM_BOT_ID) return Promise.resolve();
  if (resolveBotUsernamePromise) return resolveBotUsernamePromise;
  resolveBotUsernamePromise = new Promise(function (resolve) {
    var opt = {
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/getMe',
      method: 'GET'
    };
    var req = https.request(opt, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        try {
          var j = JSON.parse(Buffer.concat(chunks).toString());
          if (j.ok && j.result) {
            if (j.result.username && !TELEGRAM_BOT_USERNAME) {
              TELEGRAM_BOT_USERNAME = String(j.result.username).replace(/^@/, '').trim();
              console.log('[TG] Имя бота для сайта (getMe): @' + TELEGRAM_BOT_USERNAME);
            }
            if (j.result.id != null && j.result.id !== '' && !TELEGRAM_BOT_ID) {
              TELEGRAM_BOT_ID = String(j.result.id);
            }
            if (!TELEGRAM_BOT_USERNAME) {
              console.warn('[TG] getMe: нет username. Задайте TELEGRAM_BOT_USERNAME в .env');
            }
          } else {
            console.warn('[TG] getMe не удался:', j && j.description ? j.description : JSON.stringify(j).slice(0, 200));
            console.warn('[TG] Проверьте BOT_TOKEN в .env на этом сервере или задайте TELEGRAM_BOT_USERNAME вручную.');
          }
        } catch (e) {
          console.error('[TG] getMe parse error:', e.message);
        }
        if (!TELEGRAM_BOT_USERNAME) resolveBotUsernamePromise = null;
        resolve();
      });
    });
    req.on('error', function (err) {
      console.error('[TG] getMe error:', err.message);
      resolveBotUsernamePromise = null;
      resolve();
    });
    req.setTimeout(12000, function () {
      req.destroy();
      resolveBotUsernamePromise = null;
      resolve();
    });
    req.end();
  });
  return resolveBotUsernamePromise;
}

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
// TELEGRAM BOT: API helpers
// ============================================================

var adminReplyState = {};

function telegramApiCall(method, body) {
  return new Promise(function (resolve, reject) {
    if (isTelegramTokenPlaceholder(BOT_TOKEN)) return resolve(null);
    var data = JSON.stringify(body);
    var options = {
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/' + method,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    var req = https.request(options, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { resolve(null); }
      });
    });
    req.on('error', function (err) { console.error('[TG API] Error:', err.message); resolve(null); });
    req.write(data);
    req.end();
  });
}

/** Второй бот: уведомления админам (заказы, входящие от клиентов) и callback «Ответить». */
function adminBotApiCall(method, body) {
  return new Promise(function (resolve) {
    if (isTelegramTokenPlaceholder(ADMIN_BOT_TOKEN)) return resolve(null);
    var data = JSON.stringify(body);
    var options = {
      hostname: 'api.telegram.org',
      path: '/bot' + ADMIN_BOT_TOKEN + '/' + method,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    var req = https.request(options, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { resolve(null); }
      });
    });
    req.on('error', function (err) { console.error('[TG Admin API] Error:', err.message); resolve(null); });
    req.write(data);
    req.end();
  });
}

function adminNotifyApiCall() {
  return !isTelegramTokenPlaceholder(ADMIN_BOT_TOKEN) ? adminBotApiCall : telegramApiCall;
}

var BOT_MAIN_KEYBOARD = JSON.stringify({
  keyboard: [
    [{ text: '\u041c\u043e\u0439 \u0437\u0430\u043a\u0430\u0437' }, { text: '\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u043d\u0430\u043c\u0438' }],
    [{ text: '\u041e \u043d\u0430\u0441' }]
  ],
  resize_keyboard: true,
  is_persistent: true
});

var BOT_ADMIN_KEYBOARD = JSON.stringify({
  keyboard: [
    [{ text: '\u041c\u043e\u0439 \u0437\u0430\u043a\u0430\u0437' }, { text: '\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u043d\u0430\u043c\u0438' }],
    [{ text: '\u041e \u043d\u0430\u0441' }],
    [{ text: '\u041d\u043e\u0432\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b' }, { text: '\u0410\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c' }]
  ],
  resize_keyboard: true,
  is_persistent: true
});


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
async function buildPaymentNotification(order) {
  var msg = '<b>Заказ #' + order.id + ' оплачен!</b>\n\n';

  if (order.delivery_type === 'pickup') {
    msg += 'Способ получения: <b>Самовывоз</b>\n';
    var pickupAddr = await getSetting('pickup_address');
    if (pickupAddr) msg += 'Адрес: ' + pickupAddr + '\n';
    if (order.delivery_date) msg += 'Дата: ' + order.delivery_date + '\n';
    if (order.delivery_interval) msg += 'Время: ' + order.delivery_interval + '\n';
  } else {
    msg += 'Способ получения: <b>Доставка</b>\n';
    if (order.delivery_address) msg += 'Адрес: ' + order.delivery_address + '\n';
    if (order.delivery_date) msg += 'Дата: ' + order.delivery_date + '\n';
    if (order.delivery_interval) msg += 'Время: ' + order.delivery_interval + '\n';
  }

  msg += '\nСпасибо, что выбрали нас!';
  return msg;
}

async function notifyAdminsNewOrder(order) {
  if (isTelegramTokenPlaceholder(ADMIN_BOT_TOKEN) && isTelegramTokenPlaceholder(BOT_TOKEN)) return;
  var api = adminNotifyApiCall();
  try {
    var items = await db.prepare(
      'SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?'
    ).all(order.id);

    var msg = '<b>\u041d\u043e\u0432\u044b\u0439 \u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0439 \u0437\u0430\u043a\u0430\u0437 #' + order.id + '</b>\n\n';
    msg += '\u041a\u043b\u0438\u0435\u043d\u0442: ' + (order.user_name || '-') + '\n';
    msg += '\u0422\u0435\u043b\u0435\u0444\u043e\u043d: ' + (order.user_phone || '-') + '\n';
    if (order.delivery_type === 'pickup') {
      msg += '\u0422\u0438\u043f: \u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437\n';
    } else {
      msg += '\u0422\u0438\u043f: \u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430\n';
      if (order.delivery_address) msg += '\u0410\u0434\u0440\u0435\u0441: ' + order.delivery_address + '\n';
    }
    if (order.delivery_date) msg += '\u0414\u0430\u0442\u0430: ' + order.delivery_date + '\n';
    if (order.delivery_interval) msg += '\u0412\u0440\u0435\u043c\u044f: ' + order.delivery_interval + '\n';
    msg += '\u0421\u0443\u043c\u043c\u0430: ' + order.total_amount + ' \u0440\u0443\u0431.\n';

    if (items.length) {
      msg += '\n\u0422\u043e\u0432\u0430\u0440\u044b:\n';
      for (var i = 0; i < items.length; i++) {
        msg += '  ' + (items[i].product_name || '\u0422\u043e\u0432\u0430\u0440') + ' x' + items[i].quantity + ' \u2014 ' + items[i].price + ' \u0440\u0443\u0431.\n';
      }
    }

    var adminUrl = PUBLIC_URL.replace(/^http:\/\//, 'https://') + '/admin?order=' + order.id;
    var btns = [[{ text: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0437\u0430\u043a\u0430\u0437', url: adminUrl }]];

    for (var a = 0; a < ADMIN_TELEGRAM_IDS.length; a++) {
      await api('sendMessage', {
        chat_id: ADMIN_TELEGRAM_IDS[a],
        text: msg,
        parse_mode: 'HTML',
        reply_markup: JSON.stringify({ inline_keyboard: btns })
      });
    }

    var dbAdmins = await db.prepare('SELECT telegram_id FROM admin_users WHERE telegram_id IS NOT NULL').all();
    for (var d = 0; d < dbAdmins.length; d++) {
      if (!ADMIN_TELEGRAM_IDS.includes(dbAdmins[d].telegram_id)) {
        await api('sendMessage', {
          chat_id: dbAdmins[d].telegram_id,
          text: msg,
          parse_mode: 'HTML',
          reply_markup: JSON.stringify({ inline_keyboard: btns })
        });
      }
    }
    console.log('[TG] Admin order notification sent for #' + order.id + (isTelegramTokenPlaceholder(ADMIN_BOT_TOKEN) ? ' (client bot)' : ' (admin bot)'));
  } catch (err) {
    console.error('[TG Bot] Admin notification error:', err.message);
  }
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

/** Telegram Login Widget (website) — https://core.telegram.org/widgets/login#checking-authorization */
function validateTelegramLoginWidget(body) {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return null;
  if (!body || !body.hash) return null;
  var hash = String(body.hash);
  var pairs = [];
  Object.keys(body).sort().forEach(function (k) {
    if (k === 'hash') return;
    if (body[k] === undefined || body[k] === null) return;
    pairs.push(k + '=' + body[k]);
  });
  var dataCheckString = pairs.join('\n');
  var secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  var computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (computed !== hash) return null;
  var authDate = Number(body.auth_date);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;
  return {
    id: String(body.id),
    first_name: body.first_name || '',
    last_name: body.last_name || '',
    username: body.username || '',
    photo_url: body.photo_url || ''
  };
}

function getCookieFromReq(req, name) {
  var raw = req.headers.cookie;
  if (!raw || typeof raw !== 'string') return '';
  var parts = raw.split(';');
  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i].trim();
    if (seg.indexOf(name + '=') !== 0) continue;
    try {
      return decodeURIComponent(seg.slice(name.length + 1));
    } catch (e) {
      return seg.slice(name.length + 1);
    }
  }
  return '';
}

function webSessionCookieSecureFlag() {
  var ov = String(process.env.WEB_SESSION_SECURE || '').toLowerCase();
  if (ov === '0' || ov === 'false') return false;
  if (ov === '1' || ov === 'true') return true;
  return /^https:/i.test(PUBLIC_URL) || process.env.NODE_ENV === 'production';
}

function signWebSessionPayload(userId, expSec) {
  var payload = String(userId) + '.' + String(expSec);
  var sig = crypto.createHmac('sha256', WEB_SESSION_SECRET).update(payload).digest('hex');
  return payload + '.' + sig;
}

function verifyWebSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  var parts = token.split('.');
  if (parts.length !== 3) return null;
  var uid = parseInt(parts[0], 10);
  var exp = parseInt(parts[1], 10);
  if (!uid || !exp || !parts[2]) return null;
  if (Math.floor(Date.now() / 1000) > exp) return null;
  var payload = parts[0] + '.' + parts[1];
  var expected = crypto.createHmac('sha256', WEB_SESSION_SECRET).update(payload).digest('hex');
  try {
    var a = Buffer.from(expected, 'utf8');
    var b = Buffer.from(parts[2], 'utf8');
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch (e) {
    return null;
  }
  return uid;
}

function attachWebSessionCookie(res, userId) {
  if (!userId) return;
  var expSec = Math.floor(Date.now() / 1000) + WEB_SESSION_MAX_AGE_SEC;
  var token = signWebSessionPayload(userId, expSec);
  var parts = [
    WEB_SESSION_COOKIE + '=' + encodeURIComponent(token),
    'Path=/',
    'HttpOnly',
    'Max-Age=' + WEB_SESSION_MAX_AGE_SEC,
    'SameSite=Lax'
  ];
  if (webSessionCookieSecureFlag()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearWebSessionCookie(res) {
  var parts = [
    WEB_SESSION_COOKIE + '=;',
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'SameSite=Lax'
  ];
  if (webSessionCookieSecureFlag()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

var WEB_LOGIN_CHALLENGE_MAX_AGE_SEC = 600;

function attachWebLoginChallengeCookie(res, linkToken) {
  if (!linkToken) return;
  var parts = [
    WEB_LOGIN_CHALLENGE_COOKIE + '=' + encodeURIComponent(linkToken),
    'Path=/',
    'HttpOnly',
    'Max-Age=' + WEB_LOGIN_CHALLENGE_MAX_AGE_SEC,
    'SameSite=Lax'
  ];
  if (webSessionCookieSecureFlag()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearWebLoginChallengeCookie(res) {
  var parts = [
    WEB_LOGIN_CHALLENGE_COOKIE + '=;',
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'SameSite=Lax'
  ];
  if (webSessionCookieSecureFlag()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function normalizeRuPhone(phone) {
  var d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10 && d.charAt(0) === '9') d = '7' + d;
  if (d.length === 11 && d.charAt(0) === '8') d = '7' + d.slice(1);
  if (d.length === 11 && d.charAt(0) === '7') return d;
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

/** Phone login uses telegram_id like phone_7999...; after Telegram login we merge into one row (real id, username on client). */
async function mergeSyntheticUserIntoReal(mergeFromTgId, realUser) {
  if (!mergeFromTgId || !realUser || !realUser.id) return realUser;
  var sid = String(mergeFromTgId);
  if (sid.indexOf('phone_') !== 0) return realUser;
  var synth = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(sid);
  if (!synth || synth.id === realUser.id) return realUser;
  try {
    await db.prepare('UPDATE orders SET user_id = ? WHERE user_id = ?').run(realUser.id, synth.id);
    await db.prepare('UPDATE user_addresses SET user_id = ? WHERE user_id = ?').run(realUser.id, synth.id);
    var real = await db.prepare('SELECT * FROM users WHERE id = ?').get(realUser.id);
    if (real && (!real.phone || !String(real.phone).trim()) && synth.phone) {
      await db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(synth.phone, real.id);
    }
    await db.prepare('DELETE FROM users WHERE id = ?').run(synth.id);
    console.log('[Auth] Merged phone-only user ' + sid + ' (db id=' + synth.id + ') into telegram_id=' + realUser.telegram_id);
  } catch (err) {
    console.error('[Auth] Merge failed:', err.message);
  }
  return await db.prepare('SELECT * FROM users WHERE id = ?').get(realUser.id);
}

app.post('/api/auth/telegram', async function (req, res) {
  var telegramId = req.body.telegram_id;
  var firstName = req.body.first_name || '';
  var initData = req.body.init_data || '';
  var mergeFrom = req.body.merge_from_telegram_id || '';

  if (!telegramId) {
    return res.status(400).json({ error: 'telegram_id required' });
  }

  if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    if (!initData) {
      return res.status(403).json({ error: 'init_data required' });
    }
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
    existing = await mergeSyntheticUserIntoReal(mergeFrom, existing);
    return res.json({ user: existing });
  }

  var info = await db.prepare('INSERT INTO users (telegram_id, first_name) VALUES (?, ?)').run(String(telegramId), firstName);
  var user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  user = await mergeSyntheticUserIntoReal(mergeFrom, user);
  res.json({ user: user });
});

app.get('/api/client-config', async function (req, res) {
  try {
    await resolveTelegramBotUsernameFromApi();
  } catch (e) {}
  res.json({ telegram_bot_username: TELEGRAM_BOT_USERNAME, bot_id: TELEGRAM_BOT_ID });
});

app.get('/api/auth/session', async function (req, res) {
  try {
    var token = getCookieFromReq(req, WEB_SESSION_COOKIE);
    var uid = verifyWebSessionToken(token);
    if (!uid) return res.json({ user: null });
    var user = await db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    if (!user) return res.json({ user: null });
    return res.json({ user: user });
  } catch (err) {
    return res.json({ user: null });
  }
});

app.post('/api/auth/logout', function (req, res) {
  clearWebSessionCookie(res);
  clearWebLoginChallengeCookie(res);
  res.json({ ok: true });
});

// ============================================================
// WEB: вход по телефону + код в Telegram (через бота)
// ============================================================

app.post('/api/web-login/start', async function (req, res) {
  try {
    if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
      return res.status(503).json({ error: 'Вход по телефону временно недоступен' });
    }
    await resolveTelegramBotUsernameFromApi();
    if (!TELEGRAM_BOT_USERNAME) {
      return res.status(503).json({ error: 'Не удалось получить имя бота. Укажите TELEGRAM_BOT_USERNAME в .env на сервере.' });
    }
    var norm = normalizeRuPhone(req.body.phone);
    if (!norm) {
      return res.status(400).json({ error: 'Введите корректный номер телефона' });
    }
    var pretty = formatRuPhoneDisplay(norm);
    var code = String(Math.floor(1000 + Math.random() * 9000));
    var linkToken = crypto.randomBytes(20).toString('hex');
    var expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.prepare(
      'INSERT INTO web_login_challenges (link_token, phone_norm, phone_display, code, expires_at) VALUES (?,?,?,?,?)'
    ).run(linkToken, norm, pretty, code, expiresAt);

    attachWebLoginChallengeCookie(res, linkToken);
    var botUrl = 'https://t.me/' + encodeURIComponent(TELEGRAM_BOT_USERNAME) + '?start=login_' + linkToken;
    res.json({ ok: true, bot_url: botUrl, phone_display: pretty });
  } catch (err) {
    console.error('[WebLogin] start error:', err.message);
    res.status(500).json({ error: 'Не удалось начать вход' });
  }
});

app.post('/api/web-login/confirm', async function (req, res) {
  try {
    var mergeFrom = req.body.merge_from_telegram_id || '';
    var phoneRaw = req.body.phone;
    var code = String(req.body.code || '').replace(/\D/g, '');
    var linkToken = getCookieFromReq(req, WEB_LOGIN_CHALLENGE_COOKIE);
    if (!linkToken) {
      return res.status(400).json({ error: 'Сессия истекла. Нажмите «Получить код» снова.' });
    }
    if (code.length !== 4) {
      return res.status(400).json({ error: 'Введите 4 цифры кода из Telegram' });
    }
    var norm = normalizeRuPhone(phoneRaw);
    if (!norm) {
      return res.status(400).json({ error: 'Введите корректный номер телефона' });
    }

    var row = await db.prepare(
      'SELECT * FROM web_login_challenges WHERE link_token = ? AND used_at IS NULL'
    ).get(linkToken);
    if (!row) {
      return res.status(400).json({ error: 'Запрос не найден. Запросите код снова.' });
    }
    if (row.phone_norm !== norm) {
      return res.status(400).json({ error: 'Номер не совпадает с тем, на который запрашивали код' });
    }
    var now = Date.now();
    var exp = Date.parse(row.expires_at);
    if (isFinite(exp) && now > exp) {
      return res.status(400).json({ error: 'Срок действия кода истёк. Запросите новый.' });
    }
    if (!row.telegram_id) {
      return res.status(400).json({ error: 'Сначала откройте бота по ссылке — код придёт в Telegram.' });
    }
    if (row.code !== code) {
      return res.status(400).json({ error: 'Неверный код' });
    }

    await db.prepare('UPDATE web_login_challenges SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
    clearWebLoginChallengeCookie(res);

    var user = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(row.telegram_id));
    if (!user) {
      var info = await db.prepare('INSERT INTO users (telegram_id, first_name, phone) VALUES (?,?,?)')
        .run(String(row.telegram_id), 'Клиент', row.phone_display);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else {
      await db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(row.phone_display, user.id);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    user = await mergeSyntheticUserIntoReal(mergeFrom, user);
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    attachWebSessionCookie(res, user.id);
    res.json({ user: user });
  } catch (err) {
    console.error('[WebLogin] confirm error:', err.message);
    res.status(500).json({ error: 'Не удалось выполнить вход' });
  }
});

app.post('/api/auth/telegram-widget', async function (req, res) {
  var mergeFrom = req.body.merge_from_telegram_id || '';
  var bodyForWidget = Object.assign({}, req.body);
  delete bodyForWidget.merge_from_telegram_id;
  var tUser = validateTelegramLoginWidget(bodyForWidget);
  if (!tUser) {
    return res.status(403).json({ error: 'Invalid Telegram auth' });
  }
  var telegramId = tUser.id;
  var firstName = tUser.first_name || '';
  var existing = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (existing) {
    if (firstName && firstName !== existing.first_name) {
      await db.prepare('UPDATE users SET first_name = ? WHERE id = ?').run(firstName, existing.id);
      existing.first_name = firstName;
    }
    existing = await mergeSyntheticUserIntoReal(mergeFrom, existing);
    attachWebSessionCookie(res, existing.id);
    return res.json({ user: existing });
  }
  var info = await db.prepare('INSERT INTO users (telegram_id, first_name) VALUES (?, ?)').run(String(telegramId), firstName);
  var user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  user = await mergeSyntheticUserIntoReal(mergeFrom, user);
  attachWebSessionCookie(res, user.id);
  res.json({ user: user });
});

/** Веб-вход Telegram (виджет / OAuth): пользователь + cookie сессии */
async function applyTelegramWebOAuthSession(res, tUser, mergeFrom) {
  var telegramId = String(tUser.id);
  var firstName = tUser.first_name || '';
  var existing = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  if (existing) {
    if (firstName && firstName !== existing.first_name) {
      await db.prepare('UPDATE users SET first_name = ? WHERE id = ?').run(firstName, existing.id);
      existing.first_name = firstName;
    }
    existing = await mergeSyntheticUserIntoReal(mergeFrom, existing);
    attachWebSessionCookie(res, existing.id);
    return existing;
  }
  var info = await db.prepare('INSERT INTO users (telegram_id, first_name) VALUES (?, ?)').run(telegramId, firstName);
  var user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  user = await mergeSyntheticUserIntoReal(mergeFrom, user);
  attachWebSessionCookie(res, user.id);
  return user;
}

// Web-only Telegram login (window.onTelegramAuth)
app.post('/api/auth/telegram-web', async function (req, res) {
  var mergeFrom = req.body.merge_from_telegram_id || '';
  var bodyForWidget = Object.assign({}, req.body);
  delete bodyForWidget.merge_from_telegram_id;
  var tUser = validateTelegramLoginWidget(bodyForWidget);
  if (!tUser) {
    return res.status(403).json({ error: 'Invalid Telegram auth' });
  }
  try {
    var user = await applyTelegramWebOAuthSession(res, tUser, mergeFrom);
    res.json({ user: user });
  } catch (err) {
    console.error('[telegram-web]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

function telegramOAuthCallbackErrorPage(title, msg) {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title>' +
    '<style>body{font-family:sans-serif;margin:16px;background:#fff;color:#111}a{color:#06c}</style></head><body>' +
    '<h1 style="font-size:18px">' + title + '</h1><p>' + msg + '</p><p><a href="/">Перейти на сайт</a></p></body></html>'
  );
}

// Редирект oauth.telegram.org: в URL приходят id, hash, auth_date… — проверяем подпись, ставим cookie, редирект на сайт (мобильный «Войти через Telegram»).
app.get('/api/auth/telegram-web/callback', async function (req, res) {
  try {
    var q = req.query || {};
    if (!q.hash) {
      return res.status(400).send(telegramOAuthCallbackErrorPage('Вход через Telegram', 'Нет данных авторизации. Откройте вход с сайта ещё раз.'));
    }
    var body = {
      id: q.id,
      first_name: q.first_name,
      last_name: q.last_name,
      username: q.username,
      photo_url: q.photo_url,
      auth_date: q.auth_date,
      hash: q.hash
    };
    var tUser = validateTelegramLoginWidget(body);
    if (!tUser) {
      console.warn('[TG OAuth callback] неверная подпись или устарел auth_date');
      return res.status(403).send(telegramOAuthCallbackErrorPage('Вход не выполнен', 'Попробуйте снова с сайта — «Войти через Telegram».'));
    }
    await applyTelegramWebOAuthSession(res, tUser, '');
    var proto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
    if (!proto) proto = req.secure ? 'https' : 'http';
    var host = (req.get('x-forwarded-host') || req.get('host') || '').trim();
    var redirectBase;
    if (host) {
      if (proto !== 'https' && (req.get('x-forwarded-ssl') === 'on' || /shoparkaflowers\.ru/i.test(host))) {
        proto = 'https';
      }
      redirectBase = proto + '://' + host;
    } else {
      redirectBase = String(PUBLIC_URL || '').replace(/\/$/, '').replace(/^http:\/\//, 'https://');
    }
    res.redirect(302, redirectBase + '/?tg_web_login=1#account');
  } catch (err) {
    console.error('[TG OAuth callback]', err.message);
    res.status(500).send(telegramOAuthCallbackErrorPage('Ошибка', 'Попробуйте позже.'));
  }
});

function formatRuPhoneDisplay(norm11) {
  var n = String(norm11 || '');
  if (n.length !== 11 || n[0] !== '7') return '+' + n;
  return '+7 (' + n.slice(1, 4) + ') ' + n.slice(4, 7) + '-' + n.slice(7, 9) + '-' + n.slice(9, 11);
}

app.post('/api/auth/phone', async function (req, res) {
  var norm = normalizeRuPhone(req.body.phone);
  if (!norm) {
    return res.status(400).json({ error: 'Введите корректный номер телефона' });
  }
  var syntheticTg = 'phone_' + norm;
  var pretty = formatRuPhoneDisplay(norm);

  var phoneDigitsExpr = 'REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone,\'\'),\'+\',\'\'),\' \',\'\'),\'-\',\'\'),\'(\',\'\')';
  // Prefer real Telegram account (numeric telegram_id) over phone_* if both rows share the same number.
  var row = await db.prepare(
    'SELECT * FROM users WHERE ' + phoneDigitsExpr + ' = ? ORDER BY CASE WHEN telegram_id LIKE \'phone_%\' THEN 1 ELSE 0 END LIMIT 1'
  ).get(norm);

  if (!row) {
    row = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(syntheticTg);
  }

  if (row) {
    if (!row.phone || row.phone.replace(/\D/g, '') !== norm) {
      await db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(pretty, row.id);
      row.phone = pretty;
    }
    attachWebSessionCookie(res, row.id);
    return res.json({ user: row });
  }

  var info = await db.prepare('INSERT INTO users (telegram_id, first_name, phone) VALUES (?, ?, ?)').run(syntheticTg, 'Клиент', pretty);
  var user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  attachWebSessionCookie(res, user.id);
  res.json({ user: user });
});

// ============================================================
// PHONE VERIFY VIA TELEGRAM
// ============================================================

app.post('/api/phone/start-verify', async function (req, res) {
  try {
    var telegramId = req.body.telegram_id;
    var phoneRaw = req.body.phone;
    var firstName = (req.body.first_name || '').trim() || 'Клиент';
    if (!telegramId) return res.status(400).json({ error: 'telegram_id required' });
    var norm = normalizeRuPhone(phoneRaw);
    if (!norm) return res.status(400).json({ error: 'Введите корректный номер телефона' });

    var pretty = formatRuPhoneDisplay(norm);
    var code = String(Math.floor(1000 + Math.random() * 9000));
    var expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.prepare('INSERT INTO phone_verifications (telegram_id, phone, code, expires_at) VALUES (?,?,?,?)')
      .run(String(telegramId), pretty, code, expiresAt);

    var text = 'Код для подтверждения номера ' + pretty + ':\n\n' + code + '\n\nНикому его не сообщайте.';
    try {
      sendTelegramMessage(String(telegramId), text);
    } catch (e) {}

    res.json({ ok: true });
  } catch (err) {
    console.error('[PhoneVerify] start error:', err.message);
    res.status(500).json({ error: 'Не удалось отправить код' });
  }
});

app.post('/api/phone/confirm', async function (req, res) {
  try {
    var telegramId = req.body.telegram_id;
    var phoneRaw = req.body.phone;
    var code = String(req.body.code || '').trim();
    var firstName = (req.body.first_name || '').trim() || 'Клиент';
    if (!telegramId) return res.status(400).json({ error: 'telegram_id required' });
    var norm = normalizeRuPhone(phoneRaw);
    if (!norm) return res.status(400).json({ error: 'Введите корректный номер телефона' });
    if (!code) return res.status(400).json({ error: 'code required' });

    var pretty = formatRuPhoneDisplay(norm);
    var v = await db.prepare(
      'SELECT * FROM phone_verifications WHERE telegram_id = ? AND phone = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1'
    ).get(String(telegramId), pretty);
    if (!v) return res.status(400).json({ error: 'Код не найден, запросите новый' });

    var now = Date.now();
    var exp = Date.parse(v.expires_at);
    if (isFinite(exp) && now > exp) {
      return res.status(400).json({ error: 'Срок действия кода истёк, запросите новый' });
    }
    if (v.code !== code) {
      await db.prepare('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?').run(v.id);
      return res.status(400).json({ error: 'Неверный код' });
    }

    await db.prepare('UPDATE phone_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(v.id);

    var user = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
    if (!user) {
      var info = await db.prepare('INSERT INTO users (telegram_id, first_name, phone) VALUES (?,?,?)')
        .run(String(telegramId), firstName, pretty);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else {
      await db.prepare('UPDATE users SET phone = ?, first_name = COALESCE(NULLIF(first_name, \'\'), ?) WHERE id = ?')
        .run(pretty, firstName, user.id);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    attachWebSessionCookie(res, user.id);
    res.json({ user: user });
  } catch (err) {
    console.error('[PhoneVerify] confirm error:', err.message);
    res.status(500).json({ error: 'Не удалось подтвердить номер' });
  }
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

  // Show only paid orders in customer profile/history.
  var orders = await db.prepare('SELECT * FROM orders WHERE user_id = ? AND is_paid = 1 ORDER BY created_at DESC').all(user.id);
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
// Google Sheets: only after payment (not on order draft / before Pay click)
// ============================================================

async function exportOrderToGoogleSheets(orderId) {
  try {
    var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return;
    // Safety gate: never export unpaid orders to the paid-orders sheet.
    if (Number(order.is_paid) !== 1) {
      console.log('[Google Sheets] Skip unpaid order #' + orderId);
      return;
    }
    var orderItems = await db.prepare(
      'SELECT oi.*, p.name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?'
    ).all(orderId);
    await gsheets.appendOrder(order, orderItems);
  } catch (gsErr) {
    console.error('[Google Sheets] export error:', gsErr.message);
  }
}

/** Match bank order to our DB row: payment_id may be operationId or payment URL; JWT may include paymentLinkId (our order id). */
async function findOrderForTochkaAcquiringWebhook(jwtPayload) {
  var opId = jwtPayload.operationId || jwtPayload.OperationId || jwtPayload.operation_id || '';
  var linkId = jwtPayload.paymentLinkId || jwtPayload.PaymentLinkId || jwtPayload.payment_link_id || '';
  opId = opId ? String(opId).trim() : '';
  linkId = linkId ? String(linkId).trim() : '';

  var order = null;
  if (opId) {
    order = await db.prepare('SELECT * FROM orders WHERE payment_id = ?').get(opId);
    if (!order) {
      order = await db.prepare('SELECT * FROM orders WHERE payment_id = ?').get(opId.toLowerCase());
    }
  }
  if (!order && linkId) {
    var numId = parseInt(linkId, 10);
    if (numId > 0) {
      order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(numId);
    }
    if (!order) {
      order = await db.prepare('SELECT * FROM orders WHERE payment_id = ?').get(linkId);
    }
  }
  if (!order && jwtPayload.purpose) {
    var pm = String(jwtPayload.purpose).match(/№\s*(\d+)/);
    if (pm && pm[1]) {
      var oid = parseInt(pm[1], 10);
      if (oid > 0) {
        order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(oid);
      }
    }
  }
  return order;
}

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

      var clientEmail = (order.user_email && String(order.user_email).trim()) || TOCHKA_FALLBACK_EMAIL;
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
            email: clientEmail
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
          'Content-Type': 'application/json',
          'CustomerCode': TOCHKA_CUSTOMER_CODE
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

  var wasUnpaid = Number(order.is_paid) !== 1;
  await db.prepare('UPDATE orders SET is_paid = 1, paid_at = CURRENT_TIMESTAMP, status = ?, status_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('Оплачен', orderId);

  if (wasUnpaid) {
    await exportOrderToGoogleSheets(orderId);
  }

  res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Оплата</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#000}div{text-align:center;border:1px solid #000;padding:40px}a{display:inline-block;margin-top:20px;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px}</style></head><body><div><p>Оплата прошла успешно</p><p>Заказ N ' + orderId + '</p><p>Статус заказа обновлен на "Оплачен"</p><a href="/">Вернуться в магазин</a></div></body></html>');
});

app.get('/api/payments/tochka-success/:orderId', async function (req, res) {
  var orderId = req.params.orderId;
  var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).send('Заказ не найден');

  // Важно: не помечаем is_paid по этому GET. Банк может перенаправить сюда до фактического
  // списания или при отмене — тогда заказ ошибочно попадал в «оплачен / на сборке».
  // Подтверждение оплаты только через POST /api/payments/webhook (JWT status APPROVED).
  var paid = order && Number(order.is_paid) === 1;

  var htmlOk =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Оплата</title>' +
    '<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff;color:#000}' +
    'div{text-align:center;padding:40px;max-width:420px}h2{margin-bottom:16px;color:#2e7d32}p{color:#555;margin-bottom:24px;line-height:1.5}' +
    'a{display:inline-block;padding:14px 28px;background:#000;color:#fff;text-decoration:none;border-radius:10px;font-size:15px}</style></head><body><div>' +
    '<h2>Оплата подтверждена</h2><p>Заказ №' + orderId + ' оплачен. Спасибо!</p>' +
    '<a href="/">Вернуться в магазин</a></div></body></html>';

  var htmlWait =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Оплата</title>' +
    '<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff;color:#000}' +
    'div{text-align:center;padding:40px;max-width:440px}h2{margin-bottom:16px;color:#333;font-size:1.2rem}p{color:#555;margin-bottom:16px;line-height:1.55;font-size:15px}' +
    'a{display:inline-block;padding:14px 28px;background:#000;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;margin-top:8px}</style></head><body><div>' +
    '<h2>Ожидаем подтверждение банка</h2>' +
    '<p>Если вы успешно оплатили заказ №' + orderId + ', статус обновится автоматически в течение минуты после подтверждения платёжной системы.</p>' +
    '<p>Если вы отменили оплату или закрыли страницу банка, заказ остаётся неоплаченным — вы сможете оплатить его позже из профиля или оформить заново.</p>' +
    '<a href="/">Вернуться в магазин</a></div></body></html>';

  res.send(paid ? htmlOk : htmlWait);
});

app.post('/api/payments/webhook', async function (req, res) {
  var body = req.body;
  if (Buffer.isBuffer(body)) {
    body = body.toString('utf8');
  }
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
      var hookType = jwtPayload.webhookType || jwtPayload.WebhookType || jwtPayload.webhook_type || '';
      var hookNorm = String(hookType || '').replace(/\s+/g, '').toLowerCase();
      var skipWebhookTypes = {
        incomingpayment: true,
        outgoingpayment: true,
        incomingsbppayment: true,
        incomingsbpb2bpayment: true
      };
      if (hookNorm && skipWebhookTypes[hookNorm]) {
        console.log('[Webhook] Skip event (not payment link): webhookType=' + hookType);
      } else {
        var opId = jwtPayload.operationId || jwtPayload.OperationId || jwtPayload.operation_id || '';
        var statusRaw = jwtPayload.status || jwtPayload.Status || '';
        var statusNorm = String(statusRaw || '').trim().toUpperCase();

        console.log('[Webhook] operationId=' + opId + ', status=' + statusRaw);

        // СБП по платёжной ссылке — тот же acquiringInternetPayment, status APPROVED (док. Точки).
        if ((opId || jwtPayload.paymentLinkId || jwtPayload.purpose) && statusNorm === 'APPROVED') {
          var order = await findOrderForTochkaAcquiringWebhook(jwtPayload);
          if (!order) {
            console.log('[Webhook] No order row for operationId=' + opId);
          } else if (Number(order.is_paid) !== 1) {
            await db.prepare('UPDATE orders SET is_paid = 1, paid_at = CURRENT_TIMESTAMP, status = ?, status_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run('Оплачен', order.id);
            console.log('[Webhook] Order #' + order.id + ' marked as paid');

            try {
              if (BOT_TOKEN && order.user_id) {
                try {
                  var u = await db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(order.user_id);
                  if (u && u.telegram_id) {
                    var payMsg2 = await buildPaymentNotification(order);
                    sendTelegramMessage(u.telegram_id, payMsg2);
                  }
                } catch (e) {}
              }
              await notifyAdminsNewOrder(order);
              await exportOrderToGoogleSheets(order.id);
            } catch (sideErr) {
              console.error('[Webhook] Post-payment error:', sideErr.message);
            }
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

app.post('/api/admin/telegram-widget-login', async function (req, res) {
  var tUser = validateTelegramLoginWidget(req.body);
  if (!tUser) {
    return res.status(403).json({ error: 'Invalid Telegram auth' });
  }
  var telegramId = String(tUser.id);
  var username = String(tUser.username || '');
  var isAdmin = await isAdminUser(telegramId, username);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Not an admin' });
  }
  if (username) {
    var clean = username.replace(/^@/, '').toLowerCase();
    var row = await db.prepare('SELECT id FROM admin_users WHERE LOWER(telegram_username) = ?').get(clean);
    if (row) {
      await db.prepare('UPDATE admin_users SET telegram_id = ? WHERE id = ?').run(telegramId, row.id);
    }
  }
  var canDelete = false;
  if (!isSuperAdmin(telegramId)) {
    var clean2 = username.replace(/^@/, '').toLowerCase();
    var adminRow = await db.prepare('SELECT can_delete_orders FROM admin_users WHERE telegram_id = ? OR LOWER(telegram_username) = ?').get(telegramId, clean2);
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
  // By default admin panel shows only paid orders. Use ?include_unpaid=1 to include all.
  var sql = 'SELECT * FROM orders';
  var conditions = [];
  var params = [];
  if (String(req.query.include_unpaid || '') !== '1') {
    conditions.push('is_paid = 1');
  }

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
    if (order && order.user_id && (newStatus === 'Отправлен' || newStatus === 'Готов к выдаче')) {
      var u = await db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(order.user_id);
      if (u && u.telegram_id) {
        var msg = '';
        if (newStatus === 'Отправлен') {
          msg = '<b>Заказ #' + order.id + ' отправлен!</b>\n\n' +
            'Ваш заказ уже в пути. Ожидайте доставку!';
          if (order.delivery_address) msg += '\nАдрес: ' + order.delivery_address;
          if (order.delivery_date) msg += '\nДата: ' + order.delivery_date;
          if (order.delivery_interval) msg += '\nИнтервал: ' + order.delivery_interval;
        } else {
          msg = '<b>Заказ #' + order.id + ' готов!</b>\n\n' +
            'Ваш заказ готов и ждёт вас. Можете забрать его в магазине.';
        }
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
    'INSERT INTO product_sizes (product_id, label, flower_count, price, sort_order, dimensions, image_url) VALUES (?,?,?,?,?,?,?)'
  ).run(
    b.product_id,
    b.label,
    parseInt(b.flower_count) || 0,
    parseInt(b.price),
    (maxSort ? maxSort.ms : 0) + 1,
    b.dimensions || '',
    b.image_url || ''
  );
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/product-sizes/:id', adminAuth, async function (req, res) {
  var b = req.body;
  await db.prepare(
    'UPDATE product_sizes SET label=?, flower_count=?, price=?, sort_order=?, dimensions=?, image_url=? WHERE id=?'
  ).run(
    b.label,
    parseInt(b.flower_count) || 0,
    parseInt(b.price),
    parseInt(b.sort_order) || 0,
    b.dimensions || '',
    b.image_url || '',
    req.params.id
  );
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

app.post('/api/admin/backup-now', adminAuth, async function (req, res) {
  try {
    await backup.backup();
    res.json({ ok: true, message: 'Backup completed' });
  } catch (err) {
    res.status(500).json({ error: 'Backup failed: ' + err.message });
  }
});

app.get('/api/admin/backup-status', adminAuth, async function (req, res) {
  try {
    var status = await backup.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Status check failed: ' + err.message });
  }
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
// TELEGRAM BOT: Webhook handler
// ============================================================

app.post('/api/telegram/webhook', async function (req, res) {
  res.json({ ok: true });

  try {
    var update = req.body;

    if (update.callback_query && isTelegramTokenPlaceholder(ADMIN_BOT_TOKEN)) {
      var cbq = update.callback_query;
      var cbChatId = cbq.from.id;
      var cbData = cbq.data || '';
      await telegramApiCall('answerCallbackQuery', { callback_query_id: cbq.id });
      if (cbData.indexOf('reply_') === 0) {
        var targetChatId = cbData.replace('reply_', '');
        adminReplyState[String(cbChatId)] = targetChatId;
        await telegramApiCall('sendMessage', {
          chat_id: cbChatId,
          text: '\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043e\u0442\u0432\u0435\u0442 \u2014 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0431\u0443\u0434\u0435\u0442 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043a\u043b\u0438\u0435\u043d\u0442\u0443.\n\n\u0414\u043b\u044f \u043e\u0442\u043c\u0435\u043d\u044b: /cancel'
        });
      }
      return;
    }

    if (update.message) {
      var tgMsg = update.message;
      var tgChatId = tgMsg.chat.id;
      var tgText = tgMsg.text || '';
      var tgFirstName = (tgMsg.from && tgMsg.from.first_name) || '';
      var tgUsername = (tgMsg.from && tgMsg.from.username) || '';
      var tgIsAdmin = await isAdminUser(String(tgChatId), tgUsername);

      if (tgText.indexOf('/start') === 0) {
        var startPayload = tgText.replace(/^\/start\s*/, '').trim();
        if (startPayload.indexOf('login_') === 0) {
          var loginTok = startPayload.slice('login_'.length).trim();
          if (loginTok) {
            var ch = await db.prepare(
              'SELECT * FROM web_login_challenges WHERE link_token = ? AND used_at IS NULL'
            ).get(loginTok);
            var nowMs = Date.now();
            var chExp = ch ? Date.parse(ch.expires_at) : NaN;
            if (!ch || !isFinite(chExp) || nowMs > chExp) {
              await telegramApiCall('sendMessage', {
                chat_id: tgChatId,
                text: 'Ссылка для входа на сайт устарела или недействительна. Запросите код на сайте ещё раз.',
                reply_markup: BOT_MAIN_KEYBOARD
              });
              return;
            }
            if (ch.telegram_id && String(ch.telegram_id) !== String(tgChatId)) {
              await telegramApiCall('sendMessage', {
                chat_id: tgChatId,
                text: 'Эта ссылка уже использована в другом Telegram-аккаунте. Запросите новый код на сайте.',
                reply_markup: BOT_MAIN_KEYBOARD
              });
              return;
            }
            if (!ch.telegram_id) {
              await db.prepare('UPDATE web_login_challenges SET telegram_id = ? WHERE id = ?').run(String(tgChatId), ch.id);
            }
            var codeMsg =
              '<b>Код для входа на сайт</b>\nНомер: ' + ch.phone_display +
              '\n\n<code>' + ch.code + '</code>\n\nВведите эти 4 цифры на сайте. Никому не сообщайте код.';
            await telegramApiCall('sendMessage', {
              chat_id: tgChatId,
              text: codeMsg,
              parse_mode: 'HTML',
              reply_markup: BOT_MAIN_KEYBOARD
            });
            return;
          }
        }

        await telegramApiCall('sendMessage', {
          chat_id: tgChatId,
          text: '<b>\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u0432 ARKA STUDIO FLOWERS!</b>\n\n\u0417\u0434\u0435\u0441\u044c \u0432\u044b \u043c\u043e\u0436\u0435\u0442\u0435 \u0437\u0430\u043a\u0430\u0437\u0430\u0442\u044c \u043a\u0440\u0430\u0441\u0438\u0432\u044b\u0435 \u0431\u0443\u043a\u0435\u0442\u044b \u0438 \u0446\u0432\u0435\u0442\u043e\u0447\u043d\u044b\u0435 \u043a\u043e\u043c\u043f\u043e\u0437\u0438\u0446\u0438\u0438.\n\n\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u043a\u043d\u043e\u043f\u043a\u0438 \u043d\u0438\u0436\u0435 \u0438\u043b\u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u041a\u0410\u0422\u0410\u041b\u041e\u0413 \u0434\u043b\u044f \u043e\u0442\u043a\u0440\u044b\u0442\u0438\u044f \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430.',
          parse_mode: 'HTML',
          reply_markup: tgIsAdmin ? BOT_ADMIN_KEYBOARD : BOT_MAIN_KEYBOARD
        });
        return;
      }

      if (tgText === 'Мой заказ' || tgText === '/orders') {
        var ordUser = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(tgChatId));
        if (!ordUser) {
          await telegramApiCall('sendMessage', { chat_id: tgChatId, text: 'У вас нет активных заказов.', reply_markup: BOT_MAIN_KEYBOARD });
          return;
        }
        var activeStatuses = ['Новый', 'Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Готов к выдаче'];
        var activeOrder = await db.prepare(
          "SELECT * FROM orders WHERE user_id = ? AND is_paid = 1 AND status IN ('" + activeStatuses.join("','") + "') ORDER BY created_at DESC LIMIT 1"
        ).get(ordUser.id);

        if (!activeOrder) {
          await telegramApiCall('sendMessage', { chat_id: tgChatId, text: 'У вас нет активных заказов.', reply_markup: BOT_MAIN_KEYBOARD });
          return;
        }

        var isPickup = activeOrder.delivery_type === 'pickup';
        var stages;
        if (isPickup) {
          stages = ['Новый', 'Оплачен', 'Собирается', 'Собран', 'Готов к выдаче'];
        } else {
          stages = ['Новый', 'Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Доставлен'];
        }

        var currentIdx = stages.indexOf(activeOrder.status);
        if (currentIdx === -1) currentIdx = 0;

        var ordMsg = '<b>Заказ #' + activeOrder.id + '</b> \u2014 ' + activeOrder.total_amount + ' руб.\n';
        if (activeOrder.delivery_date) ordMsg += 'Дата: ' + activeOrder.delivery_date + '\n';
        if (isPickup) { ordMsg += 'Тип: Самовывоз\n'; }
        else if (activeOrder.delivery_address) { ordMsg += 'Адрес: ' + activeOrder.delivery_address + '\n'; }
        ordMsg += '\n<b>Этапы выполнения:</b>\n\n';

        for (var si = 0; si < stages.length; si++) {
          if (si < currentIdx) {
            ordMsg += '  [+] ' + stages[si] + '\n';
          } else if (si === currentIdx) {
            ordMsg += '  [>] ' + stages[si] + '  <--\n';
          } else {
            ordMsg += '  [   ] ' + stages[si] + '\n';
          }
        }

        await telegramApiCall('sendMessage', { chat_id: tgChatId, text: ordMsg, parse_mode: 'HTML', reply_markup: BOT_MAIN_KEYBOARD });
        return;
      }
      if (tgText === '\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u043d\u0430\u043c\u0438') {
        await telegramApiCall('sendMessage', {
          chat_id: tgChatId,
          text: '<b>\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u043d\u0430\u043c\u0438</b>\n\n\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0432\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u0440\u044f\u043c\u043e \u0441\u044e\u0434\u0430 \u2014 \u043c\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u043c \u0435\u0433\u043e \u0438 \u043e\u0442\u0432\u0435\u0442\u0438\u043c \u0432\u0430\u043c!',
          parse_mode: 'HTML',
          reply_markup: BOT_MAIN_KEYBOARD
        });
        return;
      }

      if (tgText === '\u041e \u043d\u0430\u0441') {
        var aboutText = await getSetting('about_text');
        if (!aboutText) {
          aboutText = '<b>ARKA STUDIO FLOWERS</b>\n\n\u041c\u044b \u0441\u043e\u0437\u0434\u0430\u0451\u043c \u043a\u0440\u0430\u0441\u0438\u0432\u044b\u0435 \u0431\u0443\u043a\u0435\u0442\u044b \u0438 \u0446\u0432\u0435\u0442\u043e\u0447\u043d\u044b\u0435 \u043a\u043e\u043c\u043f\u043e\u0437\u0438\u0446\u0438\u0438.\n\n\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u041a\u0410\u0422\u0410\u041b\u041e\u0413, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u043d\u0430\u0448\u0438 \u0440\u0430\u0431\u043e\u0442\u044b!';
        }
        await telegramApiCall('sendMessage', { chat_id: tgChatId, text: aboutText, parse_mode: 'HTML', reply_markup: BOT_MAIN_KEYBOARD });
        return;
      }

      if (tgText === '/help') {
        await telegramApiCall('sendMessage', {
          chat_id: tgChatId,
          text: '<b>\u041f\u043e\u043c\u043e\u0449\u044c</b>\n\n\u041a\u0410\u0422\u0410\u041b\u041e\u0413 \u2014 \u043e\u0442\u043a\u0440\u043e\u0435\u0442\u0441\u044f \u043c\u0430\u0433\u0430\u0437\u0438\u043d\n\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b \u2014 \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043a\u0430\u0437\u043e\u0432\n\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u043d\u0430\u043c\u0438 \u2014 \u043d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435\n\u041e \u043d\u0430\u0441 \u2014 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f\n\n\u0418\u043b\u0438 \u043f\u0440\u043e\u0441\u0442\u043e \u043d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u2014 \u043c\u044b \u043e\u0442\u0432\u0435\u0442\u0438\u043c!',
          parse_mode: 'HTML',
          reply_markup: BOT_MAIN_KEYBOARD
        });
        return;
      }

      if (tgText === 'Новые заказы' && tgIsAdmin) {
        var pendingOrders = await db.prepare(
          "SELECT * FROM orders WHERE status IN ('Новый', 'Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Готов к выдаче') ORDER BY created_at DESC LIMIT 10"
        ).all();
        if (!pendingOrders.length) {
          await telegramApiCall('sendMessage', { chat_id: tgChatId, text: 'Активных заказов нет.', reply_markup: BOT_ADMIN_KEYBOARD });
          return;
        }
        var aMsg = '<b>Активные заказы (' + pendingOrders.length + '):</b>\n\n';
        for (var pi = 0; pi < pendingOrders.length; pi++) {
          var po = pendingOrders[pi];
          aMsg += '#' + po.id + ' | ' + (po.user_name || '-') + ' | ' + (po.status || 'Новый') + ' | ' + po.total_amount + ' руб.\n';
        }
        await telegramApiCall('sendMessage', { chat_id: tgChatId, text: aMsg, parse_mode: 'HTML', reply_markup: BOT_ADMIN_KEYBOARD });
        return;
      }

      if (tgText === 'Админ-панель' && tgIsAdmin) {
        var panelUrl = PUBLIC_URL.replace(/^http:\/\//, 'https://') + '/admin';
        await telegramApiCall('sendMessage', {
          chat_id: tgChatId,
          text: 'Нажмите кнопку ниже:',
          reply_markup: JSON.stringify({
            inline_keyboard: [[{ text: 'Открыть админ-панель', web_app: { url: panelUrl } }]]
          })
        });
        return;
      }

      if (tgText === '/cancel' && tgIsAdmin) {
        delete adminReplyState[String(tgChatId)];
        await telegramApiCall('sendMessage', { chat_id: tgChatId, text: '\u0420\u0435\u0436\u0438\u043c \u043e\u0442\u0432\u0435\u0442\u0430 \u043e\u0442\u043c\u0435\u043d\u0451\u043d.' });
        return;
      }

      if (tgIsAdmin && adminReplyState[String(tgChatId)]) {
        var replyTargetId = adminReplyState[String(tgChatId)];
        delete adminReplyState[String(tgChatId)];
        await telegramApiCall('sendMessage', {
          chat_id: replyTargetId,
          text: '<b>\u041e\u0442\u0432\u0435\u0442 \u043e\u0442 ARKA STUDIO:</b>\n\n' + tgText,
          parse_mode: 'HTML'
        });
        await telegramApiCall('sendMessage', {
          chat_id: tgChatId,
          text: '\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043a\u043b\u0438\u0435\u043d\u0442\u0443!'
        });
        return;
      }

      if (!tgIsAdmin && tgText && tgText[0] !== '/') {
        var displayName = tgFirstName;
        if (tgUsername) displayName += ' (@' + tgUsername + ')';

        var adminNotif = '<b>\u041d\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435</b>\n' +
          '\u041e\u0442: ' + displayName + '\n' +
          'ID: <code>' + tgChatId + '</code>\n\n' +
          tgText;

        var replyBtns = [[{ text: '\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c', callback_data: 'reply_' + tgChatId }]];
        var notifyApi = adminNotifyApiCall();

        for (var ai = 0; ai < ADMIN_TELEGRAM_IDS.length; ai++) {
          await notifyApi('sendMessage', {
            chat_id: ADMIN_TELEGRAM_IDS[ai],
            text: adminNotif,
            parse_mode: 'HTML',
            reply_markup: JSON.stringify({ inline_keyboard: replyBtns })
          });
        }

        var dbAdmins = await db.prepare('SELECT telegram_id FROM admin_users WHERE telegram_id IS NOT NULL').all();
        for (var di = 0; di < dbAdmins.length; di++) {
          if (!ADMIN_TELEGRAM_IDS.includes(dbAdmins[di].telegram_id)) {
            await notifyApi('sendMessage', {
              chat_id: dbAdmins[di].telegram_id,
              text: adminNotif,
              parse_mode: 'HTML',
              reply_markup: JSON.stringify({ inline_keyboard: replyBtns })
            });
          }
        }

        await telegramApiCall('sendMessage', {
          chat_id: tgChatId,
          text: '\u0412\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u043e! \u041c\u044b \u043e\u0442\u0432\u0435\u0442\u0438\u043c \u0432\u0430\u043c \u0432 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0435\u0435 \u0432\u0440\u0435\u043c\u044f.',
          reply_markup: BOT_MAIN_KEYBOARD
        });
        return;
      }
    }
  } catch (err) {
    console.error('[TG Bot] Webhook error:', err.message);
  }
});

// Второй бот: callback «Ответить» и режим ответа клиенту (сообщения клиентам всё равно через клиентский BOT_TOKEN).
app.post('/api/telegram/admin-webhook', async function (req, res) {
  res.json({ ok: true });
  if (isTelegramTokenPlaceholder(ADMIN_BOT_TOKEN)) return;
  try {
    var update = req.body;

    if (update.callback_query) {
      var cbqA = update.callback_query;
      var cbChatIdA = cbqA.from.id;
      var cbDataA = cbqA.data || '';
      await adminBotApiCall('answerCallbackQuery', { callback_query_id: cbqA.id });
      if (cbDataA.indexOf('reply_') === 0) {
        var targetChatIdA = cbDataA.replace('reply_', '');
        adminReplyState[String(cbChatIdA)] = targetChatIdA;
        await adminBotApiCall('sendMessage', {
          chat_id: cbChatIdA,
          text: '\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043e\u0442\u0432\u0435\u0442 \u2014 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0439\u0434\u0451\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u0432 \u0431\u043e\u0442 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430.\n\n/cancel \u2014 \u043e\u0442\u043c\u0435\u043d\u0430'
        });
      }
      return;
    }

    if (update.message) {
      var tgMsgA = update.message;
      var tgChatIdA = tgMsgA.chat.id;
      var tgTextA = tgMsgA.text || '';
      var tgUsernameA = (tgMsgA.from && tgMsgA.from.username) || '';
      var tgIsAdminA = await isAdminUser(String(tgChatIdA), tgUsernameA);

      if (tgTextA === '/cancel' && tgIsAdminA) {
        delete adminReplyState[String(tgChatIdA)];
        await adminBotApiCall('sendMessage', {
          chat_id: tgChatIdA,
          text: '\u0420\u0435\u0436\u0438\u043c \u043e\u0442\u0432\u0435\u0442\u0430 \u043e\u0442\u043c\u0435\u043d\u0451\u043d.'
        });
        return;
      }

      if (tgIsAdminA && adminReplyState[String(tgChatIdA)]) {
        var replyTargetIdA = adminReplyState[String(tgChatIdA)];
        delete adminReplyState[String(tgChatIdA)];
        await telegramApiCall('sendMessage', {
          chat_id: replyTargetIdA,
          text: '<b>\u041e\u0442\u0432\u0435\u0442 \u043e\u0442 ARKA STUDIO:</b>\n\n' + tgTextA,
          parse_mode: 'HTML'
        });
        await adminBotApiCall('sendMessage', {
          chat_id: tgChatIdA,
          text: '\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043a\u043b\u0438\u0435\u043d\u0442\u0443.'
        });
        return;
      }
    }
  } catch (errA) {
    console.error('[TG Admin Bot] Webhook error:', errA.message);
  }
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

    if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE' && PUBLIC_URL) {
      setTimeout(function () { registerTelegramBotWebhook(); }, 3000);
    }
    if (!isTelegramTokenPlaceholder(ADMIN_BOT_TOKEN) && PUBLIC_URL) {
      setTimeout(function () { registerAdminBotWebhook(); }, 4500);
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
        'Content-Type': 'application/json',
        'CustomerCode': TOCHKA_CUSTOMER_CODE
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

async function registerTelegramBotWebhook() {
  try {
    var webhookUrl = PUBLIC_URL.replace(/^http:\/\//, 'https://') + '/api/telegram/webhook';
    console.log('[TG Bot] Setting webhook: ' + webhookUrl);

    var result = await telegramApiCall('setWebhook', { url: webhookUrl });
    console.log('[TG Bot] Webhook result:', JSON.stringify(result));

    await telegramApiCall('setMyCommands', {
      commands: [
        { command: 'start', description: 'Главное меню' },
        { command: 'orders', description: 'Мой заказ' },
        { command: 'help', description: 'Помощь' }
      ]
    });
    console.log('[TG Bot] Commands set');
  } catch (err) {
    console.error('[TG Bot] Setup error:', err.message);
  }
}

async function registerAdminBotWebhook() {
  try {
    if (isTelegramTokenPlaceholder(ADMIN_BOT_TOKEN)) return;
    var base = PUBLIC_URL.replace(/^http:\/\//, 'https://');
    var adminWhUrl = base + '/api/telegram/admin-webhook';
    console.log('[TG Admin Bot] Setting webhook: ' + adminWhUrl);
    var result = await adminBotApiCall('setWebhook', { url: adminWhUrl });
    console.log('[TG Admin Bot] Webhook result:', JSON.stringify(result));
  } catch (err) {
    console.error('[TG Admin Bot] Setup error:', err.message);
  }
}

start().catch(function (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
});
