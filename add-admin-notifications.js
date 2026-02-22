var fs = require('fs');

// =============================================
// PART 1: server.js changes
// =============================================
var code = fs.readFileSync('server.js', 'utf8');
var sChanges = 0;

// --- Fix syntax error if present ---
var syntaxSearch = "notifErr.message);";
var allSyntax = code.split(syntaxSearch);
for (var si = 0; si < allSyntax.length - 1; si++) {
  var checkAfter = code.indexOf(syntaxSearch) + syntaxSearch.length;
  var nextChars = code.substring(checkAfter, checkAfter + 30);
}
// Direct fix: find the specific pattern
var bugPattern = "notifErr.message);\n  });";
if (code.indexOf(bugPattern) !== -1 && code.indexOf("notifErr.message);\n  }\n});") === -1) {
  code = code.replace(bugPattern, "notifErr.message);\n  }\n});");
  sChanges++;
  console.log('FIX: Syntax error fixed');
} else {
  var bugPattern2 = "notifErr.message);\r\n  });";
  if (code.indexOf(bugPattern2) !== -1 && code.indexOf("notifErr.message);\r\n  }\r\n});") === -1) {
    code = code.replace(bugPattern2, "notifErr.message);\r\n  }\r\n});");
    sChanges++;
    console.log('FIX: Syntax error fixed (CRLF)');
  } else {
    console.log('FIX: Syntax OK or already fixed');
  }
}

// --- Add BOT_ADMIN_KEYBOARD after BOT_MAIN_KEYBOARD ---
if (code.indexOf('BOT_ADMIN_KEYBOARD') !== -1) {
  console.log('STEP 1 SKIP: BOT_ADMIN_KEYBOARD already exists');
} else {
  var afterMainKb = "is_persistent: true\n});";
  var akIdx = code.indexOf(afterMainKb);
  if (akIdx === -1) {
    afterMainKb = "is_persistent: true\r\n});";
    akIdx = code.indexOf(afterMainKb);
  }
  if (akIdx === -1) { console.error('STEP 1 FAILED: BOT_MAIN_KEYBOARD end not found'); process.exit(1); }

  var insertAK = akIdx + afterMainKb.length;
  var adminKbCode = "\n\nvar BOT_ADMIN_KEYBOARD = JSON.stringify({\n" +
"  keyboard: [\n" +
"    [{ text: '\\u041c\\u043e\\u0439 \\u0437\\u0430\\u043a\\u0430\\u0437' }, { text: '\\u0421\\u0432\\u044f\\u0437\\u0430\\u0442\\u044c\\u0441\\u044f \\u0441 \\u043d\\u0430\\u043c\\u0438' }],\n" +
"    [{ text: '\\u041e \\u043d\\u0430\\u0441' }],\n" +
"    [{ text: '\\u041d\\u043e\\u0432\\u044b\\u0435 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b' }, { text: '\\u0410\\u0434\\u043c\\u0438\\u043d-\\u043f\\u0430\\u043d\\u0435\\u043b\\u044c' }]\n" +
"  ],\n" +
"  resize_keyboard: true,\n" +
"  is_persistent: true\n" +
"});\n";
  code = code.substring(0, insertAK) + adminKbCode + code.substring(insertAK);
  sChanges++;
  console.log('STEP 1 OK: Added BOT_ADMIN_KEYBOARD');
}

// --- Update /start to use admin keyboard for admins ---
var startMarker = "reply_markup: BOT_MAIN_KEYBOARD\n        });\n        return;\n      }\n";
var startIdx = code.indexOf(startMarker);
if (startIdx === -1) {
  startMarker = "reply_markup: BOT_MAIN_KEYBOARD\r\n        });\r\n        return;\r\n      }\r\n";
  startIdx = code.indexOf(startMarker);
}
// Find the /start handler specifically
var startCmdIdx = code.indexOf("tgText === '/start'");
if (startCmdIdx !== -1) {
  var firstReplyMarkup = code.indexOf("reply_markup: BOT_MAIN_KEYBOARD", startCmdIdx);
  if (firstReplyMarkup !== -1 && firstReplyMarkup < startCmdIdx + 500) {
    if (code.indexOf("tgIsAdmin ? BOT_ADMIN_KEYBOARD", firstReplyMarkup - 50) === -1) {
      code = code.substring(0, firstReplyMarkup) +
        "reply_markup: tgIsAdmin ? BOT_ADMIN_KEYBOARD : BOT_MAIN_KEYBOARD" +
        code.substring(firstReplyMarkup + "reply_markup: BOT_MAIN_KEYBOARD".length);
      sChanges++;
      console.log('STEP 2 OK: /start uses admin keyboard for admins');
    } else {
      console.log('STEP 2 SKIP: Already updated');
    }
  }
}

