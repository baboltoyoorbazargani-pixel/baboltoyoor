'use strict';
// توابع مشترک دامنه بین مسیرها
const store = require('./store');

const SYSTEM_USER = { id: null, username: 'SYSTEM' };

function pad(n) { return String(n).padStart(2, '0'); }
function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function localDayOf(value) { if (!value) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value); const d = new Date(value); return Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : ''; }
function nowLocalMinute() { const d = new Date(); return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function publicUser(user) {
  const { passwordHash, ...rest } = user; // eslint-disable-line no-unused-vars
  return rest;
}

function getProduct(id) { return store.get().products.find((p) => p.id === id); }

function enrichOrder(o, legacyReturns) {
  const db = store.get();
  const visit = db.visits.find((v) => v.id === o.visitId);
  const customerId = o.customerId || visit?.customerId;
  const customer = customerId ? db.customers.find((c) => c.id === customerId) : undefined;
  const items = db.orderItems.filter((i) => i.orderId === o.id).map((i) => ({ ...i, product: getProduct(i.productId) }));
  const payments = db.payments.filter((p) => p.orderId === o.id);
  const payment = payments[0]; // سازگاری با مصرف‌کنندگان قدیمی
  const strip = (d) => (d ? (({ signatureData, ...rest }) => ({ ...rest, hasSignature: !!signatureData }))(d) : d);
  const dispatch = strip(o.dispatch);
  const dispatchRuns = Array.isArray(o.dispatches) ? o.dispatches.map(strip) : []; // v37.5.0 — خدمه‌برهای نهایی‌شدهٔ سرویس‌ها
  // Older returned orders stored the message in item rows and in the audit trail.
  // Item edits can replace the original text, so prefer the latest recorded return.
  let warehouseReturn = o.warehouseReturn || null;
  if (o.status === 'RETURNED_TO_SALES' && !warehouseReturn) {
    const entry = legacyReturns instanceof Map ? legacyReturns.get(o.id) : [...db.audit].reverse().find(e => e.action === 'RETURN_TO_SALES' && e.entityType === 'order' && e.entityId === o.id && e.details?.reason);
    const item = items.find(i => i.itemStatus === 'RETURNED_TO_SALES' && i.returnReason);
    if (entry) warehouseReturn = { reason: entry.details.reason, at: entry.createdAt, itemId: entry.details.itemId || null };
    else if (item) warehouseReturn = { reason: item.returnReason, at: null, itemId: item.id };
  }
  const enriched = { ...o, warehouseReturn, visit, customer, items, payment, payments, dispatch, dispatchRuns };
  if (o.orderType === 'STORE') enriched.storeRun = require('./store-runs').buildStoreRunView(o, items); // v37.4.0
  return enriched;
}

function createNotification(targetRole, type, entityType, entityId, message) {
  const db = store.get();
  db.notifications.unshift({ id: store.uid(), targetRole, type, entityType, entityId, message, isRead: false, createdAt: store.nowIso() });
  if (db.notifications.length > 2000) db.notifications.length = 2000;
}

// سفارش‌های آینده (غیرحضوری/فروشگاه) وقتی به زمان برسند وارد صف انبار می‌شوند
function activateDueRemoteOrders() {
  const db = store.get();
  const now = nowLocalMinute();
  let changed = false;
  for (const order of db.orders) {
    if ((order.orderType === 'REMOTE' || order.orderType === 'STORE') && order.status === 'SCHEDULED_REMOTE'
      && String(order.scheduledAt || `${order.scheduledDate || ''}T23:59`) <= now) {
      order.status = 'WAREHOUSE_PENDING';
      order.activatedAt = store.nowIso();
      order.updatedAt = store.nowIso();
      createNotification('warehouse', order.orderType === 'STORE' ? 'STORE_ORDER_DUE' : 'REMOTE_ORDER_DUE', 'order', order.id,
        `سفارش ${order.orderType === 'STORE' ? 'فروشگاه' : 'غیرحضوری'} ${order.orderNo || order.id.slice(0, 8)} برای زمان مقرر آماده تحویل انبار شد.`);
      store.audit(SYSTEM_USER, 'ACTIVATE_REMOTE_ORDER', 'order', order.id, { scheduledDate: order.scheduledDate });
      changed = true;
    }
  }
  if (changed) store.save();
  return changed;
}

function normalizePlate(value = '') {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g, '').replace(/[—–]/g, '-').toLowerCase();
}

module.exports = { SYSTEM_USER, today, localDayOf, nowLocalMinute, publicUser, getProduct, enrichOrder, createNotification, activateDueRemoteOrders, normalizePlate };
