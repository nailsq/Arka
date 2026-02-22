var fs = require('fs');

// ====================================================================
// PATCH app.js
// ====================================================================
var code = fs.readFileSync('public/app.js', 'utf8');
var appChanges = 0;

// --- 1. Add isAfterCutoff helper if not exists ---
if (code.indexOf('function isAfterCutoff') === -1) {
  var anchor = 'function getPickupCutoffHour() {';
  var anchorIdx = code.indexOf(anchor);
  if (anchorIdx === -1) { console.error('FAIL: getPickupCutoffHour not found'); process.exit(1); }
  var endOfFunc = code.indexOf('}', anchorIdx);
  var insertAt = endOfFunc + 1;
  var helper = '\n\n  var EARLY_MORNING_HOUR = 6;\n\n  function isAfterCutoff(h, cutoff) {\n    return h >= cutoff || h < EARLY_MORNING_HOUR;\n  }';
  code = code.substring(0, insertAt) + helper + code.substring(insertAt);
  appChanges++;
  console.log('[app.js] Added isAfterCutoff helper');
} else {
  console.log('[app.js] isAfterCutoff already exists');
}

// --- 2. Fix isTodayClosed (checkout default date) ---
var old2 = 'var isTodayClosed = currentHour >= cutoff;';
if (code.indexOf(old2) !== -1) {
  code = code.replace(old2, 'var isTodayClosed = isAfterCutoff(currentHour, cutoff);');
  appChanges++;
  console.log('[app.js] Fixed isTodayClosed');
}

// --- 3. Fix minDate ---
var old3 = 'var minDate = todayStr;';
if (code.indexOf(old3) !== -1) {
  code = code.replace(old3, 'var minDate = isTodayClosed ? tomorrowStr : todayStr;');
  appChanges++;
  console.log('[app.js] Fixed minDate');
}

// --- 4. Fix pastCutoff in renderIntervals ---
// After cutoff: ALL intervals (day AND night) blocked for today
var old4 = 'var pastCutoff = isToday && currentHour >= cutoff;';
if (code.indexOf(old4) !== -1) {
  code = code.replace(old4, 'var pastCutoff = isToday && isAfterCutoff(currentHour, cutoff);');
  appChanges++;
  console.log('[app.js] Fixed pastCutoff');
}

// --- 5. After cutoff: block ALL intervals, not just day ---
// Change: "pastCutoff && nightIntervals.length === 0" -> just "pastCutoff"
// And remove the separate night-only block for pastCutoff
var old5a = "if (pastCutoff && nightIntervals.length === 0) {\n      el.innerHTML = '<div class=\"cutoff-hint\">";
var idx5a = code.indexOf(old5a);
if (idx5a === -1) {
  old5a = old5a.replace(/\n/g, '\r\n');
  idx5a = code.indexOf(old5a);
}
if (idx5a !== -1) {
  // Find the end of this block (return;})
  var endBlock5 = code.indexOf('return;', idx5a);
  var closeBrace5 = code.indexOf('}', endBlock5);
  var oldBlock5 = code.substring(idx5a, closeBrace5 + 1);
  var newBlock5 = "if (pastCutoff) {\n      el.innerHTML = '<div class=\"cutoff-hint\">\u0412\u0441\u0435 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u044b \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044e \u0434\u0430\u0442\u0443.</div>';\n      return;\n    }";
  code = code.replace(oldBlock5, newBlock5);
  appChanges++;
  console.log('[app.js] Fixed: pastCutoff blocks ALL intervals');
}

