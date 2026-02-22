var fs = require('fs');
var path = require('path');

var adminPath = path.join(__dirname, 'public', 'admin.js');
var appPath = path.join(__dirname, 'public', 'app.js');
var changes = 0;

// ============================================================
// 1) admin.js: Add comment settings section in loadSettings
// ============================================================
var admin = fs.readFileSync(adminPath, 'utf8');

var marker1 = "h += '</div>';\n\n      h += '<div class=\"settings-section\">';\n      h += '<div class=\"settings-section-title\">\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u0430\u044F \u043F\u043E\u0437\u0438\u0446\u0438\u044F \u043A \u0431\u0443\u043A\u0435\u0442\u0443</div>';";

if (admin.indexOf(marker1) !== -1) {
  var insertBlock =
    "h += '</div>';\n\n" +
    "      h += '<div class=\"settings-section\">';\n" +
    "      h += '<div class=\"settings-section-title\">\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0437\u0430\u043A\u0430\u0437\u0443</div>';\n" +
    "      h += '<div style=\"font-size:12px;color:var(--text-secondary);margin-bottom:12px\">\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0438 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 \u0432 \u043F\u043E\u043B\u0435 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044F \u043F\u0440\u0438 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0438 \u0437\u0430\u043A\u0430\u0437\u0430.</div>';\n" +
    "      h += '<div class=\"form-group\"><label class=\"form-label\">\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A</label>' +\n" +
    "        '<input type=\"text\" class=\"form-input\" id=\"s-comment-label\" value=\"' + esc(s.comment_label || '') + '\" placeholder=\"\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0437\u0430\u043A\u0430\u0437\u0443\"></div>';\n" +
    "      h += '<div class=\"form-group\"><label class=\"form-label\">\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 (placeholder)</label>' +\n" +
    "        '<input type=\"text\" class=\"form-input\" id=\"s-comment-placeholder\" value=\"' + esc(s.comment_placeholder || '') + '\" placeholder=\"\u041F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u044F, \u043E\u0441\u043E\u0431\u044B\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0438\u044F\"></div>';\n" +
    "      h += '</div>';\n\n" +
    "      h += '<div class=\"settings-section\">';\n" +
    "      h += '<div class=\"settings-section-title\">\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u0430\u044F \u043F\u043E\u0437\u0438\u0446\u0438\u044F \u043A \u0431\u0443\u043A\u0435\u0442\u0443</div>';";

  admin = admin.replace(marker1, insertBlock);
  changes++;
  console.log('1) Admin: added comment settings section');
} else {
  console.log('WARNING: Could not find marker for comment section insertion');
}

// ============================================================
// 2) admin.js: Add comment fields to saveSettings data object
// ============================================================
var saveMarker = "social_vk: document.getElementById('s-social-vk').value";
if (admin.indexOf(saveMarker) !== -1) {
  admin = admin.replace(
    saveMarker,
    "social_vk: document.getElementById('s-social-vk').value,\n      comment_label: document.getElementById('s-comment-label').value,\n      comment_placeholder: document.getElementById('s-comment-placeholder').value"
  );
  changes++;
  console.log('2) Admin: added comment fields to saveSettings');
} else {
  console.log('WARNING: Could not find saveSettings marker');
}

fs.writeFileSync(adminPath, admin, 'utf8');

// ============================================================
// 3) app.js: Use dynamic label and placeholder from settings
// ============================================================
var app = fs.readFileSync(appPath, 'utf8');

var oldComment = "'<div class=\"form-group\"><label>\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0437\u0430\u043A\u0430\u0437\u0443</label>' +\n          '<textarea id=\"field-comment\" placeholder=\"\u041F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u044F, \u043E\u0441\u043E\u0431\u044B\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0438\u044F\" oninput=\"saveCheckoutDraft()\"></textarea></div>'";

if (app.indexOf(oldComment) !== -1) {
  var newComment = "'<div class=\"form-group\"><label>' + (appSettings.comment_label || '\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0437\u0430\u043A\u0430\u0437\u0443') + '</label>' +\n          '<textarea id=\"field-comment\" placeholder=\"' + (appSettings.comment_placeholder || '\u041F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u044F, \u043E\u0441\u043E\u0431\u044B\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0438\u044F') + '\" oninput=\"saveCheckoutDraft()\"></textarea></div>'";
  app = app.replace(oldComment, newComment);
  changes++;
  console.log('3) App: comment field now uses dynamic settings');
} else {
  console.log('WARNING: Could not find comment field in app.js');
  // Debug: try to find partial match
  var idx = app.indexOf('field-comment');
  if (idx !== -1) {
    console.log('   Found field-comment at char ' + idx);
    console.log('   Context: ' + JSON.stringify(app.substring(idx - 80, idx + 120)));
  }
}

fs.writeFileSync(appPath, app, 'utf8');

console.log('\nDone! ' + changes + ' changes applied.');
if (changes === 3) {
  console.log('SUCCESS: All changes applied!');
  console.log('Restart the server and refresh the page.');
  console.log('Go to Admin > Settings to set the comment label and placeholder.');
} else {
  console.log('Some changes may not have been applied. Check the warnings above.');
}
