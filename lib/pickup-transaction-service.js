'use strict';
// Internal building blocks only: not registered as HTTP routes. They must not be
// exposed before parallel warehouse/sales/exit routes are protected and the UI
// and physical handover/document workflow are complete.
const store = require('./store');
const workflow = require('./pickup-workflow');
const transaction = require('./transport-transaction');
const { today, createNotification } = require('./domain');
const { fail } = require('./http');

function current(id) {
  const order = store.get().orders.find(o => o.id === id);
  if (!order) fail(404, 'سفارش یافت نشد.');
  return order;
}
function visitOf(order) { return store.get().visits.find(v => v.id === order.visitId); }
function itemsOf(order) { return store.get().orderItems.filter(i => i.orderId === order.id); }
function openVisit(order) { return store.get().visits.find(v => v.orderId === order.id && v.status === 'PICKUP_PRESENT'); }
function update(order, next) { Object.assign(order, next, {updatedAt:store.nowIso()}); }
function audit(ctx, action, order, details) { store.audit(ctx.user, action, 'order', order.id, details, ctx); }

function changeDate(id, value, ctx) {
 return transaction(() => {
  const order=current(id), before=order.deliveryDate || null;
  const next=workflow.changeDeliveryDate(order,value,ctx.user,today(),openVisit(order));
  update(order,next);audit(ctx,'PICKUP_DELIVERY_DATE_CHANGED',order,{before,after:next.deliveryDate});
  return {id:order.id,deliveryDate:order.deliveryDate};
 });
}
function entry(id, body, ctx) {
 return transaction(() => {
  const order=current(id), now=store.nowIso();
  const next=workflow.createEntry(order,body,ctx.user,today(),now,store.uid(),openVisit(order));
  update(order,next.order);store.get().visits.push(next.visit);
  createNotification('warehouse','PICKUP_ENTRY','order',order.id,`تحویل‌گیرنده سفارش ${order.orderNo || '—'} وارد شد.`);
  audit(ctx,'PICKUP_ENTRY',order,{visitId:next.visit.id,recipient:next.visit.recipient});
  return {orderId:order.id,visit:next.visit};
 });
}
function requestCancellation(id, body, ctx) {
 return transaction(() => {
  const order=current(id),visit=visitOf(order),now=store.nowIso();
  const next=workflow.requestCancellation(order,visit,ctx.user,now,body?.reason,body?.confirmedNoGoods,itemsOf(order));
  update(order,next);
  createNotification('sales','PICKUP_CANCELLATION_REQUESTED','order',order.id,`انبار انصراف سفارش ${order.orderNo || '—'} را برای بررسی ثبت کرد.`);
  audit(ctx,'PICKUP_CANCELLATION_REQUESTED',order,{visitId:visit.id,reason:next.pickupCancellation.reason});
  return {orderId:order.id,cancellation:next.pickupCancellation};
 });
}
function approveCancellation(id, ctx) {
 return transaction(() => {
  const order=current(id),visit=visitOf(order),now=store.nowIso();
  const next=workflow.approveCancellation(order,visit,ctx.user,now,itemsOf(order));
  update(order,next);
  createNotification('gate','PICKUP_CANCELLATION_APPROVED','order',order.id,`انصراف سفارش ${order.orderNo || '—'} تأیید شد؛ کنترل خروج انجام شود.`);
  audit(ctx,'PICKUP_CANCELLATION_APPROVED',order,{visitId:visit.id,depositStatus:next.deposit?.status || null});
  return {orderId:order.id,cancellation:next.pickupCancellation};
 });
}
function cancellationExit(id, ctx) {
 return transaction(() => {
  const order=current(id),visit=visitOf(order),now=store.nowIso();
  const next=workflow.cancellationExit(order,visit,ctx.user,now);
  update(order,next.order);Object.assign(visit,next.visit);
  audit(ctx,'PICKUP_CANCELLATION_EXIT',order,{visitId:visit.id});
  return {orderId:order.id,visitId:visit.id};
 });
}
module.exports={changeDate,entry,requestCancellation,approveCancellation,cancellationExit};