// Remove "Дневные интервалы недоступны. Доступна ночная доставка" block
var old5b = "if (pastCutoff) {\n      html += '<div class=\"cutoff-hint\">";
var idx5b = code.indexOf(old5b);
if (idx5b === -1) {
  old5b = old5b.replace(/\n/g, '\r\n');
  idx5b = code.indexOf(old5b);
}
if (idx5b !== -1) {
  // Find the closing of the if-else block
  var elseIdx = code.indexOf('} else {', idx5b);
  var joinIdx = code.indexOf(".join('');", elseIdx);
  var closingBrace = code.indexOf('}', joinIdx);
  var oldIfElse = code.substring(idx5b, closingBrace + 1);
  // Replace with just rendering day intervals (no pastCutoff branch needed since we return early)
  var newIfElse = "html = dayIntervals.map(function (iv) { return buildOption(iv, false); }).join('');";
  code = code.replace(oldIfElse, newIfElse);
  appChanges++;
  console.log('[app.js] Removed pastCutoff day-intervals message (returns early now)');
}

// --- 6. Replace night divider with grey button ---
var oldDivider = "html += '<div class=\"night-intervals-divider\"";
var dividerIdx = code.indexOf(oldDivider);
if (dividerIdx !== -1) {
  // Find end of this line (the closing ';')
  var dividerEnd = code.indexOf("';", dividerIdx);
  if (dividerEnd === -1) dividerEnd = code.indexOf("</div>';", dividerIdx);
  if (dividerEnd !== -1) {
    dividerEnd = code.indexOf(';', dividerEnd) + 1;
    var oldDividerFull = code.substring(dividerIdx, dividerEnd);
    var newBtn = "html += '<button type=\"button\" class=\"night-delivery-btn\" id=\"night-toggle-btn\" onclick=\"toggleNightIntervals()\">' +\n" +
"        '\u041d\u043e\u0447\u043d\u0430\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430' + (nextDayStr ? ' \u043d\u0430 ' + nextDayStr : '') +\n" +
"        '</button>';";
    code = code.replace(oldDividerFull, newBtn);
    appChanges++;
    console.log('[app.js] Night divider -> grey button');
  }
}

// --- 7. Fix auto-open for pastCutoff (remove since we return early now) ---
var oldAutoOpen = "if (pastCutoff && nightIntervals.length > 0) {";
var aoIdx = code.indexOf(oldAutoOpen);
if (aoIdx !== -1) {
  var aoEnd = code.indexOf('}', code.indexOf('}', aoIdx) + 1);
  if (aoEnd !== -1) {
    var oldAO = code.substring(aoIdx, aoEnd + 1);
    code = code.replace(oldAO, '');
    appChanges++;
    console.log('[app.js] Removed pastCutoff auto-open (not needed, returns early)');
  }
}

// --- 8. Fix toggleNightIntervals to use btn ---
if (code.indexOf("getElementById('night-toggle-arrow')") !== -1) {
  code = code.replace(
    "var arrow = document.getElementById('night-toggle-arrow');",
    "var btn = document.getElementById('night-toggle-btn');"
  );
  code = code.replace(
    "if (arrow) arrow.style.transform = 'rotate(180deg)';",
    "if (btn) btn.classList.add('active');"
  );
  code = code.replace(
    "if (arrow) arrow.style.transform = '';",
    "if (btn) btn.classList.remove('active');"
  );
  appChanges++;
  console.log('[app.js] toggleNightIntervals uses button class');
}

// --- 9. Fix updateCutoffNotice ---
var old9 = 'var isClosed = isToday && sNow.hours >= cutoffHr;';
if (code.indexOf(old9) !== -1) {
  code = code.replace(old9, 'var isClosed = isToday && isAfterCutoff(sNow.hours, cutoffHr);');
  appChanges++;
  console.log('[app.js] Fixed updateCutoffNotice');
}
// Simplify notice text
var oldNoticeText = "notice.textContent = label + ' \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u0443\u0436\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 (\u043f\u043e\u0441\u043b\u0435 ' + cutoffHr + ':00). \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044e \u0434\u0430\u0442\u0443.';";
if (code.indexOf(oldNoticeText) !== -1) {
  code = code.replace(oldNoticeText, "notice.textContent = label + ' \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044e \u0434\u0430\u0442\u0443.';");
  appChanges++;
  console.log('[app.js] Simplified cutoff notice text');
}

