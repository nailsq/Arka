var fs = require('fs');
var path = require('path');

var file = path.join(__dirname, 'server.js');
var src = fs.readFileSync(file, 'utf8');
var changed = false;

// 1. Add ADMIN_BOT_TOKEN variable declaration
if (src.indexOf('ADMIN_BOT_TOKEN') === -1) {
  src = src.replace(
    "var BOT_TOKEN = process.env.BOT_TOKEN || '';\n",
    "var BOT_TOKEN = process.env.BOT_TOKEN || '';\nvar ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN || '';\n"
  );
  changed = true;
  console.log('1. Added ADMIN_BOT_TOKEN variable declaration');
} else {
  console.log('1. ADMIN_BOT_TOKEN already present');
}

// 2. Add adminBotApiCall function (before BOT_MAIN_KEYBOARD)
if (src.indexOf('function adminBotApiCall') === -1) {
  var fn = `function adminBotApiCall(method, body) {
  return new Promise(function (resolve, reject) {
    if (!ADMIN_BOT_TOKEN) return resolve(null);
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
    req.on('error', function (err) { console.error('[Admin Bot API] Error:', err.message); resolve(null); });
    req.write(data);
    req.end();
  });
}\n\n`;
  src = src.replace('var BOT_MAIN_KEYBOARD', fn + 'var BOT_MAIN_KEYBOARD');
  changed = true;
  console.log('2. Added adminBotApiCall function');
} else {
  console.log('2. adminBotApiCall already present');
}

// 3. Modify notifyAdminsNewOrder to use admin bot
if (src.indexOf('var useAdminBot') === -1) {
  src = src.replace(
    "async function notifyAdminsNewOrder(order) {\n  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return;",
    "async function notifyAdminsNewOrder(order) {\n  var useAdminBot = !!ADMIN_BOT_TOKEN;\n  var sendFn = useAdminBot ? adminBotApiCall : telegramApiCall;\n  var logPrefix = useAdminBot ? '[Admin Bot]' : '[TG Bot]';\n  if (!useAdminBot && (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE')) return;"
  );
  changed = true;
  console.log('3. Modified notifyAdminsNewOrder header');
} else {
  console.log('3. notifyAdminsNewOrder header already modified');
}

// 4. Change button from url to web_app in notifyAdminsNewOrder
if (src.indexOf("text: '\\u041e\\u0442\\u043a\\u0440\\u044b\\u0442\\u044c \\u0437\\u0430\\u043a\\u0430\\u0437', url: adminUrl") !== -1) {
  src = src.replace(
    "text: '\\u041e\\u0442\\u043a\\u0440\\u044b\\u0442\\u044c \\u0437\\u0430\\u043a\\u0430\\u0437', url: adminUrl",
    "text: '\\u041e\\u0442\\u043a\\u0440\\u044b\\u0442\\u044c \\u0437\\u0430\\u043a\\u0430\\u0437', web_app: { url: adminUrl }"
  );
  changed = true;
  console.log('4. Changed button from url to web_app');
} else {
  console.log('4. Button already web_app or not found');
}

