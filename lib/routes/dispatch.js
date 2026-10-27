'use strict';
// مسیرهای واحد پخش، کارتابل راننده، خروج ارسالی نگهبانی، برگه‌های مرجوعی و سوابق مدیر
const { route, fail } = require('../http');
const store = require('../store');
const dispatch = require('../dispatch');

const SALES = { roles: ['sales', 'admin'] };
const DISPATCH = { roles: ['dispatch', 'admin'] };
const DRIVER = { roles: ['driver'] };
const GATE = { roles: ['gate', 'admin'] };
const ADMIN = { roles: ['admin'] };

function requireDriverUser(ctx) {
  if (!ctx.user.driverId) fail(403, 'این حساب به هیچ راننده‌ای متصل نیست. از مدیر بخواهید حساب را به راننده وصل کند.');
  return ctx.user.driverId;
}
function findOrderOrFail(id) {
  const order = store.get().orders.find((o) => o.id === id);
  if (!order) fail(404, 'سفارش یافت نشد.');
  return order;
}

// ---------- فروش: ارسال سفارش به پخش ----------
route('POST', '/api/orders/:id/send-dispatch', { ...SALES, idempotent: true }, async (ctx) => {
  const order = findOrderOrFail(ctx.params.id);
  dispatch.sendToDispatch(ctx.user, order, ctx.body?.driverId, ctx.body?.items, ctx, ctx.body);
  return { status: 200, body: { order: dispatch.publicOrder(order) } };
});

// فهرست رانندگان فعال برای انتخاب در کارتابل فروش
route('GET', '/api/dispatch/drivers', { roles: ['sales', 'dispatch', 'admin'] }, async () => {
  const drivers = store.get().drivers.filter((d) => d.isActive)
    .map((d) => ({ id: d.id, fullName: d.fullName, plate: d.plate || '', vehicleType: d.vehicleType || '' }));
  return { status: 200, body: { drivers } };
});

// ---------- پخش: مشاهده و پیگیری؛ تخصیص از کارتابل فروش انجام می‌شود ----------
route('GET', '/api/dispatch/orders', DISPATCH, async (ctx) => {
  const db = store.get();
  const filter = String(ctx.query.get('status') || 'open');
  const today = dispatch.todayKey();
  const views = db.orders.flatMap((o) => dispatch.dispatchViews(o)); // v37.5.0 — هر نمای خدمه‌بر یک ردیف (سرویس‌های فروشگاه)
  const pub = (v) => { const p = dispatch.publicOrder({ ...v.order, dispatch: v.dispatch }); p.dispatch.run = v.dispatch.run || null; return p; };
  const isToday = (v) => dispatch.localDay(v.dispatch.deliveredAt || v.dispatch.sentAt) === today;
  const rows = views
    .filter((v) => {
      const s = v.dispatch.status;
      if (filter === 'pending') return s === 'PENDING_ASSIGN';
      if (filter === 'assigned') return ['ASSIGNED', 'DRIVER_EXIT_REPORTED', 'IN_TRANSIT'].includes(s);
      if (filter === 'delivered') return ['DELIVERED', 'SALES_FINALIZED', 'CLOSED'].includes(s) && isToday(v);
      return dispatch.OPEN_STATUSES.includes(s) || (s === 'CLOSED' && isToday(v));
    })
    .sort((a, b) => (a.dispatch.sentAt < b.dispatch.sentAt ? 1 : -1))
    .map(pub);
  const count = (fn) => views.filter((v) => fn(v)).length;
  const activeStates = ['ASSIGNED', 'DRIVER_EXIT_REPORTED', 'IN_TRANSIT'];
  const counts = {
    pending: count((v) => v.dispatch.status === 'PENDING_ASSIGN'),
    assigned: count((v) => activeStates.includes(v.dispatch.status)),
    waitingGate: count((v) => v.dispatch.status === 'DRIVER_EXIT_REPORTED'),
    inTransit: count((v) => v.dispatch.status === 'IN_TRANSIT'),
    delivered: count((v) => ['DELIVERED', 'SALES_FINALIZED', 'CLOSED'].includes(v.dispatch.status) && isToday(v)),
  };
  const drivers = db.drivers.filter((d) => d.isActive).map((driver) => {
    const mine = views.filter((v) => v.dispatch.driverId === driver.id);
    const active = mine.filter((v) => activeStates.includes(v.dispatch.status));
    const doneToday = mine.filter((v) => ['DELIVERED', 'SALES_FINALIZED', 'CLOSED'].includes(v.dispatch.status) && isToday(v));
    const liveOrders = [...active, ...doneToday]
      .sort((a, b) => String(b.order.updatedAt || b.dispatch?.deliveredAt || '').localeCompare(String(a.order.updatedAt || a.dispatch?.deliveredAt || '')))
      .slice(0, 5)
      .map((v) => {
        const o = v.order; const enriched = pub(v);
        return {
          id: o.id, orderNo: o.orderNo || '—', customerName: o.orderType === 'STORE' ? (o.storeName || 'فروشگاه') : (enriched.customer?.name || o.storeName || '—'),
          status: v.dispatch.status, updatedAt: o.updatedAt || v.dispatch.updatedAt || v.dispatch.sentAt,
          deliveredAt: v.dispatch.deliveredAt || null,
        };
      });
    return {
      id: driver.id, fullName: driver.fullName, plate: driver.plate || '', vehicleType: driver.vehicleType || '',
      phone: driver.phone || '', posTerminal: driver.posTerminal || '', posBank: driver.posBank || '', isActive: true,
      activeOrderCount: active.length,
      waitingGateCount: active.filter((o) => o.dispatch.status === 'DRIVER_EXIT_REPORTED').length,
      inTransitCount: active.filter((o) => o.dispatch.status === 'IN_TRANSIT').length,
      deliveredTodayCount: doneToday.length, liveOrders,
    };
  });
  return { status: 200, body: { orders: rows, counts, drivers } };
});

