var fs = require('fs');
var path = require('path');
var file = path.join(__dirname, 'server.js');
var c = fs.readFileSync(file, 'utf8');
var changes = 0;

// Fix 1: Update success page text after Tochka payment
var oldPage = "<h2>\u0421\u043F\u0430\u0441\u0438\u0431\u043E \u0437\u0430 \u043E\u043F\u043B\u0430\u0442\u0443!</h2><p>\u0417\u0430\u043A\u0430\u0437 \u2116' + orderId + ' \u043E\u043F\u043B\u0430\u0447\u0435\u043D. \u041C\u044B \u0441\u0432\u044F\u0436\u0435\u043C\u0441\u044F \u0441 \u0432\u0430\u043C\u0438 \u0434\u043B\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F.</p>";
var newPage = "<h2>\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u043E\u0448\u043B\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E!</h2><p>\u0417\u0430\u043A\u0430\u0437 \u2116' + orderId + ' \u0443\u0436\u0435 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435. \u0421\u043F\u0430\u0441\u0438\u0431\u043E, \u0447\u0442\u043E \u0432\u044B\u0431\u0440\u0430\u043B\u0438 \u043D\u0430\u0441!</p>";

if (c.indexOf(oldPage) !== -1) {
  c = c.replace(oldPage, newPage);
  changes++;
  console.log('Fix 1: Updated payment success page text');
} else {
  console.log('WARNING: Could not find old success page text');
}

// Fix 2: Update the button text
var oldBtn = '<a href="/">\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D</a>';
var newBtn = '<a href="/">\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D</a>';
// Button text is fine, no change needed

if (changes > 0) {
  fs.writeFileSync(file, c, 'utf8');
  console.log('SUCCESS: ' + changes + ' changes applied!');
} else {
  console.log('No changes applied.');
}
