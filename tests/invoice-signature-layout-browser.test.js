'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const executablePath=process.env.BT_CHROMIUM_PATH;
test('مرورگر: ارتفاع یکسان کادر امضاء و مبالغ، متن پایین و وسط در پیش‌نمایش و چاپ', {skip:!executablePath,timeout:90000}, async()=>{
 const {chromium}=require('playwright-core');const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-invoice-layout-')),base=`http://127.0.0.1:${port}`;
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'},stdio:['ignore','pipe','pipe']});let browser;
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve();}});proc.once('exit',c=>reject(Error('server exit '+c)));});
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  let res=await ctx.request.post(base+'/api/login',{data:{username:'admin',password:'Initial!2345'}});assert.equal(res.status(),200);res=await ctx.request.post(base+'/api/account/password',{data:{currentPassword:'Initial!2345',newPassword:'Changed!2345'}});assert.equal(res.status(),200);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/',{waitUntil:'networkidle'});
  let store=false;
  const order=()=>({id:'o',orderNo:'000123',orderType:store?'STORE':'REMOTE',storeName:'فروشگاه شعبه 1 حمزه کلا',customer:{name:'نام مشتری',phone:'09121234567'},items:[{id:'i',product:{name:'محصول'},deliveredKg:5,unitPrice:2000,finalAmount:10000}],payment:{invoiceNumber:'000001',totalAmount:10000,discountAmount:200,additionsAmount:200,customerName:'نام مشتری',customerPhone:'09121234567',deposit:{type:'CASH',amount:1000},depositAmount:1000,amountDue:9000,deliveryRun:store?1:null,priceLines:store?[{productName:'محصول',deliveredKg:5}]:undefined}});
  await ctx.route('**/api/orders/o',route=>route.fulfill({json:{order:order()}}));
  const check=async(p,scope)=>{
   const sheet=p.locator(scope),box=sheet.locator('.inv38-verify-box');await box.waitFor();
   assert.equal(await sheet.locator('.inv38-foot').count(),0);assert.doesNotMatch(await sheet.innerText(),/[0-9٠-٩]/);assert.equal(await sheet.locator('.inv38-brand img').getAttribute('src'),'/logo.png');
   assert.equal(await box.locator('span').innerText(),'امضاء');assert.equal(await box.locator('strong').innerText(),'نام مشتری – ۰۹۱۲۱۲۳۴۵۶۷');
   const geometry=await sheet.evaluate(e=>{const r=x=>{const q=e.querySelector(x).getBoundingClientRect();return {top:q.top,bottom:q.bottom,left:q.left,right:q.right,height:q.height};};return{tot:r('.inv38-total-box'),box:r('.inv38-verify-box'),title:r('.inv38-vitem span'),text:r('.inv38-vitem strong')};});
   assert.ok(Math.abs(geometry.tot.height-geometry.box.height)<=1,JSON.stringify(geometry));
   for(const el of [geometry.title,geometry.text])assert.ok(Math.abs((el.left+el.right-geometry.box.left-geometry.box.right)/2)<=1.5,JSON.stringify(geometry));
   assert.ok(geometry.text.bottom<=geometry.box.bottom && geometry.box.bottom-geometry.text.bottom<20,JSON.stringify(geometry));
   assert.ok(geometry.title.top>geometry.box.top+10,JSON.stringify(geometry));
  };
  for(const isStore of [false,true]){
   store=isStore;await page.evaluate(()=>previewInvoice('o',null));await page.locator('#modal.open .inv38-sheet').waitFor();
   for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:900});await check(page,'#modal .inv38-sheet');}
   let opened=0;const countPopup=()=>opened++;page.on('popup',countPopup);const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('#modal [data-action=print-invoice]').click()]);await popup.locator('.inv38-sheet').waitFor();await popup.waitForFunction(()=>document.readyState==='complete' && getComputedStyle(document.querySelector('.inv38-bottom')).display==='grid',null,{timeout:8000});await popup.locator('.bt-print-tools button').waitFor();await popup.emulateMedia({media:'print'});await check(popup,'.inv38-sheet');const pdf=await popup.pdf({format:'A4',printBackground:true});assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);await popup.close();assert.equal(opened,1,'چاپ از پیش‌نمایش فقط یک پنجره باز می‌کند');page.off('popup',countPopup);await page.evaluate(()=>closeModal());
  }
  let popupCount=0;page.on('popup',()=>popupCount++);await page.evaluate(()=>printInvoice('o',2));assert.match(await page.locator('#toast').innerText(),/سند این سرویس هنوز صادر نشده است/);assert.equal(popupCount,0);
  const empty=await ctx.newPage();await empty.goto(base+'/invoice-print.html');assert.match(await empty.locator('#invoice-print-message').innerText(),/اطلاعات فاکتور موجود نیست/);assert.equal(await empty.locator('.bt-print-tools').count(),0);await empty.close();
  assert.deepEqual(errors,[]);await ctx.close();
 }finally{if(browser)await browser.close();if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