route('POST', '/api/dispatch/orders/:id/assign', { ...SALES, idempotent: true }, async (ctx) => {
  const order = dispatch.findDispatchOrder(ctx.params.id);
  dispatch.assignDriver(ctx.user, order, ctx.body?.driverId, ctx);
  return { status: 200, body: { order: dispatch.publicOrder(order) } };
});

// ---------- راننده ----------
route('GET', '/api/driver/orders', DRIVER, async (ctx) => {
  const driverId = requireDriverUser(ctx);
  const db = store.get();
  const driver = db.drivers.find((d) => d.id === driverId);
  if (!driver) fail(404, 'راننده پیدا نشد.');
  const mine = db.orders.flatMap((o) => dispatch.dispatchViews(o)).filter((v) => v.dispatch.driverId === driverId); // v37.5.0 — هر سرویس فروشگاه یک ردیف
  const pub = (v) => { const p = dispatch.publicOrder({ ...v.order, dispatch: v.dispatch }); p.dispatch.run = v.dispatch.run || null; return p; };
  const today = dispatch.todayKey();
  const byAssigned = (a, b) => String(b.dispatch.assignedAt || b.order.updatedAt || '').localeCompare(String(a.dispatch.assignedAt || a.order.updatedAt || ''));
  const byDelivered = (a, b) => String(b.dispatch.deliveredAt || '').localeCompare(String(a.dispatch.deliveredAt || ''));
  const assigned = mine.filter((v) => ['ASSIGNED', 'DRIVER_EXIT_REPORTED'].includes(v.dispatch.status)).sort(byAssigned).map(pub);
  const inTransit = mine.filter((v) => v.dispatch.status === 'IN_TRANSIT').sort(byAssigned).map(pub);
  const delivered = mine.filter((v) => v.dispatch.status === 'DELIVERED').sort(byDelivered).map(pub);
  const historyAll = mine.filter((v) => ['SALES_FINALIZED', 'CLOSED'].includes(v.dispatch.status)).sort(byDelivered);
  const history = historyAll.slice(0, 100).map(pub);
  const open = mine.filter((v) => ['ASSIGNED', 'DRIVER_EXIT_REPORTED', 'IN_TRANSIT'].includes(v.dispatch.status)).sort(byAssigned).map(pub);
  const todayDone = mine.filter((v) => ['DELIVERED', 'SALES_FINALIZED', 'CLOSED'].includes(v.dispatch.status) && dispatch.localDay(v.dispatch.deliveredAt) === today)
    .sort(byDelivered).map(pub);
  return {
    status: 200,
    body: {
      driver: { id: driver.id, fullName: driver.fullName, phone: driver.phone || '', vehicleType: driver.vehicleType || '', plate: driver.plate || '', posTerminal: driver.posTerminal || '', posBank: driver.posBank || '' },
      open, todayDone, assigned, inTransit, delivered, history, historyTotal: historyAll.length,
    },
  };
});

