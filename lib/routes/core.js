'use strict';
// مسیرهای عمومی کارتابل‌ها: اعلان‌ها، شمارنده‌ها، داشبورد، کالاها، قیمت‌ها، مشتریان، مراجعه‌ها و گزارش‌ها
const { route, fail, normalizeRole } = require('../http');
const store = require('../store');
const repo = require('../sql-repos');
const validate = require('../validate');
const { today, getProduct, enrichOrder, activateDueRemoteOrders, normalizePlate, createNotification } = require('../domain');

const roleOf = (u) => normalizeRole(u.roleCode);
const isNotifForUser = (n, user) => roleOf(user) === 'admin' || normalizeRole(n.targetRole) === roleOf(user);
// Legacy records already marked read stay read. New acknowledgements belong to the
// current account, so a manager cannot silence the same alert for a unit user.
const notifReadFor = (n, user) => n.isRead === true || (Array.isArray(n.readBy) && n.readBy.includes(user.id));

// ---------- اعلان‌ها ----------
function notificationSnapshot(user) {
  const all = store.get().notifications.filter((n) => isNotifForUser(n, user));
  const pending = all.filter(n => !notifReadFor(n, user));
  // Keep every unread item reachable even when more than 80 notifications exist.
  const recent = all.filter(n => notifReadFor(n, user)).slice(0, Math.max(0, 80 - pending.length));
  const list = [...pending, ...recent].map(n => { const { readBy, ...safe } = n; return { ...safe, message: ['STORE_RUN_R1_SENT','STORE_RUN_R2_SENT'].includes(safe.type) && typeof safe.message === 'string' ? safe.message.replace(/\(باب[ُ]?ل تویور(?=[،)])/g, '(بابل طیور') : safe.message, isRead: notifReadFor(n, user) }; });
  return { notifications: list, unread: pending.length };
}
route('GET', '/api/notifications', {}, async (ctx) => ({ status: 200, body: notificationSnapshot(ctx.user) }));

route('POST', '/api/notifications/read', {}, async (ctx) => {
  const id = ctx.body.id ? String(ctx.body.id) : null;
  for (const n of store.get().notifications) {
    if (isNotifForUser(n, ctx.user) && (!id || n.id === id) && !notifReadFor(n, ctx.user)) {
      n.readBy = [...(Array.isArray(n.readBy) ? n.readBy : []), ctx.user.id];
    }
  }
  store.save();
  return { status: 200, body: { ok: true, ...notificationSnapshot(ctx.user) } };
});

