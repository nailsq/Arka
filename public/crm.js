(function () {
  const state = {
    token: null,
    tgAuth: null,
    orders: [],
    filtered: [],
    dragOrderId: null,
    isEditMode: false,
    menu: "orders",
    filters: {
      query: "",
      orderId: "",
      phone: "",
      status: "",
      dateFrom: "",
      dateTo: "",
      day: ""
    },
    productFilters: {
      query: "",
      category: ""
    },
    analytics: {
      period: "month",
      channel: "all",
      tick: 0
    },
    productCategories: [],
    productItems: [],
    clients: [],
    staff: [],
    categoryViewMode: "table",
    productViewMode: "table",
    staffRoleFilter: "all",
    editorProductId: null,
    section: "all",
    ordersSubmenuOpen: true,
    productsSubmenuOpen: false,
    peopleSubmenuOpen: false,
    demoMode: false
  };

  const statusMeta = {
    "Новый": { group: "new", css: "crm-status-new" },
    "Новый заказ": { group: "new", css: "crm-status-new" },
    "Оплачен": { group: "progress", css: "crm-status-progress" },
    "Оформлен": { group: "progress", css: "crm-status-progress" },
    "В обработке": { group: "progress", css: "crm-status-progress" },
    "Собирается": { group: "progress", css: "crm-status-progress" },
    "Собран": { group: "ready", css: "crm-status-ready" },
    "Букет готов": { group: "ready", css: "crm-status-ready" },
    "Отправлен": { group: "delivery", css: "crm-status-delivery" },
    "Доставлен": { group: "delivery", css: "crm-status-delivery" },
    "Выдан": { group: "done", css: "crm-status-done" },
    "Выполнен": { group: "done", css: "crm-status-done" },
    "Отменен": { group: "cancel", css: "crm-status-cancel" },
    "Возврат": { group: "cancel", css: "crm-status-cancel" }
  };

  const statusLabelToFilter = {
    new: "Новый",
    formed: "Оформлен",
    progress: "В обработке",
    ready: "Букет готов",
    delivery: "Доставлен",
    done: "Выполнен",
    cancel: "Отменен"
  };

  const boardColumns = [
    { key: "new", title: "Новые", status: "Новый" },
    { key: "progress", title: "В обработке", status: "В обработке" },
    { key: "ready", title: "Букет готов", status: "Букет готов" },
    { key: "delivery", title: "Доставляется", status: "Доставлен" },
    { key: "done", title: "Выполнен", status: "Выполнен" }
  ];
  const LOCAL_BOARD_STATUS_KEY = "arca_crm_local_board_status";

  function byId(id) {
    return document.getElementById(id);
  }

  function initWelcomeSplash() {
    const splash = byId("crm-welcome-splash");
    if (!splash) return;
    setTimeout(() => {
      splash.classList.add("is-hidden");
      setTimeout(() => {
        splash.remove();
      }, 300);
    }, 2200);
  }

  function normalizeStatus(raw) {
    if (!raw) return "Новый";
    const s = String(raw).trim();
    if (statusMeta[s]) return s;
    if (/нов/i.test(s)) return "Новый";
    if (/обраб|оплач|собира/i.test(s)) return "В обработке";
    if (/собран|готов/i.test(s)) return "Букет готов";
    if (/достав|отправ/i.test(s)) return "Доставлен";
    if (/выполн|выдан/i.test(s)) return "Выполнен";
    if (/отмен|возврат/i.test(s)) return "Отменен";
    return s;
  }

  function toDateOnly(value) {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatDateTime(order) {
    const d = toDateOnly(order.delivery_date || order.deliveryDate || order.date);
    const t = order.delivery_time || order.time_slot || "";
    if (d && t) return `${d}\n${t}`;
    return d || t || "—";
  }

  function getPhone(order) {
    return order.phone || order.customer_phone || order.buyer_phone || "";
  }

  function getCustomer(order) {
    return order.customer_name || order.buyer_name || order.name || "Без имени";
  }

  function getAmount(order) {
    const val = Number(order.total_amount || order.amount || order.total || 0);
    if (!Number.isFinite(val)) return "0 руб.";
    return `${Math.round(val)} руб.`;
  }

  function createMockOrders() {
    return [
      { id: 12168, customer_name: "Орига", customer_phone: "+7 (965) 921-8181", delivery_type: "Самовывоз", delivery_date: "2025-10-02", delivery_time: "14:00-15:00", amount: 0, status: "Новый", payment_status: "Не оплачен", image_url: "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12167, customer_name: "Олег", customer_phone: "+7 (987) 608-1486", delivery_type: "Самовывоз", delivery_date: "2025-10-02", delivery_time: "09:00-10:00", amount: 2690, status: "В обработке", payment_status: "Не оплачен", image_url: "https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12166, customer_name: "Павел", customer_phone: "+7 (917) 802-7391", delivery_type: "Доставка", delivery_date: "2025-10-03", delivery_time: "10:00-10:30", amount: 4035, status: "Букет готов", payment_status: "Оплачен", image_url: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12165, customer_name: "Игорь", customer_phone: "+7 (917) 783-0544", delivery_type: "Доставка", delivery_date: "2025-10-05", delivery_time: "12:00-15:00", amount: 1540, status: "Доставлен", payment_status: "Оплачен", image_url: "https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12164, customer_name: "Евгений", customer_phone: "+7 (960) 388-8450", delivery_type: "Доставка", delivery_date: "2025-10-07", delivery_time: "18:00-21:00", amount: 2785, status: "Выполнен", payment_status: "Оплачен", image_url: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12163, customer_name: "Серафима", customer_phone: "+7 (917) 801-2060", delivery_type: "Самовывоз", delivery_date: "2025-10-10", delivery_time: "18:00-19:00", amount: 250, status: "Отменен", payment_status: "Не оплачен", image_url: "https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12162, customer_name: "Индира", customer_phone: "+7 (987) 241-1923", delivery_type: "Доставка", delivery_date: "2025-10-07", delivery_time: "12:00-15:00", amount: 2600, status: "Букет готов", payment_status: "Оплачен", image_url: "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12161, customer_name: "Марк", customer_phone: "+7 (917) 460-2343", delivery_type: "Доставка", delivery_date: "2025-10-11", delivery_time: "16:00-18:00", amount: 2225, status: "В обработке", payment_status: "Не оплачен", image_url: "https://images.unsplash.com/photo-1487070183336-b863922373d4?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12160, customer_name: "Руслан", customer_phone: "+7 (917) 477-4215", delivery_type: "Доставка", delivery_date: "2025-10-11", delivery_time: "18:00-21:00", amount: 1980, status: "Букет готов", payment_status: "Оплачен", image_url: "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12159, customer_name: "Сергей", customer_phone: "+7 (917) 460-0056", delivery_type: "Доставка", delivery_date: "2025-10-12", delivery_time: "15:00-17:00", amount: 3350, status: "Отменен", payment_status: "Не оплачен", image_url: "https://images.unsplash.com/photo-1494336956606-8d79a54e7422?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12158, customer_name: "Екатерина", customer_phone: "+7 (987) 583-1349", delivery_type: "Доставка", delivery_date: "2025-10-12", delivery_time: "12:00-15:00", amount: 2190, status: "Выполнен", payment_status: "Оплачен", image_url: "https://images.unsplash.com/photo-1495231916356-a86217efff12?auto=format&fit=crop&w=240&q=60", __mock: true },
      { id: 12157, customer_name: "Максим", customer_phone: "+7 (986) 707-4013", delivery_type: "Самовывоз", delivery_date: "2025-10-13", delivery_time: "17:00-20:00", amount: 2210, status: "Новый", payment_status: "Не оплачен", image_url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=240&q=60", __mock: true }
    ];
  }

  function createMockProductCategories() {
    return [
      { id: 1, name: "Универсальные товары", sort: 0, parent: "-", linked: 42, visible: true },
      { id: 2, name: "Товары интернет-магазинов", sort: 0, parent: "-", linked: 27, visible: true },
      { id: 3, name: "Все товары и услуги", sort: 0, parent: "-", linked: 56, visible: true },
      { id: 4, name: "Импортированные", sort: 0, parent: "-", linked: 13, visible: true },
      { id: 5, name: "ТМЦ", sort: 0, parent: "-", linked: 11, visible: true },
      { id: 6, name: "Съедобные букеты", sort: 0, parent: "-", linked: 19, visible: true },
      { id: 7, name: "Орехи", sort: 0, parent: "Съедобные букеты", linked: 8, visible: true },
      { id: 8, name: "Клубничные букеты", sort: 0, parent: "Съедобные букеты", linked: 9, visible: true },
      { id: 9, name: "Коробки с клубникой", sort: 0, parent: "Клубничные букеты", linked: 6, visible: true },
      { id: 10, name: "Овощные и мясные букеты", sort: 0, parent: "Съедобные букеты", linked: 5, visible: false },
      { id: 11, name: "Фруктовые букеты", sort: 0, parent: "Съедобные букеты", linked: 7, visible: true },
      { id: 12, name: "Букеты из орехов", sort: 0, parent: "Орехи", linked: 4, visible: true }
    ];
  }

  function createMockProducts() {
    return [
      { id: 195671, name: "Конфетти белый хамелеон, дробленое, 1гр.", sku: "195671", categories: ["Универсальные товары", "Товары интернет-магазинов", "Все товары и услуги"], price: 113, visible: false, stock: 0, image: "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=120&q=60", discount: false },
      { id: 195669, name: "Шар", sku: "195669", categories: ["С рисунком"], price: 45, visible: false, stock: 0, image: "https://images.unsplash.com/photo-1549237519-6d85b4d54f49?auto=format&fit=crop&w=120&q=60", discount: false },
      { id: 195668, name: "S Шар пастель макарунс нежно-розовый 24\"", sku: "195668", categories: ["Пастель"], price: 370, visible: true, stock: 0, image: "", discount: false },
      { id: 195657, name: "И 29 Авокадо/73 см", sku: "195657", categories: ["Фольгированные фигуры"], price: 330, visible: true, stock: 1, image: "", discount: false },
      { id: 195661, name: "Шляпная коробка M (бордовая) средняя 17.5x18h см", sku: "195661", categories: ["Шляпные коробки"], price: 750, visible: true, stock: 0, image: "", discount: false },
      { id: 195663, name: "Стаканы (250 мл) Мастхэв, Голубой, 6 шт.", sku: "195663", categories: ["Стаканы"], price: 90, visible: false, stock: 1, image: "", discount: true },
      { id: 195664, name: "Композиции Бикбая 30812142", sku: "195664", categories: ["Витрина готовых букетов бикбая"], price: 1200, visible: true, stock: 0, image: "", discount: false },
      { id: 195676, name: "Букет проспект 03041", sku: "195676", categories: ["Витрина готовых букетов проспект"], price: 2050, visible: true, stock: 0, image: "", discount: false },
      { id: 195675, name: "Букет Революционная 204290", sku: "195675", categories: ["Витрина готовых букетов Революционная"], price: 2025, visible: true, stock: 0, image: "", discount: false }
    ];
  }

  function createMockClients() {
    return [
      { id: 1, name: "Олег", phone: "79619935148", purchases: 55, paid: 4609, lastLogin: "30 Сент 2025", registered: "9 Июл 2022", status: "Клиент", email: "oleg@mail.ru", comment: "Постоянный клиент", buyout: 96 },
      { id: 2, name: "Алиса", phone: "123123123123", purchases: 0, paid: 0, lastLogin: "4 Окт 2024", registered: "4 Окт 2024", status: "Клиент", email: "alisa@mail.ru", comment: "", buyout: 4 },
      { id: 3, name: "asdas", phone: "72222222", purchases: 0, paid: 0, lastLogin: "18 Нояб 2024", registered: "18 Нояб 2024", status: "Клиент", email: "asdas@mail.ru", comment: "", buyout: 0 },
      { id: 4, name: "вася", phone: "77961993514", purchases: 2, paid: 0, lastLogin: "11 Янв 2025", registered: "11 Янв 2025", status: "Клиент", email: "vasya@mail.ru", comment: "", buyout: 7 },
      { id: 5, name: "радмир", phone: "77927235533", purchases: 1, paid: 0, lastLogin: "11 Янв 2025", registered: "11 Янв 2025", status: "Клиент", email: "radmir@mail.ru", comment: "", buyout: 20 },
      { id: 6, name: "Екатерина", phone: "89835452402", purchases: 6, paid: 6422, lastLogin: "9 Июл 2023", registered: "11 Июл 2022", status: "Клиент", email: "ekaterina@mail.ru", comment: "", buyout: 54 },
      { id: 7, name: "Максим", phone: "79272355330", purchases: 17, paid: 0, lastLogin: "6 Фев 2025", registered: "23 Нояб 2024", status: "Клиент", email: "maxim@mail.ru", comment: "", buyout: 23 },
      { id: 8, name: "Влад", phone: "7122222222", purchases: 5, paid: 0, lastLogin: "16 Янв 2025", registered: "16 Янв 2025", status: "Клиент", email: "vlad@mail.ru", comment: "", buyout: 18 },
      { id: 9, name: "Мирослава", phone: "79059275823", purchases: 0, paid: 0, lastLogin: "21 Фев 2025", registered: "10 Окт 2024", status: "Клиент", email: "mira@mail.ru", comment: "", buyout: 0 },
      { id: 10, name: "Ильдар", phone: "79677387072", purchases: 9, paid: 3990, lastLogin: "25 Июн 2025", registered: "8 Июн 2024", status: "Клиент", email: "ildar@mail.ru", comment: "", buyout: 61 }
    ];
  }

  function createMockStaff() {
    return [
      { id: 1, name: "admin", login: "admin", role: "Админ", lastLogin: "8 Окт 2025", registered: "20 Июл 2022", active: true },
      { id: 2, name: "root", login: "root", role: "Админ", lastLogin: "7 Июл 2025", registered: "20 Июл 2022", active: true },
      { id: 3, name: "Владислав", login: "SEO", role: "Админ", lastLogin: "29 Апр 2025", registered: "15 Янв 2025", active: true },
      { id: 4, name: "dsadas", login: "sdasdasd@asdasd.r", role: "Курьер", lastLogin: "1 Окт 2025", registered: "1 Окт 2025", active: true },
      { id: 5, name: "Анна", login: "florist.anna", role: "Флорист", lastLogin: "14 Сен 2025", registered: "2 Фев 2025", active: true }
    ];
  }

  function parseItems(order) {
    if (Array.isArray(order.items)) return order.items;
    if (typeof order.items === "string") {
      try {
        const parsed = JSON.parse(order.items);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {
        return [];
      }
    }
    return [];
  }

  function getOrderImage(order) {
    const direct = order.image_url || order.image || order.photo || order.product_image;
    if (direct) return String(direct);
    const items = parseItems(order);
    if (!items.length) return "";
    const first = items[0] || {};
    const itemImage = first.image || first.image_url || first.photo || first.product_image;
    return itemImage ? String(itemImage) : "";
  }

  function getDeliveryLabel(order) {
    const type = (order.delivery_type || order.type || "").toLowerCase();
    if (type.includes("самовы")) return "Самовывоз";
    if (type.includes("достав")) return "Доставка";
    return "Доставка";
  }

  function getPaymentState(order) {
    const raw = String(order.payment_status || order.paymentState || order.payment || "").toLowerCase();
    const paidLike = raw.includes("оплач") || raw.includes("paid") || raw.includes("успеш");
    if (paidLike) return { label: "Оплачен", css: "paid" };
    return { label: "Не оплачен", css: "unpaid" };
  }

  function isPaid(order) {
    return getPaymentState(order).css === "paid";
  }

  function effectiveOrderStatus(order) {
    const s = normalizeStatus(order.status);
    if (isPaid(order)) return s;
    // Пока заказ не оплачен — не допускаем “доставка/выполнено”, чтобы он не попадал в оплаченные/текущие этапы.
    if (s === "Доставлен" || s === "Выполнен" || s === "Выдан" || s === "Отправлен" || s === "Букет готов") return "Новый";
    return s;
  }

  function setNotice(message, type) {
    const notice = byId("crm-notice");
    if (!notice) return;
    if (!message) {
      notice.className = "crm-notice crm-hidden";
      notice.textContent = "";
      return;
    }
    notice.className = `crm-notice ${type || "info"}`;
    notice.textContent = message;
  }

  function getLocalBoardStatusMap() {
    try {
      const raw = localStorage.getItem(LOCAL_BOARD_STATUS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function setLocalBoardStatus(orderId, status) {
    const key = String(orderId || "");
    if (!key) return;
    const map = getLocalBoardStatusMap();
    map[key] = status;
    localStorage.setItem(LOCAL_BOARD_STATUS_KEY, JSON.stringify(map));
  }

  function applyLocalBoardStatuses() {
    const map = getLocalBoardStatusMap();
    state.orders.forEach((o) => {
      const id = String(getOrderId(o));
      if (map[id]) o.status = map[id];
    });
  }

  function rerenderDataView() {
    if (state.section === "new-client") {
      renderShownInfo();
      return;
    }
    if (state.section === "kanban") {
      renderBoard();
      bindBoardDnd();
    } else {
      renderTable();
    }
    renderShownInfo();
  }

  function renderShownInfo() {
    const el = byId("crm-shown-info");
    if (!el) return;
    if (state.menu === "orders" && state.section === "new-client") {
      el.textContent = "";
      el.classList.add("crm-hidden");
      return;
    }
    const shown = state.filtered.length;
    const total = state.orders.length;
    if (state.menu !== "orders") {
      el.textContent = "";
      el.classList.add("crm-hidden");
      return;
    }
    el.classList.remove("crm-hidden");
    el.textContent = `Показано ${shown} из ${total}`;
  }

  function getOrderId(order) {
    return String(order.id || order.order_id || order.number || "");
  }

  function escapeHtml(v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getTokenFromUrl() {
    const url = new URL(window.location.href);
    const direct = url.searchParams.get("token");
    const tg = url.searchParams.get("tg_auth");
    if (direct) state.token = direct;
    if (tg) state.tgAuth = tg;
    if (direct || tg) {
      if (direct) localStorage.setItem("arka_admin_token", direct);
      if (tg) localStorage.setItem("arka_admin_tg_auth", tg);
      url.searchParams.delete("token");
      history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
    }
  }

  async function autoLoginByTelegram() {
    const tg = state.tgAuth || localStorage.getItem("arka_admin_tg_auth");
    if (!tg) return null;
    try {
      const res = await fetch(`/api/admin/login-by-telegram?tg_auth=${encodeURIComponent(tg)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.token) {
        state.token = data.token;
        localStorage.setItem("arka_admin_token", data.token);
        return data.token;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  async function api(path, options, retry) {
    const opts = options || {};
    const allowRetry = retry !== false;
    const token = state.token || localStorage.getItem("arka_admin_token");
    const headers = Object.assign({}, opts.headers || {});
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!headers["Content-Type"] && opts.body) headers["Content-Type"] = "application/json";
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    if (res.status === 401 && allowRetry) {
      localStorage.removeItem("arka_admin_token");
      state.token = null;
      await autoLoginByTelegram();
      return api(path, opts, false);
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function renderDayStrip() {
    const wrap = byId("crm-day-strip");
    if (!wrap) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const currentDay = now.getDate();
    let html = "";
    let i;
    for (i = 1; i <= lastDay; i += 1) {
      const d = new Date(year, month, i);
      const dayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const isActive = state.filters.day ? state.filters.day === dayKey : i === currentDay;
      const wd = d.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
      html += `<button class="crm-day-chip ${isActive ? "active" : ""}" data-day="${dayKey}"><b>${i}</b><span>${wd}</span></button>`;
    }
    wrap.innerHTML = html;
  }

  function getStatusGroup(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "Оформлен") return "formed";
    const meta = statusMeta[normalized];
    return meta ? meta.group : "progress";
  }

  function getOrderGroup(order) {
    return getStatusGroup(effectiveOrderStatus(order));
  }

  function renderStatusPills() {
    const wrap = byId("crm-status-pills");
    if (!wrap) return;
    const counters = { new: 0, formed: 0, progress: 0, ready: 0, delivery: 0, done: 0, cancel: 0 };
    let i;
    for (i = 0; i < state.orders.length; i += 1) {
      const key = getOrderGroup(state.orders[i]);
      counters[key] = (counters[key] || 0) + 1;
    }

    const items = [
      { key: "new", title: "Новый заказ" },
      { key: "formed", title: "Оформлен" },
      { key: "progress", title: "В обработке" },
      { key: "ready", title: "Букет готов" },
      { key: "delivery", title: "Доставляется" },
      { key: "done", title: "Выполнен" },
      { key: "cancel", title: "Отменен" }
    ];

    wrap.innerHTML = items
      .map((x) => `<button class="crm-pill ${x.key}" data-pill="${x.key}">${counters[x.key] || 0} ${x.title}</button>`)
      .join("");
  }

  function applyFilters() {
    const f = state.filters;
    const query = (f.query || "").trim().toLowerCase();
    const orderId = (f.orderId || "").trim().toLowerCase();
    const phone = (f.phone || "").trim().toLowerCase();
    const status = state.section === "kanban" ? "" : normalizeStatus(f.status || "");
    const dateFrom = f.dateFrom || "";
    const dateTo = f.dateTo || "";
    const day = f.day || "";

    state.filtered = state.orders.filter((o) => {
      const id = getOrderId(o).toLowerCase();
      const customer = getCustomer(o).toLowerCase();
      const customerPhone = getPhone(o).toLowerCase();
      const s = normalizeStatus(o.status);
      const date = toDateOnly(o.delivery_date || o.deliveryDate || o.date);

      if (query && !(id.includes(query) || customer.includes(query) || customerPhone.includes(query))) return false;
      if (orderId && !id.includes(orderId)) return false;
      if (phone && !customerPhone.includes(phone)) return false;
      if (status && s !== status) return false;
      if (day && date !== day) return false;
      if (dateFrom && date && date < dateFrom) return false;
      if (dateTo && date && date > dateTo) return false;
      return true;
    });
  }

  function renderTable() {
    const tbody = byId("crm-orders-tbody");
    if (!tbody) return;
    applyFilters();

    if (state.menu !== "orders") {
      tbody.innerHTML = `<tr><td colspan="6" class="crm-empty">Раздел "${state.menu}" в разработке. Нажми "Заказы".</td></tr>`;
      renderShownInfo();
      return;
    }

    if (state.section !== "all" && state.section !== "new-client") {
      tbody.innerHTML = `<tr><td colspan="6" class="crm-empty">Раздел "${state.section}" открыт в рабочем режиме меню.</td></tr>`;
      renderShownInfo();
      return;
    }

    if (state.section === "new-client") {
      tbody.innerHTML = "";
      renderShownInfo();
      return;
    }

    if (!state.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="crm-empty">Заказы не найдены.</td></tr>`;
      renderShownInfo();
      return;
    }

    tbody.innerHTML = state.filtered
      .map((o) => {
        const id = escapeHtml(getOrderId(o));
        const type = (o.delivery_type || o.type || "Д").toLowerCase().includes("самовы") ? "С" : "Д";
        const dateText = escapeHtml(formatDateTime(o)).replace("\n", "<br>");
        const customer = escapeHtml(getCustomer(o));
        const phone = escapeHtml(getPhone(o));
        const status = effectiveOrderStatus(o);
        const meta = statusMeta[status] || { css: "crm-status-progress" };
        const amount = escapeHtml(getAmount(o));
        return `
          <tr>
            <td><span class="crm-order-id">${id}</span></td>
            <td><span class="crm-type-dot">${type}</span></td>
            <td>${dateText}</td>
            <td>
              <span class="crm-customer-name">${customer}</span>
              <a class="crm-customer-phone" href="tel:${phone}">${phone || "—"}</a>
            </td>
            <td><span class="crm-status-tag ${meta.css}">${escapeHtml(status)}</span></td>
            <td>${amount}</td>
          </tr>
        `;
      })
      .join("");
    renderShownInfo();
  }

  function renderBoard() {
    const board = byId("crm-orders-board");
    if (!board) return;
    applyFilters();
    const source = state.filtered.slice();
    const html = boardColumns
      .map((col) => {
        const cards = source
          .filter((o) => getOrderGroup(o) === col.key)
          .map((o) => {
            const id = escapeHtml(getOrderId(o));
            const customer = escapeHtml(getCustomer(o));
            const phone = escapeHtml(getPhone(o));
            const time = escapeHtml(formatDateTime(o));
            const amount = escapeHtml(getAmount(o));
            const image = escapeHtml(getOrderImage(o));
            const delivery = getDeliveryLabel(o);
            const deliveryCss = delivery === "Самовывоз" ? "pickup" : "delivery";
            const payment = getPaymentState(o);
            return `
              <article class="crm-board-card" draggable="true" data-order-id="${id}">
                <div class="crm-board-head">
                  <div class="crm-board-image">
                    ${image ? `<img src="${image}" alt="Товар">` : '<div class="crm-board-image-fallback">Фото</div>'}
                  </div>
                  <div>
                    <span class="crm-board-idline">№</span>
                    <span class="crm-board-card-id">${id}</span>
                    <span class="crm-board-card-name">${customer}</span>
                  </div>
                </div>
                <span class="crm-board-phone">${phone || "—"}</span>
                <div class="crm-board-badges">
                  <span class="crm-board-badge ${deliveryCss}">${delivery}</span>
                </div>
                <span class="crm-board-card-meta">${time.replace("\n", "<br>")}</span>
                <div class="crm-board-foot">
                  <span class="crm-board-price">${amount}</span>
                  <span class="crm-board-pay-tag ${payment.css}">${payment.label}</span>
                </div>
                <div class="crm-board-actions">
                  <button class="crm-board-open-btn" data-open-deal="${id}" draggable="false">Открыть</button>
                </div>
              </article>
            `;
          })
          .join("");

        return `
          <section class="crm-board-col col-${col.key}" data-board-col="${col.key}" data-status="${col.status}">
            <div class="crm-board-col-title">${col.title}</div>
            ${cards || '<div class="crm-empty">Нет заказов</div>'}
          </section>
        `;
      })
      .join("");
    board.innerHTML = html;
  }

  function renderDealEditor(orderId) {
    const editor = byId("crm-deal-editor");
    if (!editor) return;
    const order = state.orders.find((x) => String(getOrderId(x)) === String(orderId));
    if (!order) return;
    const id = escapeHtml(getOrderId(order));
    const customer = escapeHtml(getCustomer(order));
    const phone = escapeHtml(getPhone(order) || "");
    const status = escapeHtml(normalizeStatus(order.status));
    const deliveryType = escapeHtml(getDeliveryLabel(order));
    const price = escapeHtml(getAmount(order));
    const date = toDateOnly(order.delivery_date || order.deliveryDate || order.date) || "";
    const time = escapeHtml(order.delivery_time || order.time_slot || "");
    const itemName = escapeHtml(order.item_name || order.product_name || order.title || "Товар");

    editor.classList.remove("crm-hidden");
    editor.innerHTML = `
      <div class="crm-deal-shell">
        <div class="crm-deal-head">
          <div>
            <h2 class="crm-deal-title">Сделка #${id}</h2>
            <span class="crm-deal-subtitle">Редактировать заказ</span>
          </div>
          <button id="crm-deal-close" class="crm-editor-close" aria-label="Закрыть">×</button>
        </div>

        <div class="crm-deal-grid">
          <div>
            <section class="crm-deal-panel">
              <div class="crm-deal-row-2">
                <div>
                  <label class="crm-deal-label">Имя заказчика</label>
                  <input class="crm-deal-input" value="${customer}">
                  <label class="crm-deal-label">Телефон заказчика</label>
                  <input class="crm-deal-input" value="${phone}">
                </div>
                <div>
                  <label class="crm-deal-label">Имя получателя</label>
                  <input class="crm-deal-input" value="${customer}">
                  <label class="crm-deal-label">Телефон получателя</label>
                  <input class="crm-deal-input" value="${phone}">
                </div>
              </div>
              <div class="crm-deal-kpis">
                <span class="crm-deal-kpi">Всего: 1 шт.</span>
                <span class="crm-deal-kpi">Средний чек: ${price}</span>
                <span class="crm-deal-kpi">Выполнено: ${price}</span>
              </div>
            </section>

            <section class="crm-deal-panel" style="margin-top:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong>Состав</strong>
                <button class="crm-btn-blue">Печать чека</button>
              </div>
              <table class="crm-deal-items-table">
                <thead>
                  <tr><th>№</th><th>Название</th><th>Количество</th><th>Цена</th><th>Удалить</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>${itemName}</td>
                    <td>1</td>
                    <td>${price}</td>
                    <td><button class="crm-eye-btn hidden">${eyeIconSvgHtml()}</button></td>
                  </tr>
                </tbody>
              </table>
              <div class="crm-deal-actions">
                <button class="crm-muted-btn">Добавить в заказ</button>
                <span class="crm-chip-light">Товаров на сумму: ${price}</span>
              </div>
              <label class="crm-deal-label">Комментарий флористу</label>
              <textarea class="crm-deal-textarea"></textarea>
            </section>

            <section class="crm-deal-panel" style="margin-top:10px;">
              <strong>Доставка</strong>
              <label class="crm-deal-label">Адрес доставки</label>
              <input class="crm-deal-input" value="${escapeHtml(order.address || "Республика Башкортостан, Уфа")}">
              <div class="crm-deal-row-3" style="margin-top:8px;">
                <div><label class="crm-deal-label">Дата доставки</label><input class="crm-deal-input" value="${date}"></div>
                <div><label class="crm-deal-label">Начало интервала</label><input class="crm-deal-input" value="${time || "18:00"}"></div>
                <div><label class="crm-deal-label">Конец интервала</label><input class="crm-deal-input" value="${time || "21:00"}"></div>
              </div>
            </section>
          </div>

          <aside>
            <section class="crm-deal-panel">
              <label class="crm-deal-label">Менеджер принял</label>
              <input class="crm-deal-input" value="dsadas">
              <label class="crm-deal-label">Статус заказа</label>
              <select class="crm-deal-select"><option>${status}</option></select>
              <label class="crm-deal-label">Тип доставки</label>
              <select class="crm-deal-select"><option>${deliveryType}</option></select>
              <label class="crm-deal-label">Время и дата заказа</label>
              <div class="crm-deal-row-2">
                <input class="crm-deal-input" value="${date}">
                <input class="crm-deal-input" value="${time}">
              </div>
              <label class="crm-deal-label">Комментарии</label>
              <textarea class="crm-deal-textarea">спасибо тебе за всю нежность...</textarea>
            </section>
          </aside>
        </div>

        <div class="crm-editor-actions">
          <button id="crm-deal-save" class="crm-btn-blue">Сохранить</button>
          <button id="crm-deal-cancel" class="crm-btn-pink">Закрыть</button>
        </div>
      </div>
    `;
  }

  function renderOrdersSubmenu() {
    const submenu = byId("crm-orders-submenu");
    const toggle = byId("crm-orders-toggle");
    if (!submenu || !toggle) return;
    submenu.classList.toggle("is-open", state.ordersSubmenuOpen);
    toggle.setAttribute("aria-expanded", String(state.ordersSubmenuOpen));
  }

  function renderProductsSubmenu() {
    const submenu = byId("crm-products-submenu");
    const toggle = byId("crm-products-toggle");
    if (!submenu || !toggle) return;
    submenu.classList.toggle("is-open", state.productsSubmenuOpen);
    toggle.setAttribute("aria-expanded", String(state.productsSubmenuOpen));
  }

  function renderPeopleSubmenu() {
    const submenu = byId("crm-people-submenu");
    const toggle = byId("crm-people-toggle");
    if (!submenu || !toggle) return;
    submenu.classList.toggle("is-open", state.peopleSubmenuOpen);
    toggle.setAttribute("aria-expanded", String(state.peopleSubmenuOpen));
  }

  function getFilteredCategories() {
    const all = state.productCategories;
    const q = (state.productFilters.query || "").trim().toLowerCase();
    if (!q) return all;
    return all.filter((x) => x.name.toLowerCase().includes(q));
  }

  function getFilteredProducts() {
    const all = state.productItems;
    const q = (state.productFilters.query || "").trim().toLowerCase();
    const category = (state.productFilters.category || "").trim();
    return all.filter((x) => {
      const inText = !q || x.name.toLowerCase().includes(q) || String(x.id).includes(q);
      const inCategory = !category || x.categories.includes(category);
      return inText && inCategory;
    });
  }

  function eyeIconSvgHtml() {
    return `
      <svg class="crm-eye-on" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12Z"></path>
        <circle cx="12" cy="12" r="3.2"></circle>
      </svg>
      <svg class="crm-eye-off" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3l18 18"></path>
        <path d="M10.7 5.2A11.5 11.5 0 0 1 12 5c6.2 0 10 7 10 7a19.6 19.6 0 0 1-3.6 4.3"></path>
        <path d="M6.2 6.3A20.3 20.3 0 0 0 2 12s3.8 7 10 7a9.6 9.6 0 0 0 4.2-1"></path>
        <path d="M14.1 14.1A3 3 0 0 1 10 10"></path>
      </svg>
    `;
  }

  function renderProductCategoriesView() {
    const root = byId("crm-products-view");
    if (!root) return;
    const list = getFilteredCategories();
    if (state.categoryViewMode === "grid") {
      root.innerHTML = `
        <h2 class="crm-section-title">Категории</h2>
        <div class="crm-product-filters" style="grid-template-columns: 1fr auto auto auto;">
          <input id="crm-category-search" type="text" placeholder="Поиск по категории: Найти..." value="${escapeHtml(state.productFilters.query || "")}">
          <button id="crm-category-apply" class="crm-btn-blue">Применить фильтр</button>
          <button id="crm-category-reset" class="crm-btn-pink">Сбросить фильтры</button>
          <div class="crm-layout-toggle">
            <button class="crm-icon-btn" data-cat-view="table" aria-label="Таблица">☰</button>
            <button class="crm-icon-btn active" data-cat-view="grid" aria-label="Плитка">◫</button>
          </div>
        </div>
        <div class="crm-categories-grid">
          ${list.map((x) => `
            <article class="crm-category-card ${x.visible ? "" : "crm-row-hidden"}">
              <div class="crm-category-card-title">${escapeHtml(x.name)}</div>
              <div class="crm-category-card-meta">Порядок: ${x.sort}</div>
              <div class="crm-category-card-meta">Родитель: ${escapeHtml(x.parent)}</div>
              <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
                <span class="crm-chip-light">См. товары</span>
                <button class="crm-eye-btn ${x.visible ? "" : "hidden"}" data-cat-visibility="${x.id}" title="${x.visible ? "Скрыть" : "Показать"}">${eyeIconSvgHtml()}</button>
              </div>
            </article>
          `).join("")}
        </div>
      `;
      return;
    }
    root.innerHTML = `
      <h2 class="crm-section-title">Категории</h2>
      <div class="crm-product-filters" style="grid-template-columns: 1fr auto auto auto;">
        <input id="crm-category-search" type="text" placeholder="Поиск по категории: Найти..." value="${escapeHtml(state.productFilters.query || "")}">
        <button id="crm-category-apply" class="crm-btn-blue">Применить фильтр</button>
        <button id="crm-category-reset" class="crm-btn-pink">Сбросить фильтры</button>
        <div class="crm-layout-toggle">
          <button class="crm-icon-btn active" data-cat-view="table" aria-label="Таблица">☰</button>
          <button class="crm-icon-btn" data-cat-view="grid" aria-label="Плитка">◫</button>
        </div>
      </div>
      <div class="crm-product-tools">
        <button class="crm-muted-btn">Изменить</button>
      </div>
      <table class="crm-products-table">
        <thead>
          <tr>
            <th>Наименование</th>
            <th>Порядок</th>
            <th>Родитель</th>
            <th>В Товары</th>
            <th>Видимость</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((x) => `
            <tr class="${x.visible ? "" : "crm-row-hidden"}">
              <td><span class="crm-cat-name">${escapeHtml(x.name)}</span></td>
              <td>${x.sort}</td>
              <td>${escapeHtml(x.parent)}</td>
              <td><span class="crm-chip-light">См. товары</span></td>
              <td><button class="crm-eye-btn ${x.visible ? "" : "hidden"}" data-cat-visibility="${x.id}" title="${x.visible ? "Скрыть" : "Показать"}">${eyeIconSvgHtml()}</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderProductsItemsView() {
    const root = byId("crm-products-view");
    if (!root) return;
    const categories = Array.from(new Set(state.productItems.flatMap((x) => x.categories))).sort((a, b) => a.localeCompare(b, "ru"));
    const list = getFilteredProducts();
    if (state.productViewMode === "grid") {
      root.innerHTML = `
        <h2 class="crm-section-title">Товары</h2>
        <div class="crm-product-filters">
          <input id="crm-products-search" type="text" placeholder="Поиск по товарам" value="${escapeHtml(state.productFilters.query || "")}">
          <select id="crm-products-category">
            <option value="">Категория товара</option>
            ${categories.map((x) => `<option value="${escapeHtml(x)}" ${state.productFilters.category === x ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}
          </select>
          <button id="crm-products-apply" class="crm-btn-blue">Применить фильтр</button>
          <button id="crm-products-reset" class="crm-btn-pink">Сбросить фильтры</button>
        </div>
        <div class="crm-product-tools">
          <button class="crm-muted-btn">Изменить</button>
          <div class="crm-layout-toggle">
            <button class="crm-icon-btn" data-prod-view="table" aria-label="Таблица">☰</button>
            <button class="crm-icon-btn active" data-prod-view="grid" aria-label="Плитка">◫</button>
          </div>
        </div>
        <div class="crm-empty">Плитка включена. Контент можно расширить следующим шагом.</div>
      `;
      return;
    }

    root.innerHTML = `
      <h2 class="crm-section-title">Товары</h2>
      <div class="crm-product-filters">
        <input id="crm-products-search" type="text" placeholder="Поиск по товарам" value="${escapeHtml(state.productFilters.query || "")}">
        <select id="crm-products-category">
          <option value="">Категория товара</option>
          ${categories.map((x) => `<option value="${escapeHtml(x)}" ${state.productFilters.category === x ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}
        </select>
        <button id="crm-products-apply" class="crm-btn-blue">Применить фильтр</button>
        <button id="crm-products-reset" class="crm-btn-pink">Сбросить фильтры</button>
      </div>
      <div class="crm-product-tools">
        <button class="crm-muted-btn">Изменить</button>
        <div class="crm-layout-toggle">
          <button class="crm-icon-btn active" data-prod-view="table" aria-label="Таблица">☰</button>
          <button class="crm-icon-btn" data-prod-view="grid" aria-label="Плитка">◫</button>
        </div>
      </div>
      <table class="crm-products-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Фото | Наименование | Доступность</th>
            <th>Категории</th>
            <th>Цена</th>
            <th>Видимость</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((x) => `
            <tr class="${x.visible ? "" : "crm-row-hidden"} crm-row-clickable" data-open-product="${x.id}">
              <td><a class="crm-link-id" href="javascript:void(0)">${x.id}</a></td>
              <td>
                <div class="crm-prod-main">
                  ${x.image ? `<img class="crm-prod-thumb" src="${escapeHtml(x.image)}" alt="Товар">` : `<div class="crm-prod-thumb"></div>`}
                  <div>
                    <div class="crm-prod-name">${escapeHtml(x.name)}</div>
                    <span class="crm-prod-sku">Арт. ${escapeHtml(x.sku)}</span>
                    <span class="crm-stock-pill"><span class="crm-stock-dot"></span>Доступно ${x.stock}шт.</span>
                  </div>
                </div>
              </td>
              <td><span class="crm-prod-categories">${escapeHtml(x.categories.join(" | "))}</span></td>
              <td>
                ${x.price} руб.
                ${x.discount ? '<div class="crm-discount-pill">Скидка</div>' : ""}
              </td>
              <td><button class="crm-eye-btn ${x.visible ? "" : "hidden"}" data-prod-visibility="${x.id}" title="${x.visible ? "Скрыть" : "Показать"}">${eyeIconSvgHtml()}</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderProductEditor(productId) {
    const editor = byId("crm-product-editor");
    if (!editor) return;
    const product = state.productItems.find((x) => Number(x.id) === Number(productId));
    if (!product) return;
    state.editorProductId = Number(productId);
    const categoryLabels = createMockProductCategories().map((x) => x.name);
    editor.classList.remove("crm-hidden");
    editor.innerHTML = `
      <div class="crm-editor-shell">
        <div class="crm-editor-head">
          <div>
            <div class="crm-editor-title">${escapeHtml(product.name)}</div>
            <span class="crm-editor-subtitle">Редактировать товар</span>
          </div>
          <button id="crm-editor-close" class="crm-editor-close" aria-label="Закрыть">×</button>
        </div>

        <div class="crm-editor-grid">
          <div>
            <section class="crm-editor-block">
              <h4>Общие</h4>
              <input class="crm-editor-input" value="${escapeHtml(product.name)}" placeholder="Наименование">
              <div style="height:8px"></div>
              <textarea class="crm-editor-textarea" placeholder="Описание">Описание товара ${escapeHtml(product.name)}</textarea>
            </section>
            <section class="crm-editor-block">
              <h4>Изображение</h4>
              <div class="crm-editor-image-row">
                <div class="crm-editor-image-slot" data-upload-image>
                  <div>Добавить</div>
                </div>
                <div class="crm-editor-image-slot">${product.image ? `<img src="${escapeHtml(product.image)}" alt="Товар">` : "Фото"}</div>
              </div>
              <input id="crm-editor-file-input" type="file" accept="image/*" class="crm-hidden">
              <div style="margin-top:6px;color:#7f8ba2;font-size:12px;">Можно перетащить изображение с рабочего стола прямо в блок "Добавить".</div>
            </section>
            <section class="crm-editor-block crm-editor-two-col">
              <div>
                <h4>Фильтр: Цвет</h4>
                <label><input type="checkbox"> Красный</label><br>
                <label><input type="checkbox"> Нежный</label><br>
                <label><input type="checkbox" checked> Розовый</label><br>
                <label><input type="checkbox"> Кремовый</label>
              </div>
              <div>
                <h4>Фильтр: Для кого</h4>
                <label><input type="checkbox"> Маме</label><br>
                <label><input type="checkbox"> Девушке</label><br>
                <label><input type="checkbox" checked> Мужчине</label><br>
                <label><input type="checkbox"> Ребенку</label>
              </div>
            </section>
          </div>
          <aside>
            <section class="crm-editor-block">
              <h4>Настройки</h4>
              <input class="crm-editor-input" value="${product.price}" placeholder="Цена">
              <div style="height:8px"></div>
              <input class="crm-editor-input" value="${product.discount ? Math.round(product.price * 0.9) : product.price}" placeholder="Цена со скидкой">
              <div style="height:8px"></div>
              <input class="crm-editor-input" value="${product.discount ? 10 : 0}" placeholder="Процент скидки">
              <div style="height:8px"></div>
              <label style="display:flex;align-items:center;gap:8px;color:#5f6f8e;font-size:13px;"><input type="checkbox" ${product.visible ? "checked" : ""}> Товар показывается</label>
            </section>
            <section class="crm-editor-block">
              <h4>Родительская категория</h4>
              <div class="crm-editor-checklist">
                ${categoryLabels.map((x) => `<label><input type="checkbox" ${product.categories.includes(x) ? "checked" : ""}>${escapeHtml(x)}</label>`).join("")}
              </div>
            </section>
          </aside>
        </div>
        <div class="crm-editor-actions">
          <button id="crm-editor-cancel" class="crm-btn-pink">Отмена</button>
          <button id="crm-editor-save" class="crm-btn-blue">Сохранить и выйти</button>
        </div>
      </div>
    `;
  }

  function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });
  }

  async function applyEditorImageFile(file) {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setNotice("Нужен файл изображения (png, jpg, webp и т.д.).", "warn");
      return;
    }
    const product = state.productItems.find((x) => Number(x.id) === Number(state.editorProductId));
    if (!product) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      if (!dataUrl) return;
      product.image = dataUrl;
      renderProductEditor(product.id);
      renderProductsView();
      setNotice("Изображение применено.", "info");
    } catch (_) {
      setNotice("Ошибка загрузки изображения.", "warn");
    }
  }

  function formatRub(value) {
    return `${Number(value || 0)} Руб`;
  }

  function getGlobalPeopleMetrics() {
    const totalRevenue = state.clients.reduce((acc, x) => acc + Number(x.paid || 0), 0);
    const totalOrders = state.clients.reduce((acc, x) => acc + Number(x.purchases || 0), 0);
    return {
      dayRevenue: Math.round(totalRevenue * 0.08),
      monthRevenue: Math.round(totalRevenue * 0.46),
      yearRevenue: totalRevenue,
      dayOrders: Math.max(1, Math.round(totalOrders * 0.06)),
      monthOrders: Math.max(2, Math.round(totalOrders * 0.41)),
      yearOrders: totalOrders
    };
  }

  function renderStaffView() {
    const root = byId("crm-people-view");
    if (!root) return;
    const tabs = ["Все", "Админ", "Менеджер", "Курьер", "Флорист"];
    const activeRole = state.staffRoleFilter;
    const list = state.staff.filter((x) => activeRole === "all" || x.role === activeRole);
    root.innerHTML = `
      <h2 class="crm-section-title">База сотрудников</h2>
      <div class="crm-tabs-row">
        ${tabs.map((x, idx) => `<button class="crm-role-tab ${((idx === 0 && activeRole === "all") || activeRole === x) ? "active" : ""}" data-staff-role="${idx === 0 ? "all" : x}">${x}</button>`).join("")}
        <button id="crm-add-staff" class="crm-btn-blue">+ Пользователь</button>
      </div>
      <table class="crm-products-table">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Дата</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((x) => `
            <tr>
              <td><div class="crm-user-cell"><span class="crm-user-avatar"></span><div><div class="crm-prod-name">${escapeHtml(x.name)}</div><span class="crm-prod-sku">${escapeHtml(x.login)}</span></div></div></td>
              <td>Вход: ${escapeHtml(x.lastLogin)}<br><span class="crm-prod-sku">Рег: ${escapeHtml(x.registered)}</span></td>
              <td><span class="crm-status-tag ${x.role === "Курьер" ? "crm-status-progress" : "crm-status-done"}">${escapeHtml(x.role)}</span></td>
              <td><button class="crm-muted-btn">Статус</button> <button class="crm-icon-plain">🗑</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderClientDetail(clientId) {
    const editor = byId("crm-client-editor");
    if (!editor) return;
    const client = state.clients.find((x) => Number(x.id) === Number(clientId));
    if (!client) return;
    const buyout = Number(client.buyout || 0);
    const paidOrders = Math.max(0, Math.round((client.purchases || 0) * buyout / 100));
    const avg = client.purchases ? Math.round((client.paid || 0) / client.purchases) : 0;
    editor.classList.remove("crm-hidden");
    editor.innerHTML = `
      <div class="crm-deal-shell">
        <div class="crm-deal-head">
          <div>
            <h2 class="crm-deal-title">Пользователь #${client.id}</h2>
          </div>
          <button id="crm-client-close" class="crm-editor-close">×</button>
        </div>
        <section class="crm-deal-panel">
          <label class="crm-deal-label">Номер клиента</label>
          <input class="crm-deal-input" value="+7 (${client.phone.slice(0,3)}) ${client.phone.slice(3)}">
          <label class="crm-deal-label">Имя заказчика</label>
          <input class="crm-deal-input" value="${escapeHtml(client.name)}">
          <label class="crm-deal-label">Email</label>
          <input class="crm-deal-input" value="${escapeHtml(client.email || "")}">
          <label class="crm-deal-label">Комментарий к клиенту</label>
          <textarea class="crm-deal-textarea">${escapeHtml(client.comment || "")}</textarea>
        </section>
        <section class="crm-deal-panel" style="margin-top:10px;">
          <strong>Информация</strong>
          <div class="crm-deal-kpis">
            <span class="crm-deal-kpi">Всего: ${client.purchases} шт.</span>
            <span class="crm-deal-kpi">Оплачено заказов: ${paidOrders} шт.</span>
            <span class="crm-deal-kpi">Средний чек: ${avg} руб.</span>
            <span class="crm-deal-kpi">Выкуплено: ${client.paid} руб.</span>
          </div>
          <div class="crm-buyout-chart" style="--buyout:${buyout};"><span>${buyout}%</span></div>
          <div class="crm-chip-light">Процент выкупа: ${buyout}%</div>
        </section>
        <section class="crm-deal-panel" style="margin-top:10px;">
          <strong>Заказы пользователя</strong>
          <table class="crm-deal-items-table">
            <thead><tr><th>Номер</th><th>Дата</th><th>Статус</th><th>Цена</th></tr></thead>
            <tbody>
              <tr><td>#11544</td><td>26 Мар 2025<br>10:00-11:00</td><td><span class="crm-status-tag crm-status-new">Новый заказ</span></td><td>${Math.max(2190, avg)} ₽</td></tr>
              <tr><td>#11543</td><td>26 Мар 2025<br>10:00-11:00</td><td><span class="crm-status-tag crm-status-ready">Букет готов</span></td><td>${Math.max(1990, avg)} ₽</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    `;
  }

  function renderClientsView() {
    const root = byId("crm-people-view");
    if (!root) return;
    const metrics = getGlobalPeopleMetrics();
    root.innerHTML = `
      <h2 class="crm-section-title">База клиентов</h2>
      <div class="crm-deal-kpis" style="margin-bottom:10px;">
        <span class="crm-deal-kpi">Выручка день: ${formatRub(metrics.dayRevenue)}</span>
        <span class="crm-deal-kpi">Выручка месяц: ${formatRub(metrics.monthRevenue)}</span>
        <span class="crm-deal-kpi">Выручка год: ${formatRub(metrics.yearRevenue)}</span>
        <span class="crm-deal-kpi">Заказы день: ${metrics.dayOrders}</span>
        <span class="crm-deal-kpi">Заказы месяц: ${metrics.monthOrders}</span>
        <span class="crm-deal-kpi">Заказы год: ${metrics.yearOrders}</span>
      </div>
      <table class="crm-products-table">
        <thead>
          <tr>
            <th>Имя</th><th>Покупок</th><th>Оплачено</th><th>Дата</th><th>Статус</th><th>Действия</th>
          </tr>
        </thead>
        <tbody>
          ${state.clients.map((x) => `
            <tr class="crm-row-clickable" data-open-client="${x.id}">
              <td><div class="crm-user-cell"><span class="crm-user-avatar"></span><div><div class="crm-prod-name">${escapeHtml(x.name)}</div><span class="crm-prod-sku">${escapeHtml(x.phone)}</span></div></div></td>
              <td><span class="crm-status-tag crm-status-delivery">${x.purchases} шт</span></td>
              <td><span class="crm-status-tag crm-status-progress">${x.paid} Руб</span></td>
              <td>Вход: ${escapeHtml(x.lastLogin)}<br><span class="crm-prod-sku">Рег: ${escapeHtml(x.registered)}</span></td>
              <td><span class="crm-status-tag crm-status-new">${x.status}</span></td>
              <td><button class="crm-icon-plain" data-open-client="${x.id}">👁</button> <button class="crm-icon-plain">✎</button> <button class="crm-icon-plain">🗑</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderPeopleView() {
    const root = byId("crm-people-view");
    if (!root) return;
    if (state.menu !== "people") {
      root.classList.add("crm-hidden");
      return;
    }
    root.classList.remove("crm-hidden");
    if (state.section === "people-staff") {
      renderStaffView();
      return;
    }
    renderClientsView();
  }

  function seededRatio(index) {
    const seed = (index + 1) * 7 + state.analytics.tick * 3 + state.orders.length;
    return 0.52 + ((seed % 37) / 100);
  }

  function getAnalyticsBuckets() {
    const period = state.analytics.period;
    if (period === "day") {
      return ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];
    }
    if (period === "year") {
      return ["2023", "2024", "2025"];
    }
    return ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  }

  function getAnalyticsData() {
    const orders = state.orders.length || 1;
    const clients = state.clients.length || 1;
    const totalRevenue = state.clients.reduce((acc, x) => acc + Number(x.paid || 0), 0) || 10000;
    const baseOrders = state.clients.reduce((acc, x) => acc + Number(x.purchases || 0), 0) || orders;
    const cancelCount = state.orders.filter((x) => normalizeStatus(x.status) === "Отменен").length;
    const cancelRate = Math.round((cancelCount / Math.max(1, state.orders.length)) * 100);
    const avgCheck = Math.round(totalRevenue / Math.max(1, baseOrders));
    const buckets = getAnalyticsBuckets();

    const values = buckets.map((_, idx) => {
      const ratio = seededRatio(idx);
      return Math.max(1, Math.round((totalRevenue / buckets.length) * ratio));
    });
    const max = Math.max(...values);

    const byStatusRaw = [
      { status: "Новый", count: state.orders.filter((x) => getStatusGroup(x.status) === "new").length },
      { status: "В обработке", count: state.orders.filter((x) => getStatusGroup(x.status) === "progress").length },
      { status: "Букет готов", count: state.orders.filter((x) => getStatusGroup(x.status) === "ready").length },
      { status: "Доставляется", count: state.orders.filter((x) => getStatusGroup(x.status) === "delivery").length },
      { status: "Выполнен", count: state.orders.filter((x) => getStatusGroup(x.status) === "done").length },
      { status: "Отменен", count: state.orders.filter((x) => getStatusGroup(x.status) === "cancel").length }
    ];

    const baseChannels = [
      { channel: "Сайт", orders: Math.round(baseOrders * 0.43), revenue: Math.round(totalRevenue * 0.45) },
      { channel: "Mini App", orders: Math.round(baseOrders * 0.36), revenue: Math.round(totalRevenue * 0.34) },
      { channel: "Instagram", orders: Math.round(baseOrders * 0.12), revenue: Math.round(totalRevenue * 0.11) },
      { channel: "Звонок", orders: Math.max(1, Math.round(baseOrders * 0.09)), revenue: Math.round(totalRevenue * 0.1) }
    ];

    const selectedChannel = state.analytics.channel;
    const channels = selectedChannel === "all" ? baseChannels : baseChannels.filter((x) => x.channel === selectedChannel);

    return {
      kpi: {
        revenue: totalRevenue,
        orders: baseOrders,
        avgCheck,
        cancelRate,
        clients
      },
      bars: buckets.map((x, i) => ({ label: x, value: values[i], pct: Math.round((values[i] / max) * 100) })),
      byStatus: byStatusRaw,
      channels
    };
  }

  function renderAnalyticsView() {
    const root = byId("crm-analytics-view");
    if (!root) return;
    if (state.menu !== "analytics") {
      root.classList.add("crm-hidden");
      return;
    }
    root.classList.remove("crm-hidden");
    const data = getAnalyticsData();
    const p = state.analytics.period;
    const c = state.analytics.channel;
    root.innerHTML = `
      <h2 class="crm-section-title">Аналитика</h2>
      <div class="crm-analytics-controls">
        <div class="crm-segment">
          <button class="${p === "day" ? "active" : ""}" data-analytics-period="day">День</button>
          <button class="${p === "month" ? "active" : ""}" data-analytics-period="month">Месяц</button>
          <button class="${p === "year" ? "active" : ""}" data-analytics-period="year">Год</button>
        </div>
        <select id="crm-analytics-channel" class="crm-analytics-select">
          <option value="all" ${c === "all" ? "selected" : ""}>Все источники</option>
          <option value="Сайт" ${c === "Сайт" ? "selected" : ""}>Сайт</option>
          <option value="Mini App" ${c === "Mini App" ? "selected" : ""}>Mini App</option>
          <option value="Instagram" ${c === "Instagram" ? "selected" : ""}>Instagram</option>
          <option value="Звонок" ${c === "Звонок" ? "selected" : ""}>Звонок</option>
        </select>
        <button id="crm-analytics-refresh" class="crm-btn-blue">Обновить</button>
      </div>
      <div class="crm-kpi-grid">
        <article class="crm-kpi-card"><div class="crm-kpi-card-title">Выручка</div><div class="crm-kpi-card-value">${data.kpi.revenue} ₽</div></article>
        <article class="crm-kpi-card"><div class="crm-kpi-card-title">Заказы</div><div class="crm-kpi-card-value">${data.kpi.orders}</div></article>
        <article class="crm-kpi-card"><div class="crm-kpi-card-title">Средний чек</div><div class="crm-kpi-card-value">${data.kpi.avgCheck} ₽</div></article>
        <article class="crm-kpi-card"><div class="crm-kpi-card-title">Отмены</div><div class="crm-kpi-card-value">${data.kpi.cancelRate}%</div></article>
      </div>
      <div class="crm-analytics-grid">
        <section class="crm-analytics-panel">
          <h4>Динамика выручки</h4>
          <div class="crm-bars">
            ${data.bars.map((x) => `<div class="crm-bar-item"><span>${x.label}</span><div class="crm-bar-track"><div class="crm-bar-fill" style="width:${x.pct}%;"></div></div><strong>${x.value}</strong></div>`).join("")}
          </div>
        </section>
        <section class="crm-analytics-panel">
          <h4>Статусы заказов</h4>
          <table class="crm-analytics-table">
            <thead><tr><th>Статус</th><th>Количество</th></tr></thead>
            <tbody>
              ${data.byStatus.map((x) => `<tr><td>${x.status}</td><td>${x.count}</td></tr>`).join("")}
            </tbody>
          </table>
        </section>
      </div>
      <section class="crm-analytics-panel" style="margin-top:10px;">
        <h4>Источники</h4>
        <table class="crm-analytics-table">
          <thead><tr><th>Источник</th><th>Заказы</th><th>Выручка</th></tr></thead>
          <tbody>
            ${data.channels.map((x) => `<tr><td>${x.channel}</td><td>${x.orders}</td><td>${x.revenue} ₽</td></tr>`).join("")}
          </tbody>
        </table>
      </section>
    `;
  }

  function renderProductsView() {
    const root = byId("crm-products-view");
    if (!root) return;
    if (state.menu !== "products") {
      root.classList.add("crm-hidden");
      return;
    }
    root.classList.remove("crm-hidden");
    if (state.section === "product-items") {
      renderProductsItemsView();
      return;
    }
    if (state.section === "product-stock" || state.section === "product-filters" || state.section === "product-tags") {
      root.innerHTML = `<h2 class="crm-section-title">${state.section === "product-stock" ? "Остатки" : state.section === "product-filters" ? "Фильтры" : "Теги"}</h2><div class="crm-empty">Раздел в процессе наполнения.</div>`;
      return;
    }
    renderProductCategoriesView();
  }

  function renderNewClientOrderView() {
    const root = byId("crm-new-client-order-view");
    if (!root) return;

    root.innerHTML = `
      <div class="crm-nco-inner">
        <div class="crm-nco-head">
          <button type="button" class="crm-nco-back" id="crm-nco-back">← Назад</button>
          <div class="crm-nco-titles">
            <h1 class="crm-nco-title">Новый клиент</h1>
            <p class="crm-nco-sub">Карточка клиента и оформление заказа на одном экране</p>
          </div>
        </div>

        <div class="crm-nco-grid">
          <div class="crm-nco-panel">
            <h2 class="crm-nco-panel-title">Информация о клиенте</h2>

            <div class="crm-nco-field">
              <label class="crm-nco-label" for="crm-nco-client-name">Имя <span class="req">*</span></label>
              <input class="crm-nco-input" id="crm-nco-client-name" maxlength="64" placeholder="Имя" autocomplete="name">
              <div class="crm-nco-counter"><span id="crm-nco-cnt-name">0</span>/64</div>
            </div>

            <div class="crm-nco-field">
              <label class="crm-nco-label">Телефон <span class="req">*</span></label>
              <div class="crm-nco-row-phone">
                <select class="crm-nco-select" id="crm-nco-phone-cc" aria-label="Код страны">
                  <option value="+7">+7 (Россия)</option>
                  <option value="+375">+375 (Беларусь)</option>
                  <option value="+7">+7 (Казахстан)</option>
                </select>
                <input class="crm-nco-input" id="crm-nco-client-phone" type="tel" placeholder="900 000-00-00" autocomplete="tel">
              </div>
            </div>

            <div class="crm-nco-field">
              <label class="crm-nco-label" for="crm-nco-client-email">Email</label>
              <input class="crm-nco-input" id="crm-nco-client-email" type="email" maxlength="64" placeholder="email@example.com" autocomplete="email">
              <div class="crm-nco-counter"><span id="crm-nco-cnt-email">0</span>/64</div>
            </div>

            <div class="crm-nco-row-2">
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-gender">Пол <span class="req">*</span></label>
                <select class="crm-nco-select" id="crm-nco-gender">
                  <option value="">Не определён</option>
                  <option value="f">Женский</option>
                  <option value="m">Мужской</option>
                </select>
              </div>
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-legal">Тип лица</label>
                <select class="crm-nco-select" id="crm-nco-legal">
                  <option value="person">Физическое лицо</option>
                  <option value="company">Юридическое лицо</option>
                </select>
              </div>
            </div>

            <div class="crm-nco-field">
              <label class="crm-nco-label" for="crm-nco-insta">Инстаграм</label>
              <input class="crm-nco-input" id="crm-nco-insta" maxlength="64" placeholder="@nickname">
              <div class="crm-nco-counter"><span id="crm-nco-cnt-insta">0</span>/64</div>
            </div>

            <div class="crm-nco-field">
              <label class="crm-nco-label" for="crm-nco-birth">Дата рождения</label>
              <input class="crm-nco-input" id="crm-nco-birth" type="date">
            </div>

            <div class="crm-nco-row-2">
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-source">Откуда узнал о нас</label>
                <select class="crm-nco-select" id="crm-nco-source">
                  <option value="">Выберите</option>
                  <option value="site">Сайт</option>
                  <option value="tg">Telegram</option>
                  <option value="inst">Instagram</option>
                  <option value="friend">Рекомендация</option>
                </select>
              </div>
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-pref">Предпочтения</label>
                <select class="crm-nco-select" id="crm-nco-pref">
                  <option value="">Выберите</option>
                  <option value="mono">Монобукеты</option>
                  <option value="mix">Смешанные</option>
                  <option value="premium">Премиум</option>
                </select>
              </div>
            </div>

            <div class="crm-nco-field">
              <label class="crm-nco-label" for="crm-nco-card">Номер карты</label>
              <input class="crm-nco-input" id="crm-nco-card" maxlength="32" placeholder="Карта лояльности" autocomplete="off">
              <div class="crm-nco-counter"><span id="crm-nco-cnt-card">0</span>/32</div>
            </div>

            <div class="crm-nco-field">
              <label class="crm-nco-label" for="crm-nco-client-notes">Комментарий</label>
              <textarea class="crm-nco-textarea" id="crm-nco-client-notes" maxlength="500" placeholder="Заметки о клиенте"></textarea>
              <div class="crm-nco-counter"><span id="crm-nco-cnt-notes">0</span>/500</div>
            </div>
          </div>

          <div class="crm-nco-panel">
            <h2 class="crm-nco-panel-title">Информация о заказе</h2>

            <div class="crm-nco-field">
              <label class="crm-nco-label" for="crm-nco-order-client">Клиент</label>
              <div class="crm-nco-inline-actions">
                <select class="crm-nco-select" id="crm-nco-order-client" style="flex:1; min-width:0;">
                  <option value="new">Новый клиент — заполните форму слева</option>
                </select>
                <button type="button" class="crm-nco-btn-outline" id="crm-nco-focus-client" title="Перейти к полям клиента">Добавить нового клиента</button>
              </div>
            </div>

            <div class="crm-nco-row-2">
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-budget">Бюджет</label>
                <input class="crm-nco-input" id="crm-nco-budget" placeholder="0 ₽">
              </div>
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-deal-source">Источник сделки <span class="req">*</span></label>
                <select class="crm-nco-select" id="crm-nco-deal-source">
                  <option value="terminal">Терминал</option>
                  <option value="site">Сайт</option>
                  <option value="tg">Telegram</option>
                  <option value="phone">Телефон</option>
                </select>
              </div>
            </div>

            <div class="crm-nco-field">
              <label class="crm-nco-label" for="crm-nco-pos">Точка продаж <span class="req">*</span></label>
              <select class="crm-nco-select" id="crm-nco-pos">
                <option value="main">Основная</option>
                <option value="site">Сайт</option>
                <option value="mini">Мини-приложение</option>
              </select>
            </div>

            <div class="crm-nco-sbp">
              <span class="crm-nco-sbp-title">Формирование ссылки СБП</span>
              <button type="button" class="crm-nco-btn-purple" id="crm-nco-sbp-connect">Подключить</button>
            </div>

            <div class="crm-nco-advances">
              <span class="crm-nco-label" style="margin-bottom:6px;">Авансы</span>
              <a href="#" id="crm-nco-add-advance">+ Добавить аванс</a>
            </div>

            <div class="crm-nco-field">
              <label class="crm-nco-label">Изображение к заказу</label>
              <div class="crm-nco-upload" id="crm-nco-upload" tabindex="0" role="button" aria-label="Загрузить изображение">
                <span>Чтобы добавить изображение, нажмите или перетащите файл</span>
                <span style="font-size:12px;">PNG, JPG до 10 МБ</span>
              </div>
              <input type="file" id="crm-nco-upload-input" accept="image/*" class="crm-hidden" aria-hidden="true">
            </div>

            <div class="crm-nco-field">
              <label class="crm-nco-label" for="crm-nco-wishes">Пожелания заказчика</label>
              <textarea class="crm-nco-textarea" id="crm-nco-wishes" style="min-height:88px;" placeholder="Пожелания, стиль, повод…"></textarea>
            </div>

            <div class="crm-nco-field">
              <span class="crm-nco-label">Теги</span>
              <div class="crm-nco-tags" id="crm-nco-tags">
                <button type="button" class="crm-nco-tag" data-tag="Моно">Моно</button>
                <button type="button" class="crm-nco-tag" data-tag="Маленький">Маленький</button>
                <button type="button" class="crm-nco-tag" data-tag="WOW эффект">WOW эффект</button>
                <button type="button" class="crm-nco-tag" data-tag="Нежный">Нежный</button>
                <button type="button" class="crm-nco-tag" data-tag="Большой">Большой</button>
                <button type="button" class="crm-nco-tag" data-tag="Девушке">Девушке</button>
                <button type="button" class="crm-nco-tag" data-tag="Маме">Маме</button>
                <button type="button" class="crm-nco-tag" data-tag="Бабушке">Бабушке</button>
              </div>
            </div>

            <div class="crm-nco-row-2">
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-exec-date">Дата исполнения</label>
                <input class="crm-nco-input" id="crm-nco-exec-date" type="date">
              </div>
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-exec-time">Время исполнения</label>
                <input class="crm-nco-input" id="crm-nco-exec-time" type="time">
              </div>
            </div>

            <div class="crm-nco-field">
              <span class="crm-nco-label">Тип</span>
              <div class="crm-nco-radio-row">
                <label class="crm-nco-radio"><input type="radio" name="crm-nco-delivery-type" value="delivery" checked> Доставка</label>
                <label class="crm-nco-radio"><input type="radio" name="crm-nco-delivery-type" value="pickup"> Самовывоз</label>
              </div>
            </div>

            <div id="crm-nco-address-block" class="crm-nco-address-block">
              <div class="crm-nco-row-2">
                <div class="crm-nco-field">
                  <label class="crm-nco-label" for="crm-nco-city">Город <span class="req">*</span></label>
                  <input class="crm-nco-input" id="crm-nco-city" placeholder="Город">
                </div>
                <div class="crm-nco-field">
                  <label class="crm-nco-label" for="crm-nco-street">Улица <span class="req">*</span></label>
                  <input class="crm-nco-input" id="crm-nco-street" placeholder="Улица">
                </div>
              </div>
              <div class="crm-nco-row-2">
                <div class="crm-nco-field">
                  <label class="crm-nco-label" for="crm-nco-house">Дом <span class="req">*</span></label>
                  <input class="crm-nco-input" id="crm-nco-house" placeholder="Дом">
                </div>
                <div class="crm-nco-field">
                  <label class="crm-nco-label" for="crm-nco-apt">Квартира</label>
                  <input class="crm-nco-input" id="crm-nco-apt" placeholder="Кв.">
                </div>
              </div>
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-building">Корпус</label>
                <input class="crm-nco-input" id="crm-nco-building" placeholder="Корпус">
              </div>
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-recipient">Имя получателя</label>
                <input class="crm-nco-input" id="crm-nco-recipient" placeholder="Получатель">
              </div>
              <div class="crm-nco-row-phone">
                <select class="crm-nco-select" id="crm-nco-rec-cc" aria-label="Код страны получателя">
                  <option value="+7">+7 (Россия)</option>
                </select>
                <input class="crm-nco-input" id="crm-nco-rec-phone" type="tel" placeholder="Телефон получателя">
              </div>
              <div class="crm-nco-row-2">
                <div class="crm-nco-field">
                  <label class="crm-nco-label" for="crm-nco-del-from">Доставка с</label>
                  <input class="crm-nco-input" id="crm-nco-del-from" type="time">
                </div>
                <div class="crm-nco-field">
                  <label class="crm-nco-label" for="crm-nco-del-to">Доставка до</label>
                  <input class="crm-nco-input" id="crm-nco-del-to" type="time">
                </div>
              </div>
              <div class="crm-nco-field">
                <label class="crm-nco-label" for="crm-nco-del-comment">Комментарий к доставке</label>
                <textarea class="crm-nco-textarea" id="crm-nco-del-comment" style="min-height:72px;"></textarea>
              </div>
            </div>

            <div class="crm-nco-footer">
              <button type="button" class="crm-nco-btn-create-client" id="crm-nco-create-client" disabled>Создать клиента</button>
              <button type="button" class="crm-nco-btn-cancel" id="crm-nco-cancel">Отмена</button>
              <button type="button" class="crm-nco-btn-order" id="crm-nco-create-order">Создать заказ</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const syncOrderClientLabel = () => {
      const n = (root.querySelector("#crm-nco-client-name") && root.querySelector("#crm-nco-client-name").value) || "";
      const p = (root.querySelector("#crm-nco-client-phone") && root.querySelector("#crm-nco-client-phone").value) || "";
      const sel = root.querySelector("#crm-nco-order-client");
      if (!sel) return;
      const t = `${n.trim() || "Клиент"}${p.trim() ? " · " + p.trim() : ""}`.trim();
      sel.innerHTML = `<option value="new">${escapeHtml(t || "Новый клиент — заполните слева")}</option>`;
    };

    const syncDeliveryBlock = () => {
      const v = root.querySelector('input[name="crm-nco-delivery-type"]:checked');
      const addr = root.querySelector("#crm-nco-address-block");
      if (!addr) return;
      addr.classList.toggle("crm-hidden", v && v.value === "pickup");
    };

    const syncClientBtn = () => {
      const n = ((root.querySelector("#crm-nco-client-name") || {}).value || "").trim();
      const p = ((root.querySelector("#crm-nco-client-phone") || {}).value || "").trim();
      const btn = root.querySelector("#crm-nco-create-client");
      const ok = n.length > 0 && p.length > 0;
      if (btn) {
        btn.disabled = !ok;
        btn.classList.toggle("is-ready", ok);
      }
    };

    const bindCounter = (inputId, spanId, max) => {
      const inp = root.querySelector(inputId);
      const sp = root.querySelector(spanId);
      if (!inp || !sp) return;
      const upd = () => {
        sp.textContent = String(Math.min(max, (inp.value || "").length));
      };
      inp.addEventListener("input", upd);
      upd();
    };

    bindCounter("#crm-nco-client-name", "#crm-nco-cnt-name", 64);
    bindCounter("#crm-nco-client-email", "#crm-nco-cnt-email", 64);
    bindCounter("#crm-nco-insta", "#crm-nco-cnt-insta", 64);
    bindCounter("#crm-nco-card", "#crm-nco-cnt-card", 32);
    bindCounter("#crm-nco-client-notes", "#crm-nco-cnt-notes", 500);

    root.querySelector("#crm-nco-client-name")?.addEventListener("input", () => {
      syncOrderClientLabel();
      syncClientBtn();
    });
    root.querySelector("#crm-nco-client-phone")?.addEventListener("input", () => {
      syncOrderClientLabel();
      syncClientBtn();
    });
    syncOrderClientLabel();
    syncClientBtn();

    root.querySelectorAll('input[name="crm-nco-delivery-type"]').forEach((r) => {
      r.addEventListener("change", syncDeliveryBlock);
    });
    syncDeliveryBlock();

    root.querySelector("#crm-nco-tags")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".crm-nco-tag");
      if (!btn) return;
      btn.classList.toggle("is-active");
    });

    root.querySelector("#crm-nco-focus-client")?.addEventListener("click", () => {
      root.querySelector("#crm-nco-client-name")?.focus();
    });

    root.querySelector("#crm-nco-back")?.addEventListener("click", () => {
      state.section = "all";
      document.querySelectorAll(".crm-submenu-item").forEach((x) => x.classList.remove("active"));
      document.querySelector('.crm-submenu-item[data-section="all"]')?.classList.add("active");
      renderOrdersArea();
      rerenderDataView();
    });

    root.querySelector("#crm-nco-cancel")?.addEventListener("click", () => {
      state.section = "all";
      document.querySelectorAll(".crm-submenu-item").forEach((x) => x.classList.remove("active"));
      document.querySelector('.crm-submenu-item[data-section="all"]')?.classList.add("active");
      renderOrdersArea();
      rerenderDataView();
    });

    root.querySelector("#crm-nco-create-client")?.addEventListener("click", () => {
      const n = ((root.querySelector("#crm-nco-client-name") || {}).value || "").trim();
      const p = ((root.querySelector("#crm-nco-client-phone") || {}).value || "").trim();
      if (!n || !p) {
        setNotice("Укажите имя и телефон клиента.", "warn");
        return;
      }
      setNotice("Клиент будет сохранён при подключении к API (пока демо-форма).", "info");
    });

    root.querySelector("#crm-nco-create-order")?.addEventListener("click", () => {
      setNotice("Создание заказа из CRM: следующий шаг — привязка к API заказов.", "info");
    });

    root.querySelector("#crm-nco-sbp-connect")?.addEventListener("click", () => {
      setNotice("СБП: интеграция подключается отдельно.", "info");
    });

    root.querySelector("#crm-nco-add-advance")?.addEventListener("click", (e) => {
      e.preventDefault();
      setNotice("Авансы: будет доступно после связки с оплатой.", "info");
    });

    const up = root.querySelector("#crm-nco-upload");
    const upIn = root.querySelector("#crm-nco-upload-input");
    if (up && upIn) {
      up.addEventListener("click", () => upIn.click());
      up.addEventListener("dragover", (e) => {
        e.preventDefault();
        up.style.borderColor = "#2f77d0";
      });
      up.addEventListener("dragleave", () => {
        up.style.borderColor = "";
      });
      up.addEventListener("drop", (e) => {
        e.preventDefault();
        up.style.borderColor = "";
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          setNotice("Файл выбран (загрузка на сервер — в следующей итерации).", "info");
        }
      });
      upIn.addEventListener("change", () => {
        if (upIn.files && upIn.files[0]) {
          setNotice("Изображение выбрано (загрузка на сервер — в следующей итерации).", "info");
        }
      });
    }
  }

  function renderOrdersArea() {
    const ordersCard = document.querySelector(".crm-orders-card");
    const productsView = byId("crm-products-view");
    const peopleView = byId("crm-people-view");
    const analyticsView = byId("crm-analytics-view");
    const tableWrap = document.querySelector(".crm-table-wrap");
    const board = byId("crm-orders-board");
    const controls = [
      byId("crm-day-strip"),
      document.querySelector(".crm-filters-grid"),
      byId("crm-status-pills"),
      byId("crm-edit-mode-btn")
    ];

    if (state.menu !== "orders") {
      if (ordersCard) ordersCard.classList.add("crm-hidden");
      if (byId("crm-new-client-order-view")) byId("crm-new-client-order-view").classList.add("crm-hidden");
      if (productsView) productsView.classList.toggle("crm-hidden", state.menu !== "products");
      if (peopleView) peopleView.classList.toggle("crm-hidden", state.menu !== "people");
      if (analyticsView) analyticsView.classList.toggle("crm-hidden", state.menu !== "analytics");
      if (tableWrap) tableWrap.classList.remove("crm-hidden");
      if (board) board.classList.add("crm-hidden");
      controls.forEach((x) => x && x.classList.add("crm-hidden"));
      renderProductsView();
      renderPeopleView();
      renderAnalyticsView();
      renderShownInfo();
      return;
    }

    const ncoView = byId("crm-new-client-order-view");
    const shownInfoEl = byId("crm-shown-info");

    if (state.section === "new-client") {
      if (ncoView) {
        ncoView.classList.remove("crm-hidden");
        renderNewClientOrderView();
      }
      if (ordersCard) ordersCard.classList.add("crm-hidden");
      if (productsView) productsView.classList.add("crm-hidden");
      if (peopleView) peopleView.classList.add("crm-hidden");
      if (analyticsView) analyticsView.classList.add("crm-hidden");
      controls.forEach((x) => x && x.classList.add("crm-hidden"));
      if (shownInfoEl) shownInfoEl.classList.add("crm-hidden");
      if (tableWrap) tableWrap.classList.add("crm-hidden");
      if (board) board.classList.add("crm-hidden");
      renderShownInfo();
      return;
    }

    if (ncoView) ncoView.classList.add("crm-hidden");

    if (ordersCard) ordersCard.classList.remove("crm-hidden");
    if (productsView) productsView.classList.add("crm-hidden");
    if (peopleView) peopleView.classList.add("crm-hidden");
    if (analyticsView) analyticsView.classList.add("crm-hidden");
    controls.forEach((x) => x && x.classList.remove("crm-hidden"));
    if (state.section === "kanban") {
      if (tableWrap) tableWrap.classList.add("crm-hidden");
      if (board) board.classList.remove("crm-hidden");
      rerenderDataView();
    } else {
      if (board) board.classList.add("crm-hidden");
      if (tableWrap) tableWrap.classList.remove("crm-hidden");
      rerenderDataView();
    }
  }

  function bindBoardDnd() {
    const cards = document.querySelectorAll(".crm-board-card");
    cards.forEach((card) => {
      card.addEventListener("dragstart", () => {
        state.dragOrderId = card.getAttribute("data-order-id");
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
      });
    });

    const cols = document.querySelectorAll(".crm-board-col");
    cols.forEach((col) => {
      col.addEventListener("dragover", (e) => {
        e.preventDefault();
        col.classList.add("is-drop-target");
      });
      col.addEventListener("dragleave", () => {
        col.classList.remove("is-drop-target");
      });
      col.addEventListener("drop", async (e) => {
        e.preventDefault();
        col.classList.remove("is-drop-target");
        if (!state.dragOrderId) return;
        const toStatus = col.getAttribute("data-status");
        if (!toStatus) return;
        const order = state.orders.find((x) => String(getOrderId(x)) === String(state.dragOrderId));
        const hasToken = Boolean(state.token || localStorage.getItem("arka_admin_token"));
        const canSyncApi = Boolean(order && !order.__mock && hasToken);
        const paid = order ? isPaid(order) : false;
        const toNormalized = normalizeStatus(toStatus);
        const isForbiddenForUnpaid =
          !paid && (toNormalized === "Доставлен" || toNormalized === "Выполнен" || toNormalized === "Выдан" || toNormalized === "Отправлен" || toNormalized === "Букет готов");
        if (isForbiddenForUnpaid) {
          setNotice("Нельзя отправить в доставку/выполнено пока заказ не оплачен.", "warn");
          state.dragOrderId = null;
          renderOrdersArea();
          return;
        }
        try {
          if (canSyncApi) {
            await api(`/api/admin/crm/orders/${encodeURIComponent(state.dragOrderId)}/status`, {
              method: "POST",
              body: JSON.stringify({ status: toStatus })
            });
            setLocalBoardStatus(state.dragOrderId, toStatus);
            setNotice("", "info");
            await loadOrders();
          } else if (order) {
            order.status = toStatus;
            setLocalBoardStatus(state.dragOrderId, toStatus);
            state.demoMode = true;
            setNotice("Демо-режим: карточка перемещена локально.", "info");
          }
          renderOrdersArea();
        } catch (err) {
          if (order) {
            order.status = toStatus;
            setLocalBoardStatus(state.dragOrderId, toStatus);
            state.demoMode = true;
            setNotice("Нет доступа к API для смены статуса. Включен демо-режим перемещения.", "warn");
            renderOrdersArea();
          }
        } finally {
          state.dragOrderId = null;
        }
      });
    });
  }

  function bind() {
    byId("crm-orders-toggle")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wasOrders = state.menu === "orders";
      state.menu = "orders";
      document.querySelectorAll(".crm-menu-item").forEach((x) => x.classList.remove("active"));
      e.currentTarget.classList.add("active");
      if (wasOrders) {
        state.ordersSubmenuOpen = !state.ordersSubmenuOpen;
      } else {
        state.ordersSubmenuOpen = true;
      }
      state.productsSubmenuOpen = false;
      renderOrdersSubmenu();
      renderProductsSubmenu();
      renderOrdersArea();
    });

    byId("crm-products-toggle")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wasProducts = state.menu === "products";
      state.menu = "products";
      document.querySelectorAll(".crm-menu-item").forEach((x) => x.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.section = state.section.startsWith("product-") ? state.section : "product-categories";
      if (wasProducts) {
        state.productsSubmenuOpen = !state.productsSubmenuOpen;
      } else {
        state.productsSubmenuOpen = true;
      }
      state.ordersSubmenuOpen = false;
      state.peopleSubmenuOpen = false;
      renderOrdersSubmenu();
      renderProductsSubmenu();
      renderPeopleSubmenu();
      renderOrdersArea();
    });

    byId("crm-people-toggle")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wasPeople = state.menu === "people";
      state.menu = "people";
      document.querySelectorAll(".crm-menu-item").forEach((x) => x.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.section = state.section.startsWith("people-") ? state.section : "people-clients";
      if (wasPeople) {
        state.peopleSubmenuOpen = !state.peopleSubmenuOpen;
      } else {
        state.peopleSubmenuOpen = true;
      }
      state.ordersSubmenuOpen = false;
      state.productsSubmenuOpen = false;
      renderOrdersSubmenu();
      renderProductsSubmenu();
      renderPeopleSubmenu();
      renderOrdersArea();
    });

    byId("crm-search-global")?.addEventListener("input", (e) => {
      state.filters.query = e.target.value || "";
      rerenderDataView();
    });

    byId("crm-filter-order-id")?.addEventListener("input", (e) => {
      state.filters.orderId = e.target.value || "";
    });

    byId("crm-filter-buyer-phone")?.addEventListener("input", (e) => {
      state.filters.phone = e.target.value || "";
    });

    byId("crm-filter-status")?.addEventListener("change", (e) => {
      state.filters.status = e.target.value || "";
    });

    byId("crm-filter-date-from")?.addEventListener("change", (e) => {
      state.filters.dateFrom = e.target.value || "";
    });

    byId("crm-filter-date-to")?.addEventListener("change", (e) => {
      state.filters.dateTo = e.target.value || "";
    });

    byId("crm-apply-filters")?.addEventListener("click", () => {
      rerenderDataView();
    });

    byId("crm-reset-filters")?.addEventListener("click", () => {
      state.filters.orderId = "";
      state.filters.phone = "";
      state.filters.status = "";
      state.filters.dateFrom = "";
      state.filters.dateTo = "";
      state.filters.day = "";
      const ids = ["crm-filter-order-id", "crm-filter-buyer-phone", "crm-filter-status", "crm-filter-date-from", "crm-filter-date-to"];
      ids.forEach((id) => {
        const el = byId(id);
        if (el) el.value = "";
      });
      renderDayStrip();
      rerenderDataView();
    });

    byId("crm-day-strip")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-day]");
      if (!btn) return;
      state.filters.day = btn.getAttribute("data-day") || "";
      renderDayStrip();
      rerenderDataView();
    });

    byId("crm-status-pills")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pill]");
      if (!btn) return;
      if (state.section === "kanban") {
        setNotice("В канбане статусы не скрывают колонки. Перетаскивай карточки между колонками.", "info");
        return;
      }
      const key = btn.getAttribute("data-pill") || "";
      state.filters.status = statusLabelToFilter[key] || "";
      const statusInput = byId("crm-filter-status");
      if (statusInput) statusInput.value = state.filters.status;
      rerenderDataView();
    });

    document.querySelectorAll(".crm-menu-item").forEach((el) => {
      if (el.id === "crm-orders-toggle" || el.id === "crm-products-toggle" || el.id === "crm-people-toggle") return;
      el.addEventListener("click", () => {
        document.querySelectorAll(".crm-menu-item").forEach((x) => x.classList.remove("active"));
        el.classList.add("active");
        state.menu = el.getAttribute("data-menu") || "orders";
        if (state.menu !== "orders") {
          state.ordersSubmenuOpen = false;
        }
        if (state.menu !== "products") {
          state.productsSubmenuOpen = false;
        }
        if (state.menu !== "people") {
          state.peopleSubmenuOpen = false;
        }
        renderOrdersSubmenu();
        renderProductsSubmenu();
        renderPeopleSubmenu();
        renderOrdersArea();
      });
    });

    document.querySelectorAll(".crm-submenu-item").forEach((el) => {
      el.addEventListener("click", () => {
        document.querySelectorAll(".crm-submenu-item").forEach((x) => x.classList.remove("active"));
        el.classList.add("active");
        state.section = el.getAttribute("data-section") || "all";
        state.menu = el.getAttribute("data-menu") || "orders";
        state.ordersSubmenuOpen = state.menu === "orders";
        state.productsSubmenuOpen = state.menu === "products";
        state.peopleSubmenuOpen = state.menu === "people";
        document.querySelector('[data-menu="orders"]')?.classList.toggle("active", state.menu === "orders");
        document.querySelector('[data-menu="products"]')?.classList.toggle("active", state.menu === "products");
        document.querySelector('[data-menu="people"]')?.classList.toggle("active", state.menu === "people");
        renderOrdersSubmenu();
        renderProductsSubmenu();
        renderPeopleSubmenu();
        renderOrdersArea();
      });
    });

    byId("crm-refresh-btn")?.addEventListener("click", () => {
      loadOrders().then(renderOrdersArea);
    });

    byId("crm-add-order-btn")?.addEventListener("click", () => {
      window.location.href = "/admin";
    });

    byId("crm-edit-mode-btn")?.addEventListener("click", (e) => {
      state.isEditMode = !state.isEditMode;
      e.currentTarget.textContent = state.isEditMode ? "Режим редактирования" : "Изменить";
    });

    byId("crm-logout-btn")?.addEventListener("click", () => {
      localStorage.removeItem("arka_admin_token");
      location.reload();
    });

    byId("crm-products-view")?.addEventListener("click", (e) => {
      const applyCategories = e.target.closest("#crm-category-apply");
      const resetCategories = e.target.closest("#crm-category-reset");
      const applyProducts = e.target.closest("#crm-products-apply");
      const resetProducts = e.target.closest("#crm-products-reset");
      if (applyCategories || applyProducts) {
        renderProductsView();
        return;
      }
      if (resetCategories || resetProducts) {
        state.productFilters.query = "";
        state.productFilters.category = "";
        renderProductsView();
        return;
      }

      const catVisibility = e.target.closest("[data-cat-visibility]");
      if (catVisibility) {
        const id = Number(catVisibility.getAttribute("data-cat-visibility"));
        const target = state.productCategories.find((x) => x.id === id);
        if (target) target.visible = !target.visible;
        renderProductsView();
        return;
      }

      const prodVisibility = e.target.closest("[data-prod-visibility]");
      if (prodVisibility) {
        const id = Number(prodVisibility.getAttribute("data-prod-visibility"));
        const target = state.productItems.find((x) => x.id === id);
        if (target) target.visible = !target.visible;
        renderProductsView();
        return;
      }

      const prodViewBtn = e.target.closest("[data-prod-view]");
      if (prodViewBtn) {
        state.productViewMode = prodViewBtn.getAttribute("data-prod-view") || "table";
        renderProductsView();
        return;
      }

      const catViewBtn = e.target.closest("[data-cat-view]");
      if (catViewBtn) {
        state.categoryViewMode = catViewBtn.getAttribute("data-cat-view") || "table";
        renderProductsView();
        return;
      }

      const openProduct = e.target.closest("[data-open-product]");
      if (openProduct && !e.target.closest("[data-prod-visibility]")) {
        const id = Number(openProduct.getAttribute("data-open-product"));
        renderProductEditor(id);
      }
    });

    byId("crm-products-view")?.addEventListener("input", (e) => {
      const qCategories = e.target.closest("#crm-category-search");
      const qProducts = e.target.closest("#crm-products-search");
      const cProducts = e.target.closest("#crm-products-category");
      if (qCategories) state.productFilters.query = qCategories.value || "";
      if (qProducts) state.productFilters.query = qProducts.value || "";
      if (cProducts) state.productFilters.category = cProducts.value || "";
    });

    byId("crm-people-view")?.addEventListener("click", (e) => {
      const roleTab = e.target.closest("[data-staff-role]");
      if (roleTab) {
        state.staffRoleFilter = roleTab.getAttribute("data-staff-role") || "all";
        renderPeopleView();
        return;
      }
      const addStaff = e.target.closest("#crm-add-staff");
      if (addStaff) {
        state.staff.push({
          id: Date.now(),
          name: `new_${state.staff.length + 1}`,
          login: `new_user_${state.staff.length + 1}`,
          role: "Менеджер",
          lastLogin: "сейчас",
          registered: "сегодня",
          active: true
        });
        renderPeopleView();
        setNotice("Добавлен тестовый сотрудник.", "info");
        return;
      }
      const openClient = e.target.closest("[data-open-client]");
      if (openClient) {
        const id = Number(openClient.getAttribute("data-open-client"));
        renderClientDetail(id);
      }
    });

    byId("crm-client-editor")?.addEventListener("click", (e) => {
      const close = e.target.closest("#crm-client-close");
      if (!close) return;
      byId("crm-client-editor")?.classList.add("crm-hidden");
    });

    byId("crm-analytics-view")?.addEventListener("click", (e) => {
      const period = e.target.closest("[data-analytics-period]");
      if (period) {
        state.analytics.period = period.getAttribute("data-analytics-period") || "month";
        renderAnalyticsView();
        return;
      }
      const refresh = e.target.closest("#crm-analytics-refresh");
      if (refresh) {
        state.analytics.tick += 1;
        renderAnalyticsView();
        setNotice("Аналитика обновлена.", "info");
      }
    });

    byId("crm-analytics-view")?.addEventListener("change", (e) => {
      const channel = e.target.closest("#crm-analytics-channel");
      if (!channel) return;
      state.analytics.channel = channel.value || "all";
      renderAnalyticsView();
    });

    byId("crm-product-editor")?.addEventListener("click", (e) => {
      const close = e.target.closest("#crm-editor-close");
      const cancel = e.target.closest("#crm-editor-cancel");
      const save = e.target.closest("#crm-editor-save");
      const uploadSlot = e.target.closest("[data-upload-image]");
      if (close || cancel || save) {
        state.editorProductId = null;
        byId("crm-product-editor")?.classList.add("crm-hidden");
        if (save) setNotice("Товар сохранен.", "info");
        return;
      }
      if (uploadSlot) {
        byId("crm-editor-file-input")?.click();
      }
    });

    byId("crm-product-editor")?.addEventListener("change", async (e) => {
      const input = e.target.closest("#crm-editor-file-input");
      if (!input) return;
      const file = input.files && input.files[0] ? input.files[0] : null;
      await applyEditorImageFile(file);
      input.value = "";
    });

    byId("crm-product-editor")?.addEventListener("dragover", (e) => {
      const slot = e.target.closest("[data-upload-image]");
      if (!slot) return;
      e.preventDefault();
      slot.classList.add("is-dragover");
    });

    byId("crm-product-editor")?.addEventListener("dragleave", (e) => {
      const slot = e.target.closest("[data-upload-image]");
      if (!slot) return;
      slot.classList.remove("is-dragover");
    });

    byId("crm-product-editor")?.addEventListener("drop", async (e) => {
      const slot = e.target.closest("[data-upload-image]");
      if (!slot) return;
      e.preventDefault();
      slot.classList.remove("is-dragover");
      const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
      const imageFile = files.find((x) => String(x.type || "").startsWith("image/"));
      await applyEditorImageFile(imageFile || null);
      if (!imageFile) {
        setNotice("Перетащи файл изображения (не папку).", "warn");
      }
    });

    byId("crm-orders-board")?.addEventListener("click", (e) => {
      const openDeal = e.target.closest("[data-open-deal]");
      if (!openDeal) return;
      e.preventDefault();
      e.stopPropagation();
      const orderId = openDeal.getAttribute("data-open-deal");
      if (!orderId) return;
      renderDealEditor(orderId);
    });

    byId("crm-deal-editor")?.addEventListener("click", (e) => {
      const close = e.target.closest("#crm-deal-close");
      const cancel = e.target.closest("#crm-deal-cancel");
      const save = e.target.closest("#crm-deal-save");
      if (!close && !cancel && !save) return;
      byId("crm-deal-editor")?.classList.add("crm-hidden");
      if (save) setNotice("Сделка сохранена.", "info");
    });

    document.body.addEventListener("click", (e) => {
      const plainAction = e.target.closest(".crm-icon-plain");
      if (!plainAction) return;
      if (plainAction.hasAttribute("data-open-client")) return;
      setNotice("Действие обработано.", "info");
    });
  }

  async function loadOrders() {
    try {
      const data = await api("/api/admin/crm/orders");
      const list = Array.isArray(data) ? data : Array.isArray(data.orders) ? data.orders : [];
      state.orders = list.sort((a, b) => Number(getOrderId(b)) - Number(getOrderId(a)));
      if (state.orders.length < 12) {
        const existing = new Set(state.orders.map((o) => String(getOrderId(o))));
        const mocks = createMockOrders().filter((o) => !existing.has(String(o.id)));
        state.orders = state.orders.concat(mocks).slice(0, 120);
        if (mocks.length > 0) {
          setNotice("Добавлены тестовые заказы для наглядного теста интерфейса.", "info");
        }
      }
      applyLocalBoardStatuses();
      renderStatusPills();
    } catch (err) {
      state.orders = createMockOrders();
      applyLocalBoardStatuses();
      renderStatusPills();
      setNotice("API временно недоступно. Показаны тестовые заказы.", "warn");
      const tbody = byId("crm-orders-tbody");
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="crm-empty">Показаны тестовые заказы.</td></tr>`;
    }
  }

  async function init() {
    state.productCategories = createMockProductCategories();
    state.productItems = createMockProducts();
    state.clients = createMockClients();
    state.staff = createMockStaff();
    getTokenFromUrl();
    state.token = state.token || localStorage.getItem("arka_admin_token");
    if (!state.token) await autoLoginByTelegram();
    initWelcomeSplash();
    bind();
    renderOrdersSubmenu();
    renderProductsSubmenu();
    renderPeopleSubmenu();
    renderDayStrip();
    renderStatusPills();
    await loadOrders();
    renderOrdersArea();
  }

  init();
})();
