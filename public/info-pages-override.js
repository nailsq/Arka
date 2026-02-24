;(function () {
  'use strict';

  var DEFAULT_INFO_PAGES = [
    { slug: 'order', title: 'О заказе и доставке', content: 'Информация о заказе и доставке.' },
    { slug: 'payment', title: 'Об оплате', content: 'Информация о способах оплаты.' },
    { slug: 'returns', title: 'Условия возврата', content: 'Информация по условиям возврата.' },
    { slug: 'care', title: 'Рекомендации по уходу', content: 'Рекомендации по уходу за букетами.' },
    { slug: 'offer', title: 'Публичная оферта', content: 'Текст публичной оферты.' }
  ];

  var settingsCache = null;
  var loadingPromise = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function plainTextOnly(value) {
    return String(value || '')
      .replace(/\r/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  function loadSettings() {
    if (settingsCache) return Promise.resolve(settingsCache);
    if (loadingPromise) return loadingPromise;
    loadingPromise = fetch('/api/settings')
      .then(function (r) { return r.json(); })
      .then(function (s) {
        settingsCache = s || {};
        return settingsCache;
      })
      .catch(function () {
        settingsCache = {};
        return settingsCache;
      })
      .finally(function () {
        loadingPromise = null;
      });
    return loadingPromise;
  }

  function getInfoPagesFromSettings(settings) {
    var raw = settings && settings.info_pages_json;
    if (!raw) return DEFAULT_INFO_PAGES.slice();
    try {
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return DEFAULT_INFO_PAGES.slice();
      var out = [];
      arr.forEach(function (d, idx) {
        if (!d) return;
        var title = plainTextOnly(d.title || '');
        var content = plainTextOnly(d.content || '');
        var slug = plainTextOnly(d.slug || '') || ('doc-' + (idx + 1));
        if (!title || !content) return;
        out.push({ slug: slug, title: title, content: content });
      });
      return out.length ? out : DEFAULT_INFO_PAGES.slice();
    } catch (e) {
      return DEFAULT_INFO_PAGES.slice();
    }
  }

  function renderInfoLinks(docs) {
    var list = document.getElementById('info-links');
    if (!list) return;
    list.innerHTML = docs.map(function (d) {
      var safeSlug = encodeURIComponent(d.slug);
      return '<a href="#" onclick="navigateTo(\'page-info\', decodeURIComponent(\'' + safeSlug + '\')); return false;">' + escapeHtml(d.title) + '</a>';
    }).join('');
  }

  function renderInfoPage(docs, slug) {
    var appEl = document.getElementById('app');
    if (!appEl) return;
    var doc = null;
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].slug === slug) {
        doc = docs[i];
        break;
      }
    }
    if (!doc) {
      appEl.innerHTML = '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span><div class="static-page"><h2>Документ не найден</h2></div>';
      window.scrollTo(0, 0);
      return;
    }
    appEl.innerHTML =
      '<span class="back-link" onclick="navigateTo(\'home\')">На главную</span>' +
      '<div class="static-page">' +
        '<h2>' + escapeHtml(doc.title) + '</h2>' +
        '<p>' + escapeHtml(doc.content).replace(/\n/g, '<br>') + '</p>' +
      '</div>';
    window.scrollTo(0, 0);
  }

  function mapLegacyPage(page, param) {
    if (page === 'page-info') return param || '';
    if (page === 'page-order') return 'order';
    if (page === 'page-payment') return 'payment';
    if (page === 'page-returns') return 'returns';
    if (page === 'page-care') return 'care';
    if (page === 'page-offer') return 'offer';
    return '';
  }

  function bootstrap() {
    loadSettings().then(function (settings) {
      renderInfoLinks(getInfoPagesFromSettings(settings));
    });

    window.renderInfoPageBySlug = function (slug) {
      return loadSettings().then(function (settings) {
        renderInfoPage(getInfoPagesFromSettings(settings), slug);
      });
    };

    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (typeof window.navigateTo !== 'function') {
        if (tries > 60) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      var originalNavigateTo = window.navigateTo;
      window.navigateTo = function (page, param) {
        var slug = mapLegacyPage(page, param);
        if (!slug) return originalNavigateTo(page, param);
        return window.renderInfoPageBySlug(slug);
      };
    }, 50);
  }

  bootstrap();
})();
