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
test('فاکتور پیش از خروج تسویه یا تحویل را تأیید نمی‌کند و ارقام و محتوای سند ایمن است',()=>{
 const ctx=vm.createContext({esc:escape,fa:x=>x,qty:x=>x,money:x=>String(x),dt:()=> 'تاریخ'});
 vm.runInContext(fragment('function transportDraftInvoiceHtml(order,invoice){','async function transportDraftPreview(id){'),ctx);
 const html=ctx.transportDraftInvoiceHtml({orderNo:'123'},{invoiceNumber:'456',customerName:'<مشتری>',customerPhone:'09',priceLines:[{productName:'<کالا>',deliveredKg:2,unitPrice:1000,amount:2000}],subtotalAmount:2000,discountAmount:300,additionsAmount:50,totalAmount:1750});
 assert.match(html,/پیش از تحویل و تعیین تسویه/);assert.match(html,/به‌تنهایی تأیید تحویل، امضا یا تسویه نیست/);assert.match(html,/امضای دستی مشتری/);assert.match(html,/&lt;مشتری&gt;/);assert.match(html,/&lt;کالا&gt;/);assert.match(html,/1750/);assert.doesNotMatch(html,/تسویه نهایی و آماده خروج/);
});
test('فاکتور بسته‌شده، جمع پیش از مرجوعی و کسر واقعی و چک وصول‌نشده را درست نشان می‌دهد',()=>{
 const ctx=vm.createContext({esc:escape,fa:x=>x,qty:x=>x,money:x=>String(x),dt:()=> 'تاریخ',n:x=>Number(x||0)});
 vm.runInContext(fragment('function invoiceHtml(o,paySel){','async function printInvoice(id,run){'),ctx);
 const base={transportWorkflow:1,transportInvoice:{priceLines:[{productName:'کالا',deliveredKg:2,unitPrice:1000,amount:2000}]},transportReturn:{outcome:'NOT_DELIVERED'},items:[]};
 const html=ctx.invoiceHtml(base,{totalAmount:0,discountAmount:300,additionsAmount:50,returnDeduction:1750,settlementMethods:[]});
 assert.match(html,/جمع اقلام<\/span><b>2000/);assert.match(html,/کسر مرجوعی<\/span><b>1750/);assert.match(html,/تحویل‌نشده/);assert.match(html,/مبلغ پس از مرجوعی صفر است/);assert.doesNotMatch(html,/جزئیات روش پرداخت ثبت نشده/);
 const pending=ctx.invoiceHtml({...base,transportReturn:{outcome:'DELIVERED'}},{totalAmount:1750,discountAmount:300,additionsAmount:50,settlementMethods:[{type:'CHECK',amount:1750,checkStatus:'PENDING'}],debtAccount:{initial:1750,receipts:[{amount:1750,status:'PENDING'}]}});
 assert.match(pending,/در انتظار وصول/);assert.match(pending,/مانده معوق<\/span><b>1750/);
});
