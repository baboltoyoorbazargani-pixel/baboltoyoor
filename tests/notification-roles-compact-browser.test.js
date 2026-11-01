'use strict';const {test}=require('node:test'),assert=require('node:assert/strict');const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
test('محموله و نشانگرهای نقش‌ها با فروشگاه مجزا و جزئیات پخش و نگهبانی', {skip:!process.env.BT_CHROMIUM_PATH,timeout:120000}, async()=>{const {chromium}=require('playwright-core');const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-notif-audit-')),base=`http://127.0.0.1:${port}`;const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'},stdio:['ignore','pipe','inherit']});let browser;
try{await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve();}});proc.once('exit',c=>reject(Error('server exit '+c)));});
browser=await chromium.launch({executablePath:process.env.BT_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});const contexts={};for(const k of ['admin','sales','gate','warehouse','store','other','driver','dispatch'])contexts[k]=await browser.newContext();const post=async(c,url,data={})=>{const r=await contexts[c].request.post(base+url,{data});if(!r.ok())throw Error(`${c} ${url} ${r.status()} ${await r.text()}`);return r.json()};const get=async(c,url)=>{const r=await contexts[c].request.get(base+url);if(!r.ok())throw Error(`${url} ${r.status()} ${await r.text()}`);return r.json()};
await post('admin','/api/login',{username:'admin',password:'Initial!2345'});await post('admin','/api/account/password',{currentPassword:'Initial!2345',newPassword:'Changed!2345'});for(const [username,roleCode,extra] of [['sales1','sales',{}],['gate1','gate',{}],['wh1','warehouse',{}],['shop1','store',{storeName:'فروشگاه اول'}],['shop2','store',{storeName:'فروشگاه دوم'}],['dispatch1','dispatch',{}]])await post('admin','/api/admin/users',{username,roleCode,fullName:username,position:'تست',password:'Changed!2345',mustChangePassword:false,...extra});
for(const [c,username] of [['sales','sales1'],['gate','gate1'],['warehouse','wh1'],['store','shop1'],['other','shop2'],['dispatch','dispatch1']])await post(c,'/api/login',{username,password:'Changed!2345'});
const pages={};for(const c of ['admin','sales','gate','warehouse','store','other','dispatch']){pages[c]=await contexts[c].newPage();await pages[c].goto(base+'/',{waitUntil:'networkidle'});}const badge=async(c,sel)=>pages[c].locator(sel+' .nav-badge').allInnerTexts();const refresh=async(...roles)=>{for(const c of roles)await pages[c].evaluate(()=>refreshIndicators());};
const order=(await post('store','/api/store/orders',{name:'مشتری فروشگاه',phone:'09121112233',items:[{productId:'p01',requestedQty:10,requestedUnit:'کیلوگرم'}]})).order;
await pages.sales.route('**/api/notifications',route=>route.abort());await pages.sales.evaluate(()=>refreshIndicators());await pages.sales.unroute('**/api/notifications');
await refresh('sales','admin','store','other');await pages.sales.evaluate(()=>refreshSalesOverview());
await post('sales',`/api/store/orders/${order.id}/quick-send`);await post('warehouse',`/api/orders/${order.id}/warehouse/accept`);await post('warehouse',`/api/orders/${order.id}/warehouse/start-preparing`);const itemId=order.items[0].id;await post('warehouse',`/api/orders/${order.id}/store-run/weights`,{run:1,items:[{itemId,deliveredKg:4}]});await post('warehouse',`/api/orders/${order.id}/store-run/move`,{itemId});await post('warehouse',`/api/orders/${order.id}/store-run/send-run`,{run:1});await refresh('sales','admin');await pages.sales.evaluate(()=>go('sales','stores'));await pages.sales.locator('[data-store-subtab=incoming]').waitFor();
const driver=(await post('admin','/api/drivers',{fullName:'راننده',phone:'09129998877',vehicleType:'وانت',plate:'12ب34567'})).driver;await post('admin','/api/admin/users',{username:'driver1',roleCode:'driver',fullName:'راننده',position:'تست',password:'Changed!2345',mustChangePassword:false,driverId:driver.id});await post('driver','/api/login',{username:'driver1',password:'Changed!2345'});pages.driver=await contexts.driver.newPage();await pages.driver.goto(base+'/',{waitUntil:'networkidle'});await post('sales',`/api/orders/${order.id}/send-dispatch`,{driverId:driver.id,run:1});await refresh('gate','driver','store','dispatch','admin');
// The sales tab must show store shipments as well as ordinary orders.
await pages.sales.evaluate(async()=>{await go('sales','delivery');if(app.salesFetchPromise)await app.salesFetchPromise;const d=await fetchSalesCache(true);paintSalesPaneV29('delivery',d)});
for(const width of [1440,390]){
 await pages.sales.setViewportSize({width,height:850});
 assert.equal(await pages.sales.locator('[data-delivery-tab]').count(),4);
 assert.equal(await pages.sales.locator('[data-delivery-section]:visible').count(),1);
 assert.equal(await pages.sales.locator(`[data-delivery-section=assigned] [data-delivery-order="${order.id}"]`).count(),1);
 assert.equal(await pages.sales.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`sales page ${width}`);
 await pages.sales.locator('[data-delivery-tab=assigned]').focus();await pages.sales.keyboard.press('ArrowLeft');
 assert.equal(await pages.sales.locator('[data-delivery-tab=inTransit]').getAttribute('aria-selected'),'true');
 await pages.sales.locator('[data-delivery-tab=assigned]').click();
}
await post('driver',`/api/driver/orders/${order.id}/exit`);await refresh('gate','admin');

