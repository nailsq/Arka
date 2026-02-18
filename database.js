const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'arka.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    first_name TEXT,
    phone TEXT,
    default_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    image_url TEXT,
    is_bouquet INTEGER DEFAULT 0,
    flower_min INTEGER DEFAULT 0,
    flower_max INTEGER DEFAULT 0,
    flower_step INTEGER DEFAULT 1,
    price_per_flower INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS cities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    city_id INTEGER,
    user_name TEXT NOT NULL,
    user_phone TEXT NOT NULL,
    user_email TEXT,
    user_telegram TEXT,
    receiver_name TEXT,
    receiver_phone TEXT,
    delivery_address TEXT,
    delivery_type TEXT DEFAULT 'delivery',
    delivery_zone TEXT,
    delivery_cost INTEGER DEFAULT 0,
    delivery_interval TEXT,
    delivery_date TEXT,
    exact_time TEXT,
    comment TEXT,
    total_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Новый',
    is_paid INTEGER DEFAULT 0,
    paid_at DATETIME,
    payment_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (city_id) REFERENCES cities(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price INTEGER NOT NULL,
    flower_count INTEGER DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT,
    city TEXT,
    district TEXT,
    street TEXT,
    apartment TEXT,
    note TEXT,
    full_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_username TEXT NOT NULL UNIQUE,
    telegram_id TEXT,
    added_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Auto-migration: add missing columns to existing tables
function addColumnIfMissing(table, column, definition) {
  try {
    var cols = db.pragma('table_info(' + table + ')');
    var exists = cols.some(function (c) { return c.name === column; });
    if (!exists) {
      db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition);
      console.log('Migration: added ' + table + '.' + column);
    }
  } catch (e) {
    console.error('Migration error (' + table + '.' + column + '):', e.message);
  }
}

// orders table migrations
addColumnIfMissing('orders', 'user_email', 'TEXT');
addColumnIfMissing('orders', 'user_telegram', 'TEXT');
addColumnIfMissing('orders', 'receiver_name', 'TEXT');
addColumnIfMissing('orders', 'receiver_phone', 'TEXT');
addColumnIfMissing('orders', 'delivery_date', 'TEXT');
addColumnIfMissing('orders', 'exact_time', 'TEXT');
addColumnIfMissing('orders', 'delivery_type', "TEXT DEFAULT 'delivery'");
addColumnIfMissing('orders', 'delivery_zone', 'TEXT');
addColumnIfMissing('orders', 'delivery_cost', 'INTEGER DEFAULT 0');
addColumnIfMissing('orders', 'delivery_interval', 'TEXT');
addColumnIfMissing('orders', 'comment', 'TEXT');
addColumnIfMissing('orders', 'city_id', 'INTEGER');
addColumnIfMissing('orders', 'payment_id', 'TEXT');
addColumnIfMissing('orders', 'is_paid', 'INTEGER DEFAULT 0');
addColumnIfMissing('orders', 'paid_at', 'DATETIME');
addColumnIfMissing('orders', 'status_updated_at', 'DATETIME');

// order_items table migrations
addColumnIfMissing('order_items', 'flower_count', 'INTEGER DEFAULT 0');

// products table migrations
addColumnIfMissing('products', 'is_bouquet', 'INTEGER DEFAULT 0');
addColumnIfMissing('products', 'flower_min', 'INTEGER DEFAULT 0');
addColumnIfMissing('products', 'flower_max', 'INTEGER DEFAULT 0');
addColumnIfMissing('products', 'flower_step', 'INTEGER DEFAULT 1');
addColumnIfMissing('products', 'price_per_flower', 'INTEGER DEFAULT 0');

module.exports = db;
