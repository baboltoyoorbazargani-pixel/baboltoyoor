'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const exe=process.env.BT_CHROMIUM_PATH;
test('چاپ فاکتور، سرویس و گزارش‌ها بدون برگهٔ اضافی و با یک فراخوانی چاپ', {skip:!exe,timeout:90000},async()=>{
 const {chromium}=require('playwright-core');const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bt-print-frame-')),base=`http://127.0.0.1:${port}`;let browser;
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,ADMIN_INITIAL_PASSWORD:'Initial!2345'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);proc.stdout.on('data',d=>{if(String(d).includes('"listening"')){clearTimeout(t);resolve();}});proc.once('exit',c=>reject(Error('exit '+c)));});
  browser=await chromium.launch({executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage']});const ctx=await browser.newContext();
  await ctx.addInitScript(()=>{if(window!==window.top)window.print=()=>{window.parent.__printCalls=(window.parent.__printCalls||0)+1;};});
  for(const [url,data] of [['/api/login',{username:'admin',password:'Initial!2345'}],['/api/account/password',{currentPassword:'Initial!2345',newPassword:'Changed!2345'}]]){const r=await ctx.request.post(base+url,{data});assert.equal(r.status(),200);}
  const design={screen:{},print:{invoiceTable:{background:'#eeeeff',fontSize:13,fontFamily:'tahoma'},warehouseTable:{background:'#eeffee',fontSize:12,fontFamily:'tahoma'},storeServiceTable:{background:'#ffffee',fontSize:14,fontFamily:'vazirmatn'}},layout:{warehouseSections:['head','products','signature','total']}};
  let response=await ctx.request.put(base+'/api/admin/appearance/draft',{data:{draftRevision:0,settings:design}});assert.equal(response.status(),200);
  response=await ctx.request.post(base+'/api/admin/appearance/publish',{data:{version:0,draftRevision:1}});assert.equal(response.status(),200);
  const page=await ctx.newPage(),errors=[],popups=[];page.on('pageerror',e=>errors.push(e.message));page.on('popup',p=>popups.push(p));await page.goto(base+'/',{waitUntil:'networkidle'});
  const order={id:'o',orderNo:'001234',orderType:'REMOTE',customer:{name:'مشتری 34',phone:'09121234567'},items:[{id:'i',product:{name:'مرغ 2'},deliveredKg:5,unitPrice:2000,finalAmount:10000}],payment:{invoiceNumber:'000001',totalAmount:10000,customerName:'مشتری 34',customerPhone:'09121234567'}};
  await ctx.route('**/api/orders/o',r=>r.fulfill({json:{order}}));
  await ctx.route('**/api/orders/o/store-run/print/*',r=>r.fulfill({json:{document:{orderNo:'123',storeName:'فروشگاه 1',dispatchPlace:'بابل',sentAt:'2026-10-30',lines:[{productName:'مرغ 2',deliveredKg:25}]}}}));
  const history={from:'2026-10-01',to:'2026-10-31',summary:{orders:1,byProduct:[]},rows:[{day:'2026-10-30',completedAt:'2026-10-30T12:34:00Z',orderNo:'001234',customerName:'مشتری 34',items:[{productName:'مرغ 2',deliveredKg:5}],deliveredKg:5,completedBy:'انبار'}],returns:[]};
  async function check(action,selector,text){
    const before=await page.evaluate(()=>window.__printCalls||0);await action();
    await page.waitForFunction(n=>window.__printCalls===n+1,before,{timeout:12000});
    const frame=page.frameLocator('iframe[title="سند آماده چاپ"]');await frame.locator(selector).first().waitFor();
    const body=await frame.locator('body').innerText();assert.match(body,text);assert.doesNotMatch(body,/[0-9٠-٩]/);assert.equal(await frame.locator('.bt-print-tools').count(),0);assert.equal(await frame.locator('.service-tools:not([hidden])').count(),0);
    const expected={'.inv38-sheet':['.inv38-table th','rgb(238, 238, 255)','13px'],'.service-sheet':['.service-table th','rgb(255, 255, 238)','14px'],'.whd-doc':['.whd-products th','rgb(238, 255, 238)','12px']}[selector];
    if(expected){const style=await frame.locator(expected[0]).first().evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,size:getComputedStyle(e).fontSize,font:getComputedStyle(e).fontFamily}));assert.equal(style.background,expected[1]);assert.equal(style.color,'rgb(0, 0, 0)');assert.equal(style.size,expected[2]);assert.match(style.font,selector==='.service-sheet'?/Vazirmatn/:/Tahoma/);
      // Render the actual generated print document to PDF, with background printing disabled.
      let markup=await frame.locator('html').evaluate(e=>e.outerHTML);markup=markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<head>/i,`<head><base href="${base}/">`);
      const pdfPage=await ctx.newPage();await pdfPage.setViewportSize({width:700,height:1000});await pdfPage.setContent(markup,{waitUntil:'load'});await pdfPage.emulateMedia({media:'print'});await pdfPage.evaluate(()=>document.fonts.ready);
      assert.match(await pdfPage.locator('body').innerText(),text);if(selector==='.whd-doc')assert.ok(await pdfPage.locator('.whd-signature').first().isVisible());if(selector==='.service-sheet')assert.ok(await pdfPage.locator('.service-signatures').isVisible());
      const pdf=await pdfPage.pdf({format:'A4',printBackground:false});assert.ok(pdf.length>5000);await pdfPage.close();
    }
    if(selector==='.whd-doc')assert.deepEqual(await frame.locator('.whd-doc').evaluate(el=>[...el.children].map(x=>x.dataset.layoutItem)),['head','products','signature','total']);
    assert.equal(popups.length,0);assert.equal(ctx.pages().length,1);
    await page.locator('iframe[title="سند آماده چاپ"]').evaluate(el=>el.contentWindow.dispatchEvent(new Event('afterprint')));
    await page.locator('iframe[title="سند آماده چاپ"]').waitFor({state:'detached'});
  }
  await check(()=>page.evaluate(()=>printInvoice('o',null)),'.inv38-sheet',/مشتری ۳۴/);
  await check(()=>page.evaluate(()=>printStoreService('o',1)),'.service-sheet',/فروشگاه ۱/);
  await check(()=>page.evaluate(()=>whPrintDocument({warehouseDocumentNo:'W-123',orderNo:'123',customerName:'مشتری 34',customerPhone:'09121234567',createdAt:'2026-10-30',deliveryMode:'PICKUP',items:[{productName:'مرغ',deliveredKg:5,weighings:[]}]},0)),'.whd-doc',/مشتری ۳۴/);
  for(const fn of ['printWarehouseHistory','printWhStoreHistory']){
   await page.evaluate(({fn,history})=>Object.assign(fn==='printWhStoreHistory'?app.whStoreHist:app.whHist,{data:history,q:'',result:''}),{fn,history});
   await check(()=>page.evaluate(fn=>window[fn](),fn),'table',/مشتری ۳۴/);
  }
  await page.evaluate(()=>adm.report={label:'گزارش 12',total:1,columns:[{key:'customerName',label:'نام'}],rows:[{customerName:'مشتری 34'}]});
  await check(()=>page.evaluate(()=>printReport()),'table',/مشتری ۳۴/);
  await ctx.route('**/api/reports',r=>r.fulfill({json:{gate:{today:1,byDistrict:[{district:'محله 12',count:2}]},sales:{todayOrders:3},finance:{revenue:400},remote:{scheduled:5,byDate:[]}}}));
  await page.evaluate(()=>{const b=document.createElement('button');b.dataset.action='rp38-print';document.body.append(b);});
  await check(()=>page.evaluate(()=>document.querySelector('[data-action=rp38-print]').click()),'.rpt38-table',/محله ۱۲/);
  // Missing or inaccessible service: report the error and release the frame; no print is attempted.
  await ctx.route('**/api/orders/fail/store-run/print/*',r=>r.fulfill({status:403,json:{error:'دسترسی به سرویس مجاز نیست'}}));
  const beforeError=await page.evaluate(()=>window.__printCalls||0);
  await page.evaluate(()=>printStoreService('fail',1));await page.getByText('دسترسی به سرویس مجاز نیست').waitFor();
  assert.equal(await page.locator('iframe[title="سند آماده چاپ"]').count(),0);assert.equal(await page.evaluate(()=>window.__printCalls||0),beforeError);
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.startsWith('invoice-print-'))),false);
  assert.deepEqual(errors,[]);
  // Also invoke Chromium's real print() (not only the stub above) and observe its lifecycle.
  const real=await browser.newContext({storageState:await ctx.storageState()});
  await real.addInitScript(()=>{if(window!==window.top){const original=window.print.bind(window);window.print=()=>{window.parent.__nativeCalls=(window.parent.__nativeCalls||0)+1;return original();};window.addEventListener('beforeprint',()=>{window.parent.__beforePrint=true;});window.addEventListener('afterprint',()=>{window.parent.__afterPrint=true;});}});
  await real.route('**/api/orders/o',r=>r.fulfill({json:{order}}));const actual=await real.newPage();let actualPopups=0;actual.on('popup',()=>actualPopups++);await actual.goto(base+'/',{waitUntil:'networkidle'});await actual.evaluate(()=>printInvoice('o',null));
  await actual.waitForFunction(()=>window.__nativeCalls===1 && window.__beforePrint, null,{timeout:12000});assert.equal(actualPopups,0);
  // Chromium headless may never deliver afterprint. In that case the operator
  // must explicitly release the job; this does not assert a physical print.
  await actual.waitForFunction(()=>window.__afterPrint||document.querySelector('.bt-print-pending'),null,{timeout:12000});
  if(!await actual.evaluate(()=>!!window.__afterPrint)){actual.once('dialog',d=>d.accept());await actual.getByRole('button',{name:'آزادسازی چاپ بعدی'}).click();}
  await actual.locator('iframe[title="سند آماده چاپ"]').waitFor({state:'detached'});await real.close();
 }finally{if(browser)await browser.close();if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill('SIGTERM');await done;}fs.rmSync(dir,{recursive:true,force:true});}
});
