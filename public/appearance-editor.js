'use strict';
// First stage of the visual editor. Its preview is a sample, not a live form.
// Free-form layout, labels, per-page components and print are not supported yet.
async function renderAppearanceEditor(){
 const host=$('#content');if(!host)return;
 host.innerHTML='<section class="card card-pad" role="status">در حال دریافت طرح...</section>';
 let state;
 try{state=await api('/api/admin/appearance');}catch(e){if(app.page==='appearance')host.innerHTML='<section class="card card-pad" role="alert">دریافت تنظیمات طراحی ناموفق بود. دوباره تلاش کنید.</section>';return;}
 if(app.page!=='appearance')return;
 let draft=JSON.parse(JSON.stringify(state.draft?.settings||state.published)),target='navigation',dirty=false,busy=false;
 const targets=[['navigation','پس‌زمینه منوی کناری'],['navigationActive','منوی انتخاب‌شده'],['header','سربرگ صفحه'],['workspace','پس‌زمینه فضای کار'],['panel','کارت‌ها و کادرها'],['buttonPrimary','دکمه‌های اصلی'],['buttonSecondary','دکمه‌های فرعی'],['input','کادرهای ورود اطلاعات']];
 host.innerHTML=`<section class="card card-pad appearance-editor"><header><h2>تنظیم ظاهر سامانه</h2><p>این نسخه برای تنظیم ظاهری هشت گروه از اجزای اصلی است؛ تغییر آزاد صفحه‌ها و طراحی سندهای چاپی هنوز پشتیبانی نمی‌شود.</p></header>
 <div class="notice">پیش‌نمایش فقط یک نمونه است و برای سایر کاربران اعمال نمی‌شود. پس از ذخیره، انتشار را جداگانه تأیید کنید. اطلاعات سفارش و عملکرد سامانه تغییر نمی‌کند. اگر ظاهر نامناسب شد، با افزودن <code>?appearance=off</code> به نشانی صفحه وارد حالت امن شوید و طرح قبلی را بازگردانید.</div>
 <div class="appearance-layout"><div class="appearance-controls"><label>بخش موردنظر <select id="appearanceTarget">${targets.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
 <fieldset><legend>ویژگی‌ها (خالی یعنی حالت اصلی)</legend>
 <label><span>رنگ پس‌زمینه</span><span class="appearance-color-control"><input type="color" id="appearanceBackgroundPicker" aria-label="انتخاب رنگ پس‌زمینه" value="#ffffff"><input type="text" id="appearanceBackground" dir="ltr" maxlength="7" placeholder="بدون تغییر"></span></label>
 <label><span>رنگ نوشته</span><span class="appearance-color-control"><input type="color" id="appearanceColorPicker" aria-label="انتخاب رنگ نوشته" value="#000000"><input type="text" id="appearanceColor" dir="ltr" maxlength="7" placeholder="بدون تغییر"></span></label>
 <label><span>اندازه نوشته (۹ تا ۳۰ پیکسل)</span><input type="number" id="appearanceFontSize" min="9" max="30" step="1"></label>
 <label><span>گردی گوشه‌ها (۰ تا ۳۰ پیکسل)</span><input type="number" id="appearanceBorderRadius" min="0" max="30" step="1"></label>
 <label><span>فاصله داخلی (۰ تا ۲۴ پیکسل)</span><input type="number" id="appearanceSpacing" min="0" max="24" step="1"></label></fieldset>
 <button type="button" class="btn btn-secondary" id="appearanceResetTarget">حذف تغییرات این بخش</button></div>
 <section class="appearance-sample" aria-label="پیش نمایش نمونه"><strong>پیش‌نمایش نمونه</strong><p>نمونهٔ تقریبی؛ همهٔ وضعیت‌ها و اندازهٔ صفحه‌ها را پیش از انتشار بررسی کنید.</p><div id="appearanceSample" class="appearance-sample-box"><b>نمونه متن و کادر</b><span>شماره سفارش: ۱۲۳۴۵۶</span><button type="button" class="btn btn-primary">نمونه دکمه</button></div></section></div>
 <div id="appearanceError" class="form-error" role="alert"></div><div id="appearanceStatus" role="status"></div><div class="appearance-actions"><button type="button" class="btn btn-secondary" id="appearanceSave">ذخیره پیش‌نویس</button><button type="button" class="btn btn-primary" id="appearancePublish">انتشار برای همه</button><button type="button" class="btn btn-secondary" id="appearanceRestore">بازگردانی طرح قبلی</button></div></section>`;
 const $local=id=>host.querySelector('#'+id), fields={background:$local('appearanceBackground'),color:$local('appearanceColor'),fontSize:$local('appearanceFontSize'),borderRadius:$local('appearanceBorderRadius'),spacing:$local('appearanceSpacing')};
 const status=$local('appearanceStatus'),error=$local('appearanceError'),sample=$local('appearanceSample'),targetSelect=$local('appearanceTarget');
 const pickers={background:$local('appearanceBackgroundPicker'),color:$local('appearanceColorPicker')};
 const show=()=>{const v=draft.screen?.[target]||{};for(const [key,input] of Object.entries(fields))input.value=v[key]??'';pickers.background.value=v.background||'#ffffff';pickers.color.value=v.color||'#000000';updateSample();};
 function updateSample(){const v=draft.screen?.[target]||{};sample.style.background=v.background||'';sample.style.color=v.color||'';sample.style.fontSize=v.fontSize==null?'':v.fontSize+'px';sample.style.borderRadius=v.borderRadius==null?'':v.borderRadius+'px';sample.style.padding=v.spacing==null?'':v.spacing+'px';}
 function update(){
  dirty=true;status.textContent='تغییرات هنوز ذخیره نشده‌اند.';error.textContent='';const v={};
  for(const [key,input] of Object.entries(fields)){
   const raw=input.value.trim();if(!raw)continue;
   if(key==='background'||key==='color'){if(!/^#[0-9a-f]{6}$/i.test(raw)){error.textContent='رنگ باید مانند #aabbcc باشد.';return false;}v[key]=raw.toLowerCase();}
   else{const n=Number(raw),min=key==='fontSize'?9:0,max=key==='spacing'?24:30;if(!Number.isInteger(n)||n<min||n>max){error.textContent='اندازه واردشده معتبر نیست.';return false;}v[key]=n;}
  }
  draft.screen||={};draft.screen[target]=v;for(const key of ['background','color'])if(v[key])pickers[key].value=v[key];updateSample();return true;
 }
 for(const input of Object.values(fields))input.addEventListener('input',update);
 for(const [key,input] of Object.entries(pickers))input.addEventListener('input',()=>{fields[key].value=input.value;update();});
 targetSelect.addEventListener('change',()=>{target=targetSelect.value;show();});
 $local('appearanceResetTarget').onclick=()=>{delete draft.screen[target];dirty=true;status.textContent='تغییرات هنوز ذخیره نشده‌اند.';show();};
 async function action(fn){if(busy)return;busy=true;const controls=[...host.querySelectorAll('button,input,select')],wasDisabled=controls.map(x=>x.disabled);controls.forEach(x=>{x.disabled=true;});try{await fn();}catch(e){error.textContent=e.message||'درخواست انجام نشد.';}finally{busy=false;controls.forEach((x,i)=>{x.disabled=wasDisabled[i];});}}
 $local('appearanceSave').onclick=()=>action(async()=>{if(!update())return;state=await api('/api/admin/appearance/draft',{method:'PUT',body:JSON.stringify({draftRevision:state.draftRevision,settings:draft})});draft=JSON.parse(JSON.stringify(state.draft.settings));dirty=false;error.textContent='';status.textContent='پیش‌نویس ذخیره شد؛ هنوز برای کاربران منتشر نشده است.';});
 $local('appearancePublish').onclick=()=>action(async()=>{if(dirty||!state.draft){error.textContent='ابتدا پیش‌نویس را ذخیره کنید.';return;}if(!confirm('طرح ذخیره‌شده برای همه کاربران منتشر شود؟ سندهای چاپی در این نسخه تغییر نمی‌کنند.'))return;state=await api('/api/admin/appearance/publish',{method:'POST',body:JSON.stringify({version:state.version,draftRevision:state.draftRevision})});draft=JSON.parse(JSON.stringify(state.published));dirty=false;error.textContent='';status.textContent='طرح منتشر شد؛ کاربران پس از تازه‌سازی، حداکثر تا چند ثانیه آن را می‌بینند.';show();await window.BTAppearance.refresh();});
 $local('appearanceRestore').onclick=()=>action(async()=>{if(!confirm('طرح منتشرشده قبلی بازگردانده شود؟ پیش‌نویس فعلی حذف می‌شود.'))return;state=await api('/api/admin/appearance/restore',{method:'POST',body:JSON.stringify({version:state.version,draftRevision:state.draftRevision})});draft=JSON.parse(JSON.stringify(state.published));dirty=false;error.textContent='';status.textContent='طرح قبلی بازگردانده شد.';show();await window.BTAppearance.refresh();});
 status.textContent=state.draft?'پیش‌نویس ذخیره‌شده آماده بررسی است.':'طرح منتشرشده نمایش داده می‌شود.';show();
}