// --- 10. Fix step validation ---
var old10 = 'sNowCheck.hours >= getCutoffHour()';
if (code.indexOf(old10) !== -1) {
  code = code.replace(old10, 'isAfterCutoff(sNowCheck.hours, getCutoffHour())');
  appChanges++;
  console.log('[app.js] Fixed step validation');
}

// --- 11. Fix updateNearestDeliveryHint ---
var old11 = 'currentHour < cutoff && currentHour < startH';
if (code.indexOf(old11) !== -1) {
  code = code.replace(old11, '!isAfterCutoff(currentHour, cutoff) && currentHour < startH');
  appChanges++;
  console.log('[app.js] Fixed nearest delivery hint');
}

// --- 12. Night delivery pricing ---
// Modify getDeliveryCost to use night tiers when night interval is selected
var oldGetCost = "function getDeliveryCost() {\n" +
"    if (checkoutState.deliveryType === 'pickup') return 0;\n" +
"    if (checkoutState.exactTime) {\n" +
"      return parseInt(appSettings.exact_time_surcharge) || 1000;\n" +
"    }\n" +
"    if (checkoutState.deliveryDistance > 0) {\n" +
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
  var newGetCost = "function getNightDeliveryTiers(engels) {\n" +
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
"  }\n\n" +
"  function getDeliveryCost() {\n" +
"    if (checkoutState.deliveryType === 'pickup') return 0;\n" +
"    if (checkoutState.exactTime) {\n" +
"      return parseInt(appSettings.exact_time_surcharge) || 1000;\n" +
"    }\n" +
"    if (checkoutState.deliveryDistance > 0) {\n" +
"      if (checkoutState.isNightInterval) {\n" +
"        return getNightDeliveryCost(checkoutState.deliveryDistance, checkoutState.isEngels);\n" +
"      }\n" +
"      return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);\n" +
"    }\n" +
"    return 0;\n" +
"  }";
  code = code.replace(oldGetCost, newGetCost);
  appChanges++;
  console.log('[app.js] Added night delivery pricing');
}

// --- 13. Make sure setDeliveryInterval tracks isNightInterval ---
var oldSetIv = "window.setDeliveryInterval = function (iv) {\n    checkoutState.deliveryInterval = iv;";
if (code.indexOf(oldSetIv) === -1) oldSetIv = oldSetIv.replace(/\n/g, '\r\n');
if (code.indexOf(oldSetIv) !== -1 && code.indexOf('checkoutState.isNightInterval') === -1) {
  code = code.replace(oldSetIv,
    "window.setDeliveryInterval = function (iv) {\n" +
    "    checkoutState.deliveryInterval = iv;\n" +
    "    var _split = getIntervalsSplit();\n" +
    "    checkoutState.isNightInterval = _split.night.indexOf(iv) !== -1;"
  );
  appChanges++;
  console.log('[app.js] setDeliveryInterval tracks isNightInterval');
} else if (code.indexOf('checkoutState.isNightInterval') !== -1) {
  console.log('[app.js] isNightInterval already tracked');
}

// --- 14. Night delivery date = next day ---
var old14 = 'delivery_date: dateVal,';
if (code.indexOf(old14) !== -1 && code.indexOf('checkoutState.isNightInterval && dateVal') === -1) {
  var new14 = "delivery_date: (function () {\n" +
"        if (checkoutState.isNightInterval && dateVal) {\n" +
"          var _dp = dateVal.split('-');\n" +
"          var _nd = new Date(parseInt(_dp[0]), parseInt(_dp[1]) - 1, parseInt(_dp[2]) + 1);\n" +
"          return _nd.getFullYear() + '-' + String(_nd.getMonth() + 1).padStart(2, '0') + '-' + String(_nd.getDate()).padStart(2, '0');\n" +
"        }\n" +
"        return dateVal;\n" +
"      })(),";
  code = code.replace(old14, new14);
  appChanges++;
  console.log('[app.js] Night delivery date = next day');
} else {
  console.log('[app.js] Night delivery date already patched');
}

