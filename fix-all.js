var fs = require('fs');

// ========== FIX 1: admin.css - category buttons on mobile ==========
var css = fs.readFileSync('public/admin.css', 'utf8');
if (css.indexOf('nth-child(3):last-child') === -1) {
  var lines = css.split('\n');
  var inserted = false;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('.data-table tbody td:nth-child(3)') !== -1 && lines[i].indexOf('last-child') === -1 && lines[i].indexOf('display') === -1) {
      for (var j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '}') {
          var ins = [
            '',
            '  .data-table tbody td:nth-child(3):last-child {',
            '    display: block;',
            '    width: 100%;',
            '    padding-top: 8px;',
            '    border-top: 1px solid var(--border);',
            '    margin-top: 4px;',
            '  }',
            '',
            '  .data-table tbody td:nth-child(3):last-child .btn-group {',
            '    display: flex;',
            '    gap: 8px;',
            '  }',
            '',
            '  .data-table tbody td:nth-child(3):last-child .btn-group .btn {',
            '    flex: 1;',
            '    min-height: 40px;',
            '    justify-content: center;',
            '    font-size: 13px;',
            '  }'
          ];
          for (var k = ins.length - 1; k >= 0; k--) lines.splice(j + 1, 0, ins[k]);
          inserted = true;
          break;
        }
      }
      break;
    }
  }
  if (inserted) {
    fs.writeFileSync('public/admin.css', lines.join('\n'));
    console.log('[1] CSS: category mobile buttons - OK');
  } else {
    console.log('[1] CSS: could not find insertion point');
  }
} else {
  console.log('[1] CSS: already patched');
}

// ========== FIX 2: admin.js - product ID + holiday removal ==========
var js = fs.readFileSync('public/admin.js', 'utf8');
var changes = 0;

// 2a: Add product ID
if (js.indexOf("ID: ' + p.id") === -1) {
  js = js.replace(
    "'<td><strong>' + esc(p.name) + '</strong>' + sizesInfo + '</td>' +",
    "'<td><strong>' + esc(p.name) + '</strong><div style=\"font-size:10px;color:var(--text-secondary)\">ID: ' + p.id + '</div>' + sizesInfo + '</td>' +"
  );
  changes++;
  console.log('[2a] JS: product ID added');
} else {
  console.log('[2a] JS: product ID already present');
}

// 2b: Remove holiday delivery price section
var holPriceOld = "Стоимость доставки по дням";
if (js.indexOf(holPriceOld) !== -1) {
  js = js.replace(
    /h \+= '<div class="settings-section-title">Стоимость доставки по дням<\/div>';[\s\S]*?Праздничные дни: 8 марта[\s\S]*?h \+= '<\/div>';/,
    "h += '<div class=\"settings-section-title\">Стоимость доставки</div>';\n      h += '<div class=\"form-row\">' +\n        '<div class=\"form-group\"><label class=\"form-label\">Стоимость доставки (руб.)</label>' +\n        '<input type=\"number\" class=\"form-input\" id=\"s-delivery-regular\" value=\"' + esc(s.delivery_regular || '500') + '\"></div>' +\n      '</div>';\n      h += '<input type=\"hidden\" id=\"s-delivery-holiday\" value=\"' + esc(s.delivery_regular || '500') + '\">';\n      h += '</div>';"
  );
  changes++;
  console.log('[2b] JS: holiday delivery price removed');
} else {
  console.log('[2b] JS: holiday delivery price already removed');
}

// 2c: Remove holiday intervals UI
var holIntOld = 'Праздничные интервалы — дневные';
if (js.indexOf(holIntOld) !== -1) {
  js = js.replace(
    /h \+= '<div class="form-group"><label class="form-label">Праздничные интервалы — дневные[\s\S]*?h \+= '<input type="hidden" id="s-intervals-holiday-night">';\n\s*h \+= '<\/div>';\n\n\s*h \+= '<div class="settings-section">';\n\s*h \+= '<div class="settings-section-title">Праздничные даты[\s\S]*?Добавляйте\/убирайте даты по необходимости[\s\S]*?h \+= '<\/div>';/,
    "h += '<input type=\"hidden\" id=\"s-intervals-holiday\" value=\"[]\">';\n      h += '<input type=\"hidden\" id=\"s-intervals-holiday-day\" value=\"[]\">';\n      h += '<input type=\"hidden\" id=\"s-intervals-holiday-night\" value=\"[]\">';\n      h += '<input type=\"hidden\" id=\"s-holidays\" value=\"[]\">';\n      h += '</div>';"
  );
  changes++;
  console.log('[2c] JS: holiday intervals + dates section removed');
} else {
  console.log('[2c] JS: holiday intervals already removed');
}

