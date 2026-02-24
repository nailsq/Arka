;(function () {
  'use strict';

  var sizeCache = {};
  var productCache = {};
  var detailToken = 0;
  var cardTokens = {};
  var cartTokens = {};

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

  function getProductIdFromCard(card) {
    if (!card) return 0;
    var cartBtn = card.querySelector('.cart-icon-btn');
    if (cartBtn) {
      var click = cartBtn.getAttribute('onclick') || '';
      var m = click.match(/addToCartById\((\d+),/);
      if (m) return parseInt(m[1], 10) || 0;
    }
    var anySizeBtn = card.querySelector('.card-size-btn');
    if (anySizeBtn) {
      var click2 = anySizeBtn.getAttribute('onclick') || '';
      var m2 = click2.match(/switchCardSize\(event,(\d+),/);
      if (m2) return parseInt(m2[1], 10) || 0;
    }
    return 0;
  }

  function setCardImage(card, productId, imageUrl) {
    if (!card || !productId || !imageUrl) return;
    var token = Date.now() + Math.random();
    cardTokens[productId] = token;
    preload(imageUrl).then(function (ok) {
      if (!ok || cardTokens[productId] !== token) return;
      var slides = card.querySelectorAll('.product-card-img-wrap .card-slide');
      var dots = card.querySelectorAll('.product-card-img-wrap .card-dot');
      if (slides.length) {
        slides[0].src = imageUrl;
        slides.forEach(function (s, idx) { s.classList.toggle('card-slide-active', idx === 0); });
        dots.forEach(function (d, idx) { d.classList.toggle('active', idx === 0); });
        return;
      }
      var single = card.querySelector('.product-card-img-wrap .product-card-img');
      if (single && single.tagName === 'IMG') {
        single.src = imageUrl;
      } else if (single) {
        single.outerHTML = '<img src="' + imageUrl + '" alt="" class="product-card-img">';
      } else {
        var wrap = card.querySelector('.product-card-img-wrap');
        if (wrap) {
          var ph = wrap.querySelector('.no-image');
          if (ph) ph.outerHTML = '<img src="' + imageUrl + '" alt="" class="product-card-img">';
        }
      }
    });
  }

  function setDetailImage(imageUrl) {
    if (!imageUrl) return;
    var token = ++detailToken;
    preload(imageUrl).then(function (ok) {
      if (!ok || token !== detailToken) return;
      var single = document.querySelector('.product-detail-img-wrap .product-detail-img');
      if (single && single.tagName === 'IMG') {
        single.src = imageUrl;
      } else if (single) {
        single.outerHTML = '<img src="' + imageUrl + '" alt="" class="product-detail-img">';
      } else {
        var ph = document.querySelector('.product-detail-img-wrap .no-image');
        if (ph) ph.outerHTML = '<img src="' + imageUrl + '" alt="" class="product-detail-img">';
      }
      var firstSlide = document.querySelector('#gallery-track .gallery-slide:first-child .product-detail-img');
      if (firstSlide && firstSlide.tagName === 'IMG') {
        firstSlide.src = imageUrl;
        if (typeof window.galleryGoTo === 'function') {
          try { window.galleryGoTo(0); } catch (e) {}
        }
      }
    });
  }

  function updateCartImage(cartIdx, imageUrl) {
    if (!imageUrl) return;
    var token = Date.now() + Math.random();
    cartTokens[cartIdx] = token;
    var cart = getCart();
    if (!cart[cartIdx]) return;
    cart[cartIdx].image_url = imageUrl;
    saveCart(cart);
    var row = document.getElementById('cart-row-' + cartIdx);
    if (!row) return;
    var img = row.querySelector('.cart-item-img');
    if (!img || img.tagName !== 'IMG') return;
    preload(imageUrl).then(function (ok) {
      if (!ok || cartTokens[cartIdx] !== token) return;
      img.src = imageUrl;
    });
  }

  function syncDetailButtons() {
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

  function syncCatalogImages() {
    var cards = document.querySelectorAll('.product-card');
    cards.forEach(function (card) {
      var productId = getProductIdFromCard(card);
      if (!productId) return;
      var activeBtn = card.querySelector('.card-size-btn.active');
      if (!activeBtn) return;
      var idx = parseInt(activeBtn.getAttribute('data-idx') || '0', 10) || 0;
      fetchSizes(productId).then(function (sizes) {
        var s = sizes[idx];
        if (s && s.image_url) setCardImage(card, productId, s.image_url);
      });
    });
  }

  function syncCartImages() {
    var cart = getCart();
    if (!cart || !cart.length) return;
    cart.forEach(function (item, idx) {
      if (!item || item.is_free_service) return;
      var local = (item.available_sizes || []).find(function (s) { return s.label === item.size_label; });
      if (local && local.image_url) return updateCartImage(idx, local.image_url);
      if (!item.product_id || !item.size_label) return;
      fetchSizes(item.product_id).then(function (sizes) {
        var remote = (sizes || []).find(function (s) { return s.label === item.size_label; });
        if (remote && remote.image_url) updateCartImage(idx, remote.image_url);
      });
    });
  }

  function installOverrides() {
    if (typeof window.switchCardSize === 'function') {
      var origSwitch = window.switchCardSize;
      window.switchCardSize = function (event, productId, btn, price, dims) {
        origSwitch(event, productId, btn, price, dims);
        var card = btn ? btn.closest('.product-card') : null;
        var idx = parseInt(btn && btn.getAttribute('data-idx') || '0', 10) || 0;
        fetchSizes(productId).then(function (sizes) {
          var s = sizes[idx];
          if (s && s.image_url) setCardImage(card, productId, s.image_url);
        });
      };
    }

    if (typeof window.selectSize === 'function') {
      var origSelect = window.selectSize;
      window.selectSize = function (btn, productId) {
        origSelect(btn, productId);
        var img = btn ? (btn.getAttribute('data-img') || '') : '';
        if (img) return setDetailImage(img);
        var p = window._currentProduct;
        if (!p || !p.sizes) return;
        var all = Array.prototype.slice.call(document.querySelectorAll('#size-selector .size-btn'));
        var idx = all.indexOf(btn);
        var s = p.sizes[idx >= 0 ? idx : 0];
        if (s && s.image_url) setDetailImage(s.image_url);
      };
    }

    if (typeof window.addToCartWithSize === 'function') {
      var origAddSized = window.addToCartWithSize;
      window.addToCartWithSize = function (productId, event) {
        var activeBtn = document.querySelector('#size-selector .size-btn.active');
        var label = activeBtn ? (activeBtn.getAttribute('data-label') || '') : '';
        var img = activeBtn ? (activeBtn.getAttribute('data-img') || '') : '';
        origAddSized(productId, event);
        if (!label || !img) return;
        var cart = getCart();
        for (var i = cart.length - 1; i >= 0; i--) {
          if (cart[i].product_id === productId && (cart[i].size_label || '') === label) {
            cart[i].image_url = img;
            break;
          }
        }
        saveCart(cart);
        syncCartImages();
      };
    }

    if (typeof window.changeCartSize === 'function') {
      var origChange = window.changeCartSize;
      window.changeCartSize = function (cartIdx, newLabel, newPrice, newFlowerCount, newDims) {
        origChange(cartIdx, newLabel, newPrice, newFlowerCount, newDims);
        var cart = getCart();
        var item = cart[cartIdx];
        if (!item) return;
        var local = (item.available_sizes || []).find(function (s) { return s.label === newLabel; });
        if (local && local.image_url) return updateCartImage(cartIdx, local.image_url);
        fetchSizes(item.product_id).then(function (sizes) {
          var s = (sizes || []).find(function (x) { return x.label === newLabel; });
          if (s && s.image_url) updateCartImage(cartIdx, s.image_url);
        });
      };
    }
  }

  function observeRenders() {
    var app = document.getElementById('app');
    if (!app) return;
    var obs = new MutationObserver(function () {
      syncDetailButtons();
      syncCatalogImages();
      syncCartImages();
    });
    obs.observe(app, { childList: true, subtree: true });
  }

  function init() {
    installOverrides();
    observeRenders();
    syncDetailButtons();
    syncCatalogImages();
    syncCartImages();
  }

  init();
})();
