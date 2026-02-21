require('dotenv').config();

var Database = require('better-sqlite3');
var path = require('path');

var DB_PATH = path.join(__dirname, 'arka.db');
var localDb = null;

function getDb() {
  if (!localDb) {
    localDb = new Database(DB_PATH);
    localDb.pragma('journal_mode = WAL');
    localDb.pragma('foreign_keys = OFF');
  }
  return localDb;
}

function dbAll(sql, args) {
  var stmt = getDb().prepare(sql);
  return Promise.resolve(args && args.length ? stmt.all.apply(stmt, args) : stmt.all());
}

function dbGet(sql, args) {
  var stmt = getDb().prepare(sql);
  return Promise.resolve(args && args.length ? stmt.get.apply(stmt, args) : stmt.get());
}

function dbRun(sql, args) {
  var stmt = getDb().prepare(sql);
  var r = args && args.length ? stmt.run.apply(stmt, args) : stmt.run();
  return Promise.resolve({ lastInsertRowid: Number(r.lastInsertRowid), changes: r.changes });
}

function dbExec(sql) {
  getDb().exec(sql);
  return Promise.resolve();
}

var SCHEMA = "\
  CREATE TABLE IF NOT EXISTS users (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    telegram_id TEXT UNIQUE NOT NULL,\
    first_name TEXT,\
    phone TEXT,\
    default_address TEXT,\
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP\
  );\
\
  CREATE TABLE IF NOT EXISTS categories (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    name TEXT NOT NULL\
  );\
\
  CREATE TABLE IF NOT EXISTS products (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    category_id INTEGER NOT NULL,\
    name TEXT NOT NULL,\
    description TEXT,\
    price INTEGER NOT NULL,\
    image_url TEXT,\
    is_bouquet INTEGER DEFAULT 0,\
    flower_min INTEGER DEFAULT 0,\
    flower_max INTEGER DEFAULT 0,\
    flower_step INTEGER DEFAULT 1,\
    price_per_flower INTEGER DEFAULT 0,\
    FOREIGN KEY (category_id) REFERENCES categories(id)\
  );\
\
  CREATE TABLE IF NOT EXISTS cities (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    name TEXT NOT NULL,\
    is_active INTEGER DEFAULT 1\
  );\
\
  CREATE TABLE IF NOT EXISTS orders (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    user_id INTEGER,\
    city_id INTEGER,\
    user_name TEXT NOT NULL,\
    user_phone TEXT NOT NULL,\
    user_email TEXT,\
    user_telegram TEXT,\
    receiver_name TEXT,\
    receiver_phone TEXT,\
    delivery_address TEXT,\
    delivery_type TEXT DEFAULT 'delivery',\
    delivery_zone TEXT,\
    delivery_cost INTEGER DEFAULT 0,\
    delivery_interval TEXT,\
    delivery_date TEXT,\
    exact_time TEXT,\
    comment TEXT,\
    total_amount INTEGER NOT NULL,\
    status TEXT NOT NULL DEFAULT 'Новый',\
    is_paid INTEGER DEFAULT 0,\
    paid_at DATETIME,\
    payment_id TEXT,\
    status_updated_at DATETIME,\
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\
    FOREIGN KEY (user_id) REFERENCES users(id),\
    FOREIGN KEY (city_id) REFERENCES cities(id)\
  );\
\
  CREATE TABLE IF NOT EXISTS order_items (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    order_id INTEGER NOT NULL,\
    product_id INTEGER NOT NULL,\
    quantity INTEGER NOT NULL,\
    price INTEGER NOT NULL,\
    flower_count INTEGER DEFAULT 0,\
    FOREIGN KEY (order_id) REFERENCES orders(id),\
    FOREIGN KEY (product_id) REFERENCES products(id)\
  );\
\
  CREATE TABLE IF NOT EXISTS settings (\
    key TEXT PRIMARY KEY,\
    value TEXT\
  );\
\
  CREATE TABLE IF NOT EXISTS product_images (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    product_id INTEGER NOT NULL,\
    image_url TEXT NOT NULL,\
    image_data TEXT,\
    sort_order INTEGER DEFAULT 0,\
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE\
  );\
\
  CREATE TABLE IF NOT EXISTS user_addresses (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    user_id INTEGER NOT NULL,\
    label TEXT,\
    city TEXT,\
    district TEXT,\
    street TEXT,\
    apartment TEXT,\
    note TEXT,\
    full_address TEXT,\
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE\
  );\
\
  CREATE TABLE IF NOT EXISTS admin_users (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    telegram_username TEXT NOT NULL UNIQUE,\
    telegram_id TEXT,\
    added_by TEXT,\
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP\
  );\
\
  CREATE TABLE IF NOT EXISTS product_sizes (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    product_id INTEGER NOT NULL,\
    label TEXT NOT NULL,\
    flower_count INTEGER NOT NULL DEFAULT 0,\
    price INTEGER NOT NULL DEFAULT 0,\
    sort_order INTEGER DEFAULT 0,\
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE\
  );\
";

function addColumnIfMissing(table, column, definition) {
  try {
    var cols = getDb().pragma('table_info(' + table + ')');
    var exists = cols.some(function (c) { return c.name === column; });
    if (!exists) {
      getDb().exec('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition);
      console.log('Migration: added ' + table + '.' + column);
    }
  } catch (e) {
    console.error('Migration error (' + table + '.' + column + '):', e.message);
  }
}

async function init() {
  getDb().exec(SCHEMA);
  addColumnIfMissing('product_images', 'image_data', 'TEXT');
  addColumnIfMissing('orders', 'status_updated_at', 'DATETIME');
  addColumnIfMissing('order_items', 'size_label', 'TEXT');
  addColumnIfMissing('products', 'in_stock', 'INTEGER DEFAULT 1');
  addColumnIfMissing('products', 'hidden', 'INTEGER DEFAULT 0');
  addColumnIfMissing('products', 'dimensions', "TEXT DEFAULT ''");
  addColumnIfMissing('products', 'is_recommended', 'INTEGER DEFAULT 0');
  addColumnIfMissing('product_sizes', 'dimensions', "TEXT DEFAULT ''");
  addColumnIfMissing('orders', 'delivery_distance', 'REAL DEFAULT 0');
  addColumnIfMissing('admin_users', 'can_delete_orders', 'INTEGER DEFAULT 0');

  var cityCount = getDb().prepare('SELECT COUNT(*) as cnt FROM cities').get();
  if (!cityCount || cityCount.cnt === 0) {
    getDb().exec("INSERT INTO cities (name, is_active) VALUES ('Саратов', 1)");
    getDb().exec("INSERT INTO cities (name, is_active) VALUES ('Энгельс', 1)");
    console.log('Migration: added default cities (Саратов, Энгельс)');
  }

  console.log('Database initialized.');
}

var db = {
  prepare: function (sql) {
    return {
      all: function () { return dbAll(sql, Array.prototype.slice.call(arguments)); },
      get: function () { return dbGet(sql, Array.prototype.slice.call(arguments)); },
      run: function () { return dbRun(sql, Array.prototype.slice.call(arguments)); }
    };
  }
};

module.exports = db;
module.exports.init = init;
module.exports.dbAll = dbAll;
module.exports.dbGet = dbGet;
module.exports.dbRun = dbRun;
module.exports.dbExec = dbExec;
