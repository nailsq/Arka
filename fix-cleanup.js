var fs = require('fs');
var f = 'public/app.js';
var code = fs.readFileSync(f, 'utf8');
var original = code;
var fixes = 0;

// CLEANUP 1: Remove duplicate getNightDeliveryTiers function
// Keep only the first one
var first = code.indexOf('function getNightDeliveryTiers(engels) {');
if (first !== -1) {
  var second = code.indexOf('function getNightDeliveryTiers(engels) {', first + 10);
  if (second !== -1) {
    // Find the end of the second function (closing })
    var funcEnd = code.indexOf('\n  }', second);
    if (funcEnd !== -1) {
      var nl = code.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
      var blockEnd = funcEnd + ('\n  }').length;
      // Also remove trailing empty lines
      while (code.charAt(blockEnd) === '\n' || code.charAt(blockEnd) === '\r') blockEnd++;
      code = code.substring(0, second) + code.substring(blockEnd);
      fixes++;
      console.log('CLEANUP 1 OK: Removed duplicate getNightDeliveryTiers');
    }
  } else {
    console.log('CLEANUP 1 SKIP: No duplicate getNightDeliveryTiers');
  }
}

// CLEANUP 2: Remove duplicate getNightDeliveryCost function
first = code.indexOf('function getNightDeliveryCost(km, engels) {');
if (first !== -1) {
  var second2 = code.indexOf('function getNightDeliveryCost(km, engels) {', first + 10);
  if (second2 !== -1) {
    var funcEnd2 = code.indexOf('\n  }', second2);
    if (funcEnd2 !== -1) {
      var blockEnd2 = funcEnd2 + ('\n  }').length;
      while (code.charAt(blockEnd2) === '\n' || code.charAt(blockEnd2) === '\r') blockEnd2++;
      code = code.substring(0, second2) + code.substring(blockEnd2);
      fixes++;
      console.log('CLEANUP 2 OK: Removed duplicate getNightDeliveryCost');
    }
  } else {
    console.log('CLEANUP 2 SKIP: No duplicate getNightDeliveryCost');
  }
}

// CLEANUP 3: Remove duplicate isNightInterval check in getDeliveryCost
var gcStart = code.indexOf('function getDeliveryCost()');
if (gcStart !== -1) {
  var gcEnd = code.indexOf('\n  }', gcStart);
  if (gcEnd !== -1) {
    var gcBlock = code.substring(gcStart, gcEnd);
    var nightCheck = 'if (checkoutState.isNightInterval) {';
    var firstCheck = gcBlock.indexOf(nightCheck);
    if (firstCheck !== -1) {
      var secondCheck = gcBlock.indexOf(nightCheck, firstCheck + 10);
      if (secondCheck !== -1) {
        // Find the full second if-block (if + return + })
        var nl = code.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
        var blockStr = gcBlock.substring(secondCheck);
        var closingBrace = blockStr.indexOf('}');
        if (closingBrace !== -1) {
          var removeStart = secondCheck;
          var removeEnd = secondCheck + closingBrace + 1;
          // Also remove trailing newline
          while (gcBlock.charAt(removeEnd) === '\n' || gcBlock.charAt(removeEnd) === '\r') removeEnd++;
          var newGcBlock = gcBlock.substring(0, removeStart) + gcBlock.substring(removeEnd);
          code = code.substring(0, gcStart) + newGcBlock + code.substring(gcEnd);
          fixes++;
          console.log('CLEANUP 3 OK: Removed duplicate isNightInterval check');
        }
      } else {
        console.log('CLEANUP 3 SKIP: No duplicate isNightInterval in getDeliveryCost');
      }
    }
  }
}

// CLEANUP 4: Fix indentation in setDeliveryInterval (updateCheckoutSummary)
var badIndent = '        updateCheckoutSummary();';
var goodIndent = '    updateCheckoutSummary();';
if (code.indexOf(badIndent) !== -1) {
  var siStart = code.indexOf('window.setDeliveryInterval');
  if (siStart !== -1) {
    var siEnd = code.indexOf('updateStepButtons', siStart);
    if (siEnd !== -1) {
      var siBlock = code.substring(siStart, siEnd + 30);
      if (siBlock.indexOf(badIndent) !== -1) {
        code = code.replace(badIndent, goodIndent);
        fixes++;
        console.log('CLEANUP 4 OK: Fixed indentation');
      }
    }
  }
}

// Save
if (fixes > 0) {
  fs.writeFileSync(f, code, 'utf8');
  console.log('\nTotal cleanups: ' + fixes);
} else {
  console.log('\nNo cleanups needed - file is clean');
}

// Verify
var verify = fs.readFileSync(f, 'utf8');
var counts = {
  'getNightDeliveryTiers def': (verify.match(/function getNightDeliveryTiers/g) || []).length,
  'getNightDeliveryCost def': (verify.match(/function getNightDeliveryCost/g) || []).length,
  'isNightInterval in getDeliveryCost': (function() {
    var gc = verify.substring(verify.indexOf('function getDeliveryCost()'));
    gc = gc.substring(0, gc.indexOf('\n  }\n') || gc.indexOf('\n  }\r'));
    return (gc.match(/checkoutState\.isNightInterval/g) || []).length;
  })()
};
console.log('\nVerification (should all be 1):');
Object.keys(counts).forEach(function(k) {
  var ok = counts[k] === 1 ? 'OK' : 'PROBLEM';
  console.log('  ' + ok + ': ' + k + ' = ' + counts[k]);
});
