'use strict';
// Sales-only read model over persisted orders, invoices and existing audit trail.
const {route,fail}=require('../http');
const store=require('../store');
const {today,activateDueRemoteOrders}=require('../domain');
const SALES={roles:['admin','sales']};
const dayOf=value=>{const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
function indexes(db){
 const customers=new Map(db.customers.map(c=>[c.id,c])), visits=new Map(db.visits.map(v=>[v.id,v])), payments=new Map();
 for(const p of db.payments){if(!payments.has(p.orderId))payments.set(p.orderId,[]);payments.get(p.orderId).push(p);}
 return {customers,visits,payments};
}
function summary(idx,o){
 const customer=idx.customers.get(o.customerId||idx.visits.get(o.visitId)?.customerId), payments=idx.payments.get(o.id)||[];
 return {id:o.id,orderNo:o.orderNo,orderType:o.orderType,status:o.status,createdAt:o.createdAt,updatedAt:o.updatedAt,customerName:(o.orderType==='STORE'?require('../store-name').storeDisplayName(o.storeName,o.branchNo):customer?.name||o.storeName)||'—',phone:customer?.phone||'',invoiceCount:payments.length,invoices:payments.map(p=>({number:p.invoiceNumber,total:Number(p.totalAmount||0),verifiedAt:p.verifiedAt||p.createdAt,run:p.deliveryRun||null}))};
}
route('GET','/api/sales/overview',SALES,async()=>{
 activateDueRemoteOrders();const db=store.get();const day=today(),idx=indexes(db),validOrders=new Set(db.orders.filter(o=>o.status!=='CANCELLED').map(o=>o.id)),orders=db.orders.filter(o=>dayOf(o.createdAt)===day),payments=db.payments.filter(p=>dayOf(p.verifiedAt||p.createdAt)===day&&validOrders.has(p.orderId));
 return {status:200,body:{day,updatedAt:store.nowIso(),ordersToday:orders.length,cancelledToday:orders.filter(o=>o.status==='CANCELLED').length,invoicesToday:payments.length,salesTotal:payments.reduce((a,p)=>a+(Number(p.totalAmount)||0),0),pendingSettlement:db.orders.filter(o=>o.status==='SETTLEMENT_PENDING'&&!o.dispatch).length,returned:db.orders.filter(o=>o.status==='RETURNED_TO_SALES').length,recent:db.orders.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,8).map(o=>summary(idx,o))}};
});
route('GET','/api/sales/daily-products',SALES,async()=>{
 const db=store.get();return {status:200,body:require('../sales-daily-stats').salesDailyStats(db,today(),dayOf)};
});
route('GET','/api/sales/history',SALES,async ctx=>{
 const db=store.get(),idx=indexes(db),q=String(ctx.query.get('q')||'').trim().toLowerCase().slice(0,80);
 const {queryOrders,pagination}=require('../order-search'),{limit,offset}=pagination(ctx.query,100,25);
 const page=queryOrders({q,limit,offset,history:true});
 return {status:200,body:{total:page.total,offset,limit,orders:page.orders.map(o=>summary(idx,o))}};
});
route('GET','/api/sales/history/:id',SALES,async ctx=>{
 const db=store.get(),order=db.orders.find(o=>o.id===ctx.params.id);if(!order)fail(404,'سفارش یافت نشد.');
 const events=db.audit.filter(e=>(e.entityType==='order'&&e.entityId===order.id)||(e.entityType==='order_item'&&e.details?.orderId===order.id)).map(e=>({seq:e.seq,action:e.action,username:e.username,createdAt:e.createdAt,details:Object.fromEntries(['invoiceNumber','reason','scheduledAt','deliveryDate','dispatchPlace','itemCount','requestedQty','requestedUnit','total','totalAmount','run'].filter(k=>e.details?.[k]!=null).map(k=>[k,e.details[k]]))})).sort((a,b)=>(a.seq||0)-(b.seq||0));
 return {status:200,body:{order:summary(indexes(db),order),events}};
});