// --- 15. Update delivery distance info to show night price ---
var oldDistInfo = "var cost = getDeliveryCostByDistance(km, checkoutState.isEngels);";
if (code.indexOf(oldDistInfo) !== -1) {
  code = code.replace(oldDistInfo,
    "var cost = checkoutState.isNightInterval ? getNightDeliveryCost(km, checkoutState.isEngels) : getDeliveryCostByDistance(km, checkoutState.isEngels);"
  );
  appChanges++;
  console.log('[app.js] Distance info shows night price when night selected');
}

// --- 16. Recalculate cost when interval changes ---
var afterSetIvSteps = 'updateStepButtons();\n  };';
var setIvEnd = code.indexOf(afterSetIvSteps);
if (setIvEnd === -1) {
  afterSetIvSteps = afterSetIvSteps.replace(/\n/g, '\r\n');
  setIvEnd = code.indexOf(afterSetIvSteps);
}
if (setIvEnd !== -1) {
  code = code.replace(afterSetIvSteps, 'updateStepButtons();\n    updateCheckoutSummary();\n  };');
  appChanges++;
  console.log('[app.js] setDeliveryInterval recalculates summary');
}

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('[app.js] Total: ' + appChanges + ' changes\n');

// ====================================================================
// PATCH style.css
// ====================================================================
var css = fs.readFileSync('public/style.css', 'utf8');
var cssChanges = 0;

// Remove old divider styles if present
var oldDivCss = '.night-intervals-divider {';
if (css.indexOf(oldDivCss) !== -1) {
  var dIdx = css.indexOf(oldDivCss);
  var nightIconStr = '.night-icon';
  var niIdx = css.indexOf(nightIconStr, dIdx);
  if (niIdx !== -1) {
    var niEnd = css.indexOf('}', niIdx);
    css = css.substring(0, dIdx) + css.substring(niEnd + 1);
    cssChanges++;
    console.log('[style.css] Removed old divider styles');
  }
}

// Remove old night-delivery-btn if exists (we'll add fresh)
var oldBtnCss = '.night-delivery-btn {';
if (css.indexOf(oldBtnCss) !== -1) {
  var bIdx = css.indexOf(oldBtnCss);
  // Find the last related rule (.night-delivery-btn.active { ... })
  var activeRule = css.indexOf('.night-delivery-btn.active {', bIdx);
  var endOfActive = activeRule !== -1 ? css.indexOf('}', activeRule) + 1 : -1;
  if (endOfActive > 0) {
    css = css.substring(0, bIdx) + css.substring(endOfActive);
    cssChanges++;
  }
}

// Add fresh button styles - subtle grey
var btnStyles = '\n.night-delivery-btn {\n' +
'  display: block;\n' +
'  width: 100%;\n' +
'  margin: 16px 0 10px;\n' +
'  padding: 14px 20px;\n' +
'  font-size: 14px;\n' +
'  font-weight: 500;\n' +
'  color: #555;\n' +
'  background: #f0f0f3;\n' +
'  border: 1px solid #ddd;\n' +
'  border-radius: 12px;\n' +
'  cursor: pointer;\n' +
'  text-align: center;\n' +
'  letter-spacing: 0.3px;\n' +
'  transition: background 0.2s, border-color 0.2s;\n' +
'}\n' +
'.night-delivery-btn:active {\n' +
'  background: #e4e4ea;\n' +
'}\n' +
'.night-delivery-btn.active {\n' +
'  background: #e8e8ee;\n' +
'  border-color: #bbb;\n' +
'  color: #333;\n' +
'}\n';

css += btnStyles;
cssChanges++;
console.log('[style.css] Added subtle grey button styles');

fs.writeFileSync('public/style.css', css, 'utf8');
console.log('[style.css] Total: ' + cssChanges + ' changes\n');

// ====================================================================
// PATCH admin.js - add night delivery tiers
// ====================================================================
var admin = fs.readFileSync('public/admin.js', 'utf8');
var adminChanges = 0;

