var fs = require('fs');

// =============================================
// PART 1: server.js changes
// =============================================
var code = fs.readFileSync('server.js', 'utf8');
var sChanges = 0;

// --- Fix syntax error: });  should be }\n}); ---
// Search flexibly
var syntaxSearch = "notifErr.message);";
var sIdx = code.indexOf(syntaxSearch);
if (sIdx !== -1) {
  // Look ahead for });
  var afterErr = code.substring(sIdx + syntaxSearch.length, sIdx + syntaxSearch.length + 20);
  if (afterErr.indexOf('});') !== -1 && afterErr.indexOf('}\n});') === -1 && afterErr.indexOf('}\r\n});') === -1) {
    // Missing } before });
    var replStart = sIdx + syntaxSearch.length;
    var replEnd = code.indexOf('});', replStart) + 3;
    var oldChunk = code.substring(sIdx, replEnd);
    var newChunk = oldChunk.replace('});', '}\n});');
    code = code.replace(oldChunk, newChunk);
    sChanges++;
    console.log('FIX: Syntax error fixed');
  } else {
    console.log('FIX: Syntax already correct');
  }
}

// --- Add notifyAdminsNewOrder function after buildPaymentNotification ---
if (code.indexOf('notifyAdminsNewOrder') !== -1) {
  console.log('STEP 1 SKIP: notifyAdminsNewOrder already exists');
} else {
  // Find end of buildPaymentNotification - search for "return msg;" followed by "}"
  var returnMsg = "return msg;\n}";
  var rmIdx = code.indexOf(returnMsg);
  if (rmIdx === -1) {
    returnMsg = "return msg;\r\n}";
    rmIdx = code.indexOf(returnMsg);
  }
  if (rmIdx === -1) { console.error('STEP 1 FAILED: Could not find end of buildPaymentNotification'); process.exit(1); }

  var insertPos = rmIdx + returnMsg.length;

  var adminNotifFunc = "\n\nasync function notifyAdminsNewOrder(order) {\n" +
"  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return;\n" +
"  try {\n" +
"    var items = await db.prepare(\n" +
"      'SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?'\n" +
"    ).all(order.id);\n" +
"\n" +
"    var msg = '<b>\\u041d\\u043e\\u0432\\u044b\\u0439 \\u043e\\u043f\\u043b\\u0430\\u0447\\u0435\\u043d\\u043d\\u044b\\u0439 \\u0437\\u0430\\u043a\\u0430\\u0437 #' + order.id + '</b>\\n\\n';\n" +
"    msg += '\\u041a\\u043b\\u0438\\u0435\\u043d\\u0442: ' + (order.user_name || '-') + '\\n';\n" +
"    msg += '\\u0422\\u0435\\u043b\\u0435\\u0444\\u043e\\u043d: ' + (order.user_phone || '-') + '\\n';\n" +
"    if (order.delivery_type === 'pickup') {\n" +
"      msg += '\\u0422\\u0438\\u043f: \\u0421\\u0430\\u043c\\u043e\\u0432\\u044b\\u0432\\u043e\\u0437\\n';\n" +
"    } else {\n" +
"      msg += '\\u0422\\u0438\\u043f: \\u0414\\u043e\\u0441\\u0442\\u0430\\u0432\\u043a\\u0430\\n';\n" +
"      if (order.delivery_address) msg += '\\u0410\\u0434\\u0440\\u0435\\u0441: ' + order.delivery_address + '\\n';\n" +
"    }\n" +
"    if (order.delivery_date) msg += '\\u0414\\u0430\\u0442\\u0430: ' + order.delivery_date + '\\n';\n" +
"    if (order.delivery_interval) msg += '\\u0412\\u0440\\u0435\\u043c\\u044f: ' + order.delivery_interval + '\\n';\n" +
"    msg += '\\u0421\\u0443\\u043c\\u043c\\u0430: ' + order.total_amount + ' \\u0440\\u0443\\u0431.\\n';\n" +
"\n" +
"    if (items.length) {\n" +
"      msg += '\\n\\u0422\\u043e\\u0432\\u0430\\u0440\\u044b:\\n';\n" +
"      for (var i = 0; i < items.length; i++) {\n" +
"        msg += '  ' + (items[i].product_name || '\\u0422\\u043e\\u0432\\u0430\\u0440') + ' x' + items[i].quantity + ' \\u2014 ' + items[i].price + ' \\u0440\\u0443\\u0431.\\n';\n" +
"      }\n" +
"    }\n" +
"\n" +
"    var adminUrl = PUBLIC_URL.replace(/^http:\\/\\//, 'https://') + '/admin?order=' + order.id;\n" +
"    var btns = [[{ text: '\\u041e\\u0442\\u043a\\u0440\\u044b\\u0442\\u044c \\u0437\\u0430\\u043a\\u0430\\u0437', url: adminUrl }]];\n" +
"\n" +
"    for (var a = 0; a < ADMIN_TELEGRAM_IDS.length; a++) {\n" +
"      await telegramApiCall('sendMessage', {\n" +
"        chat_id: ADMIN_TELEGRAM_IDS[a],\n" +
"        text: msg,\n" +
"        parse_mode: 'HTML',\n" +
"        reply_markup: JSON.stringify({ inline_keyboard: btns })\n" +
"      });\n" +
"    }\n" +
"\n" +
"    var dbAdmins = await db.prepare('SELECT telegram_id FROM admin_users WHERE telegram_id IS NOT NULL').all();\n" +
"    for (var d = 0; d < dbAdmins.length; d++) {\n" +
"      if (!ADMIN_TELEGRAM_IDS.includes(dbAdmins[d].telegram_id)) {\n" +
"        await telegramApiCall('sendMessage', {\n" +
"          chat_id: dbAdmins[d].telegram_id,\n" +
"          text: msg,\n" +
"          parse_mode: 'HTML',\n" +
"          reply_markup: JSON.stringify({ inline_keyboard: btns })\n" +
"        });\n" +
"      }\n" +
"    }\n" +
"    console.log('[TG Bot] Admin notification sent for order #' + order.id);\n" +
"  } catch (err) {\n" +
"    console.error('[TG Bot] Admin notification error:', err.message);\n" +
"  }\n" +
"}";

  code = code.substring(0, insertPos) + adminNotifFunc + code.substring(insertPos);
  sChanges++;
  console.log('STEP 1 OK: Added notifyAdminsNewOrder function');
}

