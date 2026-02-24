var fs = require('fs');
var path = require('path');

var file = path.join(__dirname, 'server.js');
var src = fs.readFileSync(file, 'utf8');

// Check current state
var count = (src.match(/gsheets\.appendOrder/g) || []).length;
console.log('Current gsheets.appendOrder calls:', count);

// Step 1: Remove old call from order creation (before payment)
var oldPattern = /\n    try \{\n      var order = await db\.prepare\('SELECT \* FROM orders WHERE id = \?'\)\.get\(orderId\);\n      var orderItems = await db\.prepare\(\n        'SELECT oi\.\*, p\.name FROM order_items oi LEFT JOIN products p ON oi\.product_id = p\.id WHERE oi\.order_id = \?'\n      \)\.all\(orderId\);\n      gsheets\.appendOrder\(order, orderItems\);\n    \} catch \(gsErr\) \{\n      console\.error\('Google Sheets export error:', gsErr\.message\);\n    \}/;

if (oldPattern.test(src)) {
  src = src.replace(oldPattern, '');
  console.log('1. Removed old gsheets.appendOrder from order creation');
} else {
  console.log('1. Old call already removed or not found');
}

// Step 2: Add after "marked as paid via redirect"
var m1 = "console.log('[Tochka] Order #' + orderId + ' marked as paid via redirect');";
if (src.indexOf(m1) !== -1 && src.indexOf(m1 + '\n\n    try {') === -1) {
  src = src.replace(m1, m1 + "\n\n    try {\n      var gsItems = await db.prepare('SELECT oi.*, p.name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?').all(orderId);\n      gsheets.appendOrder(order, gsItems);\n    } catch (gsErr) { console.error('[Google Sheets] export error:', gsErr.message); }");
  console.log('2. Added gsheets.appendOrder after redirect payment');
} else if (src.indexOf(m1) === -1) {
  console.log('2. Redirect marker not found');
} else {
  console.log('2. Already added after redirect');
}

// Step 3: Add after "marked as paid" (webhook)
var m2 = "console.log('[Webhook] Order #' + order.id + ' marked as paid');";
if (src.indexOf(m2) !== -1 && src.indexOf(m2 + '\n\n          try {') === -1) {
  src = src.replace(m2, m2 + "\n\n          try {\n            var gsItems2 = await db.prepare('SELECT oi.*, p.name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?').all(order.id);\n            gsheets.appendOrder(order, gsItems2);\n          } catch (gsErr) { console.error('[Google Sheets] export error:', gsErr.message); }");
  console.log('3. Added gsheets.appendOrder after webhook payment');
} else if (src.indexOf(m2) === -1) {
  console.log('3. Webhook marker not found');
} else {
  console.log('3. Already added after webhook');
}

fs.writeFileSync(file, src, 'utf8');

var newCount = (src.match(/gsheets\.appendOrder/g) || []).length;
console.log('\nFinal gsheets.appendOrder calls:', newCount);
console.log('Done!');
