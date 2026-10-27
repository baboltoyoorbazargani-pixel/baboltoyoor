'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('public/app.js'),ui=read('public/ui2.js'),css=read('public/invoice-compact.css');
test('settlement footer is shared and contains driver, send and invoice in RTL DOM order',()=>{
 const footer=app.slice(app.indexOf('function stlFooterHtml(o)'),app.indexOf('function stlEmptyHtml()'));
 assert(footer.indexOf('${stlDispatchControls(o,returnControl)}')<footer.indexOf('data-stl="submit"'));
 assert.match(footer,/dispatched\?'':`<button/); // No onsite invoice when dispatched.
 assert.match(ui,/return window\.BTSettlementRenderers\.form\(o\)/);
 for(const source of [app]){
  const form=source.slice(source.indexOf('function stlFormHtml(o){'),source.indexOf('function stlFormHtml(o){')+6500);
  assert.match(form,/\$\{stlFooterHtml\(o\)\}/);
  const header=form.slice(0,form.indexOf('</header>'));
  assert.doesNotMatch(header,/stlDispatchControls\(o\)/);
 }
 const layout=read('public/compatibility.css');
 assert.match(layout,/min-width:0!important;width:100%;grid-template-columns:repeat\(2/);
 assert.match(layout,/@container stl \(max-width:520px\)/);
 assert.match(layout,/grid-column:auto!important;grid-row:auto!important/);
 assert.match(layout,/@container stl \(min-width:850px\)/);
});
test('compact invoice preview and print share a served stylesheet; no sales approval block',()=>{
 const invoice=ui.slice(ui.indexOf('function invoiceHtml(o,paySel){'),ui.indexOf('async function printInvoice(id,run)'));
 assert.match(invoice,/inv38-sheet inv38-compact/);
 assert.doesNotMatch(invoice,/inv38-sales-sign|تأیید واحد فروش|inv38-cust-under/);
  assert.match(invoice,/شماره سفارش[\s\S]*?o\.orderNo/);
  assert.doesNotMatch(invoice,/کد سریع|quickCode/,'کد سریع محصول نباید در پیش‌نمایش یا چاپ فاکتور باشد');
 assert.match(read('public/index.html'),/href="\/invoice-compact\.css\?v=37\.3\.18"/);
 assert.match(ui.slice(ui.indexOf('async function printInvoice(id,run)')),/href="\/invoice-compact\.css\?v=37\.3\.18"/);
 assert.match(read('lib/http.js'),/'\/invoice-compact\.css': \{ file: 'invoice-compact\.css'/);
 assert.match(css,/\.inv38-bottom \{[\s\S]*?direction:rtl/);
 assert.match(css,/@media print/);
});
test('invoice retains order number, amounts, signature and fingerprint/manual verification',()=>{
 const source=ui.slice(ui.indexOf('function invoiceHtml(o,paySel){'),ui.indexOf('async function printInvoice(id,run)'));
 const c={esc:s=>String(s||''),n:Number,fa:String,qty:String,money:String,dt:String,todayText:()=> 'today'};
 vm.createContext(c);vm.runInContext(source,c);
 const base={id:'uuid-internal',orderNo:'000456',customer:{name:'مشتری',phone:'0912'},items:[{product:{name:'مرغ'},deliveredKg:12,unitPrice:20,finalAmount:240},{product:{name:'لغوشده'},itemStatus:'CANCELLED',finalAmount:999}],payment:{totalAmount:240,signatureData:'data:image/png;base64,signature',fingerprintRef:'ref-123',verificationMode:'FINGERPRINT'}};
 const html=c.invoiceHtml(base);assert(html.includes('000456'));assert(!html.includes('uuid-internal'));assert(!html.includes('لغوشده'));
 assert(html.includes('>240<'));assert(html.includes('data:image/png;base64,signature'));assert(html.includes('ref-123'));
 const manual=c.invoiceHtml({...base,payment:{totalAmount:240,verificationMode:'MANUAL_NO_FINGERPRINT',noFingerprintAllowed:true}});
 assert(manual.includes('بدون اثرانگشت مجاز'));assert(!manual.includes('inv38-sales-sign'));
});
