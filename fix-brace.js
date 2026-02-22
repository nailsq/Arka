var fs = require('fs');
var code = fs.readFileSync('public/app.js', 'utf8');

// Find the problematic pattern: el.innerHTML = html;\n    \n    }\n  }
// The extra } between el.innerHTML and the function closing needs to go

var patterns = [
  "el.innerHTML = html;\n    \n    }\n  }\n\n  function updateNearestDeliveryHint",
  "el.innerHTML = html;\r\n    \r\n    }\r\n  }\r\n\r\n  function updateNearestDeliveryHint",
  "el.innerHTML = html;\n\n    }\n  }\n\n  function updateNearestDeliveryHint",
  "el.innerHTML = html;\r\n\r\n    }\r\n  }\r\n\r\n  function updateNearestDeliveryHint",
];

var fixed = false;
for (var i = 0; i < patterns.length; i++) {
  if (code.indexOf(patterns[i]) !== -1) {
    var nl = patterns[i].indexOf('\r\n') !== -1 ? '\r\n' : '\n';
    var replacement = "el.innerHTML = html;" + nl + "  }" + nl + nl + "  function updateNearestDeliveryHint";
    code = code.replace(patterns[i], replacement);
    fixed = true;
    console.log('Fixed extra brace (pattern ' + (i + 1) + ')');
    break;
  }
}

if (!fixed) {
  // Try a more generic approach
  var elIdx = code.indexOf("el.innerHTML = html;");
  // Find the specific one near renderIntervals
  var riIdx = code.indexOf("function renderIntervals()");
  if (riIdx !== -1) {
    var searchFrom = riIdx;
    var nextFunc = code.indexOf("function updateNearestDeliveryHint", searchFrom);
    if (nextFunc !== -1) {
      // Find el.innerHTML between renderIntervals and updateNearestDeliveryHint
      var elInRender = code.lastIndexOf("el.innerHTML = html;", nextFunc);
      if (elInRender > riIdx) {
        // Get the content between el.innerHTML and updateNearestDeliveryHint
        var between = code.substring(elInRender + "el.innerHTML = html;".length, nextFunc);
        // Count closing braces - should be just 1 (for the function)
        var braces = between.match(/\}/g);
        if (braces && braces.length > 1) {
          console.log('Found ' + braces.length + ' closing braces between el.innerHTML and next function');
          // Replace with just one brace
          var nl = between.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
          var newBetween = nl + "  }" + nl + nl + "  ";
          code = code.substring(0, elInRender + "el.innerHTML = html;".length) + newBetween + code.substring(nextFunc);
          fixed = true;
          console.log('Fixed: replaced with single closing brace');
        } else {
          console.log('Only ' + (braces ? braces.length : 0) + ' brace(s) found - might be OK');
        }
      }
    }
  }
}

if (!fixed) {
  console.log('No extra brace found - file may already be correct');
}

// Verify with syntax check
try {
  new Function(code);
  console.log('\n=== app.js: NO SYNTAX ERRORS ===');
  fs.writeFileSync('public/app.js', code, 'utf8');
  console.log('File saved successfully');
} catch (e) {
  console.error('\n=== SYNTAX ERROR REMAINS ===');
  console.error(e.message);
  
  // Try to locate error
  var lines = code.split(/\r?\n/);
  // Parse line number from error message patterns
  var lineMatch = e.message.match(/line (\d+)/i);
  if (!lineMatch) {
    // Estimate position from character offset
    var posMatch = e.message.match(/position (\d+)/);
    if (posMatch) {
      var pos = parseInt(posMatch[1]);
      var count = 0;
      for (var j = 0; j < lines.length; j++) {
        count += lines[j].length + 1;
        if (count >= pos) {
          lineMatch = [null, j + 1];
          break;
        }
      }
    }
  }
  
  if (lineMatch) {
    var ln = parseInt(lineMatch[1]);
    console.error('Near line ' + ln + ':');
    for (var k = Math.max(0, ln - 5); k <= Math.min(lines.length - 1, ln + 3); k++) {
      console.log((k + 1) + (k === ln - 1 ? ' >>> ' : '     ') + lines[k]);
    }
  }
  
  // Still save - user can review
  fs.writeFileSync('public/app.js', code, 'utf8');
  console.log('File saved (with potential error - review output above)');
}

// Also check admin.js
var admin = fs.readFileSync('public/admin.js', 'utf8');
try {
  new Function(admin);
  console.log('\n=== admin.js: NO SYNTAX ERRORS ===');
} catch (e) {
  console.error('\n=== admin.js SYNTAX ERROR ===');
  console.error(e.message);
}
