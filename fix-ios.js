var fs = require('fs');

// ========== 1. admin.html - viewport-fit=cover ==========
var adminHtml = fs.readFileSync('public/admin.html', 'utf8');
if (adminHtml.indexOf('viewport-fit=cover') === -1) {
  adminHtml = adminHtml.replace(
    'content="width=device-width, initial-scale=1.0"',
    'content="width=device-width, initial-scale=1.0, viewport-fit=cover"'
  );
  fs.writeFileSync('public/admin.html', adminHtml);
  console.log('[1] admin.html: viewport-fit=cover added');
} else {
  console.log('[1] admin.html: already has viewport-fit');
}

// ========== 2. index.html - viewport-fit=cover ==========
var indexHtml = fs.readFileSync('public/index.html', 'utf8');
if (indexHtml.indexOf('viewport-fit=cover') === -1) {
  indexHtml = indexHtml.replace(
    'content="width=device-width, initial-scale=1.0, user-scalable=no"',
    'content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover"'
  );
  fs.writeFileSync('public/index.html', indexHtml);
  console.log('[2] index.html: viewport-fit=cover added');
} else {
  console.log('[2] index.html: already has viewport-fit');
}

// ========== 3. admin.css - iOS fixes ==========
var css = fs.readFileSync('public/admin.css', 'utf8');
var cssChanges = 0;

// 3a: html,body - fill-available + font smoothing + text-size-adjust
if (css.indexOf('-webkit-fill-available') === -1) {
  css = css.replace(
    'min-height: 100vh;\n}',
    'min-height: 100vh;\n  min-height: -webkit-fill-available;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n  -webkit-text-size-adjust: 100%;\n}'
  );
  cssChanges++;
  console.log('[3a] admin.css: fill-available + smoothing added');
}

// 3b: button/input appearance
if (css.indexOf('-webkit-appearance: none') === -1 || css.indexOf('button, select, input, textarea {') !== -1) {
  css = css.replace(
    'button, select, input, textarea { font-family: inherit; font-size: inherit; }\nbutton { cursor: pointer; }',
    'button, select, input, textarea {\n  font-family: inherit;\n  font-size: inherit;\n  -webkit-appearance: none;\n  -moz-appearance: none;\n  appearance: none;\n}\nselect {\n  -webkit-appearance: menulist;\n  -moz-appearance: menulist;\n  appearance: menulist;\n}\nbutton {\n  cursor: pointer;\n  -webkit-tap-highlight-color: transparent;\n}'
  );
  cssChanges++;
  console.log('[3b] admin.css: appearance fixes added');
}

// 3c: modal-overlay - inset to explicit + webkit-backdrop-filter
if (css.indexOf('inset: 0') !== -1) {
  css = css.replace(/\.modal-overlay \{[^}]*inset: 0;/g, function(match) {
    return match.replace('inset: 0;', 'top: 0; right: 0; bottom: 0; left: 0;');
  });
  cssChanges++;
  console.log('[3c] admin.css: modal inset fixed');
}

if (css.indexOf('.modal-overlay') !== -1 && css.indexOf('-webkit-backdrop-filter') === -1) {
  css = css.replace(
    'backdrop-filter: blur(4px);',
    '-webkit-backdrop-filter: blur(4px);\n  backdrop-filter: blur(4px);'
  );
  cssChanges++;
  console.log('[3d] admin.css: webkit-backdrop-filter added');
}

// 3e: modal-card - overscroll + webkit-overflow-scrolling
if (css.indexOf('.modal-card') !== -1 && css.indexOf('-webkit-overflow-scrolling') === -1) {
  css = css.replace(
    'overflow-y: auto;\n  padding: 28px;',
    'overflow-y: auto;\n  -webkit-overflow-scrolling: touch;\n  padding: 28px;\n  overscroll-behavior: contain;'
  );
  cssChanges++;
  console.log('[3e] admin.css: modal scroll fixes');
}

// 3f: sidebar-overlay inset
if (css.indexOf('.sidebar-overlay') !== -1 && css.indexOf('sidebar-overlay') !== -1) {
  css = css.replace(/\.sidebar-overlay \{[^}]*inset: 0;/g, function(match) {
    return match.replace('inset: 0;', 'top: 0; right: 0; bottom: 0; left: 0;');
  });
  cssChanges++;
  console.log('[3f] admin.css: sidebar overlay inset fixed');
}

// 3g: sticky prefix for topbar
if (css.indexOf('position: sticky') !== -1 && css.indexOf('-webkit-sticky') === -1) {
  css = css.replace(/position: sticky;/g, 'position: -webkit-sticky;\n  position: sticky;');
  cssChanges++;
  console.log('[3g] admin.css: webkit-sticky added');
}