route('POST', '/api/driver/orders/:id/exit', { ...DRIVER, idempotent: true }, async (ctx) => {
  requireDriverUser(ctx);
  const order = dispatch.findDriverOrder(ctx.user, ctx.params.id);
  dispatch.driverExit(ctx.user, order, ctx);
  return { status: 200, body: { order: dispatch.publicOrder(order) } };
});

route('POST', '/api/driver/orders/:id/deliver', { ...DRIVER, idempotent: true }, async (ctx) => {
  requireDriverUser(ctx);
  const order = dispatch.findDriverOrder(ctx.user, ctx.params.id);
  dispatch.completeDelivery(ctx.user, order, ctx.body || {}, ctx);
  return { status: 200, body: { order: dispatch.publicOrder(order) } };
});

// ---------- فروش: بازبینی و نهایی‌کردن تحویل راننده ----------
route('GET', '/api/sales/dispatch-deliveries', SALES, async () => {
  const activeStates=['ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'];
  const views=store.get().orders.flatMap((o)=>dispatch.dispatchViews(o)); // v37.5.0 — نمای هر سرویس جدا
  const pub=(v)=>{const p=dispatch.publicOrder({...v.order,dispatch:v.dispatch});p.dispatch.run=v.dispatch.run||null;return p;};
  const recent=(a,b)=>String(b.dispatch.salesFinalizedAt||b.dispatch.closedAt||b.dispatch.deliveredAt||b.order.updatedAt||'').localeCompare(String(a.dispatch.salesFinalizedAt||a.dispatch.closedAt||a.dispatch.deliveredAt||a.order.updatedAt||''));
  const byActive=(a,b)=>String(b.order.updatedAt||b.dispatch.assignedAt||'').localeCompare(String(a.order.updatedAt||a.dispatch.assignedAt||''));
  const finalized=views.filter(v=>['SALES_FINALIZED','CLOSED'].includes(v.dispatch.status)).sort(recent);
  const assigned=views.filter(v=>['ASSIGNED','DRIVER_EXIT_REPORTED'].includes(v.dispatch.status)).sort(byActive);
  const inTransit=views.filter(v=>v.dispatch.status==='IN_TRANSIT').sort(byActive);
  return {status:200,body:{
    active:views.filter(v=>activeStates.includes(v.dispatch.status)).sort(byActive).map(pub),
    assigned:assigned.map(pub),inTransit:inTransit.map(pub),
    pending:views.filter(v=>v.dispatch.status==='DELIVERED').sort(recent).map(pub),
    finalized:finalized.slice(0,30).map(pub),finalizedTotal:finalized.length,
  }};
});

route('GET', '/api/sales/dispatch-deliveries/:id', SALES, async (ctx) => {
  const order = dispatch.findDispatchOrder(ctx.params.id);
  if (!['DELIVERED', 'SALES_FINALIZED', 'CLOSED'].includes(order.dispatch.status)) fail(404, 'تحویل ثبت‌شده یافت نشد.');
  return { status: 200, body: { order: dispatch.publicOrder(order), signatureData: order.dispatch.signatureData || '' } };
});

route('POST', '/api/sales/dispatch-deliveries/:id/finalize', { ...SALES, idempotent: true }, async (ctx) => {
  const order = dispatch.findDispatchOrder(ctx.params.id);
  dispatch.salesFinalizeDelivery(ctx.user, order, ctx, ctx.body || {}); // v37.6.0 — body.items قابل حذف: تغییر قیمت پیش از صدور فاکتور
  return { status: 200, body: { order: dispatch.publicOrder(order) } };
});

