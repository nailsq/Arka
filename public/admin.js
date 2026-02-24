(function () {
  // night-calendar-fix-marker
  'use strict';

  var app = document.getElementById('admin-app');
  var token = localStorage.getItem('arka_admin_token') || '';
  var currentTab = 'orders';
  var isSuperAdmin = false;
  var canDeleteOrders = false;
  var currentTelegramId = localStorage.getItem('arka_admin_tg_id') || '';

  var ORDER_STATUSES_DELIVERY = ['Новый', 'Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Доставлен', 'Выполнен'];
  var ORDER_STATUSES_PICKUP = ['Новый', 'Оплачен', 'Собирается', 'Готов к выдаче', 'Выполнен'];
  var ORDER_STATUSES = ['Новый', 'Оплачен', 'Собирается', 'Собран', 'Отправлен', 'Доставлен', 'Готов к выдаче', 'Выполнен'];

  var STATUS_BADGE = {
    'Новый': 'badge-new',
    'Оплачен': 'badge-paid',
    'Собирается': 'badge-preparing',
    'Собран': 'badge-ready',
    'Отправлен': 'badge-shipped',
    'Доставлен': 'badge-delivered',
    'Готов к выдаче': 'badge-pickup-ready',
    'Выполнен': 'badge-completed'
  };

  function getStatusesForOrder(order) {
    return order.delivery_type === 'pickup' ? ORDER_STATUSES_PICKUP : ORDER_STATUSES_DELIVERY;
  }

  // ============================================================
  // Helpers
  // ============================================================

  function parseApiResponse(r) {
    return r.text().then(function (txt) {
      var data = null;
      try { data = txt ? JSON.parse(txt) : {}; } catch (e) {}
      if (!r.ok) {
        var msg = (data && data.error) || (data && data.message) || txt || ('HTTP ' + r.status);
        throw new Error(msg);
      }
      if (data !== null) return data;
      throw new Error('Сервер вернул не JSON. Проверьте деплой и перезапуск сервера.');
    });
  }

  function api(method, url, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token, 'X-Telegram-Id': currentTelegramId }
    };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) {
        token = '';
        localStorage.removeItem('arka_admin_token');
        showLogin();
        throw new Error('Unauthorized');
      }
      return parseApiResponse(r);
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
      return parseApiResponse(r);
    });
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtPrice(p) {
    return Number(p).toLocaleString('ru-RU') + ' р.';
  }

  var SARATOV_TZ = 'Europe/Saratov';

  function fmtDate(d) {
    if (!d) return '—';
    var dt = new Date(d);
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: SARATOV_TZ,
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(dt);
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
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebar-overlay');
    sb.classList.toggle('open');
    if (ov) ov.classList.toggle('active', sb.classList.contains('open'));
  };

  window.closeSidebar = function () {
    document.getElementById('sidebar').classList.remove('open');
    var ov = document.getElementById('sidebar-overlay');
    if (ov) ov.classList.remove('active');
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

  var lastKnownOrderCount = -1;
  var notifyInterval = null;

  function showDashboard() {
    document.getElementById('logout-btn').style.display = 'block';
    document.getElementById('sidebar-nav').style.display = 'flex';
    var sidebarAdminsBtn = document.getElementById('sidebar-admins-btn');
    if (sidebarAdminsBtn) sidebarAdminsBtn.style.display = isSuperAdmin ? 'block' : 'none';
    var mobileAdminsBtn = document.getElementById('mobile-admins-btn');
    if (mobileAdminsBtn) mobileAdminsBtn.style.display = isSuperAdmin ? 'flex' : 'none';
    updateActiveTab();
    render('<div id="tab-content"><div class="empty-state">Загрузка...</div></div>');
    loadTab();
    (function checkDeepLink() {
      var params = new URLSearchParams(window.location.search);
      var orderId = params.get('order');
      if (orderId) {
        setTimeout(function () { viewOrder(parseInt(orderId)); }, 600);
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
    startOrderPolling();
  }

  function startOrderPolling() {
    if (notifyInterval) clearInterval(notifyInterval);
    checkNewOrders();
    notifyInterval = setInterval(checkNewOrders, 15000);
  }

  function checkNewOrders() {
    if (!token) return;
    api('GET', '/api/admin/orders?status=Новый').then(function (orders) {
      var count = orders ? orders.length : 0;
      var ordersLink = document.querySelector('.sidebar-link[data-tab="orders"]');
      if (ordersLink) {
        var badge = ordersLink.querySelector('.order-notify-badge');
        if (count > 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'order-notify-badge';
            ordersLink.appendChild(badge);
          }
          badge.textContent = count;
        } else if (badge) {
          badge.remove();
        }
      }
      var mobileOrderBtn = document.querySelector('.mobile-nav-btn[data-tab="orders"]');
      if (mobileOrderBtn) {
        var mBadge = mobileOrderBtn.querySelector('.mobile-nav-badge');
        if (count > 0) {
          if (!mBadge) {
            mBadge = document.createElement('span');
            mBadge.className = 'mobile-nav-badge';
            mobileOrderBtn.appendChild(mBadge);
          }
          mBadge.textContent = count;
        } else if (mBadge) {
          mBadge.remove();
        }
      }
      if (lastKnownOrderCount >= 0 && count > lastKnownOrderCount) {
        adminToast('Новый заказ!', 'success');
        if (currentTab === 'orders') loadOrders();
      }
      lastKnownOrderCount = count;
      updateActiveTab();
    }).catch(function () {});
  }

  function updateActiveTab() {
    var links = document.querySelectorAll('.sidebar-link');
    links.forEach(function (l) {
      l.classList.toggle('active', l.getAttribute('data-tab') === currentTab);
    });
    var mobileLinks = document.querySelectorAll('.mobile-nav-btn[data-tab]');
    mobileLinks.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === currentTab);
    });
    var titles = {
      orders: 'Заказы',
      completed: 'Завершённые заказы',
      products: 'Товары',
      categories: 'Категории',
      settings: 'Настройки',
      admins: 'Администраторы'
    };
    var titleEl = document.getElementById('topbar-title');
    var titleText = titles[currentTab] || 'Панель управления';
    if (currentTab === 'orders' && lastKnownOrderCount > 0) {
      titleEl.innerHTML = titleText + ' <span class="topbar-new-badge">' + lastKnownOrderCount + ' новых</span>';
    } else {
      titleEl.textContent = titleText;
    }
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
      case 'completed': loadCompletedOrders(); break;
      case 'products': loadProducts(); break;
      case 'categories': loadCategories(); break;
      case 'settings': loadSettings(); break;
      case 'admins': loadAdmins(); break;
    }
  }

  // ============================================================
  // Orders
  // ============================================================

  var orderFilter = '';
  var orderSearch = '';

  function renderOrderCard(o) {
    var statuses = getStatusesForOrder(o);
    var statusBtns = '<div class="order-card-statuses" onclick="event.stopPropagation()">';
    statuses.forEach(function (s) {
      var cls = s === o.status ? 'order-status-btn active' : 'order-status-btn';
      statusBtns += '<button class="' + cls + '" onclick="changeOrderStatus(' + o.id + ',\'' + esc(s) + '\')">' + esc(s) + '</button>';
    });
    statusBtns += '</div>';

    var done = (o.status === 'Доставлен' || o.status === 'Готов к выдаче' || o.status === 'Выполнен');
    return '<div class="order-card' + (done ? ' order-card--done' : '') + '" onclick="viewOrder(' + o.id + ')">' +
      '<div class="order-card-top">' +
        '<span class="order-card-id">#' + o.id + '</span>' +
        statusBadge(o.status) +
      '</div>' +
      '<div class="order-card-client">' + esc(o.user_name) + '</div>' +
      '<div class="order-card-phone" onclick="event.stopPropagation()"><a href="tel:' + esc(o.user_phone) + '" style="color:inherit;text-decoration:underline">' + esc(o.user_phone) + '</a></div>' +
      '<div class="order-card-bottom">' +
        '<span class="order-card-price">' + fmtPrice(o.total_amount) + '</span>' +
        '<span class="order-card-date">' + fmtDate(o.created_at) + '</span>' +
      '</div>' +
      statusBtns +
    '</div>';
  }

  var _allOrders = [];

  function normalizePhone(ph) {
    var digits = (ph || '').replace(/\D/g, '');
    if (digits.length >= 11 && digits[0] === '8') digits = '7' + digits.slice(1);
    if (digits.length >= 11 && digits[0] === '7') return digits;
    return digits;
  }

  function matchesSearch(order, q) {
    if (!q) return true;
    if (String(order.id).indexOf(q) >= 0) return true;
    var qDigits = q.replace(/\D/g, '');
    if (qDigits) {
      var qNorm = qDigits;
      if (qNorm.length >= 1 && qNorm[0] === '8') qNorm = '7' + qNorm.slice(1);
      if (normalizePhone(order.user_phone).indexOf(qNorm) >= 0) return true;
      if (normalizePhone(order.receiver_phone).indexOf(qNorm) >= 0) return true;
    }
    return false;
  }

  function loadOrders() {
    api('GET', '/api/admin/orders').then(function (orders) {
      _allOrders = orders;
      renderOrdersList();
    });
  }

  function renderOrdersList() {
    var el = document.getElementById('tab-content');

    var filtered = _allOrders.filter(function (o) { return !isOrderCompleted(o); });
    if (orderFilter) {
      filtered = filtered.filter(function (o) { return o.status === orderFilter; });
    }
    if (orderSearch) {
      filtered = filtered.filter(function (o) { return matchesSearch(o, orderSearch); });
    }

    var h = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">' +
      '<input type="text" class="form-input" id="order-search-input" placeholder="Поиск по № заказа или телефону" value="' + esc(orderSearch) + '" style="max-width:300px;margin:0" oninput="liveSearchOrders()">' +
      (orderSearch ? '<button class="btn btn-sm" onclick="clearOrderSearch()" style="min-width:32px">✕</button>' : '') +
      '</div>';

    h += '<div class="filter-bar">';
    h += '<button class="filter-chip' + (!orderFilter ? ' active' : '') + '" onclick="filterOrders(\'\')">Все</button>';
    ORDER_STATUSES.forEach(function (s) {
      if (s === 'Выполнен') return;
      h += '<button class="filter-chip' + (orderFilter === s ? ' active' : '') + '" onclick="filterOrders(\'' + esc(s) + '\')">' + esc(s) + '</button>';
    });
    h += '</div>';

    h += '<div id="orders-list-area">';
    h += buildOrdersColumns(filtered);
    h += '</div>';

    el.innerHTML = h;
  }

  function isOrderDone(o) {
    return o.status === 'Доставлен' || o.status === 'Готов к выдаче';
  }

  function isOrderCompleted(o) {
    return o.status === 'Выполнен';
  }

  function sortOrdersDoneToBottom(list) {
    var active = [];
    var done = [];
    list.forEach(function (o) {
      if (isOrderDone(o)) done.push(o); else active.push(o);
    });
    return active.concat(done);
  }

  function buildOrdersColumns(orders) {
    if (!orders.length) return '<div class="empty-state">Заказов не найдено</div>';

    var delivery = sortOrdersDoneToBottom(orders.filter(function (o) { return o.delivery_type !== 'pickup'; }));
    var pickup = sortOrdersDoneToBottom(orders.filter(function (o) { return o.delivery_type === 'pickup'; }));

    var h = '<div class="orders-columns">';
    h += '<div class="orders-col">';
    h += '<div class="orders-col-title">Доставка <span class="orders-col-count">' + delivery.length + '</span></div>';
    if (delivery.length) {
      delivery.forEach(function (o) { h += renderOrderCard(o); });
    } else {
      h += '<div class="empty-state" style="padding:20px">Нет заказов</div>';
    }
    h += '</div>';
    h += '<div class="orders-col">';
    h += '<div class="orders-col-title">Самовывоз <span class="orders-col-count">' + pickup.length + '</span></div>';
    if (pickup.length) {
      pickup.forEach(function (o) { h += renderOrderCard(o); });
    } else {
      h += '<div class="empty-state" style="padding:20px">Нет заказов</div>';
    }
    h += '</div>';
    h += '</div>';
    return h;
  }

  function filterOrdersInPlace() {
    var filtered = _allOrders.filter(function (o) { return !isOrderCompleted(o); });
    if (orderFilter) {
      filtered = filtered.filter(function (o) { return o.status === orderFilter; });
    }
    if (orderSearch) {
      filtered = filtered.filter(function (o) { return matchesSearch(o, orderSearch); });
    }
    var area = document.getElementById('orders-list-area');
    if (area) area.innerHTML = buildOrdersColumns(filtered);
  }

  window.filterOrders = function (status) {
    orderFilter = status;
    renderOrdersList();
  };

  window.liveSearchOrders = function () {
    var inp = document.getElementById('order-search-input');
    orderSearch = inp ? inp.value.trim() : '';
    filterOrdersInPlace();
  };

  window.clearOrderSearch = function () {
    orderSearch = '';
    renderOrdersList();
  };

  window.backToOrders = function () {
    loadOrders();
  };

  function editableField(label, fieldName, value, type) {
    type = type || 'text';
    var displayVal = esc(value || '');
    var inputType = type === 'textarea' ? 'textarea' : 'input';
    var inputTag = inputType === 'textarea'
      ? '<textarea class="edit-field-input" data-field="' + fieldName + '" style="display:none">' + displayVal + '</textarea>'
      : '<input type="' + type + '" class="edit-field-input" data-field="' + fieldName + '" value="' + displayVal + '" style="display:none">';
    var spanClass = 'detail-value detail-value-editable';
    return '<div class="detail-item' + (type === 'textarea' ? '" style="grid-column:1/-1' : '') + '">' +
      '<span class="detail-label">' + label + '</span>' +
      '<span class="' + spanClass + '" data-display-for="' + fieldName + '" onclick="startEditField(this, \'' + fieldName + '\')">' + (displayVal || '—') + '</span>' +
      inputTag +
    '</div>';
  }

  function readonlyField(label, value, fullRow) {
    return '<div class="detail-item' + (fullRow ? '" style="grid-column:1/-1' : '') + '">' +
      '<span class="detail-label">' + label + '</span>' +
      '<span class="detail-value">' + value + '</span></div>';
  }

  window.startEditField = function (spanEl, fieldName) {
    var input = spanEl.parentElement.querySelector('.edit-field-input[data-field="' + fieldName + '"]');
    if (!input) return;
    spanEl.style.display = 'none';
    input.style.display = '';
    input.focus();
    var saveBtn = document.getElementById('order-save-btn');
    if (saveBtn) saveBtn.style.display = '';
  };

  window.saveOrderFields = function (orderId) {
    var inputs = document.querySelectorAll('.edit-field-input');
    var body = {};
    var changed = false;
    inputs.forEach(function (inp) {
      if (inp.style.display !== 'none') {
        body[inp.getAttribute('data-field')] = inp.value;
        changed = true;
      }
    });
    if (!changed) { adminToast('Нет изменений', 'info'); return; }
    api('PUT', '/api/admin/orders/' + orderId, body).then(function () {
      adminToast('Сохранено', 'success');
      viewOrder(orderId);
    });
  };

  window.viewOrder = function (id) {
    api('GET', '/api/admin/orders').then(function (orders) {
      var o = orders.find(function (x) { return x.id === id; });
      if (!o) return;

      var el = document.getElementById('tab-content');
      var h = '<button class="btn btn-sm" onclick="backToOrders()" style="margin-bottom:20px">Назад к списку</button>';
      h += '<div class="card">';
      h += '<div class="card-header"><span class="card-title">Заказ N ' + o.id + '</span>' + statusBadge(o.status) + '</div>';

      h += '<div class="order-detail-grid">';
      h += readonlyField('Дата', fmtDate(o.created_at));
      h += editableField('Клиент', 'user_name', o.user_name);
      h += editableField('Телефон', 'user_phone', o.user_phone, 'tel');
      h += editableField('Telegram', 'user_telegram', o.user_telegram);
      h += editableField('Email', 'user_email', o.user_email, 'email');
      h += editableField('Получатель', 'receiver_name', o.receiver_name);
      h += editableField('Тел. получателя', 'receiver_phone', o.receiver_phone, 'tel');
      h += readonlyField('Способ', o.delivery_type === 'pickup' ? 'Самовывоз' : 'Доставка');
      if (o.delivery_type !== 'pickup') {
        h += editableField('Адрес', 'delivery_address', o.delivery_address);
        h += editableField('Дата доставки', 'delivery_date', o.delivery_date, 'date');
        h += editableField('Интервал', 'delivery_interval', o.delivery_interval);
        if (o.exact_time) h += editableField('Точное время', 'exact_time', o.exact_time);
        h += readonlyField('Доставка', fmtPrice(o.delivery_cost));
      } else {
        if (o.delivery_date) h += editableField('Дата готовности', 'delivery_date', o.delivery_date, 'date');
      }
      h += readonlyField('Итого', '<strong>' + fmtPrice(o.total_amount) + '</strong>');
      h += readonlyField('Оплата', o.is_paid ? 'Оплачен ' + fmtDate(o.paid_at) : 'Не оплачен');
      h += editableField('Комментарий', 'comment', o.comment, 'textarea');
      h += '</div>';

      h += '<button class="btn btn-primary" id="order-save-btn" style="display:none;margin-bottom:20px;width:100%" onclick="saveOrderFields(' + o.id + ')">Сохранить изменения</button>';

      if (o.items && o.items.length) {
        h += '<div class="order-items-list">';
        h += '<div style="font-weight:600;margin-bottom:8px">Состав заказа</div>';
        o.items.forEach(function (i) {
          var sizeTag = i.size_label ? ' [' + esc(i.size_label) + ']' : '';
          h += '<div class="order-item-row">' +
            '<span>' + esc(i.product_name || 'Товар') + sizeTag + ' x ' + i.quantity + '</span>' +
            '<span><strong>' + fmtPrice(i.price * i.quantity) + '</strong></span>' +
          '</div>';
        });
        h += '</div>';
      }

      h += '<div style="border-top:1px solid var(--border);padding-top:20px;margin-top:20px">';
      h += '<div style="font-weight:600;margin-bottom:10px">Изменить статус</div>';
      h += '<div class="btn-group">';
      var applicableStatuses = getStatusesForOrder(o);
      applicableStatuses.forEach(function (s) {
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
      adminToast('Статус: ' + status, 'success');
      var isDetailView = !!document.querySelector('.order-detail-grid');
      if (isDetailView) {
        viewOrder(id);
      } else if (currentTab === 'completed') {
        loadCompletedOrders();
      } else {
        for (var i = 0; i < _allOrders.length; i++) {
          if (_allOrders[i].id === id) { _allOrders[i].status = status; break; }
        }
        filterOrdersInPlace();
      }
    });
  };

  // ============================================================
  // ============================================================
  // Completed Orders
  // ============================================================

  function loadCompletedOrders() {
    api('GET', '/api/admin/orders').then(function (orders) {
      var completed = orders.filter(function (o) { return isOrderCompleted(o); });
      var el = document.getElementById('tab-content');

      if (!completed.length) {
        el.innerHTML = '<div class="empty-state">Завершённых заказов пока нет</div>';
        return;
      }

      var delivery = completed.filter(function (o) { return o.delivery_type !== 'pickup'; });
      var pickup = completed.filter(function (o) { return o.delivery_type === 'pickup'; });

      var h = '<div class="orders-columns"><div class="orders-col">';
      h += '<div class="orders-col-title">Доставка (' + delivery.length + ')</div>';
      if (delivery.length) {
        delivery.forEach(function (o) { h += renderOrderCard(o); });
      } else {
        h += '<div class="empty-state" style="font-size:13px">Нет</div>';
      }
      h += '</div><div class="orders-col">';
      h += '<div class="orders-col-title">Самовывоз (' + pickup.length + ')</div>';
      if (pickup.length) {
        pickup.forEach(function (o) { h += renderOrderCard(o); });
      } else {
        h += '<div class="empty-state" style="font-size:13px">Нет</div>';
      }
      h += '</div></div>';

      el.innerHTML = h;
    });
  }

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
        h += '<div class="table-scroll"><table class="data-table"><thead><tr>' +
          '<th></th><th>Название</th><th>Категория</th><th>Цена</th><th></th>' +
          '</tr></thead><tbody>';

        products.forEach(function (p) {
          var imgCount = p.images ? p.images.length : (p.image_url ? 1 : 0);
          var sizesInfo = '';
          if (p.sizes && p.sizes.length) {
            sizesInfo = '<div style="font-size:10px;color:var(--text-secondary)">' +
              p.sizes.map(function (s) { return s.label; }).join(', ') + '</div>';
          }
          var stockToggle = p.in_stock === 0
            ? '<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:#fff3cd;color:#856404;border-color:#ffe08a" onclick="toggleStock(' + p.id + ',1)">Скоро</button>'
            : '<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:#d4edda;color:#155724;border-color:#b1dfbb" onclick="toggleStock(' + p.id + ',0)">В наличии</button>';
          var hideToggle = p.hidden
            ? '<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:#e2e3e5;color:#383d41;border-color:#d6d8db" onclick="toggleHidden(' + p.id + ',0)">Скрыт</button>'
            : '<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:#cce5ff;color:#004085;border-color:#b8daff" onclick="toggleHidden(' + p.id + ',1)">Виден</button>';
          var recToggle = p.is_recommended
            ? '<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:#e8d5f5;color:#5b2d8e;border-color:#d4b3e8" onclick="toggleRecommended(' + p.id + ',0)">Доп ✓</button>'
            : '<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:#f5f5f5;color:#999;border-color:#e0e0e0" onclick="toggleRecommended(' + p.id + ',1)">Доп</button>';
          var rowStyle = p.hidden ? ' style="opacity:0.5"' : '';
          h += '<tr' + rowStyle + '>' +
            '<td>' + productThumb(p.image_url) + (imgCount > 1 ? '<span style="font-size:10px;color:var(--text-secondary);display:block;text-align:center">+' + (imgCount - 1) + '</span>' : '') + '</td>' +
            '<td><strong>' + esc(p.name) + '</strong>' + sizesInfo + '</td>' +
            '<td><span style="color:var(--text-secondary)">' + esc(p.category_name) + '</span></td>' +
            '<td>' + fmtPrice(p.price) + (p.sizes && p.sizes.length ? '<div style="font-size:10px;color:var(--text-secondary)">' + p.sizes.length + ' размер(ов)</div>' : '') + '</td>' +
            '<td><div class="btn-group">' +
              stockToggle +
              hideToggle +
              recToggle +
              '<button class="btn btn-sm" onclick="showProductForm(' + p.id + ')">Изменить</button>' +
              '<button class="btn btn-sm btn-danger" onclick="deleteProduct(' + p.id + ')">Удалить</button>' +
            '</div></td>' +
          '</tr>';
        });

        h += '</tbody></table></div>';
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

    var sizesHtml = '';
    if (product && p.sizes && p.sizes.length) {
      sizesHtml = p.sizes.map(function (s) {
        var preview = s.image_url
          ? '<div class="pf-size-image-preview" style="display:flex;align-items:center;gap:8px">' +
              '<img src="' + esc(s.image_url) + '" style="width:46px;height:46px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">' +
              '<button type="button" class="btn btn-sm" onclick="clearSizeImage(this)">Убрать</button>' +
            '</div>'
          : '<div class="pf-size-image-preview" style="font-size:12px;color:var(--text-secondary)">Нет фото размера</div>';
        return '<div class="pf-size-row" data-size-id="' + s.id + '">' +
          '<input type="text" class="form-input" style="width:60px" value="' + esc(s.label) + '" placeholder="M" data-field="label">' +
          '<input type="number" class="form-input" style="width:90px" value="' + s.price + '" placeholder="цена" data-field="price" min="0">' +
          '<input type="text" class="form-input" style="width:80px" value="' + esc(s.dimensions || '') + '" placeholder="см" data-field="dimensions">' +
          '<input type="hidden" data-field="image_url" value="' + esc(s.image_url || '') + '">' +
          '<input type="file" class="form-input" style="max-width:170px" accept="image/*" data-field="image_file" onchange="previewSizeImage(this)">' +
          preview +
          '<button type="button" class="btn btn-sm btn-danger" onclick="removeSizeRow(this)" style="flex-shrink:0">X</button>' +
        '</div>';
      }).join('');
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
                '<label class="form-label">Цена (базовая, руб.)</label>' +
                '<input type="number" class="form-input" id="pf-price" value="' + (p.price || '') + '" required>' +
              '</div>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">Наличие</label>' +
              '<select class="form-select" id="pf-in-stock">' +
                '<option value="1"' + (p.in_stock !== 0 ? ' selected' : '') + '>В наличии</option>' +
                '<option value="0"' + (p.in_stock === 0 ? ' selected' : '') + '>Скоро будет</option>' +
              '</select>' +
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
            '<div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px">' +
              '<div class="form-group">' +
                '<label class="form-label">Размер (см) — для товара без вариантов</label>' +
                '<input type="text" class="form-input" id="pf-dimensions" value="' + esc(p.dimensions || '') + '" placeholder="напр. 40×30 см" style="max-width:200px">' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Если у товара есть размеры ниже (S, M, L...), это поле можно оставить пустым.</div>' +
              '</div>' +
            '</div>' +
            '<div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px" id="pf-sizes-section">' +
              '<div style="font-weight:600;margin-bottom:6px">Размеры букета</div>' +
              '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Добавьте размеры (S, M, L, XL и т.д.) с ценой, размером в см и отдельным фото для каждого размера.</div>' +
              '<div id="pf-sizes-list">' + sizesHtml + '</div>' +
              '<button type="button" class="btn btn-sm" onclick="addSizeRow()" style="margin-top:8px">+ Добавить размер</button>' +
            '</div>' +
            '<div class="btn-group" style="margin-top:16px">' +
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

  window.addSizeRow = function () {
    var list = document.getElementById('pf-sizes-list');
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'pf-size-row';
    row.setAttribute('data-size-id', 'new');
    row.innerHTML =
      '<input type="text" class="form-input" style="width:60px" placeholder="M" data-field="label">' +
      '<input type="number" class="form-input" style="width:90px" placeholder="цена" data-field="price" min="0">' +
      '<input type="text" class="form-input" style="width:80px" placeholder="см" data-field="dimensions">' +
      '<input type="hidden" data-field="image_url" value="">' +
      '<input type="file" class="form-input" style="max-width:170px" accept="image/*" data-field="image_file" onchange="previewSizeImage(this)">' +
      '<div class="pf-size-image-preview" style="font-size:12px;color:var(--text-secondary)">Нет фото размера</div>' +
      '<button type="button" class="btn btn-sm btn-danger" onclick="removeSizeRow(this)" style="flex-shrink:0">X</button>';
    list.appendChild(row);
  };

  window.previewSizeImage = function (input) {
    if (!input) return;
    var row = input.closest('.pf-size-row');
    if (!row) return;
    var hidden = row.querySelector('[data-field="image_url"]');
    var preview = row.querySelector('.pf-size-image-preview');
    if (!hidden || !preview) return;
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var dataUrl = String(e.target.result || '');
      hidden.value = dataUrl;
      preview.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<img src="' + dataUrl + '" style="width:46px;height:46px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">' +
          '<button type="button" class="btn btn-sm" onclick="clearSizeImage(this)">Убрать</button>' +
        '</div>';
    };
    reader.readAsDataURL(input.files[0]);
  };

  window.clearSizeImage = function (btn) {
    var row = btn ? btn.closest('.pf-size-row') : null;
    if (!row) return;
    var hidden = row.querySelector('[data-field="image_url"]');
    if (hidden) hidden.value = '';
    var file = row.querySelector('[data-field="image_file"]');
    if (file) file.value = '';
    var preview = row.querySelector('.pf-size-image-preview');
    if (preview) preview.innerHTML = 'Нет фото размера';
  };

  window.removeSizeRow = function (btn) {
    var row = btn.closest('.pf-size-row');
    if (!row) return;
    var sizeId = row.getAttribute('data-size-id');
    if (sizeId && sizeId !== 'new') {
      api('DELETE', '/api/admin/product-sizes/' + sizeId).then(function () {
        row.remove();
        adminToast('Размер удалён', 'success');
      });
    } else {
      row.remove();
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
    var sizeRows = document.querySelectorAll('#pf-sizes-list .pf-size-row');
    var hasSizes = sizeRows.length > 0;

    var fd = new FormData();
    fd.append('name', document.getElementById('pf-name').value);
    fd.append('category_id', document.getElementById('pf-category').value);
    fd.append('price', document.getElementById('pf-price').value);
    fd.append('description', document.getElementById('pf-desc').value);
    fd.append('in_stock', document.getElementById('pf-in-stock').value);
    fd.append('dimensions', document.getElementById('pf-dimensions').value);
    fd.append('is_bouquet', hasSizes ? '1' : '0');
    fd.append('flower_min', '0');
    fd.append('flower_max', '0');
    fd.append('flower_step', '1');
    fd.append('price_per_flower', '0');
    var fileInput = document.getElementById('pf-images');
    if (fileInput && fileInput.files.length) {
      for (var i = 0; i < fileInput.files.length; i++) {
        fd.append('images', fileInput.files[i]);
      }
    }

    var url = editingProduct ? '/api/admin/products/' + editingProduct : '/api/admin/products';
    var method = editingProduct ? 'PUT' : 'POST';

    apiUpload(method, url, fd).then(function (result) {
      var productId = editingProduct || result.id;

      var sizeSavePromises = [];
      sizeRows.forEach(function (row, idx) {
        var sizeId = row.getAttribute('data-size-id');
        var label = row.querySelector('[data-field="label"]').value.trim();
        var price = row.querySelector('[data-field="price"]').value || '0';
        var dims = row.querySelector('[data-field="dimensions"]');
        var dimsVal = dims ? dims.value.trim() : '';
        var imageInput = row.querySelector('[data-field="image_url"]');
        var imageUrl = imageInput ? imageInput.value.trim() : '';
        if (!label) return;

        var sizeData = { product_id: productId, label: label, price: price, sort_order: idx, dimensions: dimsVal, image_url: imageUrl };
        if (sizeId && sizeId !== 'new') {
          sizeSavePromises.push(api('PUT', '/api/admin/product-sizes/' + sizeId, sizeData));
        } else {
          sizeSavePromises.push(api('POST', '/api/admin/product-sizes', sizeData));
        }
      });

      return Promise.all(sizeSavePromises).then(function () {
        var msg = editingProduct ? 'Товар обновлен' : 'Товар добавлен';
        editingProduct = null;
        adminToast(msg, 'success');
        loadProducts();
      });
    }).catch(function (err) {
      adminToast('Ошибка сохранения: ' + (err && err.message ? err.message : 'проверьте сервер'), 'error');
    });
  };

  window.deleteProduct = function (id) {
    if (!confirm('Удалить этот товар?')) return;
    api('DELETE', '/api/admin/products/' + id).then(function () {
      adminToast('Товар удален', 'success');
      loadProducts();
    });
  };

  window.toggleStock = function (id, newValue) {
    var fd = new FormData();
    fd.append('in_stock', String(newValue));
    apiUpload('PUT', '/api/admin/products/' + id, fd).then(function () {
      adminToast(newValue ? 'Товар в наличии' : 'Товар: скоро будет', 'success');
      loadProducts();
    });
  };

  window.toggleHidden = function (id, newValue) {
    var fd = new FormData();
    fd.append('hidden', String(newValue));
    apiUpload('PUT', '/api/admin/products/' + id, fd).then(function () {
      adminToast(newValue ? 'Товар скрыт из каталога' : 'Товар отображается в каталоге', 'success');
      loadProducts();
    });
  };

  window.toggleRecommended = function (id, newValue) {
    var fd = new FormData();
    fd.append('is_recommended', String(newValue));
    apiUpload('PUT', '/api/admin/products/' + id, fd).then(function () {
      adminToast(newValue ? 'Товар добавлен в допы к заказу' : 'Товар убран из допов', 'success');
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
        h += '<div class="table-scroll"><table class="data-table"><thead><tr>' +
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

        h += '</tbody></table></div>';
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
      h += '<div class="settings-section-title">Яндекс.Карты</div>';
      h += '<div class="form-group"><label class="form-label">API-ключ Яндекс.Карт</label>' +
        '<input type="text" class="form-input" id="s-yandex-key" value="' + esc(s.yandex_maps_key || '') + '" placeholder="Получить на developer.tech.yandex.ru"></div>';
      h += '<div class="form-group"><label class="form-label">Координаты магазина — Саратов (широта,долгота)</label>' +
        '<input type="text" class="form-input" id="s-shop-coords" value="' + esc(s.shop_coords || '51.533,46.034') + '" placeholder="51.533,46.034" style="max-width:250px"></div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Точка отсчёта для адресов в Саратове.</div>';
      h += '<div class="form-group"><label class="form-label">Координаты центра — Энгельс (широта,долгота)</label>' +
        '<input type="text" class="form-input" id="s-engels-coords" value="' + esc(s.engels_coords || '51.485,46.126') + '" placeholder="51.485,46.126" style="max-width:250px"></div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Точка отсчёта для адресов в Энгельсе. Расстояние считается от центра города.</div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Тарифы доставки — Саратов (от магазина)</div>';
      h += '<div id="s-tiers-list-saratov"></div>';
      h += '<button type="button" class="btn btn-sm" onclick="addDeliveryTier(\'saratov\')" style="margin-top:8px">+ Добавить зону</button>';
      h += '<input type="hidden" id="s-delivery-tiers">';
      h += '<div class="form-group" style="margin-top:12px"><label class="form-label">Макс. расстояние доставки (км)</label>' +
        '<input type="number" class="form-input" id="s-max-distance-saratov" value="' + esc(s.max_delivery_km_saratov || '30') + '" placeholder="30"></div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Тарифы доставки — Энгельс (от центра)</div>';
      h += '<div id="s-tiers-list-engels"></div>';
      h += '<button type="button" class="btn btn-sm" onclick="addDeliveryTier(\'engels\')" style="margin-top:8px">+ Добавить зону</button>';
      h += '<input type="hidden" id="s-delivery-tiers-engels">';
      h += '<div class="form-group" style="margin-top:12px"><label class="form-label">Макс. расстояние доставки (км)</label>' +
        '<input type="number" class="form-input" id="s-max-distance-engels" value="' + esc(s.max_delivery_km_engels || '30') + '" placeholder="30"></div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Ночная доставка — Саратов (от магазина)</div>';
      h += '<div id="s-tiers-list-night-saratov"></div>';
      h += '<button type="button" class="btn btn-sm" onclick="addDeliveryTier(\'night-saratov\')" style="margin-top:8px">+ Добавить зону</button>';
      h += '<input type="hidden" id="s-night-delivery-tiers">';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-top:8px">Тарифы ночной доставки по км от магазина. Если пусто — используются дневные тарифы.</div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Ночная доставка — Энгельс</div>';
      h += '<div id="s-tiers-list-night-engels"></div>';
      h += '<button type="button" class="btn btn-sm" onclick="addDeliveryTier(\'night-engels\')" style="margin-top:8px">+ Добавить зону</button>';
      h += '<input type="hidden" id="s-night-delivery-tiers-engels">';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-top:8px">Тарифы для ночной доставки. Если пусто — используются дневные тарифы.</div>';
      h += '</div>';

      h += '<input type="hidden" id="s-delivery-regular" value="' + esc(s.delivery_regular || '500') + '">';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Точное время доставки</div>';
      h += '<div class="form-group"><label class="form-label"><input type="checkbox" id="s-exact-enabled"' + (s.exact_time_enabled !== '0' ? ' checked' : '') + ' style="margin-right:6px">Включить опцию «Точно ко времени» для клиентов</label></div>';
      h += '<div class="form-group"><label class="form-label">Доплата за точное время (руб.)</label>' +
        '<input type="number" class="form-input" id="s-exact-surcharge" value="' + esc(s.exact_time_surcharge || '1000') + '" style="max-width:200px"></div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">При оформлении заказа клиент может выбрать «Точно ко времени» вместо интервала. Стоимость доставки автоматически заменяется на сумму выше.</div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Самовывоз</div>';
      h += '<div class="form-group"><label class="form-label">Адрес самовывоза</label>' +
        '<input type="text" class="form-input" id="s-pickup" value="' + esc(s.pickup_address || '') + '"></div>';
      h += '<div class="form-group"><label class="form-label">Порог самовывоза (после какого часа самовывоз на сегодня недоступен)</label>' +
        '<input type="number" class="form-input" id="s-pickup-cutoff" value="' + esc(s.pickup_cutoff_hour || '20') + '" style="max-width:120px"></div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Время и интервалы</div>';
      h += '<div class="form-group"><label class="form-label">Вечерний порог (после какого часа все интервалы на сегодня недоступны)</label>' +
        '<input type="number" class="form-input" id="s-cutoff" value="' + esc(s.cutoff_hour || '19') + '" style="max-width:120px"></div>';
      h += '<div class="form-group"><label class="form-label">Обычные интервалы — дневные</label>' +
        '<div id="s-intervals-list-regular-day"></div>' +
        '<button type="button" class="btn btn-sm" onclick="addInterval(\'regular-day\', false)" style="margin-top:8px">+ Добавить дневной</button></div>';
      h += '<div class="form-group"><label class="form-label" style="color:#65657a">Обычные интервалы — ночные <span style="font-size:11px;font-weight:400;color:var(--text-secondary)">(доставка переходит на следующий день)</span></label>' +
        '<div id="s-intervals-list-regular-night"></div>' +
        '<button type="button" class="btn btn-sm" onclick="addInterval(\'regular-night\', true)" style="margin-top:8px">+ Добавить ночной</button></div>';
      h += '<input type="hidden" id="s-intervals-regular">';
      h += '<input type="hidden" id="s-intervals-regular-day">';
      h += '<input type="hidden" id="s-intervals-regular-night">';

      h += '<input type="hidden" id="s-intervals-holiday" value="[]">';
      h += '<input type="hidden" id="s-intervals-holiday-day" value="[]">';
      h += '<input type="hidden" id="s-intervals-holiday-night" value="[]">';
      h += '<input type="hidden" id="s-holidays" value="[]">';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Информация о доставке</div>';
      h += '<div class="form-group"><label class="form-label">Текст для клиентов (отображается в приложении)</label>' +
        '<textarea class="form-textarea" id="s-delivery-info" rows="4">' + esc(s.delivery_info || '') + '</textarea></div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Комментарий к заказу</div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Заголовок и подсказка в поле комментария при оформлении заказа.</div>';
      h += '<div class="form-group"><label class="form-label">Заголовок</label>' +
        '<input type="text" class="form-input" id="s-comment-label" value="' + esc(s.comment_label || '') + '" placeholder="Комментарий к заказу"></div>';
      h += '<div class="form-group"><label class="form-label">Подсказка (placeholder)</label>' +
        '<input type="text" class="form-input" id="s-comment-placeholder" value="' + esc(s.comment_placeholder || '') + '" placeholder="Пожелания, особые указания"></div>';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Бесплатная позиция к букету</div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">При добавлении букета в корзину автоматически добавляется бесплатная позиция (0 р.). Количество = количеству букетов. Оставьте пустым, чтобы отключить.</div>';
      h += '<div class="form-group"><label class="form-label">Название</label>' +
        '<input type="text" class="form-input" id="s-free-service" value="' + esc(s.free_service_name || '') + '" placeholder="напр. Упаковка букета"></div>';
      h += '<div class="form-group"><label class="form-label">Фото</label>' +
        '<input type="file" id="s-free-service-img" accept="image/*" onchange="previewFreeServiceImg(this)">' +
        '<div id="s-free-service-img-preview" style="margin-top:8px">' +
        (s.free_service_image ? '<img src="' + esc(s.free_service_image) + '" style="width:60px;height:60px;object-fit:cover;border-radius:8px"><button type="button" class="btn btn-sm" onclick="clearFreeServiceImg()" style="margin-left:8px">Удалить</button>' : '') +
        '</div></div>';
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

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Информационные документы</div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Документы внизу приложения (о доставке, оплате, возврате и т.д.). Используйте обычный текст — HTML-теги автоматически удаляются.</div>';
      h += '<div id="s-info-pages-list"></div>';
      h += '<button type="button" class="btn btn-sm" onclick="addInfoPageRow()" style="margin-top:8px">+ Добавить документ</button>';
      h += '<input type="hidden" id="s-info-pages-json" value="' + esc(s.info_pages_json || '') + '">';
      h += '</div>';

      h += '<div class="settings-section">';
      h += '<div class="settings-section-title">Резервная копия</div>';
      h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Сохраняет текущую базу данных в GitHub Gist. Для работы должны быть заданы GITHUB_TOKEN и GITHUB_GIST_ID на сервере.</div>';
      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      h += '<button type="button" class="btn btn-sm" id="backup-now-btn" onclick="runBackupNow()">Сделать бэкап сейчас</button>';
      h += '<button type="button" class="btn btn-sm" onclick="checkBackupStatus()">Проверить последнее сохранение</button>';
      h += '</div>';
      h += '<div id="backup-status" style="margin-top:8px;font-size:13px;color:var(--text-secondary)">Проверка статуса...</div>';
      h += '</div>';

      h += '<button type="submit" class="btn btn-success" style="margin-top:8px">Сохранить настройки</button>';
      h += '</div></form>';

      if (isSuperAdmin || canDeleteOrders) {
        h += '<div class="card" style="margin-top:24px"><div class="settings-section">';
        h += '<div class="settings-section-title">Очистка старых заказов</div>';
        h += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Удаляет завершённые заказы (статус «Выполнен» или «Доставлен») старше указанного периода. Действие необратимо.</div>';
        h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
        h += '<label class="form-label" style="margin-bottom:0">Удалить старше</label>';
        h += '<select class="form-input" id="cleanup-months" style="width:auto;min-width:140px">';
        h += '<option value="3">3 месяцев</option>';
        h += '<option value="6" selected>6 месяцев</option>';
        h += '<option value="12">12 месяцев</option>';
        h += '</select>';
        h += '<button type="button" class="btn btn-danger" onclick="cleanupOldOrders()">Очистить</button>';
        h += '</div>';
        h += '<div id="cleanup-result" style="margin-top:8px;font-size:13px"></div>';
        h += '</div></div>';
      }

      el.innerHTML = h;
      setTimeout(function () { if (window.checkBackupStatus) window.checkBackupStatus(); }, 0);
      renderInfoPagesEditor(parseInfoPagesSetting(s.info_pages_json || ''));

      var tiersSar = [];
      try { tiersSar = JSON.parse(s.delivery_distance_tiers || '[]'); } catch (e) {}
      if (!tiersSar.length) tiersSar = [{ max_km: 5, price: 350 }, { max_km: 10, price: 500 }, { max_km: 20, price: 800 }, { max_km: 999, price: 1500 }];
      renderDeliveryTiers(tiersSar, 'saratov');

      var tiersEng = [];
      try { tiersEng = JSON.parse(s.delivery_distance_tiers_engels || '[]'); } catch (e) {}
      if (!tiersEng.length) tiersEng = [{ max_km: 5, price: 350 }, { max_km: 10, price: 500 }, { max_km: 20, price: 800 }, { max_km: 999, price: 1500 }];
      renderDeliveryTiers(tiersEng, 'engels');

      var tiersNightSar = [];
      try { tiersNightSar = JSON.parse(s.night_delivery_tiers || '[]'); } catch (e) {}
      renderDeliveryTiers(tiersNightSar, 'night-saratov');

      var tiersNightEng = [];
      try { tiersNightEng = JSON.parse(s.night_delivery_tiers_engels || '[]'); } catch (e) {}
      renderDeliveryTiers(tiersNightEng, 'night-engels');

      var regDay = [], regNight = [];
      if (s.intervals_regular_day) {
        try { regDay = JSON.parse(s.intervals_regular_day); } catch (e) {}
        try { regNight = JSON.parse(s.intervals_regular_night || '[]'); } catch (e) {}
      } else {
        var ivReg = [];
        try { ivReg = JSON.parse(s.intervals_regular || '[]'); } catch (e) {}
        if (!ivReg.length) ivReg = ['10:00-13:00', '13:00-16:00', '16:00-19:00', '19:00-22:00'];
        ivReg.forEach(function (iv) {
          var p = iv.split('-'); var sH = parseInt(p[0]); var eH = parseInt(p[1]);
          (eH <= sH ? regNight : regDay).push(iv);
        });
      }
      if (!regDay.length && !regNight.length) regDay = ['10:00-13:00', '13:00-16:00', '16:00-19:00', '19:00-22:00'];
      console.log('[LoadSettings] regular day:', JSON.stringify(regDay), 'night:', JSON.stringify(regNight));
      renderIntervals(regDay, 'regular-day');
      renderIntervals(regNight, 'regular-night');

      // Holidays are intentionally disabled in admin settings.
    });
  }

  function renderDeliveryTiers(tiers, city) {
    var list = document.getElementById('s-tiers-list-' + city);
    if (!list) return;
    var h = '';
    tiers.forEach(function (t) {
      h += '<div class="pf-size-row" style="margin-bottom:6px">' +
        '<label style="font-size:12px;white-space:nowrap;margin-right:4px">До</label>' +
        '<input type="number" class="form-input tier-km" value="' + t.max_km + '" style="width:80px" min="1"> ' +
        '<label style="font-size:12px;white-space:nowrap;margin:0 4px">км →</label>' +
        '<input type="number" class="form-input tier-price" value="' + t.price + '" style="width:100px" min="0"> ' +
        '<label style="font-size:12px;white-space:nowrap;margin-left:4px">₽</label>' +
        '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="flex-shrink:0;margin-left:6px">X</button>' +
      '</div>';
    });
    list.innerHTML = h;
  }

  window.addDeliveryTier = function (city) {
    var list = document.getElementById('s-tiers-list-' + city);
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'pf-size-row';
    row.style.marginBottom = '6px';
    row.innerHTML =
      '<label style="font-size:12px;white-space:nowrap;margin-right:4px">До</label>' +
      '<input type="number" class="form-input tier-km" value="10" style="width:80px" min="1"> ' +
      '<label style="font-size:12px;white-space:nowrap;margin:0 4px">км →</label>' +
      '<input type="number" class="form-input tier-price" value="500" style="width:100px" min="0"> ' +
      '<label style="font-size:12px;white-space:nowrap;margin-left:4px">₽</label>' +
      '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="flex-shrink:0;margin-left:6px">X</button>';
    list.appendChild(row);
  };

  function collectTiersFrom(listId) {
    var rows = document.querySelectorAll('#' + listId + ' .pf-size-row');
    var tiers = [];
    rows.forEach(function (row) {
      var km = parseInt(row.querySelector('.tier-km').value) || 0;
      var price = parseInt(row.querySelector('.tier-price').value) || 0;
      if (km > 0) tiers.push({ max_km: km, price: price });
    });
    tiers.sort(function (a, b) { return a.max_km - b.max_km; });
    return JSON.stringify(tiers);
  }

  function renderIntervals(intervals, type) {
    var list = document.getElementById('s-intervals-list-' + type);
    if (!list) return;
    var h = '';
    intervals.forEach(function (iv) {
      var parts = iv.split('-');
      var from = (parts[0] || '10:00').trim();
      var to = (parts[1] || '13:00').trim();
      h += '<div class="pf-size-row" style="margin-bottom:6px">' +
        '<input type="time" class="form-input iv-from" value="' + from + '" style="width:110px"> ' +
        '<label style="font-size:12px;white-space:nowrap;margin:0 6px">—</label>' +
        '<input type="time" class="form-input iv-to" value="' + to + '" style="width:110px"> ' +
        '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="flex-shrink:0;margin-left:6px">X</button>' +
      '</div>';
    });
    list.innerHTML = h;
  }

  window.addInterval = function (type, isNight) {
    var list = document.getElementById('s-intervals-list-' + type);
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'pf-size-row';
    row.style.marginBottom = '6px';
    var defFrom = isNight ? '22:00' : '10:00';
    var defTo = isNight ? '01:00' : '13:00';
    row.innerHTML =
      '<input type="time" class="form-input iv-from" value="' + defFrom + '" style="width:110px"> ' +
      '<label style="font-size:12px;white-space:nowrap;margin:0 6px">—</label>' +
      '<input type="time" class="form-input iv-to" value="' + defTo + '" style="width:110px"> ' +
      '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="flex-shrink:0;margin-left:6px">X</button>';
    list.appendChild(row);
  };

  function collectIntervalsRaw(listId) {
    var list = document.getElementById(listId);
    if (!list) { console.warn('[Intervals] List not found: #' + listId); return []; }
    var rows = list.querySelectorAll('.pf-size-row');
    var intervals = [];
    rows.forEach(function (row) {
      var fromEl = row.querySelector('.iv-from');
      var toEl = row.querySelector('.iv-to');
      if (fromEl && toEl && fromEl.value && toEl.value) {
        intervals.push(fromEl.value + '-' + toEl.value);
      }
    });
    console.log('[Intervals] Collected from #' + listId + ':', JSON.stringify(intervals));
    return intervals;
  }

  var _freeServiceImgData = null;

  window.previewFreeServiceImg = function (input) {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      _freeServiceImgData = e.target.result;
      var preview = document.getElementById('s-free-service-img-preview');
      if (preview) preview.innerHTML = '<img src="' + _freeServiceImgData + '" style="width:60px;height:60px;object-fit:cover;border-radius:8px"><button type="button" class="btn btn-sm" onclick="clearFreeServiceImg()" style="margin-left:8px">Удалить</button>';
    };
    reader.readAsDataURL(input.files[0]);
  };

  window.clearFreeServiceImg = function () {
    _freeServiceImgData = '';
    var preview = document.getElementById('s-free-service-img-preview');
    if (preview) preview.innerHTML = '';
    var input = document.getElementById('s-free-service-img');
    if (input) input.value = '';
  };

  function collectAllIntervals() {
    var regDay = collectIntervalsRaw('s-intervals-list-regular-day');
    var regNight = collectIntervalsRaw('s-intervals-list-regular-night');

    var hiddenReg = document.getElementById('s-intervals-regular');
    if (hiddenReg) hiddenReg.value = JSON.stringify(regDay.concat(regNight));
    var hiddenHol = document.getElementById('s-intervals-holiday');
    if (hiddenHol) hiddenHol.value = '[]';

    var hiddenRegDay = document.getElementById('s-intervals-regular-day');
    if (hiddenRegDay) hiddenRegDay.value = JSON.stringify(regDay);
    var hiddenRegNight = document.getElementById('s-intervals-regular-night');
    if (hiddenRegNight) hiddenRegNight.value = JSON.stringify(regNight);
    var hiddenHolDay = document.getElementById('s-intervals-holiday-day');
    if (hiddenHolDay) hiddenHolDay.value = '[]';
    var hiddenHolNight = document.getElementById('s-intervals-holiday-night');
    if (hiddenHolNight) hiddenHolNight.value = '[]';
    var holidays = document.getElementById('s-holidays');
    if (holidays) holidays.value = '[]';

    console.log('[Intervals] Regular day:', JSON.stringify(regDay), 'night:', JSON.stringify(regNight));
  }

  function collectDeliveryTiers() {
    var hiddenSar = document.getElementById('s-delivery-tiers');
    if (hiddenSar) hiddenSar.value = collectTiersFrom('s-tiers-list-saratov');
    var hiddenEng = document.getElementById('s-delivery-tiers-engels');
    if (hiddenEng) hiddenEng.value = collectTiersFrom('s-tiers-list-engels');
    var hiddenNightSar = document.getElementById('s-night-delivery-tiers');
    if (hiddenNightSar) hiddenNightSar.value = collectTiersFrom('s-tiers-list-night-saratov');
    var hiddenNightEng = document.getElementById('s-night-delivery-tiers-engels');
    if (hiddenNightEng) hiddenNightEng.value = collectTiersFrom('s-tiers-list-night-engels');
  }

  function plainTextOnly(value) {
    return String(value || '')
      .replace(/\r/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  function slugifyInfoPage(title, fallbackIdx) {
    var base = plainTextOnly(title).toLowerCase()
      .replace(/[^a-zа-я0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!base) base = 'doc-' + (fallbackIdx + 1);
    return base;
  }

  function getDefaultInfoPages() {
    return [
      { slug: 'order', title: 'О заказе и доставке', content: 'Здесь можно указать условия заказа и доставки.' },
      { slug: 'payment', title: 'Об оплате', content: 'Здесь можно указать способы оплаты и важные условия.' },
      { slug: 'returns', title: 'Условия возврата', content: 'Здесь можно указать условия возврата и претензий.' },
      { slug: 'care', title: 'Рекомендации по уходу', content: 'Здесь можно указать рекомендации по уходу за букетами.' },
      { slug: 'offer', title: 'Публичная оферта', content: 'Здесь можно разместить текст публичной оферты.' }
    ];
  }

  function parseInfoPagesSetting(raw) {
    if (!raw) return getDefaultInfoPages();
    try {
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return getDefaultInfoPages();
      var out = [];
      arr.forEach(function (d, i) {
        if (!d) return;
        var title = plainTextOnly(d.title || '');
        var content = plainTextOnly(d.content || '');
        if (!title || !content) return;
        var slug = plainTextOnly(d.slug || '') || slugifyInfoPage(title, i);
        out.push({ slug: slug, title: title, content: content });
      });
      return out.length ? out : getDefaultInfoPages();
    } catch (e) {
      return getDefaultInfoPages();
    }
  }

  function renderInfoPagesEditor(docs) {
    var list = document.getElementById('s-info-pages-list');
    if (!list) return;
    var h = '';
    docs.forEach(function (d, idx) {
      var moveUpDisabled = idx === 0 ? ' disabled' : '';
      var moveDownDisabled = idx === docs.length - 1 ? ' disabled' : '';
      h += '<div class="card" style="padding:12px;margin-bottom:10px">' +
        '<div class="form-group"><label class="form-label">Название документа</label>' +
        '<input type="text" class="form-input info-page-title" value="' + esc(d.title || '') + '" placeholder="Например, Условия возврата"></div>' +
        '<div class="form-group"><label class="form-label">Ключ (slug)</label>' +
        '<input type="text" class="form-input info-page-slug" value="' + esc(d.slug || '') + '" placeholder="returns"></div>' +
        '<div class="form-group"><label class="form-label">Текст</label>' +
        '<textarea class="form-textarea info-page-content" rows="7" placeholder="Обычный текст без HTML">' + esc(d.content || '') + '</textarea></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="btn btn-sm"' + moveUpDisabled + ' onclick="moveInfoPageUp(' + idx + ')">Вверх</button>' +
          '<button type="button" class="btn btn-sm"' + moveDownDisabled + ' onclick="moveInfoPageDown(' + idx + ')">Вниз</button>' +
          '<button type="button" class="btn btn-sm btn-danger" onclick="removeInfoPageRow(' + idx + ')">Удалить документ</button>' +
        '</div>' +
      '</div>';
    });
    list.innerHTML = h;
  }

  window.addInfoPageRow = function () {
    var docs = collectInfoPagesData();
    docs.push({ slug: '', title: '', content: '' });
    renderInfoPagesEditor(docs);
  };

  window.removeInfoPageRow = function (idx) {
    var docs = collectInfoPagesData();
    docs.splice(idx, 1);
    renderInfoPagesEditor(docs);
  };

  window.moveInfoPageUp = function (idx) {
    var docs = collectInfoPagesData();
    if (idx <= 0 || idx >= docs.length) return;
    var current = docs[idx];
    docs[idx] = docs[idx - 1];
    docs[idx - 1] = current;
    renderInfoPagesEditor(docs);
  };

  window.moveInfoPageDown = function (idx) {
    var docs = collectInfoPagesData();
    if (idx < 0 || idx >= docs.length - 1) return;
    var current = docs[idx];
    docs[idx] = docs[idx + 1];
    docs[idx + 1] = current;
    renderInfoPagesEditor(docs);
  };

  function collectInfoPagesData() {
    var list = document.getElementById('s-info-pages-list');
    if (!list) return [];
    var blocks = list.querySelectorAll('.card');
    var docs = [];
    blocks.forEach(function (block, idx) {
      var titleEl = block.querySelector('.info-page-title');
      var slugEl = block.querySelector('.info-page-slug');
      var contentEl = block.querySelector('.info-page-content');
      var title = plainTextOnly(titleEl ? titleEl.value : '');
      var content = plainTextOnly(contentEl ? contentEl.value : '');
      if (!title || !content) return;
      var slug = plainTextOnly(slugEl ? slugEl.value : '') || slugifyInfoPage(title, idx);
      docs.push({ slug: slug, title: title, content: content });
    });
    return docs;
  }

  function collectInfoPagesJson() {
    return JSON.stringify(collectInfoPagesData());
  }

  window.saveSettings = function (e) {
    e.preventDefault();
    collectDeliveryTiers();
    collectAllIntervals();

    var data = {
      yandex_maps_key: document.getElementById('s-yandex-key').value,
      shop_coords: document.getElementById('s-shop-coords').value,
      engels_coords: document.getElementById('s-engels-coords').value,
      delivery_distance_tiers: document.getElementById('s-delivery-tiers').value,
      delivery_distance_tiers_engels: document.getElementById('s-delivery-tiers-engels').value,
      night_delivery_tiers: document.getElementById('s-night-delivery-tiers') ? document.getElementById('s-night-delivery-tiers').value : '',
      night_delivery_tiers_engels: document.getElementById('s-night-delivery-tiers-engels') ? document.getElementById('s-night-delivery-tiers-engels').value : '',
      max_delivery_km_saratov: document.getElementById('s-max-distance-saratov').value,
      max_delivery_km_engels: document.getElementById('s-max-distance-engels').value,
      delivery_regular: document.getElementById('s-delivery-regular').value,
      delivery_holiday: document.getElementById('s-delivery-regular').value,
      pickup_address: document.getElementById('s-pickup').value,
      cutoff_hour: document.getElementById('s-cutoff').value,
      intervals_regular: document.getElementById('s-intervals-regular').value,
      intervals_regular_day: document.getElementById('s-intervals-regular-day').value,
      intervals_regular_night: document.getElementById('s-intervals-regular-night').value,
      intervals_holiday: '[]',
      intervals_holiday_day: '[]',
      intervals_holiday_night: '[]',
      holiday_dates: '[]',
      exact_time_enabled: document.getElementById('s-exact-enabled').checked ? '1' : '0',
      exact_time_surcharge: document.getElementById('s-exact-surcharge').value,
      pickup_cutoff_hour: document.getElementById('s-pickup-cutoff').value,
      delivery_info: document.getElementById('s-delivery-info').value,
      free_service_name: document.getElementById('s-free-service').value,
      free_service_image: _freeServiceImgData !== null ? _freeServiceImgData : (document.querySelector('#s-free-service-img-preview img') ? document.querySelector('#s-free-service-img-preview img').src : ''),
      social_telegram: document.getElementById('s-social-tg').value,
      social_instagram: document.getElementById('s-social-ig').value,
      social_vk: document.getElementById('s-social-vk').value,
      info_pages_json: collectInfoPagesJson()
    };

    console.log('[SaveSettings] intervals_regular:', data.intervals_regular);

    api('POST', '/api/admin/settings', data).then(function () {
      adminToast('Настройки сохранены', 'success');
    });
  };

  window.runBackupNow = function () {
    var btn = document.getElementById('backup-now-btn');
    var statusEl = document.getElementById('backup-status');
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--text-secondary)">Выполняем бэкап...</span>';

    api('POST', '/api/admin/backup-now').then(function (r) {
      if (r && r.error) {
        if (statusEl) statusEl.innerHTML = '<span style="color:#c00">' + esc(r.error) + '</span>';
        return;
      }
      if (statusEl) statusEl.innerHTML = '<span style="color:#2d6a2d">Бэкап успешно создан. Обновляем статус...</span>';
      adminToast('Бэкап успешно создан', 'success');
      setTimeout(function () { window.checkBackupStatus(); }, 400);
    }).catch(function (err) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#c00">Ошибка бэкапа: ' + esc(err.message || 'unknown') + '</span>';
    }).finally(function () {
      if (btn) btn.disabled = false;
    });
  };

  window.checkBackupStatus = function () {
    var statusEl = document.getElementById('backup-status');
    if (!statusEl) return;
    statusEl.innerHTML = '<span style="color:var(--text-secondary)">Проверяем состояние бэкапа...</span>';

    api('GET', '/api/admin/backup-status').then(function (st) {
      if (!st || st.error) {
        statusEl.innerHTML = '<span style="color:#c00">' + esc((st && st.error) || 'Не удалось получить статус') + '</span>';
        return;
      }
      if (!st.configured) {
        statusEl.innerHTML = 'Бэкап не настроен: заполните <code>GITHUB_TOKEN</code> и <code>GITHUB_GIST_ID</code> на сервере.';
        return;
      }
      if (!st.hasBackup) {
        statusEl.innerHTML = 'Бэкап настроен, но сохранений ещё нет.';
        return;
      }
      var when = st.updatedAt ? fmtDate(st.updatedAt) : 'дата неизвестна';
      var parts = st.partCount ? (' · частей: ' + st.partCount) : '';
      statusEl.innerHTML = '<span style="color:#2d6a2d">Последний бэкап: ' + esc(when) + parts + '</span>';
    }).catch(function (err) {
      statusEl.innerHTML = '<span style="color:#c00">Ошибка проверки: ' + esc(err.message || 'unknown') + '</span>';
    });
  };

  window.cleanupOldOrders = function () {
    var sel = document.getElementById('cleanup-months');
    var months = sel ? sel.value : '6';
    if (!confirm('Вы уверены? Будут удалены все завершённые заказы старше ' + months + ' мес. Это действие необратимо!')) return;
    var resultEl = document.getElementById('cleanup-result');
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--text-secondary)">Удаление...</span>';
    api('POST', '/api/admin/orders/cleanup', { months: parseInt(months) }).then(function (r) {
      if (r.error) {
        if (resultEl) resultEl.innerHTML = '<span style="color:#c00">' + esc(r.error) + '</span>';
      } else {
        if (resultEl) resultEl.innerHTML = '<span style="color:#2d6a2d">Удалено заказов: ' + r.deleted + '</span>';
        adminToast('Удалено заказов: ' + r.deleted, 'success');
      }
    }).catch(function () {
      if (resultEl) resultEl.innerHTML = '<span style="color:#c00">Ошибка при очистке</span>';
    });
  };

  // ============================================================
  // Admins management (super admin only)
  // ============================================================

  function loadAdmins() {
    if (!isSuperAdmin) {
      var el = document.getElementById('tab-content');
      el.innerHTML = '<div class="empty-state">Доступ только для главного администратора</div>';
      return;
    }
    api('GET', '/api/admin/admins').then(function (admins) {
      var el = document.getElementById('tab-content');
      var h = '<div class="card">';
      h += '<div class="card-header"><span class="card-title">Администраторы</span></div>';
      h += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">' +
        'Добавляйте администраторов по их Telegram username. Они получат доступ к админ-панели при входе через Telegram.<br>' +
        '<b>Чистка</b> — разрешение на удаление старых заказов (раздел в Настройках). По умолчанию выключено.</div>';

      h += '<form onsubmit="addAdmin(event)" class="admin-add-form">' +
        '<div class="form-group" style="flex:1;margin-bottom:0">' +
          '<label class="form-label">Telegram username</label>' +
          '<input type="text" class="form-input" id="new-admin-username" placeholder="@username" required>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary" style="align-self:flex-end">Добавить</button>' +
      '</form>';

      if (!admins || !admins.length) {
        h += '<div class="empty-state" style="padding:24px">Дополнительных администраторов нет.<br>Вы — единственный (главный) администратор.</div>';
      } else {
        h += '<div class="admin-list">';
        admins.forEach(function (a) {
          var deleteToggle = a.can_delete_orders
            ? '<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:#e8d5f5;color:#5b2d8e;border-color:#d4b3e8;margin-right:6px" onclick="toggleAdminDeletePerm(' + a.id + ',0)">Чистка ✓</button>'
            : '<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:#f5f5f5;color:#999;border-color:#e0e0e0;margin-right:6px" onclick="toggleAdminDeletePerm(' + a.id + ',1)">Чистка</button>';
          h += '<div class="admin-list-item" id="admin-row-' + a.id + '">' +
            '<div class="admin-list-info">' +
              '<div class="admin-list-username">@' + esc(a.telegram_username) + '</div>' +
              '<div class="admin-list-meta">' +
                (a.telegram_id ? 'ID: ' + esc(a.telegram_id) + ' · ' : 'Ещё не заходил · ') +
                'Добавлен ' + fmtDate(a.created_at) +
              '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center">' +
              deleteToggle +
              '<button class="btn btn-sm btn-danger" onclick="removeAdmin(' + a.id + ',\'' + esc(a.telegram_username) + '\')">Удалить</button>' +
            '</div>' +
          '</div>';
        });
        h += '</div>';
      }

      h += '</div>';
      el.innerHTML = h;
    }).catch(function () {
      var el = document.getElementById('tab-content');
      el.innerHTML = '<div class="empty-state">Не удалось загрузить список администраторов</div>';
    });
  }

  window.addAdmin = function (e) {
    e.preventDefault();
    var input = document.getElementById('new-admin-username');
    var username = (input.value || '').trim();
    if (!username) return;
    api('POST', '/api/admin/admins', { username: username }).then(function (r) {
      if (r.error) {
        adminToast(r.error, 'error');
      } else {
        adminToast('@' + username.replace(/^@/, '') + ' добавлен как администратор', 'success');
        loadAdmins();
      }
    }).catch(function () {
      adminToast('Ошибка при добавлении', 'error');
    });
  };

  window.toggleAdminDeletePerm = function (id, newValue) {
    api('PUT', '/api/admin/admins/' + id + '/permissions', { can_delete_orders: newValue }).then(function () {
      adminToast(newValue ? 'Право на чистку заказов выдано' : 'Право на чистку заказов отозвано', 'success');
      loadAdmins();
    });
  };

  window.removeAdmin = function (id, username) {
    if (!confirm('Удалить @' + username + ' из администраторов?')) return;
    api('DELETE', '/api/admin/admins/' + id).then(function () {
      adminToast('@' + username + ' удалён из администраторов', 'success');
      loadAdmins();
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
    { key: 'exact_time_surcharge', label: 'Доплата за точное время', section: 'Точное время доставки' },
    { key: 'pickup_address', label: 'Адрес самовывоза', section: 'Самовывоз' },
    { key: 'cutoff_hour', label: 'Вечерний порог (час)', section: 'Время и интервалы' },
    { key: 'intervals_regular', label: 'Интервалы доставки', section: 'Время и интервалы' },
    { key: 'delivery_info', label: 'Информация о доставке', section: 'Информация о доставке' },
    { key: 'info_pages_json', label: 'Информационные документы', section: 'Информационные документы' },
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
          delivery_info: 's-delivery-info',
          info_pages_json: 's-info-pages-json',
          social_telegram: 's-social-tg',
          social_instagram: 's-social-ig',
          social_vk: 's-social-vk',
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
    var tgUser = params.get('tg_user') || '';
    if (!tgAuth) return false;
    currentTelegramId = tgAuth;
    localStorage.setItem('arka_admin_tg_id', tgAuth);
    fetch('/api/admin/telegram-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: tgAuth, username: tgUser })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.token) {
        token = data.token;
        localStorage.setItem('arka_admin_token', token);
        isSuperAdmin = !!data.is_super_admin;
        canDeleteOrders = !!data.can_delete_orders;
        localStorage.setItem('arka_admin_is_super', isSuperAdmin ? '1' : '0');
        localStorage.setItem('arka_admin_can_delete', canDeleteOrders ? '1' : '0');
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

  isSuperAdmin = localStorage.getItem('arka_admin_is_super') === '1';
  canDeleteOrders = localStorage.getItem('arka_admin_can_delete') === '1';

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
