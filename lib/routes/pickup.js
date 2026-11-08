'use strict';
// Staged, off by default: do not enable in a deployment until the UI, printed
// documents, notification navigation and full end-to-end checks are complete.
const {route,fail}=require('../http');
const store=require('../store');
const {normalizePlate}=require('../domain');
const service=require('../pickup-transaction-service');
function staged(){if(process.env.BT_PICKUP_STAGING!=='true')fail(404,'مسیر API پیدا نشد.');}
// Service responses for gate and warehouse contain identifiers, visits and
// immutable documents only, never the raw order with its financial fields.
route('GET','/api/pickup/orders',{roles:['gate']},ctx=>{
 staged();const q=normalizePlate(String(ctx.query.get('q')||'').trim().slice(0,80));
 if(q.length<2)return {body:{orders:[]}};
 const db=store.get(),open=new Set(['SCHEDULED_REMOTE','WAREHOUSE_PENDING','WAREHOUSE_PREPARING','RETURNED_TO_SALES','SETTLEMENT_PENDING','SETTLED']);
 const rows=db.orders.filter(o=>o.orderType==='REMOTE'&&o.deliveryMode==='PICKUP'&&!o.dispatch&&open.has(o.status)&&!o.pickupCancellation&&!o.pickupHandover).map(o=>{
  const c=db.customers.find(x=>x.id===o.customerId),visit=db.visits.find(v=>v.orderId===o.id&&v.status==='PICKUP_PRESENT');
  return {id:o.id,orderNo:o.orderNo,customerName:c?.name||'',customerPhone:c?.phone||'',deliveryDate:o.deliveryDate||null,status:o.status,hasOpenVisit:!!visit};
 }).filter(o=>[o.orderNo,o.customerName,o.customerPhone].some(v=>normalizePlate(String(v||'')).includes(q))).slice(-20).reverse();
 return {body:{orders:rows}};
});
route('PUT','/api/pickup/:id/delivery-date',{roles:['sales']},ctx=>{staged();return {body:{order:service.changeDate(ctx.params.id,ctx.body.deliveryDate,ctx)}};});
route('POST','/api/pickup/:id/entry',{roles:['gate'],idempotent:true},ctx=>{staged();return {status:201,body:service.entry(ctx.params.id,ctx.body,ctx)};});
route('POST','/api/pickup/:id/cancellation',{roles:['warehouse'],idempotent:true},ctx=>{staged();return {body:service.requestCancellation(ctx.params.id,ctx.body,ctx)};});
route('POST','/api/pickup/:id/cancellation-approval',{roles:['sales'],idempotent:true},ctx=>{staged();return {body:service.approveCancellation(ctx.params.id,ctx)};});
route('POST','/api/pickup/:id/cancellation-exit',{roles:['gate'],idempotent:true},ctx=>{staged();return {body:service.cancellationExit(ctx.params.id,ctx)};});
route('POST','/api/pickup/:id/handover',{roles:['warehouse'],idempotent:true},ctx=>{staged();return {body:service.finalizeHandover(ctx.params.id,ctx.body,ctx)};});
route('POST','/api/pickup/:id/goods-exit',{roles:['gate'],idempotent:true},ctx=>{staged();return {body:service.goodsExit(ctx.params.id,ctx.body,ctx)};});