// --- Add notifyAdminsNewOrder call after user payment notification (redirect) ---
var marker2 = "} catch (e) {}\n    }\n  }\n\n  res.send";
var m2idx = code.indexOf(marker2);
if (m2idx === -1) {
  marker2 = "} catch (e) {}\r\n    }\r\n  }\r\n\r\n  res.send";
  m2idx = code.indexOf(marker2);
}
if (m2idx === -1) {
  // Try simpler search
  var simpleM = "} catch (e) {}";
  var sm1 = code.indexOf(simpleM);
  if (sm1 !== -1) {
    var afterSm = code.substring(sm1, sm1 + 100);
    if (afterSm.indexOf('res.send') !== -1 && afterSm.indexOf('notifyAdminsNewOrder') === -1) {
      var insertAt = code.indexOf('\n', sm1) + 1;
      code = code.substring(0, insertAt) + "    notifyAdminsNewOrder(order);\n" + code.substring(insertAt);
      sChanges++;
      console.log('STEP 2 OK: Admin notification added (redirect)');
    } else if (afterSm.indexOf('notifyAdminsNewOrder') !== -1) {
      console.log('STEP 2 SKIP: Already added');
    } else {
      console.log('STEP 2 SKIP: Could not verify location');
    }
  }
} else {
  // Insert notifyAdminsNewOrder before res.send
  var nlAfter = code.indexOf('\n', m2idx + "} catch (e) {}".length) + 1;
  code = code.substring(0, nlAfter) + "    notifyAdminsNewOrder(order);\n" + code.substring(nlAfter);
  sChanges++;
  console.log('STEP 2 OK: Admin notification added (redirect)');
}

// --- Add notifyAdminsNewOrder call in webhook handler ---
var marker3 = "sendTelegramMessage(u.telegram_id, payMsg2);";
var m3idx = code.indexOf(marker3);
if (m3idx !== -1) {
  var afterM3 = code.substring(m3idx, m3idx + 200);
  if (afterM3.indexOf('notifyAdminsNewOrder') === -1) {
    var catchAfterM3 = code.indexOf("} catch (e) {}", m3idx);
    if (catchAfterM3 !== -1) {
      var nlAfterM3 = code.indexOf('\n', catchAfterM3) + 1;
      code = code.substring(0, nlAfterM3) + "          notifyAdminsNewOrder(order);\n" + code.substring(nlAfterM3);
      sChanges++;
      console.log('STEP 3 OK: Admin notification added (webhook)');
    }
  } else {
    console.log('STEP 3 SKIP: Already added');
  }
} else {
  console.log('STEP 3 SKIP: webhook marker not found');
}

fs.writeFileSync('server.js', code, 'utf8');
console.log('server.js saved: ' + sChanges + ' changes');

// =============================================
// PART 2: admin.js - deep link support
// =============================================
var adminCode = fs.readFileSync('public/admin.js', 'utf8');
var aChanges = 0;

if (adminCode.indexOf('checkDeepLink') !== -1) {
  console.log('STEP 4 SKIP: checkDeepLink already exists');
} else {
  var loadTabCall = "loadTab();";
  var ltIdx = adminCode.indexOf(loadTabCall);
  if (ltIdx === -1) { console.error('STEP 4 FAILED: loadTab() not found'); process.exit(1); }

  var deepLinkCheck = "loadTab();\n" +
"    (function checkDeepLink() {\n" +
"      var params = new URLSearchParams(window.location.search);\n" +
"      var orderId = params.get('order');\n" +
"      if (orderId) {\n" +
"        setTimeout(function () { viewOrder(parseInt(orderId)); }, 600);\n" +
"        window.history.replaceState({}, '', window.location.pathname);\n" +
"      }\n" +
"    })();";

  adminCode = adminCode.replace(loadTabCall, deepLinkCheck);
  aChanges++;
  console.log('STEP 4 OK: Deep link support added to admin.js');
}

fs.writeFileSync('public/admin.js', adminCode, 'utf8');
console.log('admin.js saved: ' + aChanges + ' changes');

console.log('\n=== SUCCESS ===');
console.log('Total: ' + (sChanges + aChanges) + ' changes');
console.log('Now run push.bat!');