assert.equal((await get('other','/api/notifications')).notifications.some(n=>n.entityId===order.id),false);
assert.ok((await get('driver','/api/notifications')).notifications.some(n=>n.entityId===order.id));
for(const width of [1440,390]){
  await pages.gate.setViewportSize({width,height:850});
  await pages.gate.evaluate(()=>{app.gateDispatchTab='leaving';return go('gate','dispatch')});
  const gateRow=pages.gate.locator(`[data-order="${order.id}"]`).first();assert.equal(await gateRow.evaluate(e=>getComputedStyle(e).flexDirection),'row');assert.equal(await gateRow.evaluate(e=>getComputedStyle(e).flexWrap),'nowrap');await gateRow.locator('[data-gate=details]').click();
  await pages.gate.locator('#modal.open .dsp-order-details').waitFor();assert.ok((await pages.gate.locator('#modal').innerText()).includes('فروشگاه شعبه 1 اول'));
  await pages.gate.locator('#modal .modal-close').click();
  await pages.dispatch.setViewportSize({width,height:850});
  await pages.dispatch.evaluate(()=>{adm.tab='dispatch';dsp.tab='assigned';return go('drivers','orders')});
  const dispatchRow=pages.dispatch.locator(`[data-order="${order.id}"]`).first();await dispatchRow.locator('[data-dsp=details]').click();
  await pages.dispatch.locator('#modal.open .dsp-order-details').waitFor();assert.ok((await pages.dispatch.locator('#modal').innerText()).includes('فروشگاه شعبه 1 اول'));
  await pages.dispatch.locator('#modal .modal-close').click();
  await pages.driver.setViewportSize({width,height:850});await pages.driver.evaluate(()=>go('driver'));
  await pages.driver.locator(`[data-order="${order.id}"] [data-dsp=details]`).first().click();await pages.driver.locator('#modal.open .dsp-order-details').waitFor();
  assert.equal(await pages.driver.locator('#modal .dsp-detail-head').evaluate(e=>getComputedStyle(e).flexWrap),'nowrap');await pages.driver.locator('#modal .modal-close').click();
}
// Confirm both separate deliveries in a real store browser; archived run 1
// must not be mistaken for the current second shipment.
const signatureData='data:image/png;base64,'+'A'.repeat(300);
await post('gate',`/api/gate/dispatch/${order.id}/exit`);
await pages.sales.evaluate(async()=>{if(app.salesFetchPromise)await app.salesFetchPromise;const d=await fetchSalesCache(true);paintSalesPaneV29('delivery',d)});
await pages.sales.locator('[data-delivery-tab=inTransit]').click();
assert.equal(await pages.sales.locator(`[data-delivery-section=inTransit] [data-delivery-order="${order.id}"]`).count(),1);
await pages.driver.evaluate(id=>openDeliveryForm(id),order.id);await pages.driver.locator('#dspDeliverForm').waitFor();assert.equal(await pages.driver.locator('#dspSig').count(),0);assert.doesNotMatch(await pages.driver.locator('#dspDeliverForm').innerText(),/امضای مشتری|اثر انگشت/);
const driverDelivery=pages.driver.waitForResponse(r=>r.url().endsWith('/deliver')&&r.request().method()==='POST');await pages.driver.locator('#dspDeliverForm [type=submit]').click();const deliveryResponse=await driverDelivery;assert.equal(deliveryResponse.status(),200,await deliveryResponse.text());assert.equal(JSON.parse(deliveryResponse.request().postData()).signatureData,undefined);
await pages.store.evaluate(()=>{app.storeDeliveryTab='delivered';return go('store','delivery')});
const first=pages.store.locator(`[data-action=store-delivery-details][data-id="${order.id}"][data-run="1"]`);
await first.click();await pages.store.locator('#modal.open .st38-delivered-items').waitFor();
assert.match(await pages.store.locator('#modal').innerText(),/سرویس اول/);
pages.store.once('dialog',d=>d.accept());const confirmFirst=pages.store.waitForResponse(r=>r.url().endsWith('/confirm-receipt')&&r.request().method()==='POST');
await pages.store.locator('#modal [data-action=store-confirm-delivery][data-run="1"]').click();assert.equal((await confirmFirst).status(),200);
// Delivery navigation counts unread notifications, not historic orders or workload.
await pages.sales.evaluate(()=>refreshIndicators());const unreadDelivery=(await get('sales','/api/notifications')).notifications.filter(n=>!n.isRead&&n.navSection==='delivery'&&n.entityId===order.id);assert.equal(unreadDelivery.length,2);assert.equal(await pages.sales.locator('[data-role-page=sales][data-cartable=delivery] .nav-badge').innerText(),'۲');
await pages.sales.evaluate(id=>markNotificationsRead(id),unreadDelivery[0].id);assert.equal(await pages.sales.locator('[data-role-page=sales][data-cartable=delivery] .nav-badge').innerText(),'۱');
await pages.sales.evaluate(id=>markNotificationsRead(id),unreadDelivery[1].id);assert.equal(await pages.sales.locator('[data-role-page=sales][data-cartable=delivery] .nav-badge').count(),0);assert.ok((await get('sales','/api/workload')).counts.salesDeliveryPending>0,'reading an alert must not erase pending work');
// Receipt of an unfinished order appears once, on that order's history summary.
await pages.sales.evaluate(async()=>{app.salesStoreTab='history';await go('sales','stores');if(app.salesFetchPromise)await app.salesFetchPromise;const d=await fetchSalesCache(true);paintSalesPaneV29('stores',d)});
const receiptRow=pages.sales.locator(`[data-store-section=history] [data-store-summary-id="${order.id}"]`);await receiptRow.waitFor();assert.equal(await receiptRow.count(),1);assert.match(await receiptRow.innerText(),/سرویس اول: دریافت فروشگاه تأیید شد/);assert.equal(await pages.sales.locator('.store-receipt-history-v43').count(),0);
await pages.sales.setViewportSize({width:320,height:850});const receiptGeometry=await receiptRow.evaluate(e=>{const d=e.querySelector('[data-action=store-order-details-v25]').getBoundingClientRect(),r=e.querySelector('.store-receipt-summary').getBoundingClientRect();return{below:r.top>=d.bottom-1,overflow:e.scrollWidth-e.clientWidth,list:e.parentElement.scrollWidth-e.parentElement.clientWidth}});assert.equal(receiptGeometry.below,true);assert.ok(receiptGeometry.overflow<=1&&receiptGeometry.list<=1,JSON.stringify(receiptGeometry));await pages.sales.setViewportSize({width:1440,height:850});
await receiptRow.locator('[data-action=store-order-details-v25]').click();await pages.sales.locator('#modal.open .v21-detail-table').waitFor();await pages.sales.locator('#modal .modal-close').click();
await pages.sales.evaluate(()=>go('sales','delivery'));
await pages.sales.evaluate(async()=>{if(app.salesFetchPromise)await app.salesFetchPromise;const d=await fetchSalesCache(true);paintSalesPaneV29('delivery',d)});
await pages.sales.locator('[data-delivery-tab=delivered]').click();
await pages.sales.locator(`[data-delivery-section=delivered] [data-delivery-order="${order.id}"] [data-action=sales-delivery-details]`).click();
await pages.sales.locator('#modal.open .sales-store-delivery-details').waitFor();assert.match(await pages.sales.locator('#modal').innerText(),/سرویس اول/);assert.doesNotMatch(await pages.sales.locator('#modal').innerText(),/قابل تسویه/);
const finalized=pages.sales.waitForResponse(r=>r.url().endsWith('/finalize')&&r.request().method()==='POST');await pages.sales.locator('#modal [data-action=sales-finalize-driver-delivery]').click();assert.equal((await finalized).status(),200);
await pages.sales.waitForFunction(()=>!document.querySelector('#modal.open'));
await pages.sales.evaluate(id=>previewInvoice(id,1),order.id);await pages.sales.locator('#modal .inv38-vitem').waitFor();assert.match(await pages.sales.locator('#modal .inv38-vitem strong').innerText(),/مشتری فروشگاه – ۰۹۱۲۱۱۱۲۲۳۳/);assert.doesNotMatch(await pages.sales.locator('#modal .inv38-sheet').innerText(),/اثر انگشت|امضای الکترونیکی/);
const [storePrint]=await Promise.all([pages.sales.waitForEvent('popup'),pages.sales.evaluate(id=>{void printInvoice(id,1)},order.id)]);await storePrint.locator('.inv38-vitem').waitFor();assert.match(await storePrint.locator('.inv38-vitem strong').innerText(),/مشتری فروشگاه – ۰۹۱۲۱۱۱۲۲۳۳/);await storePrint.close();await pages.sales.locator('#modal .modal-close').click();
await pages.sales.locator('[data-delivery-tab=history]').click();
assert.equal(await pages.sales.locator('[data-delivery-tab=history] b').count(),0,'history total is not a pending-work badge');
await pages.sales.locator(`[data-delivery-section=history] [data-delivery-order="${order.id}"]`).waitFor();
await post('warehouse',`/api/orders/${order.id}/store-run/weights`,{run:2,items:[{itemId,deliveredKg:6}]});
await post('warehouse',`/api/orders/${order.id}/store-run/send-run`,{run:2});
await pages.sales.evaluate(()=>{app.salesStoreTab='incoming';return go('sales','stores')});
await pages.sales.locator(`[data-action=sr-ship-open][data-order="${order.id}"][data-run="2"]`).click();
await pages.sales.locator('#srShipForm').waitFor();assert.match(await pages.sales.locator('#srShipForm').innerText(),/ماندهٔ سرویس دوم/);await pages.sales.locator('#modal .modal-close').click();
await post('sales',`/api/orders/${order.id}/send-dispatch`,{driverId:driver.id,run:2});
const archived=await get('sales',`/api/sales/dispatch-deliveries/${order.id}?run=1`);assert.equal(archived.order.dispatch.run,1);assert.equal(archived.signatureData,'');
await post('driver',`/api/driver/orders/${order.id}/exit`);await post('gate',`/api/gate/dispatch/${order.id}/exit`);
const secondDelivery=await post('driver',`/api/driver/orders/${order.id}/deliver`,{signatureData,settlementType:'CASH',lines:[{itemId,returnKg:0,shortageKg:0}]});assert.equal(secondDelivery.order.dispatch.hasSignature,false);
await pages.store.evaluate(()=>{app.storeDeliveryTab='delivered';return go('store','delivery')});
await pages.store.locator(`[data-action=store-delivery-details][data-id="${order.id}"][data-run="1"]`).click();await pages.store.locator('#modal.open .st38-delivered-items').waitFor();
assert.match(await pages.store.locator('#modal').innerText(),/تأیید شما:/);assert.equal(await pages.store.locator('#modal [data-action=store-confirm-delivery]').count(),0);await pages.store.locator('#modal .modal-close').click();
await pages.store.locator(`[data-action=store-delivery-details][data-id="${order.id}"][data-run="2"]`).click();await pages.store.locator('#modal.open .st38-delivered-items').waitFor();
assert.match(await pages.store.locator('#modal').innerText(),/سرویس دوم/);
pages.store.once('dialog',d=>d.accept());const confirmSecond=pages.store.waitForResponse(r=>r.url().endsWith('/confirm-receipt')&&r.request().method()==='POST');
await pages.store.locator('#modal [data-action=store-confirm-delivery][data-run="2"]').click();assert.equal((await confirmSecond).status(),200);
await pages.sales.evaluate(async()=>{app.salesStoreTab='history';await go('sales','stores');if(app.salesFetchPromise)await app.salesFetchPromise;const d=await fetchSalesCache(true);paintSalesPaneV29('stores',d)});
const both=pages.sales.locator(`[data-store-section=history] [data-store-summary-id="${order.id}"]`);await both.waitFor();assert.equal(await both.count(),1);assert.match(await both.innerText(),/سرویس اول: دریافت فروشگاه تأیید شد/);assert.match(await both.innerText(),/سرویس دوم: دریافت فروشگاه تأیید شد/);
}finally{if(browser)await browser.close();if(proc.exitCode===null&&proc.signalCode===null){const stopped=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await stopped;}fs.rmSync(dir,{recursive:true,force:true})}});
