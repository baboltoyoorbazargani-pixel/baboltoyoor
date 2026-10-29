'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const executablePath=process.env.BT_CHROMIUM_PATH;
test('مرورگر: Insert در سفارش غیرحضوری قلم بعدی را باز می‌کند و ثبت فقط با دکمه انجام می‌شود', {skip:!executablePath,timeout:75000},async()=>{
 const {chromium}=require('playwright-core');const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-phone-enter-')),base=`http://127.0.0.1:${port}`;let browser;
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve();}});proc.once('exit',c=>reject(Error('exit '+c)));});
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});const ctx=await browser.newContext({viewport:{width:390,height:850}}),page=await ctx.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/orders/remote'))writes.push(r);});
  const post=async(url,data)=>{const r=await ctx.request.post(base+url,{data});assert.ok(r.ok(),`${url}: ${r.status()} ${await r.text()}`);return r.json();};
  await post('/api/login',{username:'admin',password:'Initial!2345'});await post('/api/account/password',{currentPassword:'Initial!2345',newPassword:'Changed!2345'});
  await page.goto(base+'/',{waitUntil:'networkidle'});await page.evaluate(()=>go('sales','remote'));const form=page.locator('#phoneOrderFormV25');await form.waitFor();
  await form.locator('[name=name]').fill('مشتری تست');await form.locator('[name=name]').press('Enter');await form.locator('[name=phone]').fill('09121112233');await form.locator('[name=phone]').press('Enter');await form.locator('[name=dispatchPlace]').fill('بابل');await form.locator('[name=dispatchPlace]').press('Enter');
  const qty0=form.locator('[data-op-qty="phone-0"]');await qty0.fill('2');await qty0.press('Insert');assert.equal(await form.locator('[data-op-product-search]').count(),1,'no new line without selected product');
  const search0=form.locator('[data-op-product-search="phone-0"]');await search0.fill('01');await form.locator('[data-op-suggest="phone-0"] button').first().waitFor();await search0.press('ArrowDown');await search0.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.dataset.opQty),'phone-0');
  await qty0.fill('');await qty0.press('Insert');assert.equal(await form.locator('[data-op-product-search]').count(),1,'no new line with empty quantity');
  await qty0.fill('۲');await form.locator('[data-op-unit="phone-0"]').selectOption({label:'بسته'});await form.locator('[data-op-desc="phone-0"]').fill('ردیف نخست');await form.locator('[data-op-desc="phone-0"]').press('Enter');
  await qty0.press('Enter');assert.equal(await form.locator('[data-op-product-search]').count(),1,'Enter does not add a row');assert.equal(writes.length,0);
  await qty0.press('Insert');assert.equal(await form.locator('[data-op-product-search]').count(),2);assert.equal(await page.evaluate(()=>document.activeElement.dataset.opProductSearch),'phone-1');
  assert.equal(await form.locator('[data-op-qty="phone-0"]').inputValue(),'۲');assert.equal(await form.locator('[data-op-unit="phone-0"]').inputValue(),'بسته');assert.equal(await form.locator('[data-op-desc="phone-0"]').inputValue(),'ردیف نخست');
  await form.locator('[data-op-qty="phone-0"]').press('Insert');assert.equal(await form.locator('[data-op-product-search]').count(),2,'reusing existing next row');assert.equal(await page.evaluate(()=>document.activeElement.dataset.opProductSearch),'phone-1');
  const search1=form.locator('[data-op-product-search="phone-1"]');await search1.fill('01');await form.locator('[data-op-suggest="phone-1"] button').first().waitFor();await search1.press('ArrowDown');await search1.press('Enter');await form.locator('[data-op-qty="phone-1"]').fill('3');
  await form.locator('[data-op-qty="phone-1"]').press('Insert');assert.equal(await form.locator('[data-op-product-search]').count(),3);assert.equal(await page.evaluate(()=>document.activeElement.dataset.opProductSearch),'phone-2');
  await form.locator('[data-action="op-remove-line"][data-index="2"]').click();assert.equal(await form.locator('[data-op-product-search]').count(),2);
  await form.locator('[data-action="phone-add-line"]').click();assert.equal(await form.locator('[data-op-product-search]').count(),3,'manual add remains available');await form.locator('[data-action="op-remove-line"][data-index="2"]').click();
  await form.locator('[data-deposit-toggle]').click();await form.locator('[data-deposit-amount]').fill('1000');await form.locator('[data-deposit-amount]').press('Enter');
  const notes=form.locator('[name=notes]');await notes.fill('سطر اول');await notes.press('End');await notes.press('Enter');await notes.type('سطر دوم');assert.equal(await notes.inputValue(),'سطر اول\nسطر دوم');
  await form.locator('[type=submit]').focus();await page.keyboard.press('Enter');await page.waitForTimeout(200);assert.equal(writes.length,0,'Enter must not send any order, including when submit is focused');
  const request=page.waitForResponse(r=>r.url().endsWith('/api/orders/remote')&&r.request().method()==='POST');await form.locator('[type=submit]').click();const res=await request;assert.equal(res.status(),201,await res.text());const order=(await res.json()).order;assert.equal(writes.length,1);assert.equal(order.items.length,2);assert.equal(order.items[0].requestedQty,2);assert.equal(order.items[0].requestedUnit,'بسته');assert.equal(order.items[0].description,'ردیف نخست');assert.equal(order.items[1].requestedQty,3);assert.equal(order.deposit.amount,1000);assert.equal(order.notes,'سطر اول\nسطر دوم');assert.deepEqual(errors,[]);
  await ctx.close();
 }finally{if(browser)await browser.close();if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
