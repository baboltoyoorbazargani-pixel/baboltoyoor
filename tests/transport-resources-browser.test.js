'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const executablePath=process.env.BT_CHROMIUM_PATH;
test('فهرست مشترک راننده و خودرو: ترابری ویرایش می‌کند، فروش و انبار فقط مشاهده',{skip:!executablePath,timeout:90000},async()=>{
 const {chromium}=require('playwright-core');const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-transport-res-')),base=`http://127.0.0.1:${port}`;
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'},stdio:['ignore','pipe','pipe']});let browser;
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve();}});proc.once('exit',c=>reject(Error('server exit '+c)));});
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});const admin=await browser.newContext(),transport=await browser.newContext(),sales=await browser.newContext(),wh=await browser.newContext(),store=await browser.newContext();
  const post=async(ctx,url,data)=>{const r=await ctx.request.post(base+url,{data});assert(r.ok(),url+' '+r.status()+' '+await r.text());return r.json();};
  await post(admin,'/api/login',{username:'admin',password:'Initial!2345'});await post(admin,'/api/account/password',{currentPassword:'Initial!2345',newPassword:'Changed!2345'});
  for(const [username,roleCode,extra] of [['t-res','dispatch',{}],['s-res','sales',{}],['w-res','warehouse',{}],['st-res','store',{storeName:'فروشگاه تست'}]])await post(admin,'/api/admin/users',{username,roleCode,fullName:username,position:'تست',password:'Changed!2345',mustChangePassword:false,...extra});
  for(const [ctx,username] of [[transport,'t-res'],[sales,'s-res'],[wh,'w-res'],[store,'st-res']])await post(ctx,'/api/login',{username,password:'Changed!2345'});
  const vehicle=(await post(transport,'/api/transport/vehicles',{vehicleType:'وانت',plate:'12ب34567'})).vehicle;
  const dup=await transport.request.post(base+'/api/transport/vehicles',{data:{vehicleType:'وانت',plate:'12ب34567'}});assert.equal(dup.status(),409);
  for(const ctx of [sales,wh,store])assert.equal((await ctx.request.post(base+'/api/transport/drivers',{data:{fullName:'ممنوع',phone:'09121112233'}})).status(),403);
  assert.equal((await store.request.get(base+'/api/transport/resources')).status(),403);
  const page=await transport.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/',{waitUntil:'networkidle'});await page.locator('#railNav [data-cartable=transport-resources]').click();await page.locator('[data-trc=new-driver]').click();const form=page.locator('#trcDriverForm');await form.locator('[name=fullName]').fill('راننده مستقل');await form.locator('[name=phone]').fill('09121112233');await form.locator('[type=submit]').click();await page.getByText('راننده مستقل').waitFor();assert.match(await page.locator('.trc-page').innerText(),/وانت/);
  const users=await (await admin.request.get(base+'/api/admin/users')).json();assert(!users.users.some(u=>u.roleCode==='driver'));
  for(const ctx of [sales,wh]){const p=await ctx.newPage({viewport:{width:320,height:900}});await p.goto(base+'/',{waitUntil:'networkidle'});await p.locator('#railNav [data-cartable=transport-resources]').click();await p.getByText('راننده مستقل').waitFor();assert.match(await p.locator('.trc-page').innerText(),/وانت/);assert.equal(await p.locator('[data-trc]').count(),0);const size=await p.locator('.trc-page').evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));assert(size.scroll<=size.client+1,JSON.stringify(size));await p.close();}
  const listing=await (await transport.request.get(base+'/api/transport/resources')).json();assert.equal(listing.drivers.length,1);assert.equal(listing.vehicles[0].id,vehicle.id);assert.equal((await transport.request.put(base+'/api/transport/drivers/'+listing.drivers[0].id,{data:{isActive:'false'}})).status(),400);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
