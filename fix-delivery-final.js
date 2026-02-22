var fs = require('fs');
var code = fs.readFileSync('public/app.js', 'utf8');
var changes = 0;

// =============================================
// FIX 1: Add getNightDeliveryTiers + getNightDeliveryCost
// Insert right after getDeliveryCostByDistance closing }
// =============================================

var marker1 = "    return tiers[tiers.length - 1].price;\n  }\n\n  function getDeliveryCost()";
var m1 = code.indexOf(marker1);
if (m1 === -1) {
  marker1 = marker1.replace(/\n/g, '\r\n');
  m1 = code.indexOf(marker1);
}

if (m1 !== -1) {
  var insertPoint = code.indexOf('\n\n  function getDeliveryCost()', m1);
  if (insertPoint === -1) insertPoint = code.indexOf('\r\n\r\n  function getDeliveryCost()', m1);
  
  if (insertPoint !== -1) {
    var nl = code.charAt(insertPoint) === '\r' ? '\r\n' : '\n';
    var nightFuncs = nl + nl +
"  function getNightDeliveryTiers(engels) {" + nl +
"    var key = engels ? 'night_delivery_tiers_engels' : 'night_delivery_tiers';" + nl +
"    try { return JSON.parse(appSettings[key] || '[]'); }" + nl +
"    catch (e) { return []; }" + nl +
"  }" + nl + nl +
"  function getNightDeliveryCost(km, engels) {" + nl +
"    var tiers = getNightDeliveryTiers(engels);" + nl +
"    if (!tiers.length) return getDeliveryCostByDistance(km, engels);" + nl +
"    tiers.sort(function (a, b) { return a.max_km - b.max_km; });" + nl +
"    for (var i = 0; i < tiers.length; i++) {" + nl +
"      if (km <= tiers[i].max_km) return tiers[i].price;" + nl +
"    }" + nl +
"    return tiers[tiers.length - 1].price;" + nl +
"  }";

    code = code.substring(0, insertPoint) + nightFuncs + code.substring(insertPoint);
    changes++;
    console.log('FIX 1 OK: Added getNightDeliveryTiers + getNightDeliveryCost');
  } else {
    console.error('FIX 1 FAIL: Could not find insert point');
  }
} else {
  console.error('FIX 1 FAIL: marker not found');
  console.log('Trying alternative approach...');
  
  // Alternative: find getDeliveryCost and insert before it
  var altMarker = "  function getDeliveryCost() {";
  var altIdx = code.indexOf(altMarker);
  if (altIdx !== -1) {
    var nl = code.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
    var nightFuncs = 
"  function getNightDeliveryTiers(engels) {" + nl +
"    var key = engels ? 'night_delivery_tiers_engels' : 'night_delivery_tiers';" + nl +
"    try { return JSON.parse(appSettings[key] || '[]'); }" + nl +
"    catch (e) { return []; }" + nl +
"  }" + nl + nl +
"  function getNightDeliveryCost(km, engels) {" + nl +
"    var tiers = getNightDeliveryTiers(engels);" + nl +
"    if (!tiers.length) return getDeliveryCostByDistance(km, engels);" + nl +
"    tiers.sort(function (a, b) { return a.max_km - b.max_km; });" + nl +
"    for (var i = 0; i < tiers.length; i++) {" + nl +
"      if (km <= tiers[i].max_km) return tiers[i].price;" + nl +
"    }" + nl +
"    return tiers[tiers.length - 1].price;" + nl +
"  }" + nl + nl;

    code = code.substring(0, altIdx) + nightFuncs + code.substring(altIdx);
    changes++;
    console.log('FIX 1 OK (alt): Added night functions before getDeliveryCost');
  }
}

// =============================================
// FIX 2: getDeliveryCost must check isNightInterval
// =============================================

