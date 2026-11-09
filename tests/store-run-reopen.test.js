'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
test('بازگشت تکمیل اشتباهی پیش و پس از پایان خودکار، بدون تغییر محموله‌ها',{timeout:90000},async()=>{
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});}),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-reopen-')),base=`http://127.0.0.1:${port}`,pass='Changed!2345';
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve();}});proc.once('exit',c=>reject(Error('exit '+c)));});
 const call=async(method,url,body,cookie)=>{const r=await fetch(base+url,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json(),cookie:(r.headers.get('set-cookie')||'').split(';')[0]};};
 const ok=async(method,url,body,cookie)=>{const r=await call(method,url,body,cookie);assert(r.status>=200&&r.status<300,url+' '+r.status+' '+JSON.stringify(r.data));return r.data;};
 const admin=(await call('POST','/api/login',{username:'admin',password:'Initial!2345'})).cookie;await ok('POST','/api/account/password',{currentPassword:'Initial!2345',newPassword:pass},admin);
 for(const [username,roleCode,extra] of [['rsales','sales',{}],['rwh','warehouse',{}],['rstore','store',{storeName:'شعبه ۱ حمزه کلا'}]])await ok('POST','/api/admin/users',{username,roleCode,fullName:username,position:'تست',password:pass,mustChangePassword:false,...extra},admin);
 const login=async username=>(await call('POST','/api/login',{username,password:pass})).cookie,sales=await login('rsales'),wh=await login('rwh'),shop=await login('rstore');
 const items=[{productId:'p01',requestedQty:10,requestedUnit:'کیلوگرم'},{productId:'p02',requestedQty:10,requestedUnit:'کیلوگرم'}];
 async function order(extra={}){const o=(await ok('POST','/api/store/orders',{items,...extra},shop)).order;await ok('POST',`/api/store/orders/${o.id}/quick-send`,{},sales);await ok('POST',`/api/orders/${o.id}/warehouse/accept`,{},wh);await ok('POST',`/api/orders/${o.id}/warehouse/start-preparing`,{},wh);return o;}
 const o=await order(),[a,b]=o.items.map(x=>x.id),url=`/api/orders/${o.id}/store-run/`;
 const post=(action,body)=>ok('POST',url+action,body,wh),weight=(id,run,kg)=>post('weights',{run,items:[{itemId:id,deliveredKg:kg}]});
 await weight(a,1,2);await post('complete',{itemId:a});assert.equal((await call('POST',url+'reopen-item',{itemId:a},sales)).status,403);
 let res=await post('reopen-item',{itemId:a});assert.equal(res.run,1);assert.equal(res.order.items.find(i=>i.id===a).runR1.length,1);
 await weight(a,1,1);await post('complete',{itemId:a});await post('send-run',{run:1});
 let before=(await ok('GET',`/api/orders/${o.id}`,null,sales)).order,shipment1=JSON.stringify(before.storeRunOps.r1Shipment);assert.equal(before.storeRunOps.finalizedAt,undefined);
 res=await post('reopen-item',{itemId:a});assert.equal(res.run,2);assert.equal(JSON.stringify(res.order.storeRunOps.r1Shipment),shipment1);assert(res.order.items.find(i=>i.id===a).movedToR2);
 await weight(a,2,2);await post('complete',{itemId:a});await post('send-run',{run:2});assert.equal((await call('POST',url+'reopen-item',{itemId:a},wh)).status,409);
 await weight(b,1,1);await post('complete',{itemId:b});await post('send-run',{run:1});
 before=(await ok('GET',`/api/orders/${o.id}`,null,sales)).order;assert(before.storeRunOps.finalizedAt);shipment1=JSON.stringify(before.storeRunOps.r1Shipment);const shipment2=JSON.stringify(before.storeRunOps.r2Shipment),document1=before.storeRunOps.r1Shipment.warehouseDocumentNo;
 const day=x=>new Date(Date.now()+x*86400000).toISOString().slice(0,10);const history=(await ok('GET',`/api/warehouse/history?from=${day(-1)}&to=${day(1)}`,null,wh)).rows.find(x=>x.id===o.id);assert.equal(history.items.find(i=>i.itemId===b).reopenRun,2);assert.equal(history.items.find(i=>i.itemId===a).reopenRun,null);
 res=await post('reopen-item',{itemId:b});assert.equal(res.run,2);assert.equal(res.order.storeRunOps.finalizedAt,null);assert.equal(res.order.warehouseCompletedAt,null);assert.equal(JSON.stringify(res.order.storeRunOps.r1Shipment),shipment1);assert.equal(JSON.stringify(res.order.storeRunOps.r2Shipment),shipment2);assert.equal(res.order.storeRunOps.r1Shipment.warehouseDocumentNo,document1);
 await weight(b,2,1);await post('complete',{itemId:b});await post('send-run',{run:2});const end=(await ok('GET',`/api/orders/${o.id}`,null,sales)).order;assert(end.storeRunOps.finalizedAt);assert.equal(JSON.stringify(end.storeRunOps.r1Shipment),shipment1);assert.equal(end.storeRunOps.r2Shipment.weights[a],2);assert.equal(end.storeRunOps.r2Shipment.weights[b],1);assert.equal((await call('POST',url+'reopen-item',{itemId:b},wh)).status,409);
 // Service 1 physically handed over: its signed document and trip stay intact
 // and returning its documents cannot close the order while reopened service 2 is pending.
 const actual=await order({items:[items[0]]}),ai=actual.items[0].id,au=`/api/orders/${actual.id}/store-run/`;
 await ok('POST',au+'weights',{run:1,items:[{itemId:ai,deliveredKg:2}]},wh);await ok('POST',au+'complete',{itemId:ai},wh);await ok('POST',au+'send-run',{run:1},wh);
 const driver=(await ok('POST','/api/transport/drivers',{fullName:'راننده تست بازگشت',phone:'09121113344'},admin)).driver,vehicle=(await ok('POST','/api/transport/vehicles',{vehicleType:'وانت',plate:'23ب45678'},admin)).vehicle;
 await ok('POST',`/api/transport/plans/${actual.id}/assign`,{run:1,driverId:driver.id,vehicleId:vehicle.id},admin);
 const doc=(await ok('GET',`/api/warehouse/store-documents/${actual.id}/1`,null,wh)).document;
 await ok('POST',`/api/warehouse/transport-handovers/${actual.id}`,{run:1,physicalHandoverConfirmed:true,handoverToken:doc.handoverToken},wh);await ok('POST',`/api/transport/store-shipments/${actual.id}/1/depart`,{departureConfirmed:true},admin);
 assert.equal((await ok('POST',au+'reopen-item',{itemId:ai},wh)).run,2);
 const docAfter=(await ok('GET',`/api/warehouse/store-documents/${actual.id}/1`,null,wh)).document;assert.deepEqual(docAfter.lines,doc.lines);assert.equal(docAfter.warehouseDocumentNo,doc.warehouseDocumentNo);assert.equal(docAfter.driverName,doc.driverName);
 await ok('POST',`/api/store/orders/${actual.id}/confirm-receipt`,{run:1},shop);const returned=await ok('POST',`/api/sales/store-transport/${actual.id}/1/return`,{documentsReturned:true},sales);assert.equal(returned.orderClosed,false);
 const still=(await ok('GET',`/api/orders/${actual.id}`,null,sales)).order;assert.equal(still.status,'WAREHOUSE_PREPARING');assert.equal(still.transportStoreTrips['1'].warehouseDocumentNo,doc.warehouseDocumentNo);assert.equal(still.storeRunOps.finalizedAt,null);
 // Partial orders retain their single-service rule and sent weights cannot be reopened.
 const partial=await order({storeOrderKind:'PARTIAL',storePurpose:'STOCK'}),p=partial.items[0].id,p2=partial.items[1].id,pu=`/api/orders/${partial.id}/store-run/`;await ok('POST',pu+'weights',{run:1,items:[{itemId:p,deliveredKg:1}]},wh);await ok('POST',pu+'complete',{itemId:p},wh);assert.equal((await ok('POST',pu+'reopen-item',{itemId:p},wh)).run,1);await ok('POST',pu+'complete',{itemId:p},wh);await ok('POST',pu+'out-of-stock',{itemId:p2},wh);await ok('POST',pu+'send-run',{run:1},wh);assert.equal((await call('POST',pu+'reopen-item',{itemId:p},wh)).status,409);
 // A daily order with all products unavailable must not need the removed button.
 const empty=await order();for(const i of empty.items)await ok('POST',`/api/orders/${empty.id}/store-run/out-of-stock`,{itemId:i.id},wh);const ended=(await ok('GET',`/api/orders/${empty.id}`,null,sales)).order;assert.equal(ended.status,'OUT_OF_STOCK');assert(ended.warehouseCompletedAt);assert(!ended.storeRunOps.r1Shipment);assert(!ended.storeRunOps.r2Shipment);
 }finally{if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
