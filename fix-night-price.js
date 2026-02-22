var fs = require('fs');
var code = fs.readFileSync('public/app.js', 'utf8');
var changes = 0;

// =============================================
// FIX 1: setDeliveryInterval must set isNightInterval and refresh display
// =============================================

var oldSetIv = "window.setDeliveryInterval = function (iv) {\n" +
"    checkoutState.deliveryInterval = iv;\n" +
"    var opts = document.querySelectorAll('#interval-group .radio-option');";

var idx = code.indexOf(oldSetIv);
if (idx === -1) {
  oldSetIv = oldSetIv.replace(/\n/g, '\r\n');
  idx = code.indexOf(oldSetIv);
}

if (idx !== -1) {
  var newSetIv = "window.setDeliveryInterval = function (iv) {\n" +
"    checkoutState.deliveryInterval = iv;\n" +
"    var _split = getIntervalsSplit();\n" +
"    checkoutState.isNightInterval = _split.night.indexOf(iv) !== -1;\n" +
"    var opts = document.querySelectorAll('#interval-group .radio-option');";
  code = code.replace(oldSetIv, newSetIv);
  changes++;
  console.log('FIX 1a OK: isNightInterval set in setDeliveryInterval');
} else {
  if (code.indexOf('checkoutState.isNightInterval = _split') !== -1) {
    console.log('FIX 1a SKIP: Already has isNightInterval');
  } else {
    console.error('FIX 1a FAIL: setDeliveryInterval not found');
  }
}

// Add updateCheckoutSummary and refreshDistancePrice after updateStepButtons
var oldEnd = "    updateStepButtons();\n  };";
var endIdx = code.indexOf(oldEnd);
if (endIdx === -1) {
  oldEnd = oldEnd.replace(/\n/g, '\r\n');
  endIdx = code.indexOf(oldEnd);
}

// Find the one inside setDeliveryInterval (not toggleExactTime)
if (endIdx !== -1) {
  // Check it's the right one by looking at context before
  var context = code.substring(Math.max(0, endIdx - 100), endIdx);
  if (context.indexOf('setDeliveryInterval') !== -1 || context.indexOf("r.closest('.radio-option')") !== -1) {
    var newEnd = "    updateCheckoutSummary();\n" +
"    if (checkoutState.deliveryDistance > 0) {\n" +
"      var distEl = document.getElementById('delivery-distance-info');\n" +
"      if (distEl && distEl.style.display !== 'none') {\n" +
"        var _cost = checkoutState.isNightInterval ? getNightDeliveryCost(checkoutState.deliveryDistance, checkoutState.isEngels) : getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);\n" +
"        var _label = checkoutState.isEngels ? ' (\u042d\u043d\u0433\u0435\u043b\u044c\u0441)' : '';\n" +
"        distEl.innerHTML = '\u0420\u0430\u0441\u0441\u0442\u043e\u044f\u043d\u0438\u0435: <b>' + checkoutState.deliveryDistance.toFixed(1) + ' \u043a\u043c</b>' + _label + ' \u2014 \u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430: <b>' + formatPrice(_cost) + '</b>';\n" +
"      }\n" +
"    }\n" +
"    updateStepButtons();\n  };";
    code = code.replace(oldEnd, newEnd);
    changes++;
    console.log('FIX 1b OK: setDeliveryInterval refreshes distance price');
  } else {
    console.log('FIX 1b SKIP: updateStepButtons found but not in setDeliveryInterval context');
  }
}

// =============================================
// Syntax check
// =============================================

fs.writeFileSync('public/app.js', code, 'utf8');

try {
  new Function(code);
  console.log('\n=== app.js: NO SYNTAX ERRORS ===');
} catch (e) {
  console.error('\n=== SYNTAX ERROR ===');
  console.error(e.message);
}

console.log('\n' + changes + ' changes applied');
console.log('');
console.log('Now when selecting night interval:');
console.log('1. isNightInterval is set to true');
console.log('2. Delivery cost recalculated with night tiers');
console.log('3. Distance display refreshed with night price');
console.log('');
console.log('Run: push.bat');
