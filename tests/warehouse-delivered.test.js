'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../lib/routes/orders.js'),'utf8');
const context={getProduct:id=>({p:{name:'نام فعلی'}}[id])};vm.createContext(context);vm.runInContext(src.slice(src.indexOf('function warehouseDeliveredDocuments('),src.indexOf("route('GET','/api/warehouse/delivered'")),context);
test('legacy warehouse history and audit snapshots remain readable, reopen hides stale weights',()=>{
 const db={customers:[{id:'c',name:'مشتری',phone:'09120000000'}],users:[{id:'w',fullName:'انباردار'}],orders:[
  {id:'old',orderType:'REMOTE',customerId:'c',status:'EXITED',warehouseCompletedAt:'2025-01-01'},
  {id:'audit',orderType:'REMOTE',customerId:'c',status:'SETTLED',warehouseCompletedAt:'2026-01-01',warehouseCompletedBy:'w'},
  {id:'reopen',orderType:'REMOTE',status:'RETURNED_TO_SALES',warehouseCompletedAt:'2026-01-01'},
  {id:'store',orderType:'STORE',status:'SETTLED',warehouseCompletedAt:'2026-01-01'}],
  orderItems:[{id:'i',orderId:'old',productId:'p',warehouseStatus:'DELIVERED',deliveredKg:4,requestedQty:5},{id:'j',orderId:'audit',productId:'p',itemStatus:'CANCELLED',deliveredKg:999}],
  audit:[{entityType:'order',entityId:'audit',action:'WAREHOUSE_FINALIZE',details:{items:[{itemId:'j',status:'DELIVERED',deliveredKg:3}]}},{entityType:'order',entityId:'reopen',action:'WAREHOUSE_FINALIZE',details:{items:[]}},{entityType:'order',entityId:'reopen',action:'REOPEN_WAREHOUSE_PREPARING'}]};
 const before=JSON.stringify(db),result=context.warehouseDeliveredDocuments(db);
 assert.deepEqual(Array.from(result,r=>r.id),['audit','old']);assert.equal(result[0].items[0].deliveredKg,3);assert.equal(result[0].legacy,true);assert.equal(result[1].legacy,true);assert.equal(result[1].items[0].deliveredKg,4);assert.equal(JSON.stringify(db),before);
});
