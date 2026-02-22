var fs = require('fs');
var code = fs.readFileSync('public/app.js', 'utf8');
var changes = 0;

// =============================================
// FIX 1: updateNearestDeliveryHint - night intervals should respect cutoff
// =============================================

// Old logic: night intervals always available today
var oldLogic = "if (isNightIv) {\n" +
"          todayAvailable.push(iv);\n" +
"        } else if (currentHour < cutoff && currentHour < startH) {\n" +
"          todayAvailable.push(iv);\n" +
"        }";

var idx = code.indexOf(oldLogic);
if (idx === -1) {
  oldLogic = oldLogic.replace(/\n/g, '\r\n');
  idx = code.indexOf(oldLogic);
}

if (idx === -1) {
  // Try with isAfterCutoff (maybe partially patched)
  oldLogic = "if (isNightIv) {\n" +
  "          todayAvailable.push(iv);\n" +
  "        } else if (!isAfterCutoff(currentHour, cutoff) && currentHour < startH) {\n" +
  "          todayAvailable.push(iv);\n" +
  "        }";
  idx = code.indexOf(oldLogic);
  if (idx === -1) {
    oldLogic = oldLogic.replace(/\n/g, '\r\n');
    idx = code.indexOf(oldLogic);
  }
}

if (idx !== -1) {
  // New logic: NOTHING available today if past cutoff (including night)
  var newLogic = "if (isAfterCutoff(currentHour, cutoff)) {\n" +
"          // past cutoff - nothing available today\n" +
"        } else if (isNightIv) {\n" +
"          todayAvailable.push(iv);\n" +
"        } else if (currentHour < startH) {\n" +
"          todayAvailable.push(iv);\n" +
"        }";
  code = code.replace(oldLogic, newLogic);
  changes++;
  console.log('FIX 1 OK: Night intervals respect cutoff in nearest hint');
} else {
  console.log('FIX 1 SKIP: Logic block not found (may be different format)');
  // Try broader search
  var nightIvPush = "if (isNightIv) {";
  var niIdx = code.indexOf(nightIvPush);
  if (niIdx !== -1) {
    // Find the containing forEach block
    var forEachStart = code.lastIndexOf('allIntervals.forEach', niIdx);
    var forEachEnd = code.indexOf('});', niIdx);
    if (forEachStart !== -1 && forEachEnd !== -1) {
      var oldForEach = code.substring(forEachStart, forEachEnd + 3);
      var newForEach = "allIntervals.forEach(function (iv) {\n" +
"        var startH = parseInt(iv.split('-')[0]);\n" +
"        var isNightIv = !!nightSet[iv];\n" +
"        if (isAfterCutoff(currentHour, cutoff)) {\n" +
"          // past cutoff - nothing available today\n" +
"        } else if (isNightIv) {\n" +
"          todayAvailable.push(iv);\n" +
"        } else if (currentHour < startH) {\n" +
"          todayAvailable.push(iv);\n" +
"        }\n" +
"      });";
      code = code.replace(oldForEach, newForEach);
      changes++;
      console.log('FIX 1 OK (fallback): Rebuilt forEach block');
    }
  }
}

// =============================================
// FIX 2: Also fix the extra brace if present
// =============================================

var riIdx = code.indexOf('function renderIntervals()');
var nextFunc = code.indexOf('function updateNearestDeliveryHint', riIdx);
if (riIdx !== -1 && nextFunc !== -1) {
  var lastElInner = code.lastIndexOf('el.innerHTML = html;', nextFunc);
  if (lastElInner > riIdx) {
    var between = code.substring(lastElInner + 'el.innerHTML = html;'.length, nextFunc);
    var braceCount = (between.match(/\}/g) || []).length;
    if (braceCount > 1) {
      var nl = between.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
      var newBetween = nl + '  }' + nl + nl + '  ';
      code = code.substring(0, lastElInner + 'el.innerHTML = html;'.length) + newBetween + code.substring(nextFunc);
      changes++;
      console.log('FIX 2 OK: Removed extra closing brace in renderIntervals');
    } else {
      console.log('FIX 2 SKIP: No extra brace found (' + braceCount + ')');
    }
  }
}

// =============================================
// Verify syntax
// =============================================

fs.writeFileSync('public/app.js', code, 'utf8');

try {
  new Function(code);
  console.log('\n=== app.js: NO SYNTAX ERRORS ===');
} catch (e) {
  console.error('\n=== app.js SYNTAX ERROR ===');
  console.error(e.message);
  var lines = code.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '' && i > 0 && lines[i-1].trim() === '}' && i < lines.length - 1 && lines[i+1].trim() === '}') {
      console.log('Suspicious empty line + double brace at line ' + (i+1));
    }
  }
}

console.log('\n' + changes + ' changes applied');
console.log('Run: push.bat');
