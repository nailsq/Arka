var fs = require('fs');
var filePath = 'server.js';
var code = fs.readFileSync(filePath, 'utf8');
var original = code;

// =============================================
// STEP 1: Add telegramApiCall helper after sendTelegramMessage function
// =============================================

var marker1 = '// ============================================================\n// HELPERS\n// ============================================================';
if (code.indexOf(marker1) === -1) {
  marker1 = '// ============================================================\r\n// HELPERS\r\n// ============================================================';
}
if (code.indexOf(marker1) === -1) {
  // Try flexible search
  var idx1 = code.indexOf('// HELPERS');
  if (idx1 === -1) { console.error('STEP 1 FAILED: Could not find HELPERS section'); process.exit(1); }
  var blockStart = code.lastIndexOf('// ====', idx1);
  var blockEnd = code.indexOf('\n', code.indexOf('// ====', idx1 + 1));
  marker1 = code.substring(blockStart, blockEnd + 1);
}

var helperCode = '// ============================================================\n' +
'// TELEGRAM BOT: API helpers\n' +
'// ============================================================\n' +
'\n' +
'var adminReplyState = {};\n' +
'\n' +
'function telegramApiCall(method, body) {\n' +
'  return new Promise(function (resolve, reject) {\n' +
'    if (!BOT_TOKEN || BOT_TOKEN === \'YOUR_BOT_TOKEN_HERE\') return resolve(null);\n' +
'    var data = JSON.stringify(body);\n' +
'    var options = {\n' +
'      hostname: \'api.telegram.org\',\n' +
'      path: \'/bot\' + BOT_TOKEN + \'/\' + method,\n' +
'      method: \'POST\',\n' +
'      headers: { \'Content-Type\': \'application/json\', \'Content-Length\': Buffer.byteLength(data) }\n' +
'    };\n' +
'    var req = https.request(options, function (res) {\n' +
'      var chunks = [];\n' +
'      res.on(\'data\', function (c) { chunks.push(c); });\n' +
'      res.on(\'end\', function () {\n' +
'        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { resolve(null); }\n' +
'      });\n' +
'    });\n' +
'    req.on(\'error\', function (err) { console.error(\'[TG API] Error:\', err.message); resolve(null); });\n' +
'    req.write(data);\n' +
'    req.end();\n' +
'  });\n' +
'}\n' +
'\n' +
'var BOT_MAIN_KEYBOARD = JSON.stringify({\n' +
'  keyboard: [\n' +
'    [{ text: \'\\u041c\\u043e\\u0438 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b\' }, { text: \'\\u0421\\u0432\\u044f\\u0437\\u0430\\u0442\\u044c\\u0441\\u044f \\u0441 \\u043d\\u0430\\u043c\\u0438\' }],\n' +
'    [{ text: \'\\u041e \\u043d\\u0430\\u0441\' }]\n' +
'  ],\n' +
'  resize_keyboard: true,\n' +
'  is_persistent: true\n' +
'});\n' +
'\n' +
marker1;

code = code.replace(marker1, helperCode);
console.log('STEP 1 OK: Added telegramApiCall helper');

// =============================================
// STEP 2: Add webhook endpoint before "SERVE ADMIN PAGE"
// =============================================

var marker2 = '// SERVE ADMIN PAGE';
var idx2 = code.indexOf(marker2);
if (idx2 === -1) { console.error('STEP 2 FAILED: Could not find SERVE ADMIN PAGE'); process.exit(1); }

var blockStart2 = code.lastIndexOf('// ====', idx2);
var fullMarker2 = code.substring(blockStart2);
var endOfBlock2 = fullMarker2.indexOf('\n', fullMarker2.indexOf('\n', fullMarker2.indexOf('\n') + 1) + 1);
fullMarker2 = code.substring(blockStart2, blockStart2 + endOfBlock2 + 1);