// ---------- شمارنده‌های هر کارتابل ----------
route('GET', '/api/workload', {}, async (ctx) => {
  const db = store.get();
  activateDueRemoteOrders();
  const role = roleOf(ctx.user);
  const count = (fn) => db.orders.filter(fn).length;
  const unread = db.notifications.filter((n) => isNotifForUser(n, ctx.user) && !notifReadFor(n, ctx.user)).length;
  const counts = { notifications: unread };
  const gateEntry = db.visits.filter((v) => v.status === 'WAITING_SALES').length;
  const gateExit = count((o) => o.status === 'SETTLED' && !o.dispatch);
  const salesOrders = count((o) => o.status === 'RETURNED_TO_SALES');
  const salesSettlement = count((o) => o.status === 'SETTLEMENT_PENDING' && !o.dispatch);
  const dispatchPending = count((o) => o.dispatch?.status === 'PENDING_ASSIGN');
  const gateDispatchPending = count((o) => o.dispatch?.status === 'DRIVER_EXIT_REPORTED');
  const salesDeliveryActive = count((o) => ['ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'].includes(o.dispatch?.status));
  const salesDeliveryPending = count((o) => o.dispatch?.status === 'DELIVERED');
  const warehousePending = count((o) => ['WAREHOUSE_PENDING', 'WAREHOUSE_PREPARING'].includes(o.status));
  const warehouseIncoming = count((o) => o.status === 'WAREHOUSE_PENDING');
  const warehousePreparing = count((o) => o.status === 'WAREHOUSE_PREPARING');
  // v37.6.0 — تفکیک فروشگاه‌ها از رفتارهای انبار برای کارت‌های مستقل
  const warehouseIncomingRegular = count((o) => o.status === 'WAREHOUSE_PENDING' && o.orderType !== 'STORE');
  const warehousePreparingRegular = count((o) => o.status === 'WAREHOUSE_PREPARING' && o.orderType !== 'STORE');
  const warehouseStores = count((o) => o.orderType === 'STORE' && (o.status === 'WAREHOUSE_PENDING' || (o.status === 'WAREHOUSE_PREPARING' && !(o.storeRunOps && o.storeRunOps.finalizedAt)))); // v37.19.0 — پایان‌یافتهٔ انبار شمرده نمی‌شود
  const salesFlowRegular = count((o) => o.orderType !== 'STORE' && ['WAREHOUSE_PENDING', 'WAREHOUSE_PREPARING'].includes(o.status)) + salesOrders;
  const remoteScheduled = count((o) => o.orderType === 'REMOTE' && o.status === 'SCHEDULED_REMOTE');
  const futureScheduled = count((o) => o.orderType === 'REMOTE' && o.status === 'SCHEDULED_REMOTE');
  const storePending = count((o) => o.orderType === 'STORE' && o.status === 'STORE_PENDING_SALES');
  const storeScheduled = count((o) => o.orderType === 'STORE' && o.status === 'SCHEDULED_REMOTE');
  if (role === 'admin') {
    Object.assign(counts, { gateEntry, gateExit, gateDispatchPending, salesDeliveryActive, salesDeliveryPending, salesIntake: gateEntry, salesOrders, salesSettlement, salesRemote: remoteScheduled, store: storePending, storeScheduled, salesFlow: salesFlowRegular, salesFuture: futureScheduled, warehouse: warehousePending, warehouseIncoming, warehousePreparing, dispatchPending, warehouseIncomingRegular, warehousePreparingRegular, warehouseStores });
  } else if (role === 'gate') {
    Object.assign(counts, { gateEntry, gateExit, gateDispatchPending, visitsTotal: db.visits.length });
  } else if (role === 'sales') {
    Object.assign(counts, { salesIntake: gateEntry, salesOrders, salesSettlement, salesRemote: remoteScheduled, store: storePending, storeScheduled, salesFlow: salesFlowRegular, salesFuture: futureScheduled, salesDeliveryActive, salesDeliveryPending });
  } else if (role === 'dispatch') {
    counts.dispatchPending = dispatchPending;
  } else if (role === 'warehouse') {
    Object.assign(counts, { warehouse: warehousePending, warehouseIncoming, warehousePreparing, warehouseIncomingRegular, warehousePreparingRegular, warehouseStores, visitsTotal: db.visits.length });
  } else if (role === 'store') {
    counts.store = storePending;
  } else if (role === 'driver' && ctx.user.driverId) {
    const views = db.orders.flatMap(o => require('../dispatch').dispatchViews(o));
    counts.driverOpen = views.filter(v => v.dispatch.driverId === ctx.user.driverId && ['ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'].includes(v.dispatch.status)).length;
  }
  return { status: 200, body: { counts } };
});

route('GET', '/api/dashboard', { roles: ['admin'] }, async () => {
  const db = store.get();
  activateDueRemoteOrders();
  // فاز ۲: یک پرسوجوی تجمیعی SQL بهجای هفت پیمایش روی آرایههای درون حافظه.
  const counts = repo.dashboardCounts(today());
  const recent = db.orders.slice(-8).reverse().map(enrichOrder);
  return { status: 200, body: { counts, recent } };
});

