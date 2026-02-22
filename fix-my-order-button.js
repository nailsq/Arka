var fs = require('fs');
var filePath = 'server.js';
var code = fs.readFileSync(filePath, 'utf8');
var changes = 0;

// =============================================
// STEP 1: Rename button "Мои заказы" -> "Мой заказ" in keyboard
// =============================================
var oldBtn = "{ text: '\\u041c\\u043e\\u0438 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b' }";
var newBtn = "{ text: '\\u041c\\u043e\\u0439 \\u0437\\u0430\\u043a\\u0430\\u0437' }";
if (code.indexOf(oldBtn) !== -1) {
  code = code.replace(oldBtn, newBtn);
  changes++;
  console.log('STEP 1a OK: Keyboard button renamed');
} else {
  // Try direct Cyrillic
  var oldBtnCyr = "{ text: '\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b' }";
  var newBtnCyr = "{ text: '\u041c\u043e\u0439 \u0437\u0430\u043a\u0430\u0437' }";
  if (code.indexOf(oldBtnCyr) !== -1) {
    code = code.replace(oldBtnCyr, newBtnCyr);
    changes++;
    console.log('STEP 1a OK: Keyboard button renamed (cyrillic)');
  } else {
    console.error('STEP 1a WARN: Could not find button text to rename');
  }
}

// =============================================
// STEP 2: Update the condition that checks button text
// =============================================
// Old: if (tgText === 'Мои заказы' || tgText === '/orders')
// New: if (tgText === 'Мой заказ' || tgText === '/orders')
var oldCond = "tgText === '\\u041c\\u043e\\u0438 \\u0437\\u0430\\u043a\\u0430\\u0437\\u044b'";
var newCond = "tgText === '\\u041c\\u043e\\u0439 \\u0437\\u0430\\u043a\\u0430\\u0437'";
if (code.indexOf(oldCond) !== -1) {
  code = code.replace(oldCond, newCond);
  changes++;
  console.log('STEP 2 OK: Condition updated');
} else {
  var oldCondCyr = "tgText === '\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b'";
  var newCondCyr = "tgText === '\u041c\u043e\u0439 \u0437\u0430\u043a\u0430\u0437'";
  if (code.indexOf(oldCondCyr) !== -1) {
    code = code.replace(oldCondCyr, newCondCyr);
    changes++;
    console.log('STEP 2 OK: Condition updated (cyrillic)');
  } else {
    console.error('STEP 2 FAILED: Could not find condition');
    process.exit(1);
  }
}

// =============================================
// STEP 3: Replace the entire orders handler block
// =============================================
// Find the block from the condition to 'return;\n      }\n'
// We need to find the orders handler and replace its body

var handlerStart = code.indexOf("|| tgText === '/orders')");
if (handlerStart === -1) { console.error('STEP 3 FAILED: Could not find /orders handler'); process.exit(1); }

// Find the start of the if line
var ifLineStart = code.lastIndexOf('if (', handlerStart);
// Find the matching closing: return;\n      }\n
// After this handler block there should be the next if block for "Связаться с нами"
var nextHandler = code.indexOf("tgText === '\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f", handlerStart);
if (nextHandler === -1) {
  nextHandler = code.indexOf("tgText === '\\u0421\\u0432\\u044f\\u0437\\u0430\\u0442\\u044c\\u0441\\u044f", handlerStart);
}
if (nextHandler === -1) { console.error('STEP 3 FAILED: Could not find next handler block'); process.exit(1); }

// Go back to find the "if (" of the next handler
var nextIfStart = code.lastIndexOf('if (', nextHandler);
// The block we want to replace ends just before the next if
var blockEnd = code.lastIndexOf('\n', nextIfStart);

// Extract and replace the block
var oldBlock = code.substring(ifLineStart, blockEnd + 1);

var activeStatuses = "['\\u041d\\u043e\\u0432\\u044b\\u0439', '\\u041e\\u043f\\u043b\\u0430\\u0447\\u0435\\u043d', '\\u0421\\u043e\\u0431\\u0438\\u0440\\u0430\\u0435\\u0442\\u0441\\u044f', '\\u0421\\u043e\\u0431\\u0440\\u0430\\u043d', '\\u041e\\u0442\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d', '\\u0413\\u043e\\u0442\\u043e\\u0432 \\u043a \\u0432\\u044b\\u0434\\u0430\\u0447\\u0435']";

