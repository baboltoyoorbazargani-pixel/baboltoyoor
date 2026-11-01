'use strict';
// A separate, persistent series for ordinary warehouse documents. Numbers are
// tied to orders, including after reopening; existing audit entries are immutable.
const LIMIT = 999999;
const parse = value => {
  const match = /^W-(\d{6})$/.exec(String(value || ''));
  return match && Number(match[1]) > 0 ? Number(match[1]) : 0;
};
const label = n => `W-${String(n).padStart(6,'0')}`;
function highWater(data) {
  const value = data.counters?.warehouseDocumentNumber;
  const high = value == null ? 0 : Number(value);
  if (!Number.isSafeInteger(high) || high < 0 || high > LIMIT) throw new Error('شمارنده شماره سند انبار نامعتبر است.');
  const used = new Set(); let max = high;
  for (const o of data.orders || []) {
    if (o.warehouseDocumentNo == null || o.warehouseDocumentNo === '') continue;
    const n = parse(o.warehouseDocumentNo);
    if (!n || used.has(n)) throw new Error('شماره سند انبار نامعتبر یا تکراری است؛ داده‌ها را بدون بازنویسی بررسی کنید.');
    used.add(n); max = Math.max(max,n);
  }
  return max;
}
function ensureWarehouseDocumentNumbers(data) {
  const high = highWater(data), completed = new Map();
  for (const e of data.audit || []) if (e.action === 'WAREHOUSE_FINALIZE' && e.entityId && !completed.has(e.entityId)) completed.set(e.entityId,e.createdAt || '');
  const pending = (data.orders || []).filter(o => o.orderType !== 'STORE' && !o.warehouseDocumentNo && (o.warehouseCompletedAt || completed.has(o.id)))
    .sort((a,b) => String(completed.get(a.id) || a.warehouseCompletedAt || '').localeCompare(String(completed.get(b.id) || b.warehouseCompletedAt || '')) || String(a.id).localeCompare(String(b.id)));
  if (high + pending.length > LIMIT) throw new Error('ظرفیت شماره سند انبار تمام شده است.');
  let next=high;
  const changed=!!pending.length || (high > 0 && Number(data.counters?.warehouseDocumentNumber) !== high);
  // The startup/restore path applies this to a detached snapshot and saves it
  // in one SQLite transaction; never edit audit entries or existing numbers.
  for (const o of pending) o.warehouseDocumentNo=label(++next);
  if (changed) { data.counters ||= {}; data.counters.warehouseDocumentNumber=next; }
  return changed;
}
function assignWarehouseDocumentNumber(data, order) {
  const high=highWater(data);
  if (order.warehouseDocumentNo) return order.warehouseDocumentNo;
  if (high >= LIMIT) throw new Error('ظرفیت شماره سند انبار تمام شده است.');
  data.counters ||= {};
  // Persist the counter before the order. An interrupted write can leave a gap,
  // never a second document with the same allocated number.
  data.counters.warehouseDocumentNumber=high+1;
  order.warehouseDocumentNo=label(high+1);
  return order.warehouseDocumentNo;
}
module.exports={ensureWarehouseDocumentNumbers,assignWarehouseDocumentNumber,LIMIT};