// Add night tiers sections after Engels tiers
var afterEngels = "h += '</div>';\n\n      h += '<div class=\"settings-section\">';\n      h += '<div class=\"settings-section-title\">\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438 \u043f\u043e \u0434\u043d\u044f\u043c";
var aeIdx = admin.indexOf(afterEngels);
if (aeIdx === -1) {
  afterEngels = afterEngels.replace(/\n/g, '\r\n');
  aeIdx = admin.indexOf(afterEngels);
}

if (aeIdx !== -1 && admin.indexOf('night_delivery_tiers') === -1) {
  var nightSections = "h += '</div>';\n\n" +
"      h += '<div class=\"settings-section\">';\n" +
"      h += '<div class=\"settings-section-title\">\u041d\u043e\u0447\u043d\u0430\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430 \u2014 \u0421\u0430\u0440\u0430\u0442\u043e\u0432</div>';\n" +
"      h += '<div id=\"s-tiers-list-night-saratov\"></div>';\n" +
"      h += '<button type=\"button\" class=\"btn btn-sm\" onclick=\"addDeliveryTier(\\'night-saratov\\')\" style=\"margin-top:8px\">+ \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0437\u043e\u043d\u0443</button>';\n" +
"      h += '<input type=\"hidden\" id=\"s-night-delivery-tiers\">';\n" +
"      h += '<div style=\"font-size:12px;color:var(--text-secondary);margin-top:8px\">\u0422\u0430\u0440\u0438\u0444\u044b \u0434\u043b\u044f \u043d\u043e\u0447\u043d\u043e\u0439 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438. \u0415\u0441\u043b\u0438 \u043f\u0443\u0441\u0442\u043e \u2014 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u044e\u0442\u0441\u044f \u0434\u043d\u0435\u0432\u043d\u044b\u0435 \u0442\u0430\u0440\u0438\u0444\u044b.</div>';\n" +
"      h += '</div>';\n\n" +
"      h += '<div class=\"settings-section\">';\n" +
"      h += '<div class=\"settings-section-title\">\u041d\u043e\u0447\u043d\u0430\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430 \u2014 \u042d\u043d\u0433\u0435\u043b\u044c\u0441</div>';\n" +
"      h += '<div id=\"s-tiers-list-night-engels\"></div>';\n" +
"      h += '<button type=\"button\" class=\"btn btn-sm\" onclick=\"addDeliveryTier(\\'night-engels\\')\" style=\"margin-top:8px\">+ \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0437\u043e\u043d\u0443</button>';\n" +
"      h += '<input type=\"hidden\" id=\"s-night-delivery-tiers-engels\">';\n" +
"      h += '<div style=\"font-size:12px;color:var(--text-secondary);margin-top:8px\">\u0422\u0430\u0440\u0438\u0444\u044b \u0434\u043b\u044f \u043d\u043e\u0447\u043d\u043e\u0439 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438. \u0415\u0441\u043b\u0438 \u043f\u0443\u0441\u0442\u043e \u2014 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u044e\u0442\u0441\u044f \u0434\u043d\u0435\u0432\u043d\u044b\u0435 \u0442\u0430\u0440\u0438\u0444\u044b.</div>';\n" +
"      h += '</div>';\n\n" +
"      h += '<div class=\"settings-section\">';\n" +
"      h += '<div class=\"settings-section-title\">\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438 \u043f\u043e \u0434\u043d\u044f\u043c";

  admin = admin.replace(afterEngels, nightSections);
  adminChanges++;
  console.log('[admin.js] Added night delivery tiers sections');
}

