var fs = require('fs');
var code = fs.readFileSync('public/app.js', 'utf8');
var changes = 0;

// =============================================
// FIX 1: Add getNightDeliveryTiers + getNightDeliveryCost
// =============================================

if (code.indexOf('getNightDeliveryCost') === -1) {
  var anchor = 'function getDeliveryCost()';
  var anchorIdx = code.indexOf(anchor);
  if (anchorIdx === -1) {
    console.error('FAIL: getDeliveryCost not found');
    process.exit(1);
  }

  var nightFuncs = "\n  function getNightDeliveryTiers(engels) {\n" +
"    var key = engels ? 'night_delivery_tiers_engels' : 'night_delivery_tiers';\n" +
"    try { return JSON.parse(appSettings[key] || '[]'); }\n" +
"    catch (e) { return []; }\n" +
"  }\n\n" +
"  function getNightDeliveryCost(km, engels) {\n" +
"    var tiers = getNightDeliveryTiers(engels);\n" +
"    if (!tiers.length) return getDeliveryCostByDistance(km, engels);\n" +
"    tiers.sort(function (a, b) { return a.max_km - b.max_km; });\n" +
"    for (var i = 0; i < tiers.length; i++) {\n" +
"      if (km <= tiers[i].max_km) return tiers[i].price;\n" +
"    }\n" +
"    return tiers[tiers.length - 1].price;\n" +
"  }\n\n  ";

  code = code.substring(0, anchorIdx) + nightFuncs + code.substring(anchorIdx);
  changes++;
  console.log('FIX 1 OK: Added getNightDeliveryTiers + getNightDeliveryCost');
} else {
  console.log('FIX 1 SKIP: Night functions already exist');
}

// =============================================
// FIX 2: Make getDeliveryCost use night tiers
// =============================================

var oldGetCost = "if (checkoutState.deliveryDistance > 0) {\n" +
"      return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);\n" +
"    }\n" +
"    return 0;\n" +
"  }";
var gcIdx = code.indexOf(oldGetCost);
if (gcIdx === -1) {
  oldGetCost = oldGetCost.replace(/\n/g, '\r\n');
  gcIdx = code.indexOf(oldGetCost);
}
if (gcIdx !== -1) {
  var newGetCost = "if (checkoutState.deliveryDistance > 0) {\n" +
"      if (checkoutState.isNightInterval) {\n" +
"        return getNightDeliveryCost(checkoutState.deliveryDistance, checkoutState.isEngels);\n" +
"      }\n" +
"      return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);\n" +
"    }\n" +
"    return 0;\n" +
"  }";
  code = code.replace(oldGetCost, newGetCost);
  changes++;
  console.log('FIX 2 OK: getDeliveryCost uses night tiers');
} else {
  console.log('FIX 2 SKIP: getDeliveryCost already patched or format different');
}

// =============================================
// FIX 3: Distance info shows night price
// =============================================

var oldDistCost = "var cost = getDeliveryCostByDistance(km, checkoutState.isEngels);";
if (code.indexOf(oldDistCost) !== -1) {
  code = code.replace(oldDistCost,
    "var cost = checkoutState.isNightInterval ? getNightDeliveryCost(km, checkoutState.isEngels) : getDeliveryCostByDistance(km, checkoutState.isEngels);");
  changes++;
  console.log('FIX 3 OK: Distance info shows night price');
} else {
  if (code.indexOf('getNightDeliveryCost(km') !== -1) {
    console.log('FIX 3 SKIP: Already patched');
  } else {
    console.log('FIX 3 WARNING: Distance cost line not found');
  }
}

// =============================================
// FIX 4: Replace night divider with grey button
// =============================================