// 3h: modal overscroll
if (css.indexOf('.modal-overlay') !== -1 && css.indexOf('overscroll-behavior: contain') === -1) {
  css = css.replace(
    /\.modal-overlay \{([^}]*)\}/,
    function(m, inner) { return '.modal-overlay {' + inner + '  overscroll-behavior: contain;\n}'; }
  );
  cssChanges++;
  console.log('[3h] admin.css: overscroll added');
}

// 3i: Add iOS-specific block at end
if (css.indexOf('@supports (-webkit-touch-callout: none)') === -1) {
  css += '\n\n/* ==================== iOS / Safari Fixes ==================== */\n@supports (-webkit-touch-callout: none) {\n  html, body {\n    min-height: -webkit-fill-available;\n  }\n\n  #main-wrap {\n    padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px));\n  }\n\n  .modal-card {\n    max-height: -webkit-fill-available;\n    padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px));\n  }\n\n  .mobile-bottom-nav {\n    padding-bottom: env(safe-area-inset-bottom, 0px);\n  }\n\n  #admin-toast-container {\n    bottom: calc(80px + env(safe-area-inset-bottom, 0px));\n  }\n\n  .form-input,\n  .form-select,\n  .form-textarea {\n    font-size: 16px;\n    border-radius: 8px;\n  }\n}\n';
  cssChanges++;
  console.log('[3i] admin.css: iOS @supports block added');
}

if (cssChanges > 0) {
  fs.writeFileSync('public/admin.css', css);
  console.log('[3] admin.css: ' + cssChanges + ' iOS fixes applied');
} else {
  console.log('[3] admin.css: no changes needed');
}

// ========== 4. style.css - iOS fixes ==========
var style = fs.readFileSync('public/style.css', 'utf8');
var styleChanges = 0;

// 4a: html,body fill-available + text-size-adjust
if (style.indexOf('-webkit-fill-available') === -1) {
  style = style.replace(
    'min-height: 100vh;\n}\n\nbody {',
    'min-height: 100vh;\n  min-height: -webkit-fill-available;\n  -moz-osx-font-smoothing: grayscale;\n  -webkit-text-size-adjust: 100%;\n}\n\nbody {'
  );
  style = style.replace(
    'min-height: 100vh;\n}\n\na {',
    'min-height: 100vh;\n  min-height: -webkit-fill-available;\n}\n\na {\n  -webkit-tap-highlight-color: transparent;'
  );
  styleChanges++;
  console.log('[4a] style.css: fill-available added');
}

// 4b: button tap highlight
if (style.indexOf('-webkit-tap-highlight-color') === -1) {
  style = style.replace(
    'cursor: pointer;\n}',
    'cursor: pointer;\n  -webkit-tap-highlight-color: transparent;\n}'
  );
  styleChanges++;
  console.log('[4b] style.css: tap-highlight added');
}

// 4c: sticky prefix for tab-bar
if (style.indexOf('#tab-bar') !== -1 && style.indexOf('-webkit-sticky') === -1) {
  style = style.replace(
    /#tab-bar \{[^}]*position: sticky;/,
    function(m) { return m.replace('position: sticky;', 'position: -webkit-sticky;\n  position: sticky;'); }
  );
  styleChanges++;
  console.log('[4c] style.css: webkit-sticky for tab-bar');
}

// 4d: Add iOS @supports block
if (style.indexOf('@supports (-webkit-touch-callout: none)') === -1) {
  style += '\n\n/* ==================== iOS / Safari Fixes ==================== */\n@supports (-webkit-touch-callout: none) {\n  html, body {\n    min-height: -webkit-fill-available;\n  }\n\n  .form-group input,\n  .form-group textarea,\n  .form-group select {\n    font-size: 16px;\n  }\n\n  .form-input-date {\n    font-size: 16px;\n  }\n\n  .modal-overlay {\n    -webkit-backdrop-filter: blur(6px);\n  }\n\n  #tab-bar {\n    position: -webkit-sticky;\n    position: sticky;\n  }\n\n  button, a {\n    -webkit-tap-highlight-color: transparent;\n  }\n\n  .product-card,\n  .radio-option,\n  .checkbox-option {\n    -webkit-tap-highlight-color: transparent;\n  }\n}\n';
  styleChanges++;
  console.log('[4d] style.css: iOS @supports block added');
}

if (styleChanges > 0) {
  fs.writeFileSync('public/style.css', style);
  console.log('[4] style.css: ' + styleChanges + ' iOS fixes applied');
} else {
  console.log('[4] style.css: no changes needed');
}

console.log('\nAll done! Restart: pm2 restart 0');
