var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var https = require('https');

var DB_PATH = path.join(__dirname, 'arka.db');
var GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
var GITHUB_GIST_ID = process.env.GITHUB_GIST_ID || '';
var BACKUP_FILE = 'arka_backup.gz.b64';
var BACKUP_INTERVAL = 5 * 60 * 1000;

function isEnabled() {
  return !!(GITHUB_TOKEN && GITHUB_GIST_ID);
}

function githubApi(method, apiPath, body) {
  return new Promise(function (resolve, reject) {
    var bodyStr = body ? JSON.stringify(body) : '';
    var options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'arka-flowers-backup',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (bodyStr) {
      options.headers['Content-Type'] = 'application/json';
    }

    var req = https.request(options, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(raw)); } catch (e) { resolve(raw); }
        } else {
          reject(new Error('GitHub API ' + method + ' ' + apiPath + ' → ' + res.statusCode));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, function () { req.destroy(new Error('Request timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function downloadRaw(rawUrl) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(rawUrl);
    var options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': 'arka-flowers-backup' }
    };
    var doRequest = function (opts) {
      https.get(opts, function (res) {
        if (res.statusCode === 301 || res.statusCode === 302) {
          var loc = new URL(res.headers.location);
          return doRequest({ hostname: loc.hostname, path: loc.pathname + loc.search, method: 'GET', headers: { 'User-Agent': 'arka-flowers-backup' } });
        }
        var chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(Buffer.concat(chunks).toString('utf8'));
          } else {
            reject(new Error('Download failed: ' + res.statusCode));
          }
        });
      }).on('error', reject);
    };
    doRequest(options);
  });
}

async function restore() {
  if (!isEnabled()) {
    console.log('Backup not configured (no GITHUB_TOKEN / GITHUB_GIST_ID).');
    return false;
  }
  try {
    console.log('Restoring database from GitHub backup...');
    var gist = await githubApi('GET', '/gists/' + GITHUB_GIST_ID);
    var file = gist.files && gist.files[BACKUP_FILE];
    if (!file || !file.content) {
      console.log('No backup found in gist — starting fresh.');
      return false;
    }

    var content;
    if (file.truncated && file.raw_url) {
      content = await downloadRaw(file.raw_url);
    } else {
      content = file.content;
    }

    var compressed = Buffer.from(content, 'base64');
    var data = zlib.gunzipSync(compressed);
    fs.writeFileSync(DB_PATH, data);
    console.log('Database restored (' + Math.round(data.length / 1024) + ' KB).');
    return true;
  } catch (err) {
    console.error('Restore failed:', err.message);
    return false;
  }
}

async function backup() {
  if (!isEnabled()) return;
  try {
    if (!fs.existsSync(DB_PATH)) return;

    var dbModule = require('./database');
    try {
      await dbModule.dbAll('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch (e) { /* ignore */ }

    var raw = fs.readFileSync(DB_PATH);
    var compressed = zlib.gzipSync(raw);
    var base64 = compressed.toString('base64');

    console.log('Backing up database (' + Math.round(raw.length / 1024) + ' KB → ' + Math.round(compressed.length / 1024) + ' KB compressed)...');

    var files = {};
    files[BACKUP_FILE] = { content: base64 };
    await githubApi('PATCH', '/gists/' + GITHUB_GIST_ID, { files: files });
    console.log('Backup complete.');
  } catch (err) {
    console.error('Backup failed:', err.message);
  }
}

var backupTimer = null;

function startPeriodicBackup() {
  if (!isEnabled()) return;
  console.log('Periodic backup enabled (every ' + (BACKUP_INTERVAL / 60000) + ' min).');

  backup();

  backupTimer = setInterval(backup, BACKUP_INTERVAL);

  var shuttingDown = false;
  function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(signal + ' received — final backup...');
    clearInterval(backupTimer);
    backup().finally(function () { process.exit(0); });
  }
  process.on('SIGTERM', function () { gracefulShutdown('SIGTERM'); });
  process.on('SIGINT', function () { gracefulShutdown('SIGINT'); });
}

module.exports = {
  restore: restore,
  backup: backup,
  startPeriodicBackup: startPeriodicBackup,
  isEnabled: isEnabled
};
