'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('public/app.js'),ui=read('public/ui2.js');
const submitSource=app.slice(app.indexOf('async function submitFutureOrderV25(form)'),app.indexOf('async function openStoreApprovalV25(id)'));
function harness(fields){
 const calls=[],messages=[];
 const form={fields,reset(){},querySelector(){return null}};
 const context={FormData:class{constructor(f){this.fields=f.fields}*[Symbol.iterator](){yield*Object.entries(this.fields)}},
 storeAwareOrderName:o=>o?.orderType==='STORE'?(o.storeName||'فروشگاه'):(o?.customer?.name||o?.storeName||'—'),storeAwareOrderPhone:o=>o?.orderType==='STORE'?'':(o?.customer?.phone||'—'),today:()=> '2026-10-14',normalizeTime24:s=>String(s||''),toast:m=>messages.push(m),n:Number,
 app:{futureDraft:[{productId:'p01',requestedQty:'2',requestedUnit:'کیلوگرم',description:'بسته‌بندی'}]},
 api:async(url,opts)=>{calls.push({url,...opts});return{order:{status:'SCHEDULED_REMOTE'}}},
 renderOrderLineArea(){},renderSales:async()=>{},isoToJalali:s=>s,Event:class{}};
 vm.createContext(context);vm.runInContext(submitSource,context);
 return{calls,messages,form,context};
}
test('all order-entry templates omit duplicate draft products and totals',()=>{
 for(const src of [app,ui]){
  assert.doesNotMatch(src, /id="(?:phone|remote|future|store|sales)-summary"/);
  assert.doesNotMatch(src, /id="orderDraftSummary"/);
  assert.doesNotMatch(src, /<aside class="(?:sd-panel sd-summary-side|v26-order-summary)">/);
 }
 assert.match(read('public/form-layout.css'),/\.sd-oe-layout,[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important/);
 // Actual row entry remains present and editable.
 for(const id of ['future-lines','phone-lines','store-lines','orderLines'])assert(ui.includes(`id="${id}"`));
});
test('future entry accepts today and preserves the selected time and each item',async()=>{
 for(const scheduledTime of ['00:00','08:30','23:59']){
  const h=harness({name:'مشتری',phone:'09123456789',dispatchPlace:'بابل',deliveryDate:'2026-10-18',scheduledDate:'2026-10-14',scheduledTime});
  await h.context.submitFutureOrderV25(h.form);
  assert.equal(h.calls.length,1,JSON.stringify(h.messages));
  const payload=JSON.parse(h.calls[0].body);
  assert.equal(payload.scheduledAt,`2026-10-14T${scheduledTime}`);
  assert.equal(payload.deliveryDate,'2026-10-18');
  assert.equal(payload.items.length,1);assert.equal(payload.items[0].requestedQty,2);
 }
});
test('future entry still rejects previous dates and malformed times',async()=>{
 for(const [scheduledDate,scheduledTime] of [['2026-10-13','08:30'],['2026-10-14','25:00'],['2026-10-14','']]){
  const h=harness({scheduledDate,scheduledTime,dispatchPlace:'بابل'});await h.context.submitFutureOrderV25(h.form);
  assert.equal(h.calls.length,0);assert.equal(h.messages.length,1);
 }
});
test('editing a future order also allows the selected time today',async()=>{
 const fields={scheduledDate:'2026-10-14',scheduledTime:'16:45',dispatchPlace:'بابل'};
 const calls=[],messages=[];let submit;
 const form={fields,querySelector:()=>null,addEventListener:(name,fn)=>{submit=fn},reportValidity:()=>true};
 const source=app.slice(app.indexOf('async function editFutureV25(id)'),app.indexOf('async function cancelFutureV25(id)'));
 const c={FormData:class{constructor(f){this.fields=f.fields}*[Symbol.iterator](){yield*Object.entries(this.fields)}},
 api:async(url,opts)=>{if(opts){calls.push({url,...opts});return{}}return{order:{id:'test-order',orderType:'REMOTE',status:'SCHEDULED_REMOTE',customer:{name:'مشتری'},scheduledDate:'2026-10-15',scheduledAt:'2026-10-15T08:00'}}},
 toast:m=>messages.push(m),storeAwareOrderName:o=>o?.orderType==='STORE'?(o.storeName||'فروشگاه'):(o?.customer?.name||o?.storeName||'—'),storeAwareOrderPhone:o=>o?.orderType==='STORE'?'':(o?.customer?.phone||'—'),today:()=> '2026-10-14',normalizeTime24:s=>s,openModal(){},closeModal(){},bindJalaliDates(){},bindTime24(){},
 $:()=>form,fa:v=>String(v).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]),esc:s=>s||'',badge:()=>'',jalaliDateTimeInput:()=>'',jalaliInput:()=>'',time24:s=>s.slice(11,16),icon:()=>'',nextDayIso:()=> '2026-10-15',renderSales:async()=>{}};
 vm.createContext(c);vm.runInContext(source,c);await c.editFutureV25('test-order');
 assert.equal(typeof submit,'function');await submit({preventDefault(){},target:form});
 assert.equal(calls.length,1,JSON.stringify(messages));assert.equal(JSON.parse(calls[0].body).scheduledAt,'2026-10-14T16:45');
});

test('future entry requires a valid selected delivery date',async()=>{
 const h=harness({scheduledDate:'2026-10-14',scheduledTime:'08:30',dispatchPlace:'بابل',deliveryDate:''});
 await h.context.submitFutureOrderV25(h.form);assert.equal(h.calls.length,0);assert.match(h.messages[0],/تاریخ تحویل/);
});
