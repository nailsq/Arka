var fs = require('fs');
var path = require('path');
var file = path.join(__dirname, 'server.js');
var c = fs.readFileSync(file, 'utf8');
var lines = c.split('\n');
var changed = false;

for (var i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('tochka-success') !== -1 && lines[i].indexOf('app.get') !== -1) {
    // Found the tochka-success route, now find the res.send line
    for (var j = i; j < Math.min(i + 30, lines.length); j++) {
      if (lines[j].indexOf('res.send(') !== -1 && lines[j].indexOf('</html>') !== -1) {
        // Replace the entire res.send line
        lines[j] = "  res.send('<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>\u041E\u043F\u043B\u0430\u0442\u0430</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#000}div{text-align:center;padding:40px;max-width:400px}h2{margin-bottom:16px}p{color:#555;margin-bottom:24px}a{display:inline-block;padding:14px 28px;background:#000;color:#fff;text-decoration:none;border-radius:10px;font-size:15px}</style></head><body><div><h2>\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u043E\u0448\u043B\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E!</h2><p>\u0417\u0430\u043A\u0430\u0437 \u2116' + orderId + ' \u0443\u0436\u0435 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435. \u0421\u043F\u0430\u0441\u0438\u0431\u043E, \u0447\u0442\u043E \u0432\u044B\u0431\u0440\u0430\u043B\u0438 \u043D\u0430\u0441!</p><a href=\"/\">\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D</a></div></body></html>');";
        changed = true;
        console.log('Fixed line ' + (j + 1) + ': payment success page text updated');
        break;
      }
    }
    break;
  }
}

if (changed) {
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('SUCCESS! New text: "Оплата прошла успешно! Заказ уже в работе. Спасибо, что выбрали нас!"');
} else {
  console.log('ERROR: Could not find the line to replace');
}
