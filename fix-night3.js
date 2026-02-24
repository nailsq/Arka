const fs = require('fs');
const file = '/var/www/arka-flowers/public/app.js';
let code = fs.readFileSync(file, 'utf8');
let ok = 0;

// 1) Add selectedDateStr after nextDayStr computation
const anchor1 = "nextDayStr = String(nextDay.getDate()).padStart(2, '0') + '.' + String(nextDay.getMonth() + 1).padStart(2, '0');";
if (code.includes(anchor1)) {
  if (!code.includes('selectedDateStr')) {
    code = code.replace(anchor1, anchor1 + "\n    }\n    var selectedDateStr = '';\n    if (selectedDate) {\n      var _sp = selectedDate.split('-');\n      selectedDateStr = _sp[2] + '.' + _sp[1];");
    console.log('[OK] Added selectedDateStr');
    ok++;
  } else {
    console.log('[SKIP] selectedDateStr already exists');
    ok++;
  }
} else {
  console.log('[FAIL] anchor1 not found');
}

// 2) Fix nightBadge logic: 22:00+ => selectedDateStr, 00:00-09:xx => nextDayStr
const oldBadge = "var nightBadge = isNight && nextDayStr\n        ? '<span class=\"night-date-badge\">' + nextDayStr + '</span>'\n        : '';";
const newBadge = "var _badgeDate = (startH >= 22) ? selectedDateStr : nextDayStr;\n      var nightBadge = isNight && _badgeDate\n        ? '<span class=\"night-date-badge\">' + _badgeDate + '</span>'\n        : '';";
if (code.includes(oldBadge)) {
  code = code.replace(oldBadge, newBadge);
  console.log('[OK] Fixed nightBadge logic');
  ok++;
} else {
  console.log('[FAIL] oldBadge not found');
}

// 3) Fix night divider header to show date range
const oldDivider = "(nextDayStr ? ' (на ' + nextDayStr + ')' : '')";
const newDivider = "(selectedDateStr && nextDayStr ? ' (' + selectedDateStr + ' — ' + nextDayStr + ')' : '')";
if (code.includes(oldDivider)) {
  code = code.replace(oldDivider, newDivider);
  console.log('[OK] Fixed night divider header');
  ok++;
} else {
  console.log('[FAIL] oldDivider not found');
}

// 4) Fix setDeliveryInterval to set isNightInterval
const oldSetInterval = "window.setDeliveryInterval = function (iv) {\n    checkoutState.deliveryInterval = iv;";
const newSetInterval = "window.setDeliveryInterval = function (iv) {\n    checkoutState.deliveryInterval = iv;\n    var _parts = iv.split('-');\n    var _startH = parseInt(_parts[0]);\n    var _split2 = getIntervalsSplit();\n    var _isNight = _split2.night.indexOf(iv) !== -1;\n    if (_isNight && _startH < 22) {\n      checkoutState.isNightInterval = true;\n    } else {\n      checkoutState.isNightInterval = false;\n    }";
if (code.includes(oldSetInterval)) {
  code = code.replace(oldSetInterval, newSetInterval);
  console.log('[OK] Fixed setDeliveryInterval');
  ok++;
} else {
  console.log('[FAIL] oldSetInterval not found');
}

fs.writeFileSync(file, code, 'utf8');
console.log('=== Done! ' + ok + '/4 fixes applied. Run: pm2 restart 0 ===');
