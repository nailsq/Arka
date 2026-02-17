(function () {
  'use strict';

  var app = document.getElementById('admin-app');
  var token = localStorage.getItem('arka_admin_token') || '';
  var currentTab = 'orders';

  var ORDER_STATUSES = ['Новый', 'Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Доставлен'];

  var STATUS_BADGE = {
    'Новый': 'badge-new',
    'Оплачен': 'badge-paid',
    'Собирается': 'badge-preparing',
    'Собран': 'badge-ready',
    'Отправлен': 'badge-shipped',
    'Доставлен': 'badge-delivered'
  };

  // ============================================================
  // Helpers
  // ============================================================

  function api(method, url, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }
    };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) {
        token = '';
        localStorage.removeItem('arka_admin_token');
        showLogin();
        throw new Error('Unauthorized');
      }
      return r.json();
    });
  }

  function apiUpload(method, url, formData) {
    return fetch(url, {
      method: method,
      headers: { 'X-Admin-Token': token },
      body: formData
    }).then(function (r) {
      if (r.status === 401) {
        token = '';
        localStorage.removeItem('arka_admin_token');
        showLogin();
        throw new Error('Unauthorized');
      }
      return r.json();
    });
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtPrice(p) {
    return Number(p).toLocaleString('ru-RU') + ' р.';
  }

  function fmtDate(d) {
    if (!d) return '—';
    var dt = new Date(d);
    return String(dt.getDate()).padStart(2, '0') + '.' +
      String(dt.getMonth() + 1).padStart(2, '0') + '.' + dt.getFullYear() + ' ' +
      String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  }

  function render(html) {
    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function statusBadge(status) {
    var cls = STATUS_BADGE[status] || 'badge-new';
    return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
  }

  function adminToast(message, type) {
    var container = document.getElementById('admin-toast-container');
    var el = document.createElement('div');
    el.className = 'admin-toast' + (type ? ' admin-toast-' + type : '');
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2600);
  }

  function productThumb(url) {
    if (!url) return '<div class="product-row-noimg">--</div>';
    return '<img src="' + esc(url) + '" class="product-row-img" onerror="this.outerHTML=\'<div class=product-row-noimg>--</div>\'">';
  }

  // ============================================================
  // Sidebar toggle (mobile)
  // ============================================================

  window.toggleSidebar = function () {
    document.getElementById('sidebar').classList.toggle('open');
  };

  // ============================================================
  // Auth
  // ============================================================

  function showLogin() {
    document.getElementById('logout-btn').style.display = 'none';
    document.getElementById('sidebar-nav').style.display = 'none';
    document.getElementById('topbar-title').textContent = 'Вход';

    render(
      '<div class="login-wrap">' +
        '<div class="login-card">' +
          '<h2>Вход</h2>' +
          '<div class="login-sub">Панель управления АРКА</div>' +
          '<div class="login-error" id="login-error">Неверный логин или пароль</div>' +
          '<form onsubmit="doLogin(event)">' +
            '<div class="form-group">' +
              '<label class="form-label">Логин</label>' +
              '<input type="text" class="form-input" id="login-user" placeholder="admin" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">Пароль</label>' +
              '<input type="password" class="form-input" id="login-pass" placeholder="Пароль" required>' +
            '</div>' +
            '<button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">Войти</button>' +
          '</form>' +
        '</div>' +
      '</div>'
    );
  }

  window.doLogin = function (e) {
    e.preventDefault();
    var login = document.getElementById('login-user').value;
    var pass = document.getElementById('login-pass').value;
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: login, password: pass })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.token) {
        token = data.token;
        localStorage.setItem('arka_admin_token', token);
        showDashboard();
      } else {
        document.getElementById('login-error').style.display = 'block';
      }
    });
  };

  window.adminLogout = function () {
    api('POST', '/api/admin/logout').catch(function () {});
    token = '';
    localStorage.removeItem('arka_admin_token');
    showLogin();
  };

  // ============================================================
  // Dashboard
  // ============================================================

  function showDashboard() {
    document.getElementById('logout-btn').style.display = 'block';
    document.getElementById('sidebar-nav').style.display = 'flex';
    updateActiveTab();
    render('<div id="tab-content"><div class="empty-state">Загрузка...</div></div>');
    loadTab();
  }

  function updateActiveTab() {
    var links = document.querySelectorAll('.sidebar-link');
    links.forEach(function (l) {
      l.classList.toggle('active', l.getAttribute('data-tab') === currentTab);
    });
    var titles = {
      orders: 'Заказы',
      products: 'Товары',
      categories: 'Категории',
      settings: 'Настройки'
    };
    document.getElementById('topbar-title').textContent = titles[currentTab] || 'Панель управления';
  }

  window.switchTab = function (tab) {
    currentTab = tab;
    document.getElementById('sidebar').classList.remove('open');
    updateActiveTab();
    render('<div id="tab-content"><div class="empty-state">Загрузка...</div></div>');
    loadTab();
  };

  function loadTab() {
    switch (currentTab) {
      case 'orders': loadOrders(); break;
      case 'products': loadProducts(); break;
      case 'categories': loadCategories(); break;
      case 'settings': loadSettings(); break;
    }
  }

  // ============================================================
  // Orders
  // ============================================================

  var orderFilter = '';

  function loadOrders() {
    var url = '/api/admin/orders' + (orderFilter ? '?status=' + encodeURIComponent(orderFilter) : '');
    api('GET', url).then(function (orders) {
      var el = document.getElementById('tab-content');

      var h = '<div class="card">';
      h += '<div class="filter-bar">';
      h += '<button class="filter-chip' + (!orderFilter ? ' active' : '') + '" onclick="filterOrders(\'\')">Все</button>';
      ORDER_STATUSES.forEach(function (s) {
        h += '<button class="filter-chip' + (orderFilter === s ? ' active' : '') + '" onclick="filterOrders(\'' + esc(s) + '\')">' + esc(s) + '</button>';
      });
      h += '</div>';

      if (!orders.length) {
        h += '<div class="empty-state">Заказов не найдено</div></div>';
        el.innerHTML = h;
        return;
      }

      h += '<table class="data-table"><thead><tr>' +
        '<th>N</th><th>Дата</th><th>Клиент</th><th>Сумма</th><th>Статус</th><th></th>' +
        '</tr></thead><tbody>';

      orders.forEach(function (o) {
        h += '<tr>' +
          '<td><strong>' + o.id + '</strong></td>' +
          '<td>' + fmtDate(o.created_at) + '</td>' +
          '<td>' + esc(o.user_name) + '<br><span style="color:var(--text-secondary);font-size:12px">' + esc(o.user_phone) + '</span></td>' +
          '<td><strong>' + fmtPrice(o.total_amount) + '</strong></td>' +
          '<td>' + statusBadge(o.status) + '</td>' +
          '<td><button class="btn btn-sm" onclick="viewOrder(' + o.id + ')">Подробнее</button></td>' +
        '</tr>';
      });

      h += '</tbody></table></div>';
      el.innerHTML = h;
    });
  }

  window.filterOrders = function (status) {
    orderFilter = status;
    loadOrders();
  };

  window.viewOrder = function (id) {
    api('GET', '/api/admin/orders').then(function (orders) {
      var o = orders.find(function (x) { return x.id === id; });
      if (!o) return;

      var el = document.getElementById('tab-content');
      var h = '<button class="btn btn-sm" onclick="loadOrders()" style="margin-bottom:20px">Назад к списку</button>';
      h += '<div class="card">';
      h += '<div class="card-header"><span class="card-title">Заказ N ' + o.id + '</span>' + statusBadge(o.status) + '</div>';

      h += '<div class="order-detail-grid">';
      h += '<div class="detail-item"><span class="detail-label">Дата</span><span class="detail-value">' + fmtDate(o.created_at) + '</span></div>';
      h += '<div class="detail-item"><span class="detail-label">Клиент</span><span class="detail-value">' + esc(o.user_name) + '</span></div>';
      h += '<div class="detail-item"><span class="detail-label">Телефон</span><span class="detail-value">' + esc(o.user_phone) + '</span></div>';
      if (o.user_telegram) h += '<div class="detail-item"><span class="detail-label">Telegram</span><span class="detail-value">' + esc(o.user_telegram) + '</span></div>';
      if (o.user_email) h += '<div class="detail-item"><span class="detail-label">Email</span><span class="detail-value">' + esc(o.user_email) + '</span></div>';
      if (o.receiver_name) h += '<div class="detail-item"><span class="detail-label">Получатель</span><span class="detail-value">' + esc(o.receiver_name) + '</span></div>';
      if (o.receiver_phone) h += '<div class="detail-item"><span class="detail-label">Тел. получателя</span><span class="detail-value">' + esc(o.receiver_phone) + '</span></div>';
      h += '<div class="detail-item"><span class="detail-label">Способ</span><span class="detail-value">' + (o.delivery_type === 'pickup' ? 'Самовывоз' : 'Доставка') + '</span></div>';
      if (o.delivery_type !== 'pickup') {
        h += '<div class="detail-item"><span class="detail-label">Зона</span><span class="detail-value">' + esc(o.delivery_zone) + '</span></div>';
        h += '<div class="detail-item"><span class="detail-label">Адрес</span><span class="detail-value">' + esc(o.delivery_address) + '</span></div>';
        if (o.delivery_date) h += '<div class="detail-item"><span class="detail-label">Дата доставки</span><span class="detail-value">' + esc(o.delivery_date) + '</span></div>';
        h += '<div class="detail-item"><span class="detail-label">Интервал</span><span class="detail-value">' + esc(o.delivery_interval || '—') + '</span></div>';
        if (o.exact_time) h += '<div class="detail-item"><span class="detail-label">Точное время</span><span class="detail-value">' + esc(o.exact_time) + '</span></div>';
        h += '<div class="detail-item"><span class="detail-label">Доставка</span><span class="detail-value">' + fmtPrice(o.delivery_cost) + '</span></div>';
      }
      h += '<div class="detail-item"><span class="detail-label">Итого</span><span class="detail-value"><strong>' + fmtPrice(o.total_amount) + '</strong></span></div>';
      h += '<div class="detail-item"><span class="detail-label">Оплата</span><span class="detail-value">' + (o.is_paid ? 'Оплачен ' + fmtDate(o.paid_at) : 'Не оплачен') + '</span></div>';
      if (o.comment) {
        h += '<div class="detail-item" style="grid-column:1/-1"><span class="detail-label">Комментарий</span><span class="detail-value">' + esc(o.comment) + '</span></div>';
      }
      h += '</div>';

      if (o.items && o.items.length) {
        h += '<div class="order-items-list">';
        h += '<div style="font-weight:600;margin-bottom:8px">Состав заказа</div>';
        o.items.forEach(function (i) {
          h += '<div class="order-item-row">' +
            '<span>' + esc(i.product_name || 'Товар') + (i.flower_count ? ' (' + i.flower_count + ' цветов)' : '') + ' x ' + i.quantity + '</span>' +
            '<span><strong>' + fmtPrice(i.price * i.quantity) + '</strong></span>' +
          '</div>';
        });
        h += '</div>';
      }

      h += '<div style="border-top:1px solid var(--border);padding-top:20px;margin-top:20px">';
      h += '<div style="font-weight:600;margin-bottom:10px">Изменить статус</div>';
      h += '<div class="btn-group">';
      ORDER_STATUSES.forEach(function (s) {
        var cls = s === o.status ? 'btn btn-sm btn-primary' : 'btn btn-sm';
        h += '<button class="' + cls + '" onclick="changeOrderStatus(' + o.id + ',\'' + esc(s) + '\')">' + esc(s) + '</button>';
      });
      h += '</div></div>';

      h += '</div>';
      el.innerHTML = h;
    });
  };

  window.changeOrderStatus = function (id, status) {
    api('POST', '/api/admin/orders/' + id + '/status', { status: status }).then(function () {
      adminToast('Статус обновлен', 'success');
      viewOrder(id);
    });
  };

  // ============================================================
  // Products
  // ============================================================

  var editingProduct = null;

  function loadProducts() {
    Promise.all([
      api('GET', '/api/admin/products'),
      api('GET', '/api/admin/categories')
    ]).then(function (res) {
      var products = res[0];
      var categories = res[1];
      window._adminCategories = categories;

      var el = document.getElementById('tab-content');
      var h = '<div class="card">';
      h += '<div class="card-header"><span class="card-title">Все товары (' + products.length + ')</span>' +
        '<button class="btn btn-primary btn-sm" onclick="showProductForm(null)">Добавить</button></div>';

      h += '<div id="product-modal-area"></div>';

      if (!products.length) {
        h += '<div class="empty-state">Товаров нет. Добавьте первый товар.</div>';
      } else {
        h += '<table class="data-table"><thead><tr>' +
          '<th></th><th>Название</th><th>Категория</th><th>Цена</th><th></th>' +
          '</tr></thead><tbody>';

        products.forEach(function (p) {
          var imgCount = p.images ? p.images.length : (p.image_url ? 1 : 0);
          h += '<tr>' +
            '<td>' + productThumb(p.image_url) + (imgCount > 1 ? '<span style="font-size:10px;color:var(--text-secondary);display:block;text-align:center">+' + (imgCount - 1) + '</span>' : '') + '</td>' +
            '<td><strong>' + esc(p.name) + '</strong>' + (p.is_bouquet ? '<div style="font-size:10px;color:var(--text-secondary)">' + p.flower_min + '-' + p.flower_max + ' цв., шаг ' + p.flower_step + ', +' + fmtPrice(p.price_per_flower) + '/шт</div>' : '') + '</td>' +
            '<td><span style="color:var(--text-secondary)">' + esc(p.category_name) + '</span></td>' +
            '<td>' + fmtPrice(p.price) + (p.is_bouquet ? '<div style="font-size:10px;color:var(--text-secondary)">от ' + p.flower_min + ' цв.</div>' : '') + '</td>' +
            '<td><div class="btn-group">' +
              '<button class="btn btn-sm" onclick="showProductForm(' + p.id + ')">Изменить</button>' +
              '<button class="btn btn-sm btn-danger" onclick="deleteProduct(' + p.id + ')">Удалить</button>' +
            '</div></td>' +
          '</tr>';
        });

        h += '</tbody></table>';
      }
      h += '</div>';
      el.innerHTML = h;
    });
  }

  window.showProductForm = function (productId) {
    editingProduct = productId;
    var categories = window._adminCategories || [];
    var catOptions = categories.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    }).join('');

    if (productId) {
      api('GET', '/api/admin/products').then(function (products) {
        var p = products.find(function (x) { return x.id === productId; });
        if (p) renderProductModal(p, catOptions);
      });
    } else {
      renderProductModal(null, catOptions);
    }
  };

  function renderProductModal(product, catOptions) {
    var p = product || {};
    var title = product ? 'Редактировать товар' : 'Новый товар';
    var modal = document.getElementById('product-modal-area');
    if (!modal) return;

    var existingImgs = '';
    if (p.images && p.images.length) {
      existingImgs = '<div class="pf-images-list">';
      p.images.forEach(function (img) {
        existingImgs += '<div class="pf-img-item" id="pf-img-' + img.id + '">' +
          '<img src="' + esc(img.image_url) + '" class="pf-img-thumb">' +
          (img.id ? '<button type="button" class="pf-img-del" onclick="deleteProductImage(' + img.id + ')">X</button>' : '') +
        '</div>';
      });
      existingImgs += '</div>';
    }

    modal.innerHTML =
      '<div class="modal-overlay" onclick="closeProductModal(event)">' +
        '<div class="modal-card" onclick="event.stopPropagation()">' +
          '<div class="modal-title">' + title + '</div>' +
          '<form onsubmit="saveProduct(event)">' +
            '<div class="form-group">' +
              '<label class="form-label">Название</label>' +
              '<input type="text" class="form-input" id="pf-name" value="' + esc(p.name || '') + '" required>' +
            '</div>' +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label class="form-label">Категория</label>' +
                '<select class="form-select" id="pf-category">' + catOptions + '</select>' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label">Цена (руб.)</label>' +
                '<input type="number" class="form-input" id="pf-price" value="' + (p.price || '') + '" required>' +
              '</div>' +
            '</div>' +
            '<div class="form-row" style="align-items:flex-end">' +
              '<div class="form-group" style="flex:1">' +
                '<label class="form-label">Цена за шт. (руб.)</label>' +
                '<input type="number" class="form-input" id="pf-ppf" value="' + (p.price_per_flower || '') + '" min="0" placeholder="напр. 150"' + (!(p.is_bouquet && p.price_per_flower) ? ' disabled style="opacity:0.4"' : '') + '>' +
              '</div>' +
              '<div style="padding-bottom:6px">' +
                '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;font-size:13px">' +
                  '<input type="checkbox" id="pf-ppf-enabled"' + (p.is_bouquet && p.price_per_flower ? ' checked' : '') + ' onchange="togglePpfField()" style="width:16px;height:16px"> Применить' +
                '</label>' +
              '</div>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">Описание</label>' +
              '<textarea class="form-textarea" id="pf-desc">' + esc(p.description || '') + '</textarea>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">Фотографии</label>' +
              existingImgs +
              '<input type="file" class="form-input" id="pf-images" accept="image/*" multiple>' +
              '<div style="margin-top:4px;font-size:12px;color:var(--text-secondary)">Можно выбрать несколько файлов. Первое фото будет обложкой.</div>' +
            '</div>' +
            '<div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px" id="pf-bouquet-section">' +
              '<div style="font-weight:600;margin-bottom:10px">Выбор количества (клиент выбирает на карточке)</div>' +
              '<div class="form-group">' +
                '<label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
                  '<input type="checkbox" id="pf-is-bouquet"' + (p.is_bouquet ? ' checked' : '') + ' onchange="toggleBouquetFields()" style="width:18px;height:18px"> Включить выбор количества для этой позиции' +
                '</label>' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Если включено, клиент сможет выбрать количество цветов/единиц прямо на карточке товара перед добавлением в корзину.</div>' +
              '</div>' +
              '<div id="pf-bouquet-fields" style="' + (p.is_bouquet ? '' : 'display:none') + '">' +
                '<div class="form-row">' +
                  '<div class="form-group">' +
                    '<label class="form-label">Минимум (шт.)</label>' +
                    '<input type="number" class="form-input" id="pf-flower-min" value="' + (p.flower_min || 1) + '" min="1" placeholder="напр. 5">' +
                    '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">С какого количества начинается выбор</div>' +
                  '</div>' +
                  '<div class="form-group">' +
                    '<label class="form-label">Максимум (шт.)</label>' +
                    '<input type="number" class="form-input" id="pf-flower-max" value="' + (p.flower_max || 1) + '" min="1" placeholder="напр. 51">' +
                    '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">Максимальное количество для выбора</div>' +
                  '</div>' +
                '</div>' +
                '<div class="form-group">' +
                  '<label class="form-label">Шаг</label>' +
                  '<input type="number" class="form-input" id="pf-flower-step" value="' + (p.flower_step || 1) + '" min="1" placeholder="напр. 1 или 2">' +
                  '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">На сколько штук увеличивается за раз (1 = по одному, 2 = через один и т.д.)</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="btn-group" style="margin-top:8px">' +
              '<button type="submit" class="btn btn-primary">Сохранить</button>' +
              '<button type="button" class="btn" onclick="closeProductModal()">Отмена</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    if (product) {
      var sel = document.getElementById('pf-category');
      if (sel) sel.value = p.category_id;
    }
  }

  window.toggleBouquetFields = function () {
    var chk = document.getElementById('pf-is-bouquet');
    var fields = document.getElementById('pf-bouquet-fields');
    if (chk && fields) {
      fields.style.display = chk.checked ? '' : 'none';
    }
  };

  window.togglePpfField = function () {
    var chk = document.getElementById('pf-ppf-enabled');
    var input = document.getElementById('pf-ppf');
    if (input) {
      input.disabled = !chk.checked;
      input.style.opacity = chk.checked ? '1' : '0.4';
      if (!chk.checked) input.value = '';
    }
  };

  window.closeProductModal = function (e) {
    if (e && e.target && !e.target.classList.contains('modal-overlay')) return;
    var area = document.getElementById('product-modal-area');
    if (area) area.innerHTML = '';
    editingProduct = null;
  };

  window.deleteProductImage = function (imgId) {
    if (!confirm('Удалить это фото?')) return;
    api('DELETE', '/api/admin/product-images/' + imgId).then(function () {
      var el = document.getElementById('pf-img-' + imgId);
      if (el) el.remove();
      adminToast('Фото удалено', 'success');
    });
  };

  window.saveProduct = function (e) {
    e.preventDefault();
    var fd = new FormData();
    fd.append('name', document.getElementById('pf-name').value);
    fd.append('category_id', document.getElementById('pf-category').value);
    fd.append('price', document.getElementById('pf-price').value);
    fd.append('description', document.getElementById('pf-desc').value);
    fd.append('is_bouquet', document.getElementById('pf-is-bouquet').checked ? '1' : '0');
    fd.append('flower_min', document.getElementById('pf-flower-min').value || '0');
    fd.append('flower_max', document.getElementById('pf-flower-max').value || '0');
    fd.append('flower_step', document.getElementById('pf-flower-step').value || '1');
    fd.append('price_per_flower', document.getElementById('pf-ppf').value || '0');
    var fileInput = document.getElementById('pf-images');
    if (fileInput && fileInput.files.length) {
      for (var i = 0; i < fileInput.files.length; i++) {
        fd.append('images', fileInput.files[i]);
      }
    }

    var url = editingProduct ? '/api/admin/products/' + editingProduct : '/api/admin/products';
    var method = editingProduct ? 'PUT' : 'POST';

    apiUpload(method, url, fd).then(function () {
      var msg = editingProduct ? 'Товар обновлен' : 'Товар добавлен';
      editingProduct = null;
      adminToast(msg, 'success');
      loadProducts();
    });
  };

  window.deleteProduct = function (id) {
    if (!confirm('Удалить этот товар?')) return;
    api('DELETE', '/api/admin/products/' + id).then(function () {
      adminToast('Товар удален', 'success');
      loadProducts();
    });
  };

  // ============================================================
  // Categories
  // ============================================================

  function loadCategories() {
    api('GET', '/api/admin/categories').then(function (cats) {
      var el = document.getElementById('tab-content');

      var h = '<div class="card">';
      h += '<div class="card-header"><span class="card-title">Категории (' + cats.length + ')</span></div>';

      h += '<form onsubmit="addCategory(event)" style="display:flex;gap:10px;margin-bottom:20px">' +
        '<input type="text" class="form-input" id="new-cat-name" placeholder="Название новой категории" required style="flex:1">' +
        '<button type="submit" class="btn btn-primary">Добавить</button>' +
      '</form>';

      if (!cats.length) {
        h += '<div class="empty-state">Категорий нет</div>';
      } else {
        h += '<table class="data-table"><thead><tr>' +
          '<th>ID</th><th>Название</th><th></th>' +
        '</tr></thead><tbody>';

        cats.forEach(function (c) {
          h += '<tr>' +
            '<td>' + c.id + '</td>' +
            '<td id="cat-name-' + c.id + '">' + esc(c.name) + '</td>' +
            '<td><div class="btn-group">' +
              '<button class="btn btn-sm" onclick="editCategory(' + c.id + ')">Изменить</button>' +
              '<button class="btn btn-sm btn-danger" onclick="deleteCategory(' + c.id + ')">Удалить</button>' +
            '</div></td>' +
          '</tr>';
        });

        h += '</tbody></table>';
      }

      h += '</div>';
      el.innerHTML = h;
    });
  }

  window.addCategory = function (e) {
    e.preventDefault();
    var name = document.getElementById('new-cat-name').value;
    api('POST', '/api/admin/categories', { name: name }).then(function () {
      adminToast('Категория добавлена', 'success');
      loadCategories();
    });
  };

  window.editCategory = function (id) {
    var td = document.getElementById('cat-name-' + id);
    if (!td) return;
    var current = td.textContent;
    var newName = prompt('Новое название категории:', current);
    if (newName && newName !== current) {
      api('PUT', '/api/admin/categories/' + id, { name: newName }).then(function () {
        adminToast('Категория обновлена', 'success');
        loadCategories();
      });
    }
  };

  window.deleteCategory = function (id) {
    if (!confirm('Удалить категорию? Если в ней есть товары, удаление невозможно.')) return;
    api('DELETE', '/api/admin/categories/' + id).then(function (r) {
      if (r.error) {
        adminToast(r.error, 'error');
      } else {
        adminToast('Категория удалена', 'success');
        loadCategories();
      }
    });
  };

  // ============================================================
  // Settings
  // ============================================================

  function loadSettings() {
    api('GET', '/api/admin/settings').then(function (s) {
      var el = document.getElementById('tab-content');
      var h = '<form onsubmit="saveSettings(event)">';

      h += '<div class="card"><div class="settings-section">';
      h += '<div class="settings-section-title">Стоимость доставки по районам</div>';
      h += '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">г. Саратов (Ленинский, Кировский, Фрунзенский, Заводской, Волжский, Октябрьский р-ны)</label>' +
        '<input type="number" class="form-input" id="s-zone-saratov" value="' + esc(s.delivery_zone_saratov || s.delivery_saratov_base || '350') + '"></div>' +
        '<div class="form-group"><label class="form-label">г. Энгельс</label>' +
        '<input type="number" class="form-input" id="s-zone-engels" value="' + esc(s.delivery_zone_engels || s.delivery_engels_base || '450') + '"></div>' +
      '</div>';
      h += '<div class="form-group"><label class="form-label">Окрестности г. Саратова и Энгельса (в т.ч. Гагаринский р-н)</label>' +
        '<input type="number" class="form-input" id="s-zone-remote" value="' + esc(s.delivery_zone_remote || s.delivery_remote || '1000') + '" style="max-width:200px"></div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Стоимость доставки по дням</div>';
      h += '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Будние дни (руб.)</label>' +
        '<input type="number" class="form-input" id="s-delivery-regular" value="' + esc(s.delivery_regular || '500') + '"></div>' +
        '<div class="form-group"><label class="form-label">Праздничные дни (руб.)</label>' +
        '<input type="number" class="form-input" id="s-delivery-holiday" value="' + esc(s.delivery_holiday || '1000') + '"></div>' +
      '</div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Праздничные дни: 8 марта, 14 февраля, День матери и т.п. В праздники созвониться и узнать адрес у получателя, время доставки.</div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Точное время доставки</div>';
      h += '<div class="form-group"><label class="form-label">Доплата за точное время (руб.)</label>' +
        '<input type="number" class="form-input" id="s-exact-surcharge" value="' + esc(s.exact_time_surcharge || '1000') + '" style="max-width:200px"></div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">При оформлении заказа клиент может выбрать «Точно ко времени» вместо интервала. Стоимость доставки автоматически заменяется на сумму выше. Доставка невозможна, если до указанного времени менее 1,5 часа.</div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Самовывоз</div>';
      h += '<div class="form-group"><label class="form-label">Адрес самовывоза</label>' +
        '<input type="text" class="form-input" id="s-pickup" value="' + esc(s.pickup_address || '') + '"></div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Время и интервалы</div>';
      h += '<div class="form-group"><label class="form-label">Вечерний порог (после какого часа вечерний интервал недоступен сегодня)</label>' +
        '<input type="number" class="form-input" id="s-cutoff" value="' + esc(s.cutoff_hour || '19') + '" style="max-width:120px"></div>';
      h += '<div class="form-group"><label class="form-label">Обычные интервалы (JSON)</label>' +
        '<textarea class="form-textarea" id="s-intervals-regular">' + esc(s.intervals_regular || '[]') + '</textarea></div>';
      h += '<div class="form-group"><label class="form-label">Праздничные интервалы (JSON)</label>' +
        '<textarea class="form-textarea" id="s-intervals-holiday">' + esc(s.intervals_holiday || '[]') + '</textarea></div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Праздничные даты</div>';
      h += '<div class="form-group"><label class="form-label">Даты (JSON, формат ММ-ДД, напр. ["02-14","03-08","11-26"])</label>' +
        '<textarea class="form-textarea" id="s-holidays">' + esc(s.holiday_dates || '[]') + '</textarea></div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">02-14 = 14 февраля, 03-08 = 8 марта, 11-26 = День матери. Добавляйте/убирайте даты по необходимости.</div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Информация о доставке</div>';
      h += '<div class="form-group"><label class="form-label">Текст для клиентов (отображается в приложении)</label>' +
        '<textarea class="form-textarea" id="s-delivery-info" rows="4">' + esc(s.delivery_info || '') + '</textarea></div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Соцсети</div>';
      h += '<div class="form-group"><label class="form-label">Telegram</label>' +
        '<input type="text" class="form-input" id="s-social-tg" value="' + esc(s.social_telegram || '') + '"></div>';
      h += '<div class="form-group"><label class="form-label">Instagram</label>' +
        '<input type="text" class="form-input" id="s-social-ig" value="' + esc(s.social_instagram || '') + '"></div>';
      h += '<div class="form-group"><label class="form-label">ВКонтакте</label>' +
        '<input type="text" class="form-input" id="s-social-vk" value="' + esc(s.social_vk || '') + '"></div>';
      h += '</div>';

      h += '<button type="submit" class="btn btn-success" style="margin-top:8px">Сохранить настройки</button>';
      h += '</div></form>';

      el.innerHTML = h;
    });
  }

  window.saveSettings = function (e) {
    e.preventDefault();
    var saratov = document.getElementById('s-zone-saratov').value;
    var engels = document.getElementById('s-zone-engels').value;
    var remote = document.getElementById('s-zone-remote').value;

    var data = {
      delivery_zone_saratov: saratov,
      delivery_zone_engels: engels,
      delivery_zone_remote: remote,
      delivery_saratov_base: saratov,
      delivery_engels_base: engels,
      delivery_remote: remote,
      delivery_regular: document.getElementById('s-delivery-regular').value,
      delivery_holiday: document.getElementById('s-delivery-holiday').value,
      pickup_address: document.getElementById('s-pickup').value,
      cutoff_hour: document.getElementById('s-cutoff').value,
      intervals_regular: document.getElementById('s-intervals-regular').value,
      intervals_holiday: document.getElementById('s-intervals-holiday').value,
      holiday_dates: document.getElementById('s-holidays').value,
      exact_time_surcharge: document.getElementById('s-exact-surcharge').value,
      delivery_info: document.getElementById('s-delivery-info').value,
      social_telegram: document.getElementById('s-social-tg').value,
      social_instagram: document.getElementById('s-social-ig').value,
      social_vk: document.getElementById('s-social-vk').value
    };

    api('POST', '/api/admin/settings', data).then(function () {
      adminToast('Настройки сохранены', 'success');
    });
  };

  // ============================================================
  // Search
  // ============================================================

  var searchCat = 'all';
  var searchCache = { products: [], orders: [], categories: [], settings: [] };
  var searchBlurTimer = null;

  var SETTINGS_MAP = [
    { key: 'delivery_zone_saratov', label: 'Стоимость доставки — Саратов', section: 'Стоимость доставки по районам' },
    { key: 'delivery_zone_engels', label: 'Стоимость доставки — Энгельс', section: 'Стоимость доставки по районам' },
    { key: 'delivery_zone_remote', label: 'Стоимость доставки — Окрестности', section: 'Стоимость доставки по районам' },
    { key: 'delivery_regular', label: 'Доставка в будние дни', section: 'Стоимость доставки по дням' },
    { key: 'delivery_holiday', label: 'Доставка в праздничные дни', section: 'Стоимость доставки по дням' },
    { key: 'exact_time_surcharge', label: 'Доплата за точное время', section: 'Точное время доставки' },
    { key: 'pickup_address', label: 'Адрес самовывоза', section: 'Самовывоз' },
    { key: 'cutoff_hour', label: 'Вечерний порог (час)', section: 'Время и интервалы' },
    { key: 'intervals_regular', label: 'Обычные интервалы', section: 'Время и интервалы' },
    { key: 'intervals_holiday', label: 'Праздничные интервалы', section: 'Время и интервалы' },
    { key: 'holiday_dates', label: 'Праздничные даты', section: 'Праздничные даты' },
    { key: 'delivery_info', label: 'Информация о доставке', section: 'Информация о доставке' },
    { key: 'social_telegram', label: 'Telegram', section: 'Соцсети' },
    { key: 'social_instagram', label: 'Instagram', section: 'Соцсети' },
    { key: 'social_vk', label: 'ВКонтакте', section: 'Соцсети' }
  ];

  function refreshSearchCache() {
    if (!token) return;
    api('GET', '/api/admin/products').then(function (d) { searchCache.products = d || []; }).catch(function () {});
    api('GET', '/api/admin/orders').then(function (d) { searchCache.orders = d || []; }).catch(function () {});
    api('GET', '/api/admin/categories').then(function (d) { searchCache.categories = d || []; }).catch(function () {});
    searchCache.settings = SETTINGS_MAP;
  }

  window.setSearchCat = function (cat) {
    searchCat = cat;
    var btns = document.querySelectorAll('#admin-search-cats .search-cat');
    btns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-cat') === cat);
    });
    adminSearch();
  };

  window.adminSearchFocus = function () {
    var wrap = document.getElementById('admin-search-wrap');
    if (wrap) wrap.classList.add('focused');
    refreshSearchCache();
    var q = document.getElementById('admin-search-input').value.trim();
    if (q.length >= 1) adminSearch();
  };

  window.adminSearchBlur = function () {
    searchBlurTimer = setTimeout(function () {
      var wrap = document.getElementById('admin-search-wrap');
      if (wrap) wrap.classList.remove('focused');
      var res = document.getElementById('admin-search-results');
      if (res) res.style.display = 'none';
    }, 200);
  };

  window.adminSearch = function () {
    var input = document.getElementById('admin-search-input');
    var container = document.getElementById('admin-search-results');
    if (!input || !container) return;

    var q = input.value.trim().toLowerCase();
    if (q.length < 1) {
      container.style.display = 'none';
      return;
    }

    var html = '';
    var totalCount = 0;

    if (searchCat === 'all' || searchCat === 'products') {
      var prods = (searchCache.products || []).filter(function (p) {
        return (p.name && p.name.toLowerCase().indexOf(q) !== -1) ||
               (p.description && p.description.toLowerCase().indexOf(q) !== -1) ||
               (p.category_name && p.category_name.toLowerCase().indexOf(q) !== -1) ||
               (String(p.id) === q);
      });
      if (prods.length) {
        html += '<div class="search-result-group"><div class="search-group-title">Товары</div>';
        prods.slice(0, 8).forEach(function (p) {
          var icon = p.image_url
            ? '<img src="' + esc(p.image_url) + '" onerror="this.parentNode.textContent=\'P\'">'
            : 'P';
          html += '<div class="search-result-item" onmousedown="searchGoProduct(' + p.id + ')">' +
            '<div class="sr-icon">' + icon + '</div>' +
            '<div class="sr-text"><div class="sr-title">' + esc(p.name) + '</div>' +
              '<div class="sr-sub">' + esc(p.category_name || '') + '</div></div>' +
            '<div class="sr-badge">' + fmtPrice(p.price) + '</div>' +
          '</div>';
        });
        if (prods.length > 8) html += '<div class="search-result-item" style="justify-content:center;color:var(--text-secondary);font-size:12px">...и ещё ' + (prods.length - 8) + '</div>';
        html += '</div>';
        totalCount += prods.length;
      }
    }

    if (searchCat === 'all' || searchCat === 'orders') {
      var ords = (searchCache.orders || []).filter(function (o) {
        return (String(o.id) === q) ||
               (o.user_name && o.user_name.toLowerCase().indexOf(q) !== -1) ||
               (o.user_phone && o.user_phone.indexOf(q) !== -1) ||
               (o.delivery_address && o.delivery_address.toLowerCase().indexOf(q) !== -1) ||
               (o.status && o.status.toLowerCase().indexOf(q) !== -1) ||
               (o.receiver_name && o.receiver_name.toLowerCase().indexOf(q) !== -1);
      });
      if (ords.length) {
        html += '<div class="search-result-group"><div class="search-group-title">Заказы</div>';
        ords.slice(0, 6).forEach(function (o) {
          html += '<div class="search-result-item" onmousedown="searchGoOrder(' + o.id + ')">' +
            '<div class="sr-icon">#' + o.id + '</div>' +
            '<div class="sr-text"><div class="sr-title">' + esc(o.user_name) + '</div>' +
              '<div class="sr-sub">' + esc(o.user_phone) + ' ' + fmtDate(o.created_at) + '</div></div>' +
            '<div class="sr-badge">' + statusBadge(o.status) + '</div>' +
          '</div>';
        });
        if (ords.length > 6) html += '<div class="search-result-item" style="justify-content:center;color:var(--text-secondary);font-size:12px">...и ещё ' + (ords.length - 6) + '</div>';
        html += '</div>';
        totalCount += ords.length;
      }
    }

    if (searchCat === 'all' || searchCat === 'categories') {
      var cats = (searchCache.categories || []).filter(function (c) {
        return (c.name && c.name.toLowerCase().indexOf(q) !== -1) ||
               (String(c.id) === q);
      });
      if (cats.length) {
        html += '<div class="search-result-group"><div class="search-group-title">Категории</div>';
        cats.forEach(function (c) {
          html += '<div class="search-result-item" onmousedown="searchGoCategories()">' +
            '<div class="sr-icon">C</div>' +
            '<div class="sr-text"><div class="sr-title">' + esc(c.name) + '</div>' +
              '<div class="sr-sub">ID: ' + c.id + '</div></div>' +
          '</div>';
        });
        html += '</div>';
        totalCount += cats.length;
      }
    }

    if (searchCat === 'all' || searchCat === 'settings') {
      var sets = SETTINGS_MAP.filter(function (s) {
        return s.label.toLowerCase().indexOf(q) !== -1 ||
               s.section.toLowerCase().indexOf(q) !== -1 ||
               s.key.toLowerCase().indexOf(q) !== -1;
      });
      if (sets.length) {
        html += '<div class="search-result-group"><div class="search-group-title">Настройки</div>';
        sets.forEach(function (s) {
          html += '<div class="search-result-item" onmousedown="searchGoSettings(\'' + esc(s.key) + '\')">' +
            '<div class="sr-icon">S</div>' +
            '<div class="sr-text"><div class="sr-title">' + esc(s.label) + '</div>' +
              '<div class="sr-sub">' + esc(s.section) + '</div></div>' +
          '</div>';
        });
        html += '</div>';
        totalCount += sets.length;
      }
    }

    if (totalCount === 0) {
      html = '<div class="search-no-results">Ничего не найдено по запросу "' + esc(q) + '"</div>';
    }

    container.innerHTML = html;
    container.style.display = 'block';
  };

  window.searchGoProduct = function (id) {
    clearTimeout(searchBlurTimer);
    document.getElementById('admin-search-input').value = '';
    document.getElementById('admin-search-results').style.display = 'none';
    document.getElementById('admin-search-wrap').classList.remove('focused');
    currentTab = 'products';
    updateActiveTab();
    render('<div id="tab-content"><div class="empty-state">Загрузка...</div></div>');
    loadProducts();
    setTimeout(function () { showProductForm(id); }, 400);
  };

  window.searchGoOrder = function (id) {
    clearTimeout(searchBlurTimer);
    document.getElementById('admin-search-input').value = '';
    document.getElementById('admin-search-results').style.display = 'none';
    document.getElementById('admin-search-wrap').classList.remove('focused');
    currentTab = 'orders';
    updateActiveTab();
    render('<div id="tab-content"><div class="empty-state">Загрузка...</div></div>');
    viewOrder(id);
  };

  window.searchGoCategories = function () {
    clearTimeout(searchBlurTimer);
    document.getElementById('admin-search-input').value = '';
    document.getElementById('admin-search-results').style.display = 'none';
    document.getElementById('admin-search-wrap').classList.remove('focused');
    currentTab = 'categories';
    updateActiveTab();
    render('<div id="tab-content"><div class="empty-state">Загрузка...</div></div>');
    loadCategories();
  };

  window.searchGoSettings = function (key) {
    clearTimeout(searchBlurTimer);
    document.getElementById('admin-search-input').value = '';
    document.getElementById('admin-search-results').style.display = 'none';
    document.getElementById('admin-search-wrap').classList.remove('focused');
    currentTab = 'settings';
    updateActiveTab();
    render('<div id="tab-content"><div class="empty-state">Загрузка...</div></div>');
    loadSettings();
    setTimeout(function () {
      var el = document.getElementById('s-' + key.replace(/_/g, '-'));
      if (!el) {
        var map = {
          delivery_zone_saratov: 's-zone-saratov',
          delivery_zone_engels: 's-zone-engels',
          delivery_zone_remote: 's-zone-remote',
          exact_time_surcharge: 's-exact-surcharge',
          cutoff_hour: 's-cutoff',
          intervals_regular: 's-intervals-regular',
          intervals_holiday: 's-intervals-holiday',
          holiday_dates: 's-holidays',
          delivery_info: 's-delivery-info',
          social_telegram: 's-social-tg',
          social_instagram: 's-social-ig',
          social_vk: 's-social-vk',
          delivery_regular: 's-delivery-regular',
          delivery_holiday: 's-delivery-holiday',
          pickup_address: 's-pickup'
        };
        el = document.getElementById(map[key]);
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'box-shadow 0.3s';
        el.style.boxShadow = '0 0 0 3px rgba(26,26,46,0.2)';
        setTimeout(function () { el.style.boxShadow = ''; }, 2000);
        el.focus();
      }
    }, 500);
  };

  // ============================================================
  // Init
  // ============================================================

  function tryTelegramAutoLogin() {
    var params = new URLSearchParams(window.location.search);
    var tgAuth = params.get('tg_auth');
    if (!tgAuth) return false;
    fetch('/api/admin/telegram-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: tgAuth })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.token) {
        token = data.token;
        localStorage.setItem('arka_admin_token', token);
        window.history.replaceState({}, '', '/admin.html');
        showDashboard();
      } else {
        showLogin();
      }
    }).catch(function () {
      showLogin();
    });
    return true;
  }

  if (token) {
    api('GET', '/api/admin/orders').then(function () {
      showDashboard();
    }).catch(function () {
      if (!tryTelegramAutoLogin()) {
        showLogin();
      }
    });
  } else {
    if (!tryTelegramAutoLogin()) {
      showLogin();
    }
  }

})();
