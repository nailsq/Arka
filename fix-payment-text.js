var fs = require('fs');
var path = require('path');
var file = path.join(__dirname, 'server.js');
var c = fs.readFileSync(file, 'utf8');
var lines = c.split('\n');
var changed = false;

for (var i = 0; i < lines.length; i++) {
  var line = lines[i];
  if (line.indexOf('res.send') !== -1 && line.indexOf('</html>') !== -1 && line.indexOf('tochka') === -1) {
    // Check if previous lines contain tochka-success context
    var context = lines.slice(Math.max(0, i - 20), i).join(' ');
    if (context.indexOf('tochka-success') !== -1 || context.indexOf('marked as paid') !== -1) {
      console.log('Found payment success page at line ' + (i + 1));
      console.log('Old line preview: ' + line.substring(0, 100) + '...');
      
      lines[i] = "  res.send('<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + "\u041E\u043F\u043B\u0430\u0442\u0430" + "</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#000}div{text-align:center;padding:40px;max-width:400px}h2{margin-bottom:16px;color:#2e7d32}p{color:#555;margin-bottom:24px}a{display:inline-block;padding:14px 28px;background:#000;color:#fff;text-decoration:none;border-radius:10px;font-size:15px}</style></head><body><div><h2>\u2705 " + "\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u043E\u0448\u043B\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E!" + "</h2><p>" + "\u0417\u0430\u043A\u0430\u0437 \u2116" + "' + orderId + ' " + "\u0443\u0436\u0435 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435. \u0421\u043F\u0430\u0441\u0438\u0431\u043E, \u0447\u0442\u043E \u0432\u044B\u0431\u0440\u0430\u043B\u0438 \u043D\u0430\u0441!" + "</p><a href=\"/\">" + "\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D" + "</a></div></body></html>');";
      
      changed = true;
      console.log('Line replaced!');
      break;
    }
  }
}

if (changed) {
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('\nSUCCESS! Text changed to:');
  console.log('"Оплата прошла успешно! Заказ уже в работе. Спасибо, что выбрали нас!"');
  console.log('\nNow run push.bat');
} else {
  console.log('ERROR: Could not find the payment success line.');
  console.log('Total lines in server.js: ' + lines.length);
  for (var k = 0; k < lines.length; k++) {
    if (lines[k].indexOf('res.send') !== -1 && lines[k].indexOf('html') !== -1) {
      console.log('  res.send+html found at line ' + (k+1));
    }
  }
}