// ---------- v37.3.5 — نمودارهای داشبورد مدیریت به تفکیک محصول ----------
// ۱) فروش: فاکتورهای تسویه‌شده در بازه (مبلغ خالص پس از کسر مرجوعی پخش + وزن خالص)
// ۲) سفارش‌ها: سفارش‌های ثبت‌شده در بازه (به‌جز لغوشده) — تعداد سفارش و مقدار درخواستی
// ۳) تحویل انبار: اقلامی که وزن نهایی‌شان در بازه در انبار ثبت شد (کیلوگرم) + ناموجودی
const DASH_DAYS = [1, 7, 30, 90];
function dashKey(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
route('GET', '/api/dashboard/products', { roles: ['admin'] }, async (ctx) => {
  const db = store.get();
  let days = Number(ctx.query.get('days')) || 30;
  if (!DASH_DAYS.includes(days)) days = 30;
  const to = today();
  const start = new Date(); start.setDate(start.getDate() - (days - 1));
  const from = dashKey(start);
  const inRange = (iso) => { if (!iso) return false; const d = dashKey(new Date(iso)); return d >= from && d <= to; };
  const itemsOf = (orderId) => db.orderItems.filter((i) => i.orderId === orderId);
  const bucket = (map, productId, init) => {
    if (!map.has(productId)) { const pr = getProduct(productId); map.set(productId, { productId, productName: pr?.name || 'کالای حذف‌شده', quickCode: pr?.quickCode || '', ...init }); }
    return map.get(productId);
  };
  const r3 = (n) => +Number(n || 0).toFixed(3);

  // ۱) فروش
  const sales = new Map(); let invoices = 0;
  for (const pay of db.payments) {
    if (!inRange(pay.verifiedAt || pay.createdAt)) continue;
    const order = db.orders.find((o) => o.id === pay.orderId);
    if (!order || order.status === 'CANCELLED') continue;
    invoices += 1;
    const lines = new Map((order.dispatch?.lines || []).map((l) => [l.itemId, l]));
    const seen = new Set();
    for (const it of itemsOf(order.id)) {
      if (it.itemStatus === 'CANCELLED' || it.itemStatus === 'OUT_OF_STOCK') continue;
      const gross = Number(it.finalAmount ?? Math.round(Number(it.deliveredKg || 0) * Number(it.unitPrice || 0))) || 0;
      const l = lines.get(it.id);
      const amount = Math.max(0, gross - Number(l?.returnAmount || 0));
      const kg = Math.max(0, Number(it.deliveredKg || 0) - Number(l?.returnKg || 0));
      if (amount <= 0 && kg <= 0) continue;
      const b = bucket(sales, it.productId, { amount: 0, kg: 0, orders: 0 });
      b.amount += amount; b.kg = r3(b.kg + kg);
      if (!seen.has(it.productId)) { b.orders += 1; seen.add(it.productId); }
    }
  }
  // ۲) سفارش‌ها
  const orders = new Map(); let orderCount = 0;
  for (const o of db.orders) {
    if (o.status === 'CANCELLED' || !inRange(o.createdAt)) continue;
    orderCount += 1;
    const seen = new Set();
    for (const it of itemsOf(o.id)) {
      if (it.itemStatus === 'CANCELLED') continue;
      const b = bucket(orders, it.productId, { orders: 0, lines: 0, units: {} });
      b.lines += 1;
      const u = it.requestedUnit || 'کیلوگرم';
      b.units[u] = r3((b.units[u] || 0) + Number(it.requestedQty || 0));
      if (!seen.has(it.productId)) { b.orders += 1; seen.add(it.productId); }
    }
  }
  // ۳) تحویل انبار
  const wh = new Map(); let whOrders = 0;
  for (const o of db.orders) {
    if (!o.warehouseCompletedAt || !inRange(o.warehouseCompletedAt)) continue;
    whOrders += 1;
    const seen = new Set();
    for (const it of itemsOf(o.id)) {
      const oos = (it.warehouseStatus || it.itemStatus) === 'OUT_OF_STOCK';
      const kg = Number(it.deliveredKg || 0);
      if (!oos && !(kg > 0)) continue;
      const b = bucket(wh, it.productId, { kg: 0, orders: 0, outOfStock: 0 });
      if (oos) b.outOfStock += 1; else b.kg = r3(b.kg + kg);
      if (!oos && !seen.has(it.productId)) { b.orders += 1; seen.add(it.productId); }
    }
  }
  const sortBy = (map, k) => [...map.values()].sort((a, b) => b[k] - a[k] || a.productName.localeCompare(b.productName, 'fa'));
  const salesRows = sortBy(sales, 'amount');
  const orderRows = sortBy(orders, 'orders');
  const whRows = sortBy(wh, 'kg');
  return {
    status: 200,
    body: {
      days, from, to,
      sales: { rows: salesRows, totalAmount: salesRows.reduce((t, x) => t + x.amount, 0), totalKg: r3(salesRows.reduce((t, x) => t + x.kg, 0)), invoices },
      orders: { rows: orderRows, totalOrders: orderCount, totalLines: orderRows.reduce((t, x) => t + x.lines, 0) },
      warehouse: { rows: whRows, totalKg: r3(whRows.reduce((t, x) => t + x.kg, 0)), orders: whOrders, outOfStock: whRows.reduce((t, x) => t + x.outOfStock, 0) },
    },
  };
});

// ---------- کالاها ----------
route('GET', '/api/products', { roles: ['admin', 'sales', 'warehouse', 'store'] }, async () => ({
  status: 200, body: { products: repo.repos.products.select('is_active = 1') },
}));

route('GET', '/api/products/search', { roles: ['admin', 'sales', 'warehouse', 'store'] }, async (ctx) => {
  const q = String(ctx.query.get('q') || '').trim().toLowerCase().slice(0, 80);
  if (!q) return { status: 200, body: { products: [] } };
  const products = store.get().products.filter((x) => x.isActive && (x.name.toLowerCase().includes(q) || x.quickCode === q)).slice(0, 15);
  return { status: 200, body: { products } };
});

route('GET', '/api/prices', { roles: ['admin', 'sales'] }, async (ctx) => {
  const d = validate.digitsToAscii(ctx.query.get('date') || today()).slice(0, 10);
  const prices = store.get().priceList.filter((x) => x.date === d).map((x) => ({ ...x, product: getProduct(x.productId) }));
  return { status: 200, body: { prices } };
});

route('POST', '/api/admin/prices', { roles: ['admin', 'sales'], idempotent: true }, async (ctx) => {
  const db = store.get();
  const b = ctx.body;
  const product = getProduct(String(b.productId || ''));
  if (!product) fail(404, 'کالا یافت نشد.');
  const price = validate.number(b.price, { field: 'قیمت', min: 0, max: validate.MAX_MONEY });
  const date = validate.digitsToAscii(b.date || today()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, 'تاریخ قیمت معتبر نیست.');
  db.priceList = db.priceList.filter((x) => !(x.productId === product.id && x.date === date));
  const item = { id: store.uid(), productId: product.id, price, date };
  db.priceList.push(item);
  store.audit(ctx.user, 'SET_PRICE', 'price', item.id, { productId: product.id, quickCode: product.quickCode, price, date }, ctx);
  store.save();
  return { status: 201, body: { price: item } };
});

// ---------- مشتریان ----------
route('GET', '/api/customers/search', { roles: ['admin', 'gate', 'sales'] }, async (ctx) => {
  const qRaw = String(ctx.query.get('q') || '').trim().slice(0, 80);
  const q = normalizePlate(qRaw);
  if (!q) return { status: 200, body: { customers: [] } };
  const codeQ = require('../customer-core').normalizeCode(qRaw);
  const customers = store.get().customers
    .filter((c) => normalizePlate(c.plate || '').includes(q) || String(c.name || '').includes(qRaw) || String(c.phone || '').includes(qRaw) || (codeQ && String(c.code || '').toUpperCase().includes(codeQ)))
    .slice(-20).reverse();
  return { status: 200, body: { customers } };
});

// ---------- مراجعه‌ها (ورودی نگهبانی) ----------
route('POST', '/api/visits', { roles: ['gate'], idempotent: true }, async (ctx) => {
  const db = store.get();
  const b = ctx.body;
  const name = validate.text(b.name, { field: 'نام مشتری', max: 120, required: true });
  const phone = validate.phone(b.phone);
  const vehicleType = validate.text(b.noVehicle === true ? 'بدون وسیله' : (b.vehicleType || 'خودرو'), { field: 'نوع وسیله', max: 40 });
  const plate = b.noVehicle === true ? validate.gatePlate(b.plate, true) : validate.driverPlate(b.plate, vehicleType);
  const district = validate.text(b.district, { field: 'منطقه', max: 100 });
  const purpose = validate.text(b.purpose, { field: 'هدف مراجعه', max: 250 });

  // مشتری قبلی با کد مشتری، شماره تماس یا پلاک پیدا می‌شود؛ پرونده‌ی تکراری ساخته نمی‌شود
  const customer = require('../customers').upsertCustomer(db, {
    customerId: b.customerId, customerCode: b.customerCode, name, phone, plate, vehicleType, district,
  });
  const visit = { id: store.uid(), customerId: customer.id, district, purpose, status: 'WAITING_SALES', createdBy: ctx.user.id, createdAt: store.nowIso() };
  db.visits.push(visit);
  createNotification('sales', 'NEW_VISIT', 'visit', visit.id, `مشتری ${customer.name} وارد شد و منتظر ثبت سفارش است.`);
  store.audit(ctx.user, 'CREATE_VISIT', 'visit', visit.id, { customerId: customer.id, plate }, ctx);
  store.save();
  return { status: 201, body: { visit, enriched: { visit, customer } } };
});

route('GET', '/api/visits', { roles: ['admin', 'gate', 'sales', 'warehouse'] }, async (ctx) => {
  const db = store.get();
  let rows = repo.repos.visits.all().reverse().map((v) => ({ ...v, customer: repo.lookups.customerOf(v.customerId) }));
  if (roleOf(ctx.user) === 'sales') rows = rows.filter((v) => ['WAITING_SALES', 'ORDERED'].includes(v.status));
  return { status: 200, body: { visits: rows.slice(0, 100) } };
});

// ---------- گزارش مدیریتی ----------
route('GET', '/api/reports', { roles: ['admin'] }, async () => {
  const db = store.get();
  activateDueRemoteOrders();
  const t = today();
  const todayVisits = db.visits.filter((v) => v.createdAt.startsWith(t));
  const gate = todayVisits.length;
  const ordersToday = db.orders.filter((o) => o.createdAt.startsWith(t)).length;
  const delivered = db.orders.filter((o) => ['SETTLEMENT_PENDING', 'SETTLED', 'EXITED'].includes(o.status)).length;
  const byDistrict = Object.entries(todayVisits.reduce((a, v) => { const k = v.district || 'نامشخص'; a[k] = (a[k] || 0) + 1; return a; }, {}))
    .map(([district, count]) => ({ district, count })).sort((a, b) => b.count - a.count);
  const revenue = db.payments.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  const readyExit = db.orders.filter((o) => o.status === 'SETTLED' && !o.dispatch).length;
  const remoteAll = db.orders.filter((o) => o.orderType === 'REMOTE');
  const remoteByDate = Object.entries(remoteAll.reduce((a, o) => { const k = o.scheduledDate || 'بدون تاریخ'; a[k] = (a[k] || 0) + 1; return a; }, {}))
    .map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  return {
    status: 200,
    body: {
      gate: { today: gate, byDistrict },
      sales: { todayOrders: ordersToday, pendingSettlement: db.orders.filter((o) => o.status === 'SETTLEMENT_PENDING' && !o.dispatch).length, pendingWarehouse: db.orders.filter((o) => ['WAREHOUSE_PENDING', 'WAREHOUSE_PREPARING'].includes(o.status)).length },
      warehouse: { deliveredOrders: delivered },
      finance: { revenue, readyExit },
      remote: {
        total: remoteAll.length,
        scheduled: remoteAll.filter((o) => o.status === 'SCHEDULED_REMOTE').length,
        dueToday: remoteAll.filter((o) => o.scheduledDate === t && ['WAREHOUSE_PENDING', 'SETTLEMENT_PENDING', 'SETTLED', 'EXITED'].includes(o.status)).length,
        byDate: remoteByDate,
      },
    },
  };
});

module.exports = {};