// 2d: Remove holiday interval loading
var holLoadOld = 'intervals_holiday_day';
if (js.indexOf("holDay = JSON.parse(s.intervals_holiday_day)") !== -1) {
  js = js.replace(
    /\n\s*var holDay = \[\], holNight = \[\];[\s\S]*?renderIntervals\(holNight, 'holiday-night'\);/,
    ''
  );
  changes++;
  console.log('[2d] JS: holiday interval loading removed');
} else {
  console.log('[2d] JS: holiday interval loading already removed');
}

// 2e: Remove holiday from collectAllIntervals
if (js.indexOf("collectIntervalsRaw('s-intervals-list-holiday-day')") !== -1) {
  js = js.replace("    var holDay = collectIntervalsRaw('s-intervals-list-holiday-day');\n    var holNight = collectIntervalsRaw('s-intervals-list-holiday-night');\n\n", '');
  js = js.replace("    var hiddenHol = document.getElementById('s-intervals-holiday');\n    if (hiddenHol) hiddenHol.value = JSON.stringify(holDay.concat(holNight));\n\n", '');
  js = js.replace("    var hiddenHolDay = document.getElementById('s-intervals-holiday-day');\n    if (hiddenHolDay) hiddenHolDay.value = JSON.stringify(holDay);\n    var hiddenHolNight = document.getElementById('s-intervals-holiday-night');\n    if (hiddenHolNight) hiddenHolNight.value = JSON.stringify(holNight);\n\n", '');
  js = js.replace("    console.log('[Intervals] Holiday day:', JSON.stringify(holDay), 'night:', JSON.stringify(holNight));\n", '');
  changes++;
  console.log('[2e] JS: holiday collectAllIntervals removed');
} else {
  console.log('[2e] JS: holiday collectAllIntervals already removed');
}

// 2f: Remove holiday from save data
if (js.indexOf("document.getElementById('s-delivery-holiday').value") !== -1) {
  js = js.replace("document.getElementById('s-delivery-holiday').value", "document.getElementById('s-delivery-regular').value");
  changes++;
  console.log('[2f] JS: holiday save field fixed');
} else {
  console.log('[2f] JS: holiday save field already fixed');
}

if (js.indexOf("document.getElementById('s-intervals-holiday').value") !== -1) {
  js = js.replace("intervals_holiday: document.getElementById('s-intervals-holiday').value,", "intervals_holiday: '[]',");
  js = js.replace("intervals_holiday_day: document.getElementById('s-intervals-holiday-day').value,", "intervals_holiday_day: '[]',");
  js = js.replace("intervals_holiday_night: document.getElementById('s-intervals-holiday-night').value,", "intervals_holiday_night: '[]',");
  js = js.replace("holiday_dates: document.getElementById('s-holidays').value,", "holiday_dates: '[]',");
  changes++;
  console.log('[2g] JS: holiday save data fields fixed');
} else {
  console.log('[2g] JS: holiday save data already fixed');
}

if (js.indexOf("intervals_holiday:") !== -1 && js.indexOf("console.log('[SaveSettings] intervals_holiday:'") !== -1) {
  js = js.replace("    console.log('[SaveSettings] intervals_holiday:', data.intervals_holiday);\n", '');
  changes++;
  console.log('[2h] JS: holiday save log removed');
} else {
  console.log('[2h] JS: holiday save log already removed');
}

// 2i: Remove holiday from SETTINGS_MAP
if (js.indexOf("Доставка в праздничные дни") !== -1) {
  js = js.replace("    { key: 'delivery_regular', label: 'Доставка в будние дни', section: 'Стоимость доставки по дням' },\n    { key: 'delivery_holiday', label: 'Доставка в праздничные дни', section: 'Стоимость доставки по дням' },",
    "    { key: 'delivery_regular', label: 'Стоимость доставки', section: 'Стоимость доставки' },");
  changes++;
  console.log('[2i] JS: SETTINGS_MAP holiday removed');
} else {
  console.log('[2i] JS: SETTINGS_MAP already clean');
}

