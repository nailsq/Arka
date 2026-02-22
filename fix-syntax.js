var fs = require('fs');
var code = fs.readFileSync('server.js', 'utf8');

// Fix the missing } between catch close and app.post close
// Current: "  } catch (notifErr) {\n    console.error(...);\n  });"
// Should be: "  } catch (notifErr) {\n    console.error(...);\n  }\n});"

var oldPart = "console.error('[TG Notify] Status notification error:', notifErr.message);\n  });";
var idx = code.indexOf(oldPart);

if (idx === -1) {
  // Try with \r\n
  oldPart = "console.error('[TG Notify] Status notification error:', notifErr.message);\r\n  });";
  idx = code.indexOf(oldPart);
}

if (idx === -1) {
  console.error('FAILED: Could not find syntax error location');
  process.exit(1);
}

var newPart = oldPart.replace('  });', '  }\n});');
code = code.replace(oldPart, newPart);

// Verify
if (code.indexOf('  }\n});') !== -1 || code.indexOf('  }\r\n});') !== -1) {
  fs.writeFileSync('server.js', code, 'utf8');
  console.log('=== SUCCESS ===');
  console.log('Syntax error fixed: added missing } before });');
} else {
  console.error('FAILED: Could not verify fix');
  process.exit(1);
}
