'use strict';
// جریان سفارش: فروشگاه ← تأیید فروش ← سفارش‌های آینده ← انبار ← تسویه ← خروج
const { route, fail, normalizeRole } = require('../http');
const store = require('../store');
const validate = require('../validate');
const { getProduct, enrichOrder, createNotification, activateDueRemoteOrders, today, nowLocalMinute } = require('../domain');

const ACTIVE = (i) => i.itemStatus !== 'CANCELLED';

function findOrder(id) {
  const order = store.get().orders.find((o) => o.id === id);
  if (!order) fail(404, 'سفارش یافت نشد.');
  return order;
}

// اعتبارسنجی یک قلم سفارش و برگرداندن مقدار نرمال‌شده
function normalizeLine(x, { requireProduct = true } = {}) {
  const product = getProduct(String(x?.productId || ''));
  if (!product || !product.isActive) {
    if (requireProduct || x?.productId) fail(400, 'یکی از محصولات انتخاب‌شده معتبر نیست.');
  }
  return {
    product,
    productId: product?.id,
    requestedQty: validate.number(x?.requestedQty, { field: 'مقدار درخواستی', min: 0.001, max: validate.MAX_QTY }),
    requestedUnit: validate.unit(x?.requestedUnit),
    description: validate.text(x?.description, { field: 'توضیحات قلم', max: 300 }),
  };
}

function newItem(orderId, line) {
  return {
    id: store.uid(), orderId, productId: line.productId, requestedQty: line.requestedQty, requestedUnit: line.requestedUnit,
    description: line.description, deliveredKg: null, unitPrice: null, finalAmount: null, itemStatus: 'PENDING', returnReason: '',
  };
}

function newOrder(fields) {
  // v37.6.0 — سفارش‌های فروشگاه شمارهٔ شش‌رقمی سری شعبه (${40+branchNo} + ۴ رقم) می‌گیرند؛ بقیه همان سری سراسری
  const orderNo = fields.orderType === 'STORE' ? store.nextStoreOrderNumber(fields.branchNo ?? 1) : store.nextOrderNumber();
  return {
    id: store.uid(), orderNo, createdAt: store.nowIso(), updatedAt: store.nowIso(), ...fields,
  };
}

// v37.3.2 — تاریخ شمسی در متن اعلان‌ها (مقدار ذخیره‌شده همچنان ISO است)
function faDateLabel(iso) {
  try {
    const p = {};
    new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext', { day: 'numeric', month: 'long', year: 'numeric' })
      .formatToParts(new Date(`${iso}T00:00:00`)).forEach((x) => { if (x.type !== 'literal') p[x.type] = x.value; });
    return p.year ? `${p.day} ${p.month} ${p.year}` : iso;
  } catch { return iso; }
}

// ---------- فروشگاه ----------
route('GET', '/api/store/orders', { roles: ['store'] }, async (ctx) => {
  activateDueRemoteOrders();
  const rows = store.get().orders.filter((o) => o.orderType === 'STORE' && o.storeId === ctx.user.id).slice().reverse().map(enrichOrder);
  return { status: 200, body: { orders: rows.slice(0, 100), total: rows.length } };
});

route('POST', '/api/store/orders', { roles: ['store'], idempotent: true }, async (ctx) => {
  const db = store.get();
  const b = ctx.body;
  const name = validate.text(b.name, { field: 'نام مشتری', max: 120, required: true });
  const phone = validate.phone(b.phone);
  validate.items(b.items);
  const lines = b.items.map((x) => normalizeLine(x));
  const customer = require('../customers').upsertCustomer(db, { customerId: b.customerId, customerCode: b.customerCode, name, phone });
  const branchNo = require('../order-numbers').checkBranchNo(ctx.user.branchNo ?? 1); // v37.6.0 — شمارهٔ سفارش فروشگاه از روی شعبهٔ کاربر فروشگاه
  const order = newOrder({
    branchNo, visitId: null, customerId: customer.id, orderType: 'STORE', source: 'STORE_PORTAL', storeId: ctx.user.id,
    storeName: String(ctx.user.storeName || ctx.user.fullName || 'فروشگاه').trim(), scheduledDate: null, scheduledAt: null,
    approvalStatus: 'PENDING_SALES', status: 'STORE_PENDING_SALES', notes: validate.text(b.notes, { field: 'یادداشت', max: 1000 }), createdBy: ctx.user.id,
  });
  db.orders.push(order);
  lines.forEach((l) => db.orderItems.push({ ...newItem(order.id, l), description: l.description }));
  createNotification('sales', 'STORE_ORDER_PENDING', 'order', order.id, `سفارش فروشگاه ${order.storeName} ${order.orderNo} برای تایید فروش ثبت شد.`);
  store.audit(ctx.user, 'CREATE_STORE_ORDER', 'order', order.id, { storeId: ctx.user.id, storeName: order.storeName, orderNo: order.orderNo, itemCount: lines.length }, ctx);
  store.save();
  return { status: 201, body: { order: enrichOrder(order) } };
});

route('PUT', '/api/store/orders/:id', { roles: ['store'] }, async (ctx) => {
  const db=store.get(), order=db.orders.find(o=>o.id===ctx.params.id);
  if(!order||order.orderType!=='STORE'||order.storeId!==ctx.user.id)fail(404,'سفارش فروشگاه یافت نشد.');
  if(order.status!=='STORE_PENDING_SALES')fail(409,'ویرایش فقط تا پیش از بررسی فروش مجاز است.');
  const b=ctx.body, name=validate.text(b.name,{field:'نام مشتری',max:120,required:true}), phone=validate.phone(b.phone);
  validate.items(b.items); const lines=b.items.map(normalizeLine);
  const customer=require('../customers').upsertCustomer(db,{customerId:order.customerId,name,phone});
  order.customerId=customer.id;order.notes=validate.text(b.notes,{field:'یادداشت',max:1000});order.updatedAt=store.nowIso();
  db.orderItems.filter(i=>i.orderId===order.id).forEach(i=>{i.itemStatus='CANCELLED';i.finalAmount=0;});
  lines.forEach(l=>db.orderItems.push({...newItem(order.id,l),description:l.description}));
  store.audit(ctx.user,'UPDATE_STORE_ORDER','order',order.id,{orderNo:order.orderNo,itemCount:lines.length},ctx);store.save();
  return {status:200,body:{order:enrichOrder(order)}};
});

