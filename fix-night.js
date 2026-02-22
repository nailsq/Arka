var fs = require('fs');
var f = 'public/app.js';
var code = fs.readFileSync(f, 'utf8');
var changed = 0;

// FIX 1: Add night delivery functions after getDeliveryCostByDistance
var anchor1 = 'return tiers[tiers.length - 1].price;\n  }\n\n  function getDeliveryCost()';
var idx1 = code.indexOf(anchor1);
if (idx1 === -1) {
  anchor1 = 'return tiers[tiers.length - 1].price;\r\n  }\r\n\r\n  function getDeliveryCost()';
  idx1 = code.indexOf(anchor1);
}
if (idx1 !== -1) {
  var nl = anchor1.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  var insertPos = idx1 + ('return tiers[tiers.length - 1].price;' + nl + '  }').length;
  var nightCode = nl + nl +
    '  function getNightDeliveryTiers(engels) {' + nl +
    "    var key = engels ? 'night_delivery_tiers_engels' : 'night_delivery_tiers';" + nl +
    "    try { return JSON.parse(appSettings[key] || '[]'); }" + nl +
    '    catch (e) { return []; }' + nl +
    '  }' + nl + nl +
    '  function getNightDeliveryCost(km, engels) {' + nl +
    '    var tiers = getNightDeliveryTiers(engels);' + nl +
    '    if (!tiers.length) return getDeliveryCostByDistance(km, engels);' + nl +
    '    tiers.sort(function (a, b) { return a.max_km - b.max_km; });' + nl +
    '    for (var i = 0; i < tiers.length; i++) {' + nl +
    '      if (km <= tiers[i].max_km) return tiers[i].price;' + nl +
    '    }' + nl +
    '    return tiers[tiers.length - 1].price;' + nl +
    '  }';
  code = code.substring(0, insertPos) + nightCode + code.substring(insertPos);
  changed++;
  console.log('FIX 1 OK: Added getNightDeliveryTiers + getNightDeliveryCost');
} else {
  console.log('FIX 1 SKIP: anchor not found');
}

// FIX 2: getDeliveryCost must check isNightInterval
var old2 = 'return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);';
var gcIdx = code.indexOf('function getDeliveryCost()');
if (gcIdx !== -1) {
  var searchFrom = gcIdx;
  var retIdx = code.indexOf(old2, searchFrom);
  if (retIdx !== -1 && retIdx < gcIdx + 500) {
    var nl = code.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
    var new2 = 'if (checkoutState.isNightInterval) {' + nl +
      '        return getNightDeliveryCost(checkoutState.deliveryDistance, checkoutState.isEngels);' + nl +
      '      }' + nl +
      '      return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);';
    code = code.substring(0, retIdx) + new2 + code.substring(retIdx + old2.length);
    changed++;
    console.log('FIX 2 OK: getDeliveryCost checks isNightInterval');
  }
}

// FIX 3: setDeliveryInterval needs isNightInterval + price refresh
var old3 = 'window.setDeliveryInterval = function (iv) {';
var si = code.indexOf(old3);
if (si !== -1) {
  var end3 = code.indexOf('updateStepButtons();\n  };', si);
  if (end3 === -1) end3 = code.indexOf('updateStepButtons();\r\n  };', si);
  if (end3 !== -1) {
    var nl = code.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
    var block = code.substring(si, end3);
    if (block.indexOf('isNightInterval') === -1) {
      var afterIv = code.indexOf('checkoutState.deliveryInterval = iv;', si);
      if (afterIv !== -1) {
        var lineEnd = code.indexOf(nl, afterIv);
        var insertAt = lineEnd + nl.length;
        var nightCheck =
          '    var _split = getIntervalsSplit();' + nl +
          "    checkoutState.isNightInterval = _split.night.indexOf(iv) !== -1;" + nl;
        code = code.substring(0, insertAt) + nightCheck + code.substring(insertAt);
        changed++;
        console.log('FIX 3a OK: setDeliveryInterval sets isNightInterval');
      }
    }
  }
  // Add updateCheckoutSummary + price refresh before updateStepButtons
  var endMark = 'updateStepButtons();\n  };';
  var endIdx = code.indexOf(endMark, si);
  if (endIdx === -1) {
    endMark = 'updateStepButtons();\r\n  };';
    endIdx = code.indexOf(endMark, si);
  }
  if (endIdx !== -1) {
    var beforeCtx = code.substring(si, endIdx);
    if (beforeCtx.indexOf('updateCheckoutSummary') === -1) {
      var nl = code.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
      var extra =
        '    updateCheckoutSummary();' + nl +
        '    if (checkoutState.deliveryDistance > 0) {' + nl +
        "      var distEl = document.getElementById('delivery-distance-info');" + nl +
        "      if (distEl && distEl.style.display !== 'none') {" + nl +
        '        var _nc = checkoutState.isNightInterval' + nl +
        '          ? getNightDeliveryCost(checkoutState.deliveryDistance, checkoutState.isEngels)' + nl +
        '          : getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);' + nl +
        "        distEl.innerHTML = '\\u0420\\u0430\\u0441\\u0441\\u0442\\u043e\\u044f\\u043d\\u0438\\u0435: <b>' + checkoutState.deliveryDistance.toFixed(1) + ' \\u043a\\u043c</b> \\u2014 \\u0414\\u043e\\u0441\\u0442\\u0430\\u0432\\u043a\\u0430: <b>' + formatPrice(_nc) + '</b>';" + nl +
        '      }' + nl +
        '    }' + nl;
      code = code.substring(0, endIdx) + extra + code.substring(endIdx);
      changed++;
      console.log('FIX 3b OK: setDeliveryInterval refreshes price');
    }
  }
}

// FIX 4: showDistanceResult must use night cost
var old4 = 'var cost = getDeliveryCostByDistance(km, checkoutState.isEngels);';
var sdIdx = code.indexOf('function showDistanceResult');
if (sdIdx !== -1) {
  var costIdx = code.indexOf(old4, sdIdx);
  if (costIdx !== -1 && costIdx < sdIdx + 600) {
    var nl = code.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
    var new4 = 'var cost = checkoutState.isNightInterval' + nl +
      '          ? getNightDeliveryCost(km, checkoutState.isEngels)' + nl +
      '          : getDeliveryCostByDistance(km, checkoutState.isEngels);';
    code = code.substring(0, costIdx) + new4 + code.substring(costIdx + old4.length);
    changed++;
    console.log('FIX 4 OK: showDistanceResult uses night cost');
  }
}

fs.writeFileSync(f, code, 'utf8');
console.log('Total changes: ' + changed);

// Verify
var verify = fs.readFileSync(f, 'utf8');
var checks = [
  'function getNightDeliveryTiers',
  'function getNightDeliveryCost',
  'checkoutState.isNightInterval',
  'getNightDeliveryCost(checkoutState.deliveryDistance',
  'getNightDeliveryCost(km, checkoutState.isEngels)'
];
console.log('\nVerification:');
checks.forEach(function(c) {
  console.log((verify.indexOf(c) !== -1 ? 'OK' : 'MISSING') + ': ' + c);
});