var newBlock = "if (tgText === '\u041c\u043e\u0439 \u0437\u0430\u043a\u0430\u0437' || tgText === '/orders') {\n" +
"        var ordUser = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(tgChatId));\n" +
"        if (!ordUser) {\n" +
"          await telegramApiCall('sendMessage', { chat_id: tgChatId, text: '\u0423 \u0432\u0430\u0441 \u043d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u043e\u0432.', reply_markup: BOT_MAIN_KEYBOARD });\n" +
"          return;\n" +
"        }\n" +
"        var activeStatuses = ['\u041d\u043e\u0432\u044b\u0439', '\u041e\u043f\u043b\u0430\u0447\u0435\u043d', '\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f', '\u0421\u043e\u0431\u0440\u0430\u043d', '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d', '\u0413\u043e\u0442\u043e\u0432 \u043a \u0432\u044b\u0434\u0430\u0447\u0435'];\n" +
"        var activeOrder = await db.prepare(\n" +
"          \"SELECT * FROM orders WHERE user_id = ? AND status IN ('\" + activeStatuses.join(\"','\") + \"') ORDER BY created_at DESC LIMIT 1\"\n" +
"        ).get(ordUser.id);\n" +
"\n" +
"        if (!activeOrder) {\n" +
"          await telegramApiCall('sendMessage', { chat_id: tgChatId, text: '\u0423 \u0432\u0430\u0441 \u043d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u043e\u0432.', reply_markup: BOT_MAIN_KEYBOARD });\n" +
"          return;\n" +
"        }\n" +
"\n" +
"        var isPickup = activeOrder.delivery_type === 'pickup';\n" +
"        var stages;\n" +
"        if (isPickup) {\n" +
"          stages = ['\u041d\u043e\u0432\u044b\u0439', '\u041e\u043f\u043b\u0430\u0447\u0435\u043d', '\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f', '\u0421\u043e\u0431\u0440\u0430\u043d', '\u0413\u043e\u0442\u043e\u0432 \u043a \u0432\u044b\u0434\u0430\u0447\u0435'];\n" +
"        } else {\n" +
"          stages = ['\u041d\u043e\u0432\u044b\u0439', '\u041e\u043f\u043b\u0430\u0447\u0435\u043d', '\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f', '\u0421\u043e\u0431\u0440\u0430\u043d', '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d', '\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d'];\n" +
"        }\n" +
"\n" +
"        var currentIdx = stages.indexOf(activeOrder.status);\n" +
"        if (currentIdx === -1) currentIdx = 0;\n" +
"\n" +
"        var ordMsg = '<b>\u0417\u0430\u043a\u0430\u0437 #' + activeOrder.id + '</b> \\u2014 ' + activeOrder.total_amount + ' \u0440\u0443\u0431.\\n';\n" +
"        if (activeOrder.delivery_date) ordMsg += '\u0414\u0430\u0442\u0430: ' + activeOrder.delivery_date + '\\n';\n" +
"        if (isPickup) { ordMsg += '\u0422\u0438\u043f: \u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437\\n'; }\n" +
"        else if (activeOrder.delivery_address) { ordMsg += '\u0410\u0434\u0440\u0435\u0441: ' + activeOrder.delivery_address + '\\n'; }\n" +
"        ordMsg += '\\n<b>\u042d\u0442\u0430\u043f\u044b \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f:</b>\\n\\n';\n" +
"\n" +
"        for (var si = 0; si < stages.length; si++) {\n" +
"          if (si < currentIdx) {\n" +
"            ordMsg += '  [+] ' + stages[si] + '\\n';\n" +
"          } else if (si === currentIdx) {\n" +
"            ordMsg += '  [>] ' + stages[si] + '  <--\\n';\n" +
"          } else {\n" +
"            ordMsg += '  [   ] ' + stages[si] + '\\n';\n" +
"          }\n" +
"        }\n" +
"\n" +
"        await telegramApiCall('sendMessage', { chat_id: tgChatId, text: ordMsg, parse_mode: 'HTML', reply_markup: BOT_MAIN_KEYBOARD });\n" +
"        return;\n" +
"      }\n";

code = code.replace(oldBlock, newBlock);
changes++;
console.log('STEP 3 OK: Orders handler replaced with active order + stages');

// =============================================
// STEP 4: Update /help text reference
// =============================================
var oldHelp = '\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b \u2014 \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043a\u0430\u0437\u043e\u0432';
var newHelp = '\u041c\u043e\u0439 \u0437\u0430\u043a\u0430\u0437 \u2014 \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043a\u0430\u0437\u0430';
if (code.indexOf(oldHelp) !== -1) {
  code = code.replace(oldHelp, newHelp);
  changes++;
  console.log('STEP 4 OK: Help text updated');
} else {
  console.log('STEP 4 SKIP: Help text not found (may already be updated)');
}

// =============================================
// STEP 5: Update /orders command description
// =============================================
var oldDesc = "{ command: 'orders', description: '\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b' }";
var newDesc = "{ command: 'orders', description: '\u041c\u043e\u0439 \u0437\u0430\u043a\u0430\u0437' }";
if (code.indexOf(oldDesc) !== -1) {
  code = code.replace(oldDesc, newDesc);
  changes++;
  console.log('STEP 5 OK: Command description updated');
} else {
  console.log('STEP 5 SKIP: Command description not found');
}

// =============================================
// WRITE
// =============================================
if (changes === 0) {
  console.error('ERROR: No changes were made!');
  process.exit(1);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('\n=== SUCCESS ===');
console.log(changes + ' changes applied.');
console.log('Button: "Мой заказ"');
console.log('Shows active order with stages. If none: "У вас нет активных заказов."');
console.log('Now run push.bat to deploy!');