// v37.20.0 — ویرایش سفارش ورودی فروشگاه در کارتابل فروش (تغییر مقدار/محصول، حذف و اضافهٔ قلم)
// فقط پیش از تأیید فروش مجاز است؛ پس از آن سفارش وارد چرخهٔ زمان‌بندی/انبار شده و قفل می‌شود.
route('PUT', '/api/store/orders/:id/sales-edit', { roles: ['sales'] }, async (ctx) => {
  const db = store.get(), order = db.orders.find(o => o.id === ctx.params.id);
  if (!order || order.orderType !== 'STORE') fail(404, 'سفارش فروشگاه یافت نشد.');
  if (order.status !== 'STORE_PENDING_SALES') fail(409, 'ویرایش سفارش فروشگاه در کارتابل فروش فقط پیش از تأیید فروش مجاز است.');
  const b = ctx.body;
  validate.items(b.items);
  const lines = b.items.map((x) => normalizeLine(x));
  const before = db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i))
    .map((i) => ({ productId: i.productId, requestedQty: i.requestedQty, requestedUnit: i.requestedUnit, description: i.description || '' }));
  db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i)).forEach((i) => { i.itemStatus = 'CANCELLED'; i.finalAmount = 0; });
  lines.forEach((l) => db.orderItems.push({ ...newItem(order.id, l), description: l.description }));
  if (b.notes !== undefined) order.notes = validate.text(b.notes, { field: 'یادداشت', max: 1000 });
  order.updatedAt = store.nowIso();
  const after = lines.map((l) => ({ productId: l.productId, requestedQty: l.requestedQty, requestedUnit: l.requestedUnit, description: l.description || '' }));
  store.audit(ctx.user, 'SALES_EDIT_STORE_ORDER', 'order', order.id, { orderNo: order.orderNo, storeName: order.storeName, before, after }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

route('POST', '/api/store/orders/:id/confirm-receipt', { roles: ['store'], idempotent: true }, async (ctx) => {
  const order=store.get().orders.find(o=>o.id===ctx.params.id);
  if(!order||order.orderType!=='STORE'||order.storeId!==ctx.user.id)fail(404,'سفارش فروشگاه یافت نشد یا متعلق به این فروشگاه نیست.');
  const runReq=Number(ctx.body?.run)===2?2:(Number(ctx.body?.run)===1?1:0);
  if(runReq){ // v37.5.0 — تأیید دریافت محمولهٔ هر سرویس، جداگانه
    const SR=require('../store-runs');
    if(!SR.isStoreRunOrder(order))fail(409,'این سفارش ارسال سرویسی ندارد.');
    const real=(order.dispatch&&order.dispatch.run===runReq)?order.dispatch:((Array.isArray(order.dispatches)?order.dispatches:[]).find((x)=>x&&x.run===runReq)||null);
    if(!real)fail(404,`محمولهٔ سرویس ${runReq===2?'دوم':'اول'} برای این سفارش یافت نشد.`);
    if(!['DELIVERED','SALES_FINALIZED','CLOSED'].includes(real.status))fail(409,'تأیید دریافت فقط پس از ثبت تحویل این محموله توسط راننده مجاز است.');
    if(!real.storeReceiptConfirmedAt){
      real.storeReceiptConfirmedAt=store.nowIso();real.storeReceiptConfirmedBy=ctx.user.id;order.updatedAt=store.nowIso();
      createNotification('sales','STORE_RECEIPT_CONFIRMED','order',order.id,`فروشگاه ${order.storeName} دریافت محمولهٔ سرویس ${runReq===2?'دوم':'اول'} سفارش ${order.orderNo} را تأیید کرد.`);
      store.audit(ctx.user,'STORE_RUN_RECEIPT_CONFIRMED','order',order.id,{orderNo:order.orderNo,storeId:order.storeId,run:runReq,deliveredAt:real.deliveredAt},ctx);
      store.save();
    }
    return {status:200,body:{order:enrichOrder(order)}};
  }
  if(!order.dispatch||!['DELIVERED','SALES_FINALIZED','CLOSED'].includes(order.dispatch.status))fail(409,'تأیید دریافت فقط پس از ثبت تحویل توسط راننده مجاز است.');
  if(!order.storeReceiptConfirmedAt){
    order.storeReceiptConfirmedAt=store.nowIso();order.storeReceiptConfirmedBy=ctx.user.id;order.updatedAt=store.nowIso();
    createNotification('sales','STORE_RECEIPT_CONFIRMED','order',order.id,`فروشگاه ${order.storeName} دریافت سفارش ${order.orderNo} را تأیید کرد.`);
    store.audit(ctx.user,'STORE_RECEIPT_CONFIRMED','order',order.id,{orderNo:order.orderNo,storeId:order.storeId,deliveredAt:order.dispatch.deliveredAt},ctx);
    store.save();
  }
  return {status:200,body:{order:enrichOrder(order)}};
});

route('GET', '/api/store/orders/:id', { roles: ['store'] }, async (ctx) => {
  activateDueRemoteOrders();
  const order = store.get().orders.find((o) => o.id === ctx.params.id);
  if (!order || order.orderType !== 'STORE' || order.storeId !== ctx.user.id) fail(404, 'سفارش فروشگاه پیدا نشد یا متعلق به این فروشگاه نیست.');
  return { status: 200, body: { order: enrichOrder(order) } };
});

route('POST', '/api/store/orders/:id/cancel', { roles: ['store'] }, async (ctx) => {
  const order = store.get().orders.find((o) => o.id === ctx.params.id);
  if (!order || order.orderType !== 'STORE' || order.storeId !== ctx.user.id) fail(404, 'سفارش فروشگاه یافت نشد.');
  if (order.status !== 'STORE_PENDING_SALES') fail(409, 'پس از تایید فروش، لغو سفارش از کارتابل فروشگاه مجاز نیست.');
  const reason = validate.text(ctx.body.reason || 'لغو توسط فروشگاه', { field: 'دلیل لغو', max: 300 });
  order.status = 'CANCELLED'; order.approvalStatus = 'CANCELLED'; order.cancelReason = reason; order.updatedAt = store.nowIso();
  store.get().orderItems.filter((i) => i.orderId === order.id).forEach((i) => { i.itemStatus = 'CANCELLED'; i.finalAmount = 0; });
  store.audit(ctx.user, 'CANCEL_STORE_ORDER', 'order', order.id, { reason }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

route('POST', '/api/store/orders/:id/quick-send', { roles: ['sales'], idempotent: true }, async (ctx) => {
  const db=store.get();
  const order=db.orders.find(o=>o.id===ctx.params.id);
  if(!order||order.orderType!=='STORE')fail(404,'سفارش فروشگاه یافت نشد.');
  if(!['STORE_PENDING_SALES','SCHEDULED_REMOTE'].includes(order.status))fail(409,'ارسال سریع فقط برای سفارش فروشگاهی منتظر تأیید یا زمان‌بندی‌شده مجاز است.');
  const fromStatus=order.status;
  const at=nowLocalMinute();
  const dispatchPlace=validate.text(ctx.body.dispatchPlace||order.dispatchPlace||order.storeName,{field:'محل ارسال',max:200});
  Object.assign(order,{status:'WAREHOUSE_PENDING',approvalStatus:'APPROVED',scheduledDate:at.slice(0,10),scheduledAt:at,dispatchPlace,approvedBy:ctx.user.id,approvedAt:store.nowIso(),quickSentAt:store.nowIso(),quickSentBy:ctx.user.id,activatedAt:store.nowIso(),updatedAt:store.nowIso()});
  createNotification('warehouse','STORE_ORDER_QUICK_SENT','order',order.id,`سفارش فروشگاه ${order.storeName} ${order.orderNo} با ارسال سریع وارد صف انبار شد.`);
  store.audit(ctx.user,'QUICK_SEND_STORE_ORDER','order',order.id,{orderNo:order.orderNo,dispatchPlace,scheduledAt:at,fromStatus},ctx);
  store.save();
  return {status:200,body:{order:enrichOrder(order)}};
});

route('POST', '/api/store/orders/:id/approve', { roles: ['sales'], idempotent: true }, async (ctx) => {
  const order = store.get().orders.find((o) => o.id === ctx.params.id);
  if (!order || order.orderType !== 'STORE') fail(404, 'سفارش فروشگاه یافت نشد.');
  if (order.status !== 'STORE_PENDING_SALES') fail(409, 'این سفارش قبلاً بررسی شده است.');
  const scheduledAt = validate.digitsToAscii(ctx.body.scheduledAt || '').trim();
  if (!validate.localDateTime(scheduledAt)) fail(400, 'تاریخ یا ساعت ارسال معتبر نیست؛ ساعت باید ۲۴ ساعته و به شکل 08:30 باشد.');
  if (scheduledAt < nowLocalMinute()) fail(400, 'تاریخ و ساعت ارسال نمی‌تواند قبل از زمان فعلی باشد.');
  const dispatchPlace = validate.text(ctx.body.dispatchPlace || order.storeName, { field: 'محل ارسال', max: 200 });
  Object.assign(order, {
    scheduledDate: scheduledAt.slice(0, 10), scheduledAt, dispatchPlace, approvalStatus: 'APPROVED',
    approvedBy: ctx.user.id, approvedAt: store.nowIso(), updatedAt: store.nowIso(),
  });
  const due = scheduledAt <= nowLocalMinute();
  order.status = due ? 'WAREHOUSE_PENDING' : 'SCHEDULED_REMOTE';
  createNotification(due ? 'warehouse' : 'sales', 'STORE_ORDER_APPROVED', 'order', order.id,
    due ? `سفارش فروشگاه ${order.storeName} تایید شد و در صف انبار قرار گرفت.` : `سفارش فروشگاه ${order.storeName} تایید و برای ${scheduledAt.replace('T', ' ')} برنامه‌ریزی شد.`);
  store.audit(ctx.user, 'APPROVE_STORE_ORDER', 'order', order.id, { scheduledAt, due, dispatchPlace, storeId: order.storeId }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

// ---------- سفارش‌های آینده (غیرحضوری) ----------
route('POST', '/api/orders/remote', { roles: ['sales'], idempotent: true }, async (ctx) => {
  const db = store.get();
  const b = ctx.body;
  const name = validate.text(b.name, { field: 'نام مشتری', max: 120, required: true });
  const phone = validate.phone(b.phone);
  const scheduledDate = validate.digitsToAscii(b.scheduledDate || today()).slice(0, 10);
  const scheduledTime = validate.digitsToAscii(b.scheduledTime || '08:00').slice(0, 5);
  const scheduledAt = validate.digitsToAscii(b.scheduledAt || `${scheduledDate}T${scheduledTime}`);
  if (!validate.localDateTime(scheduledAt)) fail(400, 'تاریخ یا ساعت سفارش معتبر نیست؛ ساعت باید ۲۴ ساعته و به شکل 08:30 باشد.');
  if (scheduledDate < today()) fail(400, 'تاریخ سفارش نمی‌تواند قبل از امروز باشد.');
  validate.items(b.items);
  const lines = b.items.map((x) => normalizeLine(x));
  const customer = require('../customers').upsertCustomer(db, { customerId: b.customerId, customerCode: b.customerCode, name, phone });
  const due = scheduledAt <= nowLocalMinute();
  const order = newOrder({
    visitId: null, customerId: customer.id, orderType: 'REMOTE', source: 'SALES_REMOTE', scheduledDate, scheduledAt,
    status: due ? 'WAREHOUSE_PENDING' : 'SCHEDULED_REMOTE', notes: validate.text(b.notes, { field: 'یادداشت', max: 1000 }),
    dispatchPlace: validate.text(b.dispatchPlace, { field: 'محل ارسال', max: 200 }), createdBy: ctx.user.id,
  });
  db.orders.push(order);
  lines.forEach((l) => db.orderItems.push(newItem(order.id, l)));
  createNotification('warehouse', 'NEW_REMOTE_ORDER', 'order', order.id, due
    ? `سفارش غیرحضوری ${order.orderNo} برای امروز ثبت شد و در صف انبار قرار گرفت.`
    : `سفارش غیرحضوری ${order.orderNo} برای تاریخ ${faDateLabel(scheduledDate)} ثبت شد.`);
  store.audit(ctx.user, 'CREATE_REMOTE_ORDER', 'order', order.id, { customerId: customer.id, scheduledDate, scheduledAt, orderNo: order.orderNo, itemCount: lines.length }, ctx);
  store.save();
  return { status: 201, body: { order: enrichOrder(order) } };
});

route('PUT', '/api/orders/:id/remote', { roles: ['sales'] }, async (ctx) => {
  const order = store.get().orders.find((o) => o.id === ctx.params.id);
  if (!order || order.orderType !== 'REMOTE') fail(404, 'سفارش غیرحضوری یافت نشد.');
  if (order.status !== 'SCHEDULED_REMOTE') fail(409, 'سفارش غیرحضوری پس از فعال شدن قابل ویرایش نیست.');
  const b = ctx.body;
  const scheduledDate = validate.digitsToAscii(b.scheduledDate || order.scheduledDate).slice(0, 10);
  const scheduledTime = validate.digitsToAscii(b.scheduledTime || String(order.scheduledAt || '').slice(11, 16) || '08:00').slice(0, 5);
  const scheduledAt = validate.digitsToAscii(b.scheduledAt || `${scheduledDate}T${scheduledTime}`);
  if (!validate.localDateTime(scheduledAt)) fail(400, 'تاریخ یا ساعت سفارش معتبر نیست؛ ساعت باید ۲۴ ساعته و به شکل 08:30 باشد.');
  if (scheduledDate < today()) fail(400, 'تاریخ سفارش نمی‌تواند قبل از امروز باشد.');
  const before = { scheduledDate: order.scheduledDate, scheduledAt: order.scheduledAt, dispatchPlace: order.dispatchPlace, notes: order.notes };
  Object.assign(order, {
    scheduledDate, scheduledAt,
    dispatchPlace: validate.text(b.dispatchPlace ?? order.dispatchPlace, { field: 'محل ارسال', max: 200 }),
    notes: validate.text(b.notes ?? order.notes, { field: 'یادداشت', max: 1000 }), updatedAt: store.nowIso(),
  });
  store.audit(ctx.user, 'UPDATE_REMOTE_ORDER', 'order', order.id, { before, after: { scheduledDate, scheduledAt, dispatchPlace: order.dispatchPlace, notes: order.notes } }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

route('POST', '/api/orders/:id/cancel-remote', { roles: ['sales'] }, async (ctx) => {
  const db = store.get();
  const order = findOrder(ctx.params.id);
  if (order.orderType !== 'REMOTE') fail(404, 'سفارش غیرحضوری یافت نشد.');
  if (!['SCHEDULED_REMOTE', 'RETURNED_TO_SALES'].includes(order.status)) fail(409, 'این سفارش در وضعیت قابل لغو نیست.');
  order.status = 'CANCELLED';
  order.cancelReason = validate.text(ctx.body.reason || 'لغو توسط فروش', { field: 'دلیل لغو', max: 300 });
  order.updatedAt = store.nowIso();
  db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i)).forEach((i) => { i.itemStatus = 'CANCELLED'; i.finalAmount = 0; });
  store.audit(ctx.user, 'CANCEL_REMOTE_ORDER', 'order', order.id, { reason: order.cancelReason }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

// ---------- سفارش حضوری ----------
route('POST', '/api/orders', { roles: ['sales'], idempotent: true }, async (ctx) => {
  const db = store.get();
  const b = ctx.body;
  const visit = db.visits.find((v) => v.id === String(b.visitId || ''));
  if (!visit) fail(404, 'ورودی یافت نشد.');
  if (visit.status !== 'WAITING_SALES') fail(409, 'این مراجعه دیگر در صف ثبت سفارش فروش نیست.');
  validate.items(b.items);
  const lines = b.items.map((x) => normalizeLine(x));
  const order = newOrder({
    visitId: visit.id, customerId: visit.customerId, orderType: 'ONSITE', source: 'SALES_COUNTER', scheduledDate: null,
    status: 'WAREHOUSE_PENDING', notes: validate.text(b.notes, { field: 'یادداشت', max: 1000 }), createdBy: ctx.user.id,
  });
  db.orders.push(order);
  lines.forEach((l) => db.orderItems.push(newItem(order.id, l)));
  visit.status = 'ORDERED';
  createNotification('warehouse', 'NEW_ORDER', 'order', order.id, `سفارش جدید ${order.orderNo} برای انبار ارسال شد.`);
  store.audit(ctx.user, 'CREATE_ORDER', 'order', order.id, { visitId: visit.id, orderNo: order.orderNo, itemCount: lines.length }, ctx);
  store.save();
  return { status: 201, body: { order: enrichOrder(order) } };
});

// فهرست سفارش‌ها با جستجو و صفحه‌بندی در Backend
route('GET', '/api/orders', { roles: ['admin', 'gate', 'sales', 'warehouse'] }, async (ctx) => {
  const db = store.get();
  activateDueRemoteOrders();
  const role = normalizeRole(ctx.user.roleCode);
  const status = ctx.query.get('status');
  const q = String(ctx.query.get('q') || '').trim().toLowerCase().slice(0, 80);
  const limit = Math.min(200, Math.max(1, Number(ctx.query.get('limit')) || 100));
  const offset = Math.max(0, Number(ctx.query.get('offset')) || 0);
  let rows = db.orders.slice().reverse();
  if (role === 'gate') rows = rows.filter((o) => ['SETTLED', 'EXITED'].includes(o.status) && !o.dispatch);
  else if (role === 'warehouse') rows = rows.filter((o) => ['WAREHOUSE_PENDING', 'WAREHOUSE_PREPARING'].includes(o.status));
  if (status) rows = rows.filter((o) => o.status === status);
  if (q) {
    rows = rows.filter((o) => {
      const c = db.customers.find((x) => x.id === o.customerId);
      return [o.orderNo, o.storeName, c?.name, c?.phone, c?.plate].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }
  const total = rows.length;
  return { status: 200, body: { orders: rows.slice(offset, offset + limit).map(enrichOrder), total, limit, offset } };
});

route('GET', '/api/orders/:id', { roles: ['admin', 'gate', 'sales', 'warehouse', 'driver'] }, async (ctx) => {
  const order = findOrder(ctx.params.id);
  const role = normalizeRole(ctx.user.roleCode);
  // v37.27.0 — راننده فقط جزئیات محموله‌ای را می‌بیند که به خودش واگذار شده است؛
  // پاسخ محدود به همان سرویس است (بدون پرداخت‌ها، بدون خدمه‌برهای دیگر، بدون دادهٔ امضا).
  if (role === 'driver') {
    const dispatchLib = require('../dispatch');
    if (!ctx.user.driverId) fail(403, 'این حساب به هیچ راننده‌ای متصل نیست.', 'FORBIDDEN');
    const views = dispatchLib.dispatchViews(order).filter((v) => v.dispatch && v.dispatch.driverId === ctx.user.driverId);
    if (!views.length) fail(403, 'این سفارش در فهرست تحویل شما نیست.', 'FORBIDDEN');
    const runQ = Number(ctx.query.get('run')) || null;
    const view = views.find((v) => (v.dispatch.run || null) === runQ)
      || views.find((v) => dispatchLib.OPEN_STATUSES.includes(v.dispatch.status))
      || views[views.length - 1];
    const scoped = dispatchLib.publicOrder({ ...order, dispatch: view.dispatch });
    const { payments, payment, visit, dispatchRuns, storeRun, ...rest } = scoped; // eslint-disable-line no-unused-vars
    rest.storeRunOps = order.storeRunOps || {};
    return { status: 200, body: { order: rest } };
  }
  if (role === 'gate' && (!['SETTLED', 'EXITED'].includes(order.status) || order.dispatch)) fail(403, 'این سفارش از گردش پخش خارج شده و به کارتابل نگهبانی ارجاع نمی‌شود.', 'FORBIDDEN');
  if (role === 'warehouse' && !['WAREHOUSE_PENDING', 'WAREHOUSE_PREPARING'].includes(order.status)) fail(403, 'دسترسی برای این نقش مجاز نیست.', 'FORBIDDEN');
  return { status: 200, body: { order: enrichOrder(order) } };
});

// ---------- انبار ----------
route('POST', '/api/orders/:id/warehouse/accept', { roles: ['warehouse'], idempotent: true }, async (ctx) => {
  const order = findOrder(ctx.params.id);
  if (order.status !== 'WAREHOUSE_PENDING') fail(409, 'این سفارش در بخش سفارش‌های ورودی نیست.');
  const now = store.nowIso();
  Object.assign(order, { status: 'WAREHOUSE_PREPARING', warehouseAcceptedAt: now, warehouseAcceptedBy: ctx.user.id, warehousePreparationStartedAt: null, warehousePreparationStartedBy: null, updatedAt: now });
  store.audit(ctx.user, 'WAREHOUSE_ACCEPT_ORDER', 'order', order.id, { from: 'WAREHOUSE_PENDING', to: 'WAREHOUSE_PREPARING' }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

route('POST', '/api/orders/:id/warehouse/start-preparing', { roles: ['warehouse'] }, async (ctx) => {
  const order = findOrder(ctx.params.id);
  if (order.status !== 'WAREHOUSE_PREPARING') fail(409, 'این سفارش ابتدا باید توسط انبار تأیید و وارد آماده‌سازی شود.');
  if (!order.warehousePreparationStartedAt) {
    Object.assign(order, { warehousePreparationStartedAt: store.nowIso(), warehousePreparationStartedBy: ctx.user.id, updatedAt: store.nowIso() });
    store.audit(ctx.user, 'WAREHOUSE_START_PREPARING', 'order', order.id, {}, ctx);
    store.save();
  }
  return { status: 200, body: { order: enrichOrder(order) } };
});

route('POST', '/api/orders/:id/warehouse/reopen-preparing', { roles: ['sales'] }, async (ctx) => {
  const db = store.get();
  const order = findOrder(ctx.params.id);
  if (order.status !== 'SETTLEMENT_PENDING') fail(409, 'فقط سفارش آماده تسویه می‌تواند به آماده‌سازی انبار برگردد.');
  if (order.dispatch) fail(409, 'سفارشِ ارسال‌شده به پخش را نمی‌توان از این مسیر به انبار برگرداند.');
  db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i)).forEach((i) => Object.assign(i, { itemStatus: 'PENDING', deliveredKg: null, unitPrice: null, finalAmount: null, warehouseStatus: null }));
  if (order.storeRunOps?.finalizedAt) order.storeRunOps = { ...order.storeRunOps, finalizedAt: null, finalizedBy: null, finalizedByName: null }; // v37.35.0 — بازگشت به آماده‌سازی یعنی کار انبار دوباره باز است
  Object.assign(order, { status: 'WAREHOUSE_PREPARING', warehouseReopenedAt: store.nowIso(), warehouseReopenedBy: ctx.user.id, warehousePreparationStartedAt: null, warehousePreparationStartedBy: null, updatedAt: store.nowIso() });
  createNotification('warehouse', 'REOPEN_PREPARING', 'order', order.id, `سفارش ${order.orderNo || '—'} برای بررسی مجدد و آماده‌سازی به انبار برگشت داده شد.`);
  store.audit(ctx.user, 'REOPEN_WAREHOUSE_PREPARING', 'order', order.id, { from: 'SETTLEMENT_PENDING', to: 'WAREHOUSE_PREPARING' }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

// ثبت وزن نهایی: همه اقلام فعال باید وزن (یا وضعیت ناموجود) داشته باشند
route('POST', '/api/orders/:id/warehouse', { roles: ['warehouse'], idempotent: true }, async (ctx) => {
  const db = store.get();
  const order = findOrder(ctx.params.id);
  if (order.status !== 'WAREHOUSE_PREPARING') fail(409, 'این سفارش ابتدا باید توسط انبار تأیید و وارد آماده‌سازی شود.');
  if (order.orderType === 'STORE') fail(409, 'سفارش فروشگاه فقط با عملیات سرویس اول/دوم و «پایان عملیات ارسال امروز» نهایی می‌شود.'); // v37.4.0
  const updates = Array.isArray(ctx.body.items) ? ctx.body.items : [];
  const active = db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i));
  const byId = new Map(updates.map((x) => [String(x?.itemId), x]));
  const plan = active.map((item) => {
    const x = byId.get(item.id);
    if (!x) fail(400, `وزن قلم «${getProduct(item.productId)?.name || item.productId}» ثبت نشده است.`);
    if (x.outOfStock) return { item, status: 'OUT_OF_STOCK', kg: 0 };
    const kg = validate.number(x.deliveredKg, { field: 'وزن تحویلی', min: 0.001, max: validate.MAX_QTY });
    return { item, status: 'DELIVERED', kg };
  });
  if (!plan.length) fail(409, 'هیچ قلم فعالی برای ثبت وزن وجود ندارد.');
  const now = store.nowIso();
  for (const p of plan) Object.assign(p.item, { itemStatus: p.status, deliveredKg: p.kg, returnReason: '', warehouseStatus: p.status }); // v37.3.5: نتیجهٔ انبار حتی اگر فروش بعداً قلم را لغو کند حفظ می‌شود
  Object.assign(order, { status: 'SETTLEMENT_PENDING', warehouseCompletedAt: now, warehouseCompletedBy: ctx.user.id, updatedAt: now });
  createNotification('sales', 'WAREHOUSE_DONE', 'order', order.id, `وزن نهایی سفارش ${order.orderNo || '—'} ثبت شد و برای تسویه فروش ارسال شد.`);
  store.audit(ctx.user, 'WAREHOUSE_FINALIZE', 'order', order.id, { items: plan.map((p) => ({ itemId: p.item.id, status: p.status, deliveredKg: p.kg })) }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

// ---------- v37.3.4 — سوابق و گزارش انبار ----------
// سفارش‌هایی که وزن نهایی‌شان در انبار ثبت شده (warehouseCompletedAt) و ارجاع‌های انبار به فروش، در یک بازهٔ تاریخ محلی
function whLocalDay(iso) {
  const d = new Date(iso); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const WH_DAY = /^\d{4}-\d{2}-\d{2}$/;

// ---------- v37.11.0 — آمار زندهٔ سفارشات ورودی امروز (داشبورد انبار) ----------
// «ورودی امروز» یعنی سفارشی که امروز وارد صف انبار شده است (زمان فعال‌شدن سفارش زمان‌بندی‌شده
// یا زمان ایجاد سفارش فوری)، در هر وضعیتی که الان باشد؛ حتی اگر آماده‌سازی/تحویل آن تمام شده باشد.
// فقط سفارش‌های لغوشده شمرده نمی‌شوند. مقادیر هر محصول به تفکیک واحد سفارش جمع می‌شود.
const WH_ENTERED_STATUSES = ['WAREHOUSE_PENDING', 'WAREHOUSE_PREPARING', 'SETTLEMENT_PENDING', 'SETTLED', 'EXITED', 'RETURNED_TO_SALES', 'DELIVERED', 'CLOSED', 'OUT_OF_STOCK'];
route('GET', '/api/warehouse/today-stats', { roles: ['admin', 'warehouse'] }, async () => {
  const db = store.get();
  activateDueRemoteOrders();
  const day = today();
  const r3 = (n) => +Number(n || 0).toFixed(3);
  const totals = { orders: 0, items: 0, products: 0, pending: 0, preparing: 0, done: 0, units: {} };
  const byProd = new Map();
  for (const o of db.orders) {
    if (o.status === 'CANCELLED' || !WH_ENTERED_STATUSES.includes(o.status)) continue;
    if (whLocalDay(o.activatedAt || o.createdAt) !== day) continue;
    totals.orders += 1;
    if (o.status === 'WAREHOUSE_PENDING') totals.pending += 1;
    else if (o.status === 'WAREHOUSE_PREPARING') totals.preparing += 1;
    else totals.done += 1;
    const seen = new Set();
    for (const it of db.orderItems) {
      if (it.orderId !== o.id || it.itemStatus === 'CANCELLED') continue;
      totals.items += 1;
      const u = it.requestedUnit || 'کیلوگرم';
      const q = Number(it.requestedQty || 0);
      totals.units[u] = r3((totals.units[u] || 0) + q);
      let b = byProd.get(it.productId);
      if (!b) { const pr = getProduct(it.productId); b = { productId: it.productId, productName: pr?.name || 'کالای حذف‌شده', quickCode: pr?.quickCode || '', orders: 0, lines: 0, units: {} }; byProd.set(it.productId, b); }
      b.lines += 1; b.units[u] = r3((b.units[u] || 0) + q);
      if (!seen.has(it.productId)) { b.orders += 1; seen.add(it.productId); }
    }
  }
  totals.products = byProd.size;
  const kgOf = (b) => Number(b.units['کیلوگرم'] || 0);
  const byProduct = [...byProd.values()].sort((a, b) => kgOf(b) - kgOf(a) || b.orders - a.orders || a.productName.localeCompare(b.productName, 'fa'));
  return { status: 200, body: { date: day, totals, byProduct } };
});
route('GET', '/api/warehouse/history', { roles: ['admin', 'warehouse'] }, async (ctx) => {
  const db = store.get();
  let from = String(ctx.query.get('from') || ''); let to = String(ctx.query.get('to') || '');
  if (!WH_DAY.test(to)) to = today();
  if (!WH_DAY.test(from)) from = to;
  if (from > to) [from, to] = [to, from];
  const q = String(ctx.query.get('q') || '').trim().toLowerCase().slice(0, 80);
  const onlyOos = ctx.query.get('result') === 'oos';
  const onlyType = String(ctx.query.get('orderType') || '').toUpperCase(); // v37.36.0 — سربرگ «سوابق و گزارشات» فروشگاه‌های انبار فقط سفارش‌های فروشگاهی را می‌خواهد
  const SRH = require('../store-runs');
  const userName = (id) => { const u = db.users.find((x) => x.id === id); return u ? (u.fullName || u.username) : ''; };
  const finalizer = new Map();
  for (const e of db.audit) if (e.action === 'WAREHOUSE_FINALIZE' && e.entityId) finalizer.set(e.entityId, e.userId);
  const rows = [];
  for (const o of db.orders) {
    if (!o.warehouseCompletedAt) continue;
    if (onlyType && String(o.orderType || '') !== onlyType) continue;
    const day = whLocalDay(o.warehouseCompletedAt);
    if (day < from || day > to) continue;
    const c = db.customers.find((x) => x.id === o.customerId);
    const items = db.orderItems
      .filter((i) => i.orderId === o.id && ['DELIVERED', 'OUT_OF_STOCK'].includes(i.warehouseStatus || i.itemStatus))
      .map((i) => { const pr = getProduct(i.productId); return {
        productId: i.productId, productName: pr?.name || '—', quickCode: pr?.quickCode || '',
        requestedQty: i.requestedQty, requestedUnit: i.requestedUnit, deliveredKg: Number(i.deliveredKg || 0),
        outOfStock: (i.warehouseStatus || i.itemStatus) === 'OUT_OF_STOCK', description: i.description || '',
        r1Kg: o.orderType === 'STORE' ? SRH.r1Kg(i) : null, r2Kg: o.orderType === 'STORE' ? SRH.r2Kg(i) : null }; });
    const customerName = o.orderType === 'STORE' ? (o.storeName || 'فروشگاه') : (c?.name || o.storeName || '—');
    if (q && ![o.orderNo, customerName, c?.phone, o.dispatchPlace].some((v) => String(v || '').toLowerCase().includes(q))
      && !items.some((i) => `${i.productName} ${i.quickCode}`.toLowerCase().includes(q))) continue;
    const oos = items.filter((i) => i.outOfStock).length;
    if (onlyOos && !oos) continue;
    rows.push({
      id: o.id, orderNo: o.orderNo || '—', orderType: o.orderType || '', status: o.status, day,
      customerName, customerPhone: o.orderType === 'STORE' ? '' : (c?.phone || ''), dispatchPlace: o.dispatchPlace || '',
      createdAt: o.createdAt, acceptedAt: o.warehouseAcceptedAt || null, completedAt: o.warehouseCompletedAt,
      completedBy: userName(o.warehouseCompletedBy || finalizer.get(o.id)) || '—',
      printRuns: o.orderType === 'STORE' ? [1,2].filter(run => require('../store-run-print').serviceDocument(db,o,run,getProduct)) : [],
      items, itemCount: items.length, outOfStock: oos,
      deliveredKg: +items.reduce((s, i) => s + i.deliveredKg, 0).toFixed(3),
    });
  }
  rows.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
  const itemCount = rows.reduce((s, r) => s + r.itemCount, 0);
  const outOfStock = rows.reduce((s, r) => s + r.outOfStock, 0);
  const deliveredKg = +rows.reduce((s, r) => s + r.deliveredKg, 0).toFixed(3);
  const prod = new Map();
  for (const r of rows) for (const i of r.items) {
    const k = i.productId || i.productName;
    const x = prod.get(k) || { productName: i.productName, quickCode: i.quickCode, orders: 0, deliveredKg: 0, outOfStock: 0 };
    x.orders += 1; x.deliveredKg = +(x.deliveredKg + i.deliveredKg).toFixed(3); if (i.outOfStock) x.outOfStock += 1;
    prod.set(k, x);
  }
  const byProduct = [...prod.values()].sort((a, b) => b.deliveredKg - a.deliveredKg);
  // ارجاع‌های انبار به فروش در همین بازه (از تاریخچهٔ ممیزی؛ فقط اقدام کاربران انبار)
  const whUsers = new Set(db.users.filter((u) => normalizeRole(u.roleCode) === 'warehouse').map((u) => u.id));
  const returns = db.audit.filter((e) => e.action === 'RETURN_TO_SALES' && whUsers.has(e.userId))
    .filter((e) => { const d = whLocalDay(e.createdAt); return d >= from && d <= to; })
    .filter((e) => { if (!onlyType) return true; const o = db.orders.find((x) => x.id === e.entityId); return !!o && String(o.orderType || '') === onlyType; })
    .map((e) => { const o = db.orders.find((x) => x.id === e.entityId); const c = o && db.customers.find((x) => x.id === o.customerId);
      return { orderId: e.entityId, orderNo: o?.orderNo || '—', customerName: o?.orderType === 'STORE' ? (o.storeName || 'فروشگاه') : (c?.name || o?.storeName || '—'),
        reason: e.details?.reason || '', at: e.createdAt, by: userName(e.userId) || e.username || '—' }; })
    .reverse();
  return {
    status: 200,
    body: {
      from, to, rows, returns,
      summary: { orders: rows.length, itemCount, outOfStock, deliveredKg, returned: returns.length, byProduct },
    },
  };
});

route('POST', '/api/orders/:id/return-sales', { roles: ['warehouse', 'sales'] }, async (ctx) => {
  const db = store.get();
  const order = findOrder(ctx.params.id);
  if (!['WAREHOUSE_PENDING', 'WAREHOUSE_PREPARING', 'RETURNED_TO_SALES'].includes(order.status)) fail(409, 'این سفارش در وضعیت قابل ارجاع به فروش نیست.');
  const reason = validate.text(ctx.body.reason || 'نیاز به اصلاح', { field: 'دلیل ارجاع', max: 300 });
  order.status = 'RETURNED_TO_SALES'; order.updatedAt = store.nowIso();
  // v37.35.0 — ارجاع به فروش یعنی کار انبار دوباره باز شده است؛ نشان «پایان کار انبار» پاک
  // می‌شود تا سفارش پس از ارسال مجدد بتواند به فهرست آماده‌سازی برگردد (سوابق وزنی حفظ می‌شود).
  if (order.storeRunOps?.finalizedAt) order.storeRunOps = { ...order.storeRunOps, finalizedAt: null, finalizedBy: null, finalizedByName: null };
  const itemId = ctx.body.itemId ? String(ctx.body.itemId) : null;
  if (itemId) {
    const item = db.orderItems.find((i) => i.id === itemId && i.orderId === order.id);
    if (item) Object.assign(item, { itemStatus: 'RETURNED_TO_SALES', returnReason: reason });
  } else {
    db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i)).forEach((i) => Object.assign(i, { itemStatus: 'RETURNED_TO_SALES', returnReason: reason }));
  }
  createNotification('sales', 'RETURN_FROM_WAREHOUSE', 'order', order.id, `سفارش ${order.orderNo || '—'} برای اصلاح به فروش برگشت خورد.`);
  store.audit(ctx.user, 'RETURN_TO_SALES', 'order', order.id, { itemId, reason }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

// ---------- اصلاح سفارش برگشتی (فروش) ----------
route('PUT', '/api/orders/:id/returned-edit', { roles: ['sales'] }, async (ctx) => {
  const db = store.get();
  const order = findOrder(ctx.params.id);
  if (order.status !== 'RETURNED_TO_SALES') fail(409, 'اصلاح یکجای سفارش فقط برای سفارش برگشتی به فروش مجاز است.');
  const incoming = Array.isArray(ctx.body.items) ? ctx.body.items : [];
  if (!incoming.length) fail(400, 'حداقل یک قلم فعال باید در سفارش باقی بماند.');
  if (incoming.length > 100) fail(400, 'تعداد اقلام بیش از حد مجاز است.');
  const activeExisting = db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i));
  const existingById = new Map(activeExisting.map((i) => [i.id, i]));
  const isStoreRun = order.orderType === 'STORE'; // v37.4.0 — قانون ۱۱ سند فروشگاه
  const seen = new Set();
  const normalized = incoming.map((x) => {
    if (x?.id && (!existingById.has(String(x.id)) || seen.has(String(x.id)))) fail(400, 'یکی از اقلام سفارش معتبر نیست.');
    if (isStoreRun && !x?.id) fail(409, 'افزودن محصول جدید پس از ارسال سفارش فروشگاه به انبار مجاز نیست؛ برای محصول جدید سفارش جداگانه ثبت کنید.');
    if (x?.id) seen.add(String(x.id));
    const l = normalizeLine(x);
    return { id: x?.id ? String(x.id) : null, ...l };
  });
  const deleted = activeExisting.filter((i) => !seen.has(i.id));
  if (isStoreRun) for (const item of deleted) {
    if (require('../store-runs').hasRunActivity(item)) fail(409, 'این قلم دارای سوابق ارسال در سرویس‌هاست و قابل حذف نیست.');
  }
  for (const item of deleted) {
    const before = { productId: item.productId, requestedQty: item.requestedQty, requestedUnit: item.requestedUnit, description: item.description || '', itemStatus: item.itemStatus };
    Object.assign(item, { itemStatus: 'CANCELLED', deletedAt: store.nowIso(), deletedBy: ctx.user.id, returnReason: 'حذف توسط فروش هنگام اصلاح سفارش', deliveredKg: null, unitPrice: null, finalAmount: 0 });
    store.audit(ctx.user, 'DELETE_ORDER_ITEM', 'order_item', item.id, { orderId: order.id, before }, ctx);
  }
  for (const x of normalized) {
    if (x.id) {
      const item = existingById.get(x.id);
      const before = { productId: item.productId, requestedQty: item.requestedQty, requestedUnit: item.requestedUnit, description: item.description || '' };
      const changed = before.productId !== x.productId || Number(before.requestedQty) !== x.requestedQty || before.requestedUnit !== x.requestedUnit || before.description !== x.description;
      if (isStoreRun) Object.assign(item, { productId: x.productId, requestedQty: x.requestedQty, requestedUnit: x.requestedUnit, description: x.description, itemStatus: 'PENDING', returnReason: changed ? 'ویرایش شد' : item.returnReason }); // سوابق سرویس‌ها حفظ می‌شود
      else Object.assign(item, { productId: x.productId, requestedQty: x.requestedQty, requestedUnit: x.requestedUnit, description: x.description, deliveredKg: null, unitPrice: null, finalAmount: null, itemStatus: 'PENDING', returnReason: changed ? 'ویرایش شد' : item.returnReason });
      if (changed) store.audit(ctx.user, 'UPDATE_ORDER_ITEM', 'order_item', item.id, { orderId: order.id, before, after: { productId: x.productId, requestedQty: x.requestedQty, requestedUnit: x.requestedUnit, description: x.description } }, ctx);
    } else {
      const item = newItem(order.id, x);
      db.orderItems.push(item);
      store.audit(ctx.user, 'ADD_ORDER_ITEM', 'order_item', item.id, { orderId: order.id, productId: x.productId, requestedQty: x.requestedQty, requestedUnit: x.requestedUnit }, ctx);
    }
  }
  order.updatedAt = store.nowIso();
  store.audit(ctx.user, 'SAVE_RETURNED_ORDER_EDIT', 'order', order.id, { activeItems: normalized.length, deletedItems: deleted.length }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

route('POST', '/api/orders/:id/items', { roles: ['sales'] }, async (ctx) => {
  const order = findOrder(ctx.params.id);
  if (order.status !== 'RETURNED_TO_SALES') fail(409, 'افزودن قلم فقط برای سفارش برگشتی به فروش مجاز است.');
  if (order.orderType === 'STORE') fail(409, 'افزودن محصول جدید پس از ارسال سفارش فروشگاه به انبار مجاز نیست؛ برای محصول جدید سفارش جداگانه ثبت کنید.'); // v37.4.0 — قانون ۱۱
  const l = normalizeLine(ctx.body);
  const item = newItem(order.id, l);
  store.get().orderItems.push(item);
  order.updatedAt = store.nowIso();
  store.audit(ctx.user, 'ADD_ORDER_ITEM', 'order_item', item.id, { orderId: order.id, productId: l.productId, requestedQty: l.requestedQty, requestedUnit: l.requestedUnit }, ctx);
  store.save();
  return { status: 201, body: { item: { ...item, product: l.product }, order: enrichOrder(order) } };
});

route('PUT', '/api/orders/:id/items/:itemId', { roles: ['sales'] }, async (ctx) => {
  const order = findOrder(ctx.params.id);
  if (order.status !== 'RETURNED_TO_SALES') fail(409, 'ویرایش قلم فقط برای سفارش برگشتی به فروش مجاز است.');
  const item = store.get().orderItems.find((i) => i.id === ctx.params.itemId && i.orderId === order.id);
  if (!item || !ACTIVE(item)) fail(404, 'قلم سفارش یافت نشد.');
  const b = ctx.body;
  const l = normalizeLine({ productId: b.productId ?? item.productId, requestedQty: b.requestedQty ?? item.requestedQty, requestedUnit: b.requestedUnit ?? item.requestedUnit, description: b.description ?? item.description });
  const before = { productId: item.productId, requestedQty: item.requestedQty, requestedUnit: item.requestedUnit, description: item.description || '' };
  if (order.orderType === 'STORE') Object.assign(item, { productId: l.productId, requestedQty: l.requestedQty, requestedUnit: l.requestedUnit, description: l.description, itemStatus: 'PENDING', returnReason: 'ویرایش شد' }); // v37.4.0 — سوابق سرویس‌ها حفظ می‌شود
  else Object.assign(item, { productId: l.productId, requestedQty: l.requestedQty, requestedUnit: l.requestedUnit, description: l.description, deliveredKg: null, unitPrice: null, finalAmount: null, itemStatus: 'PENDING', returnReason: 'ویرایش شد' });
  order.updatedAt = store.nowIso();
  store.audit(ctx.user, 'UPDATE_ORDER_ITEM', 'order_item', item.id, { orderId: order.id, before, after: { productId: l.productId, quickCode: l.product.quickCode, requestedQty: l.requestedQty, requestedUnit: l.requestedUnit, description: l.description } }, ctx);
  store.save();
  return { status: 200, body: { item: { ...item, product: l.product }, order: enrichOrder(order) } };
});

route('DELETE', '/api/orders/:id/items/:itemId', { roles: ['sales'] }, async (ctx) => {
  const db = store.get();
  const order = findOrder(ctx.params.id);
  if (order.status !== 'RETURNED_TO_SALES') fail(409, 'حذف قلم فقط برای سفارش برگشتی به فروش مجاز است.');
  const item = db.orderItems.find((i) => i.id === ctx.params.itemId && i.orderId === order.id && ACTIVE(i));
  if (!item) fail(404, 'قلم سفارش یافت نشد.');
  if (db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i)).length <= 1) fail(400, 'حداقل یک قلم فعال باید در سفارش باقی بماند.');
  if (order.orderType === 'STORE' && require('../store-runs').hasRunActivity(item)) fail(409, 'این قلم دارای سوابق ارسال در سرویس‌هاست و قابل حذف نیست.'); // v37.4.0 — قانون ۹
  const before = { productId: item.productId, requestedQty: item.requestedQty, requestedUnit: item.requestedUnit, itemStatus: item.itemStatus };
  Object.assign(item, { itemStatus: 'CANCELLED', deletedAt: store.nowIso(), deletedBy: ctx.user.id, returnReason: 'حذف توسط فروش هنگام اصلاح سفارش', deliveredKg: null, unitPrice: null, finalAmount: 0 });
  order.updatedAt = store.nowIso();
  store.audit(ctx.user, 'DELETE_ORDER_ITEM', 'order_item', item.id, { orderId: order.id, before }, ctx);
  store.save();
  return { status: 200, body: { ok: true, order: enrichOrder(order) } };
});

route('POST', '/api/orders/:id/resubmit-sales', { roles: ['sales'], idempotent: true }, async (ctx) => {
  const db = store.get();
  const order = findOrder(ctx.params.id);
  if (order.status !== 'RETURNED_TO_SALES') fail(409, 'این سفارش در وضعیت ارسال مجدد به انبار نیست.');
  const active = db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i));
  if (!active.length) fail(400, 'حداقل یک قلم فعال برای ارسال به انبار لازم است.');
  active.forEach((i) => Object.assign(i, order.orderType === 'STORE'
    ? { itemStatus: 'PENDING', returnReason: '' } // v37.4.0 — سناریوی ششم سند: وزن‌های سرویس اول بعد از ارجاع حفظ می‌شوند
    : { itemStatus: 'PENDING', returnReason: '', deliveredKg: null }));
  Object.assign(order, { status: 'WAREHOUSE_PENDING', updatedAt: store.nowIso() });
  createNotification('warehouse', 'NEW_ORDER', 'order', order.id, `سفارش برگشتی ${order.orderNo || '—'} پس از بررسی فروش دوباره به انبار ارسال شد.`);
  store.audit(ctx.user, 'RESUBMIT_TO_WAREHOUSE', 'order', order.id, {}, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

// ---------- تسویه ----------
route('POST', '/api/orders/:id/settle', { roles: ['sales'], idempotent: true }, async (ctx) => {
  const db = store.get();
  const order = findOrder(ctx.params.id);
  // v37.17.0 — سفارش فروشگاهی که وارد چرخهٔ سرویس‌ها شده، تسویهٔ یکجای کل سفارش ندارد؛
  // سند هر سرویس فقط از نهایی‌کردن تحویل همان سرویس صادر می‌شود تا اقلام دو سرویس هرگز در یک فاکتور جمع نشوند.
  if (order.orderType === 'STORE') {
    const SR = require('../store-runs');
    const hasRunFlow = !!(SR.runShipmentOf(order, 1) || SR.runShipmentOf(order, 2))
      || db.payments.some((pay) => pay.orderId === order.id && (pay.deliveryRun || null) !== null);
    if (hasRunFlow) fail(409, 'فاکتور سفارش فروشگاه برای هر سرویس جداگانه صادر می‌شود؛ تسویهٔ یکجای همهٔ اقلام ممکن نیست. تحویل هر سرویس را جداگانه نهایی کنید.');
  }
  if (order.status !== 'SETTLEMENT_PENDING') fail(409, 'این سفارش هنوز آماده تسویه نیست.');
  if (order.dispatch) fail(409, 'این سفارش به پخش واگذار شده است؛ تسویهٔ آن در فرم تحویل راننده ثبت می‌شود.');
  const b = ctx.body;
  const signatureData = validate.signature(b.signatureData);
  const fingerprintRef = validate.text(b.fingerprintRef, { field: 'شناسه اثرانگشت', max: 250 });
  const noFingerprintAllowed = !!b.noFingerprintAllowed;
  if (!fingerprintRef && !noFingerprintAllowed) fail(400, 'احراز اثرانگشت الزامی است مگر اینکه گزینه «بدون اثر انگشت مجاز است» فعال باشد.');

  // اعتبارسنجی کامل قبل از هر تغییر (اتمیک)
  const active = db.orderItems.filter((i) => i.orderId === order.id && ACTIVE(i));
  const incoming = new Map((Array.isArray(b.items) ? b.items : []).map((x) => [String(x?.itemId), x]));
  const plan = [];
  for (const item of db.orderItems.filter((i) => i.orderId === order.id)) {
    const x = incoming.get(item.id);
    if (!ACTIVE(item)) { plan.push({ item, cancelled: true }); continue; }
    if (!x) fail(400, 'قیمت همه اقلام سفارش باید ثبت شود.');
    if (x.cancelled) { plan.push({ item, cancelled: true }); continue; }
    const unitPrice = validate.number(x.unitPrice, { field: 'قیمت واحد', min: 0, max: validate.MAX_MONEY });
    const delivered = Number(item.deliveredKg || 0);
    if (delivered > 0 && unitPrice <= 0) fail(400, `قیمت واحد قلم «${getProduct(item.productId)?.name || ''}» باید بیشتر از صفر باشد.`);
    plan.push({ item, unitPrice, amount: Math.round(delivered * unitPrice) });
  }
  const subtotal = plan.reduce((s, p) => s + (p.amount || 0), 0);
  const amounts = validate.settlementAmounts(subtotal,b);
  const total = amounts.totalAmount;
  if (total <= 0) fail(400, 'مبلغ فاکتور صفر است؛ حداقل یک قلم تحویلی با قیمت لازم است.');
  // سازگاری با کلاینت‌های نسخهٔ قبلی؛ رابط جدید همیشه آرایهٔ روش‌ها را ارسال می‌کند.
  const settlementMethods = Array.isArray(b.settlementMethods) ? require('../settlement-methods').cleanRows(b.settlementMethods, total, db) : [{ type: 'CASH', amount: total, note: 'ثبت از کلاینت قدیمی' }];
  if (total > validate.MAX_MONEY) fail(400, 'مبلغ فاکتور بیش از حد مجاز است.');

  for (const p of plan) {
    if (p.cancelled) Object.assign(p.item, { itemStatus: 'CANCELLED', finalAmount: 0, unitPrice: 0 });
    else Object.assign(p.item, { unitPrice: p.unitPrice, finalAmount: p.amount });
  }
  const verificationMode = fingerprintRef ? 'FINGERPRINT' : 'MANUAL_NO_FINGERPRINT';
  const invoiceNumber = store.nextInvoiceNumber();
  const payment = {
    id: store.uid(), orderId: order.id, customerId: order.customerId || null, invoiceNumber, ...amounts, grossAmount: total, totalAmount: total,
    signatureData, fingerprintRef, noFingerprintAllowed, verificationMode, settlementMethods, verifiedAt: store.nowIso(), settledBy: ctx.user.id,
  };
  db.payments.push(payment);
  if (order.dispatch) require('../dispatch').applyReturnToInvoice(order);
  Object.assign(order, { status: 'SETTLED', updatedAt: store.nowIso() });
  createNotification('gate', 'SETTLEMENT_DONE', 'order', order.id, `فاکتور ${invoiceNumber} تسویه شد؛ کنترل خروج انجام شود.`);
  store.audit(ctx.user, 'FINAL_SETTLEMENT', 'order', order.id, { total, ...amounts, invoiceNumber, verificationMode, noFingerprintAllowed, fingerprint: !!fingerprintRef, settlementMethods }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});

// ---------- خروج نگهبان ----------
route('POST', '/api/orders/:id/exit', { roles: ['gate'], idempotent: true }, async (ctx) => {
  const db = store.get();
  const order = findOrder(ctx.params.id);
  if (order.dispatch) fail(409, 'این سفارش از مسیر «خروج ارسالی» پخش خارج می‌شود.');
  if (order.status !== 'SETTLED') fail(409, 'این سفارش هنوز تایید تسویه نشده است.');
  const checked = Array.isArray(ctx.body.checkedItems) ? ctx.body.checkedItems.map((x) => String(x).slice(0, 80)).slice(0, 200) : [];
  order.status = 'EXITED'; order.exitedAt = store.nowIso(); order.updatedAt = store.nowIso();
  const visit = db.visits.find((v) => v.id === order.visitId);
  if (visit) visit.status = 'EXITED';
  store.audit(ctx.user, 'FINAL_EXIT', 'order', order.id, { checkedItems: checked }, ctx);
  store.save();
  return { status: 200, body: { order: enrichOrder(order) } };
});