var webhookEndpoint =
'// ============================================================\n' +
'// TELEGRAM BOT: Webhook handler\n' +
'// ============================================================\n' +
'\n' +
'app.post(\'/api/telegram/webhook\', async function (req, res) {\n' +
'  res.json({ ok: true });\n' +
'\n' +
'  try {\n' +
'    var update = req.body;\n' +
'\n' +
'    if (update.callback_query) {\n' +
'      var cbq = update.callback_query;\n' +
'      var cbChatId = cbq.from.id;\n' +
'      var cbData = cbq.data;\n' +
'\n' +
'      await telegramApiCall(\'answerCallbackQuery\', { callback_query_id: cbq.id });\n' +
'\n' +
'      if (cbData.indexOf(\'reply_\') === 0) {\n' +
'        var targetChatId = cbData.replace(\'reply_\', \'\');\n' +
'        adminReplyState[String(cbChatId)] = targetChatId;\n' +
'        await telegramApiCall(\'sendMessage\', {\n' +
'          chat_id: cbChatId,\n' +
'          text: \'\\u041d\\u0430\\u043f\\u0438\\u0448\\u0438\\u0442\\u0435 \\u043e\\u0442\\u0432\\u0435\\u0442 \\u2014 \\u0441\\u043b\\u0435\\u0434\\u0443\\u044e\\u0449\\u0435\\u0435 \\u0441\\u043e\\u043e\\u0431\\u0449\\u0435\\u043d\\u0438\\u0435 \\u0431\\u0443\\u0434\\u0435\\u0442 \\u043e\\u0442\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d\\u043e \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0443.\\n\\n\\u0414\\u043b\\u044f \\u043e\\u0442\\u043c\\u0435\\u043d\\u044b: /cancel\'\n' +
'        });\n' +
'      }\n' +
'      return;\n' +
'    }\n' +
'\n' +
'    if (update.message) {\n' +
'      var tgMsg = update.message;\n' +
'      var tgChatId = tgMsg.chat.id;\n' +
'      var tgText = tgMsg.text || \'\';\n' +
'      var tgFirstName = (tgMsg.from && tgMsg.from.first_name) || \'\';\n' +
'      var tgUsername = (tgMsg.from && tgMsg.from.username) || \'\';\n' +
'      var tgIsAdmin = await isAdminUser(String(tgChatId), tgUsername);\n' +
'\n' +
'      if (tgText === \'/start\') {\n' +
'        await telegramApiCall(\'sendMessage\', {\n' +
'          chat_id: tgChatId,\n' +
'          text: \'<b>\\u0414\\u043e\\u0431\\u0440\\u043e \\u043f\\u043e\\u0436\\u0430\\u043b\\u043e\\u0432\\u0430\\u0442\\u044c \\u0432 ARKA STUDIO FLOWERS!</b>\\n\\n\\u0417\\u0434\\u0435\\u0441\\u044c \\u0432\\u044b \\u043c\\u043e\\u0436\\u0435\\u0442\\u0435 \\u0437\\u0430\\u043a\\u0430\\u0437\\u0430\\u0442\\u044c \\u043a\\u0440\\u0430\\u0441\\u0438\\u0432\\u044b\\u0435 \\u0431\\u0443\\u043a\\u0435\\u0442\\u044b \\u0438 \\u0446\\u0432\\u0435\\u0442\\u043e\\u0447\\u043d\\u044b\\u0435 \\u043a\\u043e\\u043c\\u043f\\u043e\\u0437\\u0438\\u0446\\u0438\\u0438.\\n\\n\\u0418\\u0441\\u043f\\u043e\\u043b\\u044c\\u0437\\u0443\\u0439\\u0442\\u0435 \\u043a\\u043d\\u043e\\u043f\\u043a\\u0438 \\u043d\\u0438\\u0436\\u0435 \\u0438\\u043b\\u0438 \\u043d\\u0430\\u0436\\u043c\\u0438\\u0442\\u0435 \\u041a\\u0410\\u0422\\u0410\\u041b\\u041e\\u0413 \\u0434\\u043b\\u044f \\u043e\\u0442\\u043a\\u0440\\u044b\\u0442\\u0438\\u044f \\u043c\\u0430\\u0433\\u0430\\u0437\\u0438\\u043d\\u0430.\',\n' +
'          parse_mode: \'HTML\',\n' +
'          reply_markup: BOT_MAIN_KEYBOARD\n' +
'        });\n' +
'        return;\n' +
'      }\n' +
'\n' +
'      if (tgText === \'\\u041c\\u043e\\u0438 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b\' || tgText === \'/orders\') {\n' +
'        var ordUser = await db.prepare(\'SELECT * FROM users WHERE telegram_id = ?\').get(String(tgChatId));\n' +
'        if (!ordUser) {\n' +
'          await telegramApiCall(\'sendMessage\', { chat_id: tgChatId, text: \'\\u0423 \\u0432\\u0430\\u0441 \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0435\\u0442 \\u0437\\u0430\\u043a\\u0430\\u0437\\u043e\\u0432. \\u041e\\u0442\\u043a\\u0440\\u043e\\u0439\\u0442\\u0435 \\u043c\\u0430\\u0433\\u0430\\u0437\\u0438\\u043d \\u0447\\u0435\\u0440\\u0435\\u0437 \\u043a\\u043d\\u043e\\u043f\\u043a\\u0443 \\u041a\\u0410\\u0422\\u0410\\u041b\\u041e\\u0413!\', reply_markup: BOT_MAIN_KEYBOARD });\n' +
'          return;\n' +
'        }\n' +
'        var ordList = await db.prepare(\'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5\').all(ordUser.id);\n' +
'        if (!ordList.length) {\n' +
'          await telegramApiCall(\'sendMessage\', { chat_id: tgChatId, text: \'\\u0423 \\u0432\\u0430\\u0441 \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0435\\u0442 \\u0437\\u0430\\u043a\\u0430\\u0437\\u043e\\u0432. \\u041e\\u0442\\u043a\\u0440\\u043e\\u0439\\u0442\\u0435 \\u043c\\u0430\\u0433\\u0430\\u0437\\u0438\\u043d \\u0447\\u0435\\u0440\\u0435\\u0437 \\u043a\\u043d\\u043e\\u043f\\u043a\\u0443 \\u041a\\u0410\\u0422\\u0410\\u041b\\u041e\\u0413!\', reply_markup: BOT_MAIN_KEYBOARD });\n' +
'          return;\n' +
'        }\n' +
'        var ordMsg = \'<b>\\u0412\\u0430\\u0448\\u0438 \\u043f\\u043e\\u0441\\u043b\\u0435\\u0434\\u043d\\u0438\\u0435 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b:</b>\\n\\n\';\n' +
'        for (var oi = 0; oi < ordList.length; oi++) {\n' +
'          var oo = ordList[oi];\n' +
'          ordMsg += \'\\u0417\\u0430\\u043a\\u0430\\u0437 #\' + oo.id + \' \\u2014 \' + oo.total_amount + \' \\u0440\\u0443\\u0431.\\n\';\n' +
'          ordMsg += \'\\u0421\\u0442\\u0430\\u0442\\u0443\\u0441: <b>\' + (oo.status || \'\\u041d\\u043e\\u0432\\u044b\\u0439\') + \'</b>\\n\';\n' +
'          if (oo.delivery_date) ordMsg += \'\\u0414\\u0430\\u0442\\u0430: \' + oo.delivery_date + \'\\n\';\n' +
'          ordMsg += \'\\n\';\n' +
'        }\n' +
'        await telegramApiCall(\'sendMessage\', { chat_id: tgChatId, text: ordMsg, parse_mode: \'HTML\', reply_markup: BOT_MAIN_KEYBOARD });\n' +
'        return;\n' +
'      }\n' +
'\n' +
'      if (tgText === \'\\u0421\\u0432\\u044f\\u0437\\u0430\\u0442\\u044c\\u0441\\u044f \\u0441 \\u043d\\u0430\\u043c\\u0438\') {\n' +
'        await telegramApiCall(\'sendMessage\', {\n' +
'          chat_id: tgChatId,\n' +
'          text: \'<b>\\u0421\\u0432\\u044f\\u0437\\u0430\\u0442\\u044c\\u0441\\u044f \\u0441 \\u043d\\u0430\\u043c\\u0438</b>\\n\\n\\u041d\\u0430\\u043f\\u0438\\u0448\\u0438\\u0442\\u0435 \\u0432\\u0430\\u0448\\u0435 \\u0441\\u043e\\u043e\\u0431\\u0449\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u044f\\u043c\\u043e \\u0441\\u044e\\u0434\\u0430 \\u2014 \\u043c\\u044b \\u043f\\u043e\\u043b\\u0443\\u0447\\u0438\\u043c \\u0435\\u0433\\u043e \\u0438 \\u043e\\u0442\\u0432\\u0435\\u0442\\u0438\\u043c \\u0432\\u0430\\u043c!\',\n' +
'          parse_mode: \'HTML\',\n' +
'          reply_markup: BOT_MAIN_KEYBOARD\n' +
'        });\n' +
'        return;\n' +
'      }\n' +
'\n' +
'      if (tgText === \'\\u041e \\u043d\\u0430\\u0441\') {\n' +
'        var aboutText = await getSetting(\'about_text\');\n' +
'        if (!aboutText) {\n' +
'          aboutText = \'<b>ARKA STUDIO FLOWERS</b>\\n\\n\\u041c\\u044b \\u0441\\u043e\\u0437\\u0434\\u0430\\u0451\\u043c \\u043a\\u0440\\u0430\\u0441\\u0438\\u0432\\u044b\\u0435 \\u0431\\u0443\\u043a\\u0435\\u0442\\u044b \\u0438 \\u0446\\u0432\\u0435\\u0442\\u043e\\u0447\\u043d\\u044b\\u0435 \\u043a\\u043e\\u043c\\u043f\\u043e\\u0437\\u0438\\u0446\\u0438\\u0438.\\n\\n\\u041e\\u0442\\u043a\\u0440\\u043e\\u0439\\u0442\\u0435 \\u041a\\u0410\\u0422\\u0410\\u041b\\u041e\\u0413, \\u0447\\u0442\\u043e\\u0431\\u044b \\u043f\\u043e\\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u0442\\u044c \\u043d\\u0430\\u0448\\u0438 \\u0440\\u0430\\u0431\\u043e\\u0442\\u044b!\';\n' +
'        }\n' +
'        await telegramApiCall(\'sendMessage\', { chat_id: tgChatId, text: aboutText, parse_mode: \'HTML\', reply_markup: BOT_MAIN_KEYBOARD });\n' +
'        return;\n' +
'      }\n' +
'\n' +
'      if (tgText === \'/help\') {\n' +
'        await telegramApiCall(\'sendMessage\', {\n' +
'          chat_id: tgChatId,\n' +
'          text: \'<b>\\u041f\\u043e\\u043c\\u043e\\u0449\\u044c</b>\\n\\n\\u041a\\u0410\\u0422\\u0410\\u041b\\u041e\\u0413 \\u2014 \\u043e\\u0442\\u043a\\u0440\\u043e\\u0435\\u0442\\u0441\\u044f \\u043c\\u0430\\u0433\\u0430\\u0437\\u0438\\u043d\\n\\u041c\\u043e\\u0438 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b \\u2014 \\u0441\\u0442\\u0430\\u0442\\u0443\\u0441 \\u0437\\u0430\\u043a\\u0430\\u0437\\u043e\\u0432\\n\\u0421\\u0432\\u044f\\u0437\\u0430\\u0442\\u044c\\u0441\\u044f \\u0441 \\u043d\\u0430\\u043c\\u0438 \\u2014 \\u043d\\u0430\\u043f\\u0438\\u0441\\u0430\\u0442\\u044c \\u0441\\u043e\\u043e\\u0431\\u0449\\u0435\\u043d\\u0438\\u0435\\n\\u041e \\u043d\\u0430\\u0441 \\u2014 \\u0438\\u043d\\u0444\\u043e\\u0440\\u043c\\u0430\\u0446\\u0438\\u044f\\n\\n\\u0418\\u043b\\u0438 \\u043f\\u0440\\u043e\\u0441\\u0442\\u043e \\u043d\\u0430\\u043f\\u0438\\u0448\\u0438\\u0442\\u0435 \\u0441\\u043e\\u043e\\u0431\\u0449\\u0435\\u043d\\u0438\\u0435 \\u2014 \\u043c\\u044b \\u043e\\u0442\\u0432\\u0435\\u0442\\u0438\\u043c!\',\n' +
'          parse_mode: \'HTML\',\n' +
'          reply_markup: BOT_MAIN_KEYBOARD\n' +
'        });\n' +
'        return;\n' +
'      }\n' +
'\n' +
'      if (tgText === \'/cancel\' && tgIsAdmin) {\n' +
'        delete adminReplyState[String(tgChatId)];\n' +
'        await telegramApiCall(\'sendMessage\', { chat_id: tgChatId, text: \'\\u0420\\u0435\\u0436\\u0438\\u043c \\u043e\\u0442\\u0432\\u0435\\u0442\\u0430 \\u043e\\u0442\\u043c\\u0435\\u043d\\u0451\\u043d.\' });\n' +
'        return;\n' +
'      }\n' +
'\n' +
'      if (tgIsAdmin && adminReplyState[String(tgChatId)]) {\n' +
'        var replyTargetId = adminReplyState[String(tgChatId)];\n' +
'        delete adminReplyState[String(tgChatId)];\n' +
'        await telegramApiCall(\'sendMessage\', {\n' +
'          chat_id: replyTargetId,\n' +
'          text: \'<b>\\u041e\\u0442\\u0432\\u0435\\u0442 \\u043e\\u0442 ARKA STUDIO:</b>\\n\\n\' + tgText,\n' +
'          parse_mode: \'HTML\'\n' +
'        });\n' +
'        await telegramApiCall(\'sendMessage\', {\n' +
'          chat_id: tgChatId,\n' +
'          text: \'\\u0421\\u043e\\u043e\\u0431\\u0449\\u0435\\u043d\\u0438\\u0435 \\u043e\\u0442\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d\\u043e \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0443!\'\n' +
'        });\n' +
'        return;\n' +
'      }\n' +
'\n' +
'      if (!tgIsAdmin && tgText && tgText[0] !== \'/\') {\n' +
'        var displayName = tgFirstName;\n' +
'        if (tgUsername) displayName += \' (@\' + tgUsername + \')\';\n' +
'\n' +
'        var adminNotif = \'<b>\\u041d\\u043e\\u0432\\u043e\\u0435 \\u0441\\u043e\\u043e\\u0431\\u0449\\u0435\\u043d\\u0438\\u0435</b>\\n\' +\n' +
'          \'\\u041e\\u0442: \' + displayName + \'\\n\' +\n' +
'          \'ID: <code>\' + tgChatId + \'</code>\\n\\n\' +\n' +
'          tgText;\n' +
'\n' +
'        var replyBtns = [[{ text: \'\\u041e\\u0442\\u0432\\u0435\\u0442\\u0438\\u0442\\u044c\', callback_data: \'reply_\' + tgChatId }]];\n' +
'\n' +
'        for (var ai = 0; ai < ADMIN_TELEGRAM_IDS.length; ai++) {\n' +
'          await telegramApiCall(\'sendMessage\', {\n' +
'            chat_id: ADMIN_TELEGRAM_IDS[ai],\n' +
'            text: adminNotif,\n' +
'            parse_mode: \'HTML\',\n' +
'            reply_markup: JSON.stringify({ inline_keyboard: replyBtns })\n' +
'          });\n' +
'        }\n' +
'\n' +
'        var dbAdmins = await db.prepare(\'SELECT telegram_id FROM admin_users WHERE telegram_id IS NOT NULL\').all();\n' +
'        for (var di = 0; di < dbAdmins.length; di++) {\n' +
'          if (!ADMIN_TELEGRAM_IDS.includes(dbAdmins[di].telegram_id)) {\n' +
'            await telegramApiCall(\'sendMessage\', {\n' +
'              chat_id: dbAdmins[di].telegram_id,\n' +
'              text: adminNotif,\n' +
'              parse_mode: \'HTML\',\n' +
'              reply_markup: JSON.stringify({ inline_keyboard: replyBtns })\n' +
'            });\n' +
'          }\n' +
'        }\n' +
'\n' +
'        await telegramApiCall(\'sendMessage\', {\n' +
'          chat_id: tgChatId,\n' +
'          text: \'\\u0412\\u0430\\u0448\\u0435 \\u0441\\u043e\\u043e\\u0431\\u0449\\u0435\\u043d\\u0438\\u0435 \\u043f\\u043e\\u043b\\u0443\\u0447\\u0435\\u043d\\u043e! \\u041c\\u044b \\u043e\\u0442\\u0432\\u0435\\u0442\\u0438\\u043c \\u0432\\u0430\\u043c \\u0432 \\u0431\\u043b\\u0438\\u0436\\u0430\\u0439\\u0448\\u0435\\u0435 \\u0432\\u0440\\u0435\\u043c\\u044f.\',\n' +
'          reply_markup: BOT_MAIN_KEYBOARD\n' +
'        });\n' +
'        return;\n' +
'      }\n' +
'    }\n' +
'  } catch (err) {\n' +
'    console.error(\'[TG Bot] Webhook error:\', err.message);\n' +
'  }\n' +
'});\n' +
'\n';

