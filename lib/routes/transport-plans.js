'use strict';
const {route,fail}=require('../http');
const store=require('../store');
const {activateDueRemoteOrders,createNotification,getProduct}=require('../domain');
const {assignment,assertEnabled}=require('../transport-planning');
function requireExperimental(){try{assertEnabled();}catch(e){fail(e.status||503,e.message);}}
const READ={roles:['admin','dispatch']};
route('GET','/api/transport/plans',READ,async()=>{
 requireExperimental();activateDueRemoteOrders();const db=store.get();
 const items=new Map();for(const i of db.orderItems){if(i.itemStatus==='CANCELLED')continue;if(!items.has(i.orderId))items.set(i.orderId,[]);items.get(i.orderId).push({productName:getProduct(i.productId)?.name||'—',requestedQty:i.requestedQty,requestedUnit:i.requestedUnit});}
 const customers=new Map(db.customers.map(c=>[c.id,c]));
 const orders=db.orders.filter(o=>o.transportWorkflow===1&&o.deliveryMode==='DELIVERY'&&['WAREHOUSE_PENDING','WAREHOUSE_PREPARING','SETTLEMENT_PENDING'].includes(o.status)).map(o=>({id:o.id,orderNo:o.orderNo,orderType:o.orderType,customerName:o.orderType==='STORE'?require('../store-name').storeDisplayName(o.storeName,o.branchNo):customers.get(o.customerId)?.name||'—',dispatchPlace:o.dispatchPlace||'',createdAt:o.createdAt,warehouseStatus:o.status,assignments:o.transportAssignments||{},items:items.get(o.id)||[]}));
 return {body:{orders}};
});
route('POST','/api/transport/plans/:id/assign',{roles:['admin','dispatch'],idempotent:true},async ctx=>{
 requireExperimental();const db=store.get(),order=db.orders.find(o=>o.id===ctx.params.id);if(!order)fail(404,'سفارش یافت نشد.');
 const run=Number(ctx.body.run??0),driver=db.drivers.find(d=>d.id===String(ctx.body.driverId||'')),vehicle=db.vehicles.find(v=>v.id===String(ctx.body.vehicleId||''));
 let next;try{next=assignment(order,run,driver,vehicle,ctx.user,store.nowIso());}catch(e){fail(e.status||400,e.message);}
 if(next!==order.transportAssignments){order.transportAssignments=next;order.updatedAt=store.nowIso();store.audit(ctx.user,'TRANSPORT_PLAN_ASSIGNED','order',order.id,{run,driverId:driver.id,driverName:driver.fullName,vehicleId:vehicle.id,vehiclePlate:vehicle.plate},ctx);createNotification('warehouse','TRANSPORT_ASSIGNED','order',order.id,`راننده و خودروی سفارش ${order.orderNo||'—'} تعیین شد.`);createNotification('sales','TRANSPORT_ASSIGNED','order',order.id,`راننده و خودروی سفارش ${order.orderNo||'—'} تعیین شد.`);store.save();}
 return {body:{assignment:order.transportAssignments[String(run)]}};
});
