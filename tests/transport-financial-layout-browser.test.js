'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const executablePath=process.env.BT_CHROMIUM_PATH;
test('فرم مالی پخش در عرض‌های مختلف و گردش واقعی از وزن تا بستن فاکتور',{skip:!executablePath,timeout:120000},async()=>{
 const {chromium}=require('playwright-core');const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-financial-layout-')),base=`http://127.0.0.1:${port}`;
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345',BT_EXPERIMENTAL_TRANSPORT_WORKFLOW:'1'},stdio:['ignore','pipe','pipe']});let browser;
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve();}});proc.once('exit',c=>reject(Error('server exit '+c)));});
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});const admin=await browser.newContext(),wh=await browser.newContext(),sales=await browser.newContext(),transport=await browser.newContext();
  const post=async(ctx,url,data)=>{const r=await ctx.request.post(base+url,{data});assert(r.ok(),url+' '+r.status()+' '+await r.text());return r.json();};
  const get=async(ctx,url)=>{const r=await ctx.request.get(base+url);assert(r.ok(),url+' '+r.status()+' '+await r.text());return r.json();};
  await post(admin,'/api/login',{username:'admin',password:'Initial!2345'});await post(admin,'/api/account/password',{currentPassword:'Initial!2345',newPassword:'Changed!2345'});
  for(const [username,roleCode] of [['wh1','warehouse'],['sale1','sales'],['dispatch1','dispatch']])await post(admin,'/api/admin/users',{username,roleCode,fullName:username,position:'تست',password:'Changed!2345',mustChangePassword:false});
  await post(wh,'/api/login',{username:'wh1',password:'Changed!2345'});await post(sales,'/api/login',{username:'sale1',password:'Changed!2345'});await post(transport,'/api/login',{username:'dispatch1',password:'Changed!2345'});
  const driver=(await post(transport,'/api/transport/drivers',{fullName:'راننده آزمایش',phone:'09121112233'})).driver;
  const vehicle=(await post(transport,'/api/transport/vehicles',{vehicleType:'وانت',plate:'12ب34567'})).vehicle;
  assert((await transport.request.put(base+`/api/transport/drivers/${driver.id}/resources`,{data:{vehicleId:vehicle.id,paymentDeviceId:''}})).ok());
  const day=new Date(),date=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
  const order=(await post(sales,'/api/orders/remote',{name:'مشتری آزمایش',phone:'09121112234',dispatchPlace:'بابل',scheduledDate:date,scheduledAt:date+'T00:00',transportWorkflow:true,deliveryMode:'DELIVERY',items:[{productId:'p01',requestedQty:4,requestedUnit:'کیلوگرم'}]})).order;
  await post(wh,`/api/orders/${order.id}/warehouse/accept`,{});await post(wh,`/api/orders/${order.id}/warehouse`,{items:[{itemId:order.items[0].id,deliveredKg:2}]});
  await post(transport,`/api/transport/plans/${order.id}/assign`,{driverId:driver.id,vehicleId:vehicle.id});
  const doc=(await get(wh,`/api/warehouse/delivered/${order.id}`)).order;await post(wh,`/api/warehouse/transport-handovers/${order.id}`,{signedPaperConfirmed:true,handoverToken:doc.handoverToken});
  await sales.addInitScript(()=>{if(window!==window.top)window.print=()=>{const body=window.parent.document.body;body.dataset.prints=String(Number(body.dataset.prints||0)+1);setTimeout(()=>window.dispatchEvent(new Event('afterprint')),0);};});
  const page=await sales.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base+'/',{waitUntil:'networkidle'});await page.evaluate(()=>go('sales','settlement'));
  const queue=page.locator(`[data-stl=select][data-id="${order.id}"]`);await queue.waitFor();
  // A failed order request must leave a visible, retryable error instead of a blank panel.
  const orderUrl=`**/api/orders/${order.id}`;await page.route(orderUrl,route=>route.fulfill({status:503,json:{error:'خطای آزمایشی سفارش'}}));
  await queue.click();await page.locator('#stlMain .stl-load-error').waitFor();assert.match(await page.locator('#stlMain').innerText(),/خطای آزمایشی سفارش/);await page.unroute(orderUrl);
  // The new transport flow must not depend on the legacy price and driver APIs.
  await page.route('**/api/prices',route=>route.abort());await page.route('**/api/dispatch/drivers',route=>route.abort());
  await page.locator('#stlMain [data-stl=retry]').click();await page.locator('[data-ti-price]').waitFor();
  await page.unroute('**/api/prices');await page.unroute('**/api/dispatch/drivers');
  // Leaving and re-entering via the real navigation rebuilds the settlement pane.
  await page.evaluate(()=>go('sales','flow'));await page.evaluate(()=>go('sales','settlement'));await page.locator('[data-ti-price]').waitFor();

 const price=page.locator('[data-ti-price]');await price.waitFor();await price.fill('1234567');assert.equal(await price.inputValue(),'۱٬۲۳۴٬۵۶۷');
 for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:900});const layout=await page.locator('.tr-invoice-panel').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,page:document.documentElement.scrollWidth,viewport:innerWidth,table:el.querySelector('.tr-table-scroll').scrollWidth,tableClient:el.querySelector('.tr-table-scroll').clientWidth}));assert(layout.scroll<=layout.client+1,JSON.stringify(layout));assert(layout.page<=layout.viewport+1,JSON.stringify(layout));if(width<=390)assert(layout.table>layout.tableClient,'جدول باریک در محدوده خودش پیمایش دارد');}
 await page.locator('[name=discountAmount]').fill('100000');await page.locator('[name=additionsAmount]').fill('10000');
 assert.match(await page.locator('[data-ti-summary]').innerText(),/۲٬۴۶۹٬۱۳۴/);assert.match(await page.locator('[data-ti-summary]').innerText(),/۲٬۳۷۹٬۱۳۴/);
 await price.fill('12x');await page.locator('[data-ti-form] button[type=submit]').click();assert.equal((await get(sales,`/api/orders/${order.id}`)).order.transportInvoice,undefined);await price.fill('1234567');
 await page.locator('[data-ti-form] button[type=submit]').click();await page.locator('[data-ti-preview]').waitFor();
 const prepared=(await get(sales,`/api/orders/${order.id}`)).order.transportInvoice;assert.equal(prepared.priceLines[0].unitPrice,1234567);assert.equal(prepared.totalAmount,2379134);
 // Printing is an explicit request, not proof that a printer succeeded. The
 // order must remain accessible from delivery even if printing is cancelled.
 await page.locator('[data-ti-preview]').click();await page.locator('#modal [data-ti-print]').click();await page.locator('[data-delivery-tab=assigned]').waitFor();await page.locator('body[data-prints="1"]').waitFor();await page.locator('iframe[title="سند آماده چاپ"]').waitFor({state:'detached'});
 await page.evaluate(()=>go('sales','settlement'));await page.locator('.stl-queue-list').waitFor();assert.equal(await page.locator(`[data-stl=select][data-id="${order.id}"]`).count(),0);await page.evaluate(()=>go('sales','delivery'));
 const deliveryRow=page.locator(`[data-delivery-order="${order.id}"]`);await deliveryRow.locator('[data-action=sales-delivery-details]').click();await page.locator('#modal [data-action=transport-sales-work]').click();await page.locator('#transportDeliveryWork [data-ti-preview]').waitFor();assert.equal(await page.evaluate(()=>app.sub.sales),'delivery');await page.locator('#transportDeliveryWork [data-ti-preview]').click();await page.locator('body[data-prints="2"]').waitFor();
 await page.locator('#modal [data-action=close-modal]').first().click();await post(transport,`/api/transport/shipments/${order.id}/depart`,{invoicePaperGiven:true,invoiceNumber:prepared.invoiceNumber});
 await page.evaluate(async()=>{const fresh=await fetchSalesCache(true);paintSalesPaneV29('delivery',fresh)});await page.locator('[data-delivery-tab=inTransit]').click();await page.locator(`[data-delivery-section=inTransit] [data-delivery-order="${order.id}"] [data-action=sales-delivery-details]`).click();await page.locator('#modal [data-action=transport-sales-work]').click();await page.locator('#transportDeliveryWork [data-ts-return]').waitFor();assert.equal(await page.evaluate(()=>app.sub.sales),'delivery');
 await page.route('**/api/payment-devices',route=>route.fulfill({status:503,json:{error:'فهرست پوز در دسترس نیست'}}));
 await page.locator('[data-ts-return] [name=documents]').check();await page.locator('[data-ts-return] [name=outcome]').selectOption('DELIVERED');await page.locator('[data-ts-return] [name=signature]').check();await page.locator('[data-ts-return] button[type=submit]').click();await page.locator('[data-ts-close]').waitFor();await page.locator('.stl-load-error').waitFor();assert.match(await page.locator('.stl-load-error').innerText(),/پوز/);await page.locator('[data-ts-kg]').fill('۰٫۵');await page.unroute('**/api/payment-devices');await page.locator('[data-ts-devices-retry]').click();await page.locator('.stl-load-error').waitFor({state:'detached'});assert.equal(await page.locator('[data-ts-kg]').inputValue(),'۰٫۵');
 await page.locator('[data-ts-kg]').fill('۰٫۵');assert.match(await page.locator('[data-ts-total]').innerText(),/۱٬۷۶۱٬۸۵۰/);
 await page.locator('[data-ts-add]').click();await page.locator('[data-ts-add]').click();assert.equal(await page.locator('[data-ts-payrow]').count(),2);await page.locator('[data-ts-payrow]').last().locator('[data-ts-remove]').click();assert.equal(await page.locator('[data-ts-payrow]').count(),1);const row=page.locator('[data-ts-payrow]');await row.locator('[data-ts-amount]').fill('1761850');assert.equal(await row.locator('[data-ts-amount]').inputValue(),'۱٬۷۶۱٬۸۵۰');
 for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:900});for(const type of ['CASH','POS','CARD_TRANSFER','CHECK','CREDIT']){await row.locator('[data-ts-type]').selectOption(type);const errors=await row.evaluate(el=>{const r=el.getBoundingClientRect(),controls=[...el.querySelectorAll('input,select,button')].filter(x=>x.offsetParent!==null);return controls.flatMap(x=>{const q=x.getBoundingClientRect();return q.left<r.left-1||q.right>r.right+1||q.width<35?[`${x.outerHTML}: ${q.left},${q.right} vs ${r.left},${r.right}`]:[];});});assert.deepEqual(errors,[],`${width}/${type}`);}}
 await row.locator('[data-ts-type]').selectOption('CASH');await row.locator('[data-ts-amount]').fill('۱٬۷۶۱٬۸۴۹');await page.locator('[data-ts-close] [name=checked]').check();await page.locator('[data-ts-close] button[type=submit]').click();assert.match(await page.locator('[data-ts-error]').innerText(),/جمع روش/);assert.equal((await get(sales,`/api/orders/${order.id}`)).order.transportInvoice.status,'PREPARED');
 await row.locator('[data-ts-amount]').fill('۱٬۷۶۱٬۸۵۰');await page.locator('[data-ts-close] button[type=submit]').click();await page.locator('[data-ts-close]').waitFor({state:'detached'});
 const closed=(await get(sales,`/api/orders/${order.id}`)).order;assert.equal(closed.transportInvoice.status,'CLOSED');assert.equal(closed.transportInvoice.totalAfterReturns,1761850);assert.equal(closed.payments[0].settlementMethods[0].amount,1761850);
 assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