if (js.indexOf("Праздничные интервалы") !== -1 && js.indexOf("key: 'intervals_holiday'") !== -1) {
  js = js.replace("    { key: 'intervals_holiday', label: 'Праздничные интервалы', section: 'Время и интервалы' },\n", '');
  js = js.replace("    { key: 'holiday_dates', label: 'Праздничные даты', section: 'Праздничные даты' },\n", '');
  changes++;
  console.log('[2j] JS: SETTINGS_MAP holiday entries removed');
} else {
  console.log('[2j] JS: SETTINGS_MAP holiday entries already removed');
}

// 2k: Remove from search scroll map
if (js.indexOf("intervals_holiday: 's-intervals-holiday'") !== -1) {
  js = js.replace("          intervals_holiday: 's-intervals-holiday',\n          holiday_dates: 's-holidays',\n", '');
  changes++;
  console.log('[2k] JS: search map holiday removed');
} else {
  console.log('[2k] JS: search map already clean');
}
if (js.indexOf("delivery_holiday: 's-delivery-holiday'") !== -1) {
  js = js.replace("          delivery_holiday: 's-delivery-holiday',\n", '');
  changes++;
  console.log('[2l] JS: search map delivery_holiday removed');
} else {
  console.log('[2l] JS: search map delivery_holiday already clean');
}

if (changes > 0) {
  fs.writeFileSync('public/admin.js', js);
  console.log('[2] admin.js: ' + changes + ' changes saved');
} else {
  console.log('[2] admin.js: no changes needed');
}

// ========== FIX 3: app.js - remove holiday logic ==========
var app = fs.readFileSync('public/app.js', 'utf8');
var appChanges = 0;

// 3a: Remove isHolidayToday and simplify getIntervals/getIntervalsSplit
if (app.indexOf('isHolidayToday') !== -1) {
  app = app.replace(
    /  function isHolidayToday\(\) \{[\s\S]*?\n  \}\n\n  function getIntervals\(\) \{\n    var isHoliday = isHolidayToday\(\);\n    var key = isHoliday \? 'intervals_holiday' : 'intervals_regular';\n    try \{ return JSON\.parse\(appSettings\[key\] \|\| '\[\]'\); \}\n    catch \(e\) \{ return \[\]; \}\n  \}\n\n  function getIntervalsSplit\(\) \{\n    var isHoliday = isHolidayToday\(\);\n    var dayKey = isHoliday \? 'intervals_holiday_day' : 'intervals_regular_day';\n    var nightKey = isHoliday \? 'intervals_holiday_night' : 'intervals_regular_night';/,
    "  function getIntervals() {\n    try { return JSON.parse(appSettings.intervals_regular || '[]'); }\n    catch (e) { return []; }\n  }\n\n  function getIntervalsSplit() {\n    var dayKey = 'intervals_regular_day';\n    var nightKey = 'intervals_regular_night';"
  );
  appChanges++;
  console.log('[3a] app.js: isHolidayToday removed, intervals simplified');
} else {
  console.log('[3a] app.js: isHolidayToday already removed');
}

// 3b: Remove holiday variable usage
if (app.indexOf("var holiday = isHolidayToday()") !== -1) {
  app = app.replace("    var holiday = isHolidayToday();\n", '');
  appChanges++;
  console.log('[3b] app.js: holiday variable removed');
} else {
  console.log('[3b] app.js: holiday variable already removed');
}

// 3c: Remove holiday delivery info text
if (app.indexOf('Доставка в праздничные дни') !== -1) {
  app = app.replace(
    "'<h3>Доставка в праздничные дни</h3>' +\n        '<p>Интервал доставки 3 часа. При указании точного времени заказ будет доставлен в интервале ±1,5 часа. Стоимость доставки точно ко времени 1000 руб. (укажите в заказе).</p>' +\n        '<p>Если получателя",
    "'<p>Если получателя"
  );
  appChanges++;
  console.log('[3c] app.js: holiday delivery info text removed');
} else {
  console.log('[3c] app.js: holiday delivery info already removed');
}

if (appChanges > 0) {
  fs.writeFileSync('public/app.js', app);
  console.log('[3] app.js: ' + appChanges + ' changes saved');
} else {
  console.log('[3] app.js: no changes needed');
}

console.log('\nAll done! Restart the app with: pm2 restart arka');