// Find the exact SERVE ADMIN PAGE block
var serveIdx = code.indexOf('// SERVE ADMIN PAGE');
if (serveIdx === -1) { console.error('STEP 2 FAILED: Could not find SERVE ADMIN PAGE'); process.exit(1); }
var linesBefore = code.lastIndexOf('\n', code.lastIndexOf('// ====', serveIdx)) ;
var linesAfter = code.indexOf('\n', serveIdx);
// insert webhook code before the SERVE ADMIN PAGE block
var insertPoint = code.lastIndexOf('// ====', serveIdx);
code = code.substring(0, insertPoint) + webhookEndpoint + code.substring(insertPoint);
console.log('STEP 2 OK: Added webhook endpoint');

// =============================================
// STEP 3: Add registerTelegramBotWebhook function before start().catch
// =============================================

var marker3 = 'start().catch(function (err) {';
var idx3 = code.indexOf(marker3);
if (idx3 === -1) { console.error('STEP 3 FAILED: Could not find start().catch'); process.exit(1); }

var botRegistrationFunc = 'async function registerTelegramBotWebhook() {\n' +
'  try {\n' +
'    var webhookUrl = PUBLIC_URL.replace(/^http:\\/\\//, \'https://\') + \'/api/telegram/webhook\';\n' +
'    console.log(\'[TG Bot] Setting webhook: \' + webhookUrl);\n' +
'\n' +
'    var result = await telegramApiCall(\'setWebhook\', { url: webhookUrl });\n' +
'    console.log(\'[TG Bot] Webhook result:\', JSON.stringify(result));\n' +
'\n' +
'    await telegramApiCall(\'setMyCommands\', {\n' +
'      commands: [\n' +
'        { command: \'start\', description: \'Главное меню\' },\n' +
'        { command: \'orders\', description: \'Мои заказы\' },\n' +
'        { command: \'help\', description: \'Помощь\' }\n' +
'      ]\n' +
'    });\n' +
'    console.log(\'[TG Bot] Commands set\');\n' +
'  } catch (err) {\n' +
'    console.error(\'[TG Bot] Setup error:\', err.message);\n' +
'  }\n' +
'}\n' +
'\n';

