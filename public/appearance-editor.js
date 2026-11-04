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
 host.innerHTML=`<section class="card card-pad appearance-editor"><header><h2>تنظیم ظاهر سامانه</h2><p>علاوه بر تنظیم ظاهر کلی، چیدمان اختصاصی فرم سفارش غیرحضوری در پایین صفحه قابل ویرایش است. سایر فرم‌ها و چیدمان سندهای چاپی هنوز پشتیبانی نمی‌شوند.</p></header>
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
 <section class="appearance-form-designer" aria-labelledby="layoutTitle"><h3 id="layoutTitle">چیدمان اختصاصی فرم سفارش غیرحضوری</h3>
 <p>ناحیه را انتخاب کنید و اجزا را با کشیدن یا دکمه‌های جابه‌جایی مرتب کنید. پیش‌نمایش با قالب واقعی و اطلاعات نمونه ساخته می‌شود؛ قابل ثبت سفارش نیست. تغییرات فقط بعد از ذخیره و انتشار برای همه اعمال می‌شوند.</p>
 <label>ناحیه فرم <select id="layoutGroup"><option value="phoneSections">بخش‌های فرم</option><option value="phoneCustomer">فیلدهای مشتری</option></select></label>
 <div class="layout-workspace"><div><ol id="layoutItems" class="layout-items" aria-label="ترتیب اجزای ناحیه"></ol><button type="button" class="btn btn-secondary" id="layoutReset">ترتیب اصلی این ناحیه</button></div>
 <div><strong>پیش‌نمایش واقعی فرم (داده نمونه)</strong><iframe id="layoutPreview" title="پیش‌نمایش فرم سفارش غیرحضوری" sandbox="allow-same-origin"></iframe></div></div>
 <p>این مرحله ترتیب اجزا را تغییر می‌دهد؛ جابه‌جایی آزاد نقطه‌ای، تغییر ابعاد و فرم‌های دیگر هنوز در دست ساخت‌اند.</p></section>
 <div id="appearanceError" class="form-error" role="alert"></div><div id="appearanceStatus" role="status"></div><div class="appearance-actions"><button type="button" class="btn btn-secondary" id="appearanceSave">ذخیره پیش‌نویس</button><button type="button" class="btn btn-primary" id="appearancePublish">انتشار برای همه</button><button type="button" class="btn btn-secondary" id="appearanceRestore">بازگردانی طرح قبلی</button></div></section>`;
 const $local=id=>host.querySelector('#'+id), fields={background:$local('appearanceBackground'),color:$local('appearanceColor'),fontSize:$local('appearanceFontSize'),borderRadius:$local('appearanceBorderRadius'),spacing:$local('appearanceSpacing'),fontFamily:$local('appearanceFontFamily')};
 const status=$local('appearanceStatus'),error=$local('appearanceError'),sample=$local('appearanceSample'),targetSelect=$local('appearanceTarget');
 const pickers={background:$local('appearanceBackgroundPicker'),color:$local('appearanceColorPicker')};
 const layoutDefs={
  phoneSections:[['customer','مشخصات مشتری و روش تحویل'],['items','اقلام و افزودن محصول'],['notes','یادداشت'],['deposit','بیعانه'],['submit','ثبت سفارش']],
  phoneCustomer:[['name','نام مشتری'],['phone','شماره تماس'],['place','محل ارسال'],['delivery','روش تحویل']]
 };
 const layoutSelect=$local('layoutGroup'),layoutItems=$local('layoutItems'),preview=$local('layoutPreview');
 const defaultOrder=group=>layoutDefs[group].map(x=>x[0]);
 const currentOrder=group=>draft.layout?.[group]?.slice()||defaultOrder(group);
 function changeOrder(group,from,to){const order=currentOrder(group),i=order.indexOf(from),j=order.indexOf(to);if(i<0||j<0||i===j)return;order.splice(i,1);order.splice(j,0,from);draft.layout||={};draft.layout[group]=order;dirty=true;status.textContent='تغییرات هنوز ذخیره نشده‌اند.';layoutRender(false);}
 function layoutRender(rebuild=true){
  const group=layoutSelect.value,order=currentOrder(group),labels=Object.fromEntries(layoutDefs[group]);
  layoutItems.innerHTML=order.map((key,i)=>`<li draggable="true" data-layout-key="${key}"><span class="layout-grip" aria-hidden="true">⋮⋮</span><span>${labels[key]}</span><button type="button" data-layout-up="${key}" aria-label="جابه‌جایی ${labels[key]} به بالا" ${i===0?'disabled':''}>↑</button><button type="button" data-layout-down="${key}" aria-label="جابه‌جایی ${labels[key]} به پایین" ${i===order.length-1?'disabled':''}>↓</button></li>`).join('');
  const css=window.BTAppearance.cssFor(draft)+'\n'+window.BTAppearance.layoutCssFor(draft);
  if(!rebuild&&preview.dataset.group===group){const style=preview.contentDocument?.getElementById('bt-layout-preview-css');if(style){style.textContent=css;return;}}
  const box=document.createElement('div');box.innerHTML=renderSalesRemoteV32([]);const form=box.querySelector('.telephone-form-v25');
  form.querySelector('#phone-lines').innerHTML=renderProductPickerLine(defaultOrderLine(),0,'phone');
  form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
  const links=['/styles.css','/design.css','/mobile.css','/theme.css','/form-layout.css','/fonts.css','/compatibility.css'].map(href=>`<link rel="stylesheet" href="${href}">`).join('');
  const parent=group==='phoneSections'?'#phoneOrderFormV25':'#phoneOrderFormV25 > .sales-remote-customer-grid-v40';
  preview.onload=()=>{const doc=preview.contentDocument;if(!doc)return;const nodes=[...doc.querySelectorAll(parent+' > [data-layout-item]')];let dragging='';
   nodes.forEach(el=>{el.draggable=true;el.title='برای جابه‌جایی بکشید';el.addEventListener('dragstart',e=>{dragging=el.dataset.layoutItem;e.dataTransfer.setData('text/plain',dragging);e.dataTransfer.effectAllowed='move';});el.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';});el.addEventListener('drop',e=>{e.preventDefault();changeOrder(group,dragging,el.dataset.layoutItem);});});
  };
  preview.dataset.group=group;preview.srcdoc='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+links+'<style id="bt-layout-preview-css">'+css+'</style><style>body{background:#fff;margin:0;padding:12px}#appView{display:block}'+parent+' > [data-layout-item]{outline:2px dashed #29629a;cursor:grab}'+parent+' > [data-layout-item] > *{pointer-events:none}</style></head><body><div id="appView"><main id="content">'+form.outerHTML+'</main></div></body></html>';
 }
 layoutSelect.addEventListener('change',layoutRender);
 layoutItems.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;const group=layoutSelect.value,order=currentOrder(group),key=btn.dataset.layoutUp||btn.dataset.layoutDown,i=order.indexOf(key),j=btn.dataset.layoutUp?i-1:i+1;if(j>=0&&j<order.length)changeOrder(group,key,order[j]);});
 let dragged='';layoutItems.addEventListener('dragstart',e=>{const li=e.target.closest('[data-layout-key]');if(!li)return;dragged=li.dataset.layoutKey;e.dataTransfer.setData('text/plain',dragged);});layoutItems.addEventListener('dragover',e=>e.preventDefault());layoutItems.addEventListener('drop',e=>{e.preventDefault();const li=e.target.closest('[data-layout-key]');if(li)changeOrder(layoutSelect.value,dragged,li.dataset.layoutKey);});
 $local('layoutReset').onclick=()=>{draft.layout||={};delete draft.layout[layoutSelect.value];dirty=true;status.textContent='تغییرات هنوز ذخیره نشده‌اند.';layoutRender(false);};
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
 $local('appearanceSave').onclick=()=>action(async()=>{if(!update())return;state=await api('/api/admin/appearance/draft',{method:'PUT',body:JSON.stringify({draftRevision:state.draftRevision,settings:draft})});draft=JSON.parse(JSON.stringify(state.draft.settings));dirty=false;error.textContent='';status.textContent='پیش‌نویس ذخیره شد؛ هنوز برای کاربران منتشر نشده است.';});
 $local('appearancePublish').onclick=()=>action(async()=>{if(dirty||!state.draft){error.textContent='ابتدا پیش‌نویس را ذخیره کنید.';return;}if(!confirm('طرح ذخیره‌شده برای همه کاربران منتشر شود؟ تنظیمات جدول سندهای پشتیبانی‌شده نیز اعمال می‌شوند؛ از خوانایی آن‌ها اطمینان حاصل کنید.'))return;state=await api('/api/admin/appearance/publish',{method:'POST',body:JSON.stringify({version:state.version,draftRevision:state.draftRevision})});draft=JSON.parse(JSON.stringify(state.published));dirty=false;error.textContent='';status.textContent='طرح منتشر شد؛ کاربران پس از تازه‌سازی، حداکثر تا چند ثانیه آن را می‌بینند.';show();layoutRender();await window.BTAppearance.refresh();});
 $local('appearanceRestore').onclick=()=>action(async()=>{if(!confirm('طرح منتشرشده قبلی بازگردانده شود؟ پیش‌نویس فعلی حذف می‌شود.'))return;state=await api('/api/admin/appearance/restore',{method:'POST',body:JSON.stringify({version:state.version,draftRevision:state.draftRevision})});draft=JSON.parse(JSON.stringify(state.published));dirty=false;error.textContent='';status.textContent='طرح قبلی بازگردانده شد.';show();layoutRender();await window.BTAppearance.refresh();});
 status.textContent=state.draft?'پیش‌نویس ذخیره‌شده آماده بررسی است.':'طرح منتشرشده نمایش داده می‌شود.';show();layoutRender();
}