// ---------- نگهبانی: تأیید خروج راننده پیش از حرکت ----------
route('GET', '/api/gate/dispatch', GATE, async () => {
  const orders = store.get().orders.filter((o) => o.dispatch);
  const pick = (s) => orders.filter((o) => o.dispatch.status === s)
    .sort((a, b) => {
      const at = a.dispatch.driverExitAt || a.dispatch.assignedAt || a.dispatch.deliveredAt || a.dispatch.sentAt || '';
      const bt = b.dispatch.driverExitAt || b.dispatch.assignedAt || b.dispatch.deliveredAt || b.dispatch.sentAt || '';
      return at < bt ? 1 : -1;
    }).map(dispatch.publicOrder);
  return {
    status: 200,
    body: {
      awaitingDriver: pick('ASSIGNED'),
      leaving: pick('DRIVER_EXIT_REPORTED'),
      inTransit: pick('IN_TRANSIT'),
    },
  };
});

route('POST', '/api/gate/dispatch/:id/exit', { ...GATE, idempotent: true }, async (ctx) => {
  const order = dispatch.findDispatchOrder(ctx.params.id);
  dispatch.gateExit(ctx.user, order, ctx);
  return { status: 200, body: { order: dispatch.publicOrder(order) } };
});

route('POST', '/api/gate/dispatch/:id/close', { ...GATE, idempotent: true }, async (ctx) => {
  const order = dispatch.findDispatchOrder(ctx.params.id);
  dispatch.gateFinalExit(ctx.user, order, ctx);
  return { status: 200, body: { order: dispatch.publicOrder(order) } };
});

// ---------- برگه‌های مرجوعی: راننده → فروش → انبار ----------
route('GET', '/api/returns', { roles: ['sales', 'warehouse', 'admin'] }, async (ctx) => {
  const want = String(ctx.query.get('status') || 'open');
  const rows = store.get().dispatchReturns
    .filter((r) => (want === 'open' ? r.status !== 'RECEIVED' : r.status === want))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const counts = {
    atSales: store.get().dispatchReturns.filter((r) => r.status === 'AT_SALES').length,
    atWarehouse: store.get().dispatchReturns.filter((r) => r.status === 'AT_WAREHOUSE').length,
    received: store.get().dispatchReturns.filter((r) => r.status === 'RECEIVED').length,
  };
  return { status: 200, body: { returns: rows, counts } };
});

route('POST', '/api/returns/:id/refer', { roles: ['sales'], idempotent: true }, async (ctx) => {
  const t = dispatch.findReturn(ctx.params.id);
  dispatch.referReturnToWarehouse(ctx.user, t, ctx);
  return { status: 200, body: { return: t } };
});

route('POST', '/api/returns/:id/receive', { roles: ['warehouse'], idempotent: true }, async (ctx) => {
  const t = dispatch.findReturn(ctx.params.id);
  dispatch.receiveReturnAtWarehouse(ctx.user, t, ctx);
  return { status: 200, body: { return: t } };
});

// ---------- مدیر: سوابق رانندگان ----------
route('GET', '/api/admin/driver-records', ADMIN, async (ctx) => {
  const q = ctx.query;
  const kind = ['return', 'shortage'].includes(q.get('kind')) ? q.get('kind') : '';
  const settlement = ['CASH', 'CREDIT'].includes(String(q.get('settlement') || '').toUpperCase()) ? String(q.get('settlement')).toUpperCase() : '';
  return { status: 200, body: dispatch.driverRecords({ driverId: q.get('driverId') || '', from: q.get('from') || '', to: q.get('to') || '', settlement, kind }) };
});

route('GET', '/api/admin/driver-records/:orderId', ADMIN, async (ctx) => {
  const order = store.get().orders.find((o) => o.id === ctx.params.orderId);
  if (!order || !order.dispatch) fail(404, 'سابقه تحویل یافت نشد.');
  return { status: 200, body: { order: dispatch.publicOrder(order), signatureData: order.dispatch.signatureData || '' } };
});
