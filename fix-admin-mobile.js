var fs = require('fs');

// Fix 1: admin.css - add category buttons visibility on mobile
var css = fs.readFileSync('public/admin.css', 'utf8');

var oldCss = '  .data-table tbody td:nth-child(3) {\n    display: none;\n  }';
var newCss = '  .data-table tbody td:nth-child(3) {\n    display: none;\n  }\n\n  .data-table tbody td:nth-child(3):last-child {\n    display: block;\n    width: 100%;\n    padding-top: 8px;\n    border-top: 1px solid var(--border);\n    margin-top: 4px;\n  }\n\n  .data-table tbody td:nth-child(3):last-child .btn-group {\n    display: flex;\n    gap: 8px;\n  }\n\n  .data-table tbody td:nth-child(3):last-child .btn-group .btn {\n    flex: 1;\n    min-height: 40px;\n    justify-content: center;\n    font-size: 13px;\n  }';

if (css.indexOf('td:nth-child(3):last-child') === -1) {
  css = css.replace(oldCss, newCss);
  fs.writeFileSync('public/admin.css', css);
  console.log('CSS fixed: category buttons now visible on mobile');
} else {
  console.log('CSS already patched');
}

// Fix 2: admin.js - add product ID in product list
var js = fs.readFileSync('public/admin.js', 'utf8');

var oldJs = "'<td><strong>' + esc(p.name) + '</strong>' + sizesInfo + '</td>' +";
var newJs = "'<td><strong>' + esc(p.name) + '</strong><div style=\"font-size:10px;color:var(--text-secondary)\">ID: ' + p.id + '</div>' + sizesInfo + '</td>' +";

if (js.indexOf("ID: ' + p.id") === -1) {
  js = js.replace(oldJs, newJs);
  fs.writeFileSync('public/admin.js', js);
  console.log('JS fixed: product ID now shown in product list');
} else {
  console.log('JS already patched');
}

console.log('Done!');
