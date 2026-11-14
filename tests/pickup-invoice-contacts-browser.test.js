'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const executablePath=process.env.BT_CHROMIUM_PATH;
test('pickup invoice contact row remains outside products in preview and print',{skip:!executablePath,timeout:45000},async()=>{
 const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'public/app.js'),'utf8'),ui=fs.readFileSync(path.join(root,'public/ui2.js'),'utf8');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const c={esc,n:Number,fa:String,qty:String,money:String,dt:()=> '1405/08/23 12:30'};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function settlementMethodLabel('),app.indexOf('// Shared compact')),c);vm.runInContext(ui.slice(ui.indexOf('function invoiceHtml(o,paySel){'),ui.indexOf('async function printInvoice(id,run)')),c);
 const order={orderType:'REMOTE',deliveryMode:'PICKUP',orderNo:'000123',customer:{name:'مالک فعلی'},pickupHandover:{document:{customerName:'صاحب سفارش',customerPhone:'09120000001',recipient:{name:'نماینده تحویل',phone:'09120000002',vehicleType:'وانت',plate:'SECRET-PLATE'}}},items:[{id:'i',product:{name:'محصول'},deliveredKg:1,unitPrice:100,finalAmount:100}],payment:{invoiceNumber:'000456',totalAmount:100,settlementMethods:[{type:'CASH',amount:100}]}};
 const html=c.invoiceHtml(order);const browser=await require('playwright-core').chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage();await page.setContent('<html dir="rtl"><head><style>body{margin:8px}'+fs.readFileSync(path.join(root,'public/invoice-compact.css'),'utf8')+'</style></head><body>'+html+'</body></html>');
 for(const media of ['screen','print']){await page.emulateMedia({media});for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:900});const row=page.locator('.inv38-pickup-contacts');assert.deepEqual(await row.locator(':scope>div>b').allTextContents(),['صاحب سفارش','09120000001','نماینده تحویل','09120000002']);const m=await row.evaluate(e=>{const r=e.getBoundingClientRect(),cells=[...e.children].map(x=>x.getBoundingClientRect());return {tops:cells.map(c=>c.top),inside:cells.every(c=>c.left>=r.left-1&&c.right<=r.right+1),inTable:!!e.closest('table'),after:e.compareDocumentPosition(document.querySelector('.inv38-table'))&Node.DOCUMENT_POSITION_FOLLOWING};});assert(Math.max(...m.tops)-Math.min(...m.tops)<1);assert(m.inside&&!m.inTable&&m.after,JSON.stringify(m));}}
 assert.doesNotMatch(await page.locator('body').innerText(),/SECRET-PLATE|وانت|مالک فعلی/);
 }finally{await browser.close();}
});
