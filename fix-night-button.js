var fs = require('fs');

// =============================================
// Patch app.js - replace night divider with button
// =============================================
var code = fs.readFileSync('public/app.js', 'utf8');
var changes = 0;

// FIX 1: Replace HTML generation for night section
var oldHtml = "html += '<div class=\"night-intervals-divider\" onclick=\"toggleNightIntervals()\" style=\"cursor:pointer;user-select:none\">' +\n" +
"        '<span class=\"night-icon\">&#9790;</span> \u041d\u043e\u0447\u043d\u0430\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430' +\n" +
"        (nextDayStr ? ' (\u043d\u0430 ' + nextDayStr + ')' : '') +\n" +
"        ' <span id=\"night-toggle-arrow\" style=\"float:right;transition:transform 0.3s\">&#9660;</span></div>';";

var idx = code.indexOf(oldHtml);
if (idx === -1) {
  oldHtml = oldHtml.replace(/\n/g, '\r\n');
  idx = code.indexOf(oldHtml);
}

if (idx !== -1) {
  var newHtml = "html += '<button type=\"button\" class=\"night-delivery-btn\" id=\"night-toggle-btn\" onclick=\"toggleNightIntervals()\">' +\n" +
"        '\u041d\u043e\u0447\u043d\u0430\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430' + (nextDayStr ? ' \u043d\u0430 ' + nextDayStr : '') +\n" +
"        '</button>';";
  code = code.replace(oldHtml, newHtml);
  changes++;
  console.log('FIX 1 OK: Night divider replaced with button');
} else {
  if (code.indexOf('night-delivery-btn') !== -1) {
    console.log('FIX 1 SKIP: Already patched');
  } else {
    console.error('FIX 1 FAILED: Could not find night divider HTML');
  }
}

// FIX 2: Fix pastCutoff auto-open (arrow -> btn class)
var oldAutoOpen = "var na = document.getElementById('night-toggle-arrow');";
if (code.indexOf(oldAutoOpen) !== -1) {
  code = code.replace(oldAutoOpen, "var nb = document.getElementById('night-toggle-btn');");
  changes++;
  console.log('FIX 2a OK: auto-open variable fixed');
}

var oldArrowTransform = "if (na) { na.style.transform = 'rotate(180deg)'; }";
if (code.indexOf(oldArrowTransform) !== -1) {
  code = code.replace(oldArrowTransform, "if (nb) { nb.classList.add('active'); }");
  changes++;
  console.log('FIX 2b OK: auto-open action fixed');
}

// FIX 3: Fix toggleNightIntervals (arrow -> btn class)
var oldToggleArrow = "var arrow = document.getElementById('night-toggle-arrow');";
if (code.indexOf(oldToggleArrow) !== -1) {
  code = code.replace(oldToggleArrow, "var btn = document.getElementById('night-toggle-btn');");
  changes++;
}

var oldRotate = "if (arrow) arrow.style.transform = 'rotate(180deg)';";
if (code.indexOf(oldRotate) !== -1) {
  code = code.replace(oldRotate, "if (btn) btn.classList.add('active');");
  changes++;
}

var oldUnrotate = "if (arrow) arrow.style.transform = '';";
if (code.indexOf(oldUnrotate) !== -1) {
  code = code.replace(oldUnrotate, "if (btn) btn.classList.remove('active');");
  changes++;
}

// Check if toggle already uses btn
if (code.indexOf("var btn = document.getElementById('night-toggle-btn')") !== -1) {
  console.log('FIX 3 OK: toggleNightIntervals uses button');
} else {
  console.log('FIX 3 CHECK: toggleNightIntervals may need manual review');
}

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('app.js: ' + changes + ' changes');

// =============================================
// Patch style.css - replace divider styles with button styles
// =============================================
var css = fs.readFileSync('public/style.css', 'utf8');
var cssChanges = 0;

var oldCss = ".night-intervals-divider {";
var newBtnCss = ".night-delivery-btn {\n" +
"  display: block;\n" +
"  width: 100%;\n" +
"  margin: 14px 0 8px;\n" +
"  padding: 14px 20px;\n" +
"  font-size: 15px;\n" +
"  font-weight: 600;\n" +
"  color: #fff;\n" +
"  background: #2c2c3a;\n" +
"  border: none;\n" +
"  border-radius: 12px;\n" +
"  cursor: pointer;\n" +
"  text-align: center;\n" +
"  letter-spacing: 0.3px;\n" +
"  transition: background 0.2s, transform 0.1s;\n" +
"}\n" +
".night-delivery-btn:active {\n" +
"  transform: scale(0.98);\n" +
"}\n" +
".night-delivery-btn.active {\n" +
"  background: #444460;\n" +
"}";

if (css.indexOf(oldCss) !== -1) {
  // Find the full old CSS block
  var cssIdx = css.indexOf(oldCss);
  // Find ending of .night-icon block
  var nightIconEnd = css.indexOf('.night-icon', cssIdx);
  if (nightIconEnd === -1) nightIconEnd = css.indexOf('night-icon', cssIdx);
  var afterNightIcon = css.indexOf('}', nightIconEnd);
  if (afterNightIcon !== -1) {
    var oldCssBlock = css.substring(cssIdx, afterNightIcon + 1);
    css = css.replace(oldCssBlock, newBtnCss);
    cssChanges++;
    console.log('CSS FIX OK: Old divider styles replaced with button styles');
  }
} else if (css.indexOf('.night-delivery-btn') !== -1) {
  console.log('CSS FIX SKIP: Button styles already exist');
} else {
  // Just append
  css += '\n\n' + newBtnCss;
  cssChanges++;
  console.log('CSS FIX OK: Button styles appended');
}

fs.writeFileSync('public/style.css', css, 'utf8');
console.log('style.css: ' + cssChanges + ' changes');

console.log('\n=== SUCCESS ===');
console.log('Night delivery toggle is now a full-width button');
console.log('Run: push.bat');