// Find and replace the old divider HTML
var oldDivStart = "html += '<div class=\"night-intervals-divider\"";
var divIdx = code.indexOf(oldDivStart);
if (divIdx !== -1) {
  // Find the semicolon at end of the statement
  var searchFrom = divIdx;
  // The divider statement ends with </div>';
  var divEndMarker = "</div>';";
  var divEndIdx = code.indexOf(divEndMarker, searchFrom);
  if (divEndIdx !== -1) {
    var endPos = divEndIdx + divEndMarker.length;
    var oldDivFull = code.substring(divIdx, endPos);
    
    var newBtn = "html += '<button type=\"button\" class=\"night-delivery-btn\" id=\"night-toggle-btn\" onclick=\"toggleNightIntervals()\">' +\n" +
"        '\u041d\u043e\u0447\u043d\u0430\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430' + (nextDayStr ? ' \u043d\u0430 ' + nextDayStr : '') +\n" +
"        '</button>';";
    
    code = code.replace(oldDivFull, newBtn);
    changes++;
    console.log('FIX 4 OK: Night divider replaced with button');
  } else {
    console.log('FIX 4 FAIL: Could not find end of divider');
  }
} else {
  if (code.indexOf('night-delivery-btn') !== -1) {
    console.log('FIX 4 SKIP: Button already exists');
  } else {
    console.log('FIX 4 WARNING: Night divider not found');
  }
}

// =============================================
// FIX 5: Fix toggleNightIntervals - arrow -> btn
// =============================================

var oldArrow1 = "var arrow = document.getElementById('night-toggle-arrow');";
if (code.indexOf(oldArrow1) !== -1) {
  code = code.replace(oldArrow1, "var btn = document.getElementById('night-toggle-btn');");
  changes++;
  console.log('FIX 5a OK: toggle variable fixed');
}

var oldArrow2 = "if (arrow) arrow.style.transform = 'rotate(180deg)';";
if (code.indexOf(oldArrow2) !== -1) {
  code = code.replace(oldArrow2, "if (btn) btn.classList.add('active');");
  changes++;
  console.log('FIX 5b OK: toggle open action fixed');
}

var oldArrow3 = "if (arrow) arrow.style.transform = '';";
if (code.indexOf(oldArrow3) !== -1) {
  code = code.replace(oldArrow3, "if (btn) btn.classList.remove('active');");
  changes++;
  console.log('FIX 5c OK: toggle close action fixed');
}

// =============================================
// FIX 6: Fix pastCutoff auto-open
// =============================================

var oldAutoArrow = "var na = document.getElementById('night-toggle-arrow');";
if (code.indexOf(oldAutoArrow) !== -1) {
  code = code.replace(oldAutoArrow, "var nb = document.getElementById('night-toggle-btn');");
  changes++;
}

var oldAutoTransform = "if (na) { na.style.transform = 'rotate(180deg)'; }";
if (code.indexOf(oldAutoTransform) !== -1) {
  code = code.replace(oldAutoTransform, "if (nb) { nb.classList.add('active'); }");
  changes++;
  console.log('FIX 6 OK: auto-open uses button');
}

// =============================================
// FIX 7: Remove old night-intervals-divider CSS, keep button CSS
// =============================================
var css = fs.readFileSync('public/style.css', 'utf8');
var cssChanges = 0;

// Remove old divider CSS if still present
var oldDivCss = '.night-intervals-divider {';
if (css.indexOf(oldDivCss) !== -1) {
  var dStart = css.indexOf(oldDivCss);
  // Find through .night-icon closing }
  var niIcon = css.indexOf('.night-icon', dStart);
  if (niIcon !== -1) {
    var niEnd = css.indexOf('}', niIcon);
    if (niEnd !== -1) {
      css = css.substring(0, dStart) + css.substring(niEnd + 1);
      cssChanges++;
      console.log('CSS: Removed old divider styles');
    }
  }
}

fs.writeFileSync('public/style.css', css, 'utf8');
if (cssChanges) console.log('[style.css] ' + cssChanges + ' changes');

// =============================================
// Syntax check
// =============================================

fs.writeFileSync('public/app.js', code, 'utf8');

try {
  new Function(code);
  console.log('\n=== app.js: NO SYNTAX ERRORS ===');
} catch (e) {
  console.error('\n=== app.js SYNTAX ERROR ===');
  console.error(e.message);
}

console.log('\n=== DONE: ' + changes + ' changes to app.js ===');
console.log('');
console.log('Changes:');
console.log('1. Night pricing functions added');
console.log('2. getDeliveryCost uses night tiers when night interval selected');
console.log('3. Distance info shows night price');
console.log('4. Night button: grey, full-width, no arrow');
console.log('5. Toggle uses button class instead of arrow rotation');
console.log('');
console.log('Run: push.bat');
