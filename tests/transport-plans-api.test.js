'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
test('ارسال برنامه‌ریزی ترابری مستقل از انبار، دسترسی، زمان‌بندی و تفکیک فروشگاه',{timeout:90000},async()=>{
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-plan-')),base=`http://127.0.0.1:${port}`,pass='Changed!2345';
 const start=()=>spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345',BT_EXPERIMENTAL_TRANSPORT_WORKFLOW:'1'},stdio:['ignore','pipe','pipe']});
 let proc=start();
 const ready=()=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve()}});proc.once('exit',c=>reject(Error('exit '+c)));});
 try{
  await ready();
  async function call(method,url,body,cookie){const r=await fetch(base+url,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});let data=await r.json();return{status:r.status,data,cookie:(r.headers.get('set-cookie')||'').split(';')[0]};}
  async function ok(method,url,body,cookie){const r=await call(method,url,body,cookie);assert(r.status>=200&&r.status<300,url+' '+r.status+' '+JSON.stringify(r.data));return r.data;}
  const admin=(await call('POST','/api/login',{username:'admin',password:'Initial!2345'})).cookie;await ok('POST','/api/account/password',{currentPassword:'Initial!2345',newPassword:pass},admin);
  for(const [username,roleCode,extra] of [['plan-sales','sales',{}],['plan-transport','dispatch',{}],['plan-wh','warehouse',{}],['plan-store','store',{storeName:'شعبه ۱ حمزه کلا'}]])await ok('POST','/api/admin/users',{username,roleCode,fullName:username,position:'تست',password:pass,mustChangePassword:false,...extra},admin);
  const sales=(await call('POST','/api/login',{username:'plan-sales',password:pass})).cookie,transport=(await call('POST','/api/login',{username:'plan-transport',password:pass})).cookie,wh=(await call('POST','/api/login',{username:'plan-wh',password:pass})).cookie,shop=(await call('POST','/api/login',{username:'plan-store',password:pass})).cookie;
  const driver=(await ok('POST','/api/transport/drivers',{fullName:'راننده',phone:'09121112233'},transport)).driver,vehicle=(await ok('POST','/api/transport/vehicles',{vehicleType:'وانت',plate:'12ب34567'},transport)).vehicle;
  const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const body={name:'مشتری تست',phone:'09121112234',dispatchPlace:'بابل',scheduledDate:date,scheduledTime:'00:00',items:[{productId:'p01',requestedQty:3,requestedUnit:'کیلوگرم'}],transportWorkflow:true};
  assert.equal((await call('POST','/api/orders/remote',body,sales)).status,400);
  const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1),futureDate=`${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
  const future=(await ok('POST','/api/orders/remote',{...body,scheduledDate:futureDate,deliveryMode:'DELIVERY'},sales)).order;
  const one=(await ok('POST','/api/orders/remote',{...body,deliveryMode:'DELIVERY'},sales)).order,two=(await ok('POST','/api/orders/remote',{...body,deliveryMode:'PICKUP'},sales)).order;
  const o=(await ok('POST','/api/store/orders',{name:'مشتری',phone:'09121112235',items:body.items},shop)).order;await ok('POST',`/api/store/orders/${o.id}/quick-send`,{transportWorkflow:true},sales);
  const notices=(await ok('GET','/api/notifications',null,transport)).notifications;assert(notices.some(n=>n.entityId===one.id));assert(notices.some(n=>n.entityId===o.id));assert(!notices.some(n=>n.entityId===two.id||n.entityId===future.id));
  const warehouseNotices=(await ok('GET','/api/notifications',null,wh)).notifications;assert(!warehouseNotices.some(n=>n.entityId===future.id));
  const plans=(await ok('GET','/api/transport/plans',null,transport)).orders;assert(plans.some(x=>x.id===one.id));assert(plans.some(x=>x.id===o.id));assert(!plans.some(x=>x.id===two.id));assert(!plans.some(x=>x.id===future.id));
  assert.equal((await call('POST',`/api/transport/plans/${future.id}/assign`,{driverId:driver.id,vehicleId:vehicle.id},transport)).status,409);assert(!JSON.stringify(plans).includes('unitPrice'));
  await ok('PUT',`/api/orders/${future.id}/remote`,{scheduledDate:date,scheduledTime:'00:00'},sales);
  assert((await ok('GET','/api/transport/plans',null,transport)).orders.some(x=>x.id===future.id));
  assert((await ok('GET','/api/notifications',null,transport)).notifications.some(n=>n.entityId===future.id));
  assert((await ok('GET','/api/notifications',null,wh)).notifications.some(n=>n.entityId===future.id));
  assert.equal((await call('GET','/api/transport/plans',null,sales)).status,403);
  assert.equal((await call('POST',`/api/transport/plans/${one.id}/assign`,{driverId:driver.id,vehicleId:vehicle.id},sales)).status,403);
  const a=(await ok('POST',`/api/transport/plans/${one.id}/assign`,{driverId:driver.id,vehicleId:vehicle.id},transport)).assignment;assert.equal(a.driverName,'راننده');assert.equal(a.vehiclePlate,'12ب34567');
  const info=(await ok('GET',`/api/orders/${one.id}`,null,wh)).order;assert.equal(info.transportAssignments['0'].driverName,'راننده');
  assert.equal((await call('POST',`/api/transport/plans/${two.id}/assign`,{driverId:driver.id,vehicleId:vehicle.id},transport)).status,409);
  assert.equal((await call('POST',`/api/transport/plans/${one.id}/assign`,{run:2,driverId:driver.id,vehicleId:vehicle.id},transport)).status,400);

  const driver2=(await ok('POST','/api/transport/drivers',{fullName:'راننده دوم',phone:'09121112237'},transport)).driver;
  const vehicle2=(await ok('POST','/api/transport/vehicles',{vehicleType:'وانت',plate:'22ب34567'},transport)).vehicle;
  // Ordinary shipment must have a finalized warehouse document and a transport assignment.
  const third=(await ok('POST','/api/orders/remote',{...body,deliveryMode:'DELIVERY',phone:'09121112236'},sales)).order;
  await ok('POST',`/api/orders/${third.id}/warehouse/accept`,{},wh);
  await ok('POST',`/api/orders/${third.id}/warehouse`,{items:[{itemId:third.items[0].id,deliveredKg:2}]},wh);
  assert.equal((await call('GET',`/api/warehouse/delivered/${third.id}`,null,wh)).status,409);
  assert.equal((await call('POST',`/api/warehouse/transport-handovers/${third.id}`,{signedPaperConfirmed:true},wh)).status,409);
  assert.equal((await call('POST',`/api/orders/${third.id}/settle`,{},sales)).status,409);
  await ok('POST',`/api/transport/plans/${third.id}/assign`,{driverId:driver.id,vehicleId:vehicle.id},transport);
  let doc=(await ok('GET',`/api/warehouse/delivered/${third.id}`,null,wh)).order;
  assert.equal(doc.driverName,'راننده');assert.match(doc.warehouseDocumentNo,/^W-/);
  const oldAssignmentToken=doc.handoverToken;
  await ok('POST',`/api/transport/plans/${third.id}/assign`,{driverId:driver2.id,vehicleId:vehicle2.id},transport);
  assert.equal((await call('POST',`/api/warehouse/transport-handovers/${third.id}`,{signedPaperConfirmed:true,handoverToken:oldAssignmentToken},wh)).status,409);
  await ok('POST',`/api/transport/plans/${third.id}/assign`,{driverId:driver.id,vehicleId:vehicle.id},transport);
  const history=(await ok('GET',`/api/orders/${third.id}`,null,sales)).order.transportAssignmentHistory;
  assert.equal(history.length,2);assert.equal(history[0].driverName,'راننده');assert.equal(history[1].driverName,'راننده دوم');assert.equal(history[1].vehiclePlate,'22ب34567');
  doc=(await ok('GET',`/api/warehouse/delivered/${third.id}`,null,wh)).order;
  const stale=doc.handoverToken,number=doc.warehouseDocumentNo;
  await ok('POST',`/api/orders/${third.id}/warehouse/reopen-preparing`,{},sales);
  await ok('POST',`/api/orders/${third.id}/warehouse`,{items:[{itemId:third.items[0].id,deliveredKg:2.5}]},wh);
  assert.equal((await call('POST',`/api/warehouse/transport-handovers/${third.id}`,{signedPaperConfirmed:true,handoverToken:stale},wh)).status,409);
  doc=(await ok('GET',`/api/warehouse/delivered/${third.id}`,null,wh)).order;assert.equal(doc.warehouseDocumentNo,number);
  assert.equal((await call('POST',`/api/warehouse/transport-handovers/${third.id}`,{signedPaperConfirmed:false},wh)).status,400);
  assert.equal((await call('POST',`/api/warehouse/transport-handovers/${third.id}`,{signedPaperConfirmed:true},sales)).status,403);
  assert.equal((await call('POST',`/api/warehouse/transport-handovers/${third.id}`,{signedPaperConfirmed:true},wh)).status,409);
  let hand=(await ok('POST',`/api/warehouse/transport-handovers/${third.id}`,{signedPaperConfirmed:true,handoverToken:doc.handoverToken},wh)).handover;
  assert.equal(hand.document.warehouseDocumentNo,doc.warehouseDocumentNo);assert.equal(hand.document.items[0].deliveredKg,2.5);
  assert.equal((await call('POST',`/api/orders/${third.id}/warehouse/reopen-preparing`,{},sales)).status,409);
  assert.equal((await call('POST',`/api/transport/plans/${third.id}/assign`,{driverId:driver.id,vehicleId:vehicle.id},transport)).status,409);
  const after=(await ok('GET',`/api/orders/${third.id}`,null,sales)).order;
  assert.equal(after.status,'SETTLEMENT_PENDING');assert.equal(after.dispatch??null,null);assert.equal(after.payments.length,0);

  // Two store services use independently assigned drivers and separate documents.
  await ok('POST',`/api/orders/${o.id}/warehouse/accept`,{},wh);
  await ok('POST',`/api/orders/${o.id}/store-run/weights`,{run:1,items:[{itemId:o.items[0].id,deliveredKg:1}]},wh);
  await ok('POST',`/api/orders/${o.id}/store-run/send-run`,{run:1},wh);
  assert.equal((await call('GET',`/api/warehouse/store-documents/${o.id}/1`,null,wh)).status,409);
  assert.equal((await call('POST',`/api/orders/${o.id}/send-dispatch`,{driverId:driver.id,run:1},sales)).status,409);
  await ok('POST',`/api/transport/plans/${o.id}/assign`,{run:1,driverId:driver.id,vehicleId:vehicle.id},transport);
  await ok('POST',`/api/transport/plans/${o.id}/assign`,{run:2,driverId:driver2.id,vehicleId:vehicle2.id},transport);
  await ok('POST',`/api/orders/${o.id}/store-run/move`,{itemId:o.items[0].id},wh);
  await ok('POST',`/api/orders/${o.id}/store-run/weights`,{run:2,items:[{itemId:o.items[0].id,deliveredKg:2}]},wh);
  await ok('POST',`/api/orders/${o.id}/store-run/send-run`,{run:2},wh);
  const doc1=(await ok('GET',`/api/warehouse/store-documents/${o.id}/1`,null,wh)).document;
  const doc2=(await ok('GET',`/api/warehouse/store-documents/${o.id}/2`,null,wh)).document;
  assert.equal(doc1.driverName,'راننده');assert.equal(doc2.driverName,'راننده دوم');
  assert.notEqual(doc1.warehouseDocumentNo,doc2.warehouseDocumentNo);assert.equal(doc1.lines[0].deliveredKg,1);assert.equal(doc2.lines[0].deliveredKg,2);
  assert.equal((await ok('GET',`/api/orders/${o.id}`,null,sales)).order.transportHandovers,undefined);
  hand=(await ok('POST',`/api/warehouse/transport-handovers/${o.id}`,{run:1,signedPaperConfirmed:true,handoverToken:doc1.handoverToken},wh)).handover;
  assert.equal(hand.driverName,'راننده');assert.equal(hand.document.warehouseDocumentNo,doc1.warehouseDocumentNo);
  assert.equal((await call('POST',`/api/transport/plans/${o.id}/assign`,{run:1,driverId:driver2.id,vehicleId:vehicle2.id},transport)).status,409);
  assert.equal((await call('POST',`/api/orders/${o.id}/store-run/weights`,{run:1,items:[{itemId:o.items[0].id,deliveredKg:1}]},wh)).status,409);
  assert.equal((await call('POST',`/api/orders/${o.id}/store-run/send-run`,{run:1},wh)).status,409);
  assert.equal((await call('PUT',`/api/transport/drivers/${driver.id}`,{isActive:false},transport)).status,409);
  assert.equal((await call('PUT',`/api/transport/vehicles/${vehicle.id}`,{isActive:false},transport)).status,409);
  assert.equal((await call('PUT',`/api/drivers/${driver.id}`,{isActive:false},transport)).status,409);
  assert.equal((await call('DELETE',`/api/drivers/${driver.id}`,{},admin)).status,409);
  assert.equal((await call('PUT',`/api/admin/transport-vehicles/${vehicle.id}`,{isActive:false},admin)).status,409);
  assert.equal((await call('POST',`/api/orders/${o.id}/return-sales`,{},wh)).status,409);
  assert.equal((await call('POST',`/api/orders/${o.id}/store-run/finalize-day`,{},wh)).status,409);
  await ok('PUT',`/api/transport/drivers/${driver.id}`,{fullName:'نام جدید راننده'},transport);
  assert.equal((await ok('GET',`/api/warehouse/store-documents/${o.id}/1`,null,wh)).document.driverName,'راننده');
  assert.equal((await ok('GET',`/api/warehouse/delivered/${third.id}`,null,wh)).order.driverName,'راننده');
  assert.equal((await ok('GET',`/api/warehouse/store-documents/${o.id}/2`,null,wh)).document.driverName,'راننده دوم');
  assert.equal((await ok('GET',`/api/orders/${o.id}`,null,sales)).order.payments.length,0);
  const stopped=new Promise(resolve=>proc.once('exit',resolve));proc.kill('SIGTERM');await stopped;proc=start();await ready();
  const whAgain=(await call('POST','/api/login',{username:'plan-wh',password:pass})).cookie;
  const persisted=(await ok('GET',`/api/warehouse/store-documents/${o.id}/1`,null,whAgain)).document;
  assert.equal(persisted.driverName,'راننده');assert.equal(persisted.warehouseDocumentNo,doc1.warehouseDocumentNo);assert.equal(persisted.lines[0].deliveredKg,1);
  assert.equal((await ok('GET',`/api/warehouse/delivered/${third.id}`,null,whAgain)).order.warehouseDocumentNo,doc.warehouseDocumentNo);


 }finally{if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
