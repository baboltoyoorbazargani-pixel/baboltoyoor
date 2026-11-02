'use strict';
// v37.6.0 — اجزای UI: سربرگ انبار (دکمهٔ ارسال هر سرویس)، پنل فروش، کارت تحویل هر محموله، فاکتور هر سرویس
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
const ui=read('public/ui2.js'),app=read('public/app.js'),css=read('public/compatibility.css');
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fa=v=>String(v).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
function ctx(...fns){const c={esc,fa,qty:fa,money:fa,icon:()=>'',badge:()=>'',dateLabel:s=>s,dt:s=>s,formatDateTime24:v=>v||'—',plateViewHtml:()=>'',activeItemsOf:o=>(o.items||[]),storeAwareOrderName:o=>o?.storeName||o?.customer?.name||'—',storeAwareOrderPhone:o=>'',sdEmpty:()=>'',orderCustomerStripHtml:()=>''};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function orderSummaryRow('),app.indexOf('\nconst app =')),c);for(const f of fns){const idx=()=>ui.indexOf('function '+f);vm.runInContext(ui.slice(idx(),idx()+ui.slice(idx()).search(/\nfunction |\nasync function |$/)+1),c);}return c;}

test('anbar sheet: دکمهٔ ارسال هر سرویس با شرط آماده‌بودن و تأیید همراه است',()=>{
 const c=ctx('sr38SendBtn');
 const order={id:'o1',storeRunOps:{},id2:1};
 const items=[{itemId:'a',r1Kg:10,r2Kg:0,sentInR1:false,sentInR2:false}];
 const html1=c.sr38SendBtn(order,1,items);
 assert(html1.includes('ارسال سرویس اول به فروش'));assert(!html1.includes('disabled'),'با وزن آماده‌اند');
 const blocked=c.sr38SendBtn(order,2,items);
 assert(blocked.includes('disabled'),'سرویس دوم پیش از اول بلاک است');
 assert(blocked.includes('نخست اقلام سرویس اول'));
 const sent=c.sr38SendBtn({...order,storeRunOps:{r1Shipment:{status:'PENDING_SALES'}}},1,items);
 assert(sent.includes('به فروش ارسال شد'),'پس از ارسال چیپ وضعیت');
 assert(ui.includes('data-action="sr38-send-run"'),'دیسپچر دکمه موجود است');
 assert(ui.includes("sr38Post(id,'send-run',{run})"),'فراخوان مسیر صحیح');
});

test('سرصفحهٔ چیپ‌ها مرحلهٔ تحویل هر سرویس را نشان می‌دهد',()=>{
 const c=ctx('sr38Chips');
 const o={storeRun:{enabled:true,overallLabel:'در حال انجام',r1Status:'DONE',r1StatusLabel:'پایان‌یافته',r2Status:'PENDING',r2StatusLabel:'در انتظار',r1StageLabel:'به فروش ارسال شد (منتظر تعیین راننده)',counts:{total:1,completed:0,remaining:1,short:0},items:[]}};
 const html=c.sr38Chips(o);
 assert(html.includes('به فروش ارسال شد (منتظر تعیین راننده)'),'برچسب مرحلهٔ سرویس اول');
 assert(!html.includes('سرویس دوم ← فروش'),'بدون مرحلهٔ سرویس دوم وقتی نیست');
});

test('پنل فروش: فقط وقتی درخواست ارسال هست؛ کارت خروجی امن و دارای اکشن',()=>{
 const c=ctx('renderStoreRunShipmentsPanel');
 assert.strictEqual(c.renderStoreRunShipmentsPanel([]),'');
 assert.strictEqual(c.renderStoreRunShipmentsPanel(undefined),'');
 const html=c.renderStoreRunShipmentsPanel([{orderId:'o',orderNo:'0001',storeName:'<b>بد',run:2,sentAt:'2026-10-17T08:00',sentByName:'انبار',items:[{itemId:'i',productName:'مرغ<img>',quickCode:'01',deliveredKg:12.5}]}]);
 assert(html.includes('سرویس دوم'));
 assert(html.includes('data-action="sr-ship-open"'));
 assert(html.includes('&lt;b&gt;')||html.includes('&lt;b'),'HTML ایمن');
 assert(!html.includes('<img'));
 assert(css.includes('.sr-ship-panel'),'استایل پنل');
});

test('کارت تحویل فروشگاه: هر محموله چیپ سرویس و دکمهٔ تأیید همان محموله را دارد',()=>{
 const c=ctx('st38DeliveredRow','st38DeliveredDetails','st38ViewsOf');
 const base={id:'o',orderNo:'0007',storeName:'فروشگاه تست',items:[],
  dispatch:{status:'SALES_FINALIZED',run:2,deliveredAt:'2026-10-17T10:00',driverName:'راننده',lines:[{productName:'مرغ',deliveredKg:80,unitPrice:7000,grossAmount:560000,returnKg:0,shortageKg:0,netKg:75}],settlementType:'CASH',storeReceiptConfirmedAt:null},
  dispatchRuns:[{status:'SALES_FINALIZED',run:1,deliveredAt:'2026-10-17T08:00',driverName:'راننده۱',lines:[],storeReceiptConfirmedAt:'2026-10-17T09:00'}],
  payment:{invoiceNumber:'I-2'},payments:[{invoiceNumber:'I-1',deliveryRun:1},{invoiceNumber:'I-2',deliveryRun:2}]};
 const views=c.st38ViewsOf(base);
 assert.equal(views.length,2,'دو محموله');
 assert.equal(views[0].payment.invoiceNumber,'I-1','فاکتور سرویس اول');
 assert.equal(views[1].dispatch.run,2);
 const row2=c.st38DeliveredRow(views[1]);assert(row2.includes('data-action="store-delivery-details"'));assert(row2.includes('data-run="2"'));
 const html2=c.st38DeliveredDetails(views[1]);
 assert(html2.includes('محمولهٔ سرویس دوم'));
 assert(html2.includes('data-run="2"'),'بدنهٔ تأیید با run ارسال می‌شود');
 const html1=c.st38DeliveredDetails(views[0]);
 assert(html1.includes('تأیید شما:'),'محمولهٔ تأییدشده مهر می‌خورد');
 assert(!html1.includes('data-action="store-confirm-delivery"'),'دوباره دکمهٔ تأیید ندارد');
});

test('جمع‌بندی محموله‌ها در جزئیات سفارش هر دو سرویس را نشان می‌دهد',()=>{
 const c=ctx('st38RunSummaryHtml');
 assert.strictEqual(c.st38RunSummaryHtml({}),'');
 const html=c.st38RunSummaryHtml({dispatch:{status:'IN_TRANSIT',run:2,driverName:'b'},dispatchRuns:[{status:'SALES_FINALIZED',run:1,driverName:'a',deliveredAt:'2026-10-17T08:00',storeReceiptConfirmedAt:'2026-10-17T09:00'}]});
 assert(html.includes('محمولهٔ سرویس اول'));assert(html.includes('محمولهٔ سرویس دوم'));
 assert(html.includes('تأیید شد'),'مهر تأیید سرویس اول');
 assert(app.includes('${st38RunSummaryHtml(o)}'),'در مودال جزئیات فراخوانی می‌شود');
});

test('فاکتور به‌ازای هر سرویس: priceLines برای اقلام و یک ردیف برای هر فاکتور در مرکز فاکتورها',()=>{
 assert(app.includes('function pickInvoicePayment(o,run)'),'انتخابگر فاکتور سرویس');
 assert(app.includes('data-run="${run}"'),'دکمه‌های مشاهده/چاپ رانندهٔ run را دارد');
 assert(app.includes('priceLines.length?priceLines.map'),'اقلام فاکتور از priceLines');
 const c2={esc,fa,qty:fa,money:fa,n:v=>Number(v)||0,icon:()=>'',badge:()=>'',dt:s=>s,formatDateTime24:v=>v,todayText:()=>'',jalaliText:s=>s,textLength:()=>0};
 vm.createContext(c2);
 const start=app.indexOf('function invoiceHtml(o,paySel)');const end=app.indexOf('\nfunction ',start+10);
 vm.runInContext(app.slice(start,end),c2);
 const o2={payment:{invoiceNumber:'X0'},items:[{product:{name:'قدیم'},deliveredKg:1,unitPrice:1,finalAmount:1,itemStatus:'DELIVERED'}],payments:[]};
 const html=c2.invoiceHtml(o2,{invoiceNumber:'F-77',priceLines:[{productName:'مرغ',deliveredKg:80,unitPrice:7000,amount:560000}],totalAmount:560000,verifiedAt:'2026-10-17'});
 assert(html.includes(fa('F-77')), 'شماره فاکتور همان سرویس');assert(html.includes('مرغ'),'قلم از priceLines');
 assert(!html.includes('قدیم'),'قلم قدیمی نیامد');
});

test('فهرست فاکتورها سفارش چندپردازه را به ردیف‌های جدا می‌شکند',()=>{
 assert(app.includes("orders.flatMap(o=>(o.payments&&o.payments.length>1?o.payments:[o.payment])"),'فلتینگ فاکتورها');
});
