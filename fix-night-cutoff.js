var fs = require('fs');
var code = fs.readFileSync('public/app.js', 'utf8');
var changes = 0;

// =============================================
// FIX: updateCutoffNotice - use isAfterCutoff + better text
// =============================================

var oldNotice = "var isClosed = isToday && isAfterCutoff(sNow.hours, cutoffHr);\n" +
"    if (isClosed) {\n" +
"      notice.style.display = 'none';\n" +
"    } else {\n" +
"      notice.style.display = 'none';\n" +
"    }";

var idx = code.indexOf(oldNotice);
if (idx === -1) {
  // Try CRLF
  oldNotice = oldNotice.replace(/\n/g, '\r\n');
  idx = code.indexOf(oldNotice);
}

if (idx === -1) {
  // Maybe the previous StrReplace didn't work - check for original
  var origNotice = "var isClosed = isToday && sNow.hours >= cutoffHr;";
  idx = code.indexOf(origNotice);
  if (idx !== -1) {
    // Find the full block
    var blockStart = idx;
    var blockEnd = code.indexOf('}', code.indexOf('}', code.indexOf('}', blockStart) + 1) + 1);
    if (blockEnd !== -1) {
      var fullBlock = code.substring(blockStart, blockEnd + 1);
      var newBlock = "var isClosed = isToday && isAfterCutoff(sNow.hours, cutoffHr);\n" +
"    if (isClosed) {\n" +
"      var label = isPickup ? '\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437' : '\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430';\n" +
"      notice.textContent = label + ' \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044e \u0434\u0430\u0442\u0443.';\n" +
"      notice.style.display = '';\n" +
"    } else {\n" +
"      notice.style.display = 'none';\n" +
"    }";
      code = code.replace(fullBlock, newBlock);
      changes++;
      console.log('FIX 1 OK: updateCutoffNotice fixed (from original)');
    }
  } else {
    console.log('FIX 1 SKIP: updateCutoffNotice already patched or not found');
  }
} else {
  var newNotice = "var isClosed = isToday && isAfterCutoff(sNow.hours, cutoffHr);\n" +
"    if (isClosed) {\n" +
"      var label = isPickup ? '\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437' : '\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430';\n" +
"      notice.textContent = label + ' \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044e \u0434\u0430\u0442\u0443.';\n" +
"      notice.style.display = '';\n" +
"    } else {\n" +
"      notice.style.display = 'none';\n" +
"    }";
  code = code.replace(oldNotice, newNotice);
  changes++;
  console.log('FIX 1 OK: updateCutoffNotice fixed (from broken version)');
}

// =============================================
// FIX: Step validation - use isAfterCutoff
// =============================================

var oldValidation = "sNowCheck.hours >= getCutoffHour()";
if (code.indexOf(oldValidation) !== -1) {
  code = code.replace(oldValidation, "isAfterCutoff(sNowCheck.hours, getCutoffHour())");
  changes++;
  console.log('FIX 2 OK: Step validation fixed');
} else {
  console.log('FIX 2 SKIP: already patched');
}

// =============================================
// FIX: updateNearestDeliveryHint - use isAfterCutoff
// =============================================

var oldNearHint = "currentHour < cutoff && currentHour < startH";
if (code.indexOf(oldNearHint) !== -1) {
  code = code.replace(oldNearHint, "!isAfterCutoff(currentHour, cutoff) && currentHour < startH");
  changes++;
  console.log('FIX 3 OK: updateNearestDeliveryHint fixed');
} else {
  console.log('FIX 3 SKIP: already patched');
}

// =============================================
// Verify isAfterCutoff function exists
// =============================================

if (code.indexOf('function isAfterCutoff') === -1) {
  console.error('ERROR: isAfterCutoff function not found! Adding it...');
  var afterGetPickup = "function getPickupCutoffHour() {\n    return parseInt(appSettings.pickup_cutoff_hour) || 20;\n  }";
  var afterGetPickupIdx = code.indexOf(afterGetPickup);
  if (afterGetPickupIdx === -1) {
    afterGetPickup = afterGetPickup.replace(/\n/g, '\r\n');
    afterGetPickupIdx = code.indexOf(afterGetPickup);
  }
  if (afterGetPickupIdx !== -1) {
    var insertAfter = afterGetPickupIdx + afterGetPickup.length;
    var helperCode = "\n\n  var EARLY_MORNING_HOUR = 6;\n\n  function isAfterCutoff(currentHour, cutoffHr) {\n    return currentHour >= cutoffHr || currentHour < EARLY_MORNING_HOUR;\n  }";
    code = code.substring(0, insertAfter) + helperCode + code.substring(insertAfter);
    changes++;
    console.log('FIX 4 OK: isAfterCutoff function added');
  } else {
    console.error('FIX 4 FAILED: Cannot find getPickupCutoffHour to insert after');
  }
} else {
  console.log('FIX 4 SKIP: isAfterCutoff already exists');
}

// =============================================
// Verify isTodayClosed uses isAfterCutoff
// =============================================

var oldTodayClosed = "var isTodayClosed = currentHour >= cutoff;";
if (code.indexOf(oldTodayClosed) !== -1) {
  code = code.replace(oldTodayClosed, "var isTodayClosed = isAfterCutoff(currentHour, cutoff);");
  changes++;
  console.log('FIX 5 OK: isTodayClosed fixed');
} else {
  if (code.indexOf("isAfterCutoff(currentHour, cutoff)") !== -1) {
    console.log('FIX 5 SKIP: isTodayClosed already uses isAfterCutoff');
  } else {
    console.log('FIX 5 WARNING: isTodayClosed not found');
  }
}

// =============================================
// Verify minDate uses isTodayClosed
// =============================================

var oldMinDate = "var minDate = todayStr;";
if (code.indexOf(oldMinDate) !== -1) {
  code = code.replace(oldMinDate, "var minDate = isTodayClosed ? tomorrowStr : todayStr;");
  changes++;
  console.log('FIX 6 OK: minDate adjusted for cutoff');
} else {
  if (code.indexOf("isTodayClosed ? tomorrowStr : todayStr") !== -1) {
    console.log('FIX 6 SKIP: minDate already uses isTodayClosed');
  } else {
    console.log('FIX 6 WARNING: minDate not found');
  }
}

// =============================================
// Verify pastCutoff uses isAfterCutoff
// =============================================

var oldPastCutoff = "var pastCutoff = isToday && currentHour >= cutoff;";
if (code.indexOf(oldPastCutoff) !== -1) {
  code = code.replace(oldPastCutoff, "var pastCutoff = isToday && isAfterCutoff(currentHour, cutoff);");
  changes++;
  console.log('FIX 7 OK: pastCutoff fixed');
} else {
  if (code.indexOf("isAfterCutoff(currentHour, cutoff)") !== -1) {
    console.log('FIX 7 SKIP: pastCutoff already uses isAfterCutoff');
  } else {
    console.log('FIX 7 WARNING: pastCutoff not found');
  }
}

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('\n=== SUCCESS ===');
console.log(changes + ' changes applied');
console.log('');
console.log('Logic: from 19:00 to 05:59 (including nighttime after midnight)');
console.log('- delivery for today is unavailable');
console.log('- default date = tomorrow');
console.log('- min selectable date = tomorrow');
console.log('');
console.log('Run: push.bat');
