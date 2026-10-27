'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const file of ['public/app.js','public/ui2.js'])test(file+': ready queue contains only customer name and public order number',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');const start=source.lastIndexOf('function settlementPendingRowsV27(rows){');const end=source.indexOf('\n}',start)+2;
 const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const ctx={fa:v=>String(v).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]),esc,storeAwareOrderName:o=>o?.orderType==='STORE'?(o.storeName||'فروشگاه'):(o?.customer?.name||o?.storeName||'—'),stl:{orderId:'internal-id'}};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 const html=ctx.settlementPendingRowsV27([{id:'internal-id',orderNo:'000123',customer:{name:'مشتری <آزمایشی>',phone:'09123456789'},dispatch:{status:'ASSIGNED'},createdAt:'PRIVATE_DATE',items:[{name:'PRIVATE_PRODUCT'}]}]);
 assert.match(html,/stl-queue-item-card active/);assert.match(html,/data-stl="select" data-id="internal-id"/);
 assert.match(html,/مشتری &lt;آزمایشی&gt;/);assert.match(html,/<bdi>۰۰۰۱۲۳<\/bdi>/);
 for(const absent of ['09123456789','PRIVATE_DATE','PRIVATE_PRODUCT','ASSIGNED','شماره تماس','آخرین اقدام','اقلام','stl-queue-field'])assert(!html.includes(absent),absent);
 const fallback=ctx.settlementPendingRowsV27([{id:'other',orderNo:'000001',storeName:'فروشگاه'}]);assert.match(fallback,/فروشگاه/);assert.match(fallback,/۰۰۰۰۰۱/);assert(!fallback.includes(' active'));
 assert.match(ctx.settlementPendingRowsV27([]),/سفارشی در انتظار تسویه نیست/);
});
test('ready queue CSS disables horizontal scrolling and wraps long names within cards',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','public/form-layout.css'),'utf8');const queue=css.slice(css.indexOf('/* Settlement ready queue ONLY:'));
 assert.match(queue,/grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(queue,/overflow-x:hidden!important;overflow-y:auto!important/);
 assert.match(queue,/white-space:normal!important;overflow-wrap:anywhere!important/);
 assert(!queue.includes('bt-customer-strip'));assert(!queue.includes('stl-primary-actions'));
});
