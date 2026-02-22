var fs = require('fs');
var code = fs.readFileSync('public/app.js', 'utf8');

try {
  new Function(code);
  console.log('=== app.js: NO SYNTAX ERRORS ===');
} catch (e) {
  console.error('=== app.js SYNTAX ERROR ===');
  console.error(e.message);

  var lines = code.split(/\r?\n/);
  var match = e.message.match(/position (\d+)/);
  if (!match) match = e.message.match(/:(\d+):/);
  
  if (match) {
    var pos = parseInt(match[1]);
    var charCount = 0;
    for (var i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1;
      if (charCount >= pos) {
        console.error('Near line ' + (i + 1) + ':');
        for (var j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          console.log((j + 1) + (j === i ? ' >>> ' : '     ') + lines[j]);
        }
        break;
      }
    }
  }
}

// Also check admin.js
var admin = fs.readFileSync('public/admin.js', 'utf8');
try {
  new Function(admin);
  console.log('=== admin.js: NO SYNTAX ERRORS ===');
} catch (e) {
  console.error('=== admin.js SYNTAX ERROR ===');
  console.error(e.message);
}