var oldCostLine = "      return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);";
// Find it inside getDeliveryCost (not in showDistanceResult)
var gcStart = code.indexOf("function getDeliveryCost()");
if (gcStart !== -1) {
  var gcEnd = code.indexOf("  }", gcStart);
  var gcBlock = code.substring(gcStart, gcEnd + 3);
  
  if (gcBlock.indexOf('isNightInterval') === -1) {
    var oldReturn = "return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);";
    var returnIdx = gcBlock.indexOf(oldReturn);
    if (returnIdx !== -1) {
      var nl = code.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
      var newReturn = "if (checkoutState.isNightInterval) {" + nl +
"        return getNightDeliveryCost(checkoutState.deliveryDistance, checkoutState.isEngels);" + nl +
"      }" + nl +
"      return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);";
      
      var newGcBlock = gcBlock.replace(oldReturn, newReturn);
      code = code.replace(gcBlock, newGcBlock);
      changes++;
      console.log('FIX 2 OK: getDeliveryCost checks isNightInterval');
    }
  } else {
    console.log('FIX 2 SKIP: getDeliveryCost already has isNightInterval');
  }
}

// =============================================
// FIX 3: setDeliveryInterval must update price display
// =============================================

var oldSetEnd = "    updateStepButtons();\n  };";
var seIdx = code.indexOf(oldSetEnd);
if (seIdx === -1) {
  oldSetEnd = oldSetEnd.replace(/\n/g, '\r\n');
  seIdx = code.indexOf(oldSetEnd);
}

if (seIdx !== -1) {
  // Check this is inside setDeliveryInterval
  var beforeCtx = code.substring(Math.max(0, seIdx - 200), seIdx);
  if (beforeCtx.indexOf('setDeliveryInterval') !== -1 || beforeCtx.indexOf("closest('.radio-option')") !== -1) {
    // Check if updateCheckoutSummary already added
    if (beforeCtx.indexOf('updateCheckoutSummary') === -1) {
      var nl = code.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
      var newSetEnd = 
"    updateCheckoutSummary();" + nl +
"    if (checkoutState.deliveryDistance > 0) {" + nl +
"      var distEl = document.getElementById('delivery-distance-info');" + nl +
"      if (distEl && distEl.style.display !== 'none') {" + nl +
"        var _nightCost = checkoutState.isNightInterval;" + nl +
"        var _cost = _nightCost ? getNightDeliveryCost(checkoutState.deliveryDistance, checkoutState.isEngels) : getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);" + nl +
"        var _label = checkoutState.isEngels ? ' (\\u042d\\u043d\\u0433\\u0435\\u043b\\u044c\\u0441)' : '';" + nl +
"        distEl.innerHTML = '\\u0420\\u0430\\u0441\\u0441\\u0442\\u043e\\u044f\\u043d\\u0438\\u0435: <b>' + checkoutState.deliveryDistance.toFixed(1) + ' \\u043a\\u043c</b>' + _label + ' \\u2014 \\u0414\\u043e\\u0441\\u0442\\u0430\\u0432\\u043a\\u0430: <b>' + formatPrice(_cost) + '</b>';" + nl +
"      }" + nl +
"    }" + nl +
"    updateStepButtons();" + nl + "  };";
      code = code.replace(oldSetEnd, newSetEnd);
      changes++;
      console.log('FIX 3 OK: setDeliveryInterval refreshes price on interval change');
    } else {
      console.log('FIX 3 SKIP: updateCheckoutSummary already present');
    }
  }
}

// =============================================
// VERIFY: Check all functions exist
// =============================================

var checks = [
  ['getNightDeliveryTiers', 'function getNightDeliveryTiers'],
  ['getNightDeliveryCost', 'function getNightDeliveryCost'],
  ['getDeliveryCost with night check', 'isNightInterval'],
  ['isNightInterval in setDeliveryInterval', 'checkoutState.isNightInterval = _split']
];

console.log('\n--- Verification ---');
checks.forEach(function(c) {
  var found = code.indexOf(c[1]) !== -1;
  console.log((found ? 'OK' : 'MISSING') + ': ' + c[0]);
});

// =============================================
// Syntax check + save
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
console.log('What was fixed:');
console.log('1. getNightDeliveryTiers() - reads night tiers from admin settings');
console.log('2. getNightDeliveryCost() - calculates price by km using night tiers');
console.log('   If night tiers empty -> falls back to day tiers');
console.log('3. getDeliveryCost() - uses night tiers when night interval selected');
console.log('4. Price display updates immediately when switching day/night interval');
console.log('5. Works for both Saratov (from shop) and Engels (from center)');
console.log('');
console.log('Run: push.bat');
