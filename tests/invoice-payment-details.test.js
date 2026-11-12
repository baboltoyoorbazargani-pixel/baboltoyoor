'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const [file,end] of [['app.js','function printCss()'],['ui2.js','async function printInvoice(id,run)']]){
 const text=fs.readFileSync(path.join(__dirname,'../public',file),'utf8');const start=text.indexOf('function invoiceHtml(o,paySel){');
 const c={esc,n:Number,fa:String,qty:String,money:String,dt:String,todayText:()=>'',storeRunInvoiceLines:()=>[{productName:'محصول',deliveredKg:1}]};vm.createContext(c);vm.runInContext(text.slice(start,text.indexOf(end,start)),c);
 const order={orderNo:'123',customer:{name:'مشتری'},items:[{product:{name:'محصول'},deliveredKg:1,unitPrice:100,finalAmount:100}]};
 const html=p=>c.invoiceHtml({...order,payment:p});
 if(file==='ui2.js'){
  test('active invoice: totals contain paid/balance and methods show only type and amount',()=>{
   const s=html({totalAmount:100,amountDue:80,depositAmount:20,deposit:{type:'CASH',amount:20},settlementMethods:[{type:'CASH',amount:10},{type:'CHECK',amount:40,checkStatus:'PENDING',bank:'secret bank',reference:'secret reference'},{type:'CREDIT',amount:30}]});
   assert.match(s,/مبلغ نهایی<\/span><b>100[\s\S]*مبلغ پرداختی<\/span><b>30[\s\S]*مانده حساب<\/span><b>70/);
   const box=s.match(/<section class="inv38-payment-box"[\s\S]*?<\/section>/)[0];
   assert.match(box,/چک<\/span><b>40/);assert.doesNotMatch(box,/secret|قابل تسویه|نوع تسویه|مانده حساب|مبلغ پرداختی/);
   assert.match(html({totalAmount:100,settlementType:'CREDIT'}),/مبلغ پرداختی<\/span><b>نامشخص/);
   assert.match(html({totalAmount:100,settlementMethods:[{type:'CREDIT',amount:100}],debtAccount:{initial:100,receipts:[{status:'CLEARED',amount:30},{status:'PENDING',amount:20}]}}),/مبلغ پرداختی<\/span><b>30[\s\S]*مانده حساب<\/span><b>70/);
   assert.match(html({totalAmount:100,depositAmount:100,amountDue:0,settlementMethods:[]}),/مبلغ پرداختی<\/span><b>100/);
  });continue;
 }
 test(`${file}: mixed methods, credit snapshot and pending check are escaped and identified`,()=>{
  const s=html({totalAmount:100,amountDue:100,settlementMethods:[{type:'CASH',amount:10},{type:'POS',amount:20,deviceSnapshot:{title:'<pos>',bank:'بانک'}},{type:'CARD_TRANSFER',amount:10,reference:'<ref>'},{type:'CHECK',amount:30,bank:'<bank>',checkNumber:'12',dueDate:'1405',checkStatus:'PENDING'},{type:'CREDIT',amount:30,reason:'<script>alert(1)</script>'}]});
  assert(!s.includes('/logo.png'));assert(!s.includes('بابل طیور'));assert.equal(s.includes('فاکتور فروش و تحویل'),file==='app.js');
  assert.match(s,/نوع تسویه<\/span><b>ترکیبی/);for(const label of ['نقدی','پوز','کارت‌به‌کارت','چک','معوق','در انتظار وصول'])assert(s.includes(label));
  assert.match(s,/(?:معوق|مانده حساب)<\/span><b>30/);assert.match(s,/قابل تسویه<\/span><b>100/);assert(!s.includes('قابل تسویه ثبت‌شده'));assert(!s.includes('معوق ثبت‌شده'));assert(!s.includes('وصول بعدی'));assert(!s.includes('اعتباری'));
  assert(!s.includes('&lt;script&gt;'));assert(s.includes('&lt;pos&gt;'));assert(s.includes('&lt;ref&gt;'));assert(!s.includes('<script>'));assert(!s.includes('بررسی لازم است'));
 });
 test(`${file}: deposits, old and malformed data do not invent balances`,()=>{
  let s=html({totalAmount:100,deposit:{type:'CASH',amount:100},depositAmount:100,amountDue:0,settlementMethods:[]});assert(s.includes('از محل بیعانه'));assert.match(s,/(?:معوق|مانده حساب)<\/span><b>0/);
  s=html({totalAmount:100,settlementType:'CREDIT'});assert.match(s,/(?:معوق|مانده حساب)<\/span><b>نامشخص/);assert(s.includes('جزئیات روش پرداخت ثبت نشده'));
  s=html({totalAmount:100,settlementMethods:[{type:'CREDIT',amount:null}]});assert.match(s,/معوق<\/span>[\s\S]*?<b>نامشخص/);assert.match(s,/(?:معوق|مانده حساب)<\/span><b>نامشخص/);
  s=html({totalAmount:100,amountDue:100,settlementMethods:[{type:'CASH',amount:90}]});assert(s.includes('بررسی لازم است'));
  s=html({totalAmount:100,depositAmount:20,settlementMethods:[{type:'CASH',amount:80}]});assert(!s.includes('قابل تسویه ثبت‌شده'));assert(!s.includes('قابل تسویه</span>'));
 });
 test(`${file}: current debt excludes pending and reversed receipts`,()=>{const s=html({totalAmount:100,settlementMethods:[{type:'CREDIT',amount:100}],debtAccount:{initial:100,receipts:[{status:'CLEARED',amount:30},{status:'PENDING',amount:20},{status:'REVERSED',amount:10}]}});assert.match(s,/(?:مانده معوق|مانده حساب)<\/span><b>70/);assert(!s.includes('وصول بعدی'));});
 test(`${file}: store document remains weight-only`,()=>{const s=c.invoiceHtml({...order,orderType:'STORE',storeName:'فروشگاه',payment:{totalAmount:100,settlementMethods:[{type:'CREDIT',amount:100}]}});assert(s.includes('/logo.png'));assert(!s.includes('inv38-payment-box'));assert(!s.includes('معوق'));});
}