// Render night tiers after Engels tiers rendering
var afterEngelsRender = "renderDeliveryTiers(tiersEng, 'engels');";
if (admin.indexOf(afterEngelsRender) !== -1 && admin.indexOf("night_delivery_tiers") === -1) {
  var nightRender = afterEngelsRender + "\n\n" +
"      var tiersNightSar = [];\n" +
"      try { tiersNightSar = JSON.parse(s.night_delivery_tiers || '[]'); } catch (e) {}\n" +
"      renderDeliveryTiers(tiersNightSar, 'night-saratov');\n\n" +
"      var tiersNightEng = [];\n" +
"      try { tiersNightEng = JSON.parse(s.night_delivery_tiers_engels || '[]'); } catch (e) {}\n" +
"      renderDeliveryTiers(tiersNightEng, 'night-engels');";
  admin = admin.replace(afterEngelsRender, nightRender);
  adminChanges++;
  console.log('[admin.js] Added night tiers rendering');
}

// Collect night tiers in collectDeliveryTiers
var oldCollect = "function collectDeliveryTiers() {\n" +
"    var hiddenSar = document.getElementById('s-delivery-tiers');\n" +
"    if (hiddenSar) hiddenSar.value = collectTiersFrom('s-tiers-list-saratov');\n" +
"    var hiddenEng = document.getElementById('s-delivery-tiers-engels');\n" +
"    if (hiddenEng) hiddenEng.value = collectTiersFrom('s-tiers-list-engels');\n" +
"  }";
var ocIdx = admin.indexOf(oldCollect);
if (ocIdx === -1) {
  oldCollect = oldCollect.replace(/\n/g, '\r\n');
  ocIdx = admin.indexOf(oldCollect);
}
if (ocIdx !== -1) {
  var newCollect = "function collectDeliveryTiers() {\n" +
"    var hiddenSar = document.getElementById('s-delivery-tiers');\n" +
"    if (hiddenSar) hiddenSar.value = collectTiersFrom('s-tiers-list-saratov');\n" +
"    var hiddenEng = document.getElementById('s-delivery-tiers-engels');\n" +
"    if (hiddenEng) hiddenEng.value = collectTiersFrom('s-tiers-list-engels');\n" +
"    var hiddenNightSar = document.getElementById('s-night-delivery-tiers');\n" +
"    if (hiddenNightSar) hiddenNightSar.value = collectTiersFrom('s-tiers-list-night-saratov');\n" +
"    var hiddenNightEng = document.getElementById('s-night-delivery-tiers-engels');\n" +
"    if (hiddenNightEng) hiddenNightEng.value = collectTiersFrom('s-tiers-list-night-engels');\n" +
"  }";
  admin = admin.replace(oldCollect, newCollect);
  adminChanges++;
  console.log('[admin.js] collectDeliveryTiers includes night tiers');
}

// Add night tiers to saveSettings data
var afterEngTiers = "delivery_distance_tiers_engels: document.getElementById('s-delivery-tiers-engels').value,";
if (admin.indexOf(afterEngTiers) !== -1 && admin.indexOf("night_delivery_tiers:") === -1) {
  admin = admin.replace(afterEngTiers, afterEngTiers + "\n" +
"      night_delivery_tiers: document.getElementById('s-night-delivery-tiers') ? document.getElementById('s-night-delivery-tiers').value : '',\n" +
"      night_delivery_tiers_engels: document.getElementById('s-night-delivery-tiers-engels') ? document.getElementById('s-night-delivery-tiers-engels').value : '',");
  adminChanges++;
  console.log('[admin.js] saveSettings includes night tiers');
}

fs.writeFileSync('public/admin.js', admin, 'utf8');
console.log('[admin.js] Total: ' + adminChanges + ' changes\n');

console.log('=== ALL DONE ===');
console.log('');
console.log('Changes:');
console.log('1. Night button: subtle grey style (not bright)');
console.log('2. After 19:00 cutoff (and until 06:00): ALL intervals blocked, date = tomorrow');
console.log('3. Night delivery pricing: separate tiers in admin panel');
console.log('   - "Ночная доставка - Саратов" section');
console.log('   - "Ночная доставка - Энгельс" section');
console.log('   - If empty, uses regular day tiers');
console.log('4. Price recalculates when switching between day/night intervals');
console.log('5. Night delivery date = next day in orders');
console.log('');
console.log('Run: push.bat');
