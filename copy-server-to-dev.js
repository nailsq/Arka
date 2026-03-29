/**
 * One-shot: copies server.js to C:\dev\arcaflowers\server.js
 * Run from repo root: node copy-server-to-dev.js
 */
var fs = require('fs');
var path = require('path');
var src = path.join(__dirname, 'server.js');
var dest = 'C:\\dev\\arcaflowers\\server.js';
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied', src, '->', dest, '(' + fs.statSync(dest).size + ' bytes)');
