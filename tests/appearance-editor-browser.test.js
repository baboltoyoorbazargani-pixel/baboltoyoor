'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const exe=process.env.BT_CHROMIUM_PATH;
test('مدیر پیش‌نویس را می‌بیند، سپس منتشر و بازگردانی می‌کند؛ کاربران دیگر حق ویرایش ندارند',{skip:!exe,timeout:90000},async()=>{
 const {chromium}=require('playwright-core'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-design-browser-'));
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});const base=`http://127.0.0.1:${port}`;
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'},stdio:['ignore','pipe','inherit']});let browser;
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(timer);resolve();}});proc.once('exit',c=>reject(Error('exit '+c)));});
  browser=await chromium.launch({executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage']});const admin=await browser.newContext(),sales=await browser.newContext();
  const post=async(ctx,url,data)=>{const r=await ctx.request.post(base+url,{data});assert.ok(r.ok(),url+' '+r.status()+' '+await r.text());return r.json();};
  await post(admin,'/api/login',{username:'admin',password:'Initial!2345'});await post(admin,'/api/account/password',{currentPassword:'Initial!2345',newPassword:'Changed!2345'});await post(admin,'/api/admin/users',{username:'sales1',roleCode:'sales',fullName:'فروش',position:'فروش',password:'Changed!2345',mustChangePassword:false});await post(sales,'/api/login',{username:'sales1',password:'Changed!2345'});
  const a=await admin.newPage(),s=await sales.newPage(),errors=[];a.on('pageerror',e=>errors.push(e.message));s.on('pageerror',e=>errors.push(e.message));await a.goto(base,{waitUntil:'networkidle'});await s.goto(base,{waitUntil:'networkidle'});
  await a.locator('#railNav [data-page=appearance]').click();await a.locator('#appearanceTarget').waitFor();assert.equal(await s.locator('#railNav [data-page=appearance]').count(),0);
  const initial=await s.locator('#appView .rail').evaluate(e=>getComputedStyle(e).backgroundColor);
  await a.locator('#appearanceFontFamily').selectOption('tahoma');assert.match(await a.locator('#appearanceSample').evaluate(e=>getComputedStyle(e).fontFamily),/Tahoma/);
  await a.locator('#appearanceTarget').selectOption('warehouseTable');assert.equal(await a.locator('#appearanceColor').isVisible(),false);await a.locator('#appearanceBackground').fill('#000000');await a.getByText('برای چاپ، رنگ سرستون باید روشن باشد تا متن حتی بدون چاپ پس‌زمینه خوانا بماند.').waitFor();await a.locator('#appearanceBackground').fill('#eeffee');await a.locator('#appearanceFontSize').fill('12');await a.locator('#appearanceFontFamily').selectOption('tahoma');
  await a.locator('#appearanceTarget').selectOption('navigation');
  await a.locator('#appearanceBackground').fill('#123456');assert.equal(await a.locator('#appearanceSample').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(18, 52, 86)');
  await a.locator('#appearanceSave').click();await a.getByText('پیش‌نویس ذخیره شد؛ هنوز برای کاربران منتشر نشده است.').waitFor();await s.evaluate(()=>window.BTAppearance.refresh());assert.equal(await s.locator('#appView .rail').evaluate(e=>getComputedStyle(e).backgroundColor),initial);
  a.once('dialog',d=>d.accept());await a.locator('#appearancePublish').click();await a.getByText('طرح منتشر شد؛ کاربران پس از تازه‌سازی، حداکثر تا چند ثانیه آن را می‌بینند.').waitFor();await s.evaluate(()=>window.BTAppearance.refresh());assert.equal(await s.locator('#appView .rail').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(18, 52, 86)');assert.equal(await s.evaluate(()=>window.BTAppearance.latest.settings.print.warehouseTable.background),'#eeffee');assert.match(await s.locator('#appView .rail .nav-label').first().evaluate(e=>getComputedStyle(e).fontFamily),/Tahoma/);
  await s.reload({waitUntil:'networkidle'});await s.evaluate(()=>window.BTAppearance.refresh());assert.equal(await s.locator('#appView .rail').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(18, 52, 86)');
  a.once('dialog',d=>d.accept());await a.locator('#appearanceRestore').click();await a.getByText('طرح قبلی بازگردانده شد.').waitFor();await s.evaluate(()=>window.BTAppearance.refresh());assert.equal(await s.locator('#appView .rail').evaluate(e=>getComputedStyle(e).backgroundColor),initial);
  for(const width of [320,390,768,1280]){await a.setViewportSize({width,height:850});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'page overflow '+width);}
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
