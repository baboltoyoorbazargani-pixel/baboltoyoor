'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const executablePath=process.env.BT_CHROMIUM_PATH;
test('مرورگر: یک کارتابل ترابری، منابع مستقل و تخصیص واقعی بدون حساب راننده',{skip:!executablePath,timeout:90000},async()=>{
 const {chromium}=require('playwright-core');const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-desk-')),base=`http://127.0.0.1:${port}`;
 const env={...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'};delete env.BT_EXPERIMENTAL_TRANSPORT_WORKFLOW;
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env,stdio:['ignore','pipe','pipe']});let browser;
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve();}});proc.once('exit',c=>reject(Error('server exit '+c)));});
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});const admin=await browser.newContext(),sales=await browser.newContext(),transport=await browser.newContext({viewport:{width:1280,height:900}});
  const post=async(ctx,url,data)=>{const r=await ctx.request.post(base+url,{data});assert(r.ok(),url+' '+r.status()+' '+await r.text());return r.json();};
  await post(admin,'/api/login',{username:'admin',password:'Initial!2345'});await post(admin,'/api/account/password',{currentPassword:'Initial!2345',newPassword:'Changed!2345'});
  for(const [username,roleCode] of [['sale1','sales'],['dispatch1','dispatch']])await post(admin,'/api/admin/users',{username,roleCode,fullName:username,position:'تست',password:'Changed!2345',mustChangePassword:false});
  await post(sales,'/api/login',{username:'sale1',password:'Changed!2345'});await post(transport,'/api/login',{username:'dispatch1',password:'Changed!2345'});
  const driver=(await post(transport,'/api/transport/drivers',{fullName:'راننده مستقل',phone:'09121112233'})).driver,vehicle=(await post(transport,'/api/transport/vehicles',{vehicleType:'وانت',plate:'12ب34567'})).vehicle;
  const day=new Date(),date=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
  const order=(await post(sales,'/api/orders/remote',{name:'مشتری کارتابل',phone:'09121112234',dispatchPlace:'بابل',scheduledDate:date,scheduledTime:'00:00',deliveryMode:'DELIVERY',items:[{productId:'p01',requestedQty:4,requestedUnit:'کیلوگرم'}]})).order;
  const page=await transport.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#railNav [data-cartable=transport-resources]').count(),1);assert.equal(await page.locator('#railNav [data-cartable=drivers]').count(),0);
  const dash=page.locator('[data-dash-role=dispatch]');await dash.waitFor();assert.equal((await dash.locator('.role-dash-card').filter({hasText:'رانندگان فعال'}).locator('strong').innerText()).trim(),'۱');assert.equal((await dash.locator('.role-dash-card').filter({hasText:'سفارش‌های در برنامه'}).locator('strong').innerText()).trim(),'۱');
  await dash.locator('[data-cartable=transport-resources]').click();await page.locator('#content').getByText('راننده مستقل').first().waitFor();
  await page.locator('#railNav [data-cartable=orders]').click();await page.locator('#transportPlans .dsp-card').filter({hasText:'مشتری کارتابل'}).waitFor();
  assert.equal(await page.locator('#transportPlans .dsp-card').filter({hasText:'مشتری کارتابل'}).count(),1);assert.equal(await page.locator('[data-legacy-dispatch]').count(),0);
  await page.locator(`#transportPlans [data-tp=details][data-id="${order.id}"]`).click();await page.locator('#tpAssign').waitFor();
  await page.locator('#tpAssign select[name=driverId]').selectOption(driver.id);await page.locator('#tpAssign select[name=vehicleId]').selectOption(vehicle.id);await page.locator('#tpAssign button[type=submit]').click();
  await page.locator('#transportPlans .dsp-card').filter({hasText:'راننده مستقل'}).waitFor();
  const response=await sales.request.get(base+`/api/orders/${order.id}`),data=await response.json();assert.equal(data.order.transportAssignments['0'].driverId,driver.id);assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
