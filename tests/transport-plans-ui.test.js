'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/dispatch-ui.js'),'utf8');
const code=source.slice(source.indexOf('function transportPlanRows('));
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
test('نمای ترابری برای دو سرویس ردیف جدا و وضعیت مستقل دارد و داده را امن نمایش می‌دهد',()=>{
 const ctx=vm.createContext({esc,fa:x=>x});vm.runInContext(code,ctx);
 const rows=ctx.transportPlanRows([{id:'o',orderNo:'101',customerName:'<فروشگاه>',services:[{run:1,assignment:{driverName:'<الف>',vehicleType:'وانت',vehiclePlate:'123'},departed:true,tripStatus:'IN_TRANSIT'},{run:2,assignment:{driverName:'ب'},canDepart:true}]}]);
 assert.match(rows,/&lt;فروشگاه&gt;/);assert.match(rows,/&lt;الف&gt;/);assert.match(rows,/سرویس اول/);assert.match(rows,/سرویس دوم/);assert.match(rows,/در مسیر/);assert.match(rows,/آماده ثبت خروج/);assert.equal((rows.match(/data-tp="details"/g)||[]).length,2);
});
test('پنل آزمایشی در حالت غیرفعال درخواست صف یا تخصیص نمی‌فرستد',async()=>{
 const host={innerHTML:''},calls=[];const ctx=vm.createContext({esc,fa:x=>x,$:s=>s==='#transportPlans'?host:null,api:async url=>{calls.push(url);return {experimentalWorkflow:false}}});vm.runInContext(code,ctx);
 await ctx.renderTransportPlanQueue();assert.deepEqual(calls,['/api/transport/capabilities']);assert.equal(host.innerHTML,'');
});
test('عملیات خروج تا تأیید صریح انجام نمی‌شود و شماره فاکتور صحیح فرستاده می‌شود',async()=>{
 let html='',button={disabled:false},confirmResult=false;const calls=[];const err={textContent:''};const ctx=vm.createContext({esc,fa:x=>x,qty:x=>x,encodeURIComponent,JSON,openModal:(title,body)=>{html=body},$:s=>s==='#modal [data-tp-depart]'?button:s==='#modal [data-tp-depart-error]'?err:null,confirm:()=>confirmResult,api:async(...a)=>calls.push(a),closeModal:()=>{},toast:()=>{}});vm.runInContext(code,ctx);ctx.renderTransportPlanQueue=async()=>{};
 ctx.transportPlanDetails({id:'o',orderNo:'1',customerName:'مشتری',items:[]},{run:0,handedOver:true,canDepart:true,invoiceNumber:'000123',assignment:{}},{drivers:[],vehicles:[]});assert.match(html,/000123/);await button.onclick();assert.equal(calls.length,0);
 confirmResult=true;await button.onclick();assert.equal(calls[0][0],'/api/transport/shipments/o/depart');assert.deepEqual(JSON.parse(calls[0][1].body),{invoicePaperGiven:true,invoiceNumber:'000123'});
});
test('جزئیات فروش و انبار تخصیص مستقل را نشان می‌دهد و فقط فروش می‌تواند بازگشت مدارک تأییدشده را ثبت کند',()=>{
 const appSource=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8'),fragment=appSource.slice(appSource.indexOf('function transportOrderServiceHtml('),appSource.indexOf('async function openOrderDetails('));
 const ctx=vm.createContext({esc,fa:x=>x,app:{features:{experimentalTransport:true}}});vm.runInContext(fragment,ctx);
 const order={transportWorkflow:1,deliveryMode:'DELIVERY',orderType:'STORE',transportAssignments:{'1':{driverName:'<راننده اول>',driverPhone:'091',vehicleType:'وانت',vehiclePlate:'123'},'2':{driverName:'راننده دوم'}},transportStoreTrips:{'1':{status:'RECEIPT_CONFIRMED'},'2':{status:'IN_TRANSIT'}}};
 const sales=ctx.transportOrderServiceHtml(order,true),warehouse=ctx.transportOrderServiceHtml(order,false);assert.match(sales,/&lt;راننده اول&gt;/);assert.match(sales,/راننده دوم/);assert.match(sales,/data-store-transport-return="1"/);assert.doesNotMatch(sales,/data-store-transport-return="2"/);assert.doesNotMatch(warehouse,/data-store-transport-return=/);
 ctx.app.features.experimentalTransport=false;assert.doesNotMatch(ctx.transportOrderServiceHtml(order,true),/data-store-transport-return=/);
 assert.equal(ctx.transportOrderServiceHtml({...order,transportWorkflow:undefined},true),'');
});
