var fs = require('fs');
var filePath = 'server.js';
var code = fs.readFileSync(filePath, 'utf8');
var changes = 0;

// Build the new notification code block (reusable)
// This function builds a detailed payment message based on order type
var notifFunc = "\n" +
"async function buildPaymentNotification(order) {\n" +
"  var msg = '<b>Заказ #' + order.id + ' успешно оплачен!</b>\\n\\n';\n" +
"  msg += 'Сумма: ' + order.total_amount + ' руб.\\n';\n" +
"  if (order.user_name) msg += 'Имя: ' + order.user_name + '\\n';\n" +
"  msg += '\\n';\n" +
"\n" +
"  if (order.delivery_type === 'pickup') {\n" +
"    msg += '<b>Самовывоз</b>\\n';\n" +
"    var pickupAddr = await getSetting('pickup_address');\n" +
"    if (pickupAddr) msg += 'Адрес: ' + pickupAddr + '\\n';\n" +
"    if (order.delivery_date) msg += 'Дата: ' + order.delivery_date + '\\n';\n" +
"    if (order.delivery_interval) msg += 'Время: ' + order.delivery_interval + '\\n';\n" +
"  } else {\n" +
"    msg += '<b>Доставка</b>\\n';\n" +
"    if (order.delivery_address) msg += 'Адрес: ' + order.delivery_address + '\\n';\n" +
"    if (order.delivery_date) msg += 'Дата: ' + order.delivery_date + '\\n';\n" +
"    if (order.delivery_interval) msg += 'Время: ' + order.delivery_interval + '\\n';\n" +
"  }\n" +
"\n" +
"  msg += '\\nСпасибо, что выбрали нас!';\n" +
"  return msg;\n" +
"}\n";

// Insert the function after getSetting/getAllSettings helpers
var helperMarker = 'async function getAllSettings()';
var helperIdx = code.indexOf(helperMarker);
if (helperIdx === -1) { console.error('FAILED: Could not find getAllSettings'); process.exit(1); }
var helperEnd = code.indexOf('\n}', helperIdx);
var insertPoint = helperEnd + 2;
code = code.substring(0, insertPoint) + notifFunc + code.substring(insertPoint);
changes++;
console.log('STEP 1 OK: Added buildPaymentNotification function');

// =============================================
// STEP 2: Replace first notification (redirect handler, line ~669)
// =============================================
var old1 = "sendTelegramMessage(u.telegram_id, '\u0412\u0430\u0448 \u0437\u0430\u043a\u0430\u0437 \u2116' + orderId + ' \u0443\u0441\u043f\u0435\u0448\u043d\u043e \u043e\u043f\u043b\u0430\u0447\u0435\u043d! \u0421\u0443\u043c\u043c\u0430: ' + order.total_amount + ' \u20bd');";
var idx1 = code.indexOf(old1);
if (idx1 === -1) { console.error('FAILED: Could not find first sendTelegramMessage for payment'); process.exit(1); }

var new1 = "var payMsg = await buildPaymentNotification(order);\n" +
"          sendTelegramMessage(u.telegram_id, payMsg);";

code = code.replace(old1, new1);
changes++;
console.log('STEP 2 OK: Redirect handler notification updated');

// =============================================
// STEP 3: Replace second notification (webhook handler)
// =============================================
// Find the second occurrence
var old2 = "sendTelegramMessage(u.telegram_id, '\u0412\u0430\u0448 \u0437\u0430\u043a\u0430\u0437 \u2116' + order.id + ' \u0443\u0441\u043f\u0435\u0448\u043d\u043e \u043e\u043f\u043b\u0430\u0447\u0435\u043d! \u0421\u0443\u043c\u043c\u0430: ' + order.total_amount + ' \u20bd');";
var idx2 = code.indexOf(old2);
if (idx2 === -1) { console.error('STEP 3 SKIP: Second notification not found (may already be updated)'); }
else {
  var new2 = "var payMsg2 = await buildPaymentNotification(order);\n" +
  "                sendTelegramMessage(u.telegram_id, payMsg2);";
  code = code.replace(old2, new2);
  changes++;
  console.log('STEP 3 OK: Webhook handler notification updated');
}

// =============================================
// WRITE
// =============================================
fs.writeFileSync(filePath, code, 'utf8');
console.log('\n=== SUCCESS ===');
console.log(changes + ' changes applied.');
console.log('Payment notification now shows:');
console.log('  Delivery: order #, amount, name, address, date, time');
console.log('  Pickup: order #, amount, name, store address, date, time');
console.log('Now run push.bat!');
