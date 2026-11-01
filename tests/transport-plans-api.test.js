'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
test('ارسال برنامه‌ریزی ترابری مستقل از انبار، دسترسی، زمان‌بندی و تفکیک فروشگاه',{timeout:90000},async()=>{
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-plan-')),base=`http://127.0.0.1:${port}`,pass='Changed!2345';
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345',BT_EXPERIMENTAL_TRANSPORT_WORKFLOW:'1'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve()}});proc.once('exit',c=>reject(Error('exit '+c)));});
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
  for(const run of [1,2])assert.equal((await ok('POST',`/api/transport/plans/${o.id}/assign`,{run,driverId:driver.id,vehicleId:vehicle.id},transport)).assignment.driverName,'راننده');
 }finally{if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
