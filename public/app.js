(function () {
  'use strict';

  var appEl = document.getElementById('app');
  var currentCategoryId = null;
  var tgUser = null;
  var dbUser = null;
  var appSettings = {};
  var selectedCity = null;
  var citiesList = [];
  var webTelegramBotUsername = '';
  var webTelegramBotId = '';
  var webTelegramAuthUrl = '';
  var webTelegramBotChecked = false;
  var desktopHeroShownThisLoad = false;

  // ============================================================
  // Telegram Web App
  // ============================================================

  var tg = window.Telegram && window.Telegram.WebApp;
  var isTelegramRuntime = false;
  var detachHomeHeroScroll = null;
  var detachMobileQuickCatsScroll = null;
  var MOBILE_CATS_COLLAPSED_KEY = 'arka_web_mobile_cats_collapsed';
  if (tg) {
    tg.ready();
    tg.expand();
    isTelegramRuntime = !!(tg.initData && tg.initData.length);
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
    list.innerHTML = '<div style="text-align:center;padding:20px;font-size:14px">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div>';

    fetchJSON('/api/cities').then(function (cities) {
      citiesList = cities || [];
      if (!citiesList.length) {
        citiesList = [
          { id: 1, name: '╨б╨░╤А╨░╤В╨╛╨▓' },
          { id: 2, name: '╨н╨╜╨│╨╡╨╗╤М╤Б' }
        ];
      }
      renderCityList(list);
    }).catch(function () {
      citiesList = [
        { id: 1, name: '╨б╨░╤А╨░╤В╨╛╨▓' },
        { id: 2, name: '╨н╨╜╨│╨╡╨╗╤М╤Б' }
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
      showToast('╨г╨▒╤А╨░╨╜╨╛ ╨╕╨╖ ╨╕╨╖╨▒╤А╨░╨╜╨╜╨╛╨│╨╛');
    } else {
      favs.push(productId);
      showToast('╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╛ ╨▓ ╨╕╨╖╨▒╤А╨░╨╜╨╜╨╛╨╡');
    }
    saveFavorites(favs);
  }

  function updateFavBadge() {
    var badge = document.getElementById('fav-badge');
    var webBadge = document.getElementById('web-fav-badge');
    var webToolbarBadge = document.getElementById('web-toolbar-fav-badge');
    var count = getFavorites().length;
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    if (webBadge) {
      if (count > 0) {
        webBadge.textContent = count;
        webBadge.style.display = 'inline-block';
      } else {
        webBadge.style.display = 'none';
      }
    }
    if (webToolbarBadge) {
      if (count > 0) {
        webToolbarBadge.textContent = count;
        webToolbarBadge.style.display = 'inline-block';
      } else {
        webToolbarBadge.style.display = 'none';
      }
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
    var dims = product.dimensions || '';
    var imageUrl = product.image_url || '';
    var allSizes = (product.sizes && product.sizes.length) ? product.sizes : [];
    var isBouquet = !!(sizeObj || product.is_bouquet);

    if (sizeObj) {
      price = sizeObj.price;
      sizeLabel = sizeObj.label;
      dims = sizeObj.dimensions || '';
      imageUrl = sizeObj.image_url || imageUrl;
    }

    var cartKey = product.id + '_' + sizeLabel;
    var existing = cart.find(function (i) { return (i.product_id + '_' + (i.size_label || '')) === cartKey; });
    if (existing) {
      existing.quantity += 1;
      if (allSizes.length) existing.available_sizes = allSizes;
      if (imageUrl) existing.image_url = imageUrl;
    } else {
      cart.push({
        product_id: product.id,
        name: product.name,
        price: price,
        image_url: imageUrl,
        quantity: 1,
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
    showToast('╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╛ ╨▓ ╨║╨╛╤А╨╖╨╕╨╜╤Г');
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
    return fetch(url, { credentials: 'include' }).then(function (r) { return r.json(); });
  }

  function fetchAppSettings() {
    var url = '/api/settings?_ts=' + Date.now();
    return fetch(url, { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        appSettings = s || {};
        updateSocialLinks();
        return appSettings;
      });
  }

  function postJSON(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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

  function ensureWebTelegramBotUsername() {
    if (webTelegramBotChecked) {
      return Promise.resolve(webTelegramBotUsername || '');
    }
    return fetchJSON('/api/auth/telegram-web-config')
      .then(function (cfg) {
        webTelegramBotChecked = true;
        if (cfg && cfg.enabled && cfg.bot_username) {
          webTelegramBotUsername = String(cfg.bot_username).replace(/^@/, '').trim();
          webTelegramBotId = String(cfg.bot_id || '').trim();
          webTelegramAuthUrl = String(cfg.auth_url || '').trim();
        }
        return webTelegramBotUsername || '';
      })
      .catch(function () {
        webTelegramBotChecked = true;
        return '';
      });
  }

  function mountWebTelegramLoginWidget(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="empty-state" style="padding:12px">╨Я╨╛╨┤╨║╨╗╤О╤З╨░╨╡╨╝ Telegram...</div>';
    ensureWebTelegramBotUsername().then(function (botUsername) {
      if (!container || !container.parentNode) return;
      if (!botUsername) {
        container.innerHTML = '<div class="empty-state" style="padding:12px">╨Т╤Е╨╛╨┤ ╤З╨╡╤А╨╡╨╖ Telegram ╨▓╤А╨╡╨╝╨╡╨╜╨╜╨╛ ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╡╨╜. ╨Э╨░╨┐╨╕╤И╨╕╤В╨╡, ╨╕ ╨╝╤Л ╨▒╤Л╤Б╤В╤А╨╛ ╨▓╨║╨╗╤О╤З╨╕╨╝ ╨╡╨│╨╛.</div>';
        return;
      }
      container.innerHTML = '';
      var isMobileWeb = !isTelegramRuntime && (window.innerWidth || 0) <= 560;
      var origin = window.location.origin;
      var returnTo = origin + '/api/auth/telegram-web/callback';
      var oauthUrl = '';
      if (webTelegramBotId) {
        oauthUrl = 'https://oauth.telegram.org/auth?bot_id=' + encodeURIComponent(webTelegramBotId) +
          '&origin=' + encodeURIComponent(origin) +
          '&return_to=' + encodeURIComponent(returnTo) +
          '&request_access=write';
      }
      // Mobile web: prefer direct Telegram OAuth URL to avoid bot/game redirects.
      var primaryAuthUrl = isMobileWeb ? (oauthUrl || webTelegramAuthUrl) : (webTelegramAuthUrl || oauthUrl);
      if (primaryAuthUrl) {
        var directWrap = document.createElement('div');
        directWrap.style.marginBottom = isMobileWeb ? '8px' : '10px';
        directWrap.innerHTML =
          '<a class="nav-btn nav-btn--filled" href="' + primaryAuthUrl + '">' +
          '╨Т╨╛╨╣╤В╨╕ ╤З╨╡╤А╨╡╨╖ Telegram' +
          '</a>';
        container.appendChild(directWrap);
      }
      // On mobile web direct redirect auth is much more stable than embedded widget.
      if (isMobileWeb) {
        if (webTelegramBotUsername) {
          var mobileHint = document.createElement('div');
          mobileHint.style.marginTop = '6px';
          mobileHint.innerHTML =
            '<a class="nav-btn" href="https://t.me/' + encodeURIComponent(webTelegramBotUsername) +
            '" target="_blank" rel="noopener">╨Ю╤В╨║╤А╤Л╤В╤М Telegram-╨▒╨╛╤В╨░</a>';
          container.appendChild(mobileHint);
        }
        return;
      }
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-userpic', 'false');
      script.setAttribute('data-request-access', 'write');
      if (webTelegramAuthUrl) {
        script.setAttribute('data-auth-url', webTelegramAuthUrl);
      }
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      container.appendChild(script);
      if (webTelegramBotUsername) {
        var linkWrap = document.createElement('div');
        linkWrap.style.marginTop = '10px';
        linkWrap.innerHTML =
          '<a class="nav-btn" href="https://t.me/' + encodeURIComponent(webTelegramBotUsername) +
          '" target="_blank" rel="noopener">╨Ю╤В╨║╤А╤Л╤В╤М Telegram-╨▒╨╛╤В╨░</a>';
        container.appendChild(linkWrap);
      }
      // Fallback OAuth link (works when embedded widget callback is blocked).
      if (oauthUrl) {
        var oauthWrap = document.createElement('div');
        oauthWrap.style.marginTop = '8px';
        oauthWrap.innerHTML =
          '<a class="nav-btn nav-btn--filled" href="' + oauthUrl + '">' +
          '╨Т╨╛╨╣╤В╨╕ ╤З╨╡╤А╨╡╨╖ Telegram (╤А╨╡╨╖╨╡╤А╨▓)' +
          '</a>';
        container.appendChild(oauthWrap);
      }
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        var warn = document.createElement('div');
        warn.className = 'empty-state';
        warn.style.padding = '8px 0 0';
        warn.style.fontSize = '12px';
        warn.style.color = '#7a1f1f';
        warn.textContent = '╨Ф╨╗╤П ╤Б╤В╨░╨▒╨╕╨╗╤М╨╜╨╛╨│╨╛ ╨▓╤Е╨╛╨┤╨░ ╤З╨╡╤А╨╡╨╖ Telegram ╨╜╤Г╨╢╨╡╨╜ HTTPS-╨┤╨╛╨╝╨╡╨╜.';
        container.appendChild(warn);
      }
    });
  }

  function initCookieConsent() {
    if (isTelegramRuntime) return;
    var banner = document.getElementById('cookie-consent');
    var okBtn = document.getElementById('cookie-consent-ok');
    if (!banner || !okBtn) return;
    var accepted = false;
    try { accepted = localStorage.getItem('arka_cookie_consent') === '1'; } catch (e) {}
    if (!accepted) banner.style.display = 'flex';
    okBtn.onclick = function () {
      try { localStorage.setItem('arka_cookie_consent', '1'); } catch (e) {}
      banner.style.display = 'none';
    };
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
    return Number(p).toLocaleString('ru-RU') + ' ╤А.';
  }

  function getPrimaryPhone() {
    var keys = ['contact_phone', 'shop_phone', 'phone', 'phone_main', 'phone_1', 'phone1'];
    for (var i = 0; i < keys.length; i++) {
      var v = String(appSettings[keys[i]] || '').trim();
      if (v) return v;
    }
    return '+7 917 212 08 78';
  }

  function phoneToTelHref(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return 'tel:+79172120878';
    if (digits.length === 11 && digits.charAt(0) === '8') digits = '7' + digits.slice(1);
    if (digits.length === 10) digits = '7' + digits;
    if (digits.charAt(0) !== '7' && digits.length === 11) digits = '7' + digits.slice(1);
    return 'tel:+' + digits;
  }

  function isBouquetCategory(catName) {
    if (!catName) return true;
    var lower = catName.toLowerCase();
    var skip = ['╨▓╨░╨╖', '╤Б╨▓╨╡╤З', '╨┐╨╛╨┤╨░╤А╨║', '╤И╨░╤А', '╨╛╤В╨║╤А╤Л╤В╨║'];
    for (var i = 0; i < skip.length; i++) {
      if (lower.indexOf(skip[i]) >= 0) return false;
    }
    return true;
  }

  function productImage(url, alt, cls) {
    if (!url) return '<div class="' + (cls || 'no-image') + '">╨д╨╛╤В╨╛</div>';
    var loading = (cls && cls.indexOf('product-detail-img') >= 0) ? 'eager' : 'lazy';
    return '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) +
      '" class="' + (cls || '') + '" loading="' + loading + '" decoding="async" onerror="this.outerHTML=\'<div class=\\\'no-image\\\'>╨д╨╛╤В╨╛</div>\'">';
  }

  var _warmedImages = {};
  function warmImage(url) {
    if (!url || _warmedImages[url]) return;
    _warmedImages[url] = true;
    var img = new Image();
    img.decoding = 'async';
    img.src = url;
  }

  function warmProductSizeImages(product) {
    if (!product) return;
    if (product.image_url) warmImage(product.image_url);
    var images = product.images || [];
    images.forEach(function (it) { if (it && it.image_url) warmImage(it.image_url); });
    var sizes = product.sizes || [];
    sizes.forEach(function (s) { if (s && s.image_url) warmImage(s.image_url); });
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

  function buildProductCard(p, idx) {
    warmProductSizeImages(p);
    var favClass = isFavorited(p.id) ? ' favorited' : '';
    var desc = p.description ? '<div class="product-card-desc">' + escapeHtml(p.description) + '</div>' : '';
    var fallbackSizeImage = (p.sizes && p.sizes.length && p.sizes[0].image_url) ? p.sizes[0].image_url : '';
    var images = p.images && p.images.length ? p.images : (p.image_url ? [{ image_url: p.image_url }] : (fallbackSizeImage ? [{ image_url: fallbackSizeImage }] : []));
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
    var priceLabel = hasMultipleSizes ? '╨╛╤В ' + formatPrice(cardPrice) : formatPrice(p.price);
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
          'onclick="switchCardSize(event,' + p.id + ',this,' + s.price + ',\'' + escapeHtml(s.dimensions || '').replace(/'/g, "\\'") + '\',\'' + escapeHtml(s.image_url || '').replace(/'/g, "\\'") + '\')">' +
          escapeHtml(s.label) + '</button>';
      });
      sizeBtnsHtml += '</div>';
    }

    var delayMs = Math.min((idx || 0) * 32, 260);
    var addBtnHtml = outOfStock ? '' : '<button class="card-add-btn" onclick="addToCartById(' + p.id + ',event)">╨Т ╨║╨╛╤А╨╖╨╕╨╜╤Г</button>';
    return '<div class="' + cardClass + ' reveal-card" style="--card-reveal-delay:' + delayMs + 'ms">' +
      '<div class="product-card-img-wrap" onclick="navigateTo(\'product\',' + p.id + ')"' +
        (images.length > 1 ? ' data-slide-count="' + images.length + '"' : '') + '>' +
        imgHtml +
        dotsHtml +
        (!outOfStock ? '<div class="stock-badge stock-badge--in">╨Т ╨╜╨░╨╗╨╕╤З╨╕╨╕</div>' : '') +
        (outOfStock ? '<div class="stock-overlay">╨б╨║╨╛╤А╨╛ ╨▒╤Г╨┤╨╡╤В ╨▓ ╨╜╨░╨╗╨╕╤З╨╕╨╕</div>' : '') +
        dimsBadge +
        '<button class="fav-btn' + favClass + '" onclick="toggleFav(' + p.id + ',event)">' + heartSvg + '</button>' +
        '' +
      '</div>' +
      '<div class="product-card-body" onclick="navigateTo(\'product\',' + p.id + ')">' +
        '<div class="product-card-name">' + escapeHtml(p.name) + '</div>' +
        sizeBtnsHtml +
        '<div class="product-card-price" id="card-price-' + p.id + '">' + priceLabel + '</div>' +
        desc +
        addBtnHtml +
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
    }, 900);
  }

  var cardRevealObserver = null;
  function initCardScrollReveal(root) {
    if (isTelegramRuntime) return;
    var scope = root || document;
    var cards = scope.querySelectorAll('.product-card');
    if (!cards || !cards.length) return;
    if (!('IntersectionObserver' in window)) {
      cards.forEach(function (c) { c.classList.add('card-inview'); });
      return;
    }
    if (!cardRevealObserver) {
      cardRevealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('card-inview');
            cardRevealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    }
    cards.forEach(function (card) {
      card.classList.remove('card-inview');
      cardRevealObserver.observe(card);
    });
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

  // Reliable hover start/stop for desktop browsers.
  document.addEventListener('pointerover', function (e) {
    var wrap = e.target.closest('.product-card-img-wrap[data-slide-count]');
    if (!wrap) return;
    var from = e.relatedTarget;
    if (from && wrap.contains(from)) return;
    startCardCycle(wrap);
  });

  document.addEventListener('pointerout', function (e) {
    var wrap = e.target.closest('.product-card-img-wrap[data-slide-count]');
    if (!wrap) return;
    var to = e.relatedTarget;
    if (to && wrap.contains(to)) return;
    stopCardCycle(wrap);
  });

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

  function parseRouteFromHash() {
    var hash = String(window.location.hash || '').replace(/^#\/?/, '');
    if (!hash) return null;
    var parts = hash.split('/');
    var page = decodeURIComponent(parts[0] || '');
    if (!page) return null;
    var param = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : null;
    if (param !== null && /^-?\d+$/.test(param)) param = parseInt(param, 10);
    return { page: page, param: param };
  }

  function pushRouteState(page, param, replace) {
    if (isTelegramRuntime || !window.history || !window.history.pushState) return;
    var cur = window.history.state;
    if (!replace && cur && cur.arkaRoute && cur.page === page && String(cur.param || '') === String(param || '')) {
      return;
    }
    var url = window.location.pathname + '#' + encodeURIComponent(page) + (param !== undefined && param !== null ? '/' + encodeURIComponent(String(param)) : '');
    var state = { arkaRoute: true, page: page, param: param === undefined ? null : param };
    if (replace) window.history.replaceState(state, '', url);
    else window.history.pushState(state, '', url);
  }

  var historyRoutingReady = false;
  function initHistoryRouting(defaultPage) {
    if (isTelegramRuntime) return;
    if (!historyRoutingReady) {
      window.addEventListener('popstate', function (e) {
        var st = e.state;
        if (st && st.arkaRoute && st.page) {
          navigateTo(st.page, st.param, true);
          return;
        }
        var parsed = parseRouteFromHash();
        if (parsed && parsed.page) {
          navigateTo(parsed.page, parsed.param, true);
          return;
        }
        navigateTo(defaultPage || 'home', null, true);
      });
      historyRoutingReady = true;
    }
    if (!(window.history.state && window.history.state.arkaRoute)) {
      pushRouteState(defaultPage || 'home', null, true);
    }
  }

  function setActiveTab(tab) {
    activeTab = tab;
    var btns = document.querySelectorAll('#tab-bar .tab-btn');
    btns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    var webBtns = document.querySelectorAll('#web-quick-nav .web-quick-nav-btn');
    webBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    var webToolbarBtns = document.querySelectorAll('.web-toolbar-action-btn');
    webToolbarBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
  }

  function setWebQuickNavOpen(open) {
    var nav = document.getElementById('web-quick-nav');
    var toggle = document.getElementById('web-quick-toggle');
    if (!nav || !toggle) return;
    var isOpen = !!open;
    nav.classList.toggle('web-quick-nav--open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function setWebQuickNavHidden(hidden) {
    var nav = document.getElementById('web-quick-nav');
    if (!nav) return;
    nav.classList.toggle('web-quick-nav--hidden', !!hidden);
  }

  function syncWebQuickNavVisibility(page) {
    if (isTelegramRuntime) return;
    if (page && page !== 'home') {
      setWebQuickNavHidden(false);
      return;
    }
    var hero = document.getElementById('site-hero');
    if (!hero) {
      setWebQuickNavHidden(false);
      return;
    }
    var rect = hero.getBoundingClientRect();
    var viewH = window.innerHeight || 1;
    var travel = Math.max((hero.offsetHeight || 1) - viewH, 1);
    var progress = (-rect.top) / travel;
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;
    // Show burger only after brand text stage starts.
    setWebQuickNavHidden(progress < 0.5);
  }

  function initWebQuickNav() {
    if (isTelegramRuntime) return;
    var nav = document.getElementById('web-quick-nav');
    var toggle = document.getElementById('web-quick-toggle');
    if (!nav || !toggle) return;
    if (nav.getAttribute('data-ready') === '1') return;
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setWebQuickNavOpen(!nav.classList.contains('web-quick-nav--open'));
    });
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('web-quick-nav--open')) return;
      if (!nav.contains(e.target)) {
        setWebQuickNavOpen(false);
      }
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setWebQuickNavOpen(false);
    });
    nav.setAttribute('data-ready', '1');
  }

  function updateCartBadge() {
    var badge = document.getElementById('cart-badge');
    var webBadge = document.getElementById('web-cart-badge');
    var webToolbarBadge = document.getElementById('web-toolbar-cart-badge');
    var cart = getCart();
    var count = cart.reduce(function (s, i) { return s + i.quantity; }, 0);
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    if (webBadge) {
      if (count > 0) {
        webBadge.textContent = count;
        webBadge.style.display = 'inline-block';
      } else {
        webBadge.style.display = 'none';
      }
    }
    if (webToolbarBadge) {
      if (count > 0) {
        webToolbarBadge.textContent = count;
        webToolbarBadge.style.display = 'inline-block';
      } else {
        webToolbarBadge.style.display = 'none';
      }
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

  function getNightDateContext(selectedDateStr) {
    var src = String(selectedDateStr || '').trim();
    if (!src) return null;
    var d = 0, m = 0, y = 0;

    // Supports both formats used in app/admin:
    // - client date input: YYYY-MM-DD
    // - admin stored date: DD.MM.YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(src)) {
      var i = src.split('-');
      y = parseInt(i[0], 10);
      m = parseInt(i[1], 10) - 1;
      d = parseInt(i[2], 10);
    } else {
      var p = src.split('.');
      if (p.length !== 3) return null;
      d = parseInt(p[0], 10);
      m = parseInt(p[1], 10) - 1;
      y = parseInt(p[2], 10);
    }
    if (!d || m < 0 || !y) return null;
    var dt = new Date(y, m, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
    return {
      iso: y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'),
      dmy: String(d).padStart(2, '0') + '.' + String(m + 1).padStart(2, '0') + '.' + y,
      monthKey: y + '-' + String(m + 1).padStart(2, '0'),
      week: Math.ceil(d / 7),
      weekday: (dt.getDay() + 6) % 7 + 1
    };
  }

  function isNightDisabledForSelectedDate(selectedDateStr) {
    var selectedCtx = getNightDateContext(selectedDateStr);
    if (!selectedCtx) return false;

    var datesRaw = appSettings.night_disabled_dates;
    if (datesRaw) {
      try {
        var dateList = JSON.parse(datesRaw);
        if (Array.isArray(dateList) && dateList.length) {
          for (var i = 0; i < dateList.length; i++) {
            var itemCtx = getNightDateContext(dateList[i]);
            if (!itemCtx) continue;
            if (itemCtx.iso === selectedCtx.iso) return true;
          }
        }
      } catch (e) {}
    }

    var weekdayRaw = appSettings.night_disabled_weekdays;
    if (weekdayRaw) {
      try {
        var weekdayList = JSON.parse(weekdayRaw);
        if (Array.isArray(weekdayList) && weekdayList.length) {
          if (weekdayList.indexOf(selectedCtx.weekday) >= 0) return true;
        }
      } catch (e) {}
    }

    var raw = appSettings.night_disabled_calendar;
    if (!raw) return false;
    var cal;
    try {
      cal = JSON.parse(raw);
    } catch (e) {
      return false;
    }
    if (!cal || typeof cal !== 'object') return false;
    var monthCfg = cal[selectedCtx.monthKey];
    if (!monthCfg || typeof monthCfg !== 'object') return false;
    var days = monthCfg[String(selectedCtx.week)];
    if (!Array.isArray(days)) return false;
    return days.indexOf(selectedCtx.weekday) >= 0;
  }

  function getIntervalsSplit() {
    var isHoliday = isHolidayToday();
    var dayKey = isHoliday ? 'intervals_holiday_day' : 'intervals_regular_day';
    var nightKey = isHoliday ? 'intervals_holiday_night' : 'intervals_regular_night';
    var day = [], night = [];

    if (appSettings[dayKey]) {
      try { day = JSON.parse(appSettings[dayKey]); } catch (e) {}
      try { night = JSON.parse(appSettings[nightKey] || '[]'); } catch (e) {}
    } else {
      var all = getIntervals();
      all.forEach(function (iv) {
        var p = iv.split('-');
        var sH = parseInt(p[0]); var eH = parseInt(p[1]);
        (eH <= sH ? night : day).push(iv);
      });
    }
    var selectedDateVal = '';
    var dateEl = document.getElementById('field-date');
    if (dateEl && dateEl.value) selectedDateVal = dateEl.value;
    if (isNightDisabledForSelectedDate(selectedDateVal)) {
      night = [];
    }
    return { day: day, night: night };
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

  function refreshWebSessionAuth(silent) {
    if (isTelegramRuntime) return Promise.resolve(false);
    return fetchJSON('/api/auth/session').then(function (r) {
      var nextUser = (r && r.user) ? r.user : null;
      var prevId = dbUser && dbUser.telegram_id ? String(dbUser.telegram_id) : '';
      var nextId = nextUser && nextUser.telegram_id ? String(nextUser.telegram_id) : '';
      var changed = prevId !== nextId;
      dbUser = nextUser;
      if (nextUser) {
        try { localStorage.setItem('arka_tg_id', String(nextUser.telegram_id || '')); } catch (e) {}
        try { localStorage.setItem('arka_user', JSON.stringify(nextUser)); } catch (e) {}
      }
      if (changed) {
        updateFavBadge();
        updateCartBadge();
        if (activeTab === 'account') showAccount();
        if (!silent && nextUser) showToast('╨Т╤Е╨╛╨┤ ╤З╨╡╤А╨╡╨╖ Telegram ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜');
      }
      return changed;
    }).catch(function () {
      return false;
    });
  }

  function init() {
    applyRuntimeLayoutMode();
    initSitePreloader();
    initWebQuickNav();
    initCookieConsent();

    var settingsReady = fetchAppSettings().catch(function () {
      appSettings = appSettings || {};
      return appSettings;
    });

    fetchJSON('/api/cities').then(function (cities) {
      citiesList = cities || [];
    });

    function finishInitUI() {
      var hasCity = checkCityOnStart();
      var initialRoute = parseRouteFromHash();
      var initialPage = 'home';
      var forceAccount = false;
      try {
        var sp = new URLSearchParams(window.location.search || '');
        forceAccount = sp.get('tg_auth') === '1';
      } catch (e) {}
      if (initialRoute && initialRoute.page) {
        initialPage = initialRoute.page;
        navigateTo(initialRoute.page, initialRoute.param, true);
      } else if (forceAccount) {
        initialPage = 'account';
        refreshWebSessionAuth(true).finally(function () {
          navigateTo('account', null, true);
        });
      } else {
        showHome();
      }
      initHistoryRouting(initialPage);
      updateCartBadge();
      updateFavBadge();
      if (!hasCity) showCityOverlay();
      if (forceAccount) {
        try {
          window.history.replaceState({}, '', window.location.pathname + (window.location.hash || '#account'));
        } catch (e) {}
        showToast('╨Т╤Е╨╛╨┤ ╤З╨╡╤А╨╡╨╖ Telegram ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜');
      }
    }

    if (tgUser) {
      postJSON('/api/auth/telegram', {
        telegram_id: tgUser.id,
        first_name: tgUser.first_name || '',
        username: tgUser.username || '',
        init_data: tg ? tg.initData : ''
      }).then(function (r) {
        if (r && r.user) {
          dbUser = r.user;
          try { localStorage.setItem('arka_tg_id', String(tgUser.id)); } catch (e) {}
          try { localStorage.setItem('arka_user', JSON.stringify(r.user)); } catch (e) {}
        }
      }).catch(function () {}).finally(function () {
        settingsReady.finally(function () {
          finishInitUI();
        });
      });
      return;
    }

    try {
      var savedUser = localStorage.getItem('arka_user');
      if (savedUser) dbUser = JSON.parse(savedUser);
    } catch (e) {}

    ensureWebTelegramBotUsername();
    fetchJSON('/api/auth/session').then(function (r) {
      if (r && r.user) {
        dbUser = r.user;
        try { localStorage.setItem('arka_tg_id', String(r.user.telegram_id || '')); } catch (e) {}
        try { localStorage.setItem('arka_user', JSON.stringify(r.user)); } catch (e) {}
      }
    }).catch(function () {}).finally(function () {
      settingsReady.finally(function () {
        finishInitUI();
      });
    });

    if (!isTelegramRuntime) {
      window.addEventListener('focus', function () {
        refreshWebSessionAuth(true);
      });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) refreshWebSessionAuth(true);
      });
    } else {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) return;
        fetchAppSettings().then(function () {
          if (activeTab === 'home') showHome(homeActiveCategory);
        }).catch(function () {});
      });
    }
  }

  function updateSocialLinks() {
    var el = document.getElementById('social-links');
    if (!el) return;
    var links = [];
    if (appSettings.social_telegram) links.push('<a href="' + escapeHtml(appSettings.social_telegram) + '" target="_blank">Telegram</a>');
    if (appSettings.social_instagram) links.push('<a href="' + escapeHtml(appSettings.social_instagram) + '" target="_blank">Instagram</a>');
    if (appSettings.social_vk) links.push('<a href="' + escapeHtml(appSettings.social_vk) + '" target="_blank">╨Т╨Ъ╨╛╨╜╤В╨░╨║╤В╨╡</a>');
    if (links.length) el.innerHTML = links.join('');
  }

  // ============================================================
  // Pages
  // ============================================================

  var homeActiveCategory = null;
  var homeCategoriesById = {};
  var webHomeDataCache = null;
  var webHomeSearchQuery = '';

  function normalizeCategoryId(id) {
    if (id === null || id === undefined || id === '') return null;
    return String(id);
  }

  function formatCategoryTitle(title) {
    var t = String(title || '').trim();
    if (!t) return '╨Ъ╨░╤В╨╡╨│╨╛╤А╨╕╤П';
    var range = parseCategoryPriceRange(t);
    if (range) {
      var formatMoney = function (n) {
        var num = parseInt(n, 10);
        if (isNaN(num) || num < 0) num = 0;
        return num.toLocaleString('ru-RU');
      };
      if (range.min !== null && range.max !== null) {
        return formatMoney(range.min) + ' тАФ ' + formatMoney(range.max) + ' ╨а';
      }
      if (range.max !== null) {
        return '╨Ф╨╛ ' + formatMoney(range.max) + ' ╨а';
      }
      if (range.min !== null) {
        return '╨Ю╤В ' + formatMoney(range.min) + ' ╨а';
      }
    }
    t = t
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/╤А╤Г╨▒\.?/gi, '╨а')
      .replace(/тВ╜/g, '╨а')
      .trim();
    return t;
  }

  function formatCategoryChipTitle(title) {
    var t = String(title || '').trim();
    if (!t) return '╨Ъ╨░╤В╨╡╨│╨╛╤А╨╕╤П';
    var range = parseCategoryPriceRange(t);
    if (range) {
      var formatMoney = function (n) {
        var num = parseInt(n, 10);
        if (isNaN(num) || num < 0) num = 0;
        return num.toLocaleString('ru-RU');
      };
      if (range.min !== null && range.max !== null) {
        return formatMoney(range.min) + ' - ' + formatMoney(range.max);
      }
      if (range.max !== null) {
        return '╨Ф╨╛ ' + formatMoney(range.max);
      }
      if (range.min !== null) {
        return '╨Ю╤В ' + formatMoney(range.min);
      }
    }
    return t.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function getCategorySortMeta(catName) {
    var raw = String(catName || '').toLowerCase();
    var range = parseCategoryPriceRange(catName);
    if (range) {
      var start = 0;
      if (range.min !== null) start = range.min;
      else if (range.max !== null) start = 0;
      return { group: 0, rank: start, tail: range.max !== null ? range.max : 9999999 };
    }
    var tailMap = [
      { key: '╨▓╨░╨╖', rank: 1 },
      { key: '╤Б╨▓╨╡╤З', rank: 2 },
      { key: '╤И╨░╤А', rank: 3 },
      { key: '╨┐╨╛╨┤╨░╤А', rank: 4 },
      { key: '╨╛╤В╨║╤А╤Л╤В╨║', rank: 5 }
    ];
    for (var i = 0; i < tailMap.length; i++) {
      if (raw.indexOf(tailMap[i].key) >= 0) {
        return { group: 1, rank: tailMap[i].rank, tail: tailMap[i].rank };
      }
    }
    return { group: 2, rank: 9999, tail: 9999 };
  }

  function shouldShowSiteHero() {
    if (isTelegramRuntime) return false;
    var isDesktop = (window.innerWidth || 0) >= 900;
    if (!isDesktop) return true;
    return !desktopHeroShownThisLoad;
  }

  function renderWebCategorySectionsFromCache() {
    if (!webHomeDataCache) return;
    var cats = webHomeDataCache.cats || [];
    var products = webHomeDataCache.products || [];
    var grouped = {};
    products.forEach(function (p) {
      var cid = p.category_id;
      if (!grouped[cid]) grouped[cid] = [];
      grouped[cid].push(p);
    });
    var visibleCats = cats.filter(function (c) {
      return grouped[c.id] && grouped[c.id].length;
    });
    var indexedCats = {};
    cats.forEach(function (c, i) { indexedCats[c.id] = i; });
    visibleCats.sort(function (a, b) {
      var ma = getCategorySortMeta(a.name);
      var mb = getCategorySortMeta(b.name);
      if (ma.group !== mb.group) return ma.group - mb.group;
      if (ma.rank !== mb.rank) return ma.rank - mb.rank;
      if (ma.tail !== mb.tail) return ma.tail - mb.tail;
      return (indexedCats[a.id] || 0) - (indexedCats[b.id] || 0);
    });
    if (homeActiveCategory !== null) {
      visibleCats = visibleCats.filter(function (c) {
        return normalizeCategoryId(c.id) === normalizeCategoryId(homeActiveCategory);
      });
    }

    var q = String(webHomeSearchQuery || '').trim().toLowerCase();
    var el = document.getElementById('web-category-sections');
    if (!el) return;
    if (!visibleCats.length) {
      el.innerHTML = '<div class="empty-state">╨Т ╤Н╤В╨╛╨╣ ╨║╨░╤В╨╡╨│╨╛╤А╨╕╨╕ ╨┐╨╛╨║╨░ ╨╜╨╡╤В ╤В╨╛╨▓╨░╤А╨╛╨▓</div>';
      return;
    }
    var html = visibleCats.map(function (c, catIdx) {
      var items = grouped[c.id].slice();
      items = items.filter(function (p) {
        if (!q) return true;
        var hay = (String(p.name || '') + ' ' + String(p.description || '')).toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      if (!items.length) return '';
      items.sort(function (a, b) {
        var pa = getProductMinPrice(a);
        var pb = getProductMinPrice(b);
        if (pa !== pb) return pa - pb;
        return (b.in_stock !== 0 ? 1 : 0) - (a.in_stock !== 0 ? 1 : 0);
      });
      var cards = items.map(function (p, idx) { return buildProductCard(p, idx); }).join('');
      return '' +
        '<section class="web-category-section" style="--section-delay:' + Math.min(catIdx * 40, 260) + 'ms">' +
          '<div class="web-category-head">' +
            '<div class="web-category-title">' + escapeHtml(formatCategoryTitle(c.name)) + '</div>' +
          '</div>' +
          '<div class="product-list">' + cards + '</div>' +
        '</section>';
    }).join('');
    el.innerHTML = html || '<div class="empty-state">╨Я╨╛ ╨▓╨░╤И╨╡╨╝╤Г ╨╖╨░╨┐╤А╨╛╤Б╤Г ╨╜╨╕╤З╨╡╨│╨╛ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨╛</div>';
    initCardScrollReveal(el);
  }

  function renderWebQuickCategories(cats) {
    var el = document.getElementById('web-quick-cats');
    if (!el) return;
    if (!cats || !cats.length) {
      el.innerHTML = '';
      return;
    }
    var sorted = (cats || []).slice();
    var indexedCats = {};
    sorted.forEach(function (c, i) { indexedCats[c.id] = i; });
    sorted.sort(function (a, b) {
      var ma = getCategorySortMeta(a.name);
      var mb = getCategorySortMeta(b.name);
      if (ma.group !== mb.group) return ma.group - mb.group;
      if (ma.rank !== mb.rank) return ma.rank - mb.rank;
      if (ma.tail !== mb.tail) return ma.tail - mb.tail;
      return (indexedCats[a.id] || 0) - (indexedCats[b.id] || 0);
    });

    var activeCatId = normalizeCategoryId(homeActiveCategory);
    var html = '<button class="web-quick-cat-chip' + (activeCatId === null ? ' active' : '') + '" onclick="webHomePickCategory(null)">╨Т╤Б╨╡</button>';
    html += sorted.map(function (c) {
      var cidNorm = normalizeCategoryId(c.id);
      return '<button class="web-quick-cat-chip' + (activeCatId === cidNorm ? ' active' : '') + '" onclick="webHomePickCategory(' + c.id + ')">' + escapeHtml(formatCategoryChipTitle(c.name)) + '</button>';
    }).join('');
    el.innerHTML = html;
  }

  function bindMobileQuickCatsLayerBehavior() {
    if (detachMobileQuickCatsScroll) {
      detachMobileQuickCatsScroll();
      detachMobileQuickCatsScroll = null;
    }
    // Keep categories always visible on mobile web.
    // No auto-collapse on scroll.
    document.body.classList.remove('web-mobile-cats-collapsed');
    try { localStorage.removeItem(MOBILE_CATS_COLLAPSED_KEY); } catch (e) {}
  }

  function applyRuntimeLayoutMode() {
    if (!document || !document.body) return;
    document.body.classList.toggle('web-mode', !isTelegramRuntime);
    document.body.classList.toggle('telegram-mode', isTelegramRuntime);
  }

  function initSitePreloader() {
    var pre = document.getElementById('site-preloader');
    if (!pre) return;
    document.body.classList.remove('site-preloader-active');
    pre.style.display = 'none';
    if (pre.parentNode) pre.parentNode.removeChild(pre);
  }

  function bindHomeHeroAnimation() {
    if (detachHomeHeroScroll) {
      detachHomeHeroScroll();
      detachHomeHeroScroll = null;
    }
    var heroSection = document.getElementById('site-hero');
    if (!heroSection) {
      if (document && document.body) {
        document.body.classList.remove('mobile-toolbar-fixed');
      }
      return;
    }
    if (heroSection.classList.contains('site-hero--desktop-script')) {
      var desktopSlides = heroSection.querySelectorAll('.site-hero-script-slide');
      var desktopTimers = [];
      var destroyed = false;
      var activateDesktopSlide = function (idx) {
        for (var i = 0; i < desktopSlides.length; i++) {
          desktopSlides[i].classList.toggle('is-active', i === idx);
        }
      };
      var completeDesktopHero = function () {
        if (destroyed) return;
        heroSection.classList.add('site-hero--done');
        desktopHeroShownThisLoad = true;
        desktopTimers.push(setTimeout(function () {
          document.body.classList.remove('site-hero-lock');
          document.body.classList.remove('site-cover-active');
          document.body.classList.add('site-opening-after-cover');
          if (heroSection && heroSection.parentNode) heroSection.parentNode.removeChild(heroSection);
          setTimeout(function () { document.body.classList.remove('site-opening-after-cover'); }, 820);
          syncWebQuickNavVisibility('home');
        }, 560));
      };
      document.body.classList.add('site-hero-lock');
      document.body.classList.add('site-cover-active');
      activateDesktopSlide(0);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!destroyed && heroSection) heroSection.classList.add('site-hero--ready');
        });
      });
      desktopTimers.push(setTimeout(function () { activateDesktopSlide(1); }, 1300));
      desktopTimers.push(setTimeout(function () {
        heroSection.classList.add('site-hero--script-end');
      }, 3500));
      desktopTimers.push(setTimeout(function () { completeDesktopHero(); }, 3980));
      detachHomeHeroScroll = function () {
        destroyed = true;
        for (var t = 0; t < desktopTimers.length; t++) clearTimeout(desktopTimers[t]);
        document.body.classList.remove('site-hero-lock');
        document.body.classList.remove('site-cover-active');
        document.body.classList.remove('site-opening-after-cover');
        syncWebQuickNavVisibility(activeTab);
      };
      return;
    }
    var targetRawProgress = 0;
    var currentRawProgress = 0;
    var rafId = 0;
    var running = true;
    var reducedMotion = false;
    try { reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reducedMotion) {
      heroSection.style.setProperty('--hero-intro-progress', '1');
      heroSection.style.setProperty('--hero-title-progress', '1');
      heroSection.style.setProperty('--hero-subtitle-progress', '1');
      heroSection.style.setProperty('--hero-section-progress', '1');
      heroSection.style.setProperty('--hero-image-progress', '1');
      return;
    }
    var updateTargetsFromScroll = function () {
      var rect = heroSection.getBoundingClientRect();
      var viewH = window.innerHeight || 1;
      var travel = Math.max((heroSection.offsetHeight || 1) - viewH, 1);
      var raw = (-rect.top) / travel;
      if (raw < 0) raw = 0;
      if (raw > 1) raw = 1;
      targetRawProgress = raw;
    };
    var syncMobileToolbarFixed = function () {
      if (isTelegramRuntime || (window.innerWidth || 0) > 560) {
        document.body.classList.remove('mobile-toolbar-fixed');
        return;
      }
      var rect = heroSection.getBoundingClientRect();
      var styles = window.getComputedStyle ? window.getComputedStyle(document.body) : null;
      var marqueeOffset = styles ? parseFloat(styles.getPropertyValue('--web-marquee-offset')) : 36;
      if (!isFinite(marqueeOffset)) marqueeOffset = 36;
      var fixedTop = marqueeOffset + 8;
      var heroPassed = rect.bottom <= (fixedTop + 6);
      document.body.classList.toggle('mobile-toolbar-fixed', heroPassed);
    };
    var tick = function () {
      if (!running) return;
      currentRawProgress += (targetRawProgress - currentRawProgress) * 0.085;
      if (Math.abs(targetRawProgress - currentRawProgress) < 0.0008) {
        currentRawProgress = targetRawProgress;
      }
      var rawProgress = currentRawProgress;
      var introProgress = rawProgress / 0.52;
      if (introProgress > 1) introProgress = 1;
      if (introProgress < 0) introProgress = 0;

      var titleProgress = (rawProgress - 0.44) / 0.42;
      if (titleProgress > 1) titleProgress = 1;
      if (titleProgress < 0) titleProgress = 0;

      var subProgress = 0;
      if (rawProgress > 0.79) {
        subProgress = (rawProgress - 0.79) / 0.2;
        if (subProgress > 1) subProgress = 1;
      }
      var imageProgress = (rawProgress - 0.34) / 0.5;
      if (imageProgress > 1) imageProgress = 1;
      if (imageProgress < 0) imageProgress = 0;

      heroSection.style.setProperty('--hero-intro-progress', introProgress.toFixed(3));
      heroSection.style.setProperty('--hero-title-progress', titleProgress.toFixed(3));
      heroSection.style.setProperty('--hero-subtitle-progress', subProgress.toFixed(3));
      heroSection.style.setProperty('--hero-section-progress', titleProgress.toFixed(3));
      heroSection.style.setProperty('--hero-image-progress', imageProgress.toFixed(3));
      rafId = requestAnimationFrame(tick);
    };
    var onScroll = function () {
      updateTargetsFromScroll();
      syncMobileToolbarFixed();
      syncWebQuickNavVisibility('home');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateTargetsFromScroll();
    syncMobileToolbarFixed();
    syncWebQuickNavVisibility('home');
    tick();
    detachHomeHeroScroll = function () {
      running = false;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      document.body.classList.remove('mobile-toolbar-fixed');
      syncWebQuickNavVisibility(activeTab);
    };
  }

  function buildHomeHero(cityName) {
    var isDesktop = !isTelegramRuntime && (window.innerWidth || 0) >= 900;
    if (isDesktop) {
      var scriptHeadline = '╨Т╤Л╤А╨░╨╖╨╕╤В╨╡ ╤Б╨▓╨╛╨╕ ╤З╤Г╨▓╤Б╤В╨▓╨░';
      var scriptBrand = '╨Р╨а╨Ъ╨Р ╨б╨в╨г╨Ф╨Ш╨п ╨ж╨Т╨Х╨в╨Ю╨Т';
      var scriptDelivery = '╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨┐╨╛ ╨б╨░╤А╨░╤В╨╛╨▓╤Г ╨╕ ╨н╨╜╨│╨╡╨╗╤М╤Б╤Г';
      var wrapChars = function (text, className, baseDelay, stepDelay) {
        var safeText = String(text || '');
        var html = '';
        for (var i = 0; i < safeText.length; i++) {
          var ch = safeText.charAt(i);
          var code = safeText.charCodeAt(i);
          var rendered = ch === ' ' ? '&nbsp;' : escapeHtml(ch);
          var delay = baseDelay + (i * stepDelay);
          html += '<span class="site-hero-script-char" style="animation-delay:' + delay + 'ms">' + rendered + '</span>';
          if (code === 8212 || code === 45) {
            html += '<span class="site-hero-script-char-spacer" aria-hidden="true"></span>';
          }
        }
        return '<div class="' + className + '">' + html + '</div>';
      };
      return '' +
        '<section id="site-hero" class="site-hero site-hero--desktop-script">' +
          '<div class="site-hero-stage">' +
            '<div class="site-hero-script-slides">' +
              '<div class="site-hero-script-slide is-active">' +
                '<div class="site-hero-script-lead">' + escapeHtml(scriptHeadline) + '</div>' +
              '</div>' +
              '<div class="site-hero-script-slide">' +
                '<div class="site-hero-script-layer">' +
                  wrapChars(scriptBrand, 'site-hero-script-line site-hero-script-line--brand', 260, 34) +
                  '<div class="site-hero-script-sub-fade">' + escapeHtml(scriptDelivery) + '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>';
    }
    return '' +
      '<section id="site-hero" class="site-hero">' +
        '<div class="site-hero-stage">' +
          '<div class="site-hero-intro">' +
            '<div class="site-hero-intro-title">╨Т╤Л╤А╨░╨╖╨╕╤В╨╡ ╤Б╨▓╨╛╨╕ ╤З╤Г╨▓╤Б╤В╨▓╨░</div>' +
            '<div class="site-hero-intro-arrow" aria-hidden="true">&#8595;</div>' +
          '</div>' +
          '<div class="site-hero-brand site-hero-brand--textonly">' +
            '<div class="site-hero-title">╨Р╨а╨Ъ╨Р ╨б╨в╨г╨Ф╨Ш╨п ╨ж╨Т╨Х╨в╨Ю╨Т</div>' +
            '<div class="site-hero-subtitle">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨┐╨╛ ╨б╨░╤А╨░╤В╨╛╨▓╤Г ╨╕ ╨н╨╜╨│╨╡╨╗╤М╤Б╤Г</div>' +
          '</div>' +
          '<div class="site-hero-hint">╨б╨║╤А╨╛╨╗╨╗ ╨▓╨╜╨╕╨╖</div>' +
        '</div>' +
      '</section>';
  }

  function buildWebStoreInfoSection() {
    var phone = String(appSettings.phone_main || appSettings.contact_phone || '+7 917 212 08 78').trim();
    var email = String(appSettings.contact_email || appSettings.email || 'arkaflowers@inbox.ru').trim();
    var address = String(appSettings.pickup_address || '╨│. ╨б╨░╤А╨░╤В╨╛╨▓, 3-╨╣ ╨Ф╨╡╨│╤В╤П╤А╨╜╤Л╨╣ ╨┐╤А., ╨┤. 21, ╨║╨╛╤А╨┐. 3').trim();
    var hours = String(appSettings.work_hours || '╨╡╨╢╨╡╨┤╨╜╨╡╨▓╨╜╨╛ ╤Б 10:00 ╨┤╨╛ 21:00').trim();
    var tgLink = appSettings.social_telegram ? String(appSettings.social_telegram) : '';
    var waLink = phone ? ('https://wa.me/' + phone.replace(/\D/g, '')) : '';
    var igLink = appSettings.social_instagram ? String(appSettings.social_instagram) : '';

    var socials = '';
    if (igLink) socials += '<a class="web-store-social-btn" href="' + escapeHtml(igLink) + '" target="_blank" rel="noopener noreferrer" aria-label="Instagram">IG</a>';
    if (waLink) socials += '<a class="web-store-social-btn" href="' + escapeHtml(waLink) + '" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WA</a>';
    if (tgLink) socials += '<a class="web-store-social-btn" href="' + escapeHtml(tgLink) + '" target="_blank" rel="noopener noreferrer" aria-label="Telegram">TG</a>';

    return '' +
      '<section class="web-store-info">' +
        '<h2 class="web-store-info-title">╨Т╨л ╨Ь╨Ю╨Ц╨Х╨в╨Х ╨Ч╨Р╨Ъ╨Р╨Ч╨Р╨в╨м ╨Ш ╨Ч╨Р╨С╨а╨Р╨в╨м ╨С╨г╨Ъ╨Х╨в ╨Т ╨Э╨Р╨и╨Х╨Ь ╨Ь╨Р╨У╨Р╨Ч╨Ш╨Э╨Х</h2>' +
        '<div class="web-store-info-grid">' +
          '<div class="web-store-info-col">' +
            '<div class="web-store-info-head">ARKA FLOWERS</div>' +
            '<div class="web-store-info-line">' + escapeHtml(address) + '</div>' +
            '<a class="web-store-info-link" href="https://yandex.ru/maps" target="_blank" rel="noopener noreferrer">╨Ъ╨░╨║ ╨┤╨╛╨╡╤Е╨░╤В╤М?</a>' +
          '</div>' +
          '<div class="web-store-info-col">' +
            '<div class="web-store-info-head">╨б╨▓╤П╨╖╨░╤В╤М╤Б╤П ╤Б ╨╜╨░╨╝╨╕</div>' +
            '<div class="web-store-info-line">' + escapeHtml(phone) + '</div>' +
            '<div class="web-store-info-line">' + escapeHtml(email) + '</div>' +
            '<a class="web-store-call-btn" href="tel:' + escapeHtml(phone.replace(/\s+/g, '')) + '">╨Я╨╛╨╖╨▓╨╛╨╜╨╕╤В╤М</a>' +
          '</div>' +
          '<div class="web-store-info-col">' +
            '<div class="web-store-info-head">╨а╨╡╨╢╨╕╨╝ ╤А╨░╨▒╨╛╤В╤Л</div>' +
            '<div class="web-store-info-line">' + escapeHtml(hours) + '</div>' +
          '</div>' +
          '<div class="web-store-info-col">' +
            '<div class="web-store-info-head">╨б╨╛╤Ж╨╕╨░╨╗╤М╨╜╤Л╨╡ ╤Б╨╡╤В╨╕</div>' +
            '<div class="web-store-info-line">╨Я╨╛╨┤╨┐╨╕╤Б╤Л╨▓╨░╨╣╤В╨╡╤Б╤М ╨╕ ╤Б╨╗╨╡╨┤╨╕╤В╨╡ ╨╖╨░ ╨╜╨╛╨▓╨╕╨╜╨║╨░╨╝╨╕</div>' +
            '<div class="web-store-socials">' + socials + '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function normalizeMarqueeItems(raw) {
    var src = String(raw || '');
    var parts = src.split(/[\n|тАв;,]+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var cleaned = String(parts[i] || '').replace(/\s+/g, ' ').trim();
      if (!cleaned) continue;
      if (cleaned.length > 84) cleaned = cleaned.slice(0, 84).trim();
      out.push(cleaned);
    }
    if (!out.length) out = ['╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨║╤А╤Г╨│╨╗╨╛╤Б╤Г╤В╨╛╤З╨╜╨╛'];
    return out;
  }

  function buildWebMarqueeBar() {
    var enabled = String(appSettings.marquee_enabled || '1') !== '0';
    if (!enabled) return '';
    var items = normalizeMarqueeItems(appSettings.marquee_text || '');
    var speedRaw = isTelegramRuntime
      ? (appSettings.marquee_speed_sec_mini || appSettings.marquee_speed_sec || '18')
      : (appSettings.marquee_speed_sec_web || appSettings.marquee_speed_sec || '18');
    var directionRaw = isTelegramRuntime
      ? (appSettings.marquee_direction_mini || appSettings.marquee_direction || 'left')
      : (appSettings.marquee_direction_web || appSettings.marquee_direction || 'left');
    var speed = parseFloat(speedRaw);
    if (isNaN(speed) || speed < 8) speed = 8;
    if (speed > 60) speed = 60;
    var direction = String(directionRaw || 'left').toLowerCase() === 'right' ? 'right' : 'left';
    // Repeat phrases inside one group so even short text keeps continuous flow.
    var loops = Math.max(4, Math.ceil(18 / Math.max(1, items.length)));
    var group = '';
    for (var l = 0; l < loops; l++) {
      for (var i = 0; i < items.length; i++) {
        group += '<span class="web-marquee-item">' + escapeHtml(items[i]) + '</span><span class="web-marquee-sep" aria-hidden="true">тАв</span>';
      }
    }
    return '' +
      '<section class="web-marquee' + (isTelegramRuntime ? ' web-marquee--mini' : '') + '" aria-label="╨Ш╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤П ╨╛ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╡">' +
        '<div class="web-marquee-track' + (direction === 'right' ? ' web-marquee-track--right' : '') + '" style="--marquee-duration:' + speed + 's">' +
          '<div class="web-marquee-group">' + group + '</div>' +
          '<div class="web-marquee-group" aria-hidden="true">' + group + '</div>' +
        '</div>' +
      '</section>';
  }

  function buildWebTopHeaderBar() {
    if (isTelegramRuntime) return '';
    var marqueeBeforeToolbar = buildWebMarqueeBar();
    var marqueeInsideToolbar = '';
    var shopPhone = getPrimaryPhone();
    var shopPhoneEsc = escapeHtml(shopPhone);
    var shopPhoneTel = phoneToTelHref(shopPhone);
    return '' +
      marqueeBeforeToolbar +
      '<section class="web-shop-toolbar web-shop-toolbar--no-hero">' +
        marqueeInsideToolbar +
        '<div class="web-shop-topline web-shop-topline--header">' +
          '<div id="web-call-wrap" class="web-call-wrap">' +
            '<button class="web-call-btn" type="button" aria-label="╨Я╨╛╨╖╨▓╨╛╨╜╨╕╤В╤М" onclick="toggleWebCallPanel(event)">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.3 15.3 0 0 0 6.6 6.6l2.2-2.2c.2-.2.5-.3.8-.2 1 .3 2 .4 3 .4.5 0 .9.4.9.9V20c0 .5-.4.9-.9.9C10.7 20.9 3.1 13.3 3.1 3.9c0-.5.4-.9.9-.9h3.7c.5 0 .9.4.9.9 0 1 .1 2 .4 3 .1.3 0 .6-.2.8l-2.2 2.2z"/></svg>' +
            '</button>' +
            '<div id="web-call-panel" class="web-call-panel" onclick="event.stopPropagation()">' +
              '<a href="' + shopPhoneTel + '" class="web-call-panel-link">╨Я╨╛╨╖╨▓╨╛╨╜╨╕╤В╤М: ' + shopPhoneEsc + '</a>' +
            '</div>' +
          '</div>' +
          '<button class="web-header-logo" type="button" onclick="navigateTo(\'home\')" aria-label="ARKA FLOWERS">' +
            '<img src="/images/logo.svg" alt="╨Р╨а╨Ъ╨Р ╨б╨в╨г╨Ф╨Ш╨п ╨ж╨Т╨Х╨в╨Ю╨Т">' +
          '</button>' +
          '<div class="web-toolbar-actions web-toolbar-actions--header">' +
            '<button class="web-toolbar-action-btn" data-tab="account" onclick="navigateTo(\'account\')" aria-label="╨Я╤А╨╛╤Д╨╕╨╗╤М">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.2 4.2 0 1 1 0-8.4A4.2 4.2 0 0 1 12 12zm0 2c4.2 0 7.6 2.6 7.6 5.8 0 .6-.4 1-1 1H5.4c-.6 0-1-.4-1-1C4.4 16.6 7.8 14 12 14zm0 2c-2.8 0-5 1.4-5.5 2.8h11c-.5-1.4-2.7-2.8-5.5-2.8z"/></svg>' +
            '</button>' +
            '<button class="web-toolbar-action-btn" data-tab="favorites" onclick="navigateTo(\'favorites\')" aria-label="╨Ш╨╖╨▒╤А╨░╨╜╨╜╨╛╨╡">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.4l-1.4-1.3C5.6 15.4 2 12.1 2 8.3 2 5.4 4.2 3 7.1 3c1.7 0 3.3.8 4.3 2.1A5.4 5.4 0 0 1 15.7 3C18.7 3 21 5.4 21 8.3c0 3.8-3.6 7.1-8.6 11.8L12 21.4zm-4.9-16.4C5.3 5 4 6.4 4 8.3c0 2.9 3 5.7 8 10.2 5-4.5 8-7.3 8-10.2C20 6.4 18.7 5 16.9 5c-1.4 0-2.7.8-3.4 2l-1 .7-1-.7A4 4 0 0 0 7.1 5z"/></svg>' +
              '<span id="web-toolbar-fav-badge" class="web-toolbar-badge" style="display:none"></span>' +
            '</button>' +
            '<button class="web-toolbar-action-btn" data-tab="cart" onclick="navigateTo(\'cart\')" aria-label="╨Ъ╨╛╤А╨╖╨╕╨╜╨░">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18c-1.1 0-2 .9-2 2a2 2 0 1 0 4 0c0-1.1-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2a2 2 0 1 0 4 0c0-1.1-.9-2-2-2zM6.2 5l1.1 2.2h10.3a1 1 0 0 1 .9 1.5l-1.7 3.2a2 2 0 0 1-1.8 1H8.6l-.7 1.3h9.7v2H7.8a2 2 0 0 1-1.8-3l1-1.9L4.3 5H2V3h3a1 1 0 0 1 .9.6z"/></svg>' +
              '<span id="web-toolbar-cart-badge" class="web-toolbar-badge" style="display:none"></span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function renderWithWebTop(contentHtml) {
    if (isTelegramRuntime) {
      render(contentHtml);
      return;
    }
    render(buildWebTopHeaderBar() + contentHtml);
    updateFavBadge();
    updateCartBadge();
  }

  function getProductMinPrice(p) {
    if (!p) return 0;
    var base = parseInt(p.price, 10);
    if (isNaN(base) || base < 0) base = 0;
    if (!p.sizes || !p.sizes.length) return base;
    var min = null;
    for (var i = 0; i < p.sizes.length; i++) {
      var sp = parseInt(p.sizes[i].price, 10);
      if (isNaN(sp) || sp < 0) continue;
      if (min === null || sp < min) min = sp;
    }
    return min === null ? base : min;
  }

  function parseCategoryPriceRange(catName) {
    var raw = String(catName || '').trim();
    if (!raw) return null;

    var normalized = raw
      .toLowerCase()
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    var hasFromHint = /(^|\s)╨╛╤В(?=\s*\d)/.test(normalized);
    var hasToHint = /(^|\s)╨┤╨╛(?=\s*\d)/.test(normalized);
    var hasRangeHints = hasFromHint || hasToHint || /(╤А╤Г╨▒|тВ╜|╤В╤Л╤Б|╨║\b)/.test(normalized) || /\d\s*[-тАУтАФ]\s*\d/.test(normalized);
    if (!hasRangeHints) return null;

    var nums = normalized.match(/\d[\d\s]*/g);
    if (!nums || !nums.length) return null;

    var values = nums.map(function (n) {
      return parseInt(String(n).replace(/\s+/g, ''), 10);
    }).filter(function (v) { return !isNaN(v); });
    if (!values.length) return null;

    var min = null;
    var max = null;

    if (hasToHint && hasFromHint && values.length >= 2) {
      min = Math.min(values[0], values[1]);
      max = Math.max(values[0], values[1]);
    } else if (hasToHint) {
      max = values[0];
      if (values.length >= 2) min = Math.min(values[0], values[1]);
    } else if (hasFromHint) {
      min = values[0];
      if (values.length >= 2) max = Math.max(values[0], values[1]);
    } else if (values.length >= 2) {
      min = Math.min(values[0], values[1]);
      max = Math.max(values[0], values[1]);
    } else {
      return null;
    }

    if (min !== null && max !== null && min > max) {
      var t = min;
      min = max;
      max = t;
    }

    return { min: min, max: max };
  }

  function filterProductsByCategoryPriceRange(products, catName) {
    if (!products || !products.length) return products || [];
    var range = parseCategoryPriceRange(catName);
    if (!range) return products;
    return products.filter(function (p) {
      var price = getProductMinPrice(p);
      if (range.min !== null && price < range.min) return false;
      if (range.max !== null && price > range.max) return false;
      // For price-range categories, keep bouquet products only.
      // This prevents "╨Я╨╛╨┤╨░╤А╨║╨╕/╨Ю╤В╨║╤А╤Л╤В╨║╨╕/╨Т╨░╨╖╤Л/╨и╨░╤А╤Л" from mixing into "╨Ф╨╛ 3 000" etc.
      var nameText = String((p && p.name) || '').toLowerCase();
      var categoryText = String((p && p.category_name) || '').toLowerCase();
      var text = nameText + ' ' + categoryText;
      var nonBouquetHints = ['╨┐╨╛╨┤╨░╤А', '╨╛╤В╨║╤А╤Л╤В╨║', '╨▓╨░╨╖╨░', '╤Б╨▓╨╡╤З', '╤И╨░╤А', '╨╕╨│╤А╤Г╤И', '╨║╨╛╤А╨╛╨▒╨║'];
      for (var i = 0; i < nonBouquetHints.length; i++) {
        if (text.indexOf(nonBouquetHints[i]) >= 0) return false;
      }
      return true;
    });
  }

  function showHome(filterCatId) {
    homeActiveCategory = normalizeCategoryId(filterCatId);
    var cityName = selectedCity ? selectedCity.name : '';
    var cityLine = cityName
      ? '<span class="city-current" onclick="changeCityClick()">' + escapeHtml(cityName) + '</span>'
      : '<span class="city-current" onclick="changeCityClick()">╨Т╤Л╨▒╤А╨░╤В╤М ╨│╨╛╤А╨╛╨┤</span>';
    var showSiteHeroBlock = shouldShowSiteHero();
    var isDesktopCoverOverlay = !isTelegramRuntime && showSiteHeroBlock && (window.innerWidth || 0) >= 900;
    var siteHero = showSiteHeroBlock ? buildHomeHero(cityName) : '';
    var catalogHeader = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div class="category-title">╨Ъ╨░╤В╨░╨╗╨╛╨│</div>' +
      cityLine +
    '</div>';
    setActiveTab('home');
    if (!isTelegramRuntime) {
      document.body.classList.remove('site-cover-active');
      document.body.classList.remove('mobile-toolbar-fixed');
      document.body.classList.remove('web-mobile-cats-collapsed');
      render(
        buildWebTopHeaderBar() +
        siteHero +
        '<section class="web-shop-toolbar web-shop-toolbar--filters">' +
          '<div class="web-shop-topline web-shop-topline--search">' +
            '<div class="web-shop-search-wrap">' +
              '<input id="web-shop-search" class="web-shop-search" type="search" placeholder="╨┐╨╛╨╕╤Б╨║ ╨┐╨╛ ╤Б╨░╨╣╤В╤Г" oninput="webHomeSearch(this.value)">' +
              '<button class="web-shop-search-btn" type="button" aria-label="╨Я╨╛╨╕╤Б╨║" onclick="focusWebSearch()">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.8 4a6.8 6.8 0 1 1 0 13.6A6.8 6.8 0 0 1 10.8 4zm0 2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zM16.3 15l3.7 3.7-1.4 1.4-3.7-3.7z"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div id="web-quick-cats" class="web-quick-cats">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div>' +
        '</section>' +
        '<section id="home-catalog" class="home-catalog-block">' +
          '<div id="web-category-sections">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div>' +
        '</section>' +
        buildWebStoreInfoSection()
      );
      setActiveTab('home');
      updateFavBadge();
      updateCartBadge();
      bindHomeHeroAnimation();
      bindMobileQuickCatsLayerBehavior();
      var loadWebHomeData = function () {
        Promise.all([fetchJSON('/api/categories'), fetchJSON('/api/products')]).then(function (res) {
          var cats = res[0] || [];
          var products = res[1] || [];
          var el = document.getElementById('web-category-sections');
          if (!el) return;
          if (!cats.length || !products.length) {
            el.innerHTML = '<div class="empty-state">╨в╨╛╨▓╨░╤А╨╛╨▓ ╨┐╨╛╨║╨░ ╨╜╨╡╤В</div>';
            return;
          }
          homeCategoriesById = {};
          cats.forEach(function (c) { homeCategoriesById[c.id] = c.name; });
          webHomeDataCache = { cats: cats, products: products };
          renderWebQuickCategories(cats);
          renderWebCategorySectionsFromCache();
        });
      };
      // On desktop intro, defer heavy catalog fetch to avoid micro-freezes at animation start.
      if (isDesktopCoverOverlay) {
        setTimeout(loadWebHomeData, 4050);
      } else {
        loadWebHomeData();
      }
      return;
    }

    render(
      buildWebMarqueeBar() +
      siteHero +
      '<section id="home-catalog" class="home-catalog-block">' +
        catalogHeader +
        '<div class="category-select-wrap" id="category-select-wrap">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div>' +
        '<div id="active-cat-title" class="category-title" style="font-size:16px;margin-bottom:14px;display:none"></div>' +
        '<div class="product-list" id="home-product-list">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div>' +
      '</section>'
    );
    bindHomeHeroAnimation();

    fetchJSON('/api/categories').then(function (cats) {
      var el = document.getElementById('category-select-wrap');
      if (!el) return;
      if (!cats || !cats.length) { el.innerHTML = ''; return; }
      homeCategoriesById = {};
      cats.forEach(function (c) { homeCategoriesById[c.id] = c.name; });
      var activeCatId = normalizeCategoryId(homeActiveCategory);
      var html = '<button class="cat-chip' + (activeCatId === null ? ' active' : '') + '" data-cat-id="" onclick="filterHome(null)">╨Т╤Б╨╡</button>';
      html += cats.map(function (c) {
        var cidNorm = normalizeCategoryId(c.id);
        return '<button class="cat-chip' + (activeCatId === cidNorm ? ' active' : '') + '" data-cat-id="' + escapeHtml(cidNorm) + '" onclick="filterHome(' + c.id + ',\'' + escapeHtml(c.name).replace(/'/g, "\\'") + '\')">' + escapeHtml(c.name) + '</button>';
      }).join('');
      el.innerHTML = html;
      if (activeCatId !== null) {
        var selected = cats.find(function (c) { return normalizeCategoryId(c.id) === activeCatId; });
        if (selected) {
          var titleEl = document.getElementById('active-cat-title');
          if (titleEl) { titleEl.textContent = selected.name; titleEl.style.display = 'block'; }
        }
      }
    });

    var productsUrl = homeActiveCategory !== null ? '/api/products?category_id=' + encodeURIComponent(homeActiveCategory) : '/api/products';
    fetchJSON(productsUrl).then(function (prods) {
      var el = document.getElementById('home-product-list');
      if (!el) return;
      var selectedName = homeActiveCategory !== null ? homeCategoriesById[homeActiveCategory] : '';
      prods = filterProductsByCategoryPriceRange(prods || [], selectedName);
      if (!prods || !prods.length) { el.innerHTML = '<div class="empty-state">╨в╨╛╨▓╨░╤А╨╛╨▓ ╨┐╨╛╨║╨░ ╨╜╨╡╤В</div>'; return; }
      prods.sort(function (a, b) { return (b.in_stock !== 0 ? 1 : 0) - (a.in_stock !== 0 ? 1 : 0); });
      el.innerHTML = prods.map(function (p, idx) { return buildProductCard(p, idx); }).join('');
    });
  }

  window.filterHome = function (catId, catName) {
    homeActiveCategory = normalizeCategoryId(catId);

    var chips = document.querySelectorAll('#category-select-wrap .cat-chip');
    chips.forEach(function (chip) {
      var chipCatId = normalizeCategoryId(chip.getAttribute('data-cat-id'));
      chip.classList.toggle('active', chipCatId === homeActiveCategory);
    });

    var titleEl = document.getElementById('active-cat-title');
    if (titleEl) {
      if (homeActiveCategory !== null && catName && catName !== '╨Т╤Б╨╡') {
        titleEl.textContent = catName;
        titleEl.style.display = 'block';
      } else {
        titleEl.style.display = 'none';
      }
    }

    var productsUrl = homeActiveCategory !== null ? '/api/products?category_id=' + encodeURIComponent(homeActiveCategory) : '/api/products';
    fetchJSON(productsUrl).then(function (prods) {
      var el = document.getElementById('home-product-list');
      if (!el) return;
      var selectedName = catName || homeCategoriesById[homeActiveCategory] || '';
      prods = filterProductsByCategoryPriceRange(prods || [], selectedName);
      if (!prods || !prods.length) { el.innerHTML = '<div class="empty-state">╨Т ╤Н╤В╨╛╨╣ ╨║╨░╤В╨╡╨│╨╛╤А╨╕╨╕ ╨┐╨╛╨║╨░ ╨╜╨╡╤В ╤В╨╛╨▓╨░╤А╨╛╨▓</div>'; return; }
      prods.sort(function (a, b) { return (b.in_stock !== 0 ? 1 : 0) - (a.in_stock !== 0 ? 1 : 0); });
      el.innerHTML = prods.map(function (p, idx) { return buildProductCard(p, idx); }).join('');
    });
  };

  window.webHomePickCategory = function (catId) {
    homeActiveCategory = normalizeCategoryId(catId);
    renderWebQuickCategories((webHomeDataCache && webHomeDataCache.cats) || []);
    renderWebCategorySectionsFromCache();
  };

  window.webHomeSearch = function (query) {
    webHomeSearchQuery = String(query || '');
    renderWebCategorySectionsFromCache();
  };

  window.focusWebSearch = function () {
    var input = document.getElementById('web-shop-search');
    if (!input) return;
    input.focus();
  };

  window.toggleWebCallPanel = function (event) {
    if (event) event.stopPropagation();
    var wrap = document.getElementById('web-call-wrap');
    if (!wrap) return;
    wrap.classList.toggle('open');
  };

  document.addEventListener('click', function (e) {
    var wrap = document.getElementById('web-call-wrap');
    if (!wrap || !wrap.classList.contains('open')) return;
    if (e.target && wrap.contains(e.target)) return;
    wrap.classList.remove('open');
  });

  function showCatalog() {
    showHome();
  }

  function showProducts(catId) {
    showHome(catId);
  }

  function showProduct(id) {
    var webHead = !isTelegramRuntime ? buildWebTopHeaderBar() : '';
    render(
      webHead +
      '<div class="product-detail-page">' +
        '<div id="product-detail">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div>' +
        (!isTelegramRuntime ? '<div id="product-related"></div>' : '') +
      '</div>'
    );
    if (!isTelegramRuntime) {
      updateFavBadge();
      updateCartBadge();
    }
    fetchJSON('/api/products/' + id).then(function (p) {
      if (!p || p.error) { document.getElementById('product-detail').innerHTML = '<div class="empty-state">╨в╨╛╨▓╨░╤А ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜</div>'; return; }
      warmProductSizeImages(p);
      var favClass = isFavorited(p.id) ? ' favorited' : '';
      var fallbackSizeImage = (p.sizes && p.sizes.length && p.sizes[0].image_url) ? p.sizes[0].image_url : '';
      var images = p.images && p.images.length ? p.images : (p.image_url ? [{ image_url: p.image_url }] : (fallbackSizeImage ? [{ image_url: fallbackSizeImage }] : []));
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
            (images.length ? '<img src="' + escapeHtml(images[0].image_url) + '" alt="' + escapeHtml(p.name) + '" class="product-detail-img">' : '<div class="no-image">╨д╨╛╤В╨╛</div>') +
            '<button class="fav-btn fav-btn--detail' + favClass + '" onclick="toggleFav(' + p.id + ',event)">' + heartSvg + '</button>' +
          '</div>';
      }

      var sizeHtml = '';
      if (p.sizes && p.sizes.length) {
        var firstSize = p.sizes[0];
        var sizeBtns = p.sizes.map(function (s, idx) {
          return '<button type="button" class="size-btn' + (idx === 0 ? ' active' : '') + '" ' +
            'data-size-id="' + s.id + '" data-price="' + s.price + '" data-label="' + escapeHtml(s.label) + '" data-dims="' + escapeHtml(s.dimensions || '') + '" data-img="' + escapeHtml(s.image_url || '') + '" ' +
            'onclick="selectSize(this,' + p.id + ')">' +
            escapeHtml(s.label) +
          '</button>';
        }).join('');
        var firstInfo = firstSize.dimensions ? escapeHtml(firstSize.dimensions) : '';
        sizeHtml =
          '<div class="size-selector" id="size-selector">' +
            '<div class="size-selector-label">╨а╨░╨╖╨╝╨╡╤А ╨▒╤Г╨║╨╡╤В╨░</div>' +
            '<div class="size-btn-row">' + sizeBtns + '</div>' +
            '<div class="size-info" id="size-info">' + firstInfo + '</div>' +
          '</div>';
      } else if (p.dimensions) {
        sizeHtml = '<div class="size-selector"><div class="size-info">' + escapeHtml(p.dimensions) + '</div></div>';
      }

      var detailPrice = (p.sizes && p.sizes.length) ? p.sizes[0].price : p.price;
      var detailOutOfStock = p.in_stock === 0;
      var detailActions = detailOutOfStock
        ? '<div class="product-detail-actions"><div class="detail-soon-badge">╨б╨║╨╛╤А╨╛ ╨▒╤Г╨┤╨╡╤В ╨▓ ╨╜╨░╨╗╨╕╤З╨╕╨╕</div><button class="card-cart-btn card-cart-btn--catalog" onclick="navigateTo(\'home\')">╨Т ╨║╨░╤В╨░╨╗╨╛╨│</button></div>'
        : '<div class="product-detail-actions"><button class="card-cart-btn card-cart-btn--large" onclick="addToCartWithSize(' + p.id + ',event)">╨Т ╨║╨╛╤А╨╖╨╕╨╜╤Г</button><button class="card-cart-btn card-cart-btn--catalog" onclick="navigateTo(\'home\')">╨Т ╨║╨░╤В╨░╨╗╨╛╨│</button></div>';

      document.getElementById('product-detail').innerHTML =
        '<div class="product-detail' + (detailOutOfStock ? ' product-detail--soon' : '') + '">' +
          '<div class="product-detail-media">' +
            galleryHtml +
          '</div>' +
          '<div class="product-detail-content">' +
            '<div class="product-detail-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="product-detail-price" id="detail-price">' + formatPrice(detailPrice) + '</div>' +
            '<div class="product-detail-desc">' + escapeHtml(p.description) + '</div>' +
            (isBouquetCategory(p.category_name) ? '<div class="product-detail-warning">╨Ъ╨░╨╢╨┤╤Л╨╣ ╨▒╤Г╨║╨╡╤В ╤Б╨╛╨▒╨╕╤А╨░╨╡╤В╤Б╤П ╨▓╤А╤Г╤З╨╜╤Г╤О, ╨▓╨╛╨╖╨╝╨╛╨╢╨╜╤Л ╨╛╤В╨╗╨╕╤З╨╕╤П ╨╛╤В ╤Д╨╛╤В╨╛.</div>' : '') +
            sizeHtml +
            detailActions +
          '</div>' +
        '</div>';

      window._currentProduct = p;

      if (images.length > 1) {
        initGallery(images.length);
      }
      renderProductRelated(p);
    });
  }

  function renderProductRelated(product) {
    if (isTelegramRuntime || !product || !product.id) return;
    var host = document.getElementById('product-related');
    if (!host) return;
    fetchJSON('/api/products').then(function (products) {
      if (!products || !products.length) {
        host.innerHTML = '';
        return;
      }
      var related = products.filter(function (item) {
        return item &&
          item.id !== product.id &&
          item.in_stock !== 0 &&
          item.category_id === product.category_id;
      });
      if (!related.length) {
        related = products.filter(function (item) {
          return item && item.id !== product.id && item.in_stock !== 0;
        });
      }
      related.sort(function (a, b) {
        var pa = getProductMinPrice(a);
        var pb = getProductMinPrice(b);
        if (pa !== pb) return pa - pb;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      });
      related = related.slice(0, 4);
      if (!related.length) {
        host.innerHTML = '';
        return;
      }
      host.innerHTML =
        '<section class="product-related">' +
          '<h3 class="product-related-title">╨б╨╝╨╛╤В╤А╨╕╤В╨╡ ╤В╨░╨║╨╢╨╡</h3>' +
          '<div class="product-list product-list--related">' +
            related.map(function (p, idx) { return buildProductCard(p, idx); }).join('') +
          '</div>' +
        '</section>';
      initCardScrollReveal(host);
    }).catch(function () {
      host.innerHTML = '';
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
    var h = '<div class="section-title">╨Ъ╨╛╤А╨╖╨╕╨╜╨░</div>';
    if (!cart.length) { renderWithWebTop(h + '<div class="empty-state">╨Ъ╨╛╤А╨╖╨╕╨╜╨░ ╨┐╤Г╤Б╤В╨░</div>'); return; }

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
              'onclick="changeCartSize(' + idx + ',\'' + escapeHtml(s.label).replace(/'/g, "\\'") + '\',' + s.price + ',\'' + escapeHtml(s.dimensions || '').replace(/'/g, "\\'") + '\',\'' + escapeHtml(s.image_url || '').replace(/'/g, "\\'") + '\')">' +
              escapeHtml(s.label) + '</button>';
          }).join('');
          oldBtns.querySelector('.size-btn-row').innerHTML = sizeBtns;
        });
      }
    });
  }

  function renderCartItems(cart, keepScroll) {
    var content = '<div class="web-flow-shell web-flow-shell--cart"><div class="section-title">╨Ъ╨╛╤А╨╖╨╕╨╜╨░</div>';
    content += '<div class="cart-items">';
    cart.forEach(function (item, idx) {
      if (item.is_free_service) return;
      content += buildCartRow(item, idx);
    });
    cart.forEach(function (item, idx) {
      if (!item.is_free_service) return;
      content += buildCartRow(item, idx);
    });
    content += '</div>';
    content += '<div id="cart-recommend"></div>';
    content += '<div class="cart-total">╨Ш╤В╨╛╨│╨╛: <span id="cart-total-val">' + formatPrice(getCartTotal()) + '</span></div>';
    content += '<button class="nav-btn" onclick="navigateTo(\'checkout\')">╨Ю╤Д╨╛╤А╨╝╨╕╤В╤М ╨╖╨░╨║╨░╨╖</button>';
    content += '</div>';
    var h = isTelegramRuntime ? content : (buildWebTopHeaderBar() + content);
    if (keepScroll) {
      var scrollY = window.scrollY;
      appEl.innerHTML = h;
      window.scrollTo(0, scrollY);
    } else {
      render(h);
    }
    if (!isTelegramRuntime) {
      updateFavBadge();
      updateCartBadge();
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
      h += '<div class="cart-rec-title">╨Ф╨╛╨▒╨░╨▓╤М╤В╨╡ ╨║ ╨╖╨░╨║╨░╨╖╤Г</div>';
      h += '<div class="cart-rec-wrap">';
      h += '<button class="cart-rec-arrow cart-rec-arrow--left" onclick="scrollRec(-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>';
      h += '<div class="cart-rec-scroll">';
      sorted.forEach(function (p) {
        var img = p.image_url
          ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" class="cart-rec-img">'
          : '<div class="cart-rec-img cart-rec-noimg">╨д╨╛╤В╨╛</div>';
        var price = (p.sizes && p.sizes.length) ? p.sizes[0].price : p.price;
        var priceLabel = (p.sizes && p.sizes.length) ? '╨╛╤В ' + formatPrice(price) : formatPrice(price);
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
    if (item.image_url) warmImage(item.image_url);
    if (item.is_free_service) {
      return '<div class="cart-item" id="cart-row-' + idx + '">' +
        productImage(item.image_url, item.name, 'cart-item-img') +
        '<div class="cart-item-info">' +
          '<div>' +
            '<div class="cart-item-name">' + escapeHtml(item.name) + '</div>' +
            '<div class="cart-item-price">0 тВ╜</div>' +
          '</div>' +
          '<div class="cart-item-controls">' +
            '<span class="qty-value" id="qty-val-' + idx + '">' + item.quantity + '</span> ╤И╤В.' +
          '</div>' +
        '</div></div>';
    }
    var sizeSelector = '';
    var sizes = item.available_sizes || [];
    sizes.forEach(function (s) { if (s && s.image_url) warmImage(s.image_url); });
    if (sizes.length) {
      var sizeBtns = sizes.map(function (s) {
        var isActive = s.label === item.size_label;
        return '<button type="button" class="size-btn' + (isActive ? ' active' : '') + '" ' +
          'onclick="changeCartSize(' + idx + ',\'' + escapeHtml(s.label).replace(/'/g, "\\'") + '\',' + s.price + ',\'' + escapeHtml(s.dimensions || '').replace(/'/g, "\\'") + '\',\'' + escapeHtml(s.image_url || '').replace(/'/g, "\\'") + '\')">' +
          escapeHtml(s.label) + '</button>';
      }).join('');
      var sizeInfo = item.dimensions ? escapeHtml(item.dimensions) : '';
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
          '<button class="remove-btn" onclick="removeItem(' + item.product_id + ',\'' + escapedLabel + '\')">╨г╨┤╨░╨╗╨╕╤В╤М</button>' +
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
          addBtn.outerHTML = '<div class="cart-rec-in-cart">╨Т ╨║╨╛╤А╨╖╨╕╨╜╨╡</div>';
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
    pickupTime: '',
    exactTime: false,
    deliveryDistance: 0,
    deliveryCoords: null,
    isEngels: false,
    addressValidated: false
  };

  var _abandonedSent = false;
  var _abandonedTimer = null;
  var _inCheckout = false;
  var ABANDON_TIMEOUT = 10 * 60 * 1000;

  var _abandonReason = '';

  function getStepName() {
    var names = { 1: '╨Ч╨░╨║╨░╨╖╤З╨╕╨║', 2: '╨Ф╨╛╤Б╤В╨░╨▓╨║╨░', 3: '╨Я╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤М' };
    return names[currentStep] || '╨и╨░╨│ ' + currentStep;
  }

  function sendAbandonedCart(reason) {
    if (_abandonedSent || !_inCheckout) return;
    var cart = getCart();
    if (!cart.length) return;
    _abandonedSent = true;
    var userId = getTelegramId();
    if (!userId) return;
    var username = (tgUser && tgUser.username) || null;
    var phone = (dbUser && dbUser.phone) || '';
    var phoneField = document.getElementById('field-phone');
    if (phoneField && phoneField.value.trim()) phone = phoneField.value.trim();
    var email = '';
    var emailField = document.getElementById('field-email');
    if (emailField && emailField.value.trim()) email = emailField.value.trim();
    var items = cart.filter(function (c) { return !c.is_free_service; }).map(function (c) {
      return { name: c.name, quantity: c.quantity, price: c.price };
    });
    var total = getCartTotal();
    navigator.sendBeacon('/api/abandoned-cart', new Blob([JSON.stringify({
      user_id: String(userId),
      username: username,
      phone: phone,
      email: email,
      cart: items,
      total: total,
      step: currentStep,
      step_name: getStepName(),
      reason: reason || '╨г╤И╤С╨╗ ╤Б╨╛ ╤Б╤В╤А╨░╨╜╨╕╤Ж╤Л'
    })], { type: 'application/json' }));
  }

  function startAbandonTimer() {
    stopAbandonTimer();
    _inCheckout = true;
    _abandonedSent = false;
    _abandonedTimer = setTimeout(function () { sendAbandonedCart('╨С╨╡╨╖╨┤╨╡╨╣╤Б╤В╨▓╨╕╨╡ 10 ╨╝╨╕╨╜'); }, ABANDON_TIMEOUT);
  }

  function stopAbandonTimer() {
    if (_abandonedTimer) { clearTimeout(_abandonedTimer); _abandonedTimer = null; }
  }

  function resetAbandonTimer() {
    if (!_inCheckout) return;
    stopAbandonTimer();
    _abandonedTimer = setTimeout(function () { sendAbandonedCart('╨С╨╡╨╖╨┤╨╡╨╣╤Б╤В╨▓╨╕╨╡ 10 ╨╝╨╕╨╜'); }, ABANDON_TIMEOUT);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && _inCheckout && !_abandonedSent) {
      sendAbandonedCart('╨б╨▓╨╡╤А╨╜╤Г╨╗/╨╖╨░╨║╤А╤Л╨╗ ╨┐╤А╨╕╨╗╨╛╨╢╨╡╨╜╨╕╨╡');
    }
  });

  window.saveCheckoutDraft = function() {
    try {
      var draft = {
        step: currentStep,
        state: checkoutState,
        fields: {}
      };
      var ids = ['field-customer-name','field-tg','field-phone','field-email',
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
    return lower.indexOf('╤Н╨╜╨│╨╡╨╗╤М╤Б') !== -1 || lower.indexOf('engels') !== -1;
  }

  function isNightDeliveryInterval(iv) {
    var s = String(iv || '').trim();
    if (!s || s.indexOf('-') < 0) return false;
    var parts = s.split('-');
    if (parts.length !== 2) return false;
    var p1 = parts[0].split(':');
    var p2 = parts[1].split(':');
    var sh = parseInt(p1[0], 10), sm = parseInt(p1[1] || '0', 10);
    var eh = parseInt(p2[0], 10), em = parseInt(p2[1] || '0', 10);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return false;
    var start = sh * 60 + sm;
    var end = eh * 60 + em;
    if (end <= start) return true;      // crosses midnight, e.g. 21:00-00:00 / 22:00-01:00
    if (start >= 21 * 60) return true;  // late evening slot
    if (start < 10 * 60) return true;   // after-midnight slot
    return false;
  }

  function getDeliveryTiers(engels, nightMode) {
    var key = '';
    if (nightMode) {
      key = engels ? 'night_delivery_tiers_engels' : 'night_delivery_tiers';
    } else {
      key = engels ? 'delivery_distance_tiers_engels' : 'delivery_distance_tiers';
    }
    try { return JSON.parse(appSettings[key] || '[]'); }
    catch (e) { return []; }
  }

  function getMaxDeliveryKm(engels) {
    var key = engels ? 'max_delivery_km_engels' : 'max_delivery_km_saratov';
    return parseFloat(appSettings[key]) || 30;
  }

  function isDeliveryTooFar() {
    if (checkoutState.deliveryType !== 'delivery') return false;
    if (checkoutState.deliveryDistance <= 0) return false;
    return checkoutState.deliveryDistance > getMaxDeliveryKm(checkoutState.isEngels);
  }

  function getDeliveryCostByDistance(km, engels, nightMode) {
    var tiers = getDeliveryTiers(engels, nightMode);
    if (nightMode && !tiers.length) tiers = getDeliveryTiers(engels, false); // fallback to day tiers
    if (!tiers.length) return 0;
    tiers = tiers.slice().sort(function (a, b) { return a.max_km - b.max_km; });
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
      var nightMode = isNightDeliveryInterval(checkoutState.deliveryInterval);
      return getDeliveryCostByDistance(checkoutState.deliveryDistance, checkoutState.isEngels, nightMode);
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
      checkoutState.pickupTime = draft.state.pickupTime || '';
      checkoutState.exactTime = !!draft.state.exactTime;
      checkoutState.deliveryDistance = draft.state.deliveryDistance || 0;
      checkoutState.deliveryCoords = draft.state.deliveryCoords || null;
      checkoutState.isEngels = !!draft.state.isEngels;
      checkoutState.addressValidated = !!draft.state.addressValidated;
    } else {
      checkoutState.deliveryInterval = '';
      checkoutState.pickupTime = '';
      checkoutState.exactTime = false;
      checkoutState.addressValidated = false;
      checkoutState.deliveryDistance = 0;
      checkoutState.deliveryCoords = null;
    }

    currentStep = (draft && draft.step) ? draft.step : 1;

    var df = (draft && draft.fields) || {};
    var userName = df['field-customer-name'] || (dbUser && dbUser.first_name) || (tgUser && tgUser.first_name) || '';
    var userPhone = df['field-phone'] || (dbUser && dbUser.phone) || '';
    var userAddr = (dbUser && dbUser.default_address) || '';
    var allowGuestCheckout = !getTelegramId();

    var intervals = getIntervals();
    var sNow = saratovNow();
    var currentHour = sNow.hours;
    var cutoff = getCutoffHour();
    var holiday = isHolidayToday();
    var pickup = appSettings.pickup_address || '╨│. ╨б╨░╤А╨░╤В╨╛╨▓, 3-╨╣ ╨Ф╨╡╨│╤В╤П╤А╨╜╤Л╨╣ ╨┐╤А╨╛╨╡╨╖╨┤, 21╨║3';

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

    renderWithWebTop(
      '<div class="web-flow-shell web-flow-shell--checkout">' +
      '<span class="back-link" onclick="navigateTo(\'cart\')">╨Ъ ╨║╨╛╤А╨╖╨╕╨╜╨╡</span>' +
      '<div class="section-title">╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜╨╕╨╡ ╨╖╨░╨║╨░╨╖╨░</div>' +
      (selectedCity ? '<div style="font-size:12px;margin-bottom:14px">╨У╨╛╤А╨╛╨┤: ' + escapeHtml(selectedCity.name) + '</div>' : '') +

      '<div class="checkout-steps">' +
        '<div class="step-indicators">' +
          '<div class="step-dot active" data-step="1"><span class="step-num">1</span></div>' +
          '<div class="step-line"></div>' +
          '<div class="step-dot locked" data-step="2"><span class="step-num">2</span></div>' +
          '<div class="step-line"></div>' +
          '<div class="step-dot locked" data-step="3"><span class="step-num">3</span></div>' +
        '</div>' +
        '<div class="step-labels">' +
          '<span class="step-label active">╨Ч╨░╨║╨░╨╖╤З╨╕╨║</span>' +
          '<span class="step-label">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░</span>' +
          '<span class="step-label">╨Я╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤М</span>' +
        '</div>' +
      '</div>' +

      '<div class="checkout-panels">' +

        '<div class="checkout-panel active" id="step-1">' +
          '<div class="step-title">╨Ш╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤П ╨╛ ╨╖╨░╨║╨░╨╖╤З╨╕╨║╨╡</div>' +
          '<div class="form-group"><label>╨Ш╨╝╤П ╨╖╨░╨║╨░╨╖╤З╨╕╨║╨░</label>' +
          '<input type="text" id="field-customer-name" placeholder="╨Ш╨▓╨░╨╜" value="' + escapeHtml(userName) + '" oninput="updateStepButtons()"></div>' +
          '<div class="form-group"><label>╨Ъ╨╛╨╜╤В╨░╨║╤В╨╜╤Л╨╣ ╤В╨╡╨╗╨╡╤Д╨╛╨╜</label>' +
          '<input type="tel" id="field-phone" placeholder="+7 (___) ___-__-__" value="' + escapeHtml(userPhone) + '" oninput="formatPhoneInput(this); updateStepButtons()" maxlength="18"></div>' +
          (!isTelegramRuntime && allowGuestCheckout
            ? '<div class="checkout-guest-hint">' +
                '<div class="checkout-guest-hint-text">╨Ь╨╛╨╢╨╜╨╛ ╨╛╤Д╨╛╤А╨╝╨╕╤В╤М ╨╖╨░╨║╨░╨╖ ╨▒╨╡╨╖ ╤А╨╡╨│╨╕╤Б╤В╤А╨░╤Ж╨╕╨╕. ╨з╤В╨╛╨▒╤Л ╤Б╨╛╤Е╤А╨░╨╜╤П╨╗╨╕╤Б╤М ╨░╨┤╤А╨╡╤Б╨░ ╨╕ ╨╕╤Б╤В╨╛╤А╨╕╤П ╨╖╨░╨║╨░╨╖╨╛╨▓, ╨▓╨╛╨╣╨┤╨╕╤В╨╡ ╤З╨╡╤А╨╡╨╖ Telegram.</div>' +
                '<div id="checkout-telegram-login-widget"></div>' +
              '</div>'
            : '') +
          '<button type="button" class="step-next-btn" id="step1-next" onclick="goToStep(2)">╨Ф╨░╨╗╨╡╨╡</button>' +
        '</div>' +

        '<div class="checkout-panel" id="step-2">' +
          '<div class="step-title">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░</div>' +

          '<div class="form-group"><label>╨б╨┐╨╛╤Б╨╛╨▒ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П</label>' +
          '<div class="radio-group" id="delivery-type-group">' +
            '<label class="radio-option' + (checkoutState.deliveryType === 'delivery' ? ' selected' : '') + '" onclick="setDeliveryType(\'delivery\')">' +
              '<input type="radio" name="dtype" value="delivery"' + (checkoutState.deliveryType === 'delivery' ? ' checked' : '') + '>' +
              '<span class="radio-dot"></span> ╨Ф╨╛╤Б╤В╨░╨▓╨║╨░</label>' +
            '<label class="radio-option' + (checkoutState.deliveryType === 'pickup' ? ' selected' : '') + '" onclick="setDeliveryType(\'pickup\')">' +
              '<input type="radio" name="dtype" value="pickup"' + (checkoutState.deliveryType === 'pickup' ? ' checked' : '') + '>' +
              '<span class="radio-dot"></span> ╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ (' + escapeHtml(pickup) + ')</label>' +
          '</div></div>' +

          '<div id="delivery-fields">' +
            '<div id="saved-addr-picker"></div>' +
            '<div class="form-group"><label>╨Р╨┤╤А╨╡╤Б ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕</label>' +
            '<input type="text" id="field-addr-suggest" autocomplete="off" placeholder="╨Э╨░╤З╨╜╨╕╤В╨╡ ╨▓╨▓╨╛╨┤╨╕╤В╤М ╨░╨┤╤А╨╡╤БтАж" oninput="updateStepButtons()"></div>' +
            '<div id="ymaps-minimap" style="width:100%;height:180px;border-radius:10px;overflow:hidden;margin:8px 0;display:none"></div>' +
            '<div id="delivery-distance-info" style="font-size:13px;margin:6px 0;display:none"></div>' +
            '<div class="form-group"><label>╨Ъ╨▓╨░╤А╤В╨╕╤А╨░ / ╨╛╤Д╨╕╤Б</label>' +
            '<input type="text" id="field-addr-apt" placeholder="╨Ъ╨▓╨░╤А╤В╨╕╤А╨░, ╨┐╨╛╨┤╤К╨╡╨╖╨┤, ╤Н╤В╨░╨╢" oninput="saveCheckoutDraft()"></div>' +
            '<div class="form-group"><label>╨Ф╨╛╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨║ ╨░╨┤╤А╨╡╤Б╤Г</label>' +
            '<input type="text" id="field-addr-note" placeholder="╨Ъ╨╛╨┤ ╨┤╨╛╨╝╨╛╤Д╨╛╨╜╨░, ╨╛╤А╨╕╨╡╨╜╤В╨╕╤А╤Л ╨╕ ╤В.╨┤." oninput="saveCheckoutDraft()"></div>' +
            '<input type="hidden" id="field-address">' +
          '</div>' +

          '<div id="nearest-delivery-hint" class="nearest-delivery-hint"></div>' +

          '<div id="date-cutoff-notice" class="cutoff-notice" style="display:none"></div>' +

          '<div class="form-group"><label id="date-label">╨Ф╨░╤В╨░ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕</label>' +
          '<input type="date" id="field-date" class="form-input-date" min="' + minDate + '" value="' + defaultDate + '" onchange="onDeliveryDateChange()"></div>' +

          '<div class="form-group"><label id="time-label">╨Т╤А╨╡╨╝╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕</label>' +
          '<div class="radio-group" id="interval-group">' +
          '</div></div>' +

          (isExactTimeEnabled() ?
          '<div class="exact-time-section">' +
            '<label class="checkout-self-btn" id="exact-time-opt" onclick="toggleExactTime()">' +
              '<input type="checkbox" id="exact-time-cb">' +
              '<span class="check-box"></span> ╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╤В╨╛╤З╨╜╨╛ ╨║╨╛ ╨▓╤А╨╡╨╝╨╡╨╜╨╕ (+' + formatPrice(parseInt(appSettings.exact_time_surcharge) || 1000) + ')' +
            '</label>' +
            '<div id="exact-time-fields" style="display:none">' +
              '<div style="font-size:12px;color:#888;margin:8px 0 6px">╨Ч╨░╨║╨░╨╖ ╨▒╤Г╨┤╨╡╤В ╨┤╨╛╤Б╤В╨░╨▓╨╗╨╡╨╜ ╨▓ ╨╕╨╜╤В╨╡╤А╨▓╨░╨╗╨╡ ┬▒1,5 ╤З╨░╤Б╨░ ╨╛╤В ╤Г╨║╨░╨╖╨░╨╜╨╜╨╛╨│╨╛ ╨▓╤А╨╡╨╝╨╡╨╜╨╕</div>' +
              '<input type="time" id="field-exact-time" class="form-input-date" value="12:00" onchange="validateExactTime()">' +
              '<div id="exact-time-warn" class="cutoff-notice" style="display:none"></div>' +
            '</div>' +
          '</div>' : '') +

          '<div class="form-group"><label>╨Ъ╨╛╨╝╨╝╨╡╨╜╤В╨░╤А╨╕╨╣ ╨║ ╨╖╨░╨║╨░╨╖╤Г</label>' +
          '<textarea id="field-comment" placeholder="╨Я╨╛╨╢╨╡╨╗╨░╨╜╨╕╤П, ╨╛╤Б╨╛╨▒╤Л╨╡ ╤Г╨║╨░╨╖╨░╨╜╨╕╤П" oninput="saveCheckoutDraft()"></textarea></div>' +

          '<div class="step-btn-row">' +
            '<button type="button" class="step-back-btn" onclick="goToStep(1)">╨Э╨░╨╖╨░╨┤</button>' +
            '<button type="button" class="step-next-btn" id="step2-next" onclick="goToStep(3)">╨Ф╨░╨╗╨╡╨╡</button>' +
          '</div>' +
        '</div>' +

        '<div class="checkout-panel" id="step-3">' +
          '<div class="step-title">╨Я╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤М</div>' +
          '<div class="form-group">' +
            '<label class="checkout-self-btn" id="self-receiver-btn" onclick="toggleSelfReceiver()">' +
              '<input type="checkbox" id="self-receiver-cb">' +
              '<span class="check-box"></span> ╨п ╤Б╨░╨╝ ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤М' +
            '</label>' +
          '</div>' +
          '<div id="receiver-fields">' +
            '<div class="form-group"><label>╨Ш╨╝╤П ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤П</label>' +
            '<input type="text" id="field-rcv-name" placeholder="╨Ш╨╝╤П ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤П" oninput="updateStepButtons()"></div>' +
            '<div class="form-group"><label>╨в╨╡╨╗╨╡╤Д╨╛╨╜ ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤П</label>' +
            '<input type="tel" id="field-rcv-phone" placeholder="+7 (___) ___-__-__" oninput="formatPhoneInput(this); updateStepButtons()" maxlength="18"></div>' +
          '</div>' +
          '<div id="checkout-summary"></div>' +
          '<div class="consent-check">' +
            '<label class="checkout-self-btn" id="consent-btn" onclick="toggleConsent()">' +
              '<input type="checkbox" id="consent-cb">' +
              '<span class="check-box"></span> ' +
              '<span>╨п ╨┤╨░╤О ╤Б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ <a href="#" onclick="event.stopPropagation(); navigateTo(\'page-offer\'); return false;" style="text-decoration:underline">╨╛╨▒╤А╨░╨▒╨╛╤В╨║╤Г ╨┐╨╡╤А╤Б╨╛╨╜╨░╨╗╤М╨╜╤Л╤Е ╨┤╨░╨╜╨╜╤Л╤Е</a></span>' +
            '</label>' +
          '</div>' +
          '<div class="step-btn-row">' +
            '<button type="button" class="step-back-btn" onclick="goToStep(2)">╨Э╨░╨╖╨░╨┤</button>' +
            '<button type="button" class="step-next-btn step-submit-btn" id="checkout-submit" onclick="submitOrder(event)">╨Ю╤Д╨╛╤А╨╝╨╕╤В╤М ╨╖╨░╨║╨░╨╖</button>' +
          '</div>' +
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
      var nameField = document.getElementById('field-customer-name');
      if (nameField) {
        if (df['field-customer-name'] !== undefined) nameField.value = df['field-customer-name'];
        else if (df['field-tg']) nameField.value = df['field-tg'];
      }
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
    if (!isTelegramRuntime && allowGuestCheckout) {
      mountWebTelegramLoginWidget('checkout-telegram-login-widget');
    }
    startAbandonTimer();
  }

  function loadCheckoutAddresses() {
    var telegramId = getTelegramId();
    if (!telegramId) return;
    fetchJSON('/api/user/addresses?telegram_id=' + telegramId).then(function (addrs) {
      var el = document.getElementById('saved-addr-picker');
      if (!el || !addrs || !addrs.length) return;
      var html = '<div class="form-group"><label>╨б╨╛╤Е╤А╨░╨╜╤С╨╜╨╜╤Л╨╡ ╨░╨┤╤А╨╡╤Б╨░</label><div class="saved-addr-chips">';
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
    showToast('╨Р╨┤╤А╨╡╤Б ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜');
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
                  .replace(/╨а╨╛╤Б╤Б╨╕╤П,?\s*/i, '')
                  .replace(/╨б╨░╤А╨░╤В╨╛╨▓╤Б╨║╨░╤П ╨╛╨▒╨╗╨░╤Б╤В╤М,?\s*/i, '')
                  .replace(/╨│╨╛╤А╨╛╨┤╤Б╨║╨╛╨╣ ╨╛╨║╤А╤Г╨│[^,]*,?\s*/i, '')
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
    var originLabel = engels ? '╨╛╤В ╤Ж╨╡╨╜╤В╤А╨░ ╨н╨╜╨│╨╡╨╗╤М╤Б╨░' : '╨╛╤В ╨╝╨░╨│╨░╨╖╨╕╨╜╨░';
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
      var maxKm = getMaxDeliveryKm(checkoutState.isEngels);
      var label = originLabel ? ' (' + originLabel + ')' : '';
      if (km > maxKm) {
        el.innerHTML = '╨а╨░╤Б╤Б╤В╨╛╤П╨╜╨╕╨╡: <b>' + km.toFixed(1) + ' ╨║╨╝</b>' + label +
          ' тАФ ╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨┐╨╛ ╤Н╤В╨╛╨╝╤Г ╨░╨┤╤А╨╡╤Б╤Г ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╜╨░ (╨╝╨░╨║╤Б. ' + maxKm + ' ╨║╨╝)';
        checkoutState.addressValidated = false;
      } else {
        var nightMode = isNightDeliveryInterval(checkoutState.deliveryInterval);
        var cost = getDeliveryCostByDistance(km, checkoutState.isEngels, nightMode);
        el.innerHTML = '╨а╨░╤Б╤Б╤В╨╛╤П╨╜╨╕╨╡: <b>' + km.toFixed(1) + ' ╨║╨╝</b>' + label + ' тАФ ╨Ф╨╛╤Б╤В╨░╨▓╨║╨░: <b>' + formatPrice(cost) + '</b>';
      }
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
        var customerName = document.getElementById('field-customer-name').value.trim();
        if (!phone || !customerName) {
          showToast('╨Ч╨░╨┐╨╛╨╗╨╜╨╕╤В╨╡ ╨╕╨╝╤П ╨╕ ╤В╨╡╨╗╨╡╤Д╨╛╨╜');
          return;
        }
        if (!validatePhone(phone)) return;
      }
      if (currentStep === 2) {
        if (checkoutState.deliveryType === 'delivery') {
          var suggestVal = document.getElementById('field-addr-suggest') ? document.getElementById('field-addr-suggest').value.trim() : '';
          if (!suggestVal) { showToast('╨г╨║╨░╨╢╨╕╤В╨╡ ╨░╨┤╤А╨╡╤Б ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕'); return; }
          if (!checkoutState.addressValidated) {
            geocodeAndCalcDistance(suggestVal);
          }
          if (isDeliveryTooFar()) {
            var maxKm = getMaxDeliveryKm(checkoutState.isEngels);
            showToast('╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨┐╨╛ ╤Н╤В╨╛╨╝╤Г ╨░╨┤╤А╨╡╤Б╤Г ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╜╨░ (╨╝╨░╨║╤Б. ' + maxKm + ' ╨║╨╝)');
            return;
          }
          var hiddenAddr = document.getElementById('field-address');
          if (hiddenAddr) hiddenAddr.value = buildDeliveryAddress();
        }
        var dateVal = document.getElementById('field-date').value;
        if (!dateVal) { showToast('╨г╨║╨░╨╢╨╕╤В╨╡ ╨┤╨░╤В╤Г ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕'); return; }
        var sNowCheck = saratovNow();
        var todayCheck = sNowCheck.dateStr;
        if (checkoutState.deliveryType === 'delivery' && dateVal === todayCheck && sNowCheck.hours >= getCutoffHour()) {
          showToast('╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨╜╨░ ╤Б╨╡╨│╨╛╨┤╨╜╤П ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╜╨░. ╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨┤╤А╤Г╨│╤Г╤О ╨┤╨░╤В╤Г ╨╕╨╗╨╕ ╤Б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖.');
          return;
        }
        if (checkoutState.deliveryType === 'pickup') {
          if (!checkoutState.pickupTime || !validatePickupTime()) {
            showToast('╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨║╨╛╤А╤А╨╡╨║╤В╨╜╨╛╨╡ ╨▓╤А╨╡╨╝╤П ╤Б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖╨░');
            return;
          }
        } else {
          if (!checkoutState.deliveryInterval && !checkoutState.exactTime) {
            showToast('╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨▓╤А╨╡╨╝╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ (╨╕╨╜╤В╨╡╤А╨▓╨░╨╗ ╨╕╨╗╨╕ ╤В╨╛╤З╨╜╨╛╨╡ ╨▓╤А╨╡╨╝╤П)');
            return;
          }
          if (checkoutState.exactTime && !validateExactTime()) {
            showToast('╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨║╨╛╤А╤А╨╡╨║╤В╨╜╨╛╨╡ ╨▓╤А╨╡╨╝╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕');
            return;
          }
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
    resetAbandonTimer();
    var btn1 = document.getElementById('step1-next');
    if (btn1) {
      var customerName = (document.getElementById('field-customer-name') || {}).value || '';
      var phone = (document.getElementById('field-phone') || {}).value || '';
      var ready1 = customerName.trim().length > 0 && phone.replace(/\D/g, '').length >= 11;
      btn1.classList.toggle('btn-dimmed', !ready1);
    }

    var btn2 = document.getElementById('step2-next');
    if (btn2) {
      var ready2 = true;
      if (checkoutState.deliveryType === 'delivery') {
        var addrInput = document.getElementById('field-addr-suggest');
        if (!addrInput || !addrInput.value.trim()) ready2 = false;
        if (!checkoutState.deliveryInterval && !checkoutState.exactTime) ready2 = false;
        if (isDeliveryTooFar()) ready2 = false;
      } else {
        if (!checkoutState.pickupTime) ready2 = false;
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
    var h = '<div class="order-summary">╨в╨╛╨▓╨░╤А╤Л: ' + formatPrice(goodsTotal) + '</div>';
    if (checkoutState.deliveryType === 'delivery') {
      var deliveryLabel = checkoutState.exactTime ? '╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ (╤В╨╛╤З╨╜╨╛ ╨║╨╛ ╨▓╤А╨╡╨╝╨╡╨╜╨╕)' : '╨Ф╨╛╤Б╤В╨░╨▓╨║╨░';
      if (checkoutState.deliveryDistance > 0 && !checkoutState.exactTime) {
        deliveryLabel += ' (' + checkoutState.deliveryDistance.toFixed(1) + ' ╨║╨╝)';
      }
      h += '<div class="order-summary">' + deliveryLabel + ': ' + formatPrice(deliveryCost) + '</div>';
    }
    h += '<div class="cart-total">╨Ш╤В╨╛╨│╨╛: ' + formatPrice(total) + '</div>';
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
      var label = isPickup ? '╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖' : '╨Ф╨╛╤Б╤В╨░╨▓╨║╨░';
      notice.textContent = label + ' ╨╜╨░ ╤Б╨╡╨│╨╛╨┤╨╜╤П ╤Г╨╢╨╡ ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╜╨░ (╨┐╨╛╤Б╨╗╨╡ ' + cutoffHr + ':00). ╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨┤╤А╤Г╨│╤Г╤О ╨┤╨░╤В╤Г.';
      notice.style.display = '';
    } else {
      notice.style.display = 'none';
    }
  }

  function getTodayIsoDate() {
    return saratovNow().dateStr;
  }

  function isPastIsoDate(dateStr) {
    var d = String(dateStr || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    return d < getTodayIsoDate();
  }

  function normalizeDateFieldNotPast() {
    var dateField = document.getElementById('field-date');
    if (!dateField) return;
    var today = getTodayIsoDate();
    if (dateField.min !== today) dateField.min = today;
    if (!dateField.value || isPastIsoDate(dateField.value)) {
      dateField.value = today;
    }
  }

  function renderIntervals() {
    var el = document.getElementById('interval-group');
    if (!el) return;
    normalizeDateFieldNotPast();
    var dateField = document.getElementById('field-date');
    var selectedDate = dateField ? dateField.value : '';
    var sNowIv = saratovNow();
    var todayStr = sNowIv.dateStr;
    var isToday = selectedDate === todayStr;
    var currentHour = sNowIv.hours;
    var currentMin = sNowIv.minutes;
    var isPickup = checkoutState.deliveryType === 'pickup';

    if (isPickup) {
      var pickupCutoffH = 20;
      var pickupCutoffM = 30;
      if (isToday && (currentHour > pickupCutoffH || (currentHour === pickupCutoffH && currentMin >= pickupCutoffM))) {
        el.innerHTML = '<div class="cutoff-hint">╨Э╨░ ╤Б╨╡╨│╨╛╨┤╨╜╤П ╤Б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╡╨╜. ╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨┤╤А╤Г╨│╤Г╤О ╨┤╨░╤В╤Г.</div>';
        return;
      }
      var minTime = '10:00';
      if (isToday) {
        var minH = currentHour + 1;
        var minM = currentMin + 30;
        if (minM >= 60) { minH++; minM -= 60; }
        if (minH < 10) minH = 10;
        minTime = String(minH).padStart(2, '0') + ':' + String(minM).padStart(2, '0');
      }
      var pickupVal = checkoutState.pickupTime || minTime;
      if (pickupVal < minTime) pickupVal = minTime;
      if (pickupVal > '21:00') pickupVal = '21:00';
      el.innerHTML =
        '<div style="font-size:13px;color:#666;margin-bottom:8px">╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ ╤Б 10:00 ╨┤╨╛ 21:00. ╨Ь╨╕╨╜╨╕╨╝╤Г╨╝ ╨╖╨░ 1,5 ╤З╨░╤Б╨░ ╨┤╨╛ ╨▓╤Л╨▒╤А╨░╨╜╨╜╨╛╨│╨╛ ╨▓╤А╨╡╨╝╨╡╨╜╨╕.</div>' +
        '<input type="time" id="field-pickup-time" class="form-input-date" value="' + pickupVal + '" min="' + minTime + '" max="21:00" onchange="onPickupTimeChange()">' +
        '<div id="pickup-time-warn" class="cutoff-notice" style="display:none"></div>';
      checkoutState.pickupTime = pickupVal;
      checkoutState.deliveryInterval = '╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ ╨║ ' + pickupVal;
      setTimeout(function () { validatePickupTime(); }, 50);
      return;
    }

    var cutoff = getCutoffHour();
    var pastCutoff = isToday && currentHour >= cutoff;

    var split = getIntervalsSplit();
    var dayIntervals = split.day;
    var nightIntervals = split.night;
    if (pastCutoff) {
      el.innerHTML = '<div class="cutoff-hint">╨Э╨░ ╤Б╨╡╨│╨╛╨┤╨╜╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨░ ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╜╨░ ╨┐╨╛╤Б╨╗╨╡ ' + cutoff + ':00. ╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨┤╤А╤Г╨│╤Г╤О ╨┤╨░╤В╤Г ╨╕╨╗╨╕ ╤Б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖.</div>';
      return;
    }
    var selectedBaseDate = null;
    if (selectedDate) {
      var dp = selectedDate.split('-');
      if (dp.length === 3) {
        selectedBaseDate = new Date(parseInt(dp[0], 10), parseInt(dp[1], 10) - 1, parseInt(dp[2], 10));
      }
    }
    if (!selectedBaseDate) {
      selectedBaseDate = new Date(sNowIv.year, sNowIv.month - 1, sNowIv.day);
    }
    var nextBaseDate = new Date(selectedBaseDate.getFullYear(), selectedBaseDate.getMonth(), selectedBaseDate.getDate() + 1);

    function formatDayMonth(dt) {
      return String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0');
    }

    function getNightSlotDate(iv) {
      var parts = String(iv || '').split('-');
      var startHour = parseInt(parts[0], 10);
      var isAfterMidnight = startHour >= 0 && startHour < 10;
      return isAfterMidnight ? nextBaseDate : selectedBaseDate;
    }

    function buildOption(iv, isNight) {
      var parts = iv.split('-');
      var startH = parseInt(parts[0]);
      var disabled = false;
      if (isNight) {
        disabled = false;
      } else {
        if (pastCutoff) {
          disabled = true;
        } else if (isToday) {
          disabled = currentHour >= startH;
        }
      }
      var displayIv = iv.replace('-', ' тАФ ');
      var nightBadge = '';
      if (isNight) {
        var slotDate = getNightSlotDate(iv);
        nightBadge = '<span class="night-date-badge">' + formatDayMonth(slotDate) + '</span>';
      }
      return '<label class="radio-option' + (isNight ? ' radio-option-night' : '') +
        (disabled ? '" style="opacity:0.3;pointer-events:none"' : '"') +
        ' onclick="setDeliveryInterval(\'' + escapeHtml(iv) + '\')">' +
        '<input type="radio" name="interval" value="' + escapeHtml(iv) + '"' + (disabled ? ' disabled' : '') + '>' +
        '<span class="radio-dot"></span> ' + escapeHtml(displayIv) +
        (disabled ? ' (╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╡╨╜)' : '') + nightBadge + '</label>';
    }

    var html = dayIntervals.map(function (iv) { return buildOption(iv, false); }).join('');
    if (nightIntervals.length > 0) {
      html += '<div class="night-intervals-divider" onclick="toggleNightIntervals()" style="cursor:pointer;user-select:none">' +
        '<span class="night-icon">&#9790;</span> ╨Э╨╛╤З╨╜╨░╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨░ (' + formatDayMonth(selectedBaseDate) + ' тАФ ' + formatDayMonth(nextBaseDate) + ')' +
        ' <span id="night-toggle-arrow" style="float:right;transition:transform 0.3s">&#9660;</span></div>';
      html += '<div id="night-intervals-container" style="display:none">';
      html += nightIntervals.map(function (iv) { return buildOption(iv, true); }).join('');
      html += '</div>';
    }
    el.innerHTML = html;
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
    var cutoff = getCutoffHour();
    var split = getIntervalsSplit();
    var allIntervals = split.day.concat(split.night);
    var nightSet = {};
    split.night.forEach(function (iv) { nightSet[iv] = true; });

    var todayAvailable = [];
    var todayDeliveryClosed = currentHour >= cutoff;
    if (allIntervals.length && !todayDeliveryClosed) {
      allIntervals.forEach(function (iv) {
        var startH = parseInt(iv.split('-')[0]);
        var isNightIv = !!nightSet[iv];
        if (isNightIv) {
          todayAvailable.push(iv);
        } else if (currentHour < startH) {
          todayAvailable.push(iv);
        }
      });
    }

    var dayNames = ['╨▓╨╛╤Б╨║╤А╨╡╤Б╨╡╨╜╤М╨╡', '╨┐╨╛╨╜╨╡╨┤╨╡╨╗╤М╨╜╨╕╨║', '╨▓╤В╨╛╤А╨╜╨╕╨║', '╤Б╤А╨╡╨┤╤Г', '╤З╨╡╤В╨▓╨╡╤А╨│', '╨┐╤П╤В╨╜╨╕╤Ж╤Г', '╤Б╤Г╨▒╨▒╨╛╤В╤Г'];

    if (todayAvailable.length > 0) {
      var nearIv = todayAvailable[0];
      var nearNightLabel = '';
      if (nightSet[nearIv]) {
        var nextD = new Date(sNow.year, sNow.month - 1, sNow.day + 1);
        nearNightLabel = ' (╨╜╨╛╤З╤М ╨╜╨░ ' + String(nextD.getDate()).padStart(2, '0') + '.' + String(nextD.getMonth() + 1).padStart(2, '0') + ')';
      }
      el.innerHTML = '╨С╨╗╨╕╨╢╨░╨╣╤И╨░╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨░: <b>╤Б╨╡╨│╨╛╨┤╨╜╤П, ' + escapeHtml(nearIv.replace('-', ' тАФ ')) + nearNightLabel + '</b>';
      el.style.display = '';
    } else if (allIntervals.length > 0) {
      var tmrw = new Date(sNow.year, sNow.month - 1, sNow.day + 1);
      var dayIdx = tmrw.getDay();
      var dayName = dayNames[dayIdx];
      var tmrwStr = String(tmrw.getDate()).padStart(2, '0') + '.' + String(tmrw.getMonth() + 1).padStart(2, '0');
      var firstIv = split.day.length > 0 ? split.day[0] : split.night[0];
      var tmrwNightLabel = '';
      if (nightSet[firstIv]) {
        var tmrwNext = new Date(sNow.year, sNow.month - 1, sNow.day + 2);
        tmrwNightLabel = ' (╨╜╨╛╤З╤М ╨╜╨░ ' + String(tmrwNext.getDate()).padStart(2, '0') + '.' + String(tmrwNext.getMonth() + 1).padStart(2, '0') + ')';
      }
      el.innerHTML = '╨С╨╗╨╕╨╢╨░╨╣╤И╨░╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨░: <b>' + dayName + ' ' + tmrwStr + ', ' + escapeHtml(firstIv.replace('-', ' тАФ ')) + tmrwNightLabel + '</b>';
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }

  function validatePickupTime() {
    var input = document.getElementById('field-pickup-time');
    var warn = document.getElementById('pickup-time-warn');
    if (!input) return true;
    var val = input.value;
    if (!val) { checkoutState.deliveryInterval = ''; updateStepButtons(); return false; }

    var sNow = saratovNow();
    var dateField = document.getElementById('field-date');
    var isToday = dateField && dateField.value === sNow.dateStr;

    if (val < '10:00' || val > '21:00') {
      if (warn) { warn.textContent = '╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ ╨┤╨╛╤Б╤В╤Г╨┐╨╡╨╜ ╤Б 10:00 ╨┤╨╛ 21:00'; warn.style.display = ''; }
      checkoutState.deliveryInterval = '';
      updateStepButtons();
      return false;
    }

    if (isToday) {
      var valParts = val.split(':');
      var valH = parseInt(valParts[0]);
      var valM = parseInt(valParts[1]);
      var valMin = valH * 60 + valM;
      var nowMin = sNow.hours * 60 + sNow.minutes;
      if (valMin - nowMin < 90) {
        if (warn) { warn.textContent = '╨Ф╨╛ ╨▓╤Л╨▒╤А╨░╨╜╨╜╨╛╨│╨╛ ╨▓╤А╨╡╨╝╨╡╨╜╨╕ ╨┤╨╛╨╗╨╢╨╜╨╛ ╨▒╤Л╤В╤М ╨╜╨╡ ╨╝╨╡╨╜╨╡╨╡ 1,5 ╤З╨░╤Б╨░'; warn.style.display = ''; }
        checkoutState.deliveryInterval = '';
        updateStepButtons();
        return false;
      }
    }

    if (warn) warn.style.display = 'none';
    checkoutState.pickupTime = val;
    checkoutState.deliveryInterval = '╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ ╨║ ' + val;
    updateStepButtons();
    return true;
  }

  window.onPickupTimeChange = function () {
    validatePickupTime();
    saveCheckoutDraft();
  };

  window.onDeliveryDateChange = function () {
    normalizeDateFieldNotPast();
    var dateField = document.getElementById('field-date');
    if (dateField && isPastIsoDate(dateField.value)) {
      dateField.value = getTodayIsoDate();
      showToast('╨Э╨╡╨╗╤М╨╖╤П ╨▓╤Л╨▒╤А╨░╤В╤М ╨┐╤А╨╛╤И╨╡╨┤╤И╤Г╤О ╨┤╨░╤В╤Г');
    }
    updateCutoffNotice();
    checkoutState.deliveryInterval = '';
    checkoutState.pickupTime = '';
    renderIntervals();
    if (checkoutState.exactTime) validateExactTime();
    updateStepButtons();
    saveCheckoutDraft();
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
    if (dateLabel) dateLabel.textContent = type === 'pickup' ? '╨Ф╨░╤В╨░ ╨│╨╛╤В╨╛╨▓╨╜╨╛╤Б╤В╨╕' : '╨Ф╨░╤В╨░ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕';
    var timeLabel = document.getElementById('time-label');
    if (timeLabel) timeLabel.textContent = type === 'pickup' ? '╨Т╤А╨╡╨╝╤П ╨│╨╛╤В╨╛╨▓╨╜╨╛╤Б╤В╨╕' : '╨Т╤А╨╡╨╝╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕';
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
    checkoutState.deliveryInterval = '';
    checkoutState.pickupTime = '';
    updateCutoffNotice();
    renderIntervals();
    updateNearestDeliveryHint();
    updateCheckoutSummary();
    updateStepButtons();
    saveCheckoutDraft();
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

  window.toggleNightIntervals = function () {
    var container = document.getElementById('night-intervals-container');
    var arrow = document.getElementById('night-toggle-arrow');
    if (!container) return;
    if (container.style.display === 'none') {
      container.style.display = 'block';
      if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
      container.style.display = 'none';
      if (arrow) arrow.style.transform = '';
    }
  };

  window.setDeliveryInterval = function (iv) {
    checkoutState.deliveryInterval = iv;
    var opts = document.querySelectorAll('#interval-group .radio-option');
    opts.forEach(function (o) { o.classList.remove('selected'); });
    var radios = document.querySelectorAll('#interval-group input[type="radio"]');
    radios.forEach(function (r) {
      if (r.value === iv) r.closest('.radio-option').classList.add('selected');
    });
    if (checkoutState.deliveryDistance > 0) {
      showDistanceResult(checkoutState.deliveryDistance, checkoutState.isEngels ? '╨╛╤В ╤Ж╨╡╨╜╤В╤А╨░ ╨н╨╜╨│╨╡╨╗╤М╤Б╨░' : '╨╛╤В ╨╝╨░╨│╨░╨╖╨╕╨╜╨░');
    }
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
      warn.textContent = '╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨╜╨╡╨▓╨╛╨╖╨╝╨╛╨╢╨╜╨░ ╨╝╨╡╨╜╨╡╨╡ ╤З╨╡╨╝ ╨╖╨░ 1,5 ╤З╨░╤Б╨░. ╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨▒╨╛╨╗╨╡╨╡ ╨┐╨╛╨╖╨┤╨╜╨╡╨╡ ╨▓╤А╨╡╨╝╤П ╨╕╨╗╨╕ ╨┤╤А╤Г╨│╤Г╤О ╨┤╨░╤В╤Г.';
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
    if (apt && apt.value.trim()) parts.push('╨║╨▓./╨╛╤Д. ' + apt.value.trim());
    if (note && note.value.trim()) parts.push(note.value.trim());
    return parts.join(', ');
  }

  window.submitOrder = function (event) {
    if (event && event.preventDefault) event.preventDefault();
    var submitBtn = document.getElementById('checkout-submit');
    if (submitBtn && submitBtn.classList.contains('btn-dimmed')) return;

    var consentCb = document.getElementById('consent-cb');
    if (!consentCb || !consentCb.checked) {
      showToast('╨Я╨╛╨┤╤В╨▓╨╡╤А╨┤╨╕╤В╨╡ ╤Б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╤Г ╨┐╨╡╤А╤Б╨╛╨╜╨░╨╗╤М╨╜╤Л╤Е ╨┤╨░╨╜╨╜╤Л╤Е');
      return;
    }

    var cart = getCart();
    if (!cart.length) return;

    var isSelf = document.getElementById('self-receiver-cb') && document.getElementById('self-receiver-cb').checked;
    var customerNameVal = document.getElementById('field-customer-name') ? document.getElementById('field-customer-name').value.trim() : '';
    var phoneVal = document.getElementById('field-phone') ? document.getElementById('field-phone').value.trim() : '';
    var rcvName = isSelf ? customerNameVal : (document.getElementById('field-rcv-name') ? document.getElementById('field-rcv-name').value.trim() : '');
    var rcvPhone = isSelf ? phoneVal : (document.getElementById('field-rcv-phone') ? document.getElementById('field-rcv-phone').value.trim() : '');
    var dateVal = document.getElementById('field-date') ? document.getElementById('field-date').value : '';
    if (!dateVal || isPastIsoDate(dateVal)) {
      showToast('╨Э╨╡╨╗╤М╨╖╤П ╨╛╤Д╨╛╤А╨╝╨╕╤В╤М ╨╖╨░╨║╨░╨╖ ╨╜╨░ ╨┐╤А╨╛╤И╨╡╨┤╤И╤Г╤О ╨┤╨░╤В╤Г');
      return;
    }

    if (!isSelf && (!rcvName || !rcvPhone)) {
      showToast('╨Ч╨░╨┐╨╛╨╗╨╜╨╕╤В╨╡ ╨┤╨░╨╜╨╜╤Л╨╡ ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤П');
      return;
    }
    if (!isSelf && rcvPhone && !validatePhone(rcvPhone)) return;

    var tgNick = (tgUser && tgUser.username) || (dbUser && dbUser.username) || '';
    if (tgNick && tgNick.charAt(0) !== '@') tgNick = '@' + tgNick;

    var data = {
      user_name: customerNameVal || phoneVal,
      user_phone: phoneVal,
      user_email: '',
      user_telegram: tgNick,
      receiver_name: rcvName,
      receiver_phone: rcvPhone,
      delivery_address: (checkoutState.deliveryType === 'pickup')
        ? (appSettings.pickup_address || '╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖')
        : buildDeliveryAddress(),
      delivery_type: checkoutState.deliveryType,
      delivery_zone: '',
      delivery_cost: getDeliveryCost(),
      delivery_distance: checkoutState.deliveryDistance || 0,
      delivery_interval: checkoutState.exactTime
        ? ('╨в╨╛╤З╨╜╨╛ ╨║╨╛ ╨▓╤А╨╡╨╝╨╡╨╜╨╕: ' + (document.getElementById('field-exact-time') ? document.getElementById('field-exact-time').value : ''))
        : (checkoutState.deliveryType === 'pickup'
          ? (checkoutState.pickupTime ? '╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ ╨║ ' + checkoutState.pickupTime : '')
          : checkoutState.deliveryInterval),
      delivery_date: (function () {
        if (checkoutState.isNightInterval && dateVal) {
          var _dp = dateVal.split('-');
          var _nd = new Date(parseInt(_dp[0]), parseInt(_dp[1]) - 1, parseInt(_dp[2]) + 1);
          return _nd.getFullYear() + '-' + String(_nd.getMonth() + 1).padStart(2, '0') + '-' + String(_nd.getDate()).padStart(2, '0');
        }
        return dateVal;
      })(),
      exact_time: checkoutState.exactTime ? (document.getElementById('field-exact-time') ? document.getElementById('field-exact-time').value : '') : '',
      comment: document.getElementById('field-comment') ? document.getElementById('field-comment').value.trim() : '',
      telegram_id: getTelegramId() || '',
      city_id: selectedCity ? selectedCity.id : null,
      items: cart.map(function (i) {
        return { product_id: i.product_id, quantity: i.quantity, price: i.price, size_label: i.size_label || '' };
      })
    };

    var btn = document.getElementById('checkout-submit');
    if (btn) { btn.disabled = true; btn.textContent = '╨Ю╤В╨┐╤А╨░╨▓╨║╨░...'; }

    postJSON('/api/orders', data).then(function (result) {
      if (!result.success) {
        if (btn) { btn.disabled = false; btn.textContent = '╨Ю╤Д╨╛╤А╨╝╨╕╤В╤М ╨╖╨░╨║╨░╨╖'; }
        showToast(result.error || '╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╨╕ ╨╖╨░╨║╨░╨╖╨░');
        return;
      }

      saveCart([]);
      clearCheckoutDraft();
      _inCheckout = false;
      _abandonedSent = true;
      stopAbandonTimer();
      updateCartBadge();

      requestPaymentAndShow(result.order_id, result.total_amount);
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = '╨Ю╤Д╨╛╤А╨╝╨╕╤В╤М ╨╖╨░╨║╨░╨╖'; }
      console.error('Order error:', err);
      showToast('╨Ю╤И╨╕╨▒╨║╨░: ' + (err.message || '╨╜╨╡╤В ╨┐╨╛╨┤╨║╨╗╤О╤З╨╡╨╜╨╕╤П ╨║ ╤Б╨╡╤А╨▓╨╡╤А╤Г'));
    });
  };

  function requestPaymentAndShow(orderId, totalAmount) {
    postJSON('/api/payments/create', { order_id: orderId }).then(function (pay) {
      if (pay && pay.payment_url) {
        showPaymentPage(orderId, pay.payment_url, totalAmount);
        return;
      }
      var msg = (pay && (pay.error || pay.message)) || '╨б╤Б╤Л╨╗╨║╨░ ╨╜╨░ ╨╛╨┐╨╗╨░╤В╤Г ╨╜╨╡ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨░';
      showPaymentInitFailed(orderId, totalAmount, msg);
    }).catch(function (err) {
      showPaymentInitFailed(orderId, totalAmount, (err && err.message) || '╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨┤╨║╨╗╤О╤З╨╡╨╜╨╕╤П ╨║ ╨┐╨╗╨░╤В╨╡╨╢╨╜╨╛╨╝╤Г ╤Б╨╡╤А╨▓╨╕╤Б╤Г');
    });
  }

  function showPaymentPage(orderId, paymentUrl, totalAmount) {
    renderWithWebTop(
      '<div class="web-flow-shell web-flow-shell--payment">' +
        '<div class="section-title">╨Ю╨┐╨╗╨░╤В╨░ ╨╖╨░╨║╨░╨╖╨░ N ' + orderId + '</div>' +
        '<div style="margin-bottom:16px;font-size:14px;">' +
          '<p>╨б╤Г╨╝╨╝╨░ ╨║ ╨╛╨┐╨╗╨░╤В╨╡: ' + formatPrice(totalAmount) + '</p>' +
        '</div>' +
        '<button class="nav-btn nav-btn--filled" style="display:block;text-align:center;margin-bottom:16px;" onclick="openPaymentUrl(\'' + encodeURIComponent(paymentUrl) + '\')">╨Ю╨┐╨╗╨░╤В╨╕╤В╤М</button>' +
        '<button class="nav-btn" onclick="navigateTo(\'home\')">╨Э╨░ ╨│╨╗╨░╨▓╨╜╤Г╤О</button>' +
        '<div style="margin-top:16px;font-size:12px;">' +
          '<p>╨Я╨╛╤Б╨╗╨╡ ╨╛╨┐╨╗╨░╤В╤Л ╤Б╤В╨░╤В╤Г╤Б ╨╖╨░╨║╨░╨╖╨░ ╨╛╨▒╨╜╨╛╨▓╨╕╤В╤Б╤П ╨░╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕.</p>' +
        '</div>' +
      '</div>'
    );
    showToast('╨Ч╨░╨║╨░╨╖ N ' + orderId + ' ╤Б╨╛╨╖╨┤╨░╨╜');
  }

  function showPaymentInitFailed(orderId, totalAmount, errorText) {
    renderWithWebTop(
      '<div class="web-flow-shell web-flow-shell--payment">' +
        '<div class="section-title">╨Ч╨░╨║╨░╨╖ N ' + orderId + ' ╤Б╨╛╨╖╨┤╨░╨╜</div>' +
        '<div style="margin-bottom:16px;font-size:14px;">' +
          '<p>╨б╤Г╨╝╨╝╨░ ╨║ ╨╛╨┐╨╗╨░╤В╨╡: ' + formatPrice(totalAmount) + '</p>' +
        '</div>' +
        '<div class="cutoff-hint" style="margin-bottom:14px">╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨╛╤В╨║╤А╤Л╤В╤М ╨╛╨┐╨╗╨░╤В╤Г: ' + escapeHtml(errorText || '╨╜╨╡╨╕╨╖╨▓╨╡╤Б╤В╨╜╨░╤П ╨╛╤И╨╕╨▒╨║╨░') + '</div>' +
        '<button class="nav-btn nav-btn--filled" onclick="retryPayment(' + orderId + ',' + totalAmount + ')" style="display:block;width:100%;margin-bottom:12px">╨Я╨╛╨▓╤В╨╛╤А╨╕╤В╤М ╨╛╨┐╨╗╨░╤В╤Г</button>' +
        '<button class="nav-btn" onclick="navigateTo(\'account\')">╨Ь╨╛╨╕ ╨╖╨░╨║╨░╨╖╤Л</button>' +
      '</div>'
    );
    showToast('╨Ч╨░╨║╨░╨╖ ╤Б╨╛╨╖╨┤╨░╨╜, ╨╜╨╛ ╨╛╨┐╨╗╨░╤В╨░ ╨╜╨╡ ╨╛╤В╨║╤А╤Л╨╗╨░╤Б╤М');
  }

  window.openPaymentUrl = function (encodedUrl) {
    var paymentUrl = '';
    try {
      paymentUrl = decodeURIComponent(String(encodedUrl || ''));
    } catch (e) {
      paymentUrl = String(encodedUrl || '');
    }
    if (!paymentUrl) return;
    var opened = null;
    try {
      opened = window.open(paymentUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {}
    if (!opened) {
      window.location.href = paymentUrl;
    }
  };

  window.retryPayment = function (orderId, totalAmount) {
    requestPaymentAndShow(orderId, totalAmount);
  };

  function showOrderSuccess(orderId) {
    renderWithWebTop(
      '<div class="success-message">' +
        '<p>╨Ч╨░╨║╨░╨╖ ╨╛╤Д╨╛╤А╨╝╨╗╨╡╨╜</p>' +
        '<div class="order-number">N ' + orderId + '</div>' +
        '<p>╨Ь╤Л ╤Б╨▓╤П╨╢╨╡╨╝╤Б╤П ╤Б ╨▓╨░╨╝╨╕ ╨┤╨╗╤П ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨╡╨╜╨╕╤П.</p>' +
        '<button class="nav-btn" onclick="navigateTo(\'home\')" style="margin-top:20px">╨Э╨░ ╨│╨╗╨░╨▓╨╜╤Г╤О</button>' +
      '</div>'
    );
    showToast('╨Ч╨░╨║╨░╨╖ ╨╛╤Д╨╛╤А╨╝╨╗╨╡╨╜');
  }

  // ============================================================
  // Account
  // ============================================================

  function showAccount() {
    setActiveTab('account');
    if (!tgUser && !dbUser && !getTelegramId()) {
      renderWithWebTop(
        '<div class="web-flow-shell web-flow-shell--profile">' +
          '<div class="web-centered-page-card">' +
          '<div class="section-title">╨Я╤А╨╛╤Д╨╕╨╗╤М</div>' +
          '<div class="account-section">' +
            '<p style="margin-bottom:12px">╨Т╤Л ╨▓ ╨│╨╛╤Б╤В╨╡╨▓╨╛╨╝ ╤А╨╡╨╢╨╕╨╝╨╡. ╨Ь╨╛╨╢╨╜╨╛ ╨┐╨╛╨║╤Г╨┐╨░╤В╤М ╨▒╨╡╨╖ ╨▓╤Е╨╛╨┤╨░.</p>' +
            '<p style="margin-bottom:14px;color:#666">╨Х╤Б╨╗╨╕ ╤Е╨╛╤В╨╕╤В╨╡ ╤Б╨╕╨╜╤Е╤А╨╛╨╜╨╕╨╖╨░╤Ж╨╕╤О ╤Б Mini App ╨╕ ╨╕╤Б╤В╨╛╤А╨╕╤О ╨╖╨░╨║╨░╨╖╨╛╨▓ ╨╜╨░ ╨▓╤Б╨╡╤Е ╤Г╤Б╤В╤А╨╛╨╣╤Б╤В╨▓╨░╤Е, ╨┐╤А╨╕╨▓╤П╨╢╨╕╤В╨╡ Telegram (╨╜╨╡╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╨╛).</p>' +
            (!isTelegramRuntime ? '<div id="web-telegram-login-widget"></div>' : '') +
          '</div>' +
          '</div>' +
        '</div>'
      );
      if (!isTelegramRuntime) mountWebTelegramLoginWidget('web-telegram-login-widget');
      return;
    }

    var name = (dbUser && dbUser.first_name) || (tgUser && tgUser.first_name) || '╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М';
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

    var adminPanelHref = '/admin';
    var tidAdmin = getTelegramId();
    if (tidAdmin) {
      adminPanelHref = '/admin.html?tg_auth=' + encodeURIComponent(tidAdmin);
      if (tgUsername) adminPanelHref += '&tg_user=' + encodeURIComponent(tgUsername);
    }

    renderWithWebTop(
      '<div class="web-flow-shell web-flow-shell--profile">' +
        '<div class="web-centered-page-card">' +
        '<div class="profile-header">' +
          avatarHtml +
          '<div class="profile-info">' +
            '<div class="profile-name">' + escapeHtml(fullName) + '<span id="admin-crown" class="admin-crown" style="display:none"></span><span id="admin-badge" style="display:none" class="admin-badge">ADMIN</span></div>' +
            (username ? '<div class="profile-username">@' + escapeHtml(username) + '</div>' : '') +
          '</div>' +
        '</div>' +

        '<div id="admin-panel-btn-wrap" style="display:none">' +
          '<button class="admin-panel-btn" onclick="openAdminPanel()">╨Р╨┤╨╝╨╕╨╜-╨┐╨░╨╜╨╡╨╗╤М</button>' +
        '</div>' +

        '<div class="profile-section profile-tracking-section">' +
          '<div class="profile-section-header">' +
            '<span class="profile-section-title tracking-title">╨Ч╨░╨║╨░╨╖╤Л</span>' +
          '</div>' +
          '<div id="profile-tracking"><div class="empty-state" style="padding:12px">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div></div>' +
        '</div>' +

        '<div class="nav-buttons">' +
          '<button class="nav-btn" onclick="toggleProfileSection(\'addresses\')">╨Ь╨╛╨╕ ╨░╨┤╤А╨╡╤Б╨░</button>' +
          '<button class="nav-btn" onclick="toggleProfileSection(\'orders\')">╨Ш╤Б╤В╨╛╤А╨╕╤П ╨╖╨░╨║╨░╨╖╨╛╨▓</button>' +
        '</div>' +

        '<div class="profile-admin-entry">' +
          '<a class="profile-admin-link" href="' + escapeHtml(adminPanelHref) + '">\u0410\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c</a>' +
          '<span class="profile-admin-hint">\u0434\u043b\u044f \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u0432</span>' +
        '</div>' +

        '<div id="section-addresses" class="profile-section" style="display:none">' +
          '<div class="profile-section-header">' +
            '<span class="profile-section-title">╨Ь╨╛╨╕ ╨░╨┤╤А╨╡╤Б╨░</span>' +
            '<button class="profile-add-btn" onclick="showAddAddress()">+ ╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М</button>' +
          '</div>' +
          '<div id="profile-addresses"><div class="empty-state" style="padding:12px">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div></div>' +
        '</div>' +

        '<div id="section-orders" class="profile-section" style="display:none">' +
          '<div class="profile-section-header">' +
            '<span class="profile-section-title">╨Ш╤Б╤В╨╛╤А╨╕╤П ╨╖╨░╨║╨░╨╖╨╛╨▓</span>' +
          '</div>' +
          '<div id="profile-orders"><div class="empty-state" style="padding:12px">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div></div>' +
        '</div>' +
      '</div>' +
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

  var TRACK_STEPS_DELIVERY = ['╨Ю╨┐╨╗╨░╤З╨╡╨╜', '╨б╨╛╨▒╨╕╤А╨░╨╡╤В╤Б╤П', '╨б╨╛╨▒╤А╨░╨╜', '╨Ю╤В╨┐╤А╨░╨▓╨╗╨╡╨╜', '╨Ф╨╛╤Б╤В╨░╨▓╨╗╨╡╨╜'];
  var TRACK_STEPS_PICKUP = ['╨Ю╨┐╨╗╨░╤З╨╡╨╜', '╨б╨╛╨▒╨╕╤А╨░╨╡╤В╤Б╤П', '╨У╨╛╤В╨╛╨▓ ╨║ ╨▓╤Л╨┤╨░╤З╨╡'];

  function getTrackSteps(order) {
    return order.delivery_type === 'pickup' ? TRACK_STEPS_PICKUP : TRACK_STEPS_DELIVERY;
  }

  function isFinalStatus(order) {
    if (order.status === '╨Т╤Л╨┐╨╛╨╗╨╜╨╡╨╜') return true;
    if (order.delivery_type === 'pickup') return order.status === '╨У╨╛╤В╨╛╨▓ ╨║ ╨▓╤Л╨┤╨░╤З╨╡';
    return order.status === '╨Ф╨╛╤Б╤В╨░╨▓╨╗╨╡╨╜';
  }

  function shouldShowInTracking(order) {
    if (order.status === '╨Т╤Л╨┐╨╛╨╗╨╜╨╡╨╜') return false;
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
        el.innerHTML = '<div class="empty-state" style="padding:12px">╨Р╨║╤В╨╕╨▓╨╜╤Л╤Е ╨╖╨░╨║╨░╨╖╨╛╨▓ ╨╜╨╡╤В</div>';
        return;
      }
      var active = orders.filter(shouldShowInTracking);
      if (!active.length) {
        el.innerHTML = '<div class="empty-state" style="padding:12px">╨Т╤Б╨╡ ╨╖╨░╨║╨░╨╖╤Л ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜╤Л</div>';
        return;
      }
      var deliveryOrders = active.filter(function (o) { return o.delivery_type !== 'pickup'; });
      var pickupOrders = active.filter(function (o) { return o.delivery_type === 'pickup'; });

      function renderMiniCard(o) {
        var steps = getTrackSteps(o);
        var currentIdx = steps.indexOf(o.status);
        if (o.status === '╨Т╤Л╨┐╨╛╨╗╨╜╨╡╨╜') currentIdx = steps.length - 1;
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
          timeInfo = '<div class="track-time-info">╨У╨╛╤В╨╛╨▓╨╜╨╛╤Б╤В╤М: ' + escapeHtml(o.delivery_date) +
            (o.delivery_interval ? ', ' + escapeHtml(o.delivery_interval) : '') + '</div>';
        } else if (!isPickup && o.delivery_date) {
          timeInfo = '<div class="track-time-info">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░: ' + escapeHtml(o.delivery_date) +
            (o.exact_time ? ' ╨║ ' + escapeHtml(o.exact_time) : (o.delivery_interval ? ', ' + escapeHtml(o.delivery_interval) : '')) + '</div>';
        }
        var itemsList = '';
        if (o.items && o.items.length) {
          itemsList = o.items.map(function (i) {
            var s = escapeHtml(i.product_name || '╨в╨╛╨▓╨░╤А');
            if (i.size_label) s += ' [' + escapeHtml(i.size_label) + ']';
            s += ' ├Ч ' + i.quantity + ' тАФ ' + formatPrice(i.price * i.quantity);
            return '<div class="track-order-item">' + s + '</div>';
          }).join('');
        }

        var addressInfo = '';
        if (isPickup) {
          addressInfo = '<div class="track-detail-row"><span class="track-detail-label">╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖</span></div>';
        } else if (o.delivery_address) {
          addressInfo = '<div class="track-detail-row"><span class="track-detail-label">╨Р╨┤╤А╨╡╤Б:</span> ' + escapeHtml(o.delivery_address) + '</div>';
        }
        var receiverInfo = '';
        if (o.receiver_name) {
          receiverInfo = '<div class="track-detail-row"><span class="track-detail-label">╨Я╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤М:</span> ' + escapeHtml(o.receiver_name) + (o.receiver_phone ? ', ' + escapeHtml(o.receiver_phone) : '') + '</div>';
        }

        return '<div class="track-card-mini" onclick="toggleOrderDetail(this)">' +
          '<div class="track-header"><span class="track-id">╨Ч╨░╨║╨░╨╖ #' + o.id + '</span><span class="track-status-badge">' + escapeHtml(o.status) + '</span></div>' +
          '<div class="track-status-row"><span class="track-total">' + formatPrice(o.total_amount) + '</span></div>' +
          timeInfo +
          '<div class="timeline">' + timelineHtml + '</div>' +
          '<div class="track-order-details" style="display:none">' +
            addressInfo +
            receiverInfo +
            (o.comment ? '<div class="track-detail-row"><span class="track-detail-label">╨Ъ╨╛╨╝╨╝╨╡╨╜╤В╨░╤А╨╕╨╣:</span> ' + escapeHtml(o.comment) + '</div>' : '') +
            '<div class="track-detail-items-title">╨б╨╛╤Б╤В╨░╨▓ ╨╖╨░╨║╨░╨╖╨░:</div>' +
            itemsList +
            (o.delivery_cost ? '<div class="track-detail-row" style="margin-top:6px"><span class="track-detail-label">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░:</span> ' + formatPrice(o.delivery_cost) + '</div>' : '') +
          '</div>' +
        '</div>';
      }

      var html = '';
      if (deliveryOrders.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░</div>' +
          deliveryOrders.map(renderMiniCard).join('') +
        '</div>';
      }
      if (pickupOrders.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖</div>' +
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
        el.innerHTML = '<div class="empty-state" style="padding:12px">╨Э╨╡╤В ╤Б╨╛╤Е╤А╨░╨╜╤С╨╜╨╜╤Л╤Е ╨░╨┤╤А╨╡╤Б╨╛╨▓</div>';
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
        el.innerHTML = '<div class="empty-state" style="padding:12px">╨Ч╨░╨║╨░╨╖╨╛╨▓ ╨┐╨╛╨║╨░ ╨╜╨╡╤В</div>';
        return;
      }
      var deliveryOrders = orders.filter(function (o) { return o.delivery_type !== 'pickup'; });
      var pickupOrders = orders.filter(function (o) { return o.delivery_type === 'pickup'; });

      function renderHistoryCard(o) {
        var steps = getTrackSteps(o);
        var currentIdx = steps.indexOf(o.status);
        if (o.status === '╨Т╤Л╨┐╨╛╨╗╨╜╨╡╨╜') currentIdx = steps.length - 1;
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
          timeInfo = '<div class="track-time-info">╨У╨╛╤В╨╛╨▓╨╜╨╛╤Б╤В╤М: ' + escapeHtml(o.delivery_date) +
            (o.delivery_interval ? ', ' + escapeHtml(o.delivery_interval) : '') + '</div>';
        } else if (!isPickup && o.delivery_date) {
          timeInfo = '<div class="track-time-info">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░: ' + escapeHtml(o.delivery_date) +
            (o.exact_time ? ' ╨║ ' + escapeHtml(o.exact_time) : (o.delivery_interval ? ', ' + escapeHtml(o.delivery_interval) : '')) + '</div>';
        }

        var addressInfo = '';
        if (isPickup) {
          addressInfo = '<div class="track-detail-row"><span class="track-detail-label">╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖</span></div>';
        } else if (o.delivery_address) {
          addressInfo = '<div class="track-detail-row"><span class="track-detail-label">╨Р╨┤╤А╨╡╤Б:</span> ' + escapeHtml(o.delivery_address) + '</div>';
        }
        var receiverInfo = '';
        if (o.receiver_name) {
          receiverInfo = '<div class="track-detail-row"><span class="track-detail-label">╨Я╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤М:</span> ' + escapeHtml(o.receiver_name) + (o.receiver_phone ? ', ' + escapeHtml(o.receiver_phone) : '') + '</div>';
        }

        return '<div class="track-card-mini" onclick="toggleOrderDetail(this)">' +
          '<div class="track-header"><span class="track-id">╨Ч╨░╨║╨░╨╖ #' + o.id + '</span><span class="track-status-badge">' + escapeHtml(o.status) + '</span></div>' +
          '<div class="track-status-row"><span class="track-total">' + formatPrice(o.total_amount) + '</span></div>' +
          '<div class="track-time-info">╨б╨╛╨╖╨┤╨░╨╜: ' + formatDate(o.created_at) + '</div>' +
          timeInfo +
          '<div class="timeline">' + timelineHtml + '</div>' +
          '<div class="track-order-details" style="display:none">' +
            addressInfo +
            receiverInfo +
            (o.comment ? '<div class="track-detail-row"><span class="track-detail-label">╨Ъ╨╛╨╝╨╝╨╡╨╜╤В╨░╤А╨╕╨╣:</span> ' + escapeHtml(o.comment) + '</div>' : '') +
            (o.delivery_cost ? '<div class="track-detail-row" style="margin-top:6px"><span class="track-detail-label">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░:</span> ' + formatPrice(o.delivery_cost) + '</div>' : '') +
          '</div>' +
        '</div>';
      }

      var html = '';
      if (deliveryOrders.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░</div>' +
          deliveryOrders.map(renderHistoryCard).join('') +
        '</div>';
      }
      if (pickupOrders.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖</div>' +
          pickupOrders.map(renderHistoryCard).join('') +
        '</div>';
      }
      el.innerHTML = html;
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
        '<div class="form-group"><label>╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ (╨╜╨░╨┐╤А. ╨Ф╨╛╨╝, ╨а╨░╨▒╨╛╤В╨░)</label>' +
        '<input type="text" id="addr-label" placeholder="╨Ф╨╛╨╝"></div>' +
        '<div class="form-group"><label>╨У╨╛╤А╨╛╨┤</label>' +
        '<input type="text" id="addr-city" value="' + escapeHtml(cityName) + '" placeholder="╨У╨╛╤А╨╛╨┤"></div>' +
        '<div class="form-group"><label>╨г╨╗╨╕╤Ж╨░, ╨┤╨╛╨╝</label>' +
        '<input type="text" id="addr-street" placeholder="╨г╨╗╨╕╤Ж╨░, ╨┤╨╛╨╝"></div>' +
        '<div class="form-group"><label>╨Ъ╨▓╨░╤А╤В╨╕╤А╨░ / ╨╛╤Д╨╕╤Б</label>' +
        '<input type="text" id="addr-apt" placeholder="╨Ъ╨▓╨░╤А╤В╨╕╤А╨░, ╨┐╨╛╨┤╤К╨╡╨╖╨┤, ╤Н╤В╨░╨╢"></div>' +
        '<div class="form-group"><label>╨Ф╨╛╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡</label>' +
        '<input type="text" id="addr-note" placeholder="╨Ъ╨╛╨┤ ╨┤╨╛╨╝╨╛╤Д╨╛╨╜╨░, ╨╛╤А╨╕╨╡╨╜╤В╨╕╤А╤Л"></div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="nav-btn" onclick="saveNewAddress()">╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М</button>' +
          '<button class="nav-btn" style="background:#eee;color:#000" onclick="loadProfileAddresses()">╨Ю╤В╨╝╨╡╨╜╨░</button>' +
        '</div>' +
      '</div>';
  };

  window.saveNewAddress = function () {
    var telegramId = getTelegramId();
    if (!telegramId) return;
    var districtEl = document.getElementById('addr-district');
    var district = districtEl ? districtEl.value.trim() : '';
    var street = document.getElementById('addr-street').value.trim();
    var apt = document.getElementById('addr-apt').value.trim();
    if (!street || !apt) { showToast('╨Ч╨░╨┐╨╛╨╗╨╜╨╕╤В╨╡ ╤Г╨╗╨╕╤Ж╤Г ╨╕ ╨║╨▓╨░╤А╤В╨╕╤А╤Г'); return; }
    postJSON('/api/user/addresses', {
      telegram_id: telegramId,
      label: document.getElementById('addr-label').value.trim(),
      city: document.getElementById('addr-city').value.trim(),
      district: district,
      street: street,
      apartment: apt,
      note: document.getElementById('addr-note').value.trim()
    }).then(function () {
      showToast('╨Р╨┤╤А╨╡╤Б ╤Б╨╛╤Е╤А╨░╨╜╤С╨╜');
      loadProfileAddresses();
    });
  };

  window.deleteAddress = function (id) {
    var tgid = getTelegramId();
    var q = tgid ? ('?telegram_id=' + encodeURIComponent(tgid)) : '';
    fetch('/api/user/addresses/' + id + q, { method: 'DELETE', credentials: 'include' }).then(function (r) { return r.json(); }).then(function () {
      showToast('╨Р╨┤╤А╨╡╤Б ╤Г╨┤╨░╨╗╤С╨╜');
      loadProfileAddresses();
    });
  };

  window.showOrderHistory = function () {
    var telegramId = getTelegramId();
    if (!telegramId) return;

    renderWithWebTop(
      '<span class="back-link" onclick="navigateTo(\'account\')">╨Ъ ╨║╨░╨▒╨╕╨╜╨╡╤В╤Г</span>' +
      '<div class="section-title">╨Ш╤Б╤В╨╛╤А╨╕╤П ╨╖╨░╨║╨░╨╖╨╛╨▓</div>' +
      '<div id="order-history">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div>'
    );

    fetchJSON('/api/user/orders?telegram_id=' + telegramId).then(function (orders) {
      var el = document.getElementById('order-history');
      if (!orders || !orders.length) {
        el.innerHTML = '<div class="empty-state">╨Ч╨░╨║╨░╨╖╨╛╨▓ ╨┐╨╛╨║╨░ ╨╜╨╡╤В</div>';
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
              return '<div>' + escapeHtml(i.product_name || '╨в╨╛╨▓╨░╤А') + sizeTag + ' x' + i.quantity + ' тАФ ' + formatPrice(i.price * i.quantity) + '</div>';
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
          '<div class="orders-split-title">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ <span class="orders-split-count">' + deliveryHist.length + '</span></div>' +
          '<div class="order-history">' + deliveryHist.map(renderHistCard).join('') + '</div>' +
        '</div>';
      }
      if (pickupHist.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ <span class="orders-split-count">' + pickupHist.length + '</span></div>' +
          '<div class="order-history">' + pickupHist.map(renderHistCard).join('') + '</div>' +
        '</div>';
      }
      if (!html) html = '<div class="empty-state">╨Ч╨░╨║╨░╨╖╨╛╨▓ ╨┐╨╛╨║╨░ ╨╜╨╡╤В</div>';
      el.innerHTML = html;
    });
  };

  window.showProfileEdit = function () {
    var phone = (dbUser && dbUser.phone) || '';
    var addr = (dbUser && dbUser.default_address) || '';

    renderWithWebTop(
      '<span class="back-link" onclick="navigateTo(\'account\')">╨Ъ ╨║╨░╨▒╨╕╨╜╨╡╤В╤Г</span>' +
      '<div class="section-title">╨Ь╨╛╨╕ ╨┤╨░╨╜╨╜╤Л╨╡</div>' +
      '<form class="order-form" onsubmit="saveProfile(event)">' +
        '<div class="form-group"><label>╨в╨╡╨╗╨╡╤Д╨╛╨╜</label>' +
        '<input type="tel" id="profile-phone" value="' + escapeHtml(phone) + '" placeholder="+7 (___) ___-__-__" oninput="formatPhoneInput(this)" maxlength="18"></div>' +
        '<div class="form-group"><label>╨Р╨┤╤А╨╡╤Б ╨┐╨╛ ╤Г╨╝╨╛╨╗╤З╨░╨╜╨╕╤О</label>' +
        '<input type="text" id="profile-address" value="' + escapeHtml(addr) + '" placeholder="╨У╨╛╤А╨╛╨┤, ╤Г╨╗╨╕╤Ж╨░, ╨┤╨╛╨╝, ╨║╨▓╨░╤А╤В╨╕╤А╨░"></div>' +
        '<button type="submit" class="nav-btn">╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М</button>' +
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
        showToast('╨Ф╨░╨╜╨╜╤Л╨╡ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╤Л');
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
      renderWithWebTop(
        '<span class="back-link" onclick="navigateTo(\'account\')">╨Ъ ╨┐╤А╨╛╤Д╨╕╨╗╤О</span>' +
        '<div class="section-title">╨Ч╨░╨║╨░╨╖╤Л</div>' +
        '<div class="empty-state">╨Ю╤В╨║╤А╨╛╨╣╤В╨╡ ╨┐╤А╨╕╨╗╨╛╨╢╨╡╨╜╨╕╨╡ ╤З╨╡╤А╨╡╨╖ Telegram ╨┤╨╗╤П ╨╛╤В╤Б╨╗╨╡╨╢╨╕╨▓╨░╨╜╨╕╤П ╨╖╨░╨║╨░╨╖╨╛╨▓.</div>'
      );
      return;
    }

    renderWithWebTop(
      '<span class="back-link" onclick="navigateTo(\'account\')">╨Ъ ╨┐╤А╨╛╤Д╨╕╨╗╤О</span>' +
      '<div class="section-title">╨Ч╨░╨║╨░╨╖╤Л</div>' +
      '<div id="delivery-list"><div class="empty-state">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div></div>'
    );

    fetchJSON('/api/user/orders?telegram_id=' + telegramId).then(function (orders) {
      var el = document.getElementById('delivery-list');
      if (!el) return;
      if (!orders || !orders.length) {
        el.innerHTML = '<div class="empty-state">╨г ╨▓╨░╤Б ╨┐╨╛╨║╨░ ╨╜╨╡╤В ╨╖╨░╨║╨░╨╖╨╛╨▓</div>';
        return;
      }

      var deliveryOrders = orders.filter(function (o) { return o.delivery_type !== 'pickup'; });
      var pickupOrders = orders.filter(function (o) { return o.delivery_type === 'pickup'; });

      function renderFullCard(o) {
        var steps = getTrackSteps(o);
        var currentIdx = steps.indexOf(o.status);
        if (o.status === '╨Т╤Л╨┐╨╛╨╗╨╜╨╡╨╜') currentIdx = steps.length - 1;
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
              return '<div>' + escapeHtml(i.product_name || '╨в╨╛╨▓╨░╤А') + sizeTag + ' x' + i.quantity + ' тАФ ' + formatPrice(i.price * i.quantity) + '</div>';
            }).join('') + '</div>';
        }

        var isPickup = o.delivery_type === 'pickup';
        var timeInfo = '';
        if (isPickup && o.delivery_date) {
          timeInfo = '<div class="track-time-info">╨У╨╛╤В╨╛╨▓╨╜╨╛╤Б╤В╤М: ' + escapeHtml(o.delivery_date) +
            (o.delivery_interval ? ', ' + escapeHtml(o.delivery_interval) : '') + '</div>';
        } else if (!isPickup) {
          var parts = [];
          if (o.delivery_date) parts.push(escapeHtml(o.delivery_date));
          if (o.exact_time) parts.push('╨║ ' + escapeHtml(o.exact_time));
          else if (o.delivery_interval) parts.push(escapeHtml(o.delivery_interval));
          if (parts.length) timeInfo = '<div class="track-time-info">' + parts.join(', ') + '</div>';
        }

        return '<div class="track-card">' +
          '<div class="track-header">' +
            '<span class="track-id">╨Ч╨░╨║╨░╨╖ #' + o.id + '</span>' +
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
          '<div class="orders-split-title">╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ <span class="orders-split-count">' + deliveryOrders.length + '</span></div>' +
          deliveryOrders.map(renderFullCard).join('') +
        '</div>';
      }
      if (pickupOrders.length) {
        html += '<div class="orders-split-section">' +
          '<div class="orders-split-title">╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ <span class="orders-split-count">' + pickupOrders.length + '</span></div>' +
          pickupOrders.map(renderFullCard).join('') +
        '</div>';
      }
      if (!html) html = '<div class="empty-state">╨г ╨▓╨░╤Б ╨┐╨╛╨║╨░ ╨╜╨╡╤В ╨╖╨░╨║╨░╨╖╨╛╨▓</div>';
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
      renderWithWebTop(
        '<div class="web-flow-shell web-flow-shell--favorites">' +
          '<div class="web-centered-page-card">' +
          '<div class="category-title">╨Ш╨╖╨▒╤А╨░╨╜╨╜╨╛╨╡</div>' +
          '<div class="empty-state">╨Т╤Л ╨┐╨╛╨║╨░ ╨╜╨╕╤З╨╡╨│╨╛ ╨╜╨╡ ╨┤╨╛╨▒╨░╨▓╨╕╨╗╨╕ ╨▓ ╨╕╨╖╨▒╤А╨░╨╜╨╜╨╛╨╡</div>' +
          '</div>' +
        '</div>'
      );
      return;
    }

    renderWithWebTop(
      '<div class="web-flow-shell web-flow-shell--favorites">' +
        '<div class="web-centered-page-card">' +
        '<div class="category-title">╨Ш╨╖╨▒╤А╨░╨╜╨╜╨╛╨╡</div>' +
        '<div class="product-list" id="fav-product-list"><div class="empty-state">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div></div>' +
        '</div>' +
      '</div>'
    );

    fetchJSON('/api/products').then(function (prods) {
      var el = document.getElementById('fav-product-list');
      if (!el) return;
      var favProds = (prods || []).filter(function (p) { return favIds.indexOf(p.id) >= 0; });
      if (!favProds.length) {
        el.innerHTML = '<div class="empty-state">╨в╨╛╨▓╨░╤А╤Л ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л</div>';
        return;
      }
      el.innerHTML = favProds.map(function (p, idx) { return buildProductCard(p, idx); }).join('');
      initCardScrollReveal(el);
    });
  }

  // ============================================================
  // Static pages
  // ============================================================

  function showPageOrder() {
    renderWithWebTop(
      '<span class="back-link" onclick="navigateTo(\'home\')">╨Э╨░ ╨│╨╗╨░╨▓╨╜╤Г╤О</span>' +
      '<div class="static-page">' +
        '<h2>╨Ю ╨╖╨░╨║╨░╨╖╨╡</h2>' +
        '<p>╨Ь╤Л ╨╛╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╗╤П╨╡╨╝ ╨┤╨╛╤Б╤В╨░╨▓╨║╤Г ╨┐╨╛ ╨│. ╨б╨░╤А╨░╤В╨╛╨▓╤Г, ╨н╨╜╨│╨╡╨╗╤М╤Б╤Г ╨╕ ╨╡╨│╨╛ ╨╛╨║╤А╨╡╤Б╤В╨╜╨╛╤Б╤В╤П╨╝.</p>' +
        '<p>╨Ч╨░╨║╨░╨╖╤Л ╨┐╤А╨╕╨╜╨╕╨╝╨░╤О╤В╤Б╤П c 10:00 ╨┤╨╛ 21:00, ╨╜╨╛ ╨┤╨╛╤Б╤В╨░╨▓╨║╤Г ╨╝╤Л ╨╝╨╛╨╢╨╡╨╝ ╨╛╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╗╤П╤В╤М ╨║╤А╤Г╨│╨╗╨╛╤Б╤Г╤В╨╛╤З╨╜╨╛ ╨┐╤А╨╕ ╨╛╤Д╨╛╤А╨╝╨╗╨╡╨╜╨╕╨╕ ╨╖╨░╨║╨░╨╖╨░ ╨▓ ╤А╨░╨▒╨╛╤З╨╡╨╡ ╨▓╤А╨╡╨╝╤П. ╨Ю╤Д╨╛╤А╨╝╨╕╤В╤М ╨╖╨░╨║╨░╨╖ ╨╝╨╛╨╢╨╜╨╛ ╨╖╨░╤А╨░╨╜╨╡╨╡ (╨╜╨░ ╨║╨╛╨╜╨║╤А╨╡╤В╨╜╤Г╤О ╨┤╨░╤В╤Г).</p>' +
        '<h3>╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ ╨┐╨╛ ╤А╨░╨╣╨╛╨╜╨░╨╝</h3>' +
        '<ul>' +
          '<li>╨│. ╨б╨░╤А╨░╤В╨╛╨▓ (╨Ы╨╡╨╜╨╕╨╜╤Б╨║╨╕╨╣, ╨Ъ╨╕╤А╨╛╨▓╤Б╨║╨╕╨╣, ╨д╤А╤Г╨╜╨╖╨╡╨╜╤Б╨║╨╕╨╣, ╨Ч╨░╨▓╨╛╨┤╤Б╨║╨╛╨╣, ╨Т╨╛╨╗╨╢╤Б╨║╨╕╨╣, ╨Ю╨║╤В╤П╨▒╤А╤М╤Б╨║╨╕╨╣ ╤А-╨╜╤Л) тАФ 350 ╤А.</li>' +
          '<li>╨│. ╨н╨╜╨│╨╡╨╗╤М╤Б тАФ 450 ╤А.</li>' +
          '<li>╨Ю╨║╤А╨╡╤Б╤В╨╜╨╛╤Б╤В╨╕ ╨│. ╨б╨░╤А╨░╤В╨╛╨▓╨░ ╨╕ ╨н╨╜╨│╨╡╨╗╤М╤Б╨░ (╨▓ ╤В.╤З. ╨У╨░╨│╨░╤А╨╕╨╜╤Б╨║╨╕╨╣ ╤А-╨╜ ╨│. ╨б╨░╤А╨░╤В╨╛╨▓╨░) тАФ 1000 ╤А.</li>' +
        '</ul>' +
        '<p>╨Я╨╡╤А╨╡╨┤ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╛╨╣ ╨╖╨░╨║╨░╨╖╨░ ╨▓ ╤А╨░╨▒╨╛╤З╨╡╨╡ ╨▓╤А╨╡╨╝╤П ╨╜╨░╤И╨╕ ╨╝╨╡╨╜╨╡╨┤╨╢╨╡╤А╤Л ╨║╨╛╨╜╤В╨░╨║╤В-╤Ж╨╡╨╜╤В╤А╨░ ╤Б╨╛╨╖╨▓╨░╨╜╨╕╨▓╨░╤О╤В╤Б╤П ╤Б ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╨╡╨╝ ╨╖╨░╨║╨░╨╖╨░ ╨╕ ╤Г╤В╨╛╤З╨╜╤П╤О╤В ╨░╨┤╤А╨╡╤Б ╨╕ ╨┐╨╛╨┤╤Е╨╛╨┤╤П╤Й╨╡╨╡ ╨▓╤А╨╡╨╝╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕.</p>' +
        '<h3>╨б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖</h3>' +
        '<p>╨Т ╨╜╨░╤И╨╡╨╝ ╨╝╨░╨│╨░╨╖╨╕╨╜╨╡ ┬лArka Flowers┬╗ ╨┐╨╛ ╨░╨┤╤А╨╡╤Б╤Г ╨│. ╨б╨░╤А╨░╤В╨╛╨▓, 3-╨╣ ╨Ф╨╡╨│╤В╤П╤А╨╜╤Л╨╣ ╨┐╤А╨╛╨╡╨╖╨┤, 21╨║3.</p>' +
        '<h3>╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨▓ ╨┐╤А╨░╨╖╨┤╨╜╨╕╤З╨╜╤Л╨╡ ╨┤╨╜╨╕</h3>' +
        '<p>╨Ш╨╜╤В╨╡╤А╨▓╨░╨╗ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ 3 ╤З╨░╤Б╨░. ╨Я╤А╨╕ ╤Г╨║╨░╨╖╨░╨╜╨╕╨╕ ╤В╨╛╤З╨╜╨╛╨│╨╛ ╨▓╤А╨╡╨╝╨╡╨╜╨╕ ╨╖╨░╨║╨░╨╖ ╨▒╤Г╨┤╨╡╤В ╨┤╨╛╤Б╤В╨░╨▓╨╗╨╡╨╜ ╨▓ ╨╕╨╜╤В╨╡╤А╨▓╨░╨╗╨╡ ┬▒1,5 ╤З╨░╤Б╨░. ╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ ╤В╨╛╤З╨╜╨╛ ╨║╨╛ ╨▓╤А╨╡╨╝╨╡╨╜╨╕ 1000 ╤А╤Г╨▒. (╤Г╨║╨░╨╢╨╕╤В╨╡ ╨▓ ╨╖╨░╨║╨░╨╖╨╡).</p>' +
        '<p>╨Х╤Б╨╗╨╕ ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤П ╨╜╨╡ ╨╛╨║╨░╨╢╨╡╤В╤Б╤П ╨┐╨╛ ╤Г╨║╨░╨╖╨░╨╜╨╜╨╛╨╝╤Г ╨░╨┤╤А╨╡╤Б╤Г, ╨║╤Г╤А╤М╨╡╤А ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В ╨▒╤Г╨║╨╡╤В ╨▓ ╤Б╨░╨╗╨╛╨╜. ╨Я╨╛╨▓╤В╨╛╤А╨╜╨░╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨░ ╨╛╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╗╤П╨╡╤В╤Б╤П ╨▓ ╤Б╨╗╤Г╤З╨░╨╡ ╨┤╨╛╨┐╨╗╨░╤В╤Л ╨╖╨░ ╨▓╤Л╨╡╨╖╨┤ ╨║╤Г╤А╤М╨╡╤А╨░. ╨Я╨╛ ╨╕╤Б╤В╨╡╤З╨╡╨╜╨╕╨╕ 24 ╤З╨░╤Б╨╛╨▓ ╤Б ╨╝╨╛╨╝╨╡╨╜╤В╨░ ╨╜╨╡╤Б╨╛╤Б╤В╨╛╤П╨▓╤И╨╡╨╣╤Б╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ ╨╖╨░╨║╨░╨╖ ╨╛╨┐╨╗╨░╤З╨╕╨▓╨░╨╡╤В╤Б╤П ╨┐╨╛╨▓╤В╨╛╤А╨╜╨╛, ╨┐╨╛╤Б╨║╨╛╨╗╤М╨║╤Г ╤Ж╨▓╨╡╤В╤Л ╤П╨▓╨╗╤П╤О╤В╤Б╤П ╤Б╨║╨╛╤А╨╛╨┐╨╛╤А╤В╤П╤Й╨╕╨╝╤Б╤П ╤В╨╛╨▓╨░╤А╨╛╨╝. ╨Х╤Б╨╗╨╕ ╨▓╤Л ╨╛╤В╨║╨░╨╖╤Л╨▓╨░╨╡╤В╨╡╤Б╤М ╨╛╤В ╨┐╨╛╨▓╤В╨╛╤А╨╜╨╛╨╣ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕, ╤Б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╨╖╨░╨║╨░╨╖╨░ ╨╜╨╡ ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В╤Б╤П.</p>' +
        '<p>╨Я╨╛╨╗╤М╨╖╤Г╤П╤Б╤М ╤Б╨░╨╣╤В╨╛╨╝, ╨▓╤Л ╤Б╨╛╨│╨╗╨░╤И╨░╨╡╤В╨╡╤Б╤М ╤Б ╤В╨╡╨╝, ╤З╤В╨╛ ╨┐╤А╨╕ ╨╖╨░╨║╨░╨╖╨╡ ╤Ж╨▓╨╡╤В╨╛╨║ ╨▓ ╨▒╤Г╨║╨╡╤В╨╡ ╨╝╨╛╨╢╨╡╤В ╨▒╤Л╤В╤М ╨╖╨░╨╝╨╡╨╜╤С╨╜ ╨╜╨░ ╨┐╨╛╨┤╨╛╨▒╨╜╤Л╨╣ ╨┐╨╛ ╤В╨░╨║╨╕╨╝ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨░╨╝, ╨║╨░╨║ ╤Ж╨▓╨╡╤В╨╛╨▓╨░╤П ╨│╨░╨╝╨╝╨░ ╨╕╨╗╨╕ ╤А╨╕╤Б╤Г╨╜╨╛╨║ ╤Ж╨▓╨╡╤В╨║╨░. ╨Р ╤В╨░╨║╨╢╨╡ ╨╝╤Л ╨╛╨▒╤П╨╖╤Г╨╡╨╝╤Б╤П ╨▓╨╛╤Б╨┐╨╛╨╗╨╜╨╕╤В╤М ╨╜╨╡╨┤╨╛╤Б╤В╨░╤О╤Й╨╕╨╣ ╤Ж╨▓╨╡╤В╨╛╨║ ╨┤╤А╤Г╨│╨╕╨╝ ╨┐╨╛ ╤Б╤В╨╛╨╕╨╝╨╛╤Б╤В╨╕ ╨▓╤Л╨▒╤А╨░╨╜╨╜╨╛╨│╨╛ ╨▒╤Г╨║╨╡╤В╨░.</p>' +
        '<p>╨Т ╤Б╨╗╤Г╤З╨░╨╡ ╨╡╤Б╨╗╨╕ ╨▓╤Л ╨╜╨╡ ╨╖╨╜╨░╨╡╤В╨╡ ╨░╨┤╤А╨╡╤Б ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤П, ╨░ ╨╖╨╜╨░╨╡╤В╨╡ ╤В╨╛╨╗╤М╨║╨╛ ╤В╨╡╨╗╨╡╤Д╨╛╨╜ тАФ ╨┐╨╡╤А╨╡╨┤ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╛╨╣ ╨╖╨░╨║╨░╨╖╨░ ╨╜╨░╤И╨╕ ╨╝╨╡╨╜╨╡╨┤╨╢╨╡╤А╤Л ╨║╨╛╨╜╤В╨░╨║╤В-╤Ж╨╡╨╜╤В╤А╨░ ╤Б╨╛╨╖╨▓╨░╨╜╨╕╨▓╨░╤О╤В╤Б╤П ╤Б ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╨╡╨╝ ╨╕ ╤Г╤В╨╛╤З╨╜╤П╤О╤В ╨░╨┤╤А╨╡╤Б ╨╕ ╨┐╨╛╨┤╤Е╨╛╨┤╤П╤Й╨╡╨╡ ╨▓╤А╨╡╨╝╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕.</p>' +
      '</div>'
    );
  }

  function showPagePayment() {
    renderWithWebTop(
      '<span class="back-link" onclick="navigateTo(\'home\')">╨Э╨░ ╨│╨╗╨░╨▓╨╜╤Г╤О</span>' +
      '<div class="static-page">' +
        '<h2>╨Ю╨▒ ╨╛╨┐╨╗╨░╤В╨╡</h2>' +
        '<h3>╨Ю╨╜╨╗╨░╨╣╨╜</h3>' +
        '<ul>' +
          '<li>╨С╨░╨╜╨║╨╛╨▓╤Б╨║╨╕╨╡ ╨║╨░╤А╤В╤Л: Visa, MasterCard, Maestro, ╨Ь╨╕╤А</li>' +
          '<li>╨н╨╗╨╡╨║╤В╤А╨╛╨╜╨╜╤Л╨╡ ╨┤╨╡╨╜╤М╨│╨╕: ╨п╨╜╨┤╨╡╨║╤Б.╨Ф╨╡╨╜╤М╨│╨╕, WebMoney, QIWI ╨Ъ╨╛╤И╨╡╨╗╤С╨║</li>' +
          '<li>╨Ш╨╜╤В╨╡╤А╨╜╨╡╤В-╨▒╨░╨╜╨║╨╕╨╜╨│: ╨б╨▒╨╡╤А╨▒╨░╨╜╨║ ╨Ю╨╜╨╗╨░╨╣╨╜, ╨Р╨╗╤М╤Д╨░-╨Ъ╨╗╨╕╨║, ╨Ш╨╜╤В╨╡╤А╨╜╨╡╤В-╨▒╨░╨╜╨║ ╨Я╤А╨╛╨╝╤Б╨▓╤П╨╖╤М╨▒╨░╨╜╨║╨░, MasterPass</li>' +
          '<li>QR-╨║╨╛╨┤</li>' +
        '</ul>' +
        '<h3>╨Ф╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╨╛</h3>' +
        '<p>╨С╨╡╨╖╨╜╨░╨╗╨╕╤З╨╜╤Л╨╝ ╤А╨░╤Б╤З╤С╤В╨╛╨╝ (╨▓╤Л╤Б╤В╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╤Б╤З╤С╤В╨░ ╨┐╨╛ ╨▓╨░╤И╨╕╨╝ ╤А╨╡╨║╨▓╨╕╨╖╨╕╤В╨░╨╝).</p>' +
        '<p>╨Т╨╛╨╖╨▓╤А╨░╤В ╨┤╨╡╨╜╨╡╨╢╨╜╤Л╤Е ╤Б╤А╨╡╨┤╤Б╤В╨▓ ╨▓ ╤Б╨╗╤Г╤З╨░╨╡ ╨▒╨╡╨╖╨╜╨░╨╗╨╕╤З╨╜╨╛╨╣ ╨╛╨┐╨╗╨░╤В╤Л ╨┐╤А╨╛╨╕╨╖╨▓╨╛╨┤╨╕╤В╤Б╤П ╨▓ ╤В╨╡╤З╨╡╨╜╨╕╨╡ 3тАУ4 ╤А╨░╨▒╨╛╤З╨╕╤Е ╨┤╨╜╨╡╨╣.</p>' +
      '</div>'
    );
  }

  function showReturns() {
    renderWithWebTop(
      '<span class="back-link" onclick="navigateTo(\'home\')">╨Э╨░ ╨│╨╗╨░╨▓╨╜╤Г╤О</span>' +
      '<div class="static-page">' +
        '<h2>╨г╤Б╨╗╨╛╨▓╨╕╤П ╨▓╨╛╨╖╨▓╤А╨░╤В╨░</h2>' +
        '<h3>1. ╨Ю╤В╨║╨░╨╖ ╨╛╤В ╨╖╨░╨║╨░╨╖╨░ ╨╕ ╨▓╨╛╨╖╨▓╤А╨░╤В ╤В╨╛╨▓╨░╤А╨░</h3>' +
        '<p>1.1. ╨Ъ╨╗╨╕╨╡╨╜╤В ╨▓╨┐╤А╨░╨▓╨╡ ╨╛╤В╨║╨░╨╖╨░╤В╤М╤Б╤П ╨╛╤В ╨╖╨░╨║╨░╨╖╨░ ╨┤╨╛ ╨╝╨╛╨╝╨╡╨╜╤В╨░ ╨┐╨╡╤А╨╡╨┤╨░╤З╨╕ ╤В╨╛╨▓╨░╤А╨░ ╨║╤Г╤А╤М╨╡╤А╤Г. ╨Я╨╛╤Б╨╗╨╡ ╨┐╨╡╤А╨╡╨┤╨░╤З╨╕ ╤В╨╛╨▓╨░╤А╨░ ╨║╤Г╤А╤М╨╡╤А╤Г ╨╖╨░╨║╨░╨╖ ╤Б╤З╨╕╤В╨░╨╡╤В╤Б╤П ╨┐╤А╨╕╨╜╤П╤В╤Л╨╝ ╨║ ╨╕╤Б╨┐╨╛╨╗╨╜╨╡╨╜╨╕╤О, ╨╕ ╨╛╤В╨╝╨╡╨╜╨░ ╨╜╨╡╨▓╨╛╨╖╨╝╨╛╨╢╨╜╨░.</p>' +
        '<p>1.2. ╨ж╨▓╨╡╤В╨╛╤З╨╜╨░╤П ╨┐╤А╨╛╨┤╤Г╨║╤Ж╨╕╤П ╨╛╤В╨╜╨╛╤Б╨╕╤В╤Б╤П ╨║ ╨║╨░╤В╨╡╨│╨╛╤А╨╕╨╕ ╤Б╨║╨╛╤А╨╛╨┐╨╛╤А╤В╤П╤Й╨╕╤Е╤Б╤П ╤В╨╛╨▓╨░╤А╨╛╨▓ (╨┐. 27 ╨Я╨╡╤А╨╡╤З╨╜╤П, ╤Г╤В╨▓. ╨Я╨╛╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜╨╕╨╡╨╝ ╨Я╤А╨░╨▓╨╕╤В╨╡╨╗╤М╤Б╤В╨▓╨░ ╨а╨д тДЦ 2463), ╨▓ ╤Б╨▓╤П╨╖╨╕ ╤Б ╤З╨╡╨╝ ╨▓╨╛╨╖╨▓╤А╨░╤В ╤В╨╛╨▓╨░╤А╨░ ╨╜╨░╨┤╨╗╨╡╨╢╨░╤Й╨╡╨│╨╛ ╨║╨░╤З╨╡╤Б╤В╨▓╨░ ╨┐╨╛╤Б╨╗╨╡ ╨╡╨│╨╛ ╨┐╨╡╤А╨╡╨┤╨░╤З╨╕ ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤О ╨╜╨╡╨▓╨╛╨╖╨╝╨╛╨╢╨╡╨╜.</p>' +
        '<h3>2. ╨Ю╤В╤Б╤Г╤В╤Б╤В╨▓╨╕╨╡ ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤П ╨┐╨╛ ╨░╨┤╤А╨╡╤Б╤Г</h3>' +
        '<p>2.1. ╨Т ╤Б╨╗╤Г╤З╨░╨╡ ╨╛╤В╤Б╤Г╤В╤Б╤В╨▓╨╕╤П ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤П ╨┐╨╛ ╤Г╨║╨░╨╖╨░╨╜╨╜╨╛╨╝╤Г ╨░╨┤╤А╨╡╤Б╤Г ╨║╤Г╤А╤М╨╡╤А ╤Д╨╕╨║╤Б╨╕╤А╤Г╨╡╤В ╨╜╨╡╨▓╨╛╨╖╨╝╨╛╨╢╨╜╨╛╤Б╤В╤М ╨▓╤А╤Г╤З╨╡╨╜╨╕╤П.</p>' +
        '<p>2.2. ╨Ъ╨╗╨╕╨╡╨╜╤В/╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤М ╨╝╨╛╨╢╨╡╤В ╨╖╨░╨┐╤А╨╛╤Б╨╕╤В╤М ╨┐╨╛╨▓╤В╨╛╤А╨╜╤Г╤О ╨┤╨╛╤Б╤В╨░╨▓╨║╤Г. ╨Я╨╛╨▓╤В╨╛╤А╨╜╨░╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨░ ╨╛╨┐╨╗╨░╤З╨╕╨▓╨░╨╡╤В╤Б╤П ╨┤╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╨╛ ╤Б╨╛╨│╨╗╨░╤Б╨╜╨╛ ╨┤╨╡╨╣╤Б╤В╨▓╤Г╤О╤Й╨╕╨╝ ╤В╨░╤А╨╕╤Д╨░╨╝.</p>' +
        '<p>2.3. ╨Х╤Б╨╗╨╕ ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤М ╨╝╨╛╨╢╨╡╤В ╨┐╤А╨╕╨╜╤П╤В╤М ╨╖╨░╨║╨░╨╖ ╤В╨╛╨╗╤М╨║╨╛ ╨▓ ╨┤╤А╤Г╨│╨╛╨╣ ╨┤╨╡╨╜╤М, ╨║╨╛╨╝╨┐╨░╨╜╨╕╤П ╨▓╨┐╤А╨░╨▓╨╡ ╨┐╤А╨╡╨┤╨╗╨╛╨╢╨╕╤В╤М ╨╕╨╖╨│╨╛╤В╨╛╨▓╨╗╨╡╨╜╨╕╨╡ ╨╜╨╛╨▓╨╛╨│╨╛ ╤Б╨▓╨╡╨╢╨╡╨│╨╛ ╨▒╤Г╨║╨╡╤В╨░ ╨║ ╤Б╨╛╨│╨╗╨░╤Б╨╛╨▓╨░╨╜╨╜╨╛╨╣ ╨┤╨░╤В╨╡. ╨Т╨╛╨╖╨▓╤А╨░╤В ╨┤╨╡╨╜╨╡╨╢╨╜╤Л╤Е ╤Б╤А╨╡╨┤╤Б╤В╨▓ ╨╖╨░ ╨┐╨╡╤А╨▓╨╛╨╜╨░╤З╨░╨╗╤М╨╜╨╛ ╨╕╨╖╨│╨╛╤В╨╛╨▓╨╗╨╡╨╜╨╜╤Л╨╣ ╨▒╤Г╨║╨╡╤В ╨╜╨╡ ╨┐╤А╨╛╨╕╨╖╨▓╨╛╨┤╨╕╤В╤Б╤П.</p>' +
        '<h3>3. ╨Ш╨╖╨╝╨╡╨╜╨╡╨╜╨╕╤П ╨▓ ╨╖╨░╨║╨░╨╖╨╡</h3>' +
        '<p>3.1. ╨Я╨╛╤Б╨╗╨╡ ╨╜╨░╤З╨░╨╗╨░ ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜╨╕╤П ╨╖╨░╨║╨░╨╖╨░ (╤Б╨▒╨╛╤А╨║╨╕ ╨▒╤Г╨║╨╡╤В╨░) ╨╛╤В╨╝╨╡╨╜╨░ ╨╕ ╨▓╨╛╨╖╨▓╤А╨░╤В ╤Б╤А╨╡╨┤╤Б╤В╨▓ ╨╜╨╡╨▓╨╛╨╖╨╝╨╛╨╢╨╜╤Л.</p>' +
        '<p>3.2. ╨Ш╨╖╨╝╨╡╨╜╨╡╨╜╨╕╨╡ ╨┤╨░╤В╤Л/╨▓╤А╨╡╨╝╨╡╨╜╨╕ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ ╨┐╨╛╤Б╨╗╨╡ ╨╜╨░╤З╨░╨╗╨░ ╤Б╨▒╨╛╤А╨║╨╕ ╤В╨░╨║╨╢╨╡ ╨╜╨╡ ╤П╨▓╨╗╤П╨╡╤В╤Б╤П ╨╛╤Б╨╜╨╛╨▓╨░╨╜╨╕╨╡╨╝ ╨┤╨╗╤П ╨▓╨╛╨╖╨▓╤А╨░╤В╨░ ╤Б╤А╨╡╨┤╤Б╤В╨▓.</p>' +
        '<h3>4. ╨Я╤А╨╕╤С╨╝ ╤В╨╛╨▓╨░╤А╨░ ╨╕ ╤А╨╡╨║╨╗╨░╨╝╨░╤Ж╨╕╨╕ ╨┐╨╛ ╨║╨░╤З╨╡╤Б╤В╨▓╤Г</h3>' +
        '<p>4.1. ╨Ъ╨╗╨╕╨╡╨╜╤В ╨╛╨▒╤П╨╖╨░╨╜ ╨╛╤Б╨╝╨╛╤В╤А╨╡╤В╤М ╤В╨╛╨▓╨░╤А ╨▓ ╨╝╨╛╨╝╨╡╨╜╤В ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П. ╨а╨╡╨║╨╗╨░╨╝╨░╤Ж╨╕╨╕ ╨┐╨╛ ╨║╨░╤З╨╡╤Б╤В╨▓╤Г ╨┐╤А╨╕╨╜╨╕╨╝╨░╤О╤В╤Б╤П ╨▓ ╤В╨╡╤З╨╡╨╜╨╕╨╡ 30 ╨╝╨╕╨╜╤Г╤В ╤Б ╨╝╨╛╨╝╨╡╨╜╤В╨░ ╨▓╤А╤Г╤З╨╡╨╜╨╕╤П.</p>' +
        '<p>4.2. ╨Ф╨╗╤П ╨┐╨╛╨┤╨░╤З╨╕ ╤А╨╡╨║╨╗╨░╨╝╨░╤Ж╨╕╨╕ ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╨╛ ╨┐╤А╨╡╨┤╨╛╤Б╤В╨░╨▓╨╕╤В╤М: ╨┐╨╛╨┤╤А╨╛╨▒╨╜╨╛╨╡ ╨╛╨┐╨╕╤Б╨░╨╜╨╕╨╡ ╨┐╤А╨╛╨▒╨╗╨╡╨╝╤Л, ╤Д╨╛╤В╨╛╨│╤А╨░╤Д╨╕╨╕ ╨▒╤Г╨║╨╡╤В╨░ ╤Б ╤А╨░╨╖╨╜╤Л╤Е ╤А╨░╨║╤Г╤А╤Б╨╛╨▓, ╤Д╨╛╤В╨╛ ╤Г╨┐╨░╨║╨╛╨▓╨║╨╕.</p>' +
        '<p>4.3. Arka Flowers ╤А╨░╤Б╤Б╨╝╨░╤В╤А╨╕╨▓╨░╨╡╤В ╤А╨╡╨║╨╗╨░╨╝╨░╤Ж╨╕╤О ╨▓ ╤В╨╡╤З╨╡╨╜╨╕╨╡ 6 ╤З╨░╤Б╨╛╨▓ ╨╕ ╨┐╤А╨╡╨┤╨╛╤Б╤В╨░╨▓╨╗╤П╨╡╤В ╨╛╤В╨▓╨╡╤В.</p>' +
        '<p>4.4. ╨Х╤Б╨╗╨╕ ╨▒╤Г╨┤╨╡╤В ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╤С╨╜ ╤Д╨░╨║╤В ╨┐╨╡╤А╨╡╨┤╨░╤З╨╕ ╤В╨╛╨▓╨░╤А╨░ ╨╜╨╡╨╜╨░╨┤╨╗╨╡╨╢╨░╤Й╨╡╨│╨╛ ╨║╨░╤З╨╡╤Б╤В╨▓╨░, ╨║╨╛╨╝╨┐╨░╨╜╨╕╤П ╨┐╤А╨╡╨┤╨╛╤Б╤В╨░╨▓╨╗╤П╨╡╤В: ╨╖╨░╨╝╨╡╨╜╤Г ╨▒╤Г╨║╨╡╤В╨░ ╨╕╨╗╨╕ ╨▓╨╛╨╖╨▓╤А╨░╤В ╨┤╨╡╨╜╨╡╨╢╨╜╤Л╤Е ╤Б╤А╨╡╨┤╤Б╤В╨▓ ╨▓ ╨┐╤А╨╡╨┤╨╡╨╗╨░╤Е ╤Б╤В╨╛╨╕╨╝╨╛╤Б╤В╨╕ ╨╖╨░╨║╨░╨╖╨░.</p>' +
        '<p>4.5. ╨Х╤Б╨╗╨╕ ╨║╨╗╨╕╨╡╨╜╤В ╨╛╤Б╤В╨░╨▓╨╕╨╗ ╨▒╤Г╨║╨╡╤В ╤Г ╤Б╨╡╨▒╤П, ╨┐╨╛╨╝╨╡╤Б╤В╨╕╨╗ ╨▓ ╨▓╨░╨╖╤Г, ╨╕╨╖╨╝╨╡╨╜╨╕╨╗ ╤Г╤Б╨╗╨╛╨▓╨╕╤П ╤Е╤А╨░╨╜╨╡╨╜╨╕╤П ╨╕╨╗╨╕ ╤Б╨╛╤Б╤В╨╛╤П╨╜╨╕╨╡ ╤В╨╛╨▓╨░╤А╨░, ╤З╤В╨╛ ╨╝╨╛╨│╨╗╨╛ ╨┐╤А╨╕╨▓╨╡╤Б╤В╨╕ ╨║ ╨╡╨│╨╛ ╤Г╨▓╤П╨┤╨░╨╜╨╕╤О, ╤В╨░╨║╨╕╨╡ ╨┐╤А╨╡╤В╨╡╨╜╨╖╨╕╨╕ ╨╜╨╡ ╤А╨░╤Б╤Б╨╝╨░╤В╤А╨╕╨▓╨░╤О╤В╤Б╤П, ╨╖╨░ ╨╕╤Б╨║╨╗╤О╤З╨╡╨╜╨╕╨╡╨╝ ╤Б╨╗╤Г╤З╨░╨╡╨▓ ╤П╨▓╨╜╨╛╨╣ ╨┐╨╛╤А╤З╨╕ ╤Ж╨▓╨╡╤В╨║╨░.</p>' +
        '<h3>5. ╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╤Б╤В╨╛╤А╨╛╨╜╨╜╨╡╨╣ ╨║╤Г╤А╤М╨╡╤А╤Б╨║╨╛╨╣ ╤Б╨╗╤Г╨╢╨▒╨╛╨╣</h3>' +
        '<p>5.1. ╨Ю╤В╨▓╨╡╤В╤Б╤В╨▓╨╡╨╜╨╜╨╛╤Б╤В╤М ╨╖╨░ ╤Д╨░╨║╤В ╨║╨░╤З╨╡╤Б╤В╨▓╨╡╨╜╨╜╨╛╨│╨╛ ╨╕╨╖╨│╨╛╤В╨╛╨▓╨╗╨╡╨╜╨╕╤П ╨▒╤Г╨║╨╡╤В╨░ ╨╜╨╡╤Б╤С╤В Arka Flowers.</p>' +
        '<p>5.2. ╨Т╤А╨╡╨╝╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ ╨╝╨╛╨╢╨╡╤В ╨╛╤В╨╗╨╕╤З╨░╤В╤М╤Б╤П ╨╛╤В ╨┐╤А╨╡╨┤╨▓╨░╤А╨╕╤В╨╡╨╗╤М╨╜╨╛╨│╨╛ ╨┐╨╛ ╨┐╤А╨╕╤З╨╕╨╜╨░╨╝ ╨╗╨╛╨│╨╕╤Б╤В╨╕╨║╨╕. ╨н╤В╨╛ ╨╜╨╡ ╤П╨▓╨╗╤П╨╡╤В╤Б╤П ╨╛╤Б╨╜╨╛╨▓╨░╨╜╨╕╨╡╨╝ ╨┤╨╗╤П ╨▓╨╛╨╖╨▓╤А╨░╤В╨░ ╤Б╤А╨╡╨┤╤Б╤В╨▓.</p>' +
        '<h3>6. ╨Ю╨┐╨╗╨░╤В╨░ ╨╕ ╨▓╨╛╨╖╨▓╤А╨░╤В ╨┤╨╡╨╜╨╡╨╢╨╜╤Л╤Е ╤Б╤А╨╡╨┤╤Б╤В╨▓</h3>' +
        '<p>6.1. ╨Я╤А╨╕ ╨╛╨┐╨╗╨░╤В╨╡ ╨▒╨░╨╜╨║╨╛╨▓╤Б╨║╨╕╨╝╨╕ ╨║╨░╤А╤В╨░╨╝╨╕ ╨▓╨╛╨╖╨▓╤А╨░╤В ╤Б╤А╨╡╨┤╤Б╤В╨▓ ╨╛╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╗╤П╨╡╤В╤Б╤П ╤В╨╛╨╗╤М╨║╨╛ ╨╜╨░ ╤В╤Г ╨╢╨╡ ╨║╨░╤А╤В╤Г, ╤Б ╨║╨╛╤В╨╛╤А╨╛╨╣ ╨▒╤Л╨╗╨░ ╨┐╤А╨╛╨╕╨╖╨▓╨╡╨┤╨╡╨╜╨░ ╨╛╨┐╨╗╨░╤В╨░. ╨Т╨╛╨╖╨▓╤А╨░╤В ╨╜╨░╨╗╨╕╤З╨╜╤Л╨╝╨╕ ╨┐╤А╨╕ ╨▒╨╡╨╖╨╜╨░╨╗╨╕╤З╨╜╨╛╨╣ ╨╛╨┐╨╗╨░╤В╨╡ ╨╜╨╡ ╨┤╨╛╨┐╤Г╤Б╨║╨░╨╡╤В╤Б╤П.</p>' +
        '<p>6.2. ╨Т ╤Б╨╗╤Г╤З╨░╨╡ ╨╛╤И╨╕╨▒╨╛╤З╨╜╨╛╨│╨╛ ╤Б╨┐╨╕╤Б╨░╨╜╨╕╤П ╤Б╤А╨╡╨┤╤Б╤В╨▓ ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╨╛ ╨╜╨░╨┐╤А╨░╨▓╨╕╤В╤М ╨┐╨╕╤Б╤М╨╝╨╡╨╜╨╜╨╛╨╡ ╨╖╨░╤П╨▓╨╗╨╡╨╜╨╕╨╡ ╨╕ ╨┐╤А╨╕╨╗╨╛╨╢╨╕╤В╤М ╨║╨╛╨┐╨╕╨╕ ╨┐╨░╤Б╨┐╨╛╤А╤В╨░ ╨╕ ╤З╨╡╨║╨╛╨▓. ╨б╤А╨╛╨║ ╤А╨░╤Б╤Б╨╝╨╛╤В╤А╨╡╨╜╨╕╤П ╨╖╨░╤П╨▓╨╗╨╡╨╜╨╕╤П ╨╕ ╨▓╨╛╨╖╨▓╤А╨░╤В╨░ ╤Б╤А╨╡╨┤╤Б╤В╨▓ тАФ ╨┤╨╛ 2 ╤А╨░╨▒╨╛╤З╨╕╤Е ╨┤╨╜╨╡╨╣.</p>' +
      '</div>'
    );
  }

  function showPageCare() {
    renderWithWebTop(
      '<span class="back-link" onclick="navigateTo(\'home\')">╨Э╨░ ╨│╨╗╨░╨▓╨╜╤Г╤О</span>' +
      '<div class="static-page">' +
        '<h2>╨а╨╡╨║╨╛╨╝╨╡╨╜╨┤╨░╤Ж╨╕╨╕ ╨┐╨╛ ╤Г╤Е╨╛╨┤╤Г</h2>' +
        '<p>╨Э╨░╨╝ ╨▓╨░╨╢╨╜╨╛, ╤З╤В╨╛╨▒╤Л ╨▒╤Г╨║╨╡╤В ╤А╨░╨┤╨╛╨▓╨░╨╗ ╨▓╨░╤Б ╨║╨░╨║ ╨╝╨╛╨╢╨╜╨╛ ╨┤╨╛╨╗╤М╤И╨╡. ╨ж╨▓╨╡╤В╤Л тАФ ╨╢╨╕╨▓╨╛╨╣ ╨╕ ╨╛╤З╨╡╨╜╤М ╤Е╤А╤Г╨┐╨║╨╕╨╣ ╨╝╨░╤В╨╡╤А╨╕╨░╨╗, ╨┐╨╛╤Н╤В╨╛╨╝╤Г ╤В╨░╨║ ╨▓╨░╨╢╨╜╨╛ ╤Г╤Е╨░╨╢╨╕╨▓╨░╤В╤М ╨╖╨░ ╨▒╤Г╨║╨╡╤В╨╛╨╝, ╤З╤В╨╛╨▒╤Л ╨┐╤А╨╛╨┤╨╗╨╕╤В╤М ╤Ж╨▓╨╡╤В╨░╨╝ ╤Б╤А╨╛╨║ ╨╢╨╕╨╖╨╜╨╕.</p>' +
        '<h3>╨г╤Е╨╛╨┤ ╨╖╨░ ╨▒╤Г╨║╨╡╤В╨╛╨╝</h3>' +
        '<ol>' +
          '<li>╨б╨╜╨╕╨╝╨╕╤В╨╡ ╨║╤А╨░╤Б╨╕╨▓╤Г╤О ╤Г╨┐╨░╨║╨╛╨▓╨║╤Г ╤Б ╨▒╤Г╨║╨╡╤В╨░.</li>' +
          '<li>╨Я╨╡╤А╨╡╤Б╤В╨░╨▓╤М╤В╨╡ ╨╡╨│╨╛ ╨╕╨╖ ╨░╨║╨▓╨░╨▒╨╛╨║╤Б╨░ ╨▓ ╨▓╨░╨╖╤Г ╤Б ╨┐╤А╨╛╤В╨╛╤З╨╜╨╛╨╣ ╨┐╤А╨╛╤Е╨╗╨░╨┤╨╜╨╛╨╣ ╨▓╨╛╨┤╨╛╨╣, ╨┤╨╛╨▒╨░╨▓╤М╤В╨╡ ╤Г╨┤╨╛╨▒╤А╨╡╨╜╨╕╨╡ ╨╕╨╖ ╨┐╨░╨║╨╡╤В╨╕╨║╨░.</li>' +
          '<li>╨а╨╡╨│╤Г╨╗╤П╤А╨╜╨╛ ╨╝╨╡╨╜╤П╨╣╤В╨╡ ╤Ж╨▓╨╡╤В╨░╨╝ ╨▓╨╛╨┤╤Г ╨╕ ╨╛╤Б╨▓╨╡╨╢╨░╨╣╤В╨╡ ╤Б╤А╨╡╨╖ ╨╛╤Б╤В╤А╤Л╨╝ ╨╜╨╛╨╢╨╛╨╝ ╨╕╨╗╨╕ ╤Б╨╡╨║╨░╤В╨╛╤А╨╛╨╝.</li>' +
          '<li>╨Ф╨╡╤А╨╢╨╕╤В╨╡ ╤Ж╨▓╨╡╤В╤Л ╨▓╨┤╨░╨╗╨╕ ╨╛╤В ╤Б╨║╨▓╨╛╨╖╨╜╤П╨║╨░, ╨┐╤А╤П╨╝╤Л╤Е ╤Б╨╛╨╗╨╜╨╡╤З╨╜╤Л╤Е ╨╗╤Г╤З╨╡╨╣, ╨╛╤В╨╛╨┐╨╕╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╤А╨╕╨▒╨╛╤А╨╛╨▓.</li>' +
          '<li>╨Э╨╡ ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╣╤В╨╡ ╨┤╨╗╤П ╨┐╨╛╨┤╤А╨╡╨╖╨░╨╜╨╕╤П ╤Ж╨▓╨╡╤В╨╛╨▓ ╨╜╨╛╨╢╨╜╨╕╤Ж╤Л.</li>' +
        '</ol>' +
        '<h3>╨г╤Е╨╛╨┤ ╨╖╨░ ╨║╨╛╨╝╨┐╨╛╨╖╨╕╤Ж╨╕╨╡╨╣ ╨╜╨░ ╨│╤Г╨▒╨║╨╡</h3>' +
        '<ol>' +
          '<li>╨Э╨╡ ╨┤╨╛╨┐╤Г╤Б╨║╨░╨╣╤В╨╡ ╨┐╨╡╤А╨╡╤Б╤Л╤Е╨░╨╜╨╕╤П ╨│╤Г╨▒╨║╨╕: ╨┐╨╛╨┤╨╗╨╕╨▓╨░╨╣╤В╨╡ ╤А╨░╨╖ ╨▓ ╨┤╨╡╨╜╤М ╨┐╨╛╨╗╨╛╨▓╨╕╨╜╤Г ╨╕╨╗╨╕ ╨┐╨╛╨╗╨╜╤Л╨╣ ╤Б╤В╨░╨║╨░╨╜ ╨┐╤А╨╛╤В╨╛╤З╨╜╨╛╨╣ ╨▓╨╛╨┤╤Л ╨▓ ╤Ж╨╡╨╜╤В╤А ╨║╨╛╨╝╨┐╨╛╨╖╨╕╤Ж╨╕╨╕ ╨▓ ╨╖╨░╨▓╨╕╤Б╨╕╨╝╨╛╤Б╤В╨╕ ╨╛╤В ╨╡╤С ╤А╨░╨╖╨╝╨╡╤А╨░.</li>' +
          '<li>╨Ф╨╡╤А╨╢╨╕╤В╨╡ ╤Ж╨▓╨╡╤В╤Л ╨▓╨┤╨░╨╗╨╕ ╨╛╤В ╤Б╨║╨▓╨╛╨╖╨╜╤П╨║╨░, ╨┐╤А╤П╨╝╤Л╤Е ╤Б╨╛╨╗╨╜╨╡╤З╨╜╤Л╤Е ╨╗╤Г╤З╨╡╨╣, ╨╛╤В╨╛╨┐╨╕╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╤А╨╕╨▒╨╛╤А╨╛╨▓.</li>' +
          '<li>╨Я╨╛ ╨╝╨╡╤А╨╡ ╤Г╨▓╤П╨┤╨░╨╜╨╕╤П ╤Ж╨▓╨╡╤В╨╛╨▓ ╤Г╨┤╨░╨╗╤П╨╣╤В╨╡ ╨╕╤Е ╨╕╨╖ ╨║╨╛╨╝╨┐╨╛╨╖╨╕╤Ж╨╕╨╕ тАФ ╤Н╤В╨╛ ╨┐╤А╨╛╨┤╨╗╨╕╤В ╨╢╨╕╨╖╨╜╤М ╨┤╤А╤Г╨│╨╕╨╝ ╤А╨░╤Б╤В╨╡╨╜╨╕╤П╨╝.</li>' +
        '</ol>' +
      '</div>'
    );
  }

  function showPageOffer() {
    renderWithWebTop(
      '<span class="back-link" onclick="navigateTo(\'home\')">╨Э╨░ ╨│╨╗╨░╨▓╨╜╤Г╤О</span>' +
      '<div class="static-page">' +
        '<h2>╨Я╤Г╨▒╨╗╨╕╤З╨╜╨░╤П ╨╛╤Д╨╡╤А╤В╨░</h2>' +
        '<h3>1. ╨Ю╨▒╤Й╨╕╨╡ ╨┐╨╛╨╗╨╛╨╢╨╡╨╜╨╕╤П</h3>' +
        '<p>1.1. ╨Э╨░╤Б╤В╨╛╤П╤Й╨╕╨╣ ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В ╤П╨▓╨╗╤П╨╡╤В╤Б╤П ╨╛╤Д╨╕╤Ж╨╕╨░╨╗╤М╨╜╤Л╨╝ ╨┐╤А╨╡╨┤╨╗╨╛╨╢╨╡╨╜╨╕╨╡╨╝ (╨┐╤Г╨▒╨╗╨╕╤З╨╜╨╛╨╣ ╨╛╤Д╨╡╤А╤В╨╛╨╣) ╨Ш╨╜╨┤╨╕╨▓╨╕╨┤╤Г╨░╨╗╤М╨╜╨╛╨│╨╛ ╨┐╤А╨╡╨┤╨┐╤А╨╕╨╜╨╕╨╝╨░╤В╨╡╨╗╤П ╨Ц╨░╤А╨│╨░╨╗╨╛╨▓╨╛╨╣ ╨Ь╨╕╨╗╨╡╨╜╤Л ╨Р╨╗╨╡╨║╤Б╨░╨╜╨┤╤А╨╛╨▓╨╜╤Л (╨┤╨░╨╗╨╡╨╡ тАФ ┬л╨Я╤А╨╛╨┤╨░╨▓╨╡╤Ж┬╗) ╨╖╨░╨║╨╗╤О╤З╨╕╤В╤М ╨┤╨╛╨│╨╛╨▓╨╛╤А ╤А╨╛╨╖╨╜╨╕╤З╨╜╨╛╨╣ ╨║╤Г╨┐╨╗╨╕-╨┐╤А╨╛╨┤╨░╨╢╨╕ ╤В╨╛╨▓╨░╤А╨╛╨▓ ╨┤╨╕╤Б╤В╨░╨╜╤Ж╨╕╨╛╨╜╨╜╤Л╨╝ ╤Б╨┐╨╛╤Б╨╛╨▒╨╛╨╝ ╤З╨╡╤А╨╡╨╖ ╤Б╨░╨╣╤В arkaflowers.shop.</p>' +
        '<p>1.2. ╨Т ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╕╨╕ ╤Б╨╛ ╤Б╤В╨░╤В╤М╤П╨╝╨╕ 435тАУ437 ╨У╤А╨░╨╢╨┤╨░╨╜╤Б╨║╨╛╨│╨╛ ╨║╨╛╨┤╨╡╨║╤Б╨░ ╨а╨д ╨╛╤Д╨╛╤А╨╝╨╗╨╡╨╜╨╕╨╡ ╨Ч╨░╨║╨░╨╖╨░ ╨╕ ╨╡╨│╨╛ ╨╛╨┐╨╗╨░╤В╨░ ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╨╡╨╝ ╨╛╨╖╨╜╨░╤З╨░╨╡╤В ╨┐╨╛╨╗╨╜╨╛╨╡ ╨╕ ╨▒╨╡╨╖╨╛╨│╨╛╨▓╨╛╤А╨╛╤З╨╜╨╛╨╡ ╨┐╤А╨╕╨╜╤П╤В╨╕╨╡ (╨░╨║╤Ж╨╡╨┐╤В) ╤Г╤Б╨╗╨╛╨▓╨╕╨╣ ╨╜╨░╤Б╤В╨╛╤П╤Й╨╡╨╣ ╨Ю╤Д╨╡╤А╤В╤Л.</p>' +
        '<p>1.3. ╨Ю╤Д╨╡╤А╤В╨░ ╨┤╨╡╨╣╤Б╤В╨▓╤Г╨╡╤В ╨▓ ╨╛╤В╨╜╨╛╤И╨╡╨╜╨╕╨╕ ╨╗╤О╨▒╨╛╨│╨╛ ╨╗╨╕╤Ж╨░, ╨╛╤Д╨╛╤А╨╝╨╕╨▓╤И╨╡╨│╨╛ ╨╖╨░╨║╨░╨╖ ╨╜╨░ ╤Б╨░╨╣╤В╨╡.</p>' +
        '<h3>2. ╨б╨▓╨╡╨┤╨╡╨╜╨╕╤П ╨╛ ╨Я╤А╨╛╨┤╨░╨▓╤Ж╨╡</h3>' +
        '<p>╨Ш╨╜╨┤╨╕╨▓╨╕╨┤╤Г╨░╨╗╤М╨╜╤Л╨╣ ╨┐╤А╨╡╨┤╨┐╤А╨╕╨╜╨╕╨╝╨░╤В╨╡╨╗╤М ╨Ц╨░╤А╨│╨░╨╗╨╛╨▓╨░ ╨Ь╨╕╨╗╨╡╨╜╨░ ╨Р╨╗╨╡╨║╤Б╨░╨╜╨┤╤А╨╛╨▓╨╜╨░<br>' +
        '╨Ш╨Э╨Э: 380455657342<br>' +
        '╨Ю╨У╨а╨Э╨Ш╨Я: 322645700026683<br>' +
        '╨Р╨┤╤А╨╡╤Б: ╨г╨╗. ╨╕╨╝. ╨Я╤Г╨│╨░╤З╤С╨▓╨░, ╨┤. 49╨░, ╨║╨▓. 147<br>' +
        '╨в╨╡╨╗╨╡╤Д╨╛╨╜: +7 (996) 122-05-70<br>' +
        'Email: arkaflowers@bk.ru</p>' +
        '<h3>3. ╨Я╤А╨╡╨┤╨╝╨╡╤В ╨┤╨╛╨│╨╛╨▓╨╛╤А╨░</h3>' +
        '<p>3.1. ╨Я╤А╨╛╨┤╨░╨▓╨╡╤Ж ╨╛╨▒╤П╨╖╤Г╨╡╤В╤Б╤П ╨┐╨╡╤А╨╡╨┤╨░╤В╤М ╨▓ ╤Б╨╛╨▒╤Б╤В╨▓╨╡╨╜╨╜╨╛╤Б╤В╤М ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╤П ╤Ж╨▓╨╡╤В╨╛╤З╨╜╤Г╤О ╨┐╤А╨╛╨┤╤Г╨║╤Ж╨╕╤О (╨▒╤Г╨║╨╡╤В╤Л, ╨║╨╛╨╝╨┐╨╛╨╖╨╕╤Ж╨╕╨╕, ╨┐╨╛╨┤╨░╤А╨║╨╕), ╨┐╤А╨╡╨┤╤Б╤В╨░╨▓╨╗╨╡╨╜╨╜╤Г╤О ╨╜╨░ ╤Б╨░╨╣╤В╨╡, ╨░ ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╤М ╨╛╨▒╤П╨╖╤Г╨╡╤В╤Б╤П ╨╛╨┐╨╗╨░╤В╨╕╤В╤М ╨╕ ╨┐╤А╨╕╨╜╤П╤В╤М ╤В╨╛╨▓╨░╤А.</p>' +
        '<p>3.2. ╨Т╨╜╨╡╤И╨╜╨╕╨╣ ╨▓╨╕╨┤ ╨▒╤Г╨║╨╡╤В╨░ ╨╝╨╛╨╢╨╡╤В ╨╜╨╡╨╖╨╜╨░╤З╨╕╤В╨╡╨╗╤М╨╜╨╛ ╨╛╤В╨╗╨╕╤З╨░╤В╤М╤Б╤П ╨╛╤В ╨╕╨╖╨╛╨▒╤А╨░╨╢╨╡╨╜╨╕╤П ╨╜╨░ ╤Б╨░╨╣╤В╨╡ ╨▓ ╨╖╨░╨▓╨╕╤Б╨╕╨╝╨╛╤Б╤В╨╕ ╨╛╤В ╤Б╨╡╨╖╨╛╨╜╨╜╨╛╤Б╤В╨╕ ╨╕ ╨╜╨░╨╗╨╕╤З╨╕╤П ╤Ж╨▓╨╡╤В╨╛╨▓, ╨┐╤А╨╕ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╕ ╨╛╨▒╤Й╨╡╨╣ ╤Б╤В╨╕╨╗╨╕╤Б╤В╨╕╨║╨╕ ╨╕ ╤Ж╨╡╨╜╨╛╨▓╨╛╨╣ ╨║╨░╤В╨╡╨│╨╛╤А╨╕╨╕.</p>' +
        '<h3>4. ╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜╨╕╨╡ ╨╖╨░╨║╨░╨╖╨░</h3>' +
        '<p>4.1. ╨Ч╨░╨║╨░╨╖ ╨╛╤Д╨╛╤А╨╝╨╗╤П╨╡╤В╤Б╤П ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╨╡╨╝ ╤Б╨░╨╝╨╛╤Б╤В╨╛╤П╤В╨╡╨╗╤М╨╜╨╛ ╤З╨╡╤А╨╡╨╖ ╤Б╨░╨╣╤В.</p>' +
        '<p>4.2. ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╤М ╨╛╨▒╤П╨╖╨░╨╜ ╨┐╤А╨╡╨┤╨╛╤Б╤В╨░╨▓╨╕╤В╤М ╨┤╨╛╤Б╤В╨╛╨▓╨╡╤А╨╜╤Г╤О ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О (╨╕╨╝╤П, ╤В╨╡╨╗╨╡╤Д╨╛╨╜, ╨░╨┤╤А╨╡╤Б ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕).</p>' +
        '<p>4.3. ╨Я╨╛╤Б╨╗╨╡ ╨╛╤Д╨╛╤А╨╝╨╗╨╡╨╜╨╕╤П ╨╖╨░╨║╨░╨╖╨░ ╨Я╤А╨╛╨┤╨░╨▓╨╡╤Ж ╤Б╨▓╤П╨╖╤Л╨▓╨░╨╡╤В╤Б╤П ╤Б ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╨╡╨╝ ╨┤╨╗╤П ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨╡╨╜╨╕╤П ╨┤╨╡╤В╨░╨╗╨╡╨╣ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ ╨╕ ╤Б╨╛╤Б╤В╨░╨▓╨░ ╨▒╤Г╨║╨╡╤В╨░.</p>' +
        '<p>4.4. ╨Я╤А╨╛╨┤╨░╨▓╨╡╤Ж ╨▓╨┐╤А╨░╨▓╨╡ ╨╖╨░╨╝╨╡╨╜╨╕╤В╤М ╨╛╤В╨┤╨╡╨╗╤М╨╜╤Л╨╡ ╤Ж╨▓╨╡╤В╤Л ╨▓ ╨▒╤Г╨║╨╡╤В╨╡ ╨┐╤А╨╕ ╨╛╤В╤Б╤Г╤В╤Б╤В╨▓╨╕╨╕ ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╤Л╤Е ╨┐╨╛╨╖╨╕╤Ж╨╕╨╣, ╨┐╤А╨╡╨┤╨▓╨░╤А╨╕╤В╨╡╨╗╤М╨╜╨╛ ╤Б╨╛╨│╨╗╨░╤Б╨╛╨▓╨░╨▓ ╨╖╨░╨╝╨╡╨╜╤Г ╤Б ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╨╡╨╝.</p>' +
        '<h3>5. ╨ж╨╡╨╜╨░ ╨╕ ╨╛╨┐╨╗╨░╤В╨░</h3>' +
        '<p>5.1. ╨ж╨╡╨╜╤Л ╨╜╨░ ╤В╨╛╨▓╨░╤А╤Л ╤Г╨║╨░╨╖╨░╨╜╤Л ╨▓ ╤А╤Г╨▒╨╗╤П╤Е ╨а╨╛╤Б╤Б╨╕╨╣╤Б╨║╨╛╨╣ ╨д╨╡╨┤╨╡╤А╨░╤Ж╨╕╨╕.</p>' +
        '<p>5.2. ╨Ю╨┐╨╗╨░╤В╨░ ╨╖╨░╨║╨░╨╖╨░ ╨╛╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╗╤П╨╡╤В╤Б╤П ╨╛╨╜╨╗╨░╨╣╨╜ ╨╜╨░ ╤Б╨░╨╣╤В╨╡ ╨╗╨╕╨▒╨╛ ╨╕╨╜╤Л╨╝ ╤Б╨┐╨╛╤Б╨╛╨▒╨╛╨╝, ╨┤╨╛╤Б╤В╤Г╨┐╨╜╤Л╨╝ ╨╜╨░ ╤Б╨░╨╣╤В╨╡.</p>' +
        '<p>5.3. ╨Ч╨░╨║╨░╨╖ ╤Б╤З╨╕╤В╨░╨╡╤В╤Б╤П ╨╛╨┐╨╗╨░╤З╨╡╨╜╨╜╤Л╨╝ ╤Б ╨╝╨╛╨╝╨╡╨╜╤В╨░ ╨┐╨╛╤Б╤В╤Г╨┐╨╗╨╡╨╜╨╕╤П ╨┤╨╡╨╜╨╡╨╢╨╜╤Л╤Е ╤Б╤А╨╡╨┤╤Б╤В╨▓ ╨Я╤А╨╛╨┤╨░╨▓╤Ж╤Г.</p>' +
        '<h3>6. ╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨╕ ╤Б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖</h3>' +
        '<p>6.1. ╨Ф╨╛╤Б╤В╨░╨▓╨║╨░ ╨╛╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╗╤П╨╡╤В╤Б╤П ╨┐╨╛ ╨│. ╨б╨░╤А╨░╤В╨╛╨▓╤Г ╨╕ ╨│. ╨н╨╜╨│╨╡╨╗╤М╤Б╤Г.</p>' +
        '<p>6.2. ╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ ╨┐╨╛ ╨│╨╛╤А╨╛╨┤╤Г ╤Б╨╛╤Б╤В╨░╨▓╨╗╤П╨╡╤В ╨╛╤В 350 ╤А╤Г╨▒╨╗╨╡╨╣ ╨╕ ╤Г╨║╨░╨╖╤Л╨▓╨░╨╡╤В╤Б╤П ╨┐╤А╨╕ ╨╛╤Д╨╛╤А╨╝╨╗╨╡╨╜╨╕╨╕ ╨╖╨░╨║╨░╨╖╨░.</p>' +
        '<p>6.3. ╨б╤А╨╛╨║╨╕ ╨╕ ╨▓╤А╨╡╨╝╨╡╨╜╨╜╤Л╨╡ ╨╕╨╜╤В╨╡╤А╨▓╨░╨╗╤Л ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ ╤Б╨╛╨│╨╗╨░╤Б╨╛╨▓╤Л╨▓╨░╤О╤В╤Б╤П ╨┐╤А╨╕ ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨╡╨╜╨╕╨╕ ╨╖╨░╨║╨░╨╖╨░.</p>' +
        '<p>6.4. ╨Т╨╛╨╖╨╝╨╛╨╢╨╡╨╜ ╤Б╨░╨╝╨╛╨▓╤Л╨▓╨╛╨╖ ╨╕╨╖ ╨╛╤Д╨╗╨░╨╣╨╜-╨╝╨░╨│╨░╨╖╨╕╨╜╨░ ╨Я╤А╨╛╨┤╨░╨▓╤Ж╨░ ╨▓ ╤З╨░╤Б╤Л ╨╡╨│╨╛ ╤А╨░╨▒╨╛╤В╤Л.</p>' +
        '<p>6.5. ╨а╨╕╤Б╨║ ╤Б╨╗╤Г╤З╨░╨╣╨╜╨╛╨╣ ╨│╨╕╨▒╨╡╨╗╨╕ ╨╕╨╗╨╕ ╨┐╨╛╨▓╤А╨╡╨╢╨┤╨╡╨╜╨╕╤П ╤В╨╛╨▓╨░╤А╨░ ╨┐╨╡╤А╨╡╤Е╨╛╨┤╨╕╤В ╨║ ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╤О ╤Б ╨╝╨╛╨╝╨╡╨╜╤В╨░ ╨┐╨╡╤А╨╡╨┤╨░╤З╨╕ ╤В╨╛╨▓╨░╤А╨░ ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤О.</p>' +
        '<h3>7. ╨Т╨╛╨╖╨▓╤А╨░╤В ╨╕ ╨┐╤А╨╡╤В╨╡╨╜╨╖╨╕╨╕</h3>' +
        '<p>7.1. ╨Т ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╕╨╕ ╤Б ╨Я╨╛╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜╨╕╨╡╨╝ ╨Я╤А╨░╨▓╨╕╤В╨╡╨╗╤М╤Б╤В╨▓╨░ ╨а╨д тДЦ2463, ╤Б╤А╨╡╨╖╨░╨╜╨╜╤Л╨╡ ╤Ж╨▓╨╡╤В╤Л ╨╕ ╨▒╤Г╨║╨╡╤В╤Л ╨╜╨░╨┤╨╗╨╡╨╢╨░╤Й╨╡╨│╨╛ ╨║╨░╤З╨╡╤Б╤В╨▓╨░ ╨╛╨▒╨╝╨╡╨╜╤Г ╨╕ ╨▓╨╛╨╖╨▓╤А╨░╤В╤Г ╨╜╨╡ ╨┐╨╛╨┤╨╗╨╡╨╢╨░╤В.</p>' +
        '<p>7.2. ╨Я╤А╨╡╤В╨╡╨╜╨╖╨╕╨╕ ╨┐╨╛ ╨║╨░╤З╨╡╤Б╤В╨▓╤Г ╤В╨╛╨▓╨░╤А╨░ ╨┐╤А╨╕╨╜╨╕╨╝╨░╤О╤В╤Б╤П ╨▓ ╨╝╨╛╨╝╨╡╨╜╤В ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨╗╨╕╨▒╨╛ ╨▓ ╤В╨╡╤З╨╡╨╜╨╕╨╡ 30 ╨╝╨╕╨╜╤Г╤В ╨┐╨╛╤Б╨╗╨╡ ╨┐╨╡╤А╨╡╨┤╨░╤З╨╕ ╤В╨╛╨▓╨░╤А╨░ ╨┐╤А╨╕ ╨╜╨░╨╗╨╕╤З╨╕╨╕ ╤Д╨╛╤В╨╛╤Д╨╕╨║╤Б╨░╤Ж╨╕╨╕.</p>' +
        '<p>7.3. ╨Т╨╛╨╖╨▓╤А╨░╤В ╨┤╨╡╨╜╨╡╨╢╨╜╤Л╤Е ╤Б╤А╨╡╨┤╤Б╤В╨▓ ╨▓╨╛╨╖╨╝╨╛╨╢╨╡╨╜ ╤В╨╛╨╗╤М╨║╨╛ ╨▓ ╤Б╨╗╤Г╤З╨░╨╡ ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╤С╨╜╨╜╨╛╨│╨╛ ╨╜╨╡╨╜╨░╨┤╨╗╨╡╨╢╨░╤Й╨╡╨│╨╛ ╨║╨░╤З╨╡╤Б╤В╨▓╨░ ╤В╨╛╨▓╨░╤А╨░.</p>' +
        '<p>7.4. ╨Т ╤Б╨╗╤Г╤З╨░╨╡ ╨╛╤В╤Б╤Г╤В╤Б╤В╨▓╨╕╤П ╨┐╨╛╨╗╤Г╤З╨░╤В╨╡╨╗╤П ╨┐╨╛ ╨░╨┤╤А╨╡╤Б╤Г ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕ ╨┐╨╛╨▓╤В╨╛╤А╨╜╨░╤П ╨┤╨╛╤Б╤В╨░╨▓╨║╨░ ╨╛╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╗╤П╨╡╤В╤Б╤П ╨╖╨░ ╨┤╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╤Г╤О ╨┐╨╗╨░╤В╤Г.</p>' +
        '<h3>8. ╨Ю╤В╨▓╨╡╤В╤Б╤В╨▓╨╡╨╜╨╜╨╛╤Б╤В╤М ╤Б╤В╨╛╤А╨╛╨╜</h3>' +
        '<p>8.1. ╨Я╤А╨╛╨┤╨░╨▓╨╡╤Ж ╨╜╨╡ ╨╜╨╡╤Б╤С╤В ╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╡╨╜╨╜╨╛╤Б╤В╨╕ ╨╖╨░ ╤Б╤Г╨▒╤К╨╡╨║╤В╨╕╨▓╨╜╨╛╨╡ ╨╜╨╡╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╕╨╡ ╨╛╨╢╨╕╨┤╨░╨╜╨╕╨╣ ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╤П ╨╕ ╤Д╨░╨║╤В╨╕╤З╨╡╤Б╨║╨╛╨│╨╛ ╨▓╨╜╨╡╤И╨╜╨╡╨│╨╛ ╨▓╨╕╨┤╨░ ╨▒╤Г╨║╨╡╤В╨░.</p>' +
        '<p>8.2. ╨Я╤А╨╛╨┤╨░╨▓╨╡╤Ж ╨╛╤Б╨▓╨╛╨▒╨╛╨╢╨┤╨░╨╡╤В╤Б╤П ╨╛╤В ╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╡╨╜╨╜╨╛╤Б╤В╨╕ ╨╖╨░ ╨╜╨╡╨╕╤Б╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╤Б╤В╨▓ ╨▓╤Б╨╗╨╡╨┤╤Б╤В╨▓╨╕╨╡ ╤Д╨╛╤А╤Б-╨╝╨░╨╢╨╛╤А╨╜╤Л╤Е ╨╛╨▒╤Б╤В╨╛╤П╤В╨╡╨╗╤М╤Б╤В╨▓.</p>' +
        '<h3>9. ╨Я╨╡╤А╤Б╨╛╨╜╨░╨╗╤М╨╜╤Л╨╡ ╨┤╨░╨╜╨╜╤Л╨╡</h3>' +
        '<p>9.1. ╨Ю╤Д╨╛╤А╨╝╨╗╤П╤П ╨╖╨░╨║╨░╨╖, ╨Я╨╛╨║╤Г╨┐╨░╤В╨╡╨╗╤М ╨┤╨░╤С╤В ╤Б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╤Г ╨┐╨╡╤А╤Б╨╛╨╜╨░╨╗╤М╨╜╤Л╤Е ╨┤╨░╨╜╨╜╤Л╤Е ╨▓ ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╕╨╕ ╤Б ╨Я╨╛╨╗╨╕╤В╨╕╨║╨╛╨╣ ╨║╨╛╨╜╤Д╨╕╨┤╨╡╨╜╤Ж╨╕╨░╨╗╤М╨╜╨╛╤Б╤В╨╕ ╨╕ ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨╕ ╨┐╨╡╤А╤Б╨╛╨╜╨░╨╗╤М╨╜╤Л╤Е ╨┤╨░╨╜╨╜╤Л╤Е, ╤А╨░╨╖╨╝╨╡╤Й╤С╨╜╨╜╨╛╨╣ ╨╜╨░ ╤Б╨░╨╣╤В╨╡.</p>' +
        '<p>9.2. ╨Ю╨▒╤А╨░╨▒╨╛╤В╨║╨░ ╨┐╨╡╤А╤Б╨╛╨╜╨░╨╗╤М╨╜╤Л╤Е ╨┤╨░╨╜╨╜╤Л╤Е ╨╛╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╗╤П╨╡╤В╤Б╤П ╨▓ ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╕╨╕ ╤Б ╨д╨Ч тДЦ152-╨д╨Ч.</p>' +
        '<h3>10. ╨Ч╨░╨║╨╗╤О╤З╨╕╤В╨╡╨╗╤М╨╜╤Л╨╡ ╨┐╨╛╨╗╨╛╨╢╨╡╨╜╨╕╤П</h3>' +
        '<p>10.1. ╨Я╤А╨╛╨┤╨░╨▓╨╡╤Ж ╨▓╨┐╤А╨░╨▓╨╡ ╨▓╨╜╨╛╤Б╨╕╤В╤М ╨╕╨╖╨╝╨╡╨╜╨╡╨╜╨╕╤П ╨▓ ╨╜╨░╤Б╤В╨╛╤П╤Й╤Г╤О ╨Ю╤Д╨╡╤А╤В╤Г ╨▓ ╨╛╨┤╨╜╨╛╤Б╤В╨╛╤А╨╛╨╜╨╜╨╡╨╝ ╨┐╨╛╤А╤П╨┤╨║╨╡.</p>' +
        '<p>10.2. ╨Р╨║╤В╤Г╨░╨╗╤М╨╜╨░╤П ╨▓╨╡╤А╤Б╨╕╤П ╨Ю╤Д╨╡╤А╤В╤Л ╤А╨░╨╖╨╝╨╡╤Й╨░╨╡╤В╤Б╤П ╨╜╨░ ╤Б╨░╨╣╤В╨╡ arkaflowers.shop.</p>' +
        '<p>10.3. ╨Э╨░╤Б╤В╨╛╤П╤Й╨░╤П ╨Ю╤Д╨╡╤А╤В╨░ ╨┤╨╡╨╣╤Б╤В╨▓╤Г╨╡╤В ╨▒╨╡╤Б╤Б╤А╨╛╤З╨╜╨╛.</p>' +
      '</div>'
    );
  }

  // ============================================================
  // Navigation
  // ============================================================

  window.scrollToCatalog = function () {
    var el = document.getElementById('home-catalog');
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      el.scrollIntoView(true);
    }
  };

  window.onTelegramAuth = function (user) {
    if (!user || !user.id || !user.hash) {
      showToast('╨Ю╤И╨╕╨▒╨║╨░ ╨▓╤Е╨╛╨┤╨░ ╤З╨╡╤А╨╡╨╖ Telegram');
      return;
    }
    postJSON('/api/auth/telegram-web', user).then(function (r) {
      if (!r || !r.user) {
        var msg = (r && (r.error || r.message)) ? String(r.error || r.message) : '╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨▓╤Л╨┐╨╛╨╗╨╜╨╕╤В╤М ╨▓╤Е╨╛╨┤';
        showToast(msg);
        return;
      }
      dbUser = r.user;
      try { localStorage.setItem('arka_tg_id', String(r.user.telegram_id || user.id)); } catch (e) {}
      try { localStorage.setItem('arka_user', JSON.stringify(r.user)); } catch (e) {}
      showToast('╨Т╤Е╨╛╨┤ ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜');
      navigateTo('account');
    }).catch(function (err) {
      showToast('╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨▓╤Л╨┐╨╛╨╗╨╜╨╕╤В╤М ╨▓╤Е╨╛╨┤: ' + ((err && err.message) ? err.message : '╨╜╨╡╤В ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╤П'));
    });
  };

  window.navigateTo = function (page, param, skipHistory) {
    setWebQuickNavOpen(false);
    if (page !== 'home' && detachHomeHeroScroll) {
      detachHomeHeroScroll();
      detachHomeHeroScroll = null;
    }
    if (page !== 'home' && detachMobileQuickCatsScroll) {
      detachMobileQuickCatsScroll();
      detachMobileQuickCatsScroll = null;
    }
    if (page !== 'home' && document && document.body) document.body.classList.remove('mobile-toolbar-fixed');
    if (page !== 'account') stopTrackingPoll();
    if (page !== 'checkout' && _inCheckout) {
      sendAbandonedCart('╨г╤И╤С╨╗ ╨╜╨░: ' + page);
      _inCheckout = false;
      stopAbandonTimer();
    }
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
    syncWebQuickNavVisibility(page);
    if (!skipHistory) {
      pushRouteState(page, param, false);
    }
  };

  // ============================================================
  // Global handlers
  // ============================================================

  window.switchCardSize = function (event, productId, btn, price, dims, imageUrl) {
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
    if (imageUrl) {
      var card = btn.closest('.product-card');
      if (card) {
        var activeImg = card.querySelector('.product-card-img.card-slide-active') || card.querySelector('.product-card-img');
        if (activeImg) {
          activeImg.setAttribute('src', imageUrl);
        } else {
          var wrap = card.querySelector('.product-card-img-wrap');
          var noImg = wrap ? wrap.querySelector('.no-image') : null;
          if (noImg) {
            noImg.outerHTML = '<img src="' + imageUrl + '" alt="" class="product-card-img">';
          }
        }
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
          dimensions: activeBtn.getAttribute('data-dims') || '',
          image_url: activeBtn.getAttribute('data-img') || ''
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
    var dims = btn.getAttribute('data-dims') || '';
    var img = btn.getAttribute('data-img') || '';
    var priceEl = document.getElementById('detail-price');
    if (priceEl) priceEl.textContent = formatPrice(price);
    var infoEl = document.getElementById('size-info');
    if (infoEl) {
      var text = dims || '';
      infoEl.textContent = text;
    }
    if (img) {
      var detailImgs = document.querySelectorAll('#product-detail .product-detail-img');
      if (detailImgs.length) {
        detailImgs.forEach(function (el) { el.setAttribute('src', img); });
      } else {
        var noImg = document.querySelector('#product-detail .product-detail-img-wrap .no-image');
        if (noImg) noImg.outerHTML = '<img src="' + img + '" alt="" class="product-detail-img">';
      }
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
      showToast('╨Э╨╛╨╝╨╡╤А ╤В╨╡╨╗╨╡╤Д╨╛╨╜╨░ ╨┤╨╛╨╗╨╢╨╡╨╜ ╤Б╨╛╨┤╨╡╤А╨╢╨░╤В╤М 11 ╤Ж╨╕╤Д╤А');
      return false;
    }
    if (!/^[78]/.test(digits)) {
      showToast('╨Э╨╛╨╝╨╡╤А ╨┤╨╛╨╗╨╢╨╡╨╜ ╨╜╨░╤З╨╕╨╜╨░╤В╤М╤Б╤П ╤Б +7 ╨╕╨╗╨╕ 8');
      return false;
    }
    return true;
  }

  function validateEmail(email) {
    if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      showToast('╨Я╨╛╤З╤В╨░ ╨┤╨╛╨╗╨╢╨╜╨░ ╤Б╨╛╨┤╨╡╤А╨╢╨░╤В╤М ╤В╨╛╨╗╤М╨║╨╛ ╨╗╨░╤В╨╕╨╜╨╕╤Ж╤Г, @ ╨╕ ╨┤╨╛╨╝╨╡╨╜');
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
      showToast('╨г╨║╨░╨╢╨╕╤В╨╡ ╨┐╨╛╤З╤В╤Г ╨╜╨░ ╨╕╨╖╨▓╨╡╤Б╤В╨╜╨╛╨╝ ╤Б╨╡╤А╨▓╨╕╤Б╨╡ (gmail.com, mail.ru, yandex.ru ╨╕ ╤В.╨┤.)');
      return false;
    }
    return true;
  }

  window.changeCartSize = function (cartIdx, newLabel, newPrice, newDims, newImg) {
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
    item.dimensions = newDims || '';
    if (newImg) item.image_url = newImg;
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
        var fcText = newDims || '';
        fcEl.textContent = fcText;
      }
      var imgEl = row.querySelector('.cart-item-img');
      if (imgEl && newImg) imgEl.setAttribute('src', newImg);
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