// --- Add admin button handlers before /cancel handler ---
if (code.indexOf("\\u041d\\u043e\\u0432\\u044b\\u0435 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b") !== -1 ||
    code.indexOf("\u041d\u043e\u0432\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b") !== -1) {
  // Check if handler exists (not just keyboard button)
  if (code.indexOf("tgText === '\\u041d\\u043e\\u0432\\u044b\\u0435 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b'") !== -1 ||
      code.indexOf("tgText === '\u041d\u043e\u0432\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b'") !== -1) {
    console.log('STEP 3 SKIP: Admin button handlers already exist');
  } else {
    // Insert before /cancel handler
    var cancelMarker = "if (tgText === '/cancel' && tgIsAdmin)";
    var cancelIdx = code.indexOf(cancelMarker);
    if (cancelIdx === -1) { console.error('STEP 3 FAILED: /cancel not found'); process.exit(1); }

    // Find the start of the line (go back to find whitespace)
    var lineStart = code.lastIndexOf('\n', cancelIdx) + 1;

    var adminHandlers =
"      if (tgText === '\u041d\u043e\u0432\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b' && tgIsAdmin) {\n" +
"        var pendingOrders = await db.prepare(\n" +
"          \"SELECT * FROM orders WHERE status IN ('\u041d\u043e\u0432\u044b\u0439', '\u041e\u043f\u043b\u0430\u0447\u0435\u043d', '\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f', '\u0421\u043e\u0431\u0440\u0430\u043d', '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d', '\u0413\u043e\u0442\u043e\u0432 \u043a \u0432\u044b\u0434\u0430\u0447\u0435') ORDER BY created_at DESC LIMIT 10\"\n" +
"        ).all();\n" +
"        if (!pendingOrders.length) {\n" +
"          await telegramApiCall('sendMessage', { chat_id: tgChatId, text: '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u043e\u0432 \u043d\u0435\u0442.', reply_markup: BOT_ADMIN_KEYBOARD });\n" +
"          return;\n" +
"        }\n" +
"        var aMsg = '<b>\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b (' + pendingOrders.length + '):</b>\\n\\n';\n" +
"        for (var pi = 0; pi < pendingOrders.length; pi++) {\n" +
"          var po = pendingOrders[pi];\n" +
"          aMsg += '#' + po.id + ' | ' + (po.user_name || '-') + ' | ' + (po.status || '\u041d\u043e\u0432\u044b\u0439') + ' | ' + po.total_amount + ' \u0440\u0443\u0431.\\n';\n" +
"        }\n" +
"        await telegramApiCall('sendMessage', { chat_id: tgChatId, text: aMsg, parse_mode: 'HTML', reply_markup: BOT_ADMIN_KEYBOARD });\n" +
"        return;\n" +
"      }\n" +
"\n" +
"      if (tgText === '\u0410\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c' && tgIsAdmin) {\n" +
"        var panelUrl = PUBLIC_URL.replace(/^http:\\/\\//, 'https://') + '/admin';\n" +
"        await telegramApiCall('sendMessage', {\n" +
"          chat_id: tgChatId,\n" +
"          text: '\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u043a\u043d\u043e\u043f\u043a\u0443 \u043d\u0438\u0436\u0435:',\n" +
"          reply_markup: JSON.stringify({\n" +
"            inline_keyboard: [[{ text: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0430\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c', web_app: { url: panelUrl } }]]\n" +
"          })\n" +
"        });\n" +
"        return;\n" +
"      }\n\n";

    code = code.substring(0, lineStart) + adminHandlers + code.substring(lineStart);
    sChanges++;
    console.log('STEP 3 OK: Admin button handlers added');
  }
}