code = code.substring(0, idx3) + botRegistrationFunc + code.substring(idx3);
console.log('STEP 3 OK: Added registerTelegramBotWebhook function');

// =============================================
// STEP 4: Call registerTelegramBotWebhook in start()
// =============================================

var tochkaMarker = 'setTimeout(function () { registerTochkaWebhook(); }, 5000);';
var idx4 = code.indexOf(tochkaMarker);
if (idx4 === -1) { console.error('STEP 4 FAILED: Could not find registerTochkaWebhook call'); process.exit(1); }

// Find the closing } of the if block after tochkaMarker
var afterTochka = code.indexOf('}', idx4 + tochkaMarker.length);
var insertAfter = afterTochka + 1;

var botStartCall = '\n\n    if (BOT_TOKEN && BOT_TOKEN !== \'YOUR_BOT_TOKEN_HERE\' && PUBLIC_URL) {\n' +
'      setTimeout(function () { registerTelegramBotWebhook(); }, 3000);\n' +
'    }';

code = code.substring(0, insertAfter) + botStartCall + code.substring(insertAfter);
console.log('STEP 4 OK: Added bot webhook registration to start()');

// =============================================
// WRITE
// =============================================

if (code === original) {
  console.error('ERROR: No changes were made!');
  process.exit(1);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('\n=== SUCCESS ===');
console.log('All 4 steps completed.');
console.log('Now run push.bat to deploy!');
