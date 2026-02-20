(function () {
  'use strict';

  var appEl = document.getElementById('app');
  var currentCategoryId = null;
  var tgUser = null;
  var dbUser = null;
  var appSettings = {};
  var selectedCity = null;
  var citiesList = [];

  function pluralFlower(n) {
    var abs = Math.abs(n) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return n + ' цветков';
    if (last === 1) return n + ' цветок';
    if (last >= 2 && last <= 4) return n + ' цветка';
    return n + ' цветков';
  }

  // ============================================================
  // Telegram Web App
  // ============================================================

  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      tgUser = tg.initDataUnsafe.user;
    }
  }

  // ============================================================
  // Toast
  // ============================================================

  function showToast(message) {
    var container = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2600);
  }

  // ============================================================
  // City selection
  // ============================================================

  function getStoredCity() {
    try {
      var c = JSON.parse(localStorage.getItem('arka_city'));
      if (c && c.id && c.name) return c;
    } catch (e) {}
    return null;
  }

  function storeCity(city) {
    localStorage.setItem('arka_city', JSON.stringify(city));
    selectedCity = city;
  }

  function showCityOverlay() {
    var overlay = document.getElementById('city-overlay');
    var list = document.getElementById('city-list');
    overlay.style.display = 'flex';
    list.innerHTML = '<div style="text-align:center;padding:20px;font-size:14px">Загрузка...</div>';

    fetchJSON('/api/cities').then(function (cities) {
      citiesList = cities || [];
      if (!citiesList.length) {
        citiesList = [
          { id: 1, name: 'Саратов' },
          { id: 2, name: 'Энгельс' }
        ];
      }
      renderCityList(list);
    }).catch(function () {
      citiesList = [
        { id: 1, name: 'Саратов' },
        { id: 2, name: 'Энгельс' }
      ];
      renderCityList(list);
    });
  }

  function renderCityList(listEl) {
    listEl.innerHTML = citiesList.map(function (c) {
      return '<button class="city-card" onclick="selectCity(' + c.id + ',\'' + escapeHtml(c.name) + '\')">' +
        escapeHtml(c.name) + '</button>';
    }).join('');
  }

  function hideCityOverlay() {
    document.getElementById('city-overlay').style.display = 'none';
  }

  window.selectCity = function (id, name) {
    storeCity({ id: id, name: name });
    hideCityOverlay();
    showHome();
  };

  window.changeCityClick = function () {
    showCityOverlay();
  };

  function checkCityOnStart() {
    var stored = getStoredCity();
    if (stored) {
      selectedCity = stored;
      return true;
    }
    return false;
  }

  // ============================================================
  // Favorites (localStorage)
  // ============================================================

  function getFavorites() {
    try { return JSON.parse(localStorage.getItem('arka_favs')) || []; }
    catch (e) { return []; }
  }

  function saveFavorites(favs) {
    localStorage.setItem('arka_favs', JSON.stringify(favs));
    updateFavBadge();
  }

  function isFavorited(productId) {
    return getFavorites().indexOf(productId) >= 0;
  }

  function toggleFavorite(productId) {
    var favs = getFavorites();
    var idx = favs.indexOf(productId);
    if (idx >= 0) {
      favs.splice(idx, 1);
      showToast('Убрано из избранного');
    } else {
      favs.push(productId);
      showToast('Добавлено в избранное');
    }
    saveFavorites(favs);
  }

  function updateFavBadge() {
    var badge = document.getElementById('fav-badge');
    if (!badge) return;
    var count = getFavorites().length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  window.toggleFav = function (productId, event) {
    if (event) event.stopPropagation();
    toggleFavorite(productId);
    var btn = event && event.currentTarget;
    if (btn) {
      btn.classList.toggle('favorited', isFavorited(productId));
    }
  };

  var heartSvg = '<svg viewBox="0 0 24 24"><path class="heart-outline" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

  // ============================================================
  // Cart (localStorage)
  // ============================================================

  function getCart() {
    try { return JSON.parse(localStorage.getItem('arka_cart')) || []; }
    catch (e) { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem('arka_cart', JSON.stringify(cart));
  }

  function addToCart(product, sizeObj) {
    var cart = getCart();
    var price = product.price;
    var sizeLabel = '';
    var flowerCount = 0;
    var dims = product.dimensions || '';
    var allSizes = (product.sizes && product.sizes.length) ? product.sizes : [];
    var isBouquet = !!(sizeObj || product.is_bouquet);

    if (sizeObj) {
      price = sizeObj.price;
      sizeLabel = sizeObj.label;
      flowerCount = sizeObj.flower_count;
      dims = sizeObj.dimensions || '';
    }

    var cartKey = product.id + '_' + sizeLabel;
    var existing = cart.find(function (i) { return (i.product_id + '_' + (i.size_label || '')) === cartKey; });
    if (existing) {
      existing.quantity += 1;
      if (allSizes.length) existing.available_sizes = allSizes;
    } else {
      cart.push({
        product_id: product.id,
        name: product.name,
        price: price,
        image_url: product.image_url,
        quantity: 1,
        flower_count: flowerCount,
        dimensions: dims,
        size_label: sizeLabel,
        is_bouquet: isBouquet ? 1 : 0,
        base_price: product.price,
        available_sizes: allSizes
      });
    }

    syncFreeService(cart);
    saveCart(cart);
    updateCartBadge();
    showToast('Добавлено в корзину');
  }

  function countBouquets(cart) {
    var n = 0;
    cart.forEach(function (i) { if (i.is_bouquet && !i.is_free_service) n += i.quantity; });
    return n;
  }

  function syncFreeService(cart) {
    var name = appSettings.free_service_name;
    if (!name) {
      for (var i = cart.length - 1; i >= 0; i--) {
        if (cart[i].is_free_service) cart.splice(i, 1);
      }
      return;
    }
    var bouquetCount = countBouquets(cart);
    var idx = -1;
    for (var j = 0; j < cart.length; j++) {
      if (cart[j].is_free_service) { idx = j; break; }
    }
    if (bouquetCount <= 0) {
      if (idx >= 0) cart.splice(idx, 1);
      return;
    }
    if (idx >= 0) {
      cart[idx].name = name;
      cart[idx].quantity = bouquetCount;
      cart[idx].image_url = appSettings.free_service_image || '';
    } else {
      cart.push({
        product_id: 0,
        name: name,
        price: 0,
        image_url: appSettings.free_service_image || '',
        quantity: bouquetCount,
        flower_count: 0,
        size_label: '',
        is_bouquet: 0,
        base_price: 0,
        available_sizes: [],
        is_free_service: true
      });
    }
  }

  function cartItemKey(item) {
    return item.product_id + '_' + (item.size_label || '');
  }

  function updateCartQty(productId, sizeLabel, delta) {
    var cart = getCart();
    var key = productId + '_' + (sizeLabel || '');
    var item = cart.find(function (i) { return cartItemKey(i) === key; });
    if (item) {
      item.quantity += delta;
      if (item.quantity <= 0) {
        cart = cart.filter(function (i) { return cartItemKey(i) !== key; });
      }
    }
    syncFreeService(cart);
    saveCart(cart);
  }

  function removeFromCart(productId, sizeLabel) {
    var key = productId + '_' + (sizeLabel || '');
    var cart = getCart().filter(function (i) { return cartItemKey(i) !== key; });
    syncFreeService(cart);
    saveCart(cart);
  }

  function getCartTotal() {
    return getCart().reduce(function (s, i) { return s + i.price * i.quantity; }, 0);
  }

  // ============================================================
  // API
  // ============================================================

  function fetchJSON(url) {
    return fetch(url).then(function (r) { return r.json(); });
  }

  function postJSON(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          try { return JSON.parse(t); } catch (e) { throw new Error('Server error: ' + r.status); }
        });
      }
      return r.json();
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatPrice(p) {
    return Number(p).toLocaleString('ru-RU') + ' р.';
  }

  function isBouquetCategory(catName) {
    if (!catName) return true;
    var lower = catName.toLowerCase();
    var skip = ['ваз', 'свеч', 'подарк', 'шар', 'открытк'];
    for (var i = 0; i < skip.length; i++) {
      if (lower.indexOf(skip[i]) >= 0) return false;
    }
    return true;
  }

  function productImage(url, alt, cls) {
    if (!url) return '<div class="' + (cls || 'no-image') + '">Фото</div>';
    return '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) +
      '" class="' + (cls || '') + '" onerror="this.outerHTML=\'<div class=\\\'no-image\\\'>Фото</div>\'">';
  }

  var SARATOV_TZ = 'Europe/Saratov';

  function saratovNow() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SARATOV_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(new Date());
    var p = {};
    parts.forEach(function (x) { p[x.type] = x.value; });
    return {
      year: parseInt(p.year),
      month: parseInt(p.month),
      day: parseInt(p.day),
      hours: parseInt(p.hour === '24' ? '0' : p.hour),
      minutes: parseInt(p.minute),
      seconds: parseInt(p.second),
      dateStr: p.year + '-' + p.month + '-' + p.day,
      timeStr: (p.hour === '24' ? '00' : p.hour) + ':' + p.minute
    };
  }

  function formatDate(d) {
    if (!d) return '';
    var dt = new Date(d);
    var formatted = new Intl.DateTimeFormat('ru-RU', {
      timeZone: SARATOV_TZ,
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(dt);
    return formatted;
  }

  var cartSvg = '<svg viewBox="0 0 24 24"><path class="cart-icon-path" d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7.16 14.26l.04-.12.94-1.7h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0020.04 4H5.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7.42c-.13 0-.22-.11-.22-.2l-.04-.14z"/></svg>';

  function buildProductCard(p) {
    var favClass = isFavorited(p.id) ? ' favorited' : '';
    var desc = p.description ? '<div class="product-card-desc">' + escapeHtml(p.description) + '</div>' : '';
    var images = p.images && p.images.length ? p.images : (p.image_url ? [{ image_url: p.image_url }] : []);
    var imgHtml = '';
    var dotsHtml = '';

    if (images.length > 1) {
      imgHtml = images.map(function (img, idx) {
        return '<img src="' + escapeHtml(img.image_url) + '" alt="' + escapeHtml(p.name) +
          '" class="product-card-img card-slide' + (idx === 0 ? ' card-slide-active' : '') +
          '" data-slide-idx="' + idx + '">';
      }).join('');
      dotsHtml = '<div class="card-dots">' + images.map(function (_, idx) {
        return '<span class="card-dot' + (idx === 0 ? ' active' : '') + '"></span>';
      }).join('') + '</div>';
    } else {
      imgHtml = productImage(images.length ? images[0].image_url : '', p.name, 'product-card-img');
    }

    var cardPrice = p.price;
    var hasMultipleSizes = p.sizes && p.sizes.length > 0;
    var firstDims = '';
    if (hasMultipleSizes) {
      cardPrice = p.sizes[0].price;
      firstDims = p.sizes[0].dimensions || '';
    } else {
      firstDims = p.dimensions || '';
    }
    var priceLabel = hasMultipleSizes ? 'от ' + formatPrice(cardPrice) : formatPrice(p.price);
    var outOfStock = p.in_stock === 0;
    var cardClass = 'product-card' + (outOfStock ? ' product-card--soon' : '');

    var dimsBadge = firstDims
      ? '<div class="card-dims-badge" id="card-dims-' + p.id + '">' + escapeHtml(firstDims) + '</div>'
      : '<div class="card-dims-badge" id="card-dims-' + p.id + '" style="display:none"></div>';

    var sizeBtnsHtml = '';
    if (hasMultipleSizes) {
      sizeBtnsHtml = '<div class="card-size-row" onclick="event.stopPropagation()">';
      p.sizes.forEach(function (s, idx) {
        sizeBtnsHtml += '<button class="card-size-btn' + (idx === 0 ? ' active' : '') + '" data-idx="' + idx + '" ' +
          'onclick="switchCardSize(event,' + p.id + ',this,' + s.price + ',\'' + escapeHtml(s.dimensions || '').replace(/'/g, "\\'") + '\')">' +
          escapeHtml(s.label) + '</button>';
      });
      sizeBtnsHtml += '</div>';
    }

    return '<div class="' + cardClass + '">' +
      '<div class="product-card-img-wrap" onclick="navigateTo(\'product\',' + p.id + ')"' +
        (images.length > 1 ? ' data-slide-count="' + images.length + '"' : '') + '>' +
        imgHtml +
        dotsHtml +
        (!outOfStock ? '<div class="stock-badge stock-badge--in">В наличии</div>' : '') +
        (outOfStock ? '<div class="stock-overlay">Скоро будет в наличии</div>' : '') +
        dimsBadge +
        '<button class="fav-btn' + favClass + '" onclick="toggleFav(' + p.id + ',event)">' + heartSvg + '</button>' +
        (!outOfStock ? '<button class="cart-icon-btn" onclick="addToCartById(' + p.id + ',event)">' + cartSvg + '</button>' : '') +
      '</div>' +
      '<div class="product-card-body" onclick="navigateTo(\'product\',' + p.id + ')">' +
        '<div class="product-card-name">' + escapeHtml(p.name) + '</div>' +
        sizeBtnsHtml +
        '<div class="product-card-price" id="card-price-' + p.id + '">' + priceLabel + '</div>' +
        desc +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // Card image cycling on hover / touch-hold
  // ============================================================

  var cardCycleTimers = {};
  var cardCycleCounter = 0;

  function startCardCycle(wrap) {
    var count = parseInt(wrap.getAttribute('data-slide-count'));
    if (!count || count <= 1) return;
    var id = wrap.getAttribute('data-cycle-id');
    if (!id) {
      id = 'cc' + (++cardCycleCounter);
      wrap.setAttribute('data-cycle-id', id);
    }
    if (cardCycleTimers[id]) return;
    var current = 0;
    cardCycleTimers[id] = window.setInterval(function () {
      current = (current + 1) % count;
      var slides = wrap.querySelectorAll('.card-slide');
      var dots = wrap.querySelectorAll('.card-dot');
      slides.forEach(function (s, i) {
        s.classList.toggle('card-slide-active', i === current);
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === current);
      });
    }, 1200);
  }

  function stopCardCycle(wrap) {
    var id = wrap.getAttribute('data-cycle-id');
    if (id && cardCycleTimers[id]) {
      clearInterval(cardCycleTimers[id]);
      delete cardCycleTimers[id];
    }
    var slides = wrap.querySelectorAll('.card-slide');
    var dots = wrap.querySelectorAll('.card-dot');
    slides.forEach(function (s, i) {
      s.classList.toggle('card-slide-active', i === 0);
    });
    dots.forEach(function (d, i) {
      d.classList.toggle('active', i === 0);
    });
  }

  document.addEventListener('mouseenter', function (e) {
    var wrap = e.target.closest('.product-card-img-wrap[data-slide-count]');
    if (wrap) startCardCycle(wrap);
  }, true);

  document.addEventListener('mouseleave', function (e) {
    var wrap = e.target.closest('.product-card-img-wrap[data-slide-count]');
    if (wrap) stopCardCycle(wrap);
  }, true);

  document.addEventListener('touchstart', function (e) {
    var wrap = e.target.closest('.product-card-img-wrap[data-slide-count]');
    if (wrap) startCardCycle(wrap);
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    var wrap = e.target.closest('.product-card-img-wrap[data-slide-count]');
    if (wrap) stopCardCycle(wrap);
  });

  document.addEventListener('touchcancel', function (e) {
    var wrap = e.target.closest('.product-card-img-wrap[data-slide-count]');
    if (wrap) stopCardCycle(wrap);
  });

  var activeTab = 'home';
  var trackingPollInterval = null;

  function getTelegramId() {
    if (dbUser && dbUser.telegram_id) return dbUser.telegram_id;
    if (tgUser && tgUser.id) return tgUser.id;
    try { return localStorage.getItem('arka_tg_id') || ''; } catch (e) { return ''; }
  }

  function stopTrackingPoll() {
    if (trackingPollInterval) {
      clearInterval(trackingPollInterval);
      trackingPollInterval = null;
    }
  }

  function render(html) {
    appEl.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function setActiveTab(tab) {
    activeTab = tab;
    var btns = document.querySelectorAll('#tab-bar .tab-btn');
    btns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
  }

  function updateCartBadge() {
    var badge = document.getElementById('cart-badge');
    if (!badge) return;
    var cart = getCart();
    var count = cart.reduce(function (s, i) { return s + i.quantity; }, 0);
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  function isHolidayToday() {
    var raw = appSettings.holiday_dates;
    if (!raw) return false;
    try {
      var dates = JSON.parse(raw);
      var todayStr = saratovNow().dateStr;
      return dates.indexOf(todayStr) >= 0;
    } catch (e) { return false; }
  }

  function getIntervals() {
    var isHoliday = isHolidayToday();
    var key = isHoliday ? 'intervals_holiday' : 'intervals_regular';
    try { return JSON.parse(appSettings[key] || '[]'); }
    catch (e) { return []; }
  }

  function getCutoffHour() {
    return parseInt(appSettings.cutoff_hour) || 19;
  }

  function getPickupCutoffHour() {
    return parseInt(appSettings.pickup_cutoff_hour) || 20;
  }

  function isExactTimeEnabled() {
    return appSettings.exact_time_enabled !== '0';
  }

  // ============================================================
  // Init: load settings + auth
  // ============================================================

  function init() {
    fetchJSON('/api/settings').then(function (s) {
      appSettings = s || {};
      updateSocialLinks();
    });

    fetchJSON('/api/cities').then(function (cities) {
      citiesList = cities || [];
    });

    if (tgUser) {
      postJSON('/api/auth/telegram', {
        telegram_id: tgUser.id,
        first_name: tgUser.first_name || '',
        init_data: tg ? tg.initData : ''
      }).then(function (r) {
        if (r && r.user) {
          dbUser = r.user;
          try { localStorage.setItem('arka_tg_id', String(tgUser.id)); } catch (e) {}
          try { localStorage.setItem('arka_user', JSON.stringify(r.user)); } catch (e) {}
        }
      }).catch(function () {});
    } else {
      try {
        var savedUser = localStorage.getItem('arka_user');
        if (savedUser) dbUser = JSON.parse(savedUser);
      } catch (e) {}
    }

    var hasCity = checkCityOnStart();
    showHome();
    updateCartBadge();
    updateFavBadge();

    if (!hasCity) {
      showCityOverlay();
    }
  }

  function updateSocialLinks() {
    var el = document.getElementById('social-links');
    if (!el) return;
    var links = [];
    if (appSettings.social_telegram) links.push('<a href="' + escapeHtml(appSettings.social_telegram) + '" target="_blank">Telegram</a>');
    if (appSettings.social_instagram) links.push('<a href="' + escapeHtml(appSettings.social_instagram) + '" target="_blank">Instagram</a>');
    if (appSettings.social_vk) links.push('<a href="' + escapeHtml(appSettings.social_vk) + '" target="_blank">ВКонтакте</a>');
    if (links.length) el.innerHTML = links.join('');
  }

  // ============================================================
  // Pages
  // ============================================================

  var homeActiveCategory = null;

  function showHome(filterCatId) {
    homeActiveCategory = filterCatId || null;
    var cityName = selectedCity ? selectedCity.name : '';
    var cityLine = cityName
      ? '<span class="city-current" onclick="changeCityClick()">' + escapeHtml(cityName) + '</span>'
      : '<span class="city-current" onclick="changeCityClick()">Выбрать город</span>';

    setActiveTab('home');
    render(
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div class="category-title">Каталог</div>' +
        cityLine +
      '</div>' +
      '<div class="category-select-wrap" id="category-select-wrap">Загрузка...</div>' +
      '<div id="active-cat-title" class="category-title" style="font-size:16px;margin-bottom:14px;display:none"></div>' +
      '<div class="product-list" id="home-product-list">Загрузка...</div>'
    );

    fetchJSON('/api/categories').then(function (cats) {
      var el = document.getElementById('category-select-wrap');
      if (!el) return;
      if (!cats || !cats.length) { el.innerHTML = ''; return; }
      var html = '<button class="cat-chip' + (!homeActiveCategory ? ' active' : '') + '" onclick="filterHome(null)">Все</button>';
      html += cats.map(function (c) {
        return '<button class="cat-chip' + (homeActiveCategory === c.id ? ' active' : '') + '" onclick="filterHome(' + c.id + ',\'' + escapeHtml(c.name).replace(/'/g, "\\'") + '\')">' + escapeHtml(c.name) + '</button>';
      }).join('');
      el.innerHTML = html;
      if (homeActiveCategory) {
        var selected = cats.find(function (c) { return c.id === homeActiveCategory; });
        if (selected) {
          var titleEl = document.getElementById('active-cat-title');
          if (titleEl) { titleEl.textContent = selected.name; titleEl.style.display = 'block'; }
        }
      }
    });

    var productsUrl = homeActiveCategory ? '/api/products?category_id=' + homeActiveCategory : '/api/products';
    fetchJSON(productsUrl).then(function (prods) {
      var el = document.getElementById('home-product-list');
      if (!el) return;
      if (!prods || !prods.length) { el.innerHTML = '<div class="empty-state">Товаров пока нет</div>'; return; }
      prods.sort(function (a, b) { return (b.in_stock !== 0 ? 1 : 0) - (a.in_stock !== 0 ? 1 : 0); });
      el.innerHTML = prods.map(buildProductCard).join('');
    });
  }

  window.filterHome = function (catId, catName) {
    homeActiveCategory = catId;

    var chips = document.querySelectorAll('#category-select-wrap .cat-chip');
    chips.forEach(function (chip) {
      var isAll = chip.textContent === 'Все';
      if (!catId && isAll) {
        chip.classList.add('active');
      } else if (catId && chip.getAttribute('onclick') && chip.getAttribute('onclick').indexOf('filterHome(' + catId) !== -1) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    var titleEl = document.getElementById('active-cat-title');
    if (titleEl) {
      if (catId && catName && catName !== 'Все') {
        titleEl.textContent = catName;
        titleEl.style.display = 'block';
      } else {
        titleEl.style.display = 'none';
      }
    }

    var productsUrl = catId ? '/api/products?category_id=' + catId : '/api/products';
    fetchJSON(productsUrl).then(function (prods) {
      var el = document.getElementById('home-product-list');
      if (!el) return;
      if (!prods || !prods.length) { el.innerHTML = '<div class="empty-state">В этой категории пока нет товаров</div>'; return; }
      prods.sort(function (a, b) { return (b.in_stock !== 0 ? 1 : 0) - (a.in_stock !== 0 ? 1 : 0); });
      el.innerHTML = prods.map(buildProductCard).join('');
    });
  };

  function showCatalog() {
    showHome();
  }

  function showProducts(catId) {
    showHome(catId);
  }

  function showProduct(id) {
    render(
      '<span class="back-link" onclick="navigateTo(\'home\')">К каталогу</span>' +
      '<div id="product-detail">Загрузка...</div>'
    );
    fetchJSON('/api/products/' + id).then(function (p) {
      if (!p || p.error) { document.getElementById('product-detail').innerHTML = '<div class="empty-state">Товар не найден</div>'; return; }
      var favClass = isFavorited(p.id) ? ' favorited' : '';
      var images = p.images && p.images.length ? p.images : (p.image_url ? [{ image_url: p.image_url }] : []);
      var galleryHtml = '';

      if (images.length > 1) {
        var slidesHtml = images.map(function (img) {
          return '<div class="gallery-slide">' +
            '<img src="' + escapeHtml(img.image_url) + '" alt="' + escapeHtml(p.name) + '" class="product-detail-img">' +
          '</div>';
        }).join('');
        var dotsHtml = images.map(function (_, idx) {
          return '<span class="gallery-dot' + (idx === 0 ? ' active' : '') + '" data-idx="' + idx + '"></span>';
        }).join('');
        galleryHtml =
          '<div class="product-gallery" id="product-gallery">' +
            '<div class="gallery-track" id="gallery-track">' + slidesHtml + '</div>' +
            '<button class="fav-btn fav-btn--detail' + favClass + '" onclick="toggleFav(' + p.id + ',event)">' + heartSvg + '</button>' +
            '<div class="gallery-dots" id="gallery-dots">' + dotsHtml + '</div>' +
            '<button class="gallery-arrow gallery-prev" onclick="galleryPrev()"></button>' +
            '<button class="gallery-arrow gallery-next" onclick="galleryNext()"></button>' +
          '</div>';
      } else {
        galleryHtml =
          '<div class="product-detail-img-wrap">' +
            (images.length ? '<img src="' + escapeHtml(images[0].image_url) + '" alt="' + escapeHtml(p.name) + '" class="product-detail-img">' : '<div class="no-image">Фото</div>') +
            '<button class="fav-btn fav-btn--detail' + favClass + '" onclick="toggleFav(' + p.id + ',event)">' + heartSvg + '</button>' +
          '</div>';
      }

      var sizeHtml = '';
      if (p.sizes && p.sizes.length) {
        var firstSize = p.sizes[0];
        var sizeBtns = p.sizes.map(function (s, idx) {
          return '<button type="button" class="size-btn' + (idx === 0 ? ' active' : '') + '" ' +
            'data-size-id="' + s.id + '" data-price="' + s.price + '" data-fc="' + s.flower_count + '" data-label="' + escapeHtml(s.label) + '" data-dims="' + escapeHtml(s.dimensions || '') + '" ' +
            'onclick="selectSize(this,' + p.id + ')">' +
            escapeHtml(s.label) +
          '</button>';
        }).join('');
        var firstInfo = pluralFlower(firstSize.flower_count);
        if (firstSize.dimensions) firstInfo += ' · ' + escapeHtml(firstSize.dimensions);
        sizeHtml =
          '<div class="size-selector" id="size-selector">' +
            '<div class="size-selector-label">Размер букета</div>' +
            '<div class="size-btn-row">' + sizeBtns + '</div>' +
            '<div class="size-info" id="size-info">' + firstInfo + '</div>' +
          '</div>';
      } else if (p.dimensions) {
        sizeHtml = '<div class="size-selector"><div class="size-info">' + escapeHtml(p.dimensions) + '</div></div>';
      }

      var detailPrice = (p.sizes && p.sizes.length) ? p.sizes[0].price : p.price;
      var detailOutOfStock = p.in_stock === 0;
      var detailActions = detailOutOfStock
        ? '<div class="product-detail-actions"><div class="detail-soon-badge">Скоро будет в наличии</div></div>'
        : '<div class="product-detail-actions"><button class="card-cart-btn card-cart-btn--large" onclick="addToCartWithSize(' + p.id + ',event)">В корзину</button></div>';

      document.getElementById('product-detail').innerHTML =
        '<div class="product-detail' + (detailOutOfStock ? ' product-detail--soon' : '') + '">' +
          galleryHtml +
          '<div class="product-detail-name">' + escapeHtml(p.name) + '</div>' +
          '<div class="product-detail-price" id="detail-price">' + formatPrice(detailPrice) + '</div>' +
          '<div class="product-detail-desc">' + escapeHtml(p.description) + '</div>' +
          (isBouquetCategory(p.category_name) ? '<div class="product-detail-warning">Каждый букет собирается вручную, возможны отличия от фото.</div>' : '') +
          sizeHtml +
          detailActions +
        '</div>';

      window._currentProduct = p;

      if (images.length > 1) {
        initGallery(images.length);
      }
    });
  }

  // ============================================================
  // Image gallery (swipe, arrows, dots)
  // ============================================================

  var galleryState = { index: 0, total: 0, startX: 0, moveX: 0, dragging: false };

  function initGallery(total) {
    galleryState.index = 0;
    galleryState.total = total;
    var track = document.getElementById('gallery-track');
    if (!track) return;
    track.addEventListener('touchstart', galleryTouchStart, { passive: true });
    track.addEventListener('touchmove', galleryTouchMove, { passive: false });
    track.addEventListener('touchend', galleryTouchEnd);
    var dotsEl = document.getElementById('gallery-dots');
    if (dotsEl) {
      dotsEl.addEventListener('click', function (e) {
        var dot = e.target.closest('.gallery-dot');
        if (dot) galleryGoTo(parseInt(dot.getAttribute('data-idx')));
      });
    }
  }

  function galleryGoTo(idx) {
    if (idx < 0) idx = 0;
    if (idx >= galleryState.total) idx = galleryState.total - 1;
    galleryState.index = idx;
    var track = document.getElementById('gallery-track');
    if (track) track.style.transform = 'translateX(-' + (idx * 100) + '%)';
    var dots = document.querySelectorAll('#gallery-dots .gallery-dot');
    dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
  }

  window.galleryPrev = function () { galleryGoTo(galleryState.index - 1); };
  window.galleryNext = function () { galleryGoTo(galleryState.index + 1); };

  function galleryTouchStart(e) {
    galleryState.startX = e.touches[0].clientX;
    galleryState.dragging = true;
    galleryState.moveX = 0;
  }
  function galleryTouchMove(e) {
    if (!galleryState.dragging) return;
    galleryState.moveX = e.touches[0].clientX - galleryState.startX;
    var track = document.getElementById('gallery-track');
    if (track) {
      var offset = -(galleryState.index * 100);
      var pxPercent = (galleryState.moveX / track.parentElement.offsetWidth) * 100;
      track.style.transition = 'none';
      track.style.transform = 'translateX(' + (offset + pxPercent) + '%)';
    }
  }
  function galleryTouchEnd() {
    galleryState.dragging = false;
    var track = document.getElementById('gallery-track');
    if (track) track.style.transition = 'transform 0.3s ease';
    if (Math.abs(galleryState.moveX) > 50) {
      if (galleryState.moveX < 0) galleryGoTo(galleryState.index + 1);
      else galleryGoTo(galleryState.index - 1);
    } else {
      galleryGoTo(galleryState.index);
    }
  }

  function showCart(keepScroll) {
    setActiveTab('cart');
    var cart = getCart();
    syncFreeService(cart);
    saveCart(cart);
    var h = '<div class="section-title">Корзина</div>';
    if (!cart.length) { render(h + '<div class="empty-state">Корзина пуста</div>'); return; }

    renderCartItems(cart, keepScroll);

    var productIds = [];
    cart.forEach(function (item) {
      if (item.product_id && productIds.indexOf(item.product_id) < 0) productIds.push(item.product_id);
    });

    var sizeMap = {};
    var fetches = productIds.map(function (pid) {
      return fetchJSON('/api/products/' + pid).then(function (p) {
        if (p && p.sizes && p.sizes.length) {
          sizeMap[pid] = p.sizes;
        }
      }).catch(function () {});
    });

    Promise.all(fetches).then(function () {
      var updated = false;
      cart = getCart();
      cart.forEach(function (item) {
        if (sizeMap[item.product_id]) {
          item.available_sizes = sizeMap[item.product_id];
          updated = true;
        }
      });
      if (updated) {
        saveCart(cart);
        cart.forEach(function (item, idx) {
          if (!sizeMap[item.product_id]) return;
          var row = document.getElementById('cart-row-' + idx);
          if (!row) return;
          var oldBtns = row.querySelector('.cart-size-selector');
          if (!oldBtns) return;
          var sizes = item.available_sizes || [];
          var sizeBtns = sizes.map(function (s) {
            var isActive = s.label === item.size_label;
            return '<button type="button" class="size-btn' + (isActive ? ' active' : '') + '" ' +
              'onclick="changeCartSize(' + idx + ',\'' + escapeHtml(s.label).replace(/'/g, "\\'") + '\',' + s.price + ',' + s.flower_count + ',\'' + escapeHtml(s.dimensions || '').replace(/'/g, "\\'") + '\')">' +
              escapeHtml(s.label) + '</button>';
          }).join('');
          oldBtns.querySelector('.size-btn-row').innerHTML = sizeBtns;
        });
      }
    });
  }

  function renderCartItems(cart, keepScroll) {
    var h = '<div class="section-title">Корзина</div>';
    h += '<div class="cart-items">';
    cart.forEach(function (item, idx) {
      if (item.is_free_service) return;
      h += buildCartRow(item, idx);
    });
    cart.forEach(function (item, idx) {
      if (!item.is_free_service) return;
      h += buildCartRow(item, idx);
    });
    h += '</div>';
    h += '<div id="cart-recommend"></div>';
    h += '<div class="cart-total">Итого: <span id="cart-total-val">' + formatPrice(getCartTotal()) + '</span></div>';
    h += '<button class="nav-btn" onclick="navigateTo(\'checkout\')">Оформить заказ</button>';
    if (keepScroll) {
      var scrollY = window.scrollY;
      appEl.innerHTML = h;
      window.scrollTo(0, scrollY);
    } else {
      render(h);
    }
    loadCartRecommendations(cart);
  }

  function loadCartRecommendations(cart) {
    var cartIds = {};
    cart.forEach(function (item) { cartIds[item.product_id] = true; });

    fetchJSON('/api/products').then(function (products) {
      if (!products || !products.length) return;
      var sorted = products.filter(function (p) {
        return !cartIds[p.id] && p.in_stock !== 0 && p.is_recommended;
      });
      if (!sorted.length) return;

      var el = document.getElementById('cart-recommend');
      if (!el) return;

      var h = '<div class="cart-rec-section">';
      h += '<div class="cart-rec-title">Добавьте к заказу</div>';
      h += '<div class="cart-rec-wrap">';
      h += '<button class="cart-rec-arrow cart-rec-arrow--left" onclick="scrollRec(-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>';
      h += '<div class="cart-rec-scroll">';
      sorted.forEach(function (p) {
        var img = p.image_url
          ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" class="cart-rec-img">'
          : '<div class="cart-rec-img cart-rec-noimg">Фото</div>';
        var price = (p.sizes && p.sizes.length) ? p.sizes[0].price : p.price;
        var priceLabel = (p.sizes && p.sizes.length) ? 'от ' + formatPrice(price) : formatPrice(price);
        h += '<div class="cart-rec-card" onclick="navigateTo(\'product\',' + p.id + ')">' +
          img +
          '<div class="cart-rec-name">' + escapeHtml(p.name) + '</div>' +
          '<div class="cart-rec-price">' + priceLabel + '</div>' +
          '<button class="cart-rec-add" onclick="addRecToCart(' + p.id + ',event)">+</button>' +
        '</div>';
      });
      h += '</div>';
      h += '<button class="cart-rec-arrow cart-rec-arrow--right" onclick="scrollRec(1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>';
      h += '</div></div>';
      el.innerHTML = h;
    }).catch(function () {});
  }

  function buildCartRow(item, idx) {
    if (item.is_free_service) {
      return '<div class="cart-item" id="cart-row-' + idx + '">' +
        productImage(item.image_url, item.name, 'cart-item-img') +
        '<div class="cart-item-info">' +
          '<div>' +
            '<div class="cart-item-name">' + escapeHtml(item.name) + '</div>' +
            '<div class="cart-item-price">0 ₽</div>' +
          '</div>' +
          '<div class="cart-item-controls">' +
            '<span class="qty-value" id="qty-val-' + idx + '">' + item.quantity + '</span> шт.' +
          '</div>' +
        '</div></div>';
    }
    var sizeSelector = '';
    var sizes = item.available_sizes || [];
    if (sizes.length) {
      var sizeBtns = sizes.map(function (s) {
        var isActive = s.label === item.size_label;
        return '<button type="button" class="size-btn' + (isActive ? ' active' : '') + '" ' +
          'onclick="changeCartSize(' + idx + ',\'' + escapeHtml(s.label).replace(/'/g, "\\'") + '\',' + s.price + ',' + s.flower_count + ',\'' + escapeHtml(s.dimensions || '').replace(/'/g, "\\'") + '\')">' +
          escapeHtml(s.label) + '</button>';
      }).join('');
      var sizeInfo = '';
      if (item.flower_count) sizeInfo += pluralFlower(item.flower_count);
      if (item.dimensions) sizeInfo += (sizeInfo ? ' · ' : '') + escapeHtml(item.dimensions);
      sizeSelector = '<div class="cart-size-selector">' +
        '<div class="size-btn-row">' + sizeBtns + '</div>' +
        (sizeInfo ? '<div class="cart-size-fc">' + sizeInfo + '</div>' : '') +
      '</div>';
    } else if (item.dimensions) {
      sizeSelector = '<div class="cart-size-selector"><div class="cart-size-fc">' + escapeHtml(item.dimensions) + '</div></div>';
    }
    var escapedLabel = escapeHtml(item.size_label || '').replace(/'/g, "\\'");
    return '<div class="cart-item" id="cart-row-' + idx + '">' +
      '<div class="cart-img-wrap">' + productImage(item.image_url, item.name, 'cart-item-img') + '</div>' +
      '<div class="cart-item-info">' +
        '<div>' +
          '<div class="cart-item-name">' + escapeHtml(item.name) + '</div>' +
          sizeSelector +
          '<div class="cart-item-price" id="price-val-' + idx + '">' + formatPrice(item.price) + '</div>' +
        '</div>' +
        '<div class="cart-item-controls">' +
          '<button class="qty-btn" onclick="changeQty(' + item.product_id + ',\'' + escapedLabel + '\',-1)">-</button>' +
          '<span class="qty-value" id="qty-val-' + idx + '">' + item.quantity + '</span>' +
          '<button class="qty-btn" onclick="changeQty(' + item.product_id + ',\'' + escapedLabel + '\',1)">+</button>' +
          '<button class="remove-btn" onclick="removeItem(' + item.product_id + ',\'' + escapedLabel + '\')">Удалить</button>' +
        '</div>' +
      '</div></div>';
  }

  window.scrollRec = function (dir) {
    var s = document.querySelector('.cart-rec-scroll');
    if (s) s.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  window.addRecToCart = function (productId, event) {
    if (event) event.stopPropagation();
    var btn = event && event.currentTarget;
    var recCard = btn ? btn.closest('.cart-rec-card') : null;

    var cartBefore = getCart();
    var countBefore = cartBefore.length;

    fetchJSON('/api/products/' + productId).then(function (p) {
      if (!p || p.error) return;
      var sizeObj = null;
      if (p.sizes && p.sizes.length) sizeObj = p.sizes[0];
      addToCart(p, sizeObj);

      var cart = getCart();
      var cartItemsEl = document.querySelector('.cart-items');

      if (cart.length > countBefore) {
        var newItem = cart[cart.length - 1];
        if (cartItemsEl) {
          var temp = document.createElement('div');
          temp.innerHTML = buildCartRow(newItem, cart.length - 1);
          var row = temp.firstChild;
          cartItemsEl.appendChild(row);
        }
      } else {
        var sizeLabel = sizeObj ? sizeObj.label : '';
        var key = productId + '_' + sizeLabel;
        for (var i = 0; i < cart.length; i++) {
          if ((cart[i].product_id + '_' + (cart[i].size_label || '')) === key) {
            var qtyEl = document.getElementById('qty-val-' + i);
            if (qtyEl) qtyEl.textContent = cart[i].quantity;
            break;
          }
        }
      }

      var totalEl = document.getElementById('cart-total-val');
      if (totalEl) totalEl.textContent = formatPrice(getCartTotal());

      if (recCard) {
        var addBtn = recCard.querySelector('.cart-rec-add');
        if (addBtn) {
          addBtn.outerHTML = '<div class="cart-rec-in-cart">В корзине</div>';
        }
        recCard.removeAttribute('onclick');
        recCard.style.opacity = '0.6';
      }

      updateCartBadge();
    });
  };

  // ============================================================
  // Checkout with delivery logic
  // ============================================================

  var checkoutState = {
    deliveryType: 'delivery',
    deliveryZoneKey: '',
    deliveryInterval: '',
    exactTime: false,
    deliveryDistance: 0,
    deliveryCoords: null,
    isEngels: false,
    addressValidated: false
  };

  window.saveCheckoutDraft = function() {
    try {
      var draft = {
        step: currentStep,
        state: checkoutState,
        fields: {}
      };
      var ids = ['field-tg','field-phone','field-email',
                 'field-addr-suggest','field-addr-apt','field-addr-note','field-address',
                 'field-date','field-exact-time','field-comment',
                 'field-rcv-name','field-rcv-phone'];
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) draft.fields[id] = el.value;
      });
      var selfCb = document.getElementById('self-receiver-cb');
      if (selfCb) draft.selfReceiver = selfCb.checked;
      var consentCb = document.getElementById('consent-cb');
      if (consentCb) draft.consent = consentCb.checked;
      sessionStorage.setItem('arka_checkout_draft', JSON.stringify(draft));
    } catch(e) {}
  }
  function loadCheckoutDraft() {
    try {
      var s = sessionStorage.getItem('arka_checkout_draft');
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
  }
  function clearCheckoutDraft() {
    try { sessionStorage.removeItem('arka_checkout_draft'); } catch(e) {}
  }

  var ymapsLoaded = false;
  var YMAPS_KEY = '860d165d-0fa8-47b3-87af-b926029b9c20';
  var YMAPS_SUGGEST_KEY = 'b52747c9-3455-4915-8898-7565ad0cba80';
  function loadYmaps(cb) {
    if (ymapsLoaded) { if (cb) cb(); return; }
    var key = YMAPS_KEY || appSettings.yandex_maps_key;
    if (!key) { console.warn('[YMaps] No API key'); if (cb) cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://api-maps.yandex.ru/2.1/?apikey=' + encodeURIComponent(key) + '&lang=ru_RU&suggest_apikey=' + encodeURIComponent(YMAPS_SUGGEST_KEY);
    s.onload = function () {
      console.log('[YMaps] Script loaded');
      window.ymaps.ready(function () {
        ymapsLoaded = true;
        console.log('[YMaps] Ready');
        if (cb) cb();
      });
    };
    s.onerror = function (e) { console.error('[YMaps] Script load error', e); if (cb) cb(); };
    document.head.appendChild(s);
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function getShopCoords() {
    var str = appSettings.shop_coords || '51.533,46.034';
    var parts = str.split(',');
    return { lat: parseFloat(parts[0]) || 51.533, lon: parseFloat(parts[1]) || 46.034 };
  }

  function getEngelsCoords() {
    var str = appSettings.engels_coords || '51.485,46.126';
    var parts = str.split(',');
    return { lat: parseFloat(parts[0]) || 51.485, lon: parseFloat(parts[1]) || 46.126 };
  }

  function isEngelsAddress(address) {
    var lower = address.toLowerCase();
    return lower.indexOf('энгельс') !== -1 || lower.indexOf('engels') !== -1;
  }

  function getDeliveryTiers(engels) {
    var key = engels ? 'delivery_distance_tiers_engels' : 'delivery_distance_tiers';
    try { return JSON.parse(appSettings[key] || '[]'); }
    catch (e) { return []; }
  }

  function getDeliveryCostByDistance(km, engels) {
    var tiers = getDeliveryTiers(engels);
    if (!tiers.length) return 0;
    tiers.sort(function (a, b) { return a.max_km - b.max_km; });
    for (var i = 0; i < tiers.length; i++) {
      if (km <= tiers[i].max_km) return tiers[i].price;
    }
    return tiers[tiers.length - 1].price;
  }

  function getDeliveryCost() {
    if (checkoutState.deliveryType === 'pickup') return 0;
    if (checkoutState.exactTime) {
      return parseInt(appSettings.exact_time_surcharge) || 1000;
    }
    if (checkoutState.deliveryDistance > 0) {
      return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels);
    }
    return 0;
  }

  var currentStep = 1;

  function showCheckout() {
    var cart = getCart();
    if (!cart.length) { navigateTo('cart'); return; }

    var draft = loadCheckoutDraft();

    if (draft && draft.state) {
      checkoutState.deliveryType = draft.state.deliveryType || 'delivery';
      checkoutState.deliveryInterval = draft.state.deliveryInterval || '';
      checkoutState.exactTime = !!draft.state.exactTime;
      checkoutState.deliveryDistance = draft.state.deliveryDistance || 0;
      checkoutState.deliveryCoords = draft.state.deliveryCoords || null;
      checkoutState.isEngels = !!draft.state.isEngels;
      checkoutState.addressValidated = !!draft.state.addressValidated;
    } else {
      checkoutState.deliveryInterval = '';
      checkoutState.exactTime = false;
      checkoutState.addressValidated = false;
      checkoutState.deliveryDistance = 0;
      checkoutState.deliveryCoords = null;
    }

    currentStep = (draft && draft.step) ? draft.step : 1;

    var df = (draft && draft.fields) || {};
    var userName = (dbUser && dbUser.first_name) || (tgUser && tgUser.first_name) || '';
    var userPhone = df['field-phone'] || (dbUser && dbUser.phone) || '';
    var userEmail = df['field-email'] || '';
    var userAddr = (dbUser && dbUser.default_address) || '';
    var tgUsername = df['field-tg'] || ((tgUser && tgUser.username) ? '@' + tgUser.username : '');

    var intervals = getIntervals();
    var sNow = saratovNow();
    var currentHour = sNow.hours;
    var cutoff = getCutoffHour();
    var holiday = isHolidayToday();
    var pickup = appSettings.pickup_address || 'г. Саратов, 3-й Дегтярный проезд, 21к3';

    if (!draft) {
      checkoutState.deliveryDistance = 0;
      checkoutState.deliveryCoords = null;
    }
    _miniMap = null;

    var todayStr = sNow.dateStr;
    var tmrw = new Date(sNow.year, sNow.month - 1, sNow.day + 1);
    var tomorrowStr = tmrw.getFullYear() + '-' + String(tmrw.getMonth() + 1).padStart(2, '0') + '-' + String(tmrw.getDate()).padStart(2, '0');
    var isTodayClosed = currentHour >= cutoff;
    var minDate = todayStr;
    var defaultDate = isTodayClosed ? tomorrowStr : todayStr;

    render(
      '<span class="back-link" onclick="navigateTo(\'cart\')">К корзине</span>' +
      '<div class="section-title">Оформление заказа</div>' +
      (selectedCity ? '<div style="font-size:12px;margin-bottom:14px">Город: ' + escapeHtml(selectedCity.name) + '</div>' : '') +

      '<div class="checkout-steps">' +
        '<div class="step-indicators">' +
          '<div class="step-dot active" data-step="1"><span class="step-num">1</span></div>' +
          '<div class="step-line"></div>' +
          '<div class="step-dot locked" data-step="2"><span class="step-num">2</span></div>' +
          '<div class="step-line"></div>' +
          '<div class="step-dot locked" data-step="3"><span class="step-num">3</span></div>' +
        '</div>' +
        '<div class="step-labels">' +
          '<span class="step-label active">Заказчик</span>' +
          '<span class="step-label">Доставка</span>' +
          '<span class="step-label">Получатель</span>' +
        '</div>' +
      '</div>' +

      '<div class="checkout-panels">' +

        '<div class="checkout-panel active" id="step-1">' +
          '<div class="step-title">Информация о заказчике</div>' +
          '<div class="form-group"><label>Telegram</label>' +
          '<input type="text" id="field-tg" placeholder="@username" value="' + escapeHtml(tgUsername) + '" oninput="updateStepButtons()"></div>' +
          '<div class="form-group"><label>Контактный телефон</label>' +
          '<input type="tel" id="field-phone" placeholder="+7 (___) ___-__-__" value="' + escapeHtml(userPhone) + '" oninput="formatPhoneInput(this); updateStepButtons()" maxlength="18"></div>' +
          '<div class="form-group"><label>Электронная почта</label>' +
          '<input type="email" id="field-email" placeholder="mail@example.com" value="' + escapeHtml(userEmail) + '" oninput="filterEmailInput(this); updateStepButtons()"></div>' +
          '<button type="button" class="step-next-btn" id="step1-next" onclick="goToStep(2)">Далее</button>' +
        '</div>' +

        '<div class="checkout-panel" id="step-2">' +
          '<div class="step-title">Доставка</div>' +

          '<div class="form-group"><label>Способ получения</label>' +
          '<div class="radio-group" id="delivery-type-group">' +
            '<label class="radio-option' + (checkoutState.deliveryType === 'delivery' ? ' selected' : '') + '" onclick="setDeliveryType(\'delivery\')">' +
              '<input type="radio" name="dtype" value="delivery"' + (checkoutState.deliveryType === 'delivery' ? ' checked' : '') + '>' +
              '<span class="radio-dot"></span> Доставка</label>' +
            '<label class="radio-option' + (checkoutState.deliveryType === 'pickup' ? ' selected' : '') + '" onclick="setDeliveryType(\'pickup\')">' +
              '<input type="radio" name="dtype" value="pickup"' + (checkoutState.deliveryType === 'pickup' ? ' checked' : '') + '>' +
              '<span class="radio-dot"></span> Самовывоз (' + escapeHtml(pickup) + ')</label>' +
          '</div></div>' +

          '<div id="delivery-fields">' +
            '<div id="saved-addr-picker"></div>' +
            '<div class="form-group"><label>Адрес доставки</label>' +
            '<input type="text" id="field-addr-suggest" autocomplete="off" placeholder="Начните вводить адрес…" oninput="updateStepButtons()"></div>' +
            '<div id="ymaps-minimap" style="width:100%;height:180px;border-radius:10px;overflow:hidden;margin:8px 0;display:none"></div>' +
            '<div id="delivery-distance-info" style="font-size:13px;margin:6px 0;display:none"></div>' +
            '<div class="form-group"><label>Квартира / офис</label>' +
            '<input type="text" id="field-addr-apt" placeholder="Квартира, подъезд, этаж" oninput="saveCheckoutDraft()"></div>' +
            '<div class="form-group"><label>Дополнение к адресу</label>' +
            '<input type="text" id="field-addr-note" placeholder="Код домофона, ориентиры и т.д." oninput="saveCheckoutDraft()"></div>' +
            '<input type="hidden" id="field-address">' +
          '</div>' +

          '<div id="nearest-delivery-hint" class="nearest-delivery-hint"></div>' +

          '<div id="date-cutoff-notice" class="cutoff-notice" style="display:none"></div>' +

          '<div class="form-group"><label id="date-label">Дата доставки</label>' +
          '<input type="date" id="field-date" class="form-input-date" min="' + minDate + '" value="' + defaultDate + '" onchange="onDeliveryDateChange()"></div>' +

          '<div class="form-group"><label id="time-label">Время доставки</label>' +
          '<div class="radio-group" id="interval-group">' +
          '</div></div>' +

          (isExactTimeEnabled() ?
          '<div class="exact-time-section">' +
            '<label class="checkout-self-btn" id="exact-time-opt" onclick="toggleExactTime()">' +
              '<input type="checkbox" id="exact-time-cb">' +
              '<span class="check-box"></span> Доставка точно ко времени (+' + formatPrice(parseInt(appSettings.exact_time_surcharge) || 1000) + ')' +
            '</label>' +
            '<div id="exact-time-fields" style="display:none">' +
              '<div style="font-size:12px;color:#888;margin:8px 0 6px">Заказ будет доставлен в интервале ±1,5 часа от указанного времени</div>' +
              '<input type="time" id="field-exact-time" class="form-input-date" value="12:00" onchange="validateExactTime()">' +
              '<div id="exact-time-warn" class="cutoff-notice" style="display:none"></div>' +
            '</div>' +
          '</div>' : '') +

          '<div class="form-group"><label>Комментарий к заказу</label>' +
          '<textarea id="field-comment" placeholder="Пожелания, особые указания" oninput="saveCheckoutDraft()"></textarea></div>' +

          '<div class="step-btn-row">' +
            '<button type="button" class="step-back-btn" onclick="goToStep(1)">Назад</button>' +
            '<button type="button" class="step-next-btn" id="step2-next" onclick="goToStep(3)">Далее</button>' +
          '</div>' +
        '</div>' +

        '<div class="checkout-panel" id="step-3">' +
          '<div class="step-title">Получатель</div>' +
          '<div class="form-group">' +
            '<label class="checkout-self-btn" id="self-receiver-btn" onclick="toggleSelfReceiver()">' +
              '<input type="checkbox" id="self-receiver-cb">' +
              '<span class="check-box"></span> Я сам получатель' +
            '</label>' +
          '</div>' +
          '<div id="receiver-fields">' +
            '<div class="form-group"><label>Имя получателя</label>' +
            '<input type="text" id="field-rcv-name" placeholder="Имя получателя" oninput="updateStepButtons()"></div>' +
            '<div class="form-group"><label>Телефон получателя</label>' +
            '<input type="tel" id="field-rcv-phone" placeholder="+7 (___) ___-__-__" oninput="formatPhoneInput(this); updateStepButtons()" maxlength="18"></div>' +
          '</div>' +
          '<div id="checkout-summary"></div>' +
          '<div class="consent-check">' +
            '<label class="checkout-self-btn" id="consent-btn" onclick="toggleConsent()">' +
              '<input type="checkbox" id="consent-cb">' +
              '<span class="check-box"></span> ' +
              '<span>Я даю согласие на <a href="#" onclick="event.stopPropagation(); navigateTo(\'page-offer\'); return false;" style="text-decoration:underline">обработку персональных данных</a></span>' +
            '</label>' +
          '</div>' +
          '<div class="step-btn-row">' +
            '<button type="button" class="step-back-btn" onclick="goToStep(2)">Назад</button>' +
            '<button type="button" class="step-next-btn step-submit-btn" id="checkout-submit" onclick="submitOrder(event)">Оформить заказ</button>' +
          '</div>' +
        '</div>' +

      '</div>'
    );

    if (draft && draft.fields) {
      var restoreIds = ['field-addr-suggest','field-addr-apt','field-addr-note','field-address',
                        'field-date','field-comment','field-rcv-name','field-rcv-phone'];
      restoreIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el && df[id] !== undefined) el.value = df[id];
      });
      if (checkoutState.deliveryType === 'pickup') {
        setDeliveryType('pickup');
      }
      if (draft.selfReceiver) {
        var selfCb = document.getElementById('self-receiver-cb');
        if (selfCb && !selfCb.checked) toggleSelfReceiver();
      }
      if (draft.consent) {
        var ccb = document.getElementById('consent-cb');
        if (ccb && !ccb.checked) toggleConsent();
      }
      if (checkoutState.exactTime) {
        var etCb = document.getElementById('exact-time-cb');
        if (etCb && !etCb.checked) {
          etCb.checked = true;
          var etOpt = document.getElementById('exact-time-opt');
          if (etOpt) etOpt.classList.add('checked');
          var etFields = document.getElementById('exact-time-fields');
          if (etFields) etFields.style.display = 'block';
        }
        var etInput = document.getElementById('field-exact-time');
        if (etInput && df['field-exact-time']) etInput.value = df['field-exact-time'];
      }
    }

    updateCheckoutSummary();
    updateCutoffNotice();
    renderIntervals();

    if (draft && checkoutState.deliveryInterval) {
      var ivRadios = document.querySelectorAll('#interval-group input[type="radio"]');
      ivRadios.forEach(function(r) {
        if (r.value === checkoutState.deliveryInterval) {
          r.checked = true;
          r.closest('.radio-option').classList.add('selected');
        }
      });
    }

    updateNearestDeliveryHint();
    loadCheckoutAddresses();
    initYmapsSuggest();

    if (draft && checkoutState.addressValidated && df['field-addr-suggest'] && checkoutState.deliveryCoords) {
      loadYmaps(function() {
        showMiniMap(checkoutState.deliveryCoords);
        showDistanceResult(checkoutState.deliveryDistance);
      });
    }

    if (currentStep > 1) goToStep(currentStep);
    updateStepButtons();
  }

  function loadCheckoutAddresses() {
    var telegramId = getTelegramId();
    if (!telegramId) return;
    fetchJSON('/api/user/addresses?telegram_id=' + telegramId).then(function (addrs) {
      var el = document.getElementById('saved-addr-picker');
      if (!el || !addrs || !addrs.length) return;
      var html = '<div class="form-group"><label>Сохранённые адреса</label><div class="saved-addr-chips">';
      addrs.forEach(function (a) {
        html += '<button class="saved-addr-chip" onclick="fillSavedAddress(' + a.id + ')">' +
          escapeHtml(a.label || a.full_address) + '</button>';
      });
      html += '</div></div>';
      el.innerHTML = html;
      window._checkoutAddresses = addrs;
    });
  }

  window.fillSavedAddress = function (addrId) {
    var addrs = window._checkoutAddresses || [];
    var a = addrs.find(function (x) { return x.id === addrId; });
    if (!a) return;
    var suggest = document.getElementById('field-addr-suggest');
    var apt = document.getElementById('field-addr-apt');
    var note = document.getElementById('field-addr-note');
    var fullAddr = [a.city, a.district, a.street].filter(Boolean).join(', ');
    if (suggest) {
      suggest.value = fullAddr;
      geocodeAndCalcDistance(fullAddr);
    }
    if (apt) apt.value = a.apartment || '';
    if (note) note.value = a.note || '';
    var chips = document.querySelectorAll('.saved-addr-chip');
    chips.forEach(function (c) { c.classList.remove('active'); });
    var clicked = document.querySelector('.saved-addr-chip[onclick*="' + addrId + '"]');
    if (clicked) clicked.classList.add('active');
    showToast('Адрес заполнен');
  };

  function initYmapsSuggest() {
    loadYmaps(function () {
      var input = document.getElementById('field-addr-suggest');
      if (!input) return;

      input.addEventListener('blur', function () {
        var val = input.value.trim();
        if (val && !checkoutState.addressValidated) {
          geocodeAndCalcDistance(val);
        }
      });

      input.addEventListener('input', function () {
        checkoutState.addressValidated = false;
        checkoutState.deliveryDistance = 0;
        checkoutState.deliveryCoords = null;
        var mapEl = document.getElementById('ymaps-minimap');
        if (mapEl) mapEl.style.display = 'none';
        var distEl = document.getElementById('delivery-distance-info');
        if (distEl) distEl.style.display = 'none';
        updateStepButtons();
      });

      if (!ymapsLoaded || !window.ymaps) {
        console.warn('[YMaps] Not loaded, suggest unavailable');
        return;
      }
      try {
        var cleanProvider = {
          suggest: function (request, options) {
            return window.ymaps.suggest(request, {
              results: options.results || 5,
              boundedBy: [[51.0, 45.0], [52.0, 47.0]]
            }).then(function (items) {
              return items.map(function (item) {
                var short = item.displayName
                  .replace(/Россия,?\s*/i, '')
                  .replace(/Саратовская область,?\s*/i, '')
                  .replace(/городской округ[^,]*,?\s*/i, '')
                  .replace(/^\s*,\s*/, '').trim();
                return { displayName: short, value: item.value };
              });
            });
          }
        };
        var suggestView = new window.ymaps.SuggestView('field-addr-suggest', {
          results: 5,
          boundedBy: [[51.0, 45.0], [52.0, 47.0]],
          strictBounds: false,
          provider: cleanProvider
        });
        suggestView.events.add('select', function (e) {
          var item = e.get('item');
          checkoutState.addressValidated = false;
          geocodeAndCalcDistance(item.value);
        });
        console.log('[YMaps] SuggestView initialized');
      } catch (e) {
        console.error('[YMaps] Suggest init failed:', e);
      }
    });
  }

  function geocodeAndCalcDistance(address) {
    var engels = isEngelsAddress(address);
    checkoutState.isEngels = engels;
    var origin = engels ? getEngelsCoords() : getShopCoords();
    var originLabel = engels ? 'от центра Энгельса' : 'от магазина';
    checkoutState.addressValidated = false;
    if (ymapsLoaded && window.ymaps) {
      window.ymaps.geocode(address, { results: 1 }).then(function (res) {
        var obj = res.geoObjects.get(0);
        if (!obj) {
          checkoutState.addressValidated = true;
          checkoutState.deliveryDistance = 0;
          showDistanceResult(0, '');
          updateStepButtons();
          var hidden = document.getElementById('field-address');
          if (hidden) hidden.value = address;
          return;
        }
        var coords = obj.geometry.getCoordinates();
        checkoutState.deliveryCoords = { lat: coords[0], lon: coords[1] };
        var km = haversineKm(origin.lat, origin.lon, coords[0], coords[1]);
        checkoutState.deliveryDistance = Math.round(km * 10) / 10;
        checkoutState.addressValidated = true;
        showDistanceResult(checkoutState.deliveryDistance, originLabel);
        showMiniMap(coords);
        updateStepButtons();
        var hidden = document.getElementById('field-address');
        if (hidden) hidden.value = address;
      }).catch(function () {
        checkoutState.addressValidated = true;
        checkoutState.deliveryDistance = 0;
        updateStepButtons();
        var hidden = document.getElementById('field-address');
        if (hidden) hidden.value = address;
      });
    } else {
      checkoutState.addressValidated = true;
      checkoutState.deliveryDistance = 0;
      showDistanceResult(0, '');
      updateStepButtons();
      var hidden = document.getElementById('field-address');
      if (hidden) hidden.value = address;
    }
  }

  function showDistanceResult(km, originLabel) {
    var el = document.getElementById('delivery-distance-info');
    if (!el) return;
    if (km > 0) {
      var cost = getDeliveryCostByDistance(km, checkoutState.isEngels);
      var label = originLabel ? ' (' + originLabel + ')' : '';
      el.innerHTML = 'Расстояние: <b>' + km.toFixed(1) + ' км</b>' + label + ' — Доставка: <b>' + formatPrice(cost) + '</b>';
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
    updateCheckoutSummary();
  }

  var _miniMap = null;
  function showMiniMap(coords) {
    var container = document.getElementById('ymaps-minimap');
    if (!container || !ymapsLoaded) return;
    container.style.display = '';
    if (_miniMap) {
      _miniMap.setCenter(coords, 15);
      _miniMap.geoObjects.removeAll();
    } else {
      _miniMap = new window.ymaps.Map('ymaps-minimap', {
        center: coords,
        zoom: 15,
        controls: ['zoomControl']
      }, { suppressMapOpenBlock: true });
    }
    var placemark = new window.ymaps.Placemark(coords, {}, {
      preset: 'islands#darkCircleDotIcon'
    });
    _miniMap.geoObjects.add(placemark);
  }

  window.goToStep = function (step) {
    if (step > currentStep) {
      var curBtn = document.getElementById(currentStep === 1 ? 'step1-next' : 'step2-next');
      if (curBtn && curBtn.classList.contains('btn-dimmed')) return;
      if (currentStep === 1) {
        var phone = document.getElementById('field-phone').value.trim();
        var tg = document.getElementById('field-tg').value.trim();
        var email = document.getElementById('field-email').value.trim();
        if (!phone || !tg) {
          showToast('Заполните Telegram и телефон');
          return;
        }
        if (!validatePhone(phone)) return;
        if (!email) {
          showToast('Заполните электронную почту');
          return;
        }
        if (!validateEmail(email)) return;
      }
      if (currentStep === 2) {
        if (checkoutState.deliveryType === 'delivery') {
          var suggestVal = document.getElementById('field-addr-suggest') ? document.getElementById('field-addr-suggest').value.trim() : '';
          if (!suggestVal) { showToast('Укажите адрес доставки'); return; }
          if (!checkoutState.addressValidated) {
            geocodeAndCalcDistance(suggestVal);
          }
          var hiddenAddr = document.getElementById('field-address');
          if (hiddenAddr) hiddenAddr.value = buildDeliveryAddress();
        }
        var dateVal = document.getElementById('field-date').value;
        if (!dateVal) { showToast('Укажите дату доставки'); return; }
        var sNowCheck = saratovNow();
        var todayCheck = sNowCheck.dateStr;
        if (checkoutState.deliveryType === 'delivery' && dateVal === todayCheck && sNowCheck.hours >= getCutoffHour()) {
          showToast('Доставка на сегодня недоступна. Выберите другую дату или самовывоз.');
          return;
        }
        if (!checkoutState.deliveryInterval && !checkoutState.exactTime) {
          showToast(checkoutState.deliveryType === 'pickup' ? 'Выберите время готовности' : 'Выберите время доставки (интервал или точное время)');
          return;
        }
        if (checkoutState.exactTime && !validateExactTime()) {
          showToast('Выберите корректное время доставки');
          return;
        }
      }
    }

    currentStep = step;
    saveCheckoutDraft();

    var panels = document.querySelectorAll('.checkout-panel');
    panels.forEach(function (p) {
      p.classList.remove('active');
      p.classList.remove('slide-in');
    });
    var target = document.getElementById('step-' + step);
    if (target) {
      target.classList.add('active');
      target.classList.add('slide-in');
    }

    var dots = document.querySelectorAll('.step-dot');
    dots.forEach(function (d, idx) {
      var s = idx + 1;
      d.classList.remove('active', 'done', 'locked');
      if (s < step) d.classList.add('done');
      else if (s === step) d.classList.add('active');
      else d.classList.add('locked');
    });

    var labels = document.querySelectorAll('.step-label');
    labels.forEach(function (l, idx) {
      var s = idx + 1;
      l.classList.remove('active', 'done');
      if (s < step) l.classList.add('done');
      else if (s === step) l.classList.add('active');
    });

    var lines = document.querySelectorAll('.step-line');
    lines.forEach(function (ln, idx) {
      ln.classList.toggle('done', idx < step - 1);
    });

    if (step === 3) updateCheckoutSummary();
  };

  window.toggleSelfReceiver = function () {
    var cb = document.getElementById('self-receiver-cb');
    cb.checked = !cb.checked;
    var btn = document.getElementById('self-receiver-btn');
    if (btn) btn.classList.toggle('checked', cb.checked);
    var fields = document.getElementById('receiver-fields');
    if (fields) fields.style.display = cb.checked ? 'none' : 'block';
    updateStepButtons();
  };

  window.toggleConsent = function () {
    var cb = document.getElementById('consent-cb');
    cb.checked = !cb.checked;
    var btn = document.getElementById('consent-btn');
    if (btn) btn.classList.toggle('checked', cb.checked);
    updateStepButtons();
  };

  window.updateStepButtons = function () {
    var btn1 = document.getElementById('step1-next');
    if (btn1) {
      var tg = (document.getElementById('field-tg') || {}).value || '';
      var phone = (document.getElementById('field-phone') || {}).value || '';
      var email = (document.getElementById('field-email') || {}).value || '';
      var emailOk = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
      var ready1 = tg.trim().length > 0 && phone.replace(/\D/g, '').length >= 11 && emailOk;
      btn1.classList.toggle('btn-dimmed', !ready1);
    }

    var btn2 = document.getElementById('step2-next');
    if (btn2) {
      var ready2 = true;
      if (checkoutState.deliveryType === 'delivery') {
        var addrInput = document.getElementById('field-addr-suggest');
        if (!addrInput || !addrInput.value.trim()) ready2 = false;
        if (!checkoutState.deliveryInterval && !checkoutState.exactTime) ready2 = false;
      } else {
        if (!checkoutState.deliveryInterval) ready2 = false;
      }
      var dateField = document.getElementById('field-date');
      if (!dateField || !dateField.value) ready2 = false;
      btn2.classList.toggle('btn-dimmed', !ready2);
    }

    var btn3 = document.getElementById('checkout-submit');
    if (btn3) {
      var consentOk = document.getElementById('consent-cb') && document.getElementById('consent-cb').checked;
      var selfRcv = document.getElementById('self-receiver-cb') && document.getElementById('self-receiver-cb').checked;
      var rcvReady = true;
      if (!selfRcv) {
        var rcvName = (document.getElementById('field-rcv-name') || {}).value || '';
        var rcvPhone = (document.getElementById('field-rcv-phone') || {}).value || '';
        rcvReady = rcvName.trim().length > 0 && rcvPhone.replace(/\D/g, '').length >= 11;
      }
      var ready3 = consentOk && rcvReady;
      btn3.classList.toggle('btn-dimmed', !ready3);
    }
    saveCheckoutDraft();
  };

  function updateCheckoutSummary() {
    var el = document.getElementById('checkout-summary');
    if (!el) return;
    var goodsTotal = getCartTotal();
    var deliveryCost = getDeliveryCost();
    var total = goodsTotal + deliveryCost;
    var h = '<div class="order-summary">Товары: ' + formatPrice(goodsTotal) + '</div>';
    if (checkoutState.deliveryType === 'delivery') {
      var deliveryLabel = checkoutState.exactTime ? 'Доставка (точно ко времени)' : 'Доставка';
      if (checkoutState.deliveryDistance > 0 && !checkoutState.exactTime) {
        deliveryLabel += ' (' + checkoutState.deliveryDistance.toFixed(1) + ' км)';
      }
      h += '<div class="order-summary">' + deliveryLabel + ': ' + formatPrice(deliveryCost) + '</div>';
    }
    h += '<div class="cart-total">Итого: ' + formatPrice(total) + '</div>';
    el.innerHTML = h;
  }

  function updateCutoffNotice() {
    var notice = document.getElementById('date-cutoff-notice');
    if (!notice) return;
    var dateField = document.getElementById('field-date');
    var sNow = saratovNow();
    var isToday = dateField && dateField.value === sNow.dateStr;
    var isPickup = checkoutState.deliveryType === 'pickup';
    var cutoffHr = isPickup ? getPickupCutoffHour() : getCutoffHour();
    var isClosed = isToday && sNow.hours >= cutoffHr;
    if (isClosed) {
      var label = isPickup ? 'Самовывоз' : 'Доставка';
      notice.textContent = label + ' на сегодня уже недоступна (после ' + cutoffHr + ':00). Выберите другую дату.';
      notice.style.display = '';
    } else {
      notice.style.display = 'none';
    }
  }

  function renderIntervals() {
    var el = document.getElementById('interval-group');
    if (!el) return;
    var dateField = document.getElementById('field-date');
    var selectedDate = dateField ? dateField.value : '';
    var sNowIv = saratovNow();
    var todayStr = sNowIv.dateStr;
    var isToday = selectedDate === todayStr;
    var currentHour = sNowIv.hours;
    var cutoff = getCutoffHour();
    var intervals = getIntervals();

    if (isToday && currentHour >= cutoff) {
      el.innerHTML = '<div class="cutoff-hint">На сегодня все интервалы недоступны. Выберите другую дату или самовывоз.</div>';
      return;
    }

    el.innerHTML = intervals.map(function (iv) {
      var parts = iv.split('-');
      var startH = parseInt(parts[0]);
      var disabled = isToday && currentHour >= startH;
      return '<label class="radio-option' + (disabled ? '" style="opacity:0.3;pointer-events:none"' : '"') +
        ' onclick="setDeliveryInterval(\'' + escapeHtml(iv) + '\')">' +
        '<input type="radio" name="interval" value="' + escapeHtml(iv) + '"' + (disabled ? ' disabled' : '') + '>' +
        '<span class="radio-dot"></span> ' + escapeHtml(iv) +
        (disabled ? ' (недоступен)' : '') + '</label>';
    }).join('');
  }

  function updateNearestDeliveryHint() {
    var el = document.getElementById('nearest-delivery-hint');
    if (!el) return;
    if (checkoutState.deliveryType === 'pickup') {
      el.style.display = 'none';
      return;
    }
    var sNow = saratovNow();
    var currentHour = sNow.hours;
    var currentMin = sNow.minutes;
    var cutoff = getCutoffHour();
    var intervals = getIntervals();

    var todayAvailable = [];
    if (currentHour < cutoff && intervals.length) {
      intervals.forEach(function (iv) {
        var parts = iv.split('-');
        var startH = parseInt(parts[0]);
        if (currentHour < startH) todayAvailable.push(iv);
      });
    }

    var dayNames = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];

    if (todayAvailable.length > 0) {
      el.innerHTML = 'Ближайшая доставка: <b>сегодня, ' + escapeHtml(todayAvailable[0]) + '</b>';
      el.style.display = '';
    } else if (intervals.length > 0) {
      var tmrw = new Date(sNow.year, sNow.month - 1, sNow.day + 1);
      var dayIdx = tmrw.getDay();
      var dayName = dayNames[dayIdx];
      var tmrwStr = String(tmrw.getDate()).padStart(2, '0') + '.' + String(tmrw.getMonth() + 1).padStart(2, '0');
      el.innerHTML = 'Ближайшая доставка: <b>' + dayName + ' ' + tmrwStr + ', ' + escapeHtml(intervals[0]) + '</b>';
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }

  window.onDeliveryDateChange = function () {
    updateCutoffNotice();
    checkoutState.deliveryInterval = '';
    renderIntervals();
    if (checkoutState.exactTime) validateExactTime();
    updateStepButtons();
  };

  window.setDeliveryType = function (type) {
    checkoutState.deliveryType = type;
    var opts = document.querySelectorAll('#delivery-type-group .radio-option');
    opts.forEach(function (o) { o.classList.remove('selected'); });
    var clicked = document.querySelector('#delivery-type-group .radio-option input[value="' + type + '"]');
    if (clicked) clicked.closest('.radio-option').classList.add('selected');

    var fields = document.getElementById('delivery-fields');
    if (fields) fields.style.display = type === 'pickup' ? 'none' : 'block';
    var dateLabel = document.getElementById('date-label');
    if (dateLabel) dateLabel.textContent = type === 'pickup' ? 'Дата готовности' : 'Дата доставки';
    var timeLabel = document.getElementById('time-label');
    if (timeLabel) timeLabel.textContent = type === 'pickup' ? 'Время готовности' : 'Время доставки';
    var exactSection = document.querySelector('.exact-time-section');
    if (exactSection) exactSection.style.display = type === 'pickup' ? 'none' : '';
    if (type === 'pickup' && checkoutState.exactTime) {
      checkoutState.exactTime = false;
      var cb = document.getElementById('exact-time-cb');
      if (cb) cb.checked = false;
      var opt2 = document.getElementById('exact-time-opt');
      if (opt2) opt2.classList.remove('checked');
      var etFields = document.getElementById('exact-time-fields');
      if (etFields) etFields.style.display = 'none';
    }
    updateCutoffNotice();
    renderIntervals();
    updateNearestDeliveryHint();
    updateCheckoutSummary();
    updateStepButtons();
  };

  window.setZone = function (zoneKey) {
    checkoutState.deliveryZoneKey = zoneKey;
    var opts = document.querySelectorAll('#zone-group .radio-option');
    opts.forEach(function (o) { o.classList.remove('selected'); });
    var radios = document.querySelectorAll('#zone-group input[type="radio"]');
    radios.forEach(function (r) {
      if (r.value === zoneKey) r.closest('.radio-option').classList.add('selected');
    });
    updateCheckoutSummary();
  };

  window.setDeliveryInterval = function (iv) {
    checkoutState.deliveryInterval = iv;
    var opts = document.querySelectorAll('#interval-group .radio-option');
    opts.forEach(function (o) { o.classList.remove('selected'); });
    var radios = document.querySelectorAll('#interval-group input[type="radio"]');
    radios.forEach(function (r) {
      if (r.value === iv) r.closest('.radio-option').classList.add('selected');
    });
    updateStepButtons();
  };

  window.toggleExactTime = function () {
    var cb = document.getElementById('exact-time-cb');
    cb.checked = !cb.checked;
    checkoutState.exactTime = cb.checked;
    var opt = document.getElementById('exact-time-opt');
    if (opt) opt.classList.toggle('checked', cb.checked);
    var fields = document.getElementById('exact-time-fields');
    if (fields) fields.style.display = cb.checked ? 'block' : 'none';
    if (cb.checked) {
      checkoutState.deliveryInterval = '';
      var intervalOpts = document.querySelectorAll('#interval-group .radio-option');
      intervalOpts.forEach(function (o) { o.classList.remove('selected'); });
      var intervalRadios = document.querySelectorAll('#interval-group input[type="radio"]');
      intervalRadios.forEach(function (r) { r.checked = false; });
      validateExactTime();
    }
    updateCheckoutSummary();
    updateStepButtons();
  };

  window.validateExactTime = function () {
    var warn = document.getElementById('exact-time-warn');
    var timeInput = document.getElementById('field-exact-time');
    var dateField = document.getElementById('field-date');
    if (!warn || !timeInput) return true;

    var sNowEt = saratovNow();
    var todayStr = sNowEt.dateStr;
    var isToday = dateField && dateField.value === todayStr;

    if (!isToday) {
      warn.style.display = 'none';
      return true;
    }

    var parts = timeInput.value.split(':');
    var targetH = parseInt(parts[0]) || 0;
    var targetM = parseInt(parts[1]) || 0;
    var targetMinutes = targetH * 60 + targetM;
    var nowMinutes = sNowEt.hours * 60 + sNowEt.minutes;
    var diff = targetMinutes - nowMinutes;

    if (diff < 90) {
      warn.style.display = 'block';
      warn.textContent = 'Доставка невозможна менее чем за 1,5 часа. Выберите более позднее время или другую дату.';
      return false;
    } else {
      warn.style.display = 'none';
      return true;
    }
  };

  // ============================================================
  // Submit order + payment
  // ============================================================

  function buildDeliveryAddress() {
    var suggest = document.getElementById('field-addr-suggest');
    var apt = document.getElementById('field-addr-apt');
    var note = document.getElementById('field-addr-note');
    var parts = [];
    if (suggest && suggest.value.trim()) parts.push(suggest.value.trim());
    if (apt && apt.value.trim()) parts.push('кв./оф. ' + apt.value.trim());
    if (note && note.value.trim()) parts.push(note.value.trim());
    return parts.join(', ');
  }

  window.submitOrder = function (event) {
    if (event && event.preventDefault) event.preventDefault();
    var submitBtn = document.getElementById('checkout-submit');
    if (submitBtn && submitBtn.classList.contains('btn-dimmed')) return;

    var consentCb = document.getElementById('consent-cb');
    if (!consentCb || !consentCb.checked) {
      showToast('Подтвердите согласие на обработку персональных данных');
      return;
    }

    var cart = getCart();
    if (!cart.length) return;

    var isSelf = document.getElementById('self-receiver-cb') && document.getElementById('self-receiver-cb').checked;
    var tgVal = document.getElementById('field-tg') ? document.getElementById('field-tg').value.trim() : '';
    var phoneVal = document.getElementById('field-phone') ? document.getElementById('field-phone').value.trim() : '';
    var emailVal = document.getElementById('field-email') ? document.getElementById('field-email').value.trim() : '';
    var rcvName = isSelf ? tgVal : (document.getElementById('field-rcv-name') ? document.getElementById('field-rcv-name').value.trim() : '');
    var rcvPhone = isSelf ? phoneVal : (document.getElementById('field-rcv-phone') ? document.getElementById('field-rcv-phone').value.trim() : '');
    var dateVal = document.getElementById('field-date') ? document.getElementById('field-date').value : '';

    if (!isSelf && (!rcvName || !rcvPhone)) {
      showToast('Заполните данные получателя');
      return;
    }
    if (!isSelf && rcvPhone && !validatePhone(rcvPhone)) return;

    var data = {
      user_name: tgVal || phoneVal,
      user_phone: phoneVal,
      user_email: emailVal,
      user_telegram: tgVal,
      receiver_name: rcvName,
      receiver_phone: rcvPhone,
      delivery_address: (checkoutState.deliveryType === 'pickup')
        ? (appSettings.pickup_address || 'Самовывоз')
        : buildDeliveryAddress(),
      delivery_type: checkoutState.deliveryType,
      delivery_zone: '',
      delivery_cost: getDeliveryCost(),
      delivery_distance: checkoutState.deliveryDistance || 0,
      delivery_interval: checkoutState.exactTime
        ? ('Точно ко времени: ' + (document.getElementById('field-exact-time') ? document.getElementById('field-exact-time').value : ''))
        : (checkoutState.deliveryType === 'delivery' ? checkoutState.deliveryInterval : ''),
      delivery_date: dateVal,
      exact_time: checkoutState.exactTime ? (document.getElementById('field-exact-time') ? document.getElementById('field-exact-time').value : '') : '',
      comment: document.getElementById('field-comment') ? document.getElementById('field-comment').value.trim() : '',
      telegram_id: getTelegramId() || '',
      city_id: selectedCity ? selectedCity.id : null,
      items: cart.map(function (i) {
        return { product_id: i.product_id, quantity: i.quantity, price: i.price, flower_count: i.flower_count || 0, size_label: i.size_label || '' };
      })
    };

    var btn = document.getElementById('checkout-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Отправка...'; }

    postJSON('/api/orders', data).then(function (result) {
      if (!result.success) {
        if (btn) { btn.disabled = false; btn.textContent = 'Оформить заказ'; }
        showToast(result.error || 'Ошибка при создании заказа');
        return;
      }

      saveCart([]);
      clearCheckoutDraft();
      updateCartBadge();

      postJSON('/api/payments/create', { order_id: result.order_id }).then(function (pay) {
        if (pay && pay.payment_url) {
          showPaymentPage(result.order_id, pay.payment_url, result.total_amount);
        } else {
          showOrderSuccess(result.order_id);
        }
      }).catch(function () {
        showOrderSuccess(result.order_id);
      });
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Оформить заказ'; }
      console.error('Order error:', err);
      showToast('Ошибка: ' + (err.message || 'нет подключения к серверу'));
    });
  };

  function showPaymentPage(orderId, paymentUrl, totalAmount) {
    render(
      '<div class="section-title">Оплата заказа N ' + orderId + '</div>' +
      '<div style="margin-bottom:16px;font-size:14px;">' +
        '<p>Сумма к оплате: ' + formatPrice(totalAmount) + '</p>' +
      '</div>' +
      '<a href="' + escapeHtml(paymentUrl) + '" target="_blank" class="nav-btn nav-btn--filled" style="display:block;text-align:center;margin-bottom:16px;">Оплатить через СБП</a>' +
      '<button class="nav-btn" onclick="navigateTo(\'home\')">На главную</button>' +
      '<div style="margin-top:16px;font-size:12px;">' +
        '<p>После оплаты статус заказа обновится автоматически.</p>' +
      '</div>'
    );
    showToast('Заказ N ' + orderId + ' создан');
  }

  function showOrderSuccess(orderId) {
    render(
      '<div class="success-message">' +
        '<p>Заказ оформлен</p>' +
        '<div class="order-number">N ' + orderId + '</div>' +
        '<p>Мы свяжемся с вами для подтверждения.</p>' +
        '<button class="nav-btn" onclick="navigateTo(\'home\')" style="margin-top:20px">На главную</button>' +
      '</div>'
    );
    showToast('Заказ оформлен');
  }

  // ============================================================
  // Account
  // ============================================================

  function showAccount() {
    setActiveTab('account');
    if (!tgUser && !dbUser && !getTelegramId()) {
      render(
        '<div class="section-title">Профиль</div>' +
        '<div class="account-section">' +
          '<p>Откройте приложение через Telegram для доступа к профилю.</p>' +
        '</div>'
      );
      return;
    }

    var name = (dbUser && dbUser.first_name) || (tgUser && tgUser.first_name) || 'Пользователь';
    var lastName = (tgUser && tgUser.last_name) || '';
    var fullName = name + (lastName ? ' ' + lastName : '');
    var username = (tgUser && tgUser.username) || '';
    var photoUrl = (tgUser && tgUser.photo_url) || '';

    var avatarHtml = '';
    if (photoUrl) {
      avatarHtml = '<img src="' + escapeHtml(photoUrl) + '" class="profile-avatar" onerror="this.outerHTML=\'<div class=profile-avatar-placeholder>' + escapeHtml(name.charAt(0).toUpperCase()) + '</div>\'">';
    } else {
      avatarHtml = '<div class="profile-avatar-placeholder">' + escapeHtml(name.charAt(0).toUpperCase()) + '</div>';
    }

    render(
      '<div class="profile-header">' +
        avatarHtml +
        '<div class="profile-info">' +
          '<div class="profile-name">' + escapeHtml(fullName) + '<span id="admin-crown" class="admin-crown" style="display:none"></span><span id="admin-badge" style="display:none" class="admin-badge">ADMIN</span></div>' +
          (username ? '<div class="profile-username">@' + escapeHtml(username) + '</div>' : '') +
        '</div>' +
      '</div>' +

      '<div id="admin-panel-btn-wrap" style="display:none">' +
        '<button class="admin-panel-btn" onclick="openAdminPanel()">Админ-панель</button>' +
      '</div>' +

      '<div class="profile-section profile-tracking-section">' +
        '<div class="profile-section-header">' +
          '<span class="profile-section-title tracking-title">Заказы</span>' +
        '</div>' +
        '<div id="profile-tracking"><div class="empty-state" style="padding:12px">Загрузка...</div></div>' +
      '</div>' +

      '<div class="nav-buttons">' +
        '<button class="nav-btn" onclick="toggleProfileSection(\'addresses\')">Мои адреса</button>' +
        '<button class="nav-btn" onclick="toggleProfileSection(\'orders\')">История заказов</button>' +
      '</div>' +

      '<div id="section-addresses" class="profile-section" style="display:none">' +
        '<div class="profile-section-header">' +
          '<span class="profile-section-title">Мои адреса</span>' +
          '<button class="profile-add-btn" onclick="showAddAddress()">+ Добавить</button>' +
        '</div>' +
        '<div id="profile-addresses"><div class="empty-state" style="padding:12px">Загрузка...</div></div>' +
      '</div>' +

      '<div id="section-orders" class="profile-section" style="display:none">' +
        '<div class="profile-section-header">' +
          '<span class="profile-section-title">История заказов</span>' +
        '</div>' +
        '<div id="profile-orders"><div class="empty-state" style="padding:12px">Загрузка...</div></div>' +
      '</div>'
    );

    var telegramId = getTelegramId();
    var tgUsername = (tgUser && tgUser.username) || '';
    if (telegramId) {
      var adminUrl = '/api/user/is-admin?telegram_id=' + telegramId;
      if (tgUsername) adminUrl += '&username=' + encodeURIComponent(tgUsername);
      fetchJSON(adminUrl).then(function (data) {
        if (data && data.is_admin) {
          var badge = document.getElementById('admin-badge');
          if (badge) badge.style.display = 'inline-block';
          if (data.is_super_admin) {
            var crown = document.getElementById('admin-crown');
            if (crown) {
              crown.style.display = 'inline-flex';
              crown.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#000" d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>';
            }
          }
          var btnWrap = document.getElementById('admin-panel-btn-wrap');
          if (btnWrap) btnWrap.style.display = 'block';
        }
      }).catch(function () {});
    }

    loadProfileTracking();
    stopTrackingPoll();
    trackingPollInterval = setInterval(function () {
      if (activeTab === 'account' && document.getElementById('profile-tracking')) {
        loadProfileTracking();
      } else {
        stopTrackingPoll();
      }
    }, 10000);
  }

  window.openAdminPanel = function () {
    var telegramId = getTelegramId();
    if (telegramId) {
      var url = '/admin.html?tg_auth=' + telegramId;
      var username = (tgUser && tgUser.username) || '';
      if (username) url += '&tg_user=' + encodeURIComponent(username);
      window.location.href = url;
    }
  };

  var TRACK_STEPS_DELIVERY = ['Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Доставлен'];
  var TRACK_STEPS_PICKUP = ['Оплачен', 'Собирается', 'Готов к выдаче'];

  function getTrackSteps(order) {
    return order.delivery_type === 'pickup' ? TRACK_STEPS_PICKUP : TRACK_STEPS_DELIVERY;
  }

  function isFinalStatus(order) {
    if (order.status === 'Выполнен') return true;
    if (order.delivery_type === 'pickup') return order.status === 'Готов к выдаче';
    return order.status === 'Доставлен';
  }

  function shouldShowInTracking(order) {
    if (order.status === 'Выполнен') return false;
    if (!isFinalStatus(order)) return true;
    var created = new Date(order.status_updated_at || order.created_at);
    var now = new Date();
    var daysSince = (now - created) / (1000 * 60 * 60 * 24);
    return daysSince < 7;
  }

  function loadProfileTracking() {
    var telegramId = getTelegramId();
    if (!telegramId) return;
    fetchJSON('/api/user/orders?telegram_id=' + telegramId).then(function (orders) {
      var el = document.getElementById('profile-tracking');
      if (!el) return;
      if (!orders || !orders.length) {
        el.innerHTML = '<div class="empty-state" style="padding:12px">Активных заказов нет</div>';
        return;
      }
      var active = orders.filter(shouldShowInTracking);
      if (!active.length) {
        el.innerHTML = '<div class="empty-state" style="padding:12px">Все заказы выполнены</div>';
        return;
      }
      var deliveryOrders = active.filter(function (o) { return o.delivery_type !== 'pickup'; });
      var pickupOrders = active.filter(function (o) { return o.delivery_type === 'pickup'; });

      function renderMiniCard(o) {
        var steps = getTrackSteps(o);
        var currentIdx = steps.indexOf(o.status);
        if (o.status === 'Выполнен') currentIdx = steps.length - 1;
        else if (currentIdx < 0) currentIdx = -1;
        var timelineHtml = '';
        steps.forEach(function (step, idx) {
          if (idx > 0) timelineHtml += '<div class="timeline-line' + (idx <= currentIdx ? ' filled' : '') + '"></div>';
          var cls = 'timeline-step';
          if (idx < currentIdx) cls += ' done';
          if (idx === currentIdx) cls += ' current';
          timelineHtml += '<div class="' + cls + '"><div class="timeline-dot"></div><div class="timeline-label">' + escapeHtml(step) + '</div></div>';
        });
        var isPickup = o.delivery_type === 'pickup';
        var timeInfo = '';
        if (isPickup && o.delivery_date) {
          timeInfo = '<div class="track-time-info">Готовность: ' + escapeHtml(o.delivery_date) +
            (o.delivery_interval ? ', ' + escapeHtml(o.delivery_interval) : '') + '</div>';
        } else if (!isPickup && o.delivery_date) {
          timeInfo = '<div class="track-time-info">Доставка: ' + escapeHtml(o.delivery_date) +
            (o.exact_time ? ' к ' + escapeHtml(o.exact_time) : (o.delivery_interval ? ', ' + escapeHtml(o.delivery_interval) : '')) + '</div>';
        }
        var itemsList = '';
        if (o.items && o.items.length) {
          itemsList = o.items.map(function (i) {
            var s = escapeHtml(i.product_name || 'Товар');
            if (i.size_label) s += ' [' + escapeHtml(i.size_label) + ']';
            s += ' × ' + i.quantity + ' — ' + formatPrice(i.price * i.quantity);
            return '<div class="track-order-item">' + s + '</div>';
          }).join('');
        }

        var addressInfo = '';
        if (isPickup) {
          addressInfo = '<div class="track-detail-row"><span class="track-detail-label">Самовывоз</span></div>';
        } else if (o.delivery_address) {
          addressInfo = '<div class="track-detail-row"><span class="track-detail-label">Адрес:</span> ' + escapeHtml(o.delivery_address) + '</div>';
        }
        var receiverInfo = '';
        if (o.receiver_name) {
          receiverInfo = '<div class="track-detail-row"><span class="track-detail-label">Получатель:</span> ' + escapeHtml(o.receiver_name) + (o.receiver_phone ? ', ' + escapeHtml(o.receiver_phone) : '') + '</div>';
        }

        return '<div class="track-card-mini" onclick="toggleOrderDetail(this)">' +
          '<div class="track-header"><span class="track-id">Заказ #' + o.id + '</span><span class="track-status-badge">' + escapeHtml(o.status) + '</span></div>' +
          '<div class="track-status-row"><span class="track-total">' + formatPrice(o.total_amount) + '</span></div>' +
          timeInfo +
          '<div class="timeline">' + timelineHtml + '</div>' +
          '<div class="track-order-details" style="display:none">' +
            addressInfo +
            receiverInfo +
            (o.comment ? '<div class="track-detail-row"><span class="track-detail-label">Комментарий:</span> ' + escapeHtml(o.comment) + '</div>' : '') +
            '<div class="track-detail-items-title">Состав заказа:</div>' +
            itemsList +
            (o.delivery_cost ? '<div class="track-detail-row" style="margin-top:6px"><span class="track-detail-label">Доставка:</span> ' + formatPrice(o.delivery_cost) + '</div>' : '') +
          '</div>' +
        '</div>';
      }

      var html = '';
      if (deliveryOrders.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">Доставка</div>' +
          deliveryOrders.map(renderMiniCard).join('') +
        '</div>';
      }
      if (pickupOrders.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">Самовывоз</div>' +
          pickupOrders.map(renderMiniCard).join('') +
        '</div>';
      }
      el.innerHTML = html;
    });
  }

  function loadProfileAddresses() {
    var telegramId = getTelegramId();
    if (!telegramId) return;
    fetchJSON('/api/user/addresses?telegram_id=' + telegramId).then(function (addrs) {
      var el = document.getElementById('profile-addresses');
      if (!el) return;
      window._savedAddresses = addrs || [];
      if (!addrs || !addrs.length) {
        el.innerHTML = '<div class="empty-state" style="padding:12px">Нет сохранённых адресов</div>';
        return;
      }
      el.innerHTML = addrs.map(function (a) {
        return '<div class="saved-addr-card">' +
          '<div class="saved-addr-text">' +
            (a.label ? '<strong>' + escapeHtml(a.label) + '</strong><br>' : '') +
            escapeHtml(a.full_address) +
          '</div>' +
          '<button class="saved-addr-del" onclick="deleteAddress(' + a.id + ')">&#10005;</button>' +
        '</div>';
      }).join('');
    });
  }

  function loadProfileOrders() {
    var telegramId = getTelegramId();
    if (!telegramId) return;
    fetchJSON('/api/user/orders?telegram_id=' + telegramId).then(function (orders) {
      var el = document.getElementById('profile-orders');
      if (!el) return;
      if (!orders || !orders.length) {
        el.innerHTML = '<div class="empty-state" style="padding:12px">Заказов пока нет</div>';
        return;
      }
      el.innerHTML = orders.map(function (o) {
        return '<div class="order-card-mini">' +
          '<div class="order-card-header">' +
            '<span class="order-card-id">N ' + o.id + '</span>' +
            '<span class="order-card-status">' + escapeHtml(o.status) + '</span>' +
          '</div>' +
          '<div class="order-card-date">' + formatDate(o.created_at) + '</div>' +
          '<div class="order-card-total">' + formatPrice(o.total_amount) + '</div>' +
        '</div>';
      }).join('');
    });
  }

  window.toggleProfileMenu = function () {
    var menu = document.getElementById('profile-menu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  };

  window.toggleOrderDetail = function (card) {
    var details = card.querySelector('.track-order-details');
    if (!details) return;
    var isHidden = details.style.display === 'none';
    details.style.display = isHidden ? 'block' : 'none';
  };

  window.toggleProfileSection = function (section) {
    var el = document.getElementById('section-' + section);
    if (!el) return;
    var isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      if (section === 'addresses') loadProfileAddresses();
      if (section === 'orders') loadProfileOrders();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.showAddAddress = function () {
    var el = document.getElementById('profile-addresses');
    if (!el) return;
    var cityName = selectedCity ? selectedCity.name : '';
    el.innerHTML =
      '<div class="add-addr-form">' +
        '<div class="form-group"><label>Название (напр. Дом, Работа)</label>' +
        '<input type="text" id="addr-label" placeholder="Дом"></div>' +
        '<div class="form-group"><label>Город</label>' +
        '<input type="text" id="addr-city" value="' + escapeHtml(cityName) + '" placeholder="Город"></div>' +
        '<div class="form-group"><label>Район</label>' +
        '<input type="text" id="addr-district" placeholder="Район"></div>' +
        '<div class="form-group"><label>Улица, дом</label>' +
        '<input type="text" id="addr-street" placeholder="Улица, дом"></div>' +
        '<div class="form-group"><label>Квартира / офис</label>' +
        '<input type="text" id="addr-apt" placeholder="Квартира, подъезд, этаж"></div>' +
        '<div class="form-group"><label>Дополнение</label>' +
        '<input type="text" id="addr-note" placeholder="Код домофона, ориентиры"></div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="nav-btn" onclick="saveNewAddress()">Сохранить</button>' +
          '<button class="nav-btn" style="background:#eee;color:#000" onclick="loadProfileAddresses()">Отмена</button>' +
        '</div>' +
      '</div>';
  };

  window.saveNewAddress = function () {
    var telegramId = getTelegramId();
    if (!telegramId) return;
    var district = document.getElementById('addr-district').value.trim();
    var street = document.getElementById('addr-street').value.trim();
    var apt = document.getElementById('addr-apt').value.trim();
    if (!district || !street || !apt) { showToast('Заполните район, улицу и квартиру'); return; }
    postJSON('/api/user/addresses', {
      telegram_id: telegramId,
      label: document.getElementById('addr-label').value.trim(),
      city: document.getElementById('addr-city').value.trim(),
      district: district,
      street: street,
      apartment: apt,
      note: document.getElementById('addr-note').value.trim()
    }).then(function () {
      showToast('Адрес сохранён');
      loadProfileAddresses();
    });
  };

  window.deleteAddress = function (id) {
    fetch('/api/user/addresses/' + id, { method: 'DELETE' }).then(function (r) { return r.json(); }).then(function () {
      showToast('Адрес удалён');
      loadProfileAddresses();
    });
  };

  window.showOrderHistory = function () {
    var telegramId = getTelegramId();
    if (!telegramId) return;

    render(
      '<span class="back-link" onclick="navigateTo(\'account\')">К кабинету</span>' +
      '<div class="section-title">История заказов</div>' +
      '<div id="order-history">Загрузка...</div>'
    );

    fetchJSON('/api/user/orders?telegram_id=' + telegramId).then(function (orders) {
      var el = document.getElementById('order-history');
      if (!orders || !orders.length) {
        el.innerHTML = '<div class="empty-state">Заказов пока нет</div>';
        return;
      }
      var deliveryHist = orders.filter(function (o) { return o.delivery_type !== 'pickup'; });
      var pickupHist = orders.filter(function (o) { return o.delivery_type === 'pickup'; });

      function renderHistCard(o) {
        var itemsHtml = '';
        if (o.items && o.items.length) {
          itemsHtml = '<div class="order-card-items">' +
            o.items.map(function (i) {
              var sizeTag = i.size_label ? ' [' + i.size_label + ']' : '';
              var fcTag = i.flower_count ? ' (' + pluralFlower(i.flower_count) + ')' : '';
              return '<div>' + escapeHtml(i.product_name || 'Товар') + sizeTag + fcTag + ' x' + i.quantity + ' — ' + formatPrice(i.price * i.quantity) + '</div>';
            }).join('') + '</div>';
        }
        return '<div class="order-card">' +
          '<div class="order-card-header">' +
            '<span class="order-card-id">#' + o.id + '</span>' +
            '<span class="order-card-status">' + escapeHtml(o.status) + '</span>' +
          '</div>' +
          '<div class="order-card-date">' + formatDate(o.created_at) + '</div>' +
          itemsHtml +
          '<div class="order-card-total">' + formatPrice(o.total_amount) + '</div>' +
        '</div>';
      }

      var html = '';
      if (deliveryHist.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">Доставка <span class="orders-split-count">' + deliveryHist.length + '</span></div>' +
          '<div class="order-history">' + deliveryHist.map(renderHistCard).join('') + '</div>' +
        '</div>';
      }
      if (pickupHist.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">Самовывоз <span class="orders-split-count">' + pickupHist.length + '</span></div>' +
          '<div class="order-history">' + pickupHist.map(renderHistCard).join('') + '</div>' +
        '</div>';
      }
      if (!html) html = '<div class="empty-state">Заказов пока нет</div>';
      el.innerHTML = html;
    });
  };

  window.showProfileEdit = function () {
    var phone = (dbUser && dbUser.phone) || '';
    var addr = (dbUser && dbUser.default_address) || '';

    render(
      '<span class="back-link" onclick="navigateTo(\'account\')">К кабинету</span>' +
      '<div class="section-title">Мои данные</div>' +
      '<form class="order-form" onsubmit="saveProfile(event)">' +
        '<div class="form-group"><label>Телефон</label>' +
        '<input type="tel" id="profile-phone" value="' + escapeHtml(phone) + '" placeholder="+7 (___) ___-__-__" oninput="formatPhoneInput(this)" maxlength="18"></div>' +
        '<div class="form-group"><label>Адрес по умолчанию</label>' +
        '<input type="text" id="profile-address" value="' + escapeHtml(addr) + '" placeholder="Город, улица, дом, квартира"></div>' +
        '<button type="submit" class="nav-btn">Сохранить</button>' +
      '</form>'
    );
  };

  window.saveProfile = function (event) {
    event.preventDefault();
    var telegramId = getTelegramId();
    if (!telegramId) return;
    postJSON('/api/user/update', {
      telegram_id: telegramId,
      phone: document.getElementById('profile-phone').value.trim(),
      default_address: document.getElementById('profile-address').value.trim()
    }).then(function (r) {
      if (r && r.user) {
        dbUser = r.user;
        try { localStorage.setItem('arka_user', JSON.stringify(r.user)); } catch (e) {}
        showToast('Данные сохранены');
        navigateTo('account');
      }
    });
  };

  // ============================================================
  // Delivery tracking
  // ============================================================

  window.showDeliveryTracking = function () {
    var telegramId = getTelegramId();

    if (!telegramId) {
      render(
        '<span class="back-link" onclick="navigateTo(\'account\')">К профилю</span>' +
        '<div class="section-title">Заказы</div>' +
        '<div class="empty-state">Откройте приложение через Telegram для отслеживания заказов.</div>'
      );
      return;
    }

    render(
      '<span class="back-link" onclick="navigateTo(\'account\')">К профилю</span>' +
      '<div class="section-title">Заказы</div>' +
      '<div id="delivery-list"><div class="empty-state">Загрузка...</div></div>'
    );

    fetchJSON('/api/user/orders?telegram_id=' + telegramId).then(function (orders) {
      var el = document.getElementById('delivery-list');
      if (!el) return;
      if (!orders || !orders.length) {
        el.innerHTML = '<div class="empty-state">У вас пока нет заказов</div>';
        return;
      }

      var deliveryOrders = orders.filter(function (o) { return o.delivery_type !== 'pickup'; });
      var pickupOrders = orders.filter(function (o) { return o.delivery_type === 'pickup'; });

      function renderFullCard(o) {
        var steps = getTrackSteps(o);
        var currentIdx = steps.indexOf(o.status);
        if (o.status === 'Выполнен') currentIdx = steps.length - 1;
        else if (currentIdx < 0) currentIdx = -1;

        var timelineHtml = '';
        steps.forEach(function (step, idx) {
          if (idx > 0) {
            timelineHtml += '<div class="timeline-line' + (idx <= currentIdx ? ' filled' : '') + '"></div>';
          }
          var cls = 'timeline-step';
          if (idx < currentIdx) cls += ' done';
          if (idx === currentIdx) cls += ' current';
          timelineHtml += '<div class="' + cls + '">' +
            '<div class="timeline-dot"></div>' +
            '<div class="timeline-label">' + escapeHtml(step) + '</div>' +
          '</div>';
        });

        var itemsHtml = '';
        if (o.items && o.items.length) {
          itemsHtml = '<div class="track-items">' +
            o.items.map(function (i) {
              var sizeTag = i.size_label ? ' [' + i.size_label + ']' : '';
              var fcTag = i.flower_count ? ' (' + pluralFlower(i.flower_count) + ')' : '';
              return '<div>' + escapeHtml(i.product_name || 'Товар') + sizeTag + fcTag + ' x' + i.quantity + ' — ' + formatPrice(i.price * i.quantity) + '</div>';
            }).join('') + '</div>';
        }

        var isPickup = o.delivery_type === 'pickup';
        var timeInfo = '';
        if (isPickup && o.delivery_date) {
          timeInfo = '<div class="track-time-info">Готовность: ' + escapeHtml(o.delivery_date) +
            (o.delivery_interval ? ', ' + escapeHtml(o.delivery_interval) : '') + '</div>';
        } else if (!isPickup) {
          var parts = [];
          if (o.delivery_date) parts.push(escapeHtml(o.delivery_date));
          if (o.exact_time) parts.push('к ' + escapeHtml(o.exact_time));
          else if (o.delivery_interval) parts.push(escapeHtml(o.delivery_interval));
          if (parts.length) timeInfo = '<div class="track-time-info">' + parts.join(', ') + '</div>';
        }

        return '<div class="track-card">' +
          '<div class="track-header">' +
            '<span class="track-id">Заказ #' + o.id + '</span>' +
            '<span class="track-status-badge">' + escapeHtml(o.status) + '</span>' +
          '</div>' +
          '<div class="track-amount">' + formatPrice(o.total_amount) + '</div>' +
          timeInfo +
          '<div class="timeline">' + timelineHtml + '</div>' +
          itemsHtml +
        '</div>';
      }

      var html = '';
      if (deliveryOrders.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">Доставка <span class="orders-split-count">' + deliveryOrders.length + '</span></div>' +
          deliveryOrders.map(renderFullCard).join('') +
        '</div>';
      }
      if (pickupOrders.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">Самовывоз <span class="orders-split-count">' + pickupOrders.length + '</span></div>' +
          pickupOrders.map(renderFullCard).join('') +
        '</div>';
      }
      if (!html) html = '<div class="empty-state">У вас пока нет заказов</div>';
      el.innerHTML = html;
    });
  };

  // ============================================================
  // Favorites page
  // ============================================================

  function showFavorites() {
    setActiveTab('favorites');
    var favIds = getFavorites();

    if (!favIds.length) {
      render(
        '<div class="category-title">Избранное</div>' +
        '<div class="empty-state">Вы пока ничего не добавили в избранное</div>'
      );
      return;
    }

    render(
      '<div class="category-title">Избранное</div>' +
      '<div class="product-list" id="fav-product-list"><div class="empty-state">Загрузка...</div></div>'
    );

    fetchJSON('/api/products').then(function (prods) {
      var el = document.getElementById('fav-product-list');
      if (!el) return;
      var favProds = (prods || []).filter(function (p) { return favIds.indexOf(p.id) >= 0; });
      if (!favProds.length) {
        el.innerHTML = '<div class="empty-state">Товары не найдены</div>';
        return;
      }
      el.innerHTML = favProds.map(buildProductCard).join('');
    });
  }

  // ============================================================
  // Static pages
  // ============================================================

  function showPageOrder() {
    render(
      '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span>' +
      '<div class="static-page">' +
        '<h2>О заказе</h2>' +
        '<p>Мы осуществляем доставку по г. Саратову, Энгельсу и его окрестностям.</p>' +
        '<p>Заказы принимаются c 10:00 до 21:00, но доставку мы можем осуществлять круглосуточно при оформлении заказа в рабочее время. Оформить заказ можно заранее (на конкретную дату).</p>' +
        '<h3>Стоимость доставки по районам</h3>' +
        '<ul>' +
          '<li>г. Саратов (Ленинский, Кировский, Фрунзенский, Заводской, Волжский, Октябрьский р-ны) — 350 р.</li>' +
          '<li>г. Энгельс — 450 р.</li>' +
          '<li>Окрестности г. Саратова и Энгельса (в т.ч. Гагаринский р-н г. Саратова) — 1000 р.</li>' +
        '</ul>' +
        '<p>Перед доставкой заказа в рабочее время наши менеджеры контакт-центра созваниваются с получателем заказа и уточняют адрес и подходящее время доставки.</p>' +
        '<h3>Самовывоз</h3>' +
        '<p>В нашем магазине «Arka Flowers» по адресу г. Саратов, 3-й Дегтярный проезд, 21к3.</p>' +
        '<h3>Доставка в праздничные дни</h3>' +
        '<p>Интервал доставки 3 часа. При указании точного времени заказ будет доставлен в интервале ±1,5 часа. Стоимость доставки точно ко времени 1000 руб. (укажите в заказе).</p>' +
        '<p>Если получателя не окажется по указанному адресу, курьер возвращает букет в салон. Повторная доставка осуществляется в случае доплаты за выезд курьера. По истечении 24 часов с момента несостоявшейся доставки заказ оплачивается повторно, поскольку цветы являются скоропортящимся товаром. Если вы отказываетесь от повторной доставки, стоимость заказа не возвращается.</p>' +
        '<p>Пользуясь сайтом, вы соглашаетесь с тем, что при заказе цветок в букете может быть заменён на подобный по таким параметрам, как цветовая гамма или рисунок цветка. А также мы обязуемся восполнить недостающий цветок другим по стоимости выбранного букета.</p>' +
        '<p>В случае если вы не знаете адрес получателя, а знаете только телефон — перед доставкой заказа наши менеджеры контакт-центра созваниваются с получателем и уточняют адрес и подходящее время доставки.</p>' +
      '</div>'
    );
  }

  function showPagePayment() {
    render(
      '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span>' +
      '<div class="static-page">' +
        '<h2>Об оплате</h2>' +
        '<h3>Онлайн</h3>' +
        '<ul>' +
          '<li>Банковские карты: Visa, MasterCard, Maestro, Мир</li>' +
          '<li>Электронные деньги: Яндекс.Деньги, WebMoney, QIWI Кошелёк</li>' +
          '<li>Интернет-банкинг: Сбербанк Онлайн, Альфа-Клик, Интернет-банк Промсвязьбанка, MasterPass</li>' +
          '<li>QR-код</li>' +
        '</ul>' +
        '<h3>Дополнительно</h3>' +
        '<p>Безналичным расчётом (выставление счёта по вашим реквизитам).</p>' +
        '<p>Возврат денежных средств в случае безналичной оплаты производится в течение 3–4 рабочих дней.</p>' +
      '</div>'
    );
  }

  function showReturns() {
    render(
      '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span>' +
      '<div class="static-page">' +
        '<h2>Условия возврата</h2>' +
        '<h3>1. Отказ от заказа и возврат товара</h3>' +
        '<p>1.1. Клиент вправе отказаться от заказа до момента передачи товара курьеру. После передачи товара курьеру заказ считается принятым к исполнению, и отмена невозможна.</p>' +
        '<p>1.2. Цветочная продукция относится к категории скоропортящихся товаров (п. 27 Перечня, утв. Постановлением Правительства РФ № 2463), в связи с чем возврат товара надлежащего качества после его передачи получателю невозможен.</p>' +
        '<h3>2. Отсутствие получателя по адресу</h3>' +
        '<p>2.1. В случае отсутствия получателя по указанному адресу курьер фиксирует невозможность вручения.</p>' +
        '<p>2.2. Клиент/получатель может запросить повторную доставку. Повторная доставка оплачивается дополнительно согласно действующим тарифам.</p>' +
        '<p>2.3. Если получатель может принять заказ только в другой день, компания вправе предложить изготовление нового свежего букета к согласованной дате. Возврат денежных средств за первоначально изготовленный букет не производится.</p>' +
        '<h3>3. Изменения в заказе</h3>' +
        '<p>3.1. После начала выполнения заказа (сборки букета) отмена и возврат средств невозможны.</p>' +
        '<p>3.2. Изменение даты/времени доставки после начала сборки также не является основанием для возврата средств.</p>' +
        '<h3>4. Приём товара и рекламации по качеству</h3>' +
        '<p>4.1. Клиент обязан осмотреть товар в момент получения. Рекламации по качеству принимаются в течение 30 минут с момента вручения.</p>' +
        '<p>4.2. Для подачи рекламации необходимо предоставить: подробное описание проблемы, фотографии букета с разных ракурсов, фото упаковки.</p>' +
        '<p>4.3. Arka Flowers рассматривает рекламацию в течение 6 часов и предоставляет ответ.</p>' +
        '<p>4.4. Если будет подтверждён факт передачи товара ненадлежащего качества, компания предоставляет: замену букета или возврат денежных средств в пределах стоимости заказа.</p>' +
        '<p>4.5. Если клиент оставил букет у себя, поместил в вазу, изменил условия хранения или состояние товара, что могло привести к его увяданию, такие претензии не рассматриваются, за исключением случаев явной порчи цветка.</p>' +
        '<h3>5. Доставка сторонней курьерской службой</h3>' +
        '<p>5.1. Ответственность за факт качественного изготовления букета несёт Arka Flowers.</p>' +
        '<p>5.2. Время доставки может отличаться от предварительного по причинам логистики. Это не является основанием для возврата средств.</p>' +
        '<h3>6. Оплата и возврат денежных средств</h3>' +
        '<p>6.1. При оплате банковскими картами возврат средств осуществляется только на ту же карту, с которой была произведена оплата. Возврат наличными при безналичной оплате не допускается.</p>' +
        '<p>6.2. В случае ошибочного списания средств необходимо направить письменное заявление и приложить копии паспорта и чеков. Срок рассмотрения заявления и возврата средств — до 2 рабочих дней.</p>' +
      '</div>'
    );
  }

  function showPageCare() {
    render(
      '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span>' +
      '<div class="static-page">' +
        '<h2>Рекомендации по уходу</h2>' +
        '<p>Нам важно, чтобы букет радовал вас как можно дольше. Цветы — живой и очень хрупкий материал, поэтому так важно ухаживать за букетом, чтобы продлить цветам срок жизни.</p>' +
        '<h3>Уход за букетом</h3>' +
        '<ol>' +
          '<li>Снимите красивую упаковку с букета.</li>' +
          '<li>Переставьте его из аквабокса в вазу с проточной прохладной водой, добавьте удобрение из пакетика.</li>' +
          '<li>Регулярно меняйте цветам воду и освежайте срез острым ножом или секатором.</li>' +
          '<li>Держите цветы вдали от сквозняка, прямых солнечных лучей, отопительных приборов.</li>' +
          '<li>Не используйте для подрезания цветов ножницы.</li>' +
        '</ol>' +
        '<h3>Уход за композицией на губке</h3>' +
        '<ol>' +
          '<li>Не допускайте пересыхания губки: подливайте раз в день половину или полный стакан проточной воды в центр композиции в зависимости от её размера.</li>' +
          '<li>Держите цветы вдали от сквозняка, прямых солнечных лучей, отопительных приборов.</li>' +
          '<li>По мере увядания цветов удаляйте их из композиции — это продлит жизнь другим растениям.</li>' +
        '</ol>' +
      '</div>'
    );
  }

  function showPageOffer() {
    render(
      '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span>' +
      '<div class="static-page">' +
        '<h2>Публичная оферта</h2>' +
        '<h3>1. Общие положения</h3>' +
        '<p>1.1. Настоящий документ является официальным предложением (публичной офертой) Индивидуального предпринимателя Жаргаловой Милены Александровны (далее — «Продавец») заключить договор розничной купли-продажи товаров дистанционным способом через сайт arkaflowers.shop.</p>' +
        '<p>1.2. В соответствии со статьями 435–437 Гражданского кодекса РФ оформление Заказа и его оплата Покупателем означает полное и безоговорочное принятие (акцепт) условий настоящей Оферты.</p>' +
        '<p>1.3. Оферта действует в отношении любого лица, оформившего заказ на сайте.</p>' +
        '<h3>2. Сведения о Продавце</h3>' +
        '<p>Индивидуальный предприниматель Жаргалова Милена Александровна<br>' +
        'ИНН: 380455657342<br>' +
        'ОГРНИП: 322645700026683<br>' +
        'Адрес: Ул. им. Пугачёва, д. 49а, кв. 147<br>' +
        'Телефон: +7 (996) 122-05-70<br>' +
        'Email: arkaflowers@bk.ru</p>' +
        '<h3>3. Предмет договора</h3>' +
        '<p>3.1. Продавец обязуется передать в собственность Покупателя цветочную продукцию (букеты, композиции, подарки), представленную на сайте, а Покупатель обязуется оплатить и принять товар.</p>' +
        '<p>3.2. Внешний вид букета может незначительно отличаться от изображения на сайте в зависимости от сезонности и наличия цветов, при сохранении общей стилистики и ценовой категории.</p>' +
        '<h3>4. Оформление заказа</h3>' +
        '<p>4.1. Заказ оформляется Покупателем самостоятельно через сайт.</p>' +
        '<p>4.2. Покупатель обязан предоставить достоверную информацию (имя, телефон, адрес доставки).</p>' +
        '<p>4.3. После оформления заказа Продавец связывается с Покупателем для подтверждения деталей доставки и состава букета.</p>' +
        '<p>4.4. Продавец вправе заменить отдельные цветы в букете при отсутствии необходимых позиций, предварительно согласовав замену с Покупателем.</p>' +
        '<h3>5. Цена и оплата</h3>' +
        '<p>5.1. Цены на товары указаны в рублях Российской Федерации.</p>' +
        '<p>5.2. Оплата заказа осуществляется онлайн на сайте либо иным способом, доступным на сайте.</p>' +
        '<p>5.3. Заказ считается оплаченным с момента поступления денежных средств Продавцу.</p>' +
        '<h3>6. Доставка и самовывоз</h3>' +
        '<p>6.1. Доставка осуществляется по г. Саратову и г. Энгельсу.</p>' +
        '<p>6.2. Стоимость доставки по городу составляет от 350 рублей и указывается при оформлении заказа.</p>' +
        '<p>6.3. Сроки и временные интервалы доставки согласовываются при подтверждении заказа.</p>' +
        '<p>6.4. Возможен самовывоз из офлайн-магазина Продавца в часы его работы.</p>' +
        '<p>6.5. Риск случайной гибели или повреждения товара переходит к Покупателю с момента передачи товара получателю.</p>' +
        '<h3>7. Возврат и претензии</h3>' +
        '<p>7.1. В соответствии с Постановлением Правительства РФ №2463, срезанные цветы и букеты надлежащего качества обмену и возврату не подлежат.</p>' +
        '<p>7.2. Претензии по качеству товара принимаются в момент получения либо в течение 30 минут после передачи товара при наличии фотофиксации.</p>' +
        '<p>7.3. Возврат денежных средств возможен только в случае подтверждённого ненадлежащего качества товара.</p>' +
        '<p>7.4. В случае отсутствия получателя по адресу доставки повторная доставка осуществляется за дополнительную плату.</p>' +
        '<h3>8. Ответственность сторон</h3>' +
        '<p>8.1. Продавец не несёт ответственности за субъективное несоответствие ожиданий Покупателя и фактического внешнего вида букета.</p>' +
        '<p>8.2. Продавец освобождается от ответственности за неисполнение обязательств вследствие форс-мажорных обстоятельств.</p>' +
        '<h3>9. Персональные данные</h3>' +
        '<p>9.1. Оформляя заказ, Покупатель даёт согласие на обработку персональных данных в соответствии с Политикой конфиденциальности и обработки персональных данных, размещённой на сайте.</p>' +
        '<p>9.2. Обработка персональных данных осуществляется в соответствии с ФЗ №152-ФЗ.</p>' +
        '<h3>10. Заключительные положения</h3>' +
        '<p>10.1. Продавец вправе вносить изменения в настоящую Оферту в одностороннем порядке.</p>' +
        '<p>10.2. Актуальная версия Оферты размещается на сайте arkaflowers.shop.</p>' +
        '<p>10.3. Настоящая Оферта действует бессрочно.</p>' +
      '</div>'
    );
  }

  // ============================================================
  // Navigation
  // ============================================================

  window.navigateTo = function (page, param) {
    if (page !== 'account') stopTrackingPoll();
    updateCartBadge();
    updateFavBadge();
    switch (page) {
      case 'home': showHome(); break;
      case 'catalog': showCatalog(); break;
      case 'products': showProducts(param); break;
      case 'product': showProduct(param); break;
      case 'favorites': showFavorites(); break;
      case 'cart': showCart(); break;
      case 'checkout': showCheckout(); break;
      case 'account': showAccount(); break;
      case 'page-order': showPageOrder(); break;
      case 'page-payment': showPagePayment(); break;
      case 'page-returns': showReturns(); break;
      case 'page-care': showPageCare(); break;
      case 'page-offer': showPageOffer(); break;
      default: showHome();
    }
  };

  // ============================================================
  // Global handlers
  // ============================================================

  window.switchCardSize = function (event, productId, btn, price, dims) {
    event.stopPropagation();
    var row = btn.parentElement;
    var btns = row.querySelectorAll('.card-size-btn');
    btns.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    var priceEl = document.getElementById('card-price-' + productId);
    if (priceEl) priceEl.textContent = formatPrice(price);
    var dimsEl = document.getElementById('card-dims-' + productId);
    if (dimsEl) {
      if (dims) {
        dimsEl.textContent = dims;
        dimsEl.style.display = '';
      } else {
        dimsEl.style.display = 'none';
      }
    }
  };

  window.addToCartById = function (productId, event) {
    if (event) event.stopPropagation();
    var selectedIdx = 0;
    var card = event && event.target ? event.target.closest('.product-card') : null;
    if (card) {
      var activeBtn = card.querySelector('.card-size-btn.active');
      if (activeBtn && activeBtn.getAttribute('data-idx')) {
        selectedIdx = parseInt(activeBtn.getAttribute('data-idx')) || 0;
      }
    }
    fetchJSON('/api/products/' + productId).then(function (p) {
      if (p && !p.error) {
        var sizeObj = null;
        if (p.sizes && p.sizes.length) {
          sizeObj = p.sizes[selectedIdx] || p.sizes[0];
        }
        addToCart(p, sizeObj);
      }
    });
  };

  window.addToCartWithSize = function (productId, event) {
    if (event) event.stopPropagation();
    var p = window._currentProduct;
    if (!p || p.id !== productId) {
      window.addToCartById(productId, event);
      return;
    }
    var sizeObj = null;
    if (p.sizes && p.sizes.length) {
      var activeBtn = document.querySelector('#size-selector .size-btn.active');
      if (activeBtn) {
        sizeObj = {
          id: parseInt(activeBtn.getAttribute('data-size-id')),
          label: activeBtn.getAttribute('data-label'),
          price: parseInt(activeBtn.getAttribute('data-price')),
          flower_count: parseInt(activeBtn.getAttribute('data-fc')),
          dimensions: activeBtn.getAttribute('data-dims') || ''
        };
      } else {
        sizeObj = p.sizes[0];
      }
    }
    addToCart(p, sizeObj);
  };

  window.selectSize = function (btn, productId) {
    var btns = document.querySelectorAll('#size-selector .size-btn');
    btns.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    var price = parseInt(btn.getAttribute('data-price'));
    var fc = parseInt(btn.getAttribute('data-fc'));
    var dims = btn.getAttribute('data-dims') || '';
    var priceEl = document.getElementById('detail-price');
    if (priceEl) priceEl.textContent = formatPrice(price);
    var infoEl = document.getElementById('size-info');
    if (infoEl) {
      var text = pluralFlower(fc);
      if (dims) text += ' · ' + dims;
      infoEl.textContent = text;
    }
  };

  window.formatPhoneInput = function (input) {
    var raw = input.value;
    var digits = raw.replace(/\D/g, '');
    if (digits.length === 0) { input.value = ''; input._prevDC = 0; input._prevFL = 0; return; }
    if (digits[0] === '8') digits = '7' + digits.slice(1);
    if (digits[0] !== '7') digits = '7' + digits;
    if (digits.length <= 1) { input.value = ''; input._prevDC = 0; input._prevFL = 0; return; }
    var prev = input._prevDC || 0;
    if (prev > 0 && digits.length === prev && raw.length < (input._prevFL || 999)) {
      digits = digits.slice(0, -1);
      if (digits.length <= 1) { input.value = ''; input._prevDC = 0; input._prevFL = 0; return; }
    }
    digits = digits.slice(0, 11);
    var formatted = '+7';
    if (digits.length > 1) formatted += ' (' + digits.slice(1, 4);
    if (digits.length >= 4) formatted += ')';
    if (digits.length > 4) formatted += ' ' + digits.slice(4, 7);
    if (digits.length > 7) formatted += '-' + digits.slice(7, 9);
    if (digits.length > 9) formatted += '-' + digits.slice(9, 11);
    input.value = formatted;
    input._prevDC = digits.length;
    input._prevFL = formatted.length;
  };

  window.filterEmailInput = function (input) {
    input.value = input.value.replace(/[^a-zA-Z0-9@._-]/g, '');
  };

  function validatePhone(phone) {
    var digits = phone.replace(/\D/g, '');
    if (digits.length !== 11) {
      showToast('Номер телефона должен содержать 11 цифр');
      return false;
    }
    if (!/^[78]/.test(digits)) {
      showToast('Номер должен начинаться с +7 или 8');
      return false;
    }
    return true;
  }

  function validateEmail(email) {
    if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      showToast('Почта должна содержать только латиницу, @ и домен');
      return false;
    }
    var allowedDomains = [
      'gmail.com', 'mail.ru', 'yandex.ru', 'ya.ru', 'inbox.ru',
      'list.ru', 'bk.ru', 'internet.ru', 'outlook.com', 'hotmail.com',
      'icloud.com', 'rambler.ru', 'yahoo.com', 'protonmail.com',
      'proton.me', 'live.com', 'me.com'
    ];
    var domain = email.split('@')[1].toLowerCase();
    var isAllowed = allowedDomains.some(function (d) { return domain === d; });
    if (!isAllowed) {
      showToast('Укажите почту на известном сервисе (gmail.com, mail.ru, yandex.ru и т.д.)');
      return false;
    }
    return true;
  }

  window.changeCartSize = function (cartIdx, newLabel, newPrice, newFlowerCount, newDims) {
    var cart = getCart();
    var item = cart[cartIdx];
    if (!item) return;

    var newKey = item.product_id + '_' + newLabel;
    var existingIdx = -1;
    cart.forEach(function (ci, i) {
      if (i !== cartIdx && cartItemKey(ci) === newKey) existingIdx = i;
    });

    if (existingIdx >= 0) {
      cart[existingIdx].quantity += item.quantity;
      cart.splice(cartIdx, 1);
      saveCart(cart);
      updateCartBadge();
      showCart(true);
      return;
    }

    item.size_label = newLabel;
    item.price = newPrice;
    item.flower_count = newFlowerCount;
    item.dimensions = newDims || '';
    saveCart(cart);

    var row = document.getElementById('cart-row-' + cartIdx);
    if (row) {
      var btns = row.querySelectorAll('.size-btn');
      btns.forEach(function (b) {
        b.classList.toggle('active', b.textContent.trim() === newLabel);
      });
      var priceEl = document.getElementById('price-val-' + cartIdx);
      if (priceEl) priceEl.textContent = formatPrice(newPrice);
      var fcEl = row.querySelector('.cart-size-fc');
      if (fcEl) {
        var fcText = '';
        if (newFlowerCount) fcText += pluralFlower(newFlowerCount);
        if (newDims) fcText += (fcText ? ' · ' : '') + newDims;
        fcEl.textContent = fcText;
      }
      var totalEl = document.getElementById('cart-total-val');
      if (totalEl) totalEl.textContent = formatPrice(getCartTotal());

      var escapedLabel = escapeHtml(newLabel).replace(/'/g, "\\'");
      var qtyBtns = row.querySelectorAll('.qty-btn');
      if (qtyBtns.length >= 2) {
        qtyBtns[0].setAttribute('onclick', 'changeQty(' + item.product_id + ',\'' + escapedLabel + '\',-1)');
        qtyBtns[1].setAttribute('onclick', 'changeQty(' + item.product_id + ',\'' + escapedLabel + '\',1)');
      }
      var removeBtn = row.querySelector('.remove-btn');
      if (removeBtn) {
        removeBtn.setAttribute('onclick', 'removeItem(' + item.product_id + ',\'' + escapedLabel + '\')');
      }
    }
    updateCartBadge();
  };

  window.changeQty = function (productId, sizeLabel, delta) {
    var cartBefore = getCart();
    var key = productId + '_' + (sizeLabel || '');

    updateCartQty(productId, sizeLabel, delta);
    var cartAfter = getCart();
    updateCartBadge();

    if (cartAfter.length < cartBefore.length || !cartAfter.length) {
      showCart(true);
      return;
    }

    cartAfter.forEach(function (item, idx) {
      if (cartItemKey(item) === key || item.is_free_service) {
        var qtyEl = document.getElementById('qty-val-' + idx);
        if (qtyEl) qtyEl.textContent = item.quantity;
      }
    });
    var totalEl = document.getElementById('cart-total-val');
    if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
  };

  window.removeItem = function (productId, sizeLabel) {
    removeFromCart(productId, sizeLabel);
    updateCartBadge();
    showCart(true);
  };


  // ============================================================
  // Init
  // ============================================================

  init();

})();
