var fs = require('fs');
var code = fs.readFileSync('server.js', 'utf8');

// Fix: change url to web_app for "Открыть заказ" button
var old1 = "text: '\\u041e\\u0442\\u043a\\u0440\\u044b\\u0442\\u044c \\u0437\\u0430\\u043a\\u0430\\u0437', url: adminUrl";
var new1 = "text: '\\u041e\\u0442\\u043a\\u0440\\u044b\\u0442\\u044c \\u0437\\u0430\\u043a\\u0430\\u0437', web_app: { url: adminUrl }";

if (code.indexOf(old1) !== -1) {
  code = code.replace(old1, new1);
  console.log('OK: Button changed to web_app');
} else {
  // Try with decoded Cyrillic
  var old2 = "text: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0437\u0430\u043a\u0430\u0437', url: adminUrl";
  var new2 = "text: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0437\u0430\u043a\u0430\u0437', web_app: { url: adminUrl }";
  if (code.indexOf(old2) !== -1) {
    code = code.replace(old2, new2);
    console.log('OK: Button changed to web_app (cyrillic)');
  } else {
    // Broader search
    var idx = code.indexOf("url: adminUrl }]]");
    if (idx !== -1) {
      code = code.replace("url: adminUrl }]]", "web_app: { url: adminUrl } }]]");
      console.log('OK: Button changed to web_app (broad)');
    } else {
      console.error('FAILED: Could not find button');
      process.exit(1);
    }
  }
}

fs.writeFileSync('server.js', code, 'utf8');
console.log('=== SUCCESS ===');
console.log('Admin "Открыть заказ" now opens in mini-app');
console.log('Run push.bat!');
