var { google } = require('googleapis');

var sheets = null;
var SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '';
var SHEET_DELIVERY = 'Доставка';
var SHEET_PICKUP = 'Самовывоз';

function getAuth() {
  var email = process.env.GOOGLE_SERVICE_EMAIL;
  var key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) return null;
  key = key.replace(/\\n/g, '\n');
  return new google.auth.JWT(email, null, key, [
    'https://www.googleapis.com/auth/spreadsheets'
  ]);
}

async function getSheets() {
  if (sheets) return sheets;
  var auth = getAuth();
  if (!auth) return null;
  sheets = google.sheets({ version: 'v4', auth: auth });
  return sheets;
}

async function ensureHeaders(api, sheetName) {
  try {
    var resp = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName + '!A1:P1'
    });
    if (resp.data.values && resp.data.values.length) return;
  } catch (e) {
    try {
      await api.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{ addSheet: { properties: { title: sheetName } } }]
        }
      });
    } catch (ignore) {}
  }
  var headers = [
    '№ заказа', 'Дата', 'Имя клиента', 'Телефон', 'Telegram', 'Email',
    'Получатель', 'Телефон получателя',
    'Тип доставки', 'Адрес', 'Зона', 'Дата доставки', 'Интервал',
    'Товары', 'Стоимость доставки', 'Итого', 'Комментарий'
  ];
  await api.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName + '!A1',
    valueInputOption: 'RAW',
    resource: { values: [headers] }
  });
}

function formatItems(items) {
  return items.map(function (i) {
    var s = i.name || ('Товар #' + i.product_id);
    if (i.size_label) s += ' (' + i.size_label + ')';
    s += ' × ' + i.quantity;
    s += ' = ' + i.price * i.quantity + ' ₽';
    return s;
  }).join('\n');
}

async function appendOrder(order, items) {
  if (!SPREADSHEET_ID) return;
  try {
    var api = await getSheets();
    if (!api) return;

    var isPickup = order.delivery_type === 'pickup';
    var sheetName = isPickup ? SHEET_PICKUP : SHEET_DELIVERY;

    await ensureHeaders(api, sheetName);

    var date = order.created_at || new Date().toISOString();
    try {
      var d = new Date(date);
      date = d.toLocaleString('ru-RU', { timeZone: 'Europe/Saratov' });
    } catch (e) {}

    var row = [
      order.id,
      date,
      order.user_name || '',
      order.user_phone || '',
      order.user_telegram || '',
      order.user_email || '',
      order.receiver_name || '',
      order.receiver_phone || '',
      isPickup ? 'Самовывоз' : 'Доставка',
      order.delivery_address || '',
      order.delivery_zone || '',
      order.delivery_date || '',
      order.delivery_interval || '',
      formatItems(items),
      order.delivery_cost || 0,
      order.total_amount || 0,
      order.comment || ''
    ];

    await api.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName + '!A:Q',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [row] }
    });
    console.log('[Google Sheets] Order #' + order.id + ' written to "' + sheetName + '"');
  } catch (err) {
    console.error('[Google Sheets] Error:', err.message);
  }
}

var SHEET_ABANDONED = 'Брошенные корзины';

async function ensureAbandonedHeaders(api) {
  try {
    var resp = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_ABANDONED + '!A1:F1'
    });
    if (resp.data.values && resp.data.values.length) return;
  } catch (e) {
    try {
      await api.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{ addSheet: { properties: { title: SHEET_ABANDONED } } }]
        }
      });
    } catch (ignore) {}
  }
  var headers = ['Дата', 'Username', 'Телефон', 'Telegram ID', 'Товары', 'Сумма'];
  await api.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_ABANDONED + '!A1',
    valueInputOption: 'RAW',
    resource: { values: [headers] }
  });
}

async function appendAbandonedCart(data) {
  if (!SPREADSHEET_ID) return;
  try {
    var api = await getSheets();
    if (!api) return;

    await ensureAbandonedHeaders(api);

    var date = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Saratov' });
    var items = (data.cart || []).map(function (c) {
      return c.name + ' × ' + c.quantity + ' = ' + (c.price * c.quantity) + ' ₽';
    }).join('\n');

    var row = [
      date,
      data.username || '—',
      data.phone || '—',
      String(data.user_id || ''),
      items,
      data.total || 0
    ];

    await api.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_ABANDONED + '!A:F',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [row] }
    });
    console.log('[Google Sheets] Abandoned cart written for user ' + data.user_id);
  } catch (err) {
    console.error('[Google Sheets] Abandoned cart error:', err.message);
  }
}

module.exports = { appendOrder: appendOrder, appendAbandonedCart: appendAbandonedCart };
