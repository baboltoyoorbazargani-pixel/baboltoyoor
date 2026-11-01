'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/ui2.js'),'utf8');
function fragment(start,end){return source.slice(source.indexOf(start),source.indexOf(end));}
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
test('سند مشتری پخش محل امضای راننده و مشتری دارد، بدون تغییر سند مشتری قدیمی',()=>{
 const ctx=vm.createContext({esc:escape,fa:x=>x,qty:x=>x,formatDateTime24:()=> 'تاریخ'});
 vm.runInContext(fragment('function whDeliveredDocument(o){','async function whDeliveredDetails(id){'),ctx);
 const base={orderNo:'001',warehouseDocumentNo:'W-000001',customerName:'مشتری',customerPhone:'09',items:[]};
 const html=ctx.whDeliveredDocument({...base,deliveryMode:'DELIVERY',driverName:'<راننده>',driverPhone:'0912'});
 assert.match(html,/امضاء مشتری پس از تحویل/);assert.match(html,/امضاء راننده هنگام دریافت از انبار/);assert.match(html,/&lt;راننده&gt;/);assert.match(html,/امانت/);
 const old=ctx.whDeliveredDocument(base);assert.doesNotMatch(old,/راننده/);assert.match(old,/<span>امضاء<\/span>/);
});
test('ثبت تحویل فقط با تأیید صریح انجام می‌شود و متن سند در درخواست نیست',async()=>{
 const calls=[];let confirmed=false;const ctx=vm.createContext({confirm:()=>confirmed,api:async(...args)=>calls.push(args),closeModal:()=>calls.push('close'),toast:()=>{},whDeliveredLoad:async()=>calls.push('regular'),loadWhStoreDocuments:async()=>calls.push('store'),encodeURIComponent,JSON});
 vm.runInContext(fragment('async function whTransportHandover(','async function whDeliveredPrint(id){'),ctx);
 const btn={disabled:false};await ctx.whTransportHandover(btn,'o',0,'token');assert.equal(calls.length,0);assert.equal(btn.disabled,false);
 confirmed=true;await ctx.whTransportHandover(btn,'o',0,'token');assert.equal(btn.disabled,true);assert.equal(calls[0][0],'/api/warehouse/transport-handovers/o');assert.deepEqual(JSON.parse(calls[0][1].body),{run:0,handoverToken:'token',signedPaperConfirmed:true});assert(calls.includes('regular'));
 calls.length=0;const btn2={disabled:false};await ctx.whTransportHandover(btn2,'o',2,'token2');assert(calls.includes('store'));
});