// 5. Replace telegramApiCall with sendFn in notifyAdminsNewOrder
var notifyStart = src.indexOf('async function notifyAdminsNewOrder');
var notifyEnd = src.indexOf("\n}\n", notifyStart + 50);
if (notifyStart !== -1 && notifyEnd !== -1) {
  var notifyBlock = src.substring(notifyStart, notifyEnd + 3);
  var newBlock = notifyBlock
    .replace(/await telegramApiCall\('sendMessage'/g, "await sendFn('sendMessage'")
    .replace(/console\.log\('\[TG Bot\] Admin notification/g, "console.log(logPrefix + ' Admin notification")
    .replace(/console\.error\('\[TG Bot\] Admin notification/g, "console.error(logPrefix + ' Admin notification");
  if (newBlock !== notifyBlock) {
    src = src.substring(0, notifyStart) + newBlock + src.substring(notifyStart + notifyBlock.length);
    changed = true;
    console.log('5. Replaced telegramApiCall with sendFn in notifyAdminsNewOrder');
  } else {
    console.log('5. Already using sendFn');
  }
} else {
  console.log('5. Could not find notifyAdminsNewOrder block');
}

// 6. Add admin bot webhook endpoint (before main bot webhook)
if (src.indexOf("'/api/admin-bot/webhook'") === -1) {
  var adminWebhookHandler = `app.post('/api/admin-bot/webhook', async function (req, res) {
  res.sendStatus(200);
  if (!ADMIN_BOT_TOKEN) return;
  try {
    var msg = req.body && req.body.message;
    if (!msg || !msg.text) return;
    var chatId = String(msg.chat.id);
    var isAdmin = ADMIN_TELEGRAM_IDS.includes(chatId);
    if (!isAdmin) {
      await adminBotApiCall('sendMessage', { chat_id: chatId, text: '\\u042d\\u0442\\u043e\\u0442 \\u0431\\u043e\\u0442 \\u0442\\u043e\\u043b\\u044c\\u043a\\u043e \\u0434\\u043b\\u044f \\u0430\\u0434\\u043c\\u0438\\u043d\\u0438\\u0441\\u0442\\u0440\\u0430\\u0442\\u043e\\u0440\\u043e\\u0432.' });
      return;
    }
    var text = msg.text.trim();
    if (text === '/start') {
      var adminUrl = PUBLIC_URL.replace(/^http:\\/\\//, 'https://') + '/admin';
      await adminBotApiCall('sendMessage', {
        chat_id: chatId,
        text: '\\u0414\\u043e\\u0431\\u0440\\u043e \\u043f\\u043e\\u0436\\u0430\\u043b\\u043e\\u0432\\u0430\\u0442\\u044c \\u0432 \\u043f\\u0430\\u043d\\u0435\\u043b\\u044c \\u0437\\u0430\\u043a\\u0430\\u0437\\u043e\\u0432 Arka Flowers!',
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: '\\ud83d\\udcca \\u041e\\u0442\\u043a\\u0440\\u044b\\u0442\\u044c \\u043f\\u0430\\u043d\\u0435\\u043b\\u044c', web_app: { url: adminUrl } }]]
        })
      });
    } else if (text === '/orders') {
      var recent = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 5').all();
      if (!recent.length) {
        await adminBotApiCall('sendMessage', { chat_id: chatId, text: '\\u0417\\u0430\\u043a\\u0430\\u0437\\u043e\\u0432 \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0435\\u0442.' });
      } else {
        var list = '\\u041f\\u043e\\u0441\\u043b\\u0435\\u0434\\u043d\\u0438\\u0435 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b:\\n';
        for (var i = 0; i < recent.length; i++) {
          list += '#' + recent[i].id + ' \\u2014 ' + (recent[i].status || 'new') + ' \\u2014 ' + recent[i].total + ' \\u0440\\u0443\\u0431.\\n';
        }
        await adminBotApiCall('sendMessage', { chat_id: chatId, text: list });
      }
    }
  } catch (err) {
    console.error('[Admin Bot] Webhook error:', err.message);
  }
});

`;
  src = src.replace("app.post('/api/telegram/webhook'", adminWebhookHandler + "app.post('/api/telegram/webhook'");
  changed = true;
  console.log('6. Added admin bot webhook endpoint');
} else {
  console.log('6. Admin bot webhook already present');
}

// 7. Add registerAdminBotWebhook function (before start().catch)
if (src.indexOf('function registerAdminBotWebhook') === -1) {
  var regFn = `async function registerAdminBotWebhook() {
  try {
    var webhookUrl = PUBLIC_URL.replace(/^http:\\/\\//, 'https://') + '/api/admin-bot/webhook';
    console.log('[Admin Bot] Setting webhook: ' + webhookUrl);
    var result = await adminBotApiCall('setWebhook', { url: webhookUrl });
    console.log('[Admin Bot] Webhook result:', JSON.stringify(result));
    await adminBotApiCall('setMyCommands', {
      commands: [
        { command: 'start', description: '\\u041f\\u0430\\u043d\\u0435\\u043b\\u044c \\u0443\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d\\u0438\\u044f' },
        { command: 'orders', description: '\\u041f\\u043e\\u0441\\u043b\\u0435\\u0434\\u043d\\u0438\\u0435 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b' }
      ]
    });
    console.log('[Admin Bot] Commands set');
  } catch (err) {
    console.error('[Admin Bot] Setup error:', err.message);
  }
}

`;
  src = src.replace("start().catch(", regFn + "start().catch(");
  changed = true;
  console.log('7. Added registerAdminBotWebhook function');
} else {
  console.log('7. registerAdminBotWebhook already present');
}

// 8. Add admin bot startup call in start() function
if (src.indexOf('registerAdminBotWebhook()') !== -1 && src.indexOf("setTimeout(function () { registerAdminBotWebhook()") === -1) {
  src = src.replace(
    "setTimeout(function () { registerTelegramBotWebhook(); }, 3000);\n    }",
    "setTimeout(function () { registerTelegramBotWebhook(); }, 3000);\n    }\n    if (ADMIN_BOT_TOKEN && PUBLIC_URL) {\n      setTimeout(function () { registerAdminBotWebhook(); }, 4000);\n    }"
  );
  changed = true;
  console.log('8. Added admin bot startup call');
} else if (src.indexOf("setTimeout(function () { registerAdminBotWebhook()") !== -1) {
  console.log('8. Admin bot startup call already present');
} else {
  console.log('8. Could not find place for admin bot startup call');
}

if (changed) {
  fs.writeFileSync(file, src, 'utf8');
  console.log('\nAll changes applied successfully!');
} else {
  console.log('\nNo changes needed.');
}
