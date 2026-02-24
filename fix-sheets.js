var fs = require('fs');
var path = require('path');

var file = path.join(__dirname, 'server.js');
var src = fs.readFileSync(file, 'utf8');
var changed = false;

// 1. Remove gsheets.appendOrder from order creation (before payment)
var oldBlock = "    try {\n      var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);\n      var orderItems = await db.prepare(\n        'SELECT oi.*, p.name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?'\n      ).all(orderId);\n      gsheets.appendOrder(order, orderItems);\n    } catch (gsErr) {\n      console.error('Google Sheets export error:', gsErr.message);\n    }";

if (src.indexOf(oldBlock) !== -1) {
  src = src.replace(oldBlock, '');
  changed = true;
  console.log('1. Removed gsheets.appendOrder from order creation');
} else {
  console.log('1. Block not found (may already be removed)');
}

// 2. Add gsheets.appendOrder after "marked as paid via redirect"
var marker1 = "console.log('[Tochka] Order #' + orderId + ' marked as paid via redirect');";
if (src.indexOf(marker1) !== -1 && src.indexOf(marker1 + '\n\n    // Write to Google Sheets') === -1) {
  var sheetsCode = "\n\n    try {\n      var gsItems = await db.prepare('SELECT oi.*, p.name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?').all(orderId);\n      gsheets.appendOrder(order, gsItems);\n    } catch (gsErr) { console.error('[Google Sheets] export error:', gsErr.message); }";
  src = src.replace(marker1, marker1 + sheetsCode);
  changed = true;
  console.log('2. Added gsheets.appendOrder after redirect payment confirmation');
} else {
  console.log('2. Redirect marker not found or already added');
}

// 3. Add gsheets.appendOrder after "marked as paid" (webhook)
var marker2 = "console.log('[Webhook] Order #' + order.id + ' marked as paid');";
if (src.indexOf(marker2) !== -1 && src.indexOf(marker2 + '\n\n          // Write to Google Sheets') === -1) {
  var sheetsCode2 = "\n\n          try {\n            var gsItems2 = await db.prepare('SELECT oi.*, p.name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?').all(order.id);\n            gsheets.appendOrder(order, gsItems2);\n          } catch (gsErr) { console.error('[Google Sheets] export error:', gsErr.message); }";
  src = src.replace(marker2, marker2 + sheetsCode2);
  changed = true;
  console.log('3. Added gsheets.appendOrder after webhook payment confirmation');
} else {
  console.log('3. Webhook marker not found or already added');
}

if (changed) {
  fs.writeFileSync(file, src, 'utf8');
  console.log('\nDone! Google Sheets now writes only after payment.');
} else {
  console.log('\nNo changes needed.');
}
