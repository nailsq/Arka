var fs = require('fs');
var code = fs.readFileSync('server.js', 'utf8');

var search = '\\n\\n\u041e\u0444\u043e\u0440\u043c\u0438 \u043a\u0440\u0430\u0441\u0438\u0432\u043e';
var idx = code.indexOf(search);
if (idx !== -1) {
  code = code.replace(search, '');
  fs.writeFileSync('server.js', code, 'utf8');
  console.log('=== SUCCESS ===');
  console.log('Removed "Оформи красиво" from about text');
} else {
  console.log('Text "Оформи красиво" not found in server.js');
}