// --- Add notifyAdminsNewOrder function ---
if (code.indexOf('notifyAdminsNewOrder') !== -1) {
  console.log('STEP 4 SKIP: notifyAdminsNewOrder already exists');
} else {
  var returnMsg = "return msg;\n}";
  var rmIdx = code.indexOf(returnMsg);
  if (rmIdx === -1) {
    returnMsg = "return msg;\r\n}";
    rmIdx = code.indexOf(returnMsg);
  }
  if (rmIdx === -1) { console.error('STEP 4 FAILED: buildPaymentNotification end not found'); process.exit(1); }

  var insertPos = rmIdx + returnMsg.length;

  var adminNotifFunc = "\n\nasync function notifyAdminsNewOrder(order) {\n" +
"  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return;\n" +
"  try {\n" +
"    var items = await db.prepare(\n" +
"      'SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?'\n" +
"    ).all(order.id);\n" +
"\n" +
"    var msg = '<b>\u041d\u043e\u0432\u044b\u0439 \u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0439 \u0437\u0430\u043a\u0430\u0437 #' + order.id + '</b>\\n\\n';\n" +
"    msg += '\u041a\u043b\u0438\u0435\u043d\u0442: ' + (order.user_name || '-') + '\\n';\n" +
"    msg += '\u0422\u0435\u043b\u0435\u0444\u043e\u043d: ' + (order.user_phone || '-') + '\\n';\n" +
"    if (order.delivery_type === 'pickup') {\n" +
"      msg += '\u0422\u0438\u043f: \u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437\\n';\n" +
"    } else {\n" +
"      msg += '\u0422\u0438\u043f: \u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430\\n';\n" +
"      if (order.delivery_address) msg += '\u0410\u0434\u0440\u0435\u0441: ' + order.delivery_address + '\\n';\n" +
"    }\n" +
"    if (order.delivery_date) msg += '\u0414\u0430\u0442\u0430: ' + order.delivery_date + '\\n';\n" +
"    if (order.delivery_interval) msg += '\u0412\u0440\u0435\u043c\u044f: ' + order.delivery_interval + '\\n';\n" +
"    msg += '\u0421\u0443\u043c\u043c\u0430: ' + order.total_amount + ' \u0440\u0443\u0431.\\n';\n" +
"    if (items.length) {\n" +
"      msg += '\\n\u0422\u043e\u0432\u0430\u0440\u044b:\\n';\n" +
"      for (var i = 0; i < items.length; i++) {\n" +
"        msg += '  ' + (items[i].product_name || '\u0422\u043e\u0432\u0430\u0440') + ' x' + items[i].quantity + ' \\u2014 ' + items[i].price + ' \u0440\u0443\u0431.\\n';\n" +
"      }\n" +
"    }\n" +
"    var adminUrl = PUBLIC_URL.replace(/^http:\\/\\//, 'https://') + '/admin?order=' + order.id;\n" +
"    var btns = [[{ text: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0437\u0430\u043a\u0430\u0437', url: adminUrl }]];\n" +
"    for (var a = 0; a < ADMIN_TELEGRAM_IDS.length; a++) {\n" +
"      await telegramApiCall('sendMessage', {\n" +
"        chat_id: ADMIN_TELEGRAM_IDS[a], text: msg, parse_mode: 'HTML',\n" +
"        reply_markup: JSON.stringify({ inline_keyboard: btns })\n" +
"      });\n" +
"    }\n" +
"    var dbAdmins = await db.prepare('SELECT telegram_id FROM admin_users WHERE telegram_id IS NOT NULL').all();\n" +
"    for (var d = 0; d < dbAdmins.length; d++) {\n" +
"      if (!ADMIN_TELEGRAM_IDS.includes(dbAdmins[d].telegram_id)) {\n" +
"        await telegramApiCall('sendMessage', {\n" +
"          chat_id: dbAdmins[d].telegram_id, text: msg, parse_mode: 'HTML',\n" +
"          reply_markup: JSON.stringify({ inline_keyboard: btns })\n" +
"        });\n" +
"      }\n" +
"    }\n" +
"  } catch (err) {\n" +
"    console.error('[TG Bot] Admin notification error:', err.message);\n" +
"  }\n" +
"}";

  code = code.substring(0, insertPos) + adminNotifFunc + code.substring(insertPos);
  sChanges++;
  console.log('STEP 4 OK: Added notifyAdminsNewOrder');
}

