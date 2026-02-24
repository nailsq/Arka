;(function () {
  'use strict';

  var productCache = {};
  var sizesCache = {};
  var latestCartImageToken = {};

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
    if (sizesCache[productId]) return Promise.resolve(sizesCache[productId]);
    return fetchProduct(productId).then(function (p) {
      var sizes = (p && p.sizes) ? p.sizes : [];
      sizesCache[productId] = sizes || [];
      return sizesCache[productId];
    });
  }

  function extractProductIdFromCard(card) {
    var wrap = card.querySelector('.product-card-img-wrap');
    if (!wrap) return 0;
    var onclick = wrap.getAttribute('onclick') || '';
    var m = onclick.match(/navigateTo\('product',\s*(\d+)\)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function setCardImage(card, imageUrl) {
    if (!card || !imageUrl) return;
    var slides = card.querySelectorAll('.card-slide');
    var dots = card.querySelectorAll('.card-dot');
    if (slides.length) {
      slides[0].src = imageUrl;
      slides.forEach(function (s, i) { s.classList.toggle('card-slide-active', i === 0); });
      dots.forEach(function (d, i) { d.classList.toggle('active', i === 0); });
      return;
    }
    var img = card.querySelector('.product-card-img');
    if (img && img.tagName === 'IMG') img.src = imageUrl;
  }

  function setDetailImage(imageUrl) {
    if (!imageUrl) return;
    var single = document.querySelector('.product-detail-img-wrap .product-detail-img');
    if (single && single.tagName === 'IMG') single.src = imageUrl;
    var first = document.querySelector('#gallery-track .gallery-slide:first-child .product-detail-img');
    if (first && first.tagName === 'IMG') first.src = imageUrl;
    if (typeof window.galleryGoTo === 'function') {
      try { window.galleryGoTo(0); } catch (e) {}
    }
  }

  function setCartImage(cartIdx, imageUrl) {
    if (!imageUrl) return;
    var token = String(Date.now()) + '_' + Math.random();
    latestCartImageToken[cartIdx] = token;
    var pre = new Image();
    pre.onload = function () {
      if (latestCartImageToken[cartIdx] !== token) return;
      var cart = getCart();
      if (!cart[cartIdx]) return;
      cart[cartIdx].image_url = imageUrl;
      saveCart(cart);
      var row = document.getElementById('cart-row-' + cartIdx);
      if (!row) return;
      var img = row.querySelector('.cart-item-img');
      if (img && img.tagName === 'IMG') img.src = imageUrl;
    };
    pre.src = imageUrl;
  }

  function annotateDetailButtons() {
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

  function updateCartRowsImages() {
    var cart = getCart();
    cart.forEach(function (item, idx) {
      if (!item || !item.product_id || !item.size_label) return;
      fetchSizes(item.product_id).then(function (sizes) {
        var s = (sizes || []).find(function (x) { return x.label === item.size_label; });
        if (s && s.image_url) setCartImage(idx, s.image_url);
      });
    });
  }

  function installOverrides() {
    if (typeof window.switchCardSize === 'function') {
      var oldSwitch = window.switchCardSize;
      window.switchCardSize = function (event, productId, btn, price, dims) {
        oldSwitch(event, productId, btn, price, dims);
        var idx = parseInt(btn && btn.getAttribute('data-idx') || '0', 10) || 0;
        var card = btn ? btn.closest('.product-card') : null;
        fetchSizes(productId).then(function (sizes) {
          var s = sizes[idx];
          if (s && s.image_url) setCardImage(card, s.image_url);
        });
      };
    }

    if (typeof window.selectSize === 'function') {
      var oldSelect = window.selectSize;
      window.selectSize = function (btn, productId) {
        oldSelect(btn, productId);
        var img = btn ? (btn.getAttribute('data-img') || '') : '';
        if (img) setDetailImage(img);
      };
    }

    if (typeof window.addToCartWithSize === 'function') {
      var oldAddWithSize = window.addToCartWithSize;
      window.addToCartWithSize = function (productId, event) {
        var p = window._currentProduct;
        var img = '';
        var label = '';
        if (p && p.id === productId && p.sizes && p.sizes.length) {
          var active = document.querySelector('#size-selector .size-btn.active');
          if (active) {
            img = active.getAttribute('data-img') || '';
            label = active.getAttribute('data-label') || '';
          }
        }
        oldAddWithSize(productId, event);
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

    if (typeof window.addToCartById === 'function') {
      var oldAddById = window.addToCartById;
      window.addToCartById = function (productId, event) {
        var idx = 0;
        var card = event && event.target ? event.target.closest('.product-card') : null;
        if (card) {
          var active = card.querySelector('.card-size-btn.active');
          if (active) idx = parseInt(active.getAttribute('data-idx') || '0', 10) || 0;
        }
        oldAddById(productId, event);
        fetchSizes(productId).then(function (sizes) {
          var s = sizes[idx];
          if (!s || !s.image_url) return;
          var cart = getCart();
          for (var i = cart.length - 1; i >= 0; i--) {
            if (cart[i].product_id === productId && (cart[i].size_label || '') === (s.label || '')) {
              cart[i].image_url = s.image_url;
              break;
            }
          }
          saveCart(cart);
        });
      };
    }

    if (typeof window.changeCartSize === 'function') {
      var oldChange = window.changeCartSize;
      window.changeCartSize = function (cartIdx, newLabel, newPrice, newFlowerCount, newDims) {
        oldChange(cartIdx, newLabel, newPrice, newFlowerCount, newDims);
        var cart = getCart();
        var item = cart[cartIdx];
        if (!item) return;
        fetchSizes(item.product_id).then(function (sizes) {
          var s = (sizes || []).find(function (x) { return x.label === newLabel; });
          if (s && s.image_url) setCartImage(cartIdx, s.image_url);
        });
      };
    }
  }

  function observeRenders() {
    var app = document.getElementById('app');
    if (!app) return;
    var obs = new MutationObserver(function () {
      annotateDetailButtons();
      var cards = document.querySelectorAll('.product-card');
      cards.forEach(function (card) {
        var productId = extractProductIdFromCard(card);
        if (!productId) return;
        var active = card.querySelector('.card-size-btn.active');
        if (!active) return;
        var idx = parseInt(active.getAttribute('data-idx') || '0', 10) || 0;
        fetchSizes(productId).then(function (sizes) {
          var s = sizes[idx];
          if (s && s.image_url) setCardImage(card, s.image_url);
        });
      });
      updateCartRowsImages();
    });
    obs.observe(app, { childList: true, subtree: true });
  }

  installOverrides();
  observeRenders();
})();
