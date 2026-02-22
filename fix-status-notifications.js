var fs = require('fs');
var filePath = 'server.js';
var code = fs.readFileSync(filePath, 'utf8');

var marker = "var statusEmoji = {";
var idx = code.indexOf(marker);
if (idx === -1) { console.error('FAILED: Could not find statusEmoji block'); process.exit(1); }

var tryStart = code.lastIndexOf('try {', idx);
var catchStart = code.indexOf('} catch (notifErr)', idx);
var catchEnd = code.indexOf('}', code.indexOf('}', catchStart + 1) + 1);

var oldBlock = code.substring(tryStart, catchEnd + 1);

var newBlock = "try {\n" +
"    var order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);\n" +
"    if (order && order.user_id && (newStatus === '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d' || newStatus === '\u0413\u043e\u0442\u043e\u0432 \u043a \u0432\u044b\u0434\u0430\u0447\u0435')) {\n" +
"      var u = await db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(order.user_id);\n" +
"      if (u && u.telegram_id) {\n" +
"        var msg = '';\n" +
"        if (newStatus === '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d') {\n" +
"          msg = '<b>\u0417\u0430\u043a\u0430\u0437 #' + order.id + ' \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d!</b>\\n\\n' +\n" +
"            '\u0412\u0430\u0448 \u0437\u0430\u043a\u0430\u0437 \u0443\u0436\u0435 \u0432 \u043f\u0443\u0442\u0438. \u041e\u0436\u0438\u0434\u0430\u0439\u0442\u0435 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0443!';\n" +
"          if (order.delivery_address) msg += '\\n\u0410\u0434\u0440\u0435\u0441: ' + order.delivery_address;\n" +
"          if (order.delivery_date) msg += '\\n\u0414\u0430\u0442\u0430: ' + order.delivery_date;\n" +
"          if (order.delivery_interval) msg += '\\n\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b: ' + order.delivery_interval;\n" +
"        } else {\n" +
"          msg = '<b>\u0417\u0430\u043a\u0430\u0437 #' + order.id + ' \u0433\u043e\u0442\u043e\u0432!</b>\\n\\n' +\n" +
"            '\u0412\u0430\u0448 \u0437\u0430\u043a\u0430\u0437 \u0433\u043e\u0442\u043e\u0432 \u0438 \u0436\u0434\u0451\u0442 \u0432\u0430\u0441. \u041c\u043e\u0436\u0435\u0442\u0435 \u0437\u0430\u0431\u0440\u0430\u0442\u044c \u0435\u0433\u043e \u0432 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0435.';\n" +
"        }\n" +
"        sendTelegramMessage(u.telegram_id, msg);\n" +
"      }\n" +
"    }\n" +
"  } catch (notifErr) {\n" +
"    console.error('[TG Notify] Status notification error:', notifErr.message);\n" +
"  }";

code = code.replace(oldBlock, newBlock);

if (code.indexOf('\u041e\u0436\u0438\u0434\u0430\u0439\u0442\u0435 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0443') === -1) {
  console.error('FAILED: Replacement did not apply');
  process.exit(1);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('=== SUCCESS ===');
console.log('Notifications ONLY for:');
console.log('  "Отправлен" -> "Ваш заказ уже в пути. Ожидайте доставку!"');
console.log('  "Готов к выдаче" -> "Ваш заказ готов и ждёт вас. Можете забрать его в магазине."');
console.log('  All other statuses -> NO notification');
console.log('Now run push.bat!');
