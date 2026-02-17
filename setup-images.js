const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log('Created:', dir);
} else {
  console.log('Already exists:', dir);
}
const files = fs.readdirSync(dir);
console.log('Files in images:', files.length ? files.join(', ') : '(empty)');