// --- Add notifyAdminsNewOrder calls in payment handlers ---
var payMarker1 = "sendTelegramMessage(u.telegram_id, payMsg);";
var pm1 = code.indexOf(payMarker1);
if (pm1 !== -1) {
  var around1 = code.substring(pm1, pm1 + 200);
  if (around1.indexOf('notifyAdminsNewOrder') === -1) {
    var catchAfter1 = code.indexOf("} catch (e) {}", pm1);
    if (catchAfter1 !== -1 && catchAfter1 - pm1 < 100) {
      var nlA1 = code.indexOf('\n', catchAfter1) + 1;
      code = code.substring(0, nlA1) + "    notifyAdminsNewOrder(order);\n" + code.substring(nlA1);
      sChanges++;
      console.log('STEP 5 OK: Admin notify in redirect handler');
    }
  } else {
    console.log('STEP 5 SKIP: Already added');
  }
}

var payMarker2 = "sendTelegramMessage(u.telegram_id, payMsg2);";
var pm2 = code.indexOf(payMarker2);
if (pm2 !== -1) {
  var around2 = code.substring(pm2, pm2 + 200);
  if (around2.indexOf('notifyAdminsNewOrder') === -1) {
    var catchAfter2 = code.indexOf("} catch (e) {}", pm2);
    if (catchAfter2 !== -1 && catchAfter2 - pm2 < 100) {
      var nlA2 = code.indexOf('\n', catchAfter2) + 1;
      code = code.substring(0, nlA2) + "          notifyAdminsNewOrder(order);\n" + code.substring(nlA2);
      sChanges++;
      console.log('STEP 6 OK: Admin notify in webhook handler');
    }
  } else {
    console.log('STEP 6 SKIP: Already added');
  }
}

fs.writeFileSync('server.js', code, 'utf8');
console.log('server.js: ' + sChanges + ' changes');

// =============================================
// PART 2: admin.js - deep link
// =============================================
var adminCode = fs.readFileSync('public/admin.js', 'utf8');
var aChanges = 0;

if (adminCode.indexOf('checkDeepLink') !== -1) {
  console.log('STEP 7 SKIP: checkDeepLink already exists');
} else {
  var loadTabCall = "loadTab();";
  var ltIdx = adminCode.indexOf(loadTabCall);
  if (ltIdx !== -1) {
    var deepLink = "loadTab();\n" +
"    (function checkDeepLink() {\n" +
"      var params = new URLSearchParams(window.location.search);\n" +
"      var orderId = params.get('order');\n" +
"      if (orderId) {\n" +
"        setTimeout(function () { viewOrder(parseInt(orderId)); }, 600);\n" +
"        window.history.replaceState({}, '', window.location.pathname);\n" +
"      }\n" +
"    })();";
    adminCode = adminCode.replace(loadTabCall, deepLink);
    aChanges++;
    console.log('STEP 7 OK: Deep link added to admin.js');
  }
}

fs.writeFileSync('public/admin.js', adminCode, 'utf8');
console.log('admin.js: ' + aChanges + ' changes');

console.log('\n=== SUCCESS ===');
console.log('Total: ' + (sChanges + aChanges) + ' changes');
console.log('');
console.log('User buttons:  Мой заказ | Связаться с нами | О нас');
console.log('Admin buttons: Мой заказ | Связаться с нами | О нас | Новые заказы | Админ-панель');
console.log('');
console.log('Now run push.bat!');
