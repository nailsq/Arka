const fs = require('fs');
const file = '/var/www/arka-flowers/public/app.js';
let code = fs.readFileSync(file, 'utf8');
let ok = 0;
const lines = code.split('\n');

// 1) Add selectedDateStr after nextDayStr block
//    Find the line with nextDayStr = String(nextDay... and add selectedDateStr after the closing }
let added = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('nextDayStr = String(nextDay') && !code.includes('selectedDateStr')) {
    // find the closing } of this if-block (should be 1-2 lines after)
    for (let j = i + 1; j < i + 5; j++) {
      if (lines[j].trim() === '}') {
        const indent = '    ';
        const newLines = [
          lines[j],
          indent + "var selectedDateStr = '';",
          indent + "if (selectedDate) {",
          indent + "  var _sp = selectedDate.split('-');",
          indent + "  selectedDateStr = _sp[2] + '.' + _sp[1];",
          indent + "}"
        ];
        lines.splice(j, 1, ...newLines);
        console.log('[OK] Added selectedDateStr after line ' + (j + 1));
        ok++;
        added = true;
        break;
      }
    }
    break;
  }
}
if (!added && code.includes('selectedDateStr')) {
  console.log('[SKIP] selectedDateStr already exists');
  ok++;
} else if (!added) {
  console.log('[FAIL] Could not add selectedDateStr');
}

code = lines.join('\n');

// 2) Fix nightBadge: replace "var nightBadge = isNight && nextDayStr"
//    with logic that checks startH >= 22 => selectedDateStr, else => nextDayStr
const oldBadgeLine = 'var nightBadge = isNight && nextDayStr';
if (code.includes(oldBadgeLine)) {
  code = code.replace(
    oldBadgeLine,
    'var _badgeDate = (startH >= 22) ? selectedDateStr : nextDayStr;\n      var nightBadge = isNight && _badgeDate'
  );
  console.log('[OK] Fixed nightBadge to use selectedDateStr for 22:00+');
  ok++;
} else {
  console.log('[FAIL] nightBadge pattern not found');
}

// 3) Fix isNightInterval: should be true ONLY for post-midnight night intervals
const oldNight = "checkoutState.isNightInterval = _split.night.indexOf(iv) !== -1;";
if (code.includes(oldNight)) {
  code = code.replace(oldNight,
    "var _isNightIv = _split.night.indexOf(iv) !== -1;\n" +
    "    var _ivParts = iv.split('-');\n" +
    "    var _ivStartH = parseInt(_ivParts[0]);\n" +
    "    checkoutState.isNightInterval = _isNightIv && _ivStartH < 22;"
  );
  console.log('[OK] Fixed isNightInterval (true only for post-midnight)');
  ok++;
} else {
  console.log('[FAIL] isNightInterval pattern not found');
}

// 4) Fix night divider header
const oldDiv1 = "' (' + nextDayStr + ')'";
const oldDiv2 = "' (\\u043d\\u0430 ' + nextDayStr + ')'";  // "на" in unicode
// Try multiple patterns
if (code.includes("(nextDayStr ? ' (' + nextDayStr + ')' : '')")) {
  code = code.replace(
    "(nextDayStr ? ' (' + nextDayStr + ')' : '')",
    "(selectedDateStr && nextDayStr ? ' (' + selectedDateStr + ' \\u2014 ' + nextDayStr + ')' : '')"
  );
  console.log('[OK] Fixed divider header (pattern A)');
  ok++;
} else {
  // Try to find the divider line by content
  const divLines = code.split('\n');
  let divFixed = false;
  for (let i = 0; i < divLines.length; i++) {
    if (divLines[i].includes('night-intervals-divider') && divLines[i].includes('nextDayStr')) {
      // Replace nextDayStr reference with date range
      divLines[i] = divLines[i].replace(
        /\(nextDayStr \? '.*?' \+ nextDayStr \+ '.*?' : ''\)/,
        "(selectedDateStr && nextDayStr ? ' (' + selectedDateStr + ' \\u2014 ' + nextDayStr + ')' : '')"
      );
      console.log('[OK] Fixed divider header (pattern B, line ' + (i+1) + ')');
      ok++;
      divFixed = true;
      break;
    }
  }
  if (!divFixed) {
    // Last resort: search for any line with "Ночная доставка" and nextDayStr  
    for (let i = 0; i < divLines.length; i++) {
      if (divLines[i].includes('nextDayStr') && (divLines[i].includes('night-intervals-divider') || divLines[i].includes('9790'))) {
        const before = divLines[i];
        divLines[i] = divLines[i]
          .replace(/nextDayStr \? '[^']*' \+ nextDayStr \+ '[^']*'/g, 
                   "selectedDateStr && nextDayStr ? ' (' + selectedDateStr + ' \\u2014 ' + nextDayStr + ')'")
          .replace(": '')", ": '')");
        if (divLines[i] !== before) {
          console.log('[OK] Fixed divider header (pattern C, line ' + (i+1) + ')');
          ok++;
          divFixed = true;
        }
        break;
      }
    }
    code = divLines.join('\n');
    if (!divFixed) {
      console.log('[FAIL] divider header pattern not found');
    }
  } else {
    code = divLines.join('\n');
  }
}

fs.writeFileSync(file, code, 'utf8');
console.log('=== Done! ' + ok + '/4 fixes. Run: pm2 restart 0 ===');
