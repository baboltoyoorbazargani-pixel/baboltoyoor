'use strict';
// First stage of the visual editor. Its preview is a sample, not a live form.
// Free-form layout, labels and per-page components are not supported yet.
async function renderAppearanceEditor(){
 const host=$('#content');if(!host)return;
 host.innerHTML='<section class="card card-pad" role="status">در حال دریافت طرح...</section>';
 let state;
 try{state=await api('/api/admin/appearance');}catch(e){if(app.page==='appearance')host.innerHTML='<section class="card card-pad" role="alert">دریافت تنظیمات طراحی ناموفق بود. دوباره تلاش کنید.</section>';return;}
 if(app.page!=='appearance')return;
 let draft=JSON.parse(JSON.stringify(state.draft?.settings||state.published)),target='navigation',dirty=false,busy=false;
 const printTargets=new Set(['invoiceTable','warehouseTable','storeServiceTable']);
 const targets=[['navigation','پس‌زمینه منوی کناری'],['navigationActive','منوی انتخاب‌شده'],['header','سربرگ صفحه'],['workspace','پس‌زمینه فضای کار'],['panel','کارت‌ها و کادرها'],['buttonPrimary','دکمه‌های اصلی'],['buttonSecondary','دکمه‌های فرعی'],['input','کادرهای ورود اطلاعات'],['invoiceTable','چاپ: جدول فاکتور فروش'],['warehouseTable','چاپ: جدول سند انبار'],['storeServiceTable','چاپ: جدول برگه سرویس فروشگاه']];
 host.innerHTML=`<section class="card card-pad appearance-editor"><header><h2>تنظیم ظاهر سامانه</h2><p>چیدمان اختصاصی فرم سفارش غیرحضوری، فرم ورود نگهبانی و سند انبار در پایین صفحه قابل ویرایش است. سایر فرم‌ها و سندها هنوز پشتیبانی نمی‌شوند.</p></header>
 <div class="notice">پیش‌نمایش فقط یک نمونه است و برای سایر کاربران اعمال نمی‌شود. پس از ذخیره، انتشار را جداگانه تأیید کنید. اطلاعات سفارش و عملکرد سامانه تغییر نمی‌کند. اگر ظاهر نامناسب شد، با افزودن <code>?appearance=off</code> به نشانی صفحه وارد حالت امن شوید و طرح قبلی را بازگردانید.</div>
 <div class="appearance-layout"><div class="appearance-controls"><label>بخش موردنظر <select id="appearanceTarget">${targets.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
 <fieldset><legend>ویژگی‌ها (خالی یعنی حالت اصلی)</legend>
 <label><span id="appearanceBackgroundLabel">رنگ پس‌زمینه</span><span class="appearance-color-control"><input type="color" id="appearanceBackgroundPicker" aria-label="انتخاب رنگ پس‌زمینه" value="#ffffff"><input type="text" id="appearanceBackground" dir="ltr" maxlength="7" placeholder="بدون تغییر"></span></label>
 <label data-screen-only><span>رنگ نوشته</span><span class="appearance-color-control"><input type="color" id="appearanceColorPicker" aria-label="انتخاب رنگ نوشته" value="#000000"><input type="text" id="appearanceColor" dir="ltr" maxlength="7" placeholder="بدون تغییر"></span></label>
 <label><span id="appearanceFontSizeLabel">اندازه نوشته (۹ تا ۳۰ پیکسل)</span><input type="number" id="appearanceFontSize" min="9" max="30" step="1"></label>
 <label><span>قلم</span><select id="appearanceFontFamily"><option value="">حالت اصلی</option><option value="vazirmatn">وزیرمتن</option><option value="tahoma">Tahoma</option></select></label>
 <label data-screen-only><span>گردی گوشه‌ها (۰ تا ۳۰ پیکسل)</span><input type="number" id="appearanceBorderRadius" min="0" max="30" step="1"></label>
 <label data-screen-only><span>فاصله داخلی (۰ تا ۲۴ پیکسل)</span><input type="number" id="appearanceSpacing" min="0" max="24" step="1"></label></fieldset>
 <button type="button" class="btn btn-secondary" id="appearanceResetTarget">حذف تغییرات این بخش</button></div>
 <section class="appearance-sample" aria-label="پیش نمایش نمونه"><strong>پیش‌نمایش نمونه</strong><p>نمونهٔ تقریبی؛ همهٔ وضعیت‌ها و اندازهٔ صفحه‌ها را پیش از انتشار بررسی کنید.</p><div id="appearanceSample" class="appearance-sample-box"><b>نمونه متن و کادر</b><span>شماره سفارش: ۱۲۳۴۵۶</span><button type="button" class="btn btn-primary">نمونه دکمه</button></div></section></div>
 <section class="appearance-form-designer" aria-labelledby="layoutTitle"><h3 id="layoutTitle">چیدمان اختصاصی فرم و سند</h3>
 <p>ناحیه را انتخاب کنید و اجزا را با کشیدن یا دکمه‌های جابه‌جایی مرتب کنید. پیش‌نمایش با قالب واقعی و اطلاعات نمونه ساخته می‌شود؛ قابل ثبت سفارش نیست. تغییرات فقط بعد از ذخیره و انتشار برای همه اعمال می‌شوند.</p>
 <label>ناحیه فرم <select id="layoutGroup"><option value="phoneSections">سفارش غیرحضوری: بخش‌های فرم</option><option value="phoneCustomer">سفارش غیرحضوری: فیلدهای مشتری</option><option value="gateSections">ورود نگهبانی: بخش‌های فرم</option><option value="gateContact">ورود نگهبانی: فیلدهای مشتری</option><option value="gateVehicle">ورود نگهبانی: وسیله و هدف</option><option value="warehouseSections">سند انبار: بخش‌های چاپ</option></select></label>
 <div id="gridControls" class="layout-grid-controls" hidden><label><input type="checkbox" id="gridEnabled"> جای‌گذاری شبکه‌ای و تغییر ابعاد در صفحه بزرگ</label><div id="gridFields" hidden><label>جزء <select id="gridItem"></select></label><label>ستون از راست (۰ تا ۱۱)<input type="number" id="gridX" min="0" max="11"></label><label>ردیف (۰ تا ۷)<input type="number" id="gridY" min="0" max="7"></label><label>عرض (۲ تا ۱۲ ستون)<input type="number" id="gridW" min="2" max="12"></label><label>حداقل ارتفاع (۴۸ تا ۲۴۰ پیکسل)<input type="number" id="gridH" min="48" max="240"></label><button type="button" class="btn btn-secondary" id="gridApply">اعمال مختصات</button></div><small>در صفحه کوچک اجزا به ترتیب در جریان عادی قرار می‌گیرند. برای جلوگیری از پوشاندن فیلدها، همپوشانی مجاز نیست.</small></div>
 <div class="layout-workspace"><div><ol id="layoutItems" class="layout-items" aria-label="ترتیب اجزای ناحیه"></ol><button type="button" class="btn btn-secondary" id="layoutReset">ترتیب اصلی این ناحیه</button></div>
 <div><strong>پیش‌نمایش واقعی فرم (داده نمونه)</strong><div class="layout-preview-scroll"><iframe id="layoutPreview" title="پیش‌نمایش فرم یا سند انتخاب‌شده" sandbox="allow-same-origin"></iframe></div></div></div>
 <p>جای‌گذاری شبکه‌ای تنها برای مشخصات مشتری در دو فرم و ترتیب سند تنها برای سند انبار است؛ ویرایش نقطه‌ای کاملاً آزاد، سایر فرم‌ها و سایر سندهای چاپی هنوز در دست ساخت‌اند.</p></section>
 <div id="appearanceError" class="form-error" role="alert"></div><div id="appearanceStatus" role="status"></div><div class="appearance-actions"><button type="button" class="btn btn-secondary" id="appearanceSave">ذخیره پیش‌نویس</button><button type="button" class="btn btn-primary" id="appearancePublish">انتشار برای همه</button><button type="button" class="btn btn-secondary" id="appearanceRestore">بازگردانی طرح قبلی</button></div></section>`;
 const $local=id=>host.querySelector('#'+id), fields={background:$local('appearanceBackground'),color:$local('appearanceColor'),fontSize:$local('appearanceFontSize'),borderRadius:$local('appearanceBorderRadius'),spacing:$local('appearanceSpacing'),fontFamily:$local('appearanceFontFamily')};
 const status=$local('appearanceStatus'),error=$local('appearanceError'),sample=$local('appearanceSample'),targetSelect=$local('appearanceTarget');
 const pickers={background:$local('appearanceBackgroundPicker'),color:$local('appearanceColorPicker')};
 const layoutDefs={
  phoneSections:[['customer','مشخصات مشتری و روش تحویل'],['items','اقلام و افزودن محصول'],['notes','یادداشت'],['deposit','بیعانه'],['submit','ثبت سفارش']],
  phoneCustomer:[['name','نام مشتری'],['phone','شماره تماس'],['place','محل ارسال'],['delivery','روش تحویل']],
  gateSections:[['contact','مشخصات مشتری'],['vehicle','وسیله و هدف']],
  gateContact:[['search','جستجوی مشتری'],['name','نام مشتری'],['phone','شماره تماس']],
  gateVehicle:[['vehicle','نوع وسیله'],['carType','نوع خودرو'],['purpose','هدف مراجعه']],
  warehouseSections:[['head','سربرگ سند'],['products','جدول محصولات'],['total','جمع خالص'],['signature','متن امانی و امضا']]

 };
 const layoutSelect=$local('layoutGroup'),layoutItems=$local('layoutItems'),preview=$local('layoutPreview');
 const parentSelectors={phoneSections:'#phoneOrderFormV25',phoneCustomer:'#phoneOrderFormV25 > .sales-remote-customer-grid-v40',gateSections:'#gateForm > .gt-entry-pad',gateContact:'#gateForm .gt-entry-cust',gateVehicle:'#gateForm .gt-entry-vehicle-fields',warehouseSections:'.whd-doc'};
 const gridGroups=['phoneCustomer','gateContact'],gridControls=$local('gridControls'),gridEnabled=$local('gridEnabled'),gridFields=$local('gridFields'),gridItem=$local('gridItem');
 const inputs={x:$local('gridX'),y:$local('gridY'),w:$local('gridW'),h:$local('gridH')};let gridPending=false,layoutGroup=layoutSelect.value,selectedGrid='';
 const defaultGrid=group=>Object.fromEntries(layoutDefs[group].map(([key],i)=>[key,{x:group==='phoneCustomer'?i*3:i*4,y:0,w:group==='phoneCustomer'?3:4,h:72}]));
 function validateGrid(group,grid){const keys=layoutDefs[group].map(x=>x[0]);if(!grid||keys.some(k=>!grid[k]))return false;for(const p of Object.values(grid))if(!['x','y','w','h'].every(k=>Number.isInteger(p[k]))||p.x<0||p.y<0||p.y>7||p.w<2||p.w>12||p.x+p.w>12||p.h<48||p.h>240)return false;const all=Object.values(grid);return !all.some((a,i)=>all.some((b,j)=>i<j&&a.y===b.y&&a.x<b.x+b.w&&b.x<a.x+a.w));}
 function gridShow(){const group=layoutSelect.value,available=gridGroups.includes(group),grid=draft.grid?.[group];gridControls.hidden=!available;gridEnabled.checked=!!grid;gridFields.hidden=!grid;if(!available||!grid)return;const keys=layoutDefs[group];if(!keys.some(([k])=>k===selectedGrid))selectedGrid=keys[0][0];gridItem.innerHTML=keys.map(([k,l])=>`<option value="${k}">${l}</option>`).join('');gridItem.value=selectedGrid;for(const [k,el] of Object.entries(inputs))el.value=grid[selectedGrid][k];}
 function applyGrid(group,key,pos){const current=structuredClone(draft.grid?.[group]||defaultGrid(group));current[key]=pos;if(!validateGrid(group,current)){error.textContent='مختصات نامعتبر است یا دو جزء همپوشانی دارند. ابتدا جزء را به ردیف خالی منتقل کنید.';return false;}draft.grid||={};draft.grid[group]=current;gridPending=false;dirty=true;error.textContent='';status.textContent='تغییرات هنوز ذخیره نشده‌اند.';gridShow();layoutRender(false);return true;}
 gridEnabled.addEventListener('change',()=>{const group=layoutSelect.value;draft.grid||={};if(gridEnabled.checked)draft.grid[group]=defaultGrid(group);else delete draft.grid[group];gridPending=false;dirty=true;error.textContent='';status.textContent='تغییرات هنوز ذخیره نشده‌اند.';gridShow();layoutRender(false);});
 gridItem.addEventListener('change',()=>{if(gridPending){gridItem.value=selectedGrid;error.textContent='ابتدا مختصات واردشده را اعمال کنید.';return;}selectedGrid=gridItem.value;gridShow();});
 for(const input of Object.values(inputs))input.addEventListener('input',()=>{gridPending=true;dirty=true;status.textContent='برای ثبت مختصات، دکمه اعمال مختصات را بزنید.';});
 $local('gridApply').onclick=()=>{const group=layoutSelect.value,key=gridItem.value,pos=Object.fromEntries(Object.entries(inputs).map(([k,el])=>[k,el.value.trim()===''?NaN:Number(el.value)]));applyGrid(group,key,pos);};

 const defaultOrder=group=>layoutDefs[group].map(x=>x[0]);
 const currentOrder=group=>draft.layout?.[group]?.slice()||defaultOrder(group);
 function changeOrder(group,from,to,deferRender=false){if(gridPending){error.textContent='ابتدا مختصات واردشده را اعمال کنید.';return;}const order=currentOrder(group),i=order.indexOf(from),j=order.indexOf(to);if(i<0||j<0||i===j)return;order.splice(i,1);order.splice(j,0,from);draft.layout||={};draft.layout[group]=order;dirty=true;status.textContent='تغییرات هنوز ذخیره نشده‌اند.';if(deferRender)setTimeout(()=>layoutRender(false),1000);else layoutRender(false);}
 function layoutRender(rebuild=true){
  const group=layoutSelect.value,order=currentOrder(group),labels=Object.fromEntries(layoutDefs[group]),grid=!!draft.grid?.[group];preview.style.width=grid?'960px':'100%';gridShow();
  layoutItems.innerHTML=order.map((key,i)=>`<li data-layout-key="${key}"><span class="layout-grip" aria-hidden="true">⋮⋮</span><span>${labels[key]}</span><button type="button" data-layout-up="${key}" aria-label="جابه‌جایی ${labels[key]} به بالا" ${i===0||grid?'disabled':''}>↑</button><button type="button" data-layout-down="${key}" aria-label="جابه‌جایی ${labels[key]} به پایین" ${i===order.length-1||grid?'disabled':''}>↓</button></li>`).join('');
  const css=window.BTAppearance.cssFor(draft)+'\n'+window.BTAppearance.layoutCssFor(draft)+'\n'+window.BTAppearance.gridCssFor(draft);
  if(!rebuild&&preview.dataset.group===group){const style=preview.contentDocument?.getElementById('bt-layout-preview-css');if(style){style.textContent=css;if(group==='warehouseSections')window.BTAppearance.applyPrintLayout(draft,'warehouseTable',preview.contentDocument,{preview:true});return;}}
  const box=document.createElement('div');let form;
  if(group.startsWith('phone')){box.innerHTML=renderSalesRemoteV32([]);form=box.querySelector('.telephone-form-v25');form.querySelector('#phone-lines').innerHTML=renderProductPickerLine(defaultOrderLine(),0,'phone');}
  else if(group.startsWith('gate')){box.innerHTML=renderGateEntry();form=box.firstElementChild;form.querySelector('#plateBox').innerHTML=plateEditorHtml();}
  else {box.innerHTML=whDeliveredDocument({customerName:'مشتری نمونه',customerPhone:'۰۹۱۲۱۲۳۴۵۶۷',orderNo:'۱۲۳',warehouseDocumentNo:'W-۱۲۳',createdAt:'2026-01-01',deliveryMode:'PICKUP',items:[{productName:'محصول نمونه',deliveredKg:3,weighings:[]}]});form=box.firstElementChild;}
  form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
  const links=['/styles.css','/design.css','/mobile.css','/theme.css','/form-layout.css','/fonts.css','/compatibility.css','/warehouse-document.css'].map(href=>`<link rel="stylesheet" href="${href}">`).join('');
  const parent=parentSelectors[group];
  preview.onload=()=>{const doc=preview.contentDocument;if(!doc)return;if(group==='warehouseSections')window.BTAppearance.applyPrintLayout(draft,'warehouseTable',doc,{preview:true});const nodes=[...doc.querySelectorAll(parent+' > [data-layout-item]')];
   nodes.forEach(el=>{el.title='برای جابه‌جایی بکشید';let start=null;
    el.addEventListener('pointerdown',e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY};el.setPointerCapture(e.pointerId);e.preventDefault();});
    el.addEventListener('pointerup',e=>{if(!start)return;const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y)>6;start=null;if(!moved)return;const key=el.dataset.layoutItem,geometry=draft.grid?.[group];if(geometry){if(gridPending){error.textContent='ابتدا مختصات واردشده را اعمال کنید.';return;}const container=el.parentElement,rect=container.getBoundingClientRect(),style=doc.defaultView.getComputedStyle(container),gap=parseFloat(style.rowGap)||0,rowHeight=Math.max(68,el.getBoundingClientRect().height),p=geometry[key],x=Math.max(0,Math.min(12-p.w,Math.round((rect.right-e.clientX)/rect.width*12-p.w/2))),y=Math.max(0,Math.min(7,Math.floor((e.clientY-rect.top)/(rowHeight+gap))));selectedGrid=key;applyGrid(group,key,{...p,x,y});return;}const target=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-layout-item]');if(target&&nodes.includes(target))changeOrder(group,key,target.dataset.layoutItem,true);});
    el.addEventListener('pointercancel',()=>{start=null;});
   });
  };
  preview.dataset.group=group;preview.srcdoc='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+links+'<style id="bt-layout-preview-css">'+css+'</style><style>body{background:#fff;margin:0;padding:12px}#appView{display:block}'+parent+' > [data-layout-item]{outline:2px dashed #29629a;cursor:grab;touch-action:none}'+parent+' > [data-layout-item] > *{pointer-events:none}</style></head><body><div id="appView"><main id="content">'+form.outerHTML+'</main></div></body></html>';
 }
 layoutSelect.addEventListener('change',()=>{if(gridPending){layoutSelect.value=layoutGroup;error.textContent='ابتدا مختصات واردشده را اعمال کنید.';return;}layoutGroup=layoutSelect.value;selectedGrid='';layoutRender();});
 layoutItems.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;const group=layoutSelect.value;if(draft.grid?.[group])return;const order=currentOrder(group),key=btn.dataset.layoutUp||btn.dataset.layoutDown,i=order.indexOf(key),j=btn.dataset.layoutUp?i-1:i+1;if(j>=0&&j<order.length)changeOrder(group,key,order[j]);});
 let listDrag=null;
 layoutItems.addEventListener('pointerdown',e=>{const li=e.target.closest('[data-layout-key]');if(draft.grid?.[layoutSelect.value]||!li||e.target.closest('button')||e.button!==0)return;listDrag={key:li.dataset.layoutKey,x:e.clientX,y:e.clientY};li.setPointerCapture(e.pointerId);e.preventDefault();});
 layoutItems.addEventListener('pointerup',e=>{if(!listDrag)return;const from=listDrag.key,moved=Math.hypot(e.clientX-listDrag.x,e.clientY-listDrag.y)>6;listDrag=null;if(!moved)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-layout-key]');if(target&&layoutItems.contains(target))changeOrder(layoutSelect.value,from,target.dataset.layoutKey,true);});
 layoutItems.addEventListener('pointercancel',()=>{listDrag=null;});
 $local('layoutReset').onclick=()=>{if(gridPending){error.textContent='ابتدا مختصات واردشده را اعمال کنید.';return;}draft.layout||={};delete draft.layout[layoutSelect.value];dirty=true;status.textContent='تغییرات هنوز ذخیره نشده‌اند.';layoutRender(false);};
 const scope=()=>printTargets.has(target)?'print':'screen';
 const isLight=v=>{if(!/^#[0-9a-f]{6}$/i.test(v))return false;const rgb=[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>=0.5;};
 const show=()=>{const printed=scope()==='print';host.querySelectorAll('[data-screen-only]').forEach(e=>e.hidden=printed);fields.fontSize.max=printed?'14':'30';$local('appearanceFontSizeLabel').textContent=printed?'اندازه نوشته جدول (۹ تا ۱۴ پیکسل)':'اندازه نوشته (۹ تا ۳۰ پیکسل)';$local('appearanceBackgroundLabel').textContent=printed?'رنگ روشن پس‌زمینه سرستون':'رنگ پس‌زمینه';const v=draft[scope()]?.[target]||{};for(const [key,input] of Object.entries(fields))input.value=v[key]??'';pickers.background.value=v.background||'#ffffff';pickers.color.value=v.color||'#000000';updateSample();};
 function updateSample(){const v=draft[scope()]?.[target]||{};sample.style.fontFamily=v.fontFamily==='tahoma'?'Tahoma,Arial,sans-serif':v.fontFamily==='vazirmatn'?'Vazirmatn,Tahoma,sans-serif':'';sample.style.background=v.background||'';sample.style.color=scope()==='print'&&v.background?'#000000':v.color||'';sample.style.fontSize=v.fontSize==null?'':v.fontSize+'px';sample.style.borderRadius=v.borderRadius==null?'':v.borderRadius+'px';sample.style.padding=v.spacing==null?'':v.spacing+'px';}
 function update(){
  dirty=true;status.textContent='تغییرات هنوز ذخیره نشده‌اند.';error.textContent='';const v={};
  for(const [key,input] of Object.entries(fields)){
   if(scope()==='print'&&['color','borderRadius','spacing'].includes(key))continue;
   const raw=input.value.trim();if(!raw)continue;
   if(key==='fontFamily'){if(!['vazirmatn','tahoma'].includes(raw)){error.textContent='قلم معتبر نیست.';return false;}v[key]=raw;continue;}
   if(key==='background'||key==='color'){if(!/^#[0-9a-f]{6}$/i.test(raw)){error.textContent='رنگ باید مانند #aabbcc باشد.';return false;}if(scope()==='print'&&!isLight(raw)){error.textContent='برای چاپ، رنگ سرستون باید روشن باشد تا متن حتی بدون چاپ پس‌زمینه خوانا بماند.';return false;}v[key]=raw.toLowerCase();}
   else{const n=Number(raw),min=key==='fontSize'?9:0,max=key==='spacing'?24:(key==='fontSize'&&scope()==='print'?14:30);if(!Number.isInteger(n)||n<min||n>max){error.textContent='اندازه واردشده معتبر نیست.';return false;}v[key]=n;}
  }
  draft[scope()]||={};draft[scope()][target]=v;for(const key of ['background','color'])if(v[key])pickers[key].value=v[key];updateSample();return true;
 }
 for(const input of Object.values(fields))input.addEventListener('input',update);
 for(const [key,input] of Object.entries(pickers))input.addEventListener('input',()=>{fields[key].value=input.value;update();});
 targetSelect.addEventListener('change',()=>{target=targetSelect.value;show();});
 $local('appearanceResetTarget').onclick=()=>{delete draft[scope()][target];dirty=true;status.textContent='تغییرات هنوز ذخیره نشده‌اند.';show();};
 async function action(fn){if(busy)return;busy=true;const controls=[...host.querySelectorAll('button,input,select')],wasDisabled=controls.map(x=>x.disabled);controls.forEach(x=>{x.disabled=true;});try{await fn();}catch(e){error.textContent=e.message||'درخواست انجام نشد.';}finally{busy=false;controls.forEach((x,i)=>{x.disabled=wasDisabled[i];});}}
 $local('appearanceSave').onclick=()=>action(async()=>{if(gridPending){error.textContent='ابتدا مختصات واردشده را اعمال کنید.';return;}if(!update())return;state=await api('/api/admin/appearance/draft',{method:'PUT',body:JSON.stringify({draftRevision:state.draftRevision,settings:draft})});draft=JSON.parse(JSON.stringify(state.draft.settings));dirty=false;error.textContent='';status.textContent='پیش‌نویس ذخیره شد؛ هنوز برای کاربران منتشر نشده است.';});
 $local('appearancePublish').onclick=()=>action(async()=>{if(dirty||!state.draft){error.textContent='ابتدا پیش‌نویس را ذخیره کنید.';return;}if(!confirm('طرح ذخیره‌شده برای همه کاربران منتشر شود؟ تنظیمات جدول سندهای پشتیبانی‌شده نیز اعمال می‌شوند؛ از خوانایی آن‌ها اطمینان حاصل کنید.'))return;state=await api('/api/admin/appearance/publish',{method:'POST',body:JSON.stringify({version:state.version,draftRevision:state.draftRevision})});draft=JSON.parse(JSON.stringify(state.published));gridPending=false;dirty=false;error.textContent='';status.textContent='طرح منتشر شد؛ کاربران پس از تازه‌سازی، حداکثر تا چند ثانیه آن را می‌بینند.';show();layoutRender();await window.BTAppearance.refresh();});
 $local('appearanceRestore').onclick=()=>action(async()=>{if(!confirm('طرح منتشرشده قبلی بازگردانده شود؟ پیش‌نویس فعلی حذف می‌شود.'))return;state=await api('/api/admin/appearance/restore',{method:'POST',body:JSON.stringify({version:state.version,draftRevision:state.draftRevision})});draft=JSON.parse(JSON.stringify(state.published));gridPending=false;dirty=false;error.textContent='';status.textContent='طرح قبلی بازگردانده شد.';show();layoutRender();await window.BTAppearance.refresh();});
 status.textContent=state.draft?'پیش‌نویس ذخیره‌شده آماده بررسی است.':'طرح منتشرشده نمایش داده می‌شود.';show();layoutRender();
}
