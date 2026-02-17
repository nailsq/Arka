(function () {
  'use strict';

  var appEl = document.getElementById('app');
  var currentCategoryId = null;
  var tgUser = null;
  var dbUser = null;
  var appSettings = {};
  var selectedCity = null;
  var citiesList = [];

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

  function calcBouquetPrice(base, min, ppf, fc) {
    return base + Math.max(0, fc - min) * ppf;
  }

  function addToCart(product, flowerCount) {
    var cart = getCart();
    var fc = flowerCount || 0;
    var price = product.price;
    if (product.is_bouquet && fc && product.flower_min && product.price_per_flower) {
      price = calcBouquetPrice(product.price, product.flower_min, product.price_per_flower, fc);
    }
    var existing = cart.find(function (i) { return i.product_id === product.id; });
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        product_id: product.id,
        name: product.name,
        price: price,
        image_url: product.image_url,
        quantity: 1,
        flower_count: fc,
        is_bouquet: product.is_bouquet || 0,
        flower_min: product.flower_min || 0,
        flower_max: product.flower_max || 0,
        flower_step: product.flower_step || 1,
        price_per_flower: product.price_per_flower || 0,
        base_price: product.price
      });
    }
    saveCart(cart);
    updateCartBadge();
    showToast('Добавлено в корзину');
  }

  function updateCartQty(productId, delta) {
    var cart = getCart();
    var item = cart.find(function (i) { return i.product_id === productId; });
    if (item) {
      item.quantity += delta;
      if (item.quantity <= 0) {
        cart = cart.filter(function (i) { return i.product_id !== productId; });
      }
    }
    saveCart(cart);
  }

  function removeFromCart(productId) {
    saveCart(getCart().filter(function (i) { return i.product_id !== productId; }));
  }

  function updateCartFlowerCount(productId, dir) {
    var cart = getCart();
    var item = cart.find(function (i) { return i.product_id === productId; });
    if (!item || !item.is_bouquet) return;
    var step = item.flower_step || 1;
    var next = (item.flower_count || item.flower_min) + dir * step;
    if (next < item.flower_min) next = item.flower_min;
    if (next > item.flower_max) next = item.flower_max;
    item.flower_count = next;
    item.price = calcBouquetPrice(item.base_price, item.flower_min, item.price_per_flower, next);
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
    }).then(function (r) { return r.json(); });
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

  function formatDate(d) {
    if (!d) return '';
    var dt = new Date(d);
    var day = String(dt.getDate()).padStart(2, '0');
    var mon = String(dt.getMonth() + 1).padStart(2, '0');
    var yr = dt.getFullYear();
    var h = String(dt.getHours()).padStart(2, '0');
    var m = String(dt.getMinutes()).padStart(2, '0');
    return day + '.' + mon + '.' + yr + ' ' + h + ':' + m;
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

    var priceLabel = (p.is_bouquet && p.flower_min) ? 'от ' + formatPrice(p.price) : formatPrice(p.price);

    return '<div class="product-card">' +
      '<div class="product-card-img-wrap" onclick="navigateTo(\'product\',' + p.id + ')"' +
        (images.length > 1 ? ' data-slide-count="' + images.length + '"' : '') + '>' +
        imgHtml +
        dotsHtml +
        '<button class="fav-btn' + favClass + '" onclick="toggleFav(' + p.id + ',event)">' + heartSvg + '</button>' +
        '<button class="cart-icon-btn" onclick="addToCartById(' + p.id + ',event)">' + cartSvg + '</button>' +
      '</div>' +
      '<div class="product-card-body" onclick="navigateTo(\'product\',' + p.id + ')">' +
        '<div class="product-card-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="product-card-price">' + priceLabel + '</div>' +
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
      var today = new Date();
      var todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
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
        if (r && r.user) dbUser = r.user;
      }).catch(function () {});
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
    var pickup = appSettings.pickup_address || 'г. Саратов, 3-й Дегтярный проезд, 21к3';
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
      '<div class="product-list" id="home-product-list">Загрузка...</div>' +
      '<div class="delivery-info">' +
        '<p>Доставка за 60 минут' + (cityName ? ' в городе ' + escapeHtml(cityName) : ' в Саратове и Энгельсе') + '.</p>' +
        '<p>Самовывоз: ' + escapeHtml(pickup) + '</p>' +
      '</div>'
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

      var flowerHtml = '';
      if (p.is_bouquet && p.flower_min > 0 && p.flower_max > 0) {
        var options = '';
        for (var fc = p.flower_min; fc <= p.flower_max; fc += (p.flower_step || 1)) {
          var fcPrice = p.price + (fc - p.flower_min) * (p.price_per_flower || 0);
          options += '<option value="' + fc + '" data-price="' + fcPrice + '">' + fc + ' шт. — ' + formatPrice(fcPrice) + '</option>';
        }
        flowerHtml =
          '<div class="flower-selector" id="flower-selector">' +
            '<div class="flower-selector-label">Количество цветов в букете</div>' +
            '<select class="flower-select" id="flower-count" onchange="updateFlowerPrice(' + p.id + ')">' +
              options +
            '</select>' +
          '</div>';
      }

      document.getElementById('product-detail').innerHTML =
        '<div class="product-detail">' +
          galleryHtml +
          '<div class="product-detail-name">' + escapeHtml(p.name) + '</div>' +
          '<div class="product-detail-price" id="detail-price">' + formatPrice(p.price) + '</div>' +
          '<div class="product-detail-desc">' + escapeHtml(p.description) + '</div>' +
          (isBouquetCategory(p.category_name) ? '<div class="product-detail-warning">Каждый букет собирается вручную, возможны отличия от фото.</div>' : '') +
          flowerHtml +
          '<div class="product-detail-actions">' +
            '<button class="card-cart-btn card-cart-btn--large" onclick="addToCartWithFlowers(' + p.id + ',event)">В корзину</button>' +
          '</div>' +
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

  function showCart() {
    setActiveTab('cart');
    var cart = getCart();
    var h = '<div class="section-title">Корзина</div>';
    if (!cart.length) { render(h + '<div class="empty-state">Корзина пуста</div>'); return; }

    h += '<div class="cart-items">';
    cart.forEach(function (item) {
      var pid = item.product_id;
      var flowerSelector = '';
      if (item.is_bouquet && item.flower_min && item.flower_max) {
        flowerSelector =
          '<div class="cart-flower-selector">' +
            '<div class="cart-flower-label">Цветов в букете:</div>' +
            '<div class="cart-flower-row">' +
              '<button class="cart-flower-btn" onclick="changeFlowerCount(' + pid + ',-1)">-</button>' +
              '<span class="cart-flower-val" id="flower-val-' + pid + '">' + (item.flower_count || item.flower_min) + '</span>' +
              '<button class="cart-flower-btn" onclick="changeFlowerCount(' + pid + ',1)">+</button>' +
            '</div>' +
          '</div>';
      }
      h += '<div class="cart-item" id="cart-row-' + pid + '">' +
        productImage(item.image_url, item.name, 'cart-item-img') +
        '<div class="cart-item-info">' +
          '<div>' +
            '<div class="cart-item-name">' + escapeHtml(item.name) + '</div>' +
            flowerSelector +
            '<div class="cart-item-price" id="price-val-' + pid + '">' + formatPrice(item.price) + '</div>' +
          '</div>' +
          '<div class="cart-item-controls">' +
            '<button class="qty-btn" onclick="changeQty(' + pid + ',-1)">-</button>' +
            '<span class="qty-value" id="qty-val-' + pid + '">' + item.quantity + '</span>' +
            '<button class="qty-btn" onclick="changeQty(' + pid + ',1)">+</button>' +
            '<button class="remove-btn" onclick="removeItem(' + pid + ')">Удалить</button>' +
          '</div>' +
        '</div></div>';
    });
    h += '</div>';
    h += '<div class="cart-total">Итого: <span id="cart-total-val">' + formatPrice(getCartTotal()) + '</span></div>';
    h += '<button class="nav-btn" onclick="navigateTo(\'checkout\')">Оформить заказ</button>';
    render(h);
  }

  // ============================================================
  // Checkout with delivery logic
  // ============================================================

  var checkoutState = {
    deliveryType: 'delivery',
    deliveryZoneKey: '',
    deliveryInterval: '',
    exactTime: false
  };

  function getCityZones() {
    var cityName = selectedCity ? selectedCity.name : '';
    var zonesKey = '';
    if (cityName === 'Саратов') zonesKey = 'saratov_zones';
    else if (cityName === 'Энгельс') zonesKey = 'engels_zones';
    if (!zonesKey || !appSettings[zonesKey]) return [];
    try { return JSON.parse(appSettings[zonesKey]); }
    catch (e) { return []; }
  }

  function getDeliveryCost() {
    if (checkoutState.deliveryType === 'pickup') return 0;
    if (checkoutState.exactTime) {
      return parseInt(appSettings.exact_time_surcharge) || 1000;
    }
    var key = checkoutState.deliveryZoneKey;
    if (!key) {
      var zones = getCityZones();
      if (zones.length) key = zones[0].key;
    }
    var cost = parseInt(appSettings['delivery_' + key]) || 0;
    return cost;
  }

  var currentStep = 1;

  function showCheckout() {
    var cart = getCart();
    if (!cart.length) { navigateTo('cart'); return; }

    currentStep = 1;
    checkoutState.deliveryInterval = '';
    checkoutState.exactTime = false;

    var userName = (dbUser && dbUser.first_name) || (tgUser && tgUser.first_name) || '';
    var userPhone = (dbUser && dbUser.phone) || '';
    var userEmail = '';
    var userAddr = (dbUser && dbUser.default_address) || '';
    var tgUsername = (tgUser && tgUser.username) ? '@' + tgUser.username : '';

    var intervals = getIntervals();
    var now = new Date();
    var currentHour = now.getHours();
    var cutoff = getCutoffHour();
    var holiday = isHolidayToday();
    var pickup = appSettings.pickup_address || 'г. Саратов, 3-й Дегтярный проезд, 21к3';

    var zones = getCityZones();
    if (zones.length) {
      checkoutState.deliveryZoneKey = zones[0].key;
    }

    var zonesHtml = zones.map(function (z, idx) {
      var cost = parseInt(appSettings['delivery_' + z.key]) || 0;
      return '<label class="radio-option' + (idx === 0 ? ' selected' : '') +
        '" onclick="setZone(\'' + escapeHtml(z.key) + '\')">' +
        '<input type="radio" name="zone" value="' + escapeHtml(z.key) + '"' + (idx === 0 ? ' checked' : '') + '>' +
        '<span class="radio-dot"></span> ' + escapeHtml(z.name) + ' (' + formatPrice(cost) + ')</label>';
    }).join('');

    var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');
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
          '<input type="text" id="field-tg" placeholder="@username" value="' + escapeHtml(tgUsername) + '"></div>' +
          '<div class="form-group"><label>Контактный телефон</label>' +
          '<input type="tel" id="field-phone" placeholder="+7 (___) ___-__-__" value="' + escapeHtml(userPhone) + '" oninput="formatPhoneInput(this)" maxlength="18"></div>' +
          '<div class="form-group"><label>Электронная почта</label>' +
          '<input type="email" id="field-email" placeholder="mail@example.com" value="' + escapeHtml(userEmail) + '"></div>' +
          '<button type="button" class="step-next-btn" onclick="goToStep(2)">Далее</button>' +
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
            (zonesHtml ? '<div class="form-group"><label>Зона доставки</label>' +
              '<div class="radio-group" id="zone-group">' + zonesHtml + '</div></div>' : '') +
            '<div id="saved-addr-picker"></div>' +
            '<div class="form-group"><label>Город</label>' +
            '<input type="text" id="field-addr-city" placeholder="Город" value="' + escapeHtml(selectedCity ? selectedCity.name : '') + '" readonly style="background:#f5f5f5"></div>' +
            '<div class="form-group"><label>Район</label>' +
            '<input type="text" id="field-addr-district" placeholder="Район (напр. Ленинский)"></div>' +
            '<div class="form-group"><label>Улица, дом</label>' +
            '<input type="text" id="field-addr-street" placeholder="Улица, дом"></div>' +
            '<div class="form-group"><label>Квартира / офис</label>' +
            '<input type="text" id="field-addr-apt" placeholder="Квартира, подъезд, этаж"></div>' +
            '<div class="form-group"><label>Дополнение к адресу</label>' +
            '<input type="text" id="field-addr-note" placeholder="Код домофона, ориентиры и т.д."></div>' +
            '<input type="hidden" id="field-address">' +
          '</div>' +

          '<div id="date-cutoff-notice" class="cutoff-notice"' + (isTodayClosed ? '' : ' style="display:none"') + '>' +
            'Доставка на сегодня уже недоступна (после ' + cutoff + ':00). Вы можете оформить самовывоз или выбрать другую дату.' +
          '</div>' +

          '<div class="form-group"><label id="date-label">Дата доставки</label>' +
          '<input type="date" id="field-date" class="form-input-date" min="' + minDate + '" value="' + defaultDate + '" onchange="onDeliveryDateChange()"></div>' +

          '<div class="form-group"><label id="time-label">Время доставки</label>' +
          '<div class="radio-group" id="interval-group">' +
          '</div></div>' +

          '<div class="exact-time-section">' +
            '<label class="checkout-self-btn" id="exact-time-opt" onclick="toggleExactTime()">' +
              '<input type="checkbox" id="exact-time-cb">' +
              '<span class="check-box"></span> Доставка точно ко времени (+' + formatPrice(parseInt(appSettings.exact_time_surcharge) || 1000) + ')' +
            '</label>' +
            '<div id="exact-time-fields" style="display:none">' +
              '<div style="font-size:12px;color:#888;margin:8px 0 6px">Заказ будет доставлен в интервале +-1,5 часа от указанного времени</div>' +
              '<input type="time" id="field-exact-time" class="form-input-date" value="12:00" onchange="validateExactTime()">' +
              '<div id="exact-time-warn" class="cutoff-notice" style="display:none"></div>' +
            '</div>' +
          '</div>' +

          '<div class="form-group"><label>Комментарий к заказу</label>' +
          '<textarea id="field-comment" placeholder="Пожелания, особые указания"></textarea></div>' +

          '<div class="step-btn-row">' +
            '<button type="button" class="step-back-btn" onclick="goToStep(1)">Назад</button>' +
            '<button type="button" class="step-next-btn" onclick="goToStep(3)">Далее</button>' +
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
            '<input type="text" id="field-rcv-name" placeholder="Имя получателя"></div>' +
            '<div class="form-group"><label>Телефон получателя</label>' +
            '<input type="tel" id="field-rcv-phone" placeholder="+7 (___) ___-__-__"></div>' +
          '</div>' +
          '<div id="checkout-summary"></div>' +
          '<div class="step-btn-row">' +
            '<button type="button" class="step-back-btn" onclick="goToStep(2)">Назад</button>' +
            '<button type="button" class="step-next-btn step-submit-btn" id="checkout-submit" onclick="submitOrder(event)">Оформить заказ</button>' +
          '</div>' +
        '</div>' +

      '</div>'
    );

    updateCheckoutSummary();
    renderIntervals();
    loadCheckoutAddresses();
  }

  function loadCheckoutAddresses() {
    var telegramId = (dbUser && dbUser.telegram_id) || (tgUser && tgUser.id);
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
    var city = document.getElementById('field-addr-city');
    var district = document.getElementById('field-addr-district');
    var street = document.getElementById('field-addr-street');
    var apt = document.getElementById('field-addr-apt');
    var note = document.getElementById('field-addr-note');
    if (city && a.city) city.value = a.city;
    if (district) district.value = a.district || '';
    if (street) street.value = a.street || '';
    if (apt) apt.value = a.apartment || '';
    if (note) note.value = a.note || '';
    var chips = document.querySelectorAll('.saved-addr-chip');
    chips.forEach(function (c) { c.classList.remove('active'); });
    var clicked = document.querySelector('.saved-addr-chip[onclick*="' + addrId + '"]');
    if (clicked) clicked.classList.add('active');
    showToast('Адрес заполнен');
  };

  window.goToStep = function (step) {
    if (step > currentStep) {
      if (currentStep === 1) {
        var phone = document.getElementById('field-phone').value.trim();
        var tg = document.getElementById('field-tg').value.trim();
        var email = document.getElementById('field-email').value.trim();
        if (!phone || !tg) {
          showToast('Заполните Telegram и телефон');
          return;
        }
        var phoneDigits = phone.replace(/\D/g, '');
        if (!/^[78]/.test(phoneDigits) || phoneDigits.length !== 11) {
          showToast('Укажите корректный номер телефона (+7 или +8, 11 цифр)');
          return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          showToast('Укажите корректный адрес электронной почты');
          return;
        }
      }
      if (currentStep === 2) {
        if (checkoutState.deliveryType === 'delivery') {
          var district = document.getElementById('field-addr-district') ? document.getElementById('field-addr-district').value.trim() : '';
          var street = document.getElementById('field-addr-street') ? document.getElementById('field-addr-street').value.trim() : '';
          var apt = document.getElementById('field-addr-apt') ? document.getElementById('field-addr-apt').value.trim() : '';
          if (!district) { showToast('Укажите район'); return; }
          if (!street) { showToast('Укажите улицу и дом'); return; }
          if (!apt) { showToast('Укажите квартиру / офис'); return; }
          var addrNote = document.getElementById('field-addr-note') ? document.getElementById('field-addr-note').value.trim() : '';
          var cityVal = document.getElementById('field-addr-city') ? document.getElementById('field-addr-city').value.trim() : '';
          var fullAddr = cityVal + ', ' + district + ', ' + street + ', кв./оф. ' + apt + (addrNote ? ', ' + addrNote : '');
          var hiddenAddr = document.getElementById('field-address');
          if (hiddenAddr) hiddenAddr.value = fullAddr;
        }
        var dateVal = document.getElementById('field-date').value;
        if (!dateVal) { showToast('Укажите дату доставки'); return; }
        var nowCheck = new Date();
        var todayCheck = nowCheck.getFullYear() + '-' + String(nowCheck.getMonth() + 1).padStart(2, '0') + '-' + String(nowCheck.getDate()).padStart(2, '0');
        if (checkoutState.deliveryType === 'delivery' && dateVal === todayCheck && nowCheck.getHours() >= getCutoffHour()) {
          showToast('Доставка на сегодня недоступна. Выберите другую дату или самовывоз.');
          return;
        }
        if (!checkoutState.exactTime && checkoutState.deliveryType === 'delivery' && !checkoutState.deliveryInterval) {
          showToast('Выберите время доставки (интервал или точное время)');
          return;
        }
        if (checkoutState.exactTime && !validateExactTime()) {
          showToast('Выберите корректное время доставки');
          return;
        }
      }
    }

    currentStep = step;

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
      h += '<div class="order-summary">' + deliveryLabel + ': ' + formatPrice(deliveryCost) + '</div>';
    }
    h += '<div class="cart-total">Итого: ' + formatPrice(total) + '</div>';
    el.innerHTML = h;
  }

  function renderIntervals() {
    var el = document.getElementById('interval-group');
    if (!el) return;
    var dateField = document.getElementById('field-date');
    var selectedDate = dateField ? dateField.value : '';
    var now = new Date();
    var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var isToday = selectedDate === todayStr;
    var currentHour = now.getHours();
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

  window.onDeliveryDateChange = function () {
    var dateField = document.getElementById('field-date');
    var notice = document.getElementById('date-cutoff-notice');
    var now = new Date();
    var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var cutoff = getCutoffHour();
    var isToday = dateField && dateField.value === todayStr;
    var isClosed = isToday && now.getHours() >= cutoff;

    if (notice) notice.style.display = isClosed ? 'block' : 'none';

    checkoutState.deliveryInterval = '';
    renderIntervals();
    if (checkoutState.exactTime) validateExactTime();
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
    if (exactSection) exactSection.style.display = type === 'pickup' ? 'none' : 'block';
    if (type === 'pickup' && checkoutState.exactTime) {
      checkoutState.exactTime = false;
      var cb = document.getElementById('exact-time-cb');
      if (cb) cb.checked = false;
      var opt2 = document.getElementById('exact-time-opt');
      if (opt2) opt2.classList.remove('checked');
      var etFields = document.getElementById('exact-time-fields');
      if (etFields) etFields.style.display = 'none';
    }
    updateCheckoutSummary();
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
  };

  window.validateExactTime = function () {
    var warn = document.getElementById('exact-time-warn');
    var timeInput = document.getElementById('field-exact-time');
    var dateField = document.getElementById('field-date');
    if (!warn || !timeInput) return true;

    var now = new Date();
    var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var isToday = dateField && dateField.value === todayStr;

    if (!isToday) {
      warn.style.display = 'none';
      return true;
    }

    var parts = timeInput.value.split(':');
    var targetH = parseInt(parts[0]) || 0;
    var targetM = parseInt(parts[1]) || 0;
    var targetMinutes = targetH * 60 + targetM;
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
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

  window.submitOrder = function (event) {
    if (event && event.preventDefault) event.preventDefault();
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

    var data = {
      user_name: tgVal || phoneVal,
      user_phone: phoneVal,
      user_email: emailVal,
      user_telegram: tgVal,
      receiver_name: rcvName,
      receiver_phone: rcvPhone,
      delivery_address: (checkoutState.deliveryType === 'pickup')
        ? (appSettings.pickup_address || 'Самовывоз')
        : (document.getElementById('field-address') ? document.getElementById('field-address').value.trim() : ''),
      delivery_type: checkoutState.deliveryType,
      delivery_zone: checkoutState.deliveryType === 'delivery' ? checkoutState.deliveryZoneKey : '',
      delivery_cost: getDeliveryCost(),
      delivery_interval: checkoutState.exactTime
        ? ('Точно ко времени: ' + (document.getElementById('field-exact-time') ? document.getElementById('field-exact-time').value : ''))
        : (checkoutState.deliveryType === 'delivery' ? checkoutState.deliveryInterval : ''),
      delivery_date: dateVal,
      exact_time: checkoutState.exactTime ? (document.getElementById('field-exact-time') ? document.getElementById('field-exact-time').value : '') : '',
      comment: document.getElementById('field-comment') ? document.getElementById('field-comment').value.trim() : '',
      telegram_id: tgUser ? tgUser.id : '',
      city_id: selectedCity ? selectedCity.id : null,
      items: cart.map(function (i) {
        return { product_id: i.product_id, quantity: i.quantity, price: i.price, flower_count: i.flower_count || 0 };
      })
    };

    var btn = document.getElementById('checkout-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Отправка...'; }

    postJSON('/api/orders', data).then(function (result) {
      if (!result.success) {
        if (btn) { btn.disabled = false; btn.textContent = 'Перейти к оплате'; }
        showToast('Ошибка при создании заказа');
        return;
      }

      saveCart([]);

      postJSON('/api/payments/create', { order_id: result.order_id }).then(function (pay) {
        if (pay && pay.payment_url) {
          showPaymentPage(result.order_id, pay.payment_url, result.total_amount);
        } else {
          showOrderSuccess(result.order_id);
        }
      }).catch(function () {
        showOrderSuccess(result.order_id);
      });
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Перейти к оплате'; }
      showToast('Ошибка сети');
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
    if (!tgUser && !dbUser) {
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
          '<div class="profile-name">' + escapeHtml(fullName) + '</div>' +
          (username ? '<div class="profile-username">@' + escapeHtml(username) + '</div>' : '') +
        '</div>' +
      '</div>' +

      '<div class="profile-section">' +
        '<div class="profile-section-header">' +
          '<span class="profile-section-title">Отслеживание доставки</span>' +
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

    loadProfileTracking();
  }

  function loadProfileTracking() {
    var telegramId = (dbUser && dbUser.telegram_id) || (tgUser && tgUser.id);
    if (!telegramId) return;
    fetchJSON('/api/user/orders?telegram_id=' + telegramId).then(function (orders) {
      var el = document.getElementById('profile-tracking');
      if (!el) return;
      if (!orders || !orders.length) {
        el.innerHTML = '<div class="empty-state" style="padding:12px">Активных заказов нет</div>';
        return;
      }
      var active = orders.filter(function (o) { return o.status !== 'Доставлен'; });
      if (!active.length) {
        el.innerHTML = '<div class="empty-state" style="padding:12px">Все заказы доставлены</div>';
        return;
      }
      el.innerHTML = active.map(function (o) {
        var currentIdx = TRACK_STEPS.indexOf(o.status);
        if (currentIdx < 0) currentIdx = 0;
        var timelineHtml = '';
        TRACK_STEPS.forEach(function (step, idx) {
          if (idx > 0) timelineHtml += '<div class="timeline-line' + (idx <= currentIdx ? ' filled' : '') + '"></div>';
          var cls = 'timeline-step';
          if (idx < currentIdx) cls += ' done';
          if (idx === currentIdx) cls += ' current';
          timelineHtml += '<div class="' + cls + '"><div class="timeline-dot"></div><div class="timeline-label">' + escapeHtml(step) + '</div></div>';
        });
        return '<div class="track-card-mini">' +
          '<div class="track-header"><span class="track-id">N ' + o.id + '</span><span class="track-date">' + formatDate(o.created_at) + '</span></div>' +
          '<div class="timeline">' + timelineHtml + '</div>' +
        '</div>';
      }).join('');
    });
  }

  function loadProfileAddresses() {
    var telegramId = (dbUser && dbUser.telegram_id) || (tgUser && tgUser.id);
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
    var telegramId = (dbUser && dbUser.telegram_id) || (tgUser && tgUser.id);
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
    var telegramId = (dbUser && dbUser.telegram_id) || (tgUser && tgUser.id);
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
    var telegramId = (dbUser && dbUser.telegram_id) || (tgUser && tgUser.id);
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
      el.innerHTML = '<div class="order-history">' + orders.map(function (o) {
        var itemsHtml = '';
        if (o.items && o.items.length) {
          itemsHtml = '<div class="order-card-items">' +
            o.items.map(function (i) {
              return '<div>' + escapeHtml(i.product_name || 'Товар') + (i.flower_count ? ' (' + i.flower_count + ' цв.)' : '') + ' x' + i.quantity + ' — ' + formatPrice(i.price * i.quantity) + '</div>';
            }).join('') + '</div>';
        }
        return '<div class="order-card">' +
          '<div class="order-card-header">' +
            '<span class="order-card-id">N ' + o.id + '</span>' +
            '<span class="order-card-status">' + escapeHtml(o.status) + '</span>' +
          '</div>' +
          '<div class="order-card-date">' + formatDate(o.created_at) + '</div>' +
          (o.delivery_type === 'pickup' ? '<div style="font-size:12px;">Самовывоз</div>' :
            '<div style="font-size:12px;">Доставка: ' + escapeHtml(o.delivery_zone || '') + '</div>') +
          itemsHtml +
          '<div class="order-card-total">' + formatPrice(o.total_amount) + '</div>' +
        '</div>';
      }).join('') + '</div>';
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
    var telegramId = (dbUser && dbUser.telegram_id) || (tgUser && tgUser.id);
    if (!telegramId) return;
    postJSON('/api/user/update', {
      telegram_id: telegramId,
      phone: document.getElementById('profile-phone').value.trim(),
      default_address: document.getElementById('profile-address').value.trim()
    }).then(function (r) {
      if (r && r.user) {
        dbUser = r.user;
        showToast('Данные сохранены');
        navigateTo('account');
      }
    });
  };

  // ============================================================
  // Delivery tracking
  // ============================================================

  var TRACK_STEPS = ['Новый', 'Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Доставлен'];

  window.showDeliveryTracking = function () {
    var telegramId = (dbUser && dbUser.telegram_id) || (tgUser && tgUser.id);

    if (!telegramId) {
      render(
        '<span class="back-link" onclick="navigateTo(\'account\')">К профилю</span>' +
        '<div class="section-title">Отслеживание доставки</div>' +
        '<div class="empty-state">Откройте приложение через Telegram для отслеживания заказов.</div>'
      );
      return;
    }

    render(
      '<span class="back-link" onclick="navigateTo(\'account\')">К профилю</span>' +
      '<div class="section-title">Отслеживание доставки</div>' +
      '<div id="delivery-list"><div class="empty-state">Загрузка...</div></div>'
    );

    fetchJSON('/api/user/orders?telegram_id=' + telegramId).then(function (orders) {
      var el = document.getElementById('delivery-list');
      if (!el) return;
      if (!orders || !orders.length) {
        el.innerHTML = '<div class="empty-state">У вас пока нет заказов</div>';
        return;
      }

      el.innerHTML = orders.map(function (o) {
        var currentIdx = TRACK_STEPS.indexOf(o.status);
        if (currentIdx < 0) currentIdx = 0;

        var timelineHtml = '';
        TRACK_STEPS.forEach(function (step, idx) {
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
              return '<div>' + escapeHtml(i.product_name || 'Товар') + (i.flower_count ? ' (' + i.flower_count + ' цв.)' : '') + ' x' + i.quantity + ' — ' + formatPrice(i.price * i.quantity) + '</div>';
            }).join('') + '</div>';
        }

        var deliveryLine = '';
        if (o.delivery_type === 'pickup') {
          deliveryLine = 'Самовывоз';
        } else {
          deliveryLine = 'Доставка' + (o.delivery_interval ? ', ' + escapeHtml(o.delivery_interval) : '');
        }

        return '<div class="track-card">' +
          '<div class="track-header">' +
            '<span class="track-id">Заказ N ' + o.id + '</span>' +
            '<span class="track-date">' + formatDate(o.created_at) + '</span>' +
          '</div>' +
          '<div class="track-amount">' + formatPrice(o.total_amount) + '</div>' +
          '<div class="timeline">' + timelineHtml + '</div>' +
          '<div class="track-delivery-info">' + deliveryLine + '</div>' +
          itemsHtml +
        '</div>';
      }).join('');
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

  function showPrivacy() {
    render(
      '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span>' +
      '<div class="static-page">' +
        '<h2>Политика конфиденциальности</h2>' +
        '<p>ИП "АРКА СТУДИЯ ЦВЕТОВ" (далее -- Оператор) обеспечивает защиту персональных данных пользователей в соответствии с Федеральным законом N 152-ФЗ "О персональных данных".</p>' +
        '<p>Оператор собирает и обрабатывает следующие данные: имя, номер телефона, адрес доставки, идентификатор Telegram. Данные используются исключительно для выполнения заказов и связи с клиентом.</p>' +
        '<p>Данные не передаются третьим лицам, за исключением случаев, предусмотренных законодательством РФ, а также службам доставки для выполнения заказа.</p>' +
        '<p>Пользователь вправе запросить удаление своих персональных данных, обратившись к оператору.</p>' +
      '</div>'
    );
  }

  function showReturns() {
    render(
      '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span>' +
      '<div class="static-page">' +
        '<h2>Условия возврата</h2>' +
        '<p>Живые цветы и букеты являются товаром надлежащего качества и возврату не подлежат (Постановление Правительства РФ N 2463).</p>' +
        '<p>Если букет доставлен ненадлежащего качества (увядший, поврежденный), свяжитесь с нами в течение 2 часов с момента доставки для решения вопроса. Приложите фотографию букета.</p>' +
        '<p>Возврат денежных средств за оплаченный, но не доставленный заказ, осуществляется в полном объеме в течение 3 рабочих дней.</p>' +
      '</div>'
    );
  }

  function showConsent() {
    render(
      '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span>' +
      '<div class="static-page">' +
        '<h2>Согласие на обработку персональных данных</h2>' +
        '<p>Оформляя заказ, вы даете согласие на обработку ваших персональных данных (имя, телефон, адрес, идентификатор Telegram) оператором ИП "АРКА СТУДИЯ ЦВЕТОВ" в целях исполнения заказа.</p>' +
        '<p>Согласие может быть отозвано путем направления письменного уведомления оператору. При отзыве согласия оператор прекращает обработку данных и удаляет их в течение 30 дней.</p>' +
      '</div>'
    );
  }

  // ============================================================
  // Navigation
  // ============================================================

  window.navigateTo = function (page, param) {
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
      case 'page-privacy': showPrivacy(); break;
      case 'page-returns': showReturns(); break;
      case 'page-consent': showConsent(); break;
      default: showHome();
    }
  };

  // ============================================================
  // Global handlers
  // ============================================================

  window.addToCartById = function (productId, event) {
    if (event) event.stopPropagation();
    fetchJSON('/api/products/' + productId).then(function (p) {
      if (p && !p.error) {
        var fc = (p.is_bouquet && p.flower_min) ? p.flower_min : 0;
        addToCart(p, fc);
      }
    });
  };

  window.addToCartWithFlowers = function (productId, event) {
    if (event) event.stopPropagation();
    var p = window._currentProduct;
    if (!p || p.id !== productId) {
      window.addToCartById(productId, event);
      return;
    }
    var sel = document.getElementById('flower-count');
    var fc = sel ? parseInt(sel.value) : ((p.is_bouquet && p.flower_min) ? p.flower_min : 0);
    addToCart(p, fc);
  };

  window.formatPhoneInput = function (input) {
    var digits = input.value.replace(/\D/g, '');
    if (digits.length === 0) { input.value = ''; return; }
    if (digits[0] === '8') digits = '7' + digits.slice(1);
    if (digits[0] !== '7') digits = '7' + digits;
    var formatted = '+7';
    if (digits.length > 1) formatted += ' (' + digits.slice(1, 4);
    if (digits.length >= 4) formatted += ')';
    if (digits.length > 4) formatted += ' ' + digits.slice(4, 7);
    if (digits.length > 7) formatted += '-' + digits.slice(7, 9);
    if (digits.length > 9) formatted += '-' + digits.slice(9, 11);
    input.value = formatted;
  };

  window.updateFlowerPrice = function () {
    var sel = document.getElementById('flower-count');
    var priceEl = document.getElementById('detail-price');
    if (sel && priceEl) {
      var opt = sel.options[sel.selectedIndex];
      var price = parseInt(opt.getAttribute('data-price'));
      priceEl.textContent = formatPrice(price);
    }
  };

  window.changeQty = function (productId, delta) {
    updateCartQty(productId, delta);
    updateCartBadge();
    refreshCartInPlace();
  };

  window.removeItem = function (productId) {
    removeFromCart(productId);
    updateCartBadge();
    var row = document.getElementById('cart-row-' + productId);
    if (row) {
      row.style.transition = 'opacity 0.2s, transform 0.2s';
      row.style.opacity = '0';
      row.style.transform = 'translateX(-30px)';
      setTimeout(function () {
        refreshCartInPlace();
      }, 200);
    } else {
      refreshCartInPlace();
    }
  };

  window.changeFlowerCount = function (productId, dir) {
    updateCartFlowerCount(productId, dir);
    updateCartBadge();
    refreshCartInPlace();
  };

  function refreshCartInPlace() {
    var cart = getCart();
    if (!cart.length) {
      showCart();
      return;
    }
    cart.forEach(function (item) {
      var pid = item.product_id;
      var qtyEl = document.getElementById('qty-val-' + pid);
      if (qtyEl) qtyEl.textContent = item.quantity;
      var priceEl = document.getElementById('price-val-' + pid);
      if (priceEl) priceEl.textContent = formatPrice(item.price);
      var flowerEl = document.getElementById('flower-val-' + pid);
      if (flowerEl) flowerEl.textContent = item.flower_count || item.flower_min;
    });
    var totalEl = document.getElementById('cart-total-val');
    if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
  }

  // ============================================================
  // Init
  // ============================================================

  init();

})();
