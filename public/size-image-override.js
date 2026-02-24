;(function () {
  'use strict';

  var sizeCache = {};
  var productCache = {};
  var imageReadyCache = {};
  var pendingCartImageToken = {};

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

  function preloadImage(url) {
    if (!url) return Promise.resolve(false);
    if (imageReadyCache[url]) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        imageReadyCache[url] = true;
        resolve(true);
      };
      img.onerror = function () {
        resolve(false);
      };
      img.src = url;
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
    var token = String(Date.now()) + '_' + Math.random();
    pendingCartImageToken[cartIdx] = token;
    preloadImage(imageUrl).then(function (ok) {
      if (!ok) return;
      if (pendingCartImageToken[cartIdx] !== token) return;
      var cart = getCart();
      if (!cart[cartIdx]) return;
      cart[cartIdx].image_url = imageUrl;
      saveCart(cart);
      var row = document.getElementById('cart-row-' + cartIdx);
      if (!row) return;
      var img = row.querySelector('.cart-item-img');
      if (img && img.tagName === 'IMG') img.src = imageUrl;
    });
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
