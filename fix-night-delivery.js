var fs = require('fs');
var code = fs.readFileSync('public/app.js', 'utf8');
var changes = 0;

// =============================================
// FIX 1: Night intervals behind a toggle button
// =============================================

var oldNightBlock = "if (nightIntervals.length > 0) {\n" +
"      html += '<div class=\"night-intervals-divider\"><span class=\"night-icon\">&#9790;</span> ";

var idx1 = code.indexOf(oldNightBlock);
if (idx1 === -1) {
  oldNightBlock = oldNightBlock.replace(/\n/g, '\r\n');
  idx1 = code.indexOf(oldNightBlock);
}
if (idx1 === -1) {
  console.error('FIX 1 FAILED: cannot find night intervals block');
  process.exit(1);
}

// Find the end of this block
var blockEnd = code.indexOf("    }\n    el.innerHTML = html;", idx1);
if (blockEnd === -1) blockEnd = code.indexOf("    }\r\n    el.innerHTML = html;", idx1);
if (blockEnd === -1) {
  // Fallback: find `el.innerHTML = html;` after our position
  blockEnd = code.indexOf("el.innerHTML = html;", idx1);
  blockEnd = code.lastIndexOf('}', blockEnd);
}

var oldBlock = code.substring(idx1, blockEnd + 1);
console.log('Found night block (' + oldBlock.length + ' chars)');

var newBlock = "if (nightIntervals.length > 0) {\n" +
"      html += '<div class=\"night-intervals-divider\" onclick=\"toggleNightIntervals()\" style=\"cursor:pointer;user-select:none\">' +\n" +
"        '<span class=\"night-icon\">&#9790;</span> Ночная доставка' +\n" +
"        (nextDayStr ? ' (на ' + nextDayStr + ')' : '') +\n" +
"        ' <span id=\"night-toggle-arrow\" style=\"float:right;transition:transform 0.3s\">&#9660;</span></div>';\n" +
"      html += '<div id=\"night-intervals-container\" style=\"display:none\">';\n" +
"      html += nightIntervals.map(function (iv) { return buildOption(iv, true); }).join('');\n" +
"      html += '</div>';\n" +
"    }";

code = code.replace(oldBlock, newBlock);
if (code.indexOf('night-toggle-arrow') !== -1) {
  changes++;
  console.log('FIX 1 OK: Night intervals behind toggle button');
} else {
  console.error('FIX 1 FAILED: replacement did not work');
  process.exit(1);
}

// =============================================
// Add toggleNightIntervals function
// =============================================

var afterSetInterval = "  window.setDeliveryInterval = function (iv) {";
var siIdx = code.indexOf(afterSetInterval);
if (siIdx === -1) {
  afterSetInterval = "window.setDeliveryInterval = function (iv) {";
  siIdx = code.indexOf(afterSetInterval);
}
if (siIdx === -1) { console.error('FIX 1b FAILED: setDeliveryInterval not found'); process.exit(1); }

var toggleFunc = "  window.toggleNightIntervals = function () {\n" +
"    var container = document.getElementById('night-intervals-container');\n" +
"    var arrow = document.getElementById('night-toggle-arrow');\n" +
"    if (!container) return;\n" +
"    if (container.style.display === 'none') {\n" +
"      container.style.display = 'block';\n" +
"      if (arrow) arrow.style.transform = 'rotate(180deg)';\n" +
"    } else {\n" +
"      container.style.display = 'none';\n" +
"      if (arrow) arrow.style.transform = '';\n" +
"    }\n" +
"  };\n\n";

code = code.substring(0, siIdx) + toggleFunc + code.substring(siIdx);
changes++;
console.log('FIX 1b OK: toggleNightIntervals function added');

// =============================================
// FIX 2: Track night interval selection
// =============================================

var oldSetIv = "window.setDeliveryInterval = function (iv) {\n" +
"    checkoutState.deliveryInterval = iv;";
var newSetIv = "window.setDeliveryInterval = function (iv) {\n" +
"    checkoutState.deliveryInterval = iv;\n" +
"    var _split = getIntervalsSplit();\n" +
"    checkoutState.isNightInterval = _split.night.indexOf(iv) !== -1;";

if (code.indexOf(oldSetIv) !== -1) {
  code = code.replace(oldSetIv, newSetIv);
  changes++;
  console.log('FIX 2a OK: Night interval detection in setDeliveryInterval');
} else {
  console.log('FIX 2a SKIP: setDeliveryInterval block not matched');
}

// =============================================
// FIX 3: Adjust delivery_date for night orders
// =============================================

var oldDateLine = "      delivery_date: dateVal,";
if (code.indexOf(oldDateLine) !== -1) {
  var newDateLine = "      delivery_date: (function () {\n" +
"        if (checkoutState.isNightInterval && dateVal) {\n" +
"          var _dp = dateVal.split('-');\n" +
"          var _nd = new Date(parseInt(_dp[0]), parseInt(_dp[1]) - 1, parseInt(_dp[2]) + 1);\n" +
"          return _nd.getFullYear() + '-' + String(_nd.getMonth() + 1).padStart(2, '0') + '-' + String(_nd.getDate()).padStart(2, '0');\n" +
"        }\n" +
"        return dateVal;\n" +
"      })(),";
  code = code.replace(oldDateLine, newDateLine);
  changes++;
  console.log('FIX 3 OK: Night delivery_date adjusted to next day');
} else {
  console.log('FIX 3 SKIP: delivery_date line not found');
}

// =============================================
// FIX 4: Auto-open night section when past cutoff
// =============================================

var oldElInner = "    el.innerHTML = html;\n  }";
if (code.indexOf(oldElInner) === -1) {
  oldElInner = "    el.innerHTML = html;\r\n  }";
}
// Find specifically the one in renderIntervals (near night intervals)
var nightContainerRef = code.indexOf('night-intervals-container');
if (nightContainerRef !== -1) {
  var elInnerIdx = code.indexOf("el.innerHTML = html;", nightContainerRef);
  if (elInnerIdx !== -1) {
    var closeBrace = code.indexOf("}", elInnerIdx);
    // Replace from el.innerHTML to closing brace
    var oldSegment = code.substring(elInnerIdx, closeBrace + 1);
    var newSegment = "el.innerHTML = html;\n" +
"    if (pastCutoff && nightIntervals.length > 0) {\n" +
"      var nc = document.getElementById('night-intervals-container');\n" +
"      var na = document.getElementById('night-toggle-arrow');\n" +
"      if (nc) { nc.style.display = 'block'; }\n" +
"      if (na) { na.style.transform = 'rotate(180deg)'; }\n" +
"    }\n" +
"  }";
    code = code.replace(oldSegment, newSegment);
    changes++;
    console.log('FIX 4 OK: Night intervals auto-open when past cutoff');
  } else {
    console.log('FIX 4 SKIP: el.innerHTML not found after night container');
  }
}

// Save
fs.writeFileSync('public/app.js', code, 'utf8');
console.log('\n=== SUCCESS ===');
console.log(changes + ' changes applied to public/app.js');
console.log('');
console.log('Changes:');
console.log('1. "Ночная доставка" is now a clickable button that shows/hides night intervals');
console.log('2. When night interval selected, delivery date = selected date + 1 day');
console.log('3. When past cutoff, night section opens automatically');
console.log('');
console.log('Run: push.bat');
