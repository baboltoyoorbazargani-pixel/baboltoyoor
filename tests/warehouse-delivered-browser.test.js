'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const executablePath=process.env.BT_CHROMIUM_PATH;
test('انبار: وزن نهایی، سوابق فقط خواندنی، جزئیات و چاپ سند بدون مبلغ',{skip:!executablePath,timeout:90000},async()=>{
 const {chromium}=require('playwright-core');const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-wh-delivered-')),base=`http://127.0.0.1:${port}`;
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'},stdio:['ignore','pipe','pipe']});let browser;
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve();}});proc.once('exit',c=>reject(Error('server exit '+c)));});
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});const admin=await browser.newContext(),wh=await browser.newContext({viewport:{width:1280,height:900}}),sales=await browser.newContext();
  await wh.addInitScript(()=>{if(window!==window.top)window.print=()=>{window.parent.__prints=(window.parent.__prints||0)+1;};});
  const post=async(ctx,url,data)=>{const r=await ctx.request.post(base+url,{data});assert(r.ok(),url+' '+r.status()+' '+await r.text());return r.json();};
  const get=async(ctx,url)=>ctx.request.get(base+url);
  await post(admin,'/api/login',{username:'admin',password:'Initial!2345'});await post(admin,'/api/account/password',{currentPassword:'Initial!2345',newPassword:'Changed!2345'});
  for(const [username,roleCode] of [['wh1','warehouse'],['sale1','sales']])await post(admin,'/api/admin/users',{username,roleCode,fullName:username,position:'تست',password:'Changed!2345',mustChangePassword:false});
  await post(wh,'/api/login',{username:'wh1',password:'Changed!2345'});await post(sales,'/api/login',{username:'sale1',password:'Changed!2345'});
  const day=new Date(),date=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
  const o=(await post(sales,'/api/orders/remote',{name:'مشتری سند انبار',phone:'09121112233',dispatchPlace:'بابل',scheduledDate:date,scheduledAt:date+'T00:00',items:[{productId:'p01',requestedQty:4,requestedUnit:'کیلوگرم',description:'قلم اول <تست>'},{productId:'p02',requestedQty:3,requestedUnit:'عدد'}]})).order;
  assert.equal((await get(wh,`/api/warehouse/delivered/${o.id}`)).status(),404);
  await post(wh,`/api/orders/${o.id}/warehouse/accept`,{});await post(wh,`/api/orders/${o.id}/warehouse/start-preparing`,{});
  await post(wh,`/api/orders/${o.id}/warehouse`,{items:[{itemId:o.items[0].id,deliveredKg:2.5},{itemId:o.items[1].id,outOfStock:true}]});
  assert.equal((await get(wh,`/api/orders/${o.id}`)).status(),403);assert.equal((await get(sales,`/api/warehouse/delivered/${o.id}`)).status(),403);
  let r=await get(wh,'/api/warehouse/delivered?q='+encodeURIComponent(o.orderNo.replace(/[0-9]/g,c=>'۰۱۲۳۴۵۶۷۸۹'[+c]))),data=await r.json();assert.equal(data.total,1);assert.equal(data.orders[0].id,o.id);assert.equal(data.orders[0].deliveredKg,2.5);
  r=await get(wh,`/api/warehouse/delivered/${o.id}`);data=await r.json();assert.equal(data.order.items[0].deliveredKg,2.5);assert.equal(data.order.items[1].outOfStock,true);assert(!JSON.stringify(data).includes('unitPrice'));
  const page=await wh.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/',{waitUntil:'networkidle'});
  const rail=page.locator('#railNav');await rail.locator('[data-cartable=delivered]').waitFor();const order=await rail.locator('[data-cartable]').evaluateAll(es=>es.map(e=>e.dataset.cartable));assert.equal(order.indexOf('delivered'),order.indexOf('preparing')+1);
  await rail.locator('[data-cartable=delivered]').click();const row=page.locator(`[data-action=wh-delivered-details][data-id="${o.id}"]`);await row.waitFor();await row.click();const modal=page.locator('#modal.open');await modal.locator('.whd-doc').waitFor();let text=await modal.innerText();assert.match(text,/مشتری سند انبار/);assert.match(text,/۲٫۵|۲\.۵/);assert.match(text,/ناموجود/);assert.match(text,/قلم اول <تست>/);assert.doesNotMatch(text,/قیمت|ریال|تومان/);
  for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:900});const box=await modal.locator('.whd-table-scroll').evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth,parent:e.parentElement.scrollWidth,parentClient:e.parentElement.clientWidth}));assert(box.parent<=box.parentClient+1,JSON.stringify(box));}
  await modal.locator('[data-wh-delivered-print]').click();await page.waitForFunction(()=>window.__prints===1);const frame=page.frameLocator('iframe[title="سند آماده چاپ"]');await frame.locator('.whd-doc').waitFor();text=await frame.locator('.whd-doc').innerText();assert.match(text,/سند وزن انبار بابل طیور/);assert.match(text,/ناموجود/);assert.doesNotMatch(text,/[0-9٠-٩]/);assert.doesNotMatch(text,/قیمت|ریال|تومان/);
  const html=await page.locator('iframe[title="سند آماده چاپ"]').evaluate(el=>{const d=el.contentDocument.cloneNode(true);d.querySelectorAll('script').forEach(s=>s.remove());return d.documentElement.outerHTML;});const proof=await wh.newPage();await proof.setContent(html);await proof.emulateMedia({media:'print'});const pdf=await proof.pdf({format:'A4',printBackground:true});assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);await proof.close();
  await page.locator('iframe[title="سند آماده چاپ"]').evaluate(el=>el.contentWindow.dispatchEvent(new Event('afterprint')));await page.locator('#modal .modal-close').click();
  // Reopening withdraws the old document; re-finalizing publishes the new weights.
  await post(sales,`/api/orders/${o.id}/warehouse/reopen-preparing`,{});assert.equal((await get(wh,`/api/warehouse/delivered/${o.id}`)).status(),404);assert.equal((await (await get(wh,'/api/warehouse/delivered')).json()).total,0);
  await post(wh,`/api/orders/${o.id}/warehouse`,{items:[{itemId:o.items[0].id,deliveredKg:3},{itemId:o.items[1].id,outOfStock:true}]});
  await post(sales,`/api/orders/${o.id}/settle`,{items:[{itemId:o.items[0].id,unitPrice:1000},{itemId:o.items[1].id,cancelled:true}],settlementMethods:[{type:'CASH',amount:3000}]});
  r=await get(wh,`/api/warehouse/delivered/${o.id}`);data=await r.json();assert.equal(data.order.items[0].deliveredKg,3);assert.equal(data.order.items[1].outOfStock,true);assert(!JSON.stringify(data).includes('3000'));assert(!JSON.stringify(data).includes('unitPrice'));
  // More than one page is reachable without truncating older documents.
  for(let i=0;i<51;i++){
    const other=(await post(sales,'/api/orders/remote',{name:'مشتری صفحه',phone:'09121112233',dispatchPlace:'بابل',scheduledDate:date,scheduledAt:date+'T00:00',items:[{productId:'p01',requestedQty:1,requestedUnit:'کیلوگرم'}]})).order;
    await post(wh,`/api/orders/${other.id}/warehouse/accept`,{});await post(wh,`/api/orders/${other.id}/warehouse`,{items:[{itemId:other.items[0].id,deliveredKg:1}]});
  }
  const firstPage=await (await get(wh,'/api/warehouse/delivered')).json(),secondPage=await (await get(wh,'/api/warehouse/delivered?offset=50')).json();
  assert.equal(firstPage.total,52);assert.equal(firstPage.orders.length,50);assert.equal(secondPage.orders.length,2);assert.equal(new Set([...firstPage.orders,...secondPage.orders].map(x=>x.id)).size,52);
  await page.evaluate(()=>go('warehouse','delivered'));await page.locator('.wh-delivered-row').first().waitFor();await page.locator('[data-action=wh-delivered-next]').click();await page.waitForFunction(()=>document.querySelectorAll('.wh-delivered-row').length===2);await page.locator('[data-action=wh-delivered-prev]').click();await page.waitForFunction(()=>document.querySelectorAll('.wh-delivered-row').length===50);
  assert.deepEqual(errors,[]);await admin.close();await sales.close();await wh.close();
 }finally{if(browser)await browser.close();if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
