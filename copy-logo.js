const fs = require('fs');
const path = require('path');
const glob = require('path');

// Find the source file
const assetsDir = path.join(process.env.USERPROFILE, '.cursor', 'projects');
function findFile(dir, pattern) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const found = findFile(full, pattern);
        if (found) return found;
      } else if (e.name.includes('IMG_9984')) {
        return full;
      }
    }
  } catch (err) {}
  return null;
}

const src = findFile(assetsDir, 'IMG_9984');
if (!src) {
  console.log('Source file not found');
  process.exit(1);
}

const dst = path.join(__dirname, 'public', 'images', 'logo.png');
fs.copyFileSync(src, dst);
console.log('Done! Copied to', dst);
