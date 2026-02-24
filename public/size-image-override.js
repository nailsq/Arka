;(function () {
  'use strict';

  var productCache = {};
  var sizeCache = {};
  var cartImageToken = {};
  var cardImageToken = {};
  var detailImageToken = 0;

  function getCart() {
    try { return JSON.parse(localStorage.getItem('arka_cart')) || []; } catch (e) { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem('arka_cart', JSON.stringify(cart));
  }

  function preload(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(false);
      var img = new Image();
      img.onload = function () { resolve(true); };
      img.onerror = function () { resolve(false); };
      img.src = url;
    });
  }

  function fetchProduct(productId) {
    if (productCache[productId]) return Promise.resolve(productCache[productId]);
    return fetch('/api/products/' + productId)
      .then(function (r) { return r.json(); })
      .then(function (p) {
        productCache[productId] = p || {};
        return productCache[productId];
      })
      .catch(function () { return {}; });
  }

  function fetchSizes(productId) {
    if (sizeCache[productId]) return Promise.resolve(sizeCache[productId]);
    return fetchProduct(productId).then(function (p) {
      var sizes = (p && p.sizes && p.sizes.length) ? p.sizes : [];
      sizeCache[productId] = sizes;
      return sizes;
    });
  }

  function productIdFromCard(card) {
    var active = card.querySelector('.card-size-btn.active') || card.querySelector('.card-size-btn');
    if (!active) return 0;
    var onclick = active.getAttribute('onclick') || '';
    var m = onclick.match(/switchCardSize\(event,(\d+),/);
    return m ? (parseInt(m[1], 10) || 0) : 0;
  }

  function setCardImage(productId, imageUrl) {
    if (!productId || !imageUrl) return;
    var token = Date.now() + Math.random();
    cardImageToken[productId] = token;
    preload(imageUrl).then(function (ok) {
      if (!ok || cardImageToken[productId] !== token) return;
      var cards = document.querySelectorAll('.product-card');
      cards.forEach(function (card) {
        if (productIdFromCard(card) !== productId) return;
        var slides = card.querySelectorAll('.product-card-img-wrap .card-slide');
        var dots = card.querySelectorAll('.product-card-img-wrap .card-dot');
        if (slides.length) {
          slides[0].src = imageUrl;
          slides.forEach(function (s, i) { s.classList.toggle('card-slide-active', i === 0); });
          dots.forEach(function (d, i) { d.classList.toggle('active', i === 0); });
          return;
        }
        var single = card.querySelector('.product-card-img-wrap .product-card-img');
        if (single && single.tagName === 'IMG') single.src = imageUrl;
      });
    });
  }

  function setDetailImage(imageUrl) {
    if (!imageUrl) return;
    var token = ++detailImageToken;
    preload(imageUrl).then(function (ok) {
      if (!ok || token !== detailImageToken) return;
      var single = document.querySelector('.product-detail-img-wrap .product-detail-img');
      if (single && single.tagName === 'IMG') single.src = imageUrl;
      var firstSlide = document.querySelector('#gallery-track .gallery-slide:first-child .product-detail-img');
      if (firstSlide && firstSlide.tagName === 'IMG') {
        firstSlide.src = imageUrl;
        if (typeof window.galleryGoTo === 'function') {
          try { window.galleryGoTo(0); } catch (e) {}
        }
      }
    });
  }

  function updateCartItemImage(cartIdx, imageUrl) {
    if (!imageUrl) return;
    var token = Date.now() + Math.random();
    cartImageToken[cartIdx] = token;

    var cart = getCart();
    if (!cart[cartIdx]) return;
    cart[cartIdx].image_url = imageUrl;
    saveCart(cart);

    var row = document.getElementById('cart-row-' + cartIdx);
    if (!row) return;
    var img = row.querySelector('.cart-item-img');
    if (!img || img.tagName !== 'IMG') return;

    preload(imageUrl).then(function (ok) {
      if (!ok || cartImageToken[cartIdx] !== token) return;
      img.src = imageUrl;
    });
  }

  function annotateDetailButtons() {
    var p = window._currentProduct;
    if (!p || !p.sizes || !p.sizes.length) return;
    var buttons = document.querySelectorAll('#size-selector .size-btn');
    buttons.forEach(function (btn, idx) {
      var s = p.sizes[idx];
      if (!s) return;
      btn.setAttribute('data-img', s.image_url || '');
      btn.setAttribute('data-dims', s.dimensions || '');
    });
    if (p.sizes[0] && p.sizes[0].image_url) setDetailImage(p.sizes[0].image_url);
  }

  function refreshCatalogCards() {
    var cards = document.querySelectorAll('.product-card');
    cards.forEach(function (card) {
      var productId = productIdFromCard(card);
      if (!productId) return;
      var active = card.querySelector('.card-size-btn.active');
      if (!active) return;
      var idx = parseInt(active.getAttribute('data-idx') || '0', 10) || 0;
      fetchSizes(productId).then(function (sizes) {
        var s = sizes[idx];
        if (s && s.image_url) setCardImage(productId, s.image_url);
      });
    });
  }

  function refreshCartRowsImages() {
    var cart = getCart();
    if (!cart || !cart.length) return;
    cart.forEach(function (item, idx) {
      if (!item || item.is_free_service) return;
      var localSizes = item.available_sizes || [];
      var byLabel = localSizes.find(function (s) { return s.label === item.size_label; });
      if (byLabel && byLabel.image_url) {
        updateCartItemImage(idx, byLabel.image_url);
        return;
      }
      if (!item.product_id || !item.size_label) return;
      fetchSizes(item.product_id).then(function (sizes) {
        var remote = (sizes || []).find(function (s) { return s.label === item.size_label; });
        if (remote && remote.image_url) updateCartItemImage(idx, remote.image_url);
      });
    });
  }

  function installOverrides() {
    if (typeof window.switchCardSize === 'function') {
      var origSwitch = window.switchCardSize;
      window.switchCardSize = function (event, productId, btn, price, dims) {
        origSwitch(event, productId, btn, price, dims);
        var idx = parseInt(btn && btn.getAttribute('data-idx') || '0', 10) || 0;
        var fromBtn = btn ? (btn.getAttribute('data-img') || '') : '';
        if (fromBtn) {
          setCardImage(productId, fromBtn);
          return;
        }
        fetchSizes(productId).then(function (sizes) {
          var s = sizes[idx];
          if (s && s.image_url) setCardImage(productId, s.image_url);
        });
      };
    }

    if (typeof window.selectSize === 'function') {
      var origSelectSize = window.selectSize;
      window.selectSize = function (btn, productId) {
        origSelectSize(btn, productId);
        var img = btn ? (btn.getAttribute('data-img') || '') : '';
        if (img) {
          setDetailImage(img);
          return;
        }
        var p = window._currentProduct;
        if (!p || !p.sizes) return;
        var all = Array.prototype.slice.call(document.querySelectorAll('#size-selector .size-btn'));
        var idx = all.indexOf(btn);
        var s = p.sizes[idx >= 0 ? idx : 0];
        if (s && s.image_url) setDetailImage(s.image_url);
      };
    }

    if (typeof window.addToCartById === 'function') {
      var origAddToCartById = window.addToCartById;
      window.addToCartById = function (productId, event) {
        var card = event && event.target ? event.target.closest('.product-card') : null;
        var activeBtn = card ? card.querySelector('.card-size-btn.active') : null;
        var idx = activeBtn ? (parseInt(activeBtn.getAttribute('data-idx') || '0', 10) || 0) : 0;
        var img = activeBtn ? (activeBtn.getAttribute('data-img') || '') : '';
        origAddToCartById(productId, event);

        if (img) {
          var cart = getCart();
          for (var i = cart.length - 1; i >= 0; i--) {
            if (cart[i].product_id === productId) {
              cart[i].image_url = img;
              break;
            }
          }
          saveCart(cart);
          refreshCartRowsImages();
          return;
        }

        fetchSizes(productId).then(function (sizes) {
          var s = (sizes || [])[idx];
          if (!s || !s.image_url) return;
          var cart = getCart();
          for (var i = cart.length - 1; i >= 0; i--) {
            if (cart[i].product_id === productId && (cart[i].size_label || '') === (s.label || '')) {
              cart[i].image_url = s.image_url;
              break;
            }
          }
          saveCart(cart);
          refreshCartRowsImages();
        });
      };
    }

    if (typeof window.addToCartWithSize === 'function') {
      var origAddToCartWithSize = window.addToCartWithSize;
      window.addToCartWithSize = function (productId, event) {
        var p = window._currentProduct;
        var img = '';
        var label = '';
        if (p && p.id === productId && p.sizes && p.sizes.length) {
          var activeBtn = document.querySelector('#size-selector .size-btn.active');
          if (activeBtn) {
            label = activeBtn.getAttribute('data-label') || '';
            img = activeBtn.getAttribute('data-img') || '';
          }
        }
        origAddToCartWithSize(productId, event);
        if (!img || !label) return;
        var cart = getCart();
        for (var i = cart.length - 1; i >= 0; i--) {
          if (cart[i].product_id === productId && (cart[i].size_label || '') === label) {
            cart[i].image_url = img;
            break;
          }
        }
        saveCart(cart);
        refreshCartRowsImages();
      };
    }

    if (typeof window.changeCartSize === 'function') {
      var origChangeCartSize = window.changeCartSize;
      window.changeCartSize = function (cartIdx, newLabel, newPrice, newFlowerCount, newDims) {
        origChangeCartSize(cartIdx, newLabel, newPrice, newFlowerCount, newDims);
        var cart = getCart();
        var item = cart[cartIdx];
        if (!item) return;
        var localSizes = item.available_sizes || [];
        var hit = localSizes.find(function (s) { return s.label === newLabel; });
        if (hit && hit.image_url) {
          updateCartItemImage(cartIdx, hit.image_url);
          return;
        }
        fetchSizes(item.product_id).then(function (sizes) {
          var s = (sizes || []).find(function (x) { return x.label === newLabel; });
          if (s && s.image_url) updateCartItemImage(cartIdx, s.image_url);
        });
      };
    }
  }

  function observeRenders() {
    var app = document.getElementById('app');
    if (!app) return;
    var observer = new MutationObserver(function () {
      annotateDetailButtons();
      refreshCatalogCards();
      refreshCartRowsImages();
    });
    observer.observe(app, { childList: true, subtree: true });
  }

  function init() {
    installOverrides();
    observeRenders();
    annotateDetailButtons();
    refreshCatalogCards();
    refreshCartRowsImages();
  }

  init();
})();
;(function () {
  'use strict';

  var sizeCache = {};
  var productCache = {};

  function getCart() {
    try { return JSON.parse(localStorage.getItem('arka_cart')) || []; } catch (e) { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem('arka_cart', JSON.stringify(cart));
  }

  function fetchProduct(productId) {
    if (productCache[productId]) return Promise.resolve(productCache[productId]);
    return fetch('/api/products/' + productId)
      .then(function (r) { return r.json(); })
      .then(function (p) {
        productCache[productId] = p || {};
        return productCache[productId];
      })
      .catch(function () { return {}; });
  }

  function fetchSizes(productId) {
    if (sizeCache[productId]) return Promise.resolve(sizeCache[productId]);
    return fetchProduct(productId).then(function (p) {
      var sizes = (p && p.sizes && p.sizes.length) ? p.sizes : [];
      sizeCache[productId] = sizes;
      return sizes;
    });
  }

  function setCardImage(productId, imageUrl) {
    if (!imageUrl) return;
    var card = document.querySelector('.product-card .card-size-btn[data-idx].active');
    var single = document.getElementById('card-img-' + productId);
    if (single) single.src = imageUrl;
    var firstSlide = document.getElementById('card-slide-' + productId + '-0');
    if (firstSlide) firstSlide.src = imageUrl;

    var wraps = document.querySelectorAll('.product-card');
    wraps.forEach(function (w) {
      var btn = w.querySelector('.card-size-btn.active');
      if (!btn) return;
      var imgWrap = btn.closest('.product-card').querySelector('.product-card-img-wrap');
      if (!imgWrap) return;
      var clicked = btn.getAttribute('onclick') || '';
      if (clicked.indexOf(',' + productId + ',') < 0) return;
      var slides = imgWrap.querySelectorAll('.card-slide');
      var dots = imgWrap.querySelectorAll('.card-dot');
      if (slides.length) {
        slides[0].src = imageUrl;
        slides.forEach(function (s, i) { s.classList.toggle('card-slide-active', i === 0); });
        dots.forEach(function (d, i) { d.classList.toggle('active', i === 0); });
      } else {
        var img = imgWrap.querySelector('.product-card-img');
        if (img && img.tagName === 'IMG') img.src = imageUrl;
      }
    });
    if (card) { /* no-op: keeps linter calm about unused selection */ }
  }

  function setDetailImage(imageUrl) {
    if (!imageUrl) return;
    var single = document.querySelector('.product-detail-img-wrap .product-detail-img');
    if (single) single.src = imageUrl;
    var firstSlide = document.querySelector('#gallery-track .gallery-slide:first-child .product-detail-img');
    if (firstSlide) firstSlide.src = imageUrl;
    if (typeof window.galleryGoTo === 'function') {
      try { window.galleryGoTo(0); } catch (e) {}
    }
  }

  function updateCartItemImage(cartIdx, imageUrl) {
    if (!imageUrl) return;
    var cart = getCart();
    if (!cart[cartIdx]) return;
    cart[cartIdx].image_url = imageUrl;
    saveCart(cart);
    var row = document.getElementById('cart-row-' + cartIdx);
    if (!row) return;
    var img = row.querySelector('.cart-item-img');
    if (img && img.tagName === 'IMG') img.src = imageUrl;
  }

  function annotateDetailSizeButtons() {
    var p = window._currentProduct;
    if (!p || !p.sizes || !p.sizes.length) return;
    var buttons = document.querySelectorAll('#size-selector .size-btn');
    buttons.forEach(function (btn, idx) {
      var s = p.sizes[idx];
      if (!s) return;
      btn.setAttribute('data-img', s.image_url || '');
    });
    if (p.sizes[0] && p.sizes[0].image_url) setDetailImage(p.sizes[0].image_url);
  }

  function refreshCartRowsImages() {
    var cart = getCart();
    if (!cart || !cart.length) return;
    cart.forEach(function (item, idx) {
      if (!item || item.is_free_service) return;
      var sizes = item.available_sizes || [];
      var byLabel = sizes.find(function (s) { return s.label === item.size_label; });
      if (byLabel && byLabel.image_url) {
        updateCartItemImage(idx, byLabel.image_url);
        return;
      }
      if (item.product_id && item.size_label) {
        fetchSizes(item.product_id).then(function (all) {
          var s = (all || []).find(function (x) { return x.label === item.size_label; });
          if (s && s.image_url) updateCartItemImage(idx, s.image_url);
        });
      }
    });
  }

  function installOverrides() {
    if (typeof window.switchCardSize === 'function') {
      var origSwitch = window.switchCardSize;
      window.switchCardSize = function (event, productId, btn, price, dims) {
        origSwitch(event, productId, btn, price, dims);
        var idx = parseInt(btn && btn.getAttribute('data-idx') || '0', 10) || 0;
        fetchSizes(productId).then(function (sizes) {
          var s = sizes[idx];
          if (s && s.image_url) setCardImage(productId, s.image_url);
        });
      };
    }

    if (typeof window.selectSize === 'function') {
      var origSelectSize = window.selectSize;
      window.selectSize = function (btn, productId) {
        origSelectSize(btn, productId);
        var infoEl = document.getElementById('size-info');
        if (infoEl && btn) {
          var dims = btn.getAttribute('data-dims') || '';
          var fc = parseInt(btn.getAttribute('data-fc') || '0', 10) || 0;
          var txt = fc ? (typeof window.pluralFlower === 'function' ? window.pluralFlower(fc) : '') : '';
          if (dims) txt += (txt ? ' · ' : '') + dims;
          infoEl.textContent = txt;
        }
        var img = btn ? (btn.getAttribute('data-img') || '') : '';
        if (img) {
          setDetailImage(img);
          return;
        }
        var p = window._currentProduct;
        if (!p || !p.sizes) return;
        var all = Array.prototype.slice.call(document.querySelectorAll('#size-selector .size-btn'));
        var idx = all.indexOf(btn);
        var s = p.sizes[idx >= 0 ? idx : 0];
        if (s && s.image_url) setDetailImage(s.image_url);
      };
    }

    if (typeof window.addToCartById === 'function') {
      var origAddToCartById = window.addToCartById;
      window.addToCartById = function (productId, event) {
        var card = event && event.target ? event.target.closest('.product-card') : null;
        var activeBtn = card ? card.querySelector('.card-size-btn.active') : null;
        var sizeIdx = activeBtn ? (parseInt(activeBtn.getAttribute('data-idx') || '0', 10) || 0) : 0;
        var img = activeBtn ? (activeBtn.getAttribute('data-img') || '') : '';
        origAddToCartById(productId, event);
        if (img) {
          var cart = getCart();
          for (var i = cart.length - 1; i >= 0; i--) {
            if (cart[i].product_id === productId) {
              cart[i].image_url = img;
              break;
            }
          }
          saveCart(cart);
          refreshCartRowsImages();
          return;
        }
        fetchSizes(productId).then(function (sizes) {
          var s = (sizes || [])[sizeIdx];
          if (!s || !s.image_url) return;
          var cart = getCart();
          for (var i = cart.length - 1; i >= 0; i--) {
            if (cart[i].product_id === productId && (cart[i].size_label || '') === (s.label || '')) {
              cart[i].image_url = s.image_url;
              break;
            }
          }
          saveCart(cart);
          refreshCartRowsImages();
        });
      };
    }

    if (typeof window.changeCartSize === 'function') {
      var origChangeCartSize = window.changeCartSize;
      window.changeCartSize = function (cartIdx, newLabel, newPrice, newFlowerCount, newDims) {
        origChangeCartSize(cartIdx, newLabel, newPrice, newFlowerCount, newDims);
        var cart = getCart();
        var item = cart[cartIdx];
        if (!item) return;
        var localSizes = item.available_sizes || [];
        var hit = localSizes.find(function (s) { return s.label === newLabel; });
        if (hit && hit.image_url) {
          updateCartItemImage(cartIdx, hit.image_url);
          return;
        }
        fetchSizes(item.product_id).then(function (sizes) {
          var s = (sizes || []).find(function (x) { return x.label === newLabel; });
          if (s && s.image_url) updateCartItemImage(cartIdx, s.image_url);
        });
      };
    }

    if (typeof window.addToCartWithSize === 'function') {
      var origAddToCartWithSize = window.addToCartWithSize;
      window.addToCartWithSize = function (productId, event) {
        var p = window._currentProduct;
        var img = '';
        var label = '';
        if (p && p.id === productId && p.sizes && p.sizes.length) {
          var activeBtn = document.querySelector('#size-selector .size-btn.active');
          if (activeBtn) {
            label = activeBtn.getAttribute('data-label') || '';
            img = activeBtn.getAttribute('data-img') || '';
          }
        }
        origAddToCartWithSize(productId, event);
        if (!img || !label) return;
        var cart = getCart();
        for (var i = cart.length - 1; i >= 0; i--) {
          if (cart[i].product_id === productId && (cart[i].size_label || '') === label) {
            cart[i].image_url = img;
            break;
          }
        }
        saveCart(cart);
        refreshCartRowsImages();
      };
    }
  }

  function observeRenders() {
    var app = document.getElementById('app');
    if (!app) return;
    var obs = new MutationObserver(function () {
      annotateDetailSizeButtons();
      var cards = document.querySelectorAll('.product-card');
      cards.forEach(function (card) {
        var active = card.querySelector('.card-size-btn.active');
        if (!active) return;
        var onclick = active.getAttribute('onclick') || '';
        var m = onclick.match(/switchCardSize\(event,(\d+),/);
        if (!m) return;
        var productId = parseInt(m[1], 10);
        var idx = parseInt(active.getAttribute('data-idx') || '0', 10) || 0;
        fetchSizes(productId).then(function (sizes) {
          var s = sizes[idx];
          if (s && s.image_url) setCardImage(productId, s.image_url);
        });
      });
    });
    obs.observe(app, { childList: true, subtree: true });
  }

  function init() {
    installOverrides();
    observeRenders();
  }

  init();
})();
