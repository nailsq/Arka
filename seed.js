var db = require('./database');

async function seed() {
  await db.init();

  var existingCategories = await db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (existingCategories.count > 0) {
    console.log('Database already seeded. Skipping.');
    process.exit(0);
  }

  var categories = [
    'До 3000',
    '3000 - 5000',
    '5000 - 7000',
    '7000 - 10000',
    'От 10000',
    '8 марта',
    'Вазы, свечки, подарки, шары, открытки'
  ];

  var categoryIds = {};
  for (var c = 0; c < categories.length; c++) {
    var info = await db.prepare('INSERT INTO categories (name) VALUES (?)').run(categories[c]);
    categoryIds[categories[c]] = Number(info.lastInsertRowid);
  }

  var products = [
    {
      category: 'До 3000',
      items: [
        { name: 'Букет "Нежность"', description: 'Компактный букет из кустовых роз и эвкалипта.', price: 1800, image: '/images/bouquet_nezhnost.jpg', bouquet: 1, fmin: 5, fmax: 15, fstep: 1, ppf: 150 },
        { name: 'Букет "Утро"', description: 'Легкий букет из хризантем и зелени.', price: 1500, image: '/images/bouquet_utro.jpg', bouquet: 1, fmin: 3, fmax: 11, fstep: 1, ppf: 120 },
        { name: 'Букет "Простота"', description: 'Монобукет из белых роз.', price: 2000, image: '/images/bouquet_prostota.jpg', bouquet: 1, fmin: 5, fmax: 19, fstep: 2, ppf: 180 }
      ]
    },
    {
      category: '3000 - 5000',
      items: [
        { name: 'Букет "Классика"', description: 'Букет из красных роз с оформлением.', price: 2500, image: '/images/bouquet_klassika.jpg', bouquet: 1, fmin: 7, fmax: 25, fstep: 2, ppf: 170 },
        { name: 'Букет "Весна"', description: 'Яркий сезонный букет из тюльпанов и нарциссов.', price: 3000, image: '/images/bouquet_vesna.jpg', bouquet: 1, fmin: 9, fmax: 21, fstep: 2, ppf: 160 },
        { name: 'Букет "Элегант"', description: 'Стильный букет из пионовидных роз.', price: 3500, image: '/images/bouquet_elegant.jpg', bouquet: 1, fmin: 5, fmax: 15, fstep: 2, ppf: 250 }
      ]
    },
    {
      category: '5000 - 7000',
      items: [
        { name: 'Букет "Роскошь"', description: 'Большой букет из роз, лизиантуса и декоративной зелени.', price: 4500, image: '/images/bouquet_roskosh.jpg', bouquet: 1, fmin: 11, fmax: 31, fstep: 2, ppf: 180 },
        { name: 'Букет "Аристократ"', description: 'Букет из гортензии, роз и эвкалипта.', price: 5000, image: '/images/bouquet_aristokrat.jpg', bouquet: 1, fmin: 9, fmax: 25, fstep: 2, ppf: 200 },
        { name: 'Букет "Облако"', description: 'Воздушный букет из белых пионов и гипсофилы.', price: 5500, image: '/images/bouquet_oblako.jpg', bouquet: 1, fmin: 7, fmax: 21, fstep: 2, ppf: 220 }
      ]
    },
    {
      category: '7000 - 10000',
      items: [
        { name: 'Букет "Премиум"', description: 'Премиальный букет из роз с дизайнерским оформлением.', price: 6000, image: '/images/bouquet_premium.jpg', bouquet: 1, fmin: 15, fmax: 51, fstep: 2, ppf: 190 },
        { name: 'Букет "Великолепие"', description: 'Авторский букет из орхидей и роз.', price: 7000, image: '/images/bouquet_velikolepie.jpg', bouquet: 1, fmin: 11, fmax: 31, fstep: 2, ppf: 250 },
        { name: 'Корзина "Праздник"', description: 'Цветочная корзина из сезонных цветов.', price: 8500, image: '/images/korzina_prazdnik.jpg', bouquet: 1, fmin: 15, fmax: 35, fstep: 5, ppf: 200 }
      ]
    },
    {
      category: 'От 10000',
      items: [
        { name: 'Букет "Империя"', description: 'Роскошный букет из 51 розы.', price: 8000, image: '/images/bouquet_imperia.jpg', bouquet: 1, fmin: 25, fmax: 101, fstep: 2, ppf: 170 },
        { name: 'Букет "Королевский"', description: 'Дизайнерский букет из редких сортов роз и экзотических цветов.', price: 10000, image: '/images/bouquet_korolevskiy.jpg', bouquet: 1, fmin: 15, fmax: 51, fstep: 2, ppf: 280 },
        { name: 'Корзина "Гранд"', description: 'Большая цветочная корзина для особых случаев.', price: 12000, image: '/images/korzina_grand.jpg', bouquet: 1, fmin: 25, fmax: 75, fstep: 5, ppf: 220 }
      ]
    },
    {
      category: 'Вазы, свечки, подарки, шары, открытки',
      items: [
        { name: 'Открытка', description: 'Поздравительная открытка к букету.', price: 100, image: '/images/otkrytka.jpg', bouquet: 0, fmin: 0, fmax: 0, fstep: 1, ppf: 0 },
        { name: 'Свеча ароматическая', description: 'Ароматическая свеча ручной работы.', price: 1200, image: '/images/svecha.jpg', bouquet: 0, fmin: 0, fmax: 0, fstep: 1, ppf: 0 },
        { name: 'Ваза стеклянная', description: 'Прозрачная стеклянная ваза для букета.', price: 1500, image: '/images/vaza.jpg', bouquet: 0, fmin: 0, fmax: 0, fstep: 1, ppf: 0 }
      ]
    }
  ];

  for (var g = 0; g < products.length; g++) {
    var group = products[g];
    var catId = categoryIds[group.category];
    for (var p = 0; p < group.items.length; p++) {
      var item = group.items[p];
      var pInfo = await db.prepare(
        'INSERT INTO products (category_id, name, description, price, image_url, is_bouquet, flower_min, flower_max, flower_step, price_per_flower) VALUES (?,?,?,?,?,?,?,?,?,?)'
      ).run(catId, item.name, item.description, item.price, item.image, item.bouquet || 0, item.fmin || 0, item.fmax || 0, item.fstep || 1, item.ppf || 0);
      var productId = Number(pInfo.lastInsertRowid);
      if (item.image) {
        await db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?,?,?)').run(productId, item.image, 0);
      }
    }
  }

  await db.prepare('INSERT INTO cities (name, is_active) VALUES (?, 1)').run('Саратов');
  await db.prepare('INSERT INTO cities (name, is_active) VALUES (?, 1)').run('Энгельс');

  var deliverySettings = {
    delivery_saratov_base: '350',
    delivery_engels_base: '450',
    delivery_remote: '1000',
    delivery_zone_saratov: '350',
    delivery_zone_engels: '450',
    delivery_zone_remote: '1000',
    delivery_regular: '500',
    delivery_holiday: '1000',
    pickup_address: 'г. Саратов, 3-й Дегтярный проезд, 21к3',
    exact_time_surcharge: '1000',
    cutoff_hour: '19',
    holiday_dates: JSON.stringify(['02-14', '03-08', '11-26']),
    intervals_regular: JSON.stringify(['10:00-13:00', '13:00-16:00', '16:00-19:00', '19:00-22:00']),
    intervals_holiday: JSON.stringify(['10:00-13:00', '13:00-16:00', '16:00-19:00', '19:00-22:00']),
    saratov_zones: JSON.stringify([
      { name: 'г. Саратов (Ленинский, Кировский, Фрунзенский, Заводской, Волжский, Октябрьский р-ны)', key: 'saratov_base' },
      { name: 'Окрестности г. Саратова (в т.ч. Гагаринский р-н)', key: 'remote' }
    ]),
    engels_zones: JSON.stringify([
      { name: 'г. Энгельс', key: 'engels_base' },
      { name: 'Окрестности г. Энгельса', key: 'remote' }
    ]),
    delivery_info: 'Доставка в будние дни — 500 руб. В праздничные дни (8 марта, 14 февраля, День матери и т.п.) — 1000 руб. Интервал доставки 3 часа. При указании точного времени заказ будет доставлен в интервале +-1,5 часа. Стоимость доставки точно ко времени — 1000 руб. (указать в комментарии к заказу).',
    social_telegram: 'https://t.me/arka_studio',
    social_instagram: 'https://instagram.com/arka_studio',
    social_vk: 'https://vk.com/arka_studio'
  };

  var settingKeys = Object.keys(deliverySettings);
  for (var s = 0; s < settingKeys.length; s++) {
    await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(settingKeys[s], deliverySettings[settingKeys[s]]);
  }

  console.log('Database seeded successfully.');
  process.exit(0);
}

seed().catch(function (err) {
  console.error('Seed failed:', err);
  process.exit(1);
});
