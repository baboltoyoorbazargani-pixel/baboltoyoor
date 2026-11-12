'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/ui2.js'),'utf8');
function fragment(start,end){return source.slice(source.indexOf(start),source.indexOf(end));}
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
test('سند مشتری پخش محل امضای راننده و مشتری دارد، بدون تغییر سند مشتری قدیمی',()=>{
 const ctx=vm.createContext({esc:escape,fa:x=>x,qty:x=>x,formatDateTime24:()=> 'تاریخ'});
 vm.runInContext(fragment('function whDocumentTares(line){','async function whDeliveredDetails(id){'),ctx);
 const base={orderNo:'001',warehouseDocumentNo:'W-000001',customerName:'مشتری',customerPhone:'09',items:[]};
 const html=ctx.whDeliveredDocument({...base,deliveryMode:'DELIVERY',driverName:'<راننده>',driverPhone:'0912'});
 assert.match(html,/امضاء مشتری پس از تحویل/);assert.match(html,/امضاء راننده هنگام دریافت از انبار/);assert.match(html,/&lt;راننده&gt;/);assert.match(html,/امانت/);
 const old=ctx.whDeliveredDocument(base);assert.doesNotMatch(old,/راننده/);assert.match(old,/<span>امضاء<\/span>/);
});
test('تحویل با تأیید فیزیکی ثبت و سند بلافاصله برای چاپ ارسال می‌شود',async()=>{
 const calls=[];let confirmed=false,fail=false;const ctx=vm.createContext({confirm:()=>confirmed,api:async(...args)=>{calls.push(args);if(fail)throw Error('network');return {handover:{document:{warehouseDocumentNo:'W-1'}}};},closeModal:()=>calls.push('close'),toast:x=>calls.push(x),whPrintDocument:(doc,run)=>calls.push(['print',doc,run]),whDeliveredLoad:async()=>calls.push('regular'),loadWhStoreDocuments:async()=>calls.push('store'),encodeURIComponent,JSON});
 vm.runInContext(fragment('async function whTransportHandover(','function whPrintDocument('),ctx);
 const btn={disabled:false};await ctx.whTransportHandover(btn,'o',0,'token');assert.equal(calls.length,0);assert.equal(btn.disabled,false);
 confirmed=true;await ctx.whTransportHandover(btn,'o',0,'token');assert.equal(btn.disabled,true);assert.equal(calls[0][0],'/api/warehouse/transport-handovers/o');assert.deepEqual(JSON.parse(calls[0][1].body),{run:0,handoverToken:'token',physicalHandoverConfirmed:true});assert(calls.some(x=>Array.isArray(x)&&x[0]==='print'&&x[2]===0));assert(calls.includes('regular'));
 calls.length=0;const btn2={disabled:false};await ctx.whTransportHandover(btn2,'o',2,'token2');assert(calls.includes('store'));assert(calls.some(x=>Array.isArray(x)&&x[0]==='print'&&x[2]===2));
 calls.length=0;fail=true;const btn3={disabled:false};await ctx.whTransportHandover(btn3,'o',0,'token');assert.equal(btn3.disabled,false);assert(!calls.some(x=>Array.isArray(x)&&x[0]==='print'));assert(!calls.includes('close'));
});
test('ثبت تحویل در کارتابل انبار برای مدیر و انبار مجاز است',()=>{
 const ctx=vm.createContext({app:{page:'warehouse',user:{roleCode:'admin'}},normalizeRole:x=>x});vm.runInContext(fragment('function whCanRegisterHandover(){','async function whDeliveredDetails(id){'),ctx);
 assert.equal(ctx.whCanRegisterHandover(),true);ctx.app.user.roleCode='warehouse';assert.equal(ctx.whCanRegisterHandover(),true);ctx.app.user.roleCode='sales';assert.equal(ctx.whCanRegisterHandover(),false);ctx.app.user.roleCode='admin';ctx.app.page='sales';assert.equal(ctx.whCanRegisterHandover(),false);
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
 assert.match(html,/جمع اقلام<\/span><b>2000/);assert.match(html,/کسر مرجوعی<\/span><b>1750/);assert.doesNotMatch(html,/<span>وضعیت<\/span>/);assert.match(html,/مبلغ پرداختی<\/span><b>0/);assert.doesNotMatch(html,/جزئیات روش پرداخت ثبت نشده/);
 const pending=ctx.invoiceHtml({...base,transportReturn:{outcome:'DELIVERED'}},{totalAmount:1750,discountAmount:300,additionsAmount:50,settlementMethods:[{type:'CHECK',amount:1750,checkStatus:'PENDING'}],debtAccount:{initial:1750,receipts:[{amount:1750,status:'PENDING'}]}});
 assert.match(pending,/مبلغ پرداختی<\/span><b>0/);assert.match(pending,/مانده حساب<\/span><b>1750/);
});
test('محاسبه فرم فروش با مرجوعی جزئی و کامل مطابق فاکتور است و وزن نامعتبر رد می‌شود',()=>{
 const ctx=vm.createContext({en:s=>String(s).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))});
 vm.runInContext(fragment('function transportClosureAmount(invoice,rows){','function transportPaymentRowHtml('),ctx);
 const invoice={totalAmount:1750,priceLines:[{deliveredKg:2,unitPrice:1000}]};
 assert.equal(ctx.transportClosureAmount(invoice,['۰']),1750);assert.equal(ctx.transportClosureAmount(invoice,['۰٫۵']),1250);assert.equal(ctx.transportClosureAmount(invoice,['1.9']),0);assert.equal(ctx.transportClosureAmount(invoice,['۲']),0);
 for(const bad of ['','-1','2.001','1.0001','1kg','NaN'])assert.equal(ctx.transportClosureAmount(invoice,[bad]),null,bad);
});
test('ثبت بازگشت فروش نیازمند تأیید مدارک و امضای کاغذی در حالت تحویل‌شده است',async()=>{
 let consent=true;const calls=[],button={disabled:false},err={textContent:''},sigbox={hidden:true},f={elements:{documents:{checked:true},outcome:{value:'DELIVERED'},signature:{checked:false},note:{value:''}},querySelector:s=>({'[data-ts-signature]':sigbox,'[data-ts-error]':err,'[type=submit]':button})[s]};
 const ctx=vm.createContext({confirm:()=>consent,api:async(...a)=>calls.push(a),toast:()=>{},stlOpen:async()=>{},encodeURIComponent,JSON});
 vm.runInContext(fragment('function bindTransportReturn(host,order,','function transportClosureFormHtml(order){'),ctx);ctx.bindTransportReturn({querySelector:()=>f},{id:'ord'});f.elements.outcome.onchange();assert.equal(sigbox.hidden,false);
 await f.onsubmit({preventDefault(){}});assert.equal(calls.length,0);assert.match(err.textContent,/امضای دستی/);
 f.elements.signature.checked=true;consent=false;await f.onsubmit({preventDefault(){}});assert.equal(calls.length,0);
 consent=true;await f.onsubmit({preventDefault(){}});assert.deepEqual(JSON.parse(calls[0][1].body),{documentsReturned:true,outcome:'DELIVERED',customerSignatureOnPaper:true,note:''});
 f.elements.outcome.value='NOT_DELIVERED';f.elements.outcome.onchange();assert.equal(f.elements.signature.checked,false);assert.equal(sigbox.hidden,true);
});
test('بستن فاکتور فقط پس از تأیید صریح و با مقادیر واردشده فروش ثبت می‌شود',async()=>{
 let consent=false,submitted=[],closed=0,reset=0;const amount={value:'0',addEventListener(){}},reason={value:'مرجوعی'},line={dataset:{id:'item'},querySelector:s=>s==='[data-ts-kg]'?amount:reason},button={disabled:false},error={textContent:''},total={textContent:''};
 const payments=[];const payHost={querySelectorAll:()=>payments};const add={};
 const form={elements:{checked:{checked:false}},querySelectorAll:s=>s==='[data-ts-line]'?[line]:s==='[data-ts-kg]'?[amount]:s==='[data-ts-payrow]'?payments:[],querySelector:s=>({'[data-ts-payments]':payHost,'[data-ts-total]':total,'[data-ts-add]':add,'[data-ts-error]':error,'[type=submit]':button})[s]};
 const ctx=vm.createContext({en:s=>String(s),money:x=>String(x),stl:{devices:[]},app:{salesCache:{fetchedAt:1}},api:async(...a)=>submitted.push(a),confirm:()=>consent,toast:()=>{},stlClose:()=>closed++,renderSales:async()=>reset++,encodeURIComponent,JSON});
 vm.runInContext(fragment('function transportClosureAmount(invoice,rows){','function invoiceHtml(o,paySel){'),ctx);
 const order={id:'x',transportInvoice:{totalAmount:1750,priceLines:[{itemId:'item',deliveredKg:2,unitPrice:1000}]}};ctx.bindTransportClosure({querySelector:()=>form},order);
 await form.onsubmit({preventDefault(){}});assert.match(error.textContent,/حداقل یک روش/);assert.equal(submitted.length,0);
 amount.value='2';await form.onsubmit({preventDefault(){}});assert.equal(submitted.length,0);
 form.elements.checked.checked=true;await form.onsubmit({preventDefault(){}});assert.equal(submitted.length,0);
 consent=true;await form.onsubmit({preventDefault(){}});assert.equal(submitted[0][0],'/api/sales/transport-invoices/x/close');assert.deepEqual(JSON.parse(submitted[0][1].body),{returns:[{itemId:'item',returnKg:'2',reason:'مرجوعی'}],settlementMethods:[]});assert.equal(closed,1);assert.equal(reset,1);assert.equal(ctx.app.salesCache.fetchedAt,0);
});
test('ورود مبلغ پخش ارقام فارسی، انگلیسی و عربی را بدون پنهان کردن متن نامعتبر می‌پذیرد',()=>{
 const en=s=>String(s).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
 const fa=s=>String(s).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);const ctx=vm.createContext({en,fa});vm.runInContext(fragment('function transportMoneyNumber(value){','function transportPaymentRowHtml('),ctx);
 for(const s of ['1234567','۱٬۲۳۴٬۵۶۷','١,٢٣٤,٥٦٧','1 234 567'])assert.equal(ctx.transportMoneyNumber(s),1234567,s);
 for(const s of ['123x','-3','۱٫۲','9007199254740992',','])assert.equal(ctx.transportMoneyNumber(s),null,s);
 const field={value:'1234567',selectionStart:4,setSelectionRange(a,b){this.caret=[a,b]},setCustomValidity(message){this.validity=message}};ctx.transportFormatMoneyInput(field);assert.equal(field.value,'۱٬۲۳۴٬۵۶۷');assert.deepEqual(field.caret,[5,5]);assert.equal(field.validity,'');field.value='12x3';field.selectionStart=3;ctx.transportFormatMoneyInput(field);assert.equal(field.value,'12x3');assert.match(field.validity,/عدد معتبر/);
});
