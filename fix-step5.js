var fs = require('fs');
var path = require('path');

var file = path.join(__dirname, 'server.js');
var src = fs.readFileSync(file, 'utf8');

var start = src.indexOf('async function notifyAdminsNewOrder');
if (start === -1) { console.log('ERROR: notifyAdminsNewOrder not found'); process.exit(1); }

var braceCount = 0;
var end = -1;
var inFunc = false;
for (var i = start; i < src.length; i++) {
  if (src[i] === '{') { braceCount++; inFunc = true; }
  if (src[i] === '}') { braceCount--; }
  if (inFunc && braceCount === 0) { end = i + 1; break; }
}

if (end === -1) { console.log('ERROR: could not find end of function'); process.exit(1); }

var block = src.substring(start, end);
var newBlock = block
  .replace(/await telegramApiCall\('sendMessage'/g, "await sendFn('sendMessage'")
  .replace("console.log('[TG Bot] Admin notification sent", "console.log(logPrefix + ' Admin notification sent")
  .replace("console.error('[TG Bot] Admin notification error", "console.error(logPrefix + ' Admin notification error")
  .replace("url: adminUrl }", "web_app: { url: adminUrl } }");

if (newBlock !== block) {
  src = src.substring(0, start) + newBlock + src.substring(end);
  fs.writeFileSync(file, src, 'utf8');
  console.log('Step 5 fixed! Changes:');
  console.log('- telegramApiCall -> sendFn');
  console.log('- [TG Bot] -> logPrefix');
  console.log('- url -> web_app');
} else {
  console.log('No changes needed - already fixed.');
}
