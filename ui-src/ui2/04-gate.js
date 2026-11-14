function gtQueueRow(v){
  return `<div class="sd-queue-row" style="grid-template-columns:auto minmax(0,1fr) auto;cursor:default">
    <span class="sd-avatar">${esc(initials(v.customer?.name||''))}</span>
    <span class="sd-queue-main"><strong>${esc(v.customer?.name||'—')}</strong><span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px">${v.customer?.code?`<span class="sd-chip cust-code-chip">${esc(v.customer.code)}</span>`:''}${plateViewHtml(v.customer?.plate, 'بدون پلاک', true)}<span class="sd-chip">${esc(v.customer?.phone||'—')}</span></span></span>
    ${badge(v.status)}
  </div>`;
}

function gateDispatchFocusMarkup(data){
  const rows=data.leaving||[];
  const cards=rows.map(o=>gateDispatchCard(o,'exit')).join('')||sdEmpty('truck','سفارشی در انتظار تأیید خروج نیست','پس از ثبت خروج راننده یا تأیید سرویس فروشگاه توسط فروش، محموله برای کنترل در این بخش نمایش داده می‌شود.');
  return `<section class="sd-panel gate-dispatch-focus" aria-label="در انتظار تأیید خروج"><div class="gate-tab-context"><p>خروج پخش و سرویس‌های تأییدشده فروش را پس از کنترل تأیید کنید.</p><span class="sd-count"><strong>${qty(rows.length)}</strong><span>سفارش</span></span></div><div class="adm-list dsp-list gate-dispatch-vertical-list">${cards}</div></section>`;
}
function gateDispatchTabsHtml(data,active,error=''){
  const nav=`<div class="gate-dispatch-tabs" role="tablist" aria-label="مراحل پخش"><button type="button" role="tab" aria-selected="true" class="active" data-gate-dispatch-tab="leaving">در انتظار تأیید خروج <b class="gate-dispatch-count" data-gate-dispatch-count="leaving">${qty((data.leaving||[]).length)}</b></button></div>`;
  const panel=error?`<div class="gate-dispatch-load-error" role="alert">صف خروج پخش بارگذاری نشد: ${esc(error)}</div>`:gateDispatchFocusMarkup(data);
  return nav+`<div id="gateDispatchPanel" role="tabpanel" aria-label="در انتظار تأیید خروج">${panel}</div>`;
}

async function renderGate(tab){
  if(app.timer){clearInterval(app.timer);app.timer=null;}
  app.sub.gate=tab;
  app.gateRenderSeq=(Number(app.gateRenderSeq)||0)+1;
  const renderSeq=app.gateRenderSeq;
  const visits=(await api('/api/visits'+(tab==='history'&&app.gateHistoryQ?'?q='+encodeURIComponent(app.gateHistoryQ):''))).visits||[];
  let dispatchData={awaitingDriver:[],leaving:[],inTransit:[]};
  let dispatchError='';
  try{dispatchData=await api('/api/gate/dispatch');}
  catch(err){dispatchError=err.message||'صف خروج ارسالی بارگذاری نشد.';}
  const exitHistory=tab==='history'?(await api('/api/gate/exit-history')).orders||[]:[];
  const exitOrders=tab==='exit'?((await api('/api/orders?status=SETTLED')).orders||[]):[];
  const pickupExits=tab==='exit'&&app.features?.pickupStaging?(await fetchPagedList('/api/pickup/active','orders')).orders:[];
  if(app.page!=='gate'||app.sub.gate!==tab||app.gateRenderSeq!==renderSeq)return;
  let html='<span class="gate-ui-build" data-ui-build="37.3.18" hidden></span><div class="gate-workspace-content">';
  if(tab==='entry')html+=renderGateEntry();
  else if(tab==='waiting')html+=renderGateWaiting(visits.filter(v=>v.status==='WAITING_SALES'));
  else if(tab==='history')html+=`<div class="gate-history-search"><label for="gateHistorySearch">جستجوی سوابق مراجعه</label><input id="gateHistorySearch" type="search" maxlength="80" value="${esc(app.gateHistoryQ||'')}" placeholder="نام، شماره تماس، پلاک، کد یا هدف مراجعه" autocomplete="off"><small>آخرین ۱۰۰ نتیجه نمایش داده می‌شود.</small></div><div id="gateHistoryLive" aria-live="polite">${renderGateHistory(visits,true)}</div><section class="sd-panel sd-pad"><h2>سوابق خروج سفارش‌ها</h2>${exitHistory.map(o=>`<article class="gt-exit-card"><strong>${esc(storeAwareOrderName(o))}</strong><span>سفارش ${esc(fa(o.orderNo||'—'))}${o.serviceRun?' · سرویس '+fa(o.serviceRun):''}</span><button class="btn btn-secondary" data-action="gate-order-history" data-id="${esc(o.id)}">جزئیات اقلام خروج</button></article>`).join('')||'<p>خروجی ثبت نشده است.</p>'}</section>`;
  else if(tab==='exit')html+=renderGateExit(exitOrders)+(app.features?.pickupStaging?`<div id="pickupExitPanel">${renderPickupExits(pickupExits)}</div>`:'');
  else if(tab==='dispatch'){app.gateDispatchTab='leaving';html+=gateDispatchTabsHtml(dispatchData,app.gateDispatchTab,dispatchError);}
  html+='</div>';
  $('#content').innerHTML=html; bindGate(tab); if(tab==='entry')bindPlate();
  if(tab==='exit'&&app.features?.pickupStaging&&$('#pickupExitPanel'))$('#pickupExitPanel').dataset.signature=JSON.stringify(pickupExits.filter(o=>o.cancellation?.status==='EXIT_APPROVED'||(o.status==='SETTLED'&&o.handover)));
  dsp.sigs.gate=JSON.stringify(dispatchData);
  const sync=document.createElement('div');sync.id='gateSyncState';sync.className='bt-sync-state';sync.setAttribute('role','status');sync.textContent='آخرین به‌روزرسانی: '+(typeof serverNow==='function'?serverNow():new Date()).toLocaleTimeString('fa-IR');$('#content').append(sync);
  startGateDispatchLive();
}

function renderGateEntry(){
  return `<section class="sd-panel gt-entry-panel">
    <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico">${icon('gate',20)}</span><div><h2 data-gate-entry-title>ثبت ورود مشتری</h2><p data-gate-entry-help>اطلاعات مشتری و وسیله یک‌بار ثبت می‌شود؛ دفعه‌ی بعد سوابق پلاک قابل انتخاب است.</p></div></div><span class="badge blue" data-gate-entry-badge>ورود مستقیم به صف فروش</span></div>

    <form id="gateForm" autocomplete="on">
      <section class="gt-search-panel" aria-labelledby="gateSearchTitle">
        <h3 id="gateSearchTitle">جست‌وجوی مشتری و سفارش</h3>
        <div class="gt-search-grid">
          ${app.features?.pickupStaging?`<div class="gt-order-search" data-pickup-search><label for="pickupOrderSearch">جست‌وجوی سفارش غیرحضوری برای تحویل در انبار</label><div class="cust-code-row"><input id="pickupOrderSearch" type="search" maxlength="80" placeholder="شماره سفارش، نام یا شماره تماس صاحب سفارش"><button type="button" class="btn btn-secondary" data-pickup-clear hidden>بازگشت به ورود عادی</button></div><div data-pickup-results aria-live="polite"></div><div data-pickup-selected></div></div>`:''}
          <div class="cust-code-entry"><div class="field"><label for="gateCustCode">جستجوی مشتری <small>(کد، نام، تماس یا پلاک)</small></label><div class="cust-code-row"><div class="input-shell"><span>${icon('search',16)}</span><input id="gateCustCode" name="customerSearch" autocomplete="off" placeholder="کد، نام، تماس یا پلاک" aria-controls="gateCustomerResults" aria-autocomplete="list" aria-expanded="false" role="combobox"></div><button type="button" class="btn btn-secondary" data-action="gate-code-lookup">جستجو</button></div></div><input type="hidden" name="customerId" id="gateCustId"><input type="hidden" name="customerCode" id="gateCustomerCodeValue"><div id="gateCustomerResults" class="gate-customer-results" aria-live="polite"></div><div id="gateCustChip"></div></div>
        </div>
      </section>
      <div class="sd-pad gt-entry-pad">
        <div class="gt-fieldset">
          <div class="gt-fieldset-title" data-gate-person-title>${icon('user',16)} مشخصات مشتری</div>
          <div class="gt-entry-cust">

            <div class="field"><label for="gateCustomerName">نام و نام خانوادگی</label><div class="input-shell"><span>${icon('user',16)}</span><input id="gateCustomerName" name="name" required placeholder="نام مشتری"></div></div>
            <div class="field"><label for="gateCustomerPhone">شماره تماس</label><div class="input-shell"><span>${icon('phone',16)}</span><input id="gateCustomerPhone" name="phone" required inputmode="tel" placeholder="۰۹۱۲ ..."></div></div>
          </div>
        </div>
        <div class="gt-fieldset">
          <div class="gt-fieldset-title">${icon('truck',16)} وسیله نقلیه <small>پلاک با قالب استاندارد ایران</small><label class="gt-switch"><input type="checkbox" id="noVehicle"> بدون وسیله</label></div>
          <div class="gt-entry-vehicle">
            <div class="gt-plate-col"><div id="plateBox"></div><div id="plateSuggest" class="gt-suggest"></div></div>
            <div class="gt-entry-vehicle-fields">
              <div class="field" id="gateVehicleTypeField"><label for="gateVehicleType">نوع وسیله</label><div class="input-shell"><select id="gateVehicleType" name="vehicleType"><option>خودرو</option><option>موتورسیکلت</option></select></div></div>
              <div class="field" id="gateCarTypeField"><label for="gateCarType">نوع خودرو</label><div class="input-shell"><input id="gateCarType" name="carType" maxlength="80" required placeholder="مثلاً پژو یا وانت"></div></div>
              <div class="field"><label for="gatePurpose">هدف مراجعه</label><div class="input-shell"><input id="gatePurpose" name="purpose" placeholder="خرید، دریافت سفارش یا توضیح کوتاه"></div></div>
            </div>
          </div>
        </div>
      </div>
      <div class="sd-submit-bar"><small data-gate-entry-submit-help>پس از ثبت، اعلان فوری برای کارتابل فروش ارسال می‌شود.</small><button class="btn btn-primary btn-lg" type="submit">${icon('send',16)} ثبت ورود و ارسال به فروش</button></div>
      <div id="gateMsg" class="form-error" style="padding:0 22px 12px"></div>
    </form>
  </section>`;
}

/* v37.15.0 — «در انتظار اقدام فروش» منوی مستقل کارتابل نگهبانی است (قبلاً ستون کنار فرم ثبت ورود بود) */
function renderGateWaiting(queue){
  return `<section class="sd-panel" id="gateWaitingPanel">
    <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--orange-bg);color:var(--orange)">${icon('bell',19)}</span><div><h2>در انتظار اقدام فروش</h2><p>ورودی‌هایی که نگهبانی ثبت کرده و فروش هنوز برایشان سفارش ثبت نکرده است.</p></div></div><div class="sd-count"><strong>${qty(queue.length)}</strong><span>در صف</span></div></div>
    <div class="sd-queue gt-waiting-list" id="gateWaitingRows">${queue.map(gtQueueRow).join('')||sdEmpty('user','صف فعالی وجود ندارد','با ثبت ورود مشتری، وضعیت مراجعه در این فهرست دیده می‌شود.')}</div>
    <div style="padding:0 20px 18px"><div class="sd-live-note"><i></i> پس از ثبت سفارش توسط فروش، مورد از این فهرست خارج می‌شود؛ این نما به‌صورت خودکار به‌روز می‌شود.</div></div>
  </section>`;
}

function renderGateHistory(visits,hideHeading=false){
  return `<section class="sd-panel">
    ${hideHeading?'':`<div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--blue-bg);color:var(--blue)">${icon('reports',19)}</span><div><h2>سوابق مراجعه</h2><p>آخرین ورودهای ثبت‌شده و وضعیت هر مراجعه.</p></div></div><div class="sd-count"><strong>${qty(visits.length)}</strong><span>مراجعه</span></div></div>`}
    <div class="gt-table-pad"><div class="table-wrap"><table class="table gt-table"><thead><tr><th>مشتری</th><th>پلاک</th><th>نوع وسیله</th><th>محله</th><th>هدف</th><th>وضعیت</th><th>زمان</th></tr></thead><tbody>${visits.map(v=>`<tr><td><div class="gt-cust-cell"><span class="sd-avatar">${esc(initials(v.customer?.name||''))}</span><div><strong>${esc(v.customer?.name||'—')}</strong><small>${esc(v.customer?.phone||'')}</small>${v.recipient?`<small>تحویل‌گیرنده: ${esc(v.recipient.name||'—')} • ${esc(v.recipient.phone||'')}</small>`:''}</div></div></td><td>${plateViewHtml(v.plate ?? v.customer?.plate, 'بدون پلاک', true)}</td><td>${esc([v.vehicleType ?? v.customer?.vehicleType, v.carType ?? v.customer?.carType].filter(Boolean).join(' — ')||'—')}</td><td>${esc(v.district||'—')}</td><td>${esc(v.purpose||'—')}</td><td>${badge(v.status)}</td><td>${dt(v.createdAt)}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">سابقه‌ای ثبت نشده است.</td></tr>'}</tbody></table></div></div>
  </section>`;
}

function gateExitRow(o){
  const field=(label,text,html)=>`<div class="gt-exit-field" title="${esc(label+': '+text)}"><small>${esc(label)}</small><span>${html??esc(text)}</span></div>`;
  const phone=storeAwareOrderPhone(o),name=storeAwareOrderName(o),plate=o.customer?.plate||'بدون پلاک';
  return `<article class="gt-exit-card" data-order="${esc(o.id)}">${field('مشتری',name)}${field('شماره و تاریخ سفارش',fa(o.orderNo||'—')+' • '+dt(o.createdAt))}${field('پلاک',fa(plate),plateViewHtml(o.customer?.plate,'بدون پلاک',true))}${field('شماره تماس',fa(phone))}${field('تعداد اقلام',String(activeItemsOf(o).length),qty(activeItemsOf(o).length)+' قلم')}<div class="gt-exit-actions"><button class="btn btn-success btn-sm" data-action="open-exit" data-id="${esc(o.id)}">${icon('check',14)} کنترل خروج</button></div></article>`;
}
function renderGateExit(orders){
  if(app.features?.pickupStaging)orders=orders.filter(o=>!o.pickupHandover);
  return `<section class="sd-panel gt-exit-panel">
    <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--green-bg);color:var(--green)">${icon('check',19)}</span><div><h2>سفارش‌های آماده خروج</h2><p>اقلام و وزن سفارش‌های مجاز به خروج را با بار واقعی تطبیق دهید.</p></div></div><div class="sd-count"><strong>${qty(orders.length)}</strong><span>آماده</span></div></div>
    <div class="gt-exit-list" id="gateExitRows">${orders.map(gateExitRow).join('')||sdEmpty('check','فاکتور آماده خروج وجود ندارد','پس از تسویه هر سفارش، فاکتور آن برای کنترل خروج اینجا قرار می‌گیرد.')}</div>
    <div id="exitEditor" style="padding:0 20px 20px"></div>
  </section>`;
}

function renderPickupExits(orders){
 const rows=orders.filter(o=>o.cancellation?.status==='EXIT_APPROVED'||(o.status==='SETTLED'&&o.handover));
 return `<section class="sd-panel"><div class="sd-head"><h2>خروج مراجعهٔ سفارش غیرحضوری</h2><span>${qty(rows.length)} آماده خروج</span></div>${rows.map(o=>`<article class="sd-pad" data-pickup-exit="${esc(o.id)}"><p><b>سفارش ${esc(fa(o.orderNo||'—'))}</b> • صاحب سفارش: ${esc(o.customerName)} • ${esc(fa(o.customerPhone))}</p><p>تحویل‌گیرنده: <b>${esc(o.recipient?.name||'—')}</b> • ${esc(fa(o.recipient?.phone||''))} • ${esc([o.recipient?.vehicleType,o.recipient?.carType,o.recipient?.plate].filter(Boolean).join(' — '))}</p>${o.cancellation?.status==='EXIT_APPROVED'?`<p>خروج بدون کالا؛ انصراف توسط انبار و فروش تأیید شده است.</p><button type="button" class="btn btn-success" data-action="pickup-cancellation-exit" data-id="${esc(o.id)}">ثبت خروج بدون کالا</button>`:`<p>کالا را با اقلام تحویلی زیر تطبیق دهید:</p>${o.items.map(i=>`<label class="gt-check"><input type="checkbox" data-pickup-check="${esc(i.itemId)}"><span>${esc(i.productName)} • ${qty(i.deliveredKg)} کیلوگرم</span></label>`).join('')}<button type="button" class="btn btn-success" data-action="pickup-goods-exit" data-id="${esc(o.id)}">ثبت خروج کالا</button>`}</article>`).join('')||'<p class="sd-pad">خروجی آماده نیست.</p>'}</section>`;
}
async function refreshPickupExit(){
 const host=$('#pickupExitPanel');if(!host||!app.features?.pickupStaging)return;
 try{const rows=(await fetchPagedList('/api/pickup/active','orders')).orders;const sig=JSON.stringify(rows.filter(o=>o.cancellation?.status==='EXIT_APPROVED'||(o.status==='SETTLED'&&o.handover)));if(host.dataset.signature!==sig){host.innerHTML=renderPickupExits(rows);host.dataset.signature=sig;}}catch(e){throw new Error('به‌روزرسانی خروج سفارش غیرحضوری ناموفق بود: '+e.message);}
}
function bindGate(tab){
  const c=$('#content');
  c.onclick=async e=>{
    const dispatchTab=e.target.closest('[data-gate-dispatch-tab]');
    if(dispatchTab){app.gateDispatchTab='leaving';return;}
    const b=e.target.closest('[data-sub]');
    if(b){const [k,v]=b.dataset.sub.split(':'); if(k==='gate'){app.sub.gate=v; return renderGate(v);} return;}
    const gateAction=e.target.closest('[data-gate]');
    if(gateAction&&c.contains(gateAction))return handleGateDispatchAction(gateAction);
    const el=e.target.closest('[data-action]'); if(!el||!c.contains(el))return;
    const a=el.dataset.action;
    if(a==='pickup-goods-exit'||a==='pickup-cancellation-exit'){const card=el.closest('[data-pickup-exit]');const checkedItems=[...card.querySelectorAll('[data-pickup-check]:checked')].map(x=>x.dataset.pickupCheck);if(!confirm(a==='pickup-goods-exit'?'کالا با اقلام سند تطبیق داده شد و خروج ثبت شود؟':'خروج بدون کالا ثبت شود؟'))return;el.disabled=true;try{await api('/api/pickup/'+encodeURIComponent(el.dataset.id)+(a==='pickup-goods-exit'?'/goods-exit':'/cancellation-exit'),{method:'POST',body:JSON.stringify({checkedItems})});toast('خروج ثبت شد.');await renderGate('exit');await refreshIndicators();}catch(err){el.disabled=false;toast(err.message);}return;}
    if(a==='gate-order-history')return gateOrderHistory(el.dataset.id);
    if(a==='open-exit')return openExit(el.dataset.id,el);
    if(a==='confirm-exit')return confirmExit(el.dataset.id);
    if(a==='pick-customer')return pickCustomer(Number(el.dataset.index));
  };
  const f=$('#gateForm'); if(f)f.addEventListener('submit',submitGate);
  if(app.features?.pickupStaging)bindPickupGateEntry();
  const nv=$('#noVehicle'); if(nv)nv.addEventListener('change',()=>{const box=$('#plateBox');if(box)box.hidden=nv.checked;if(nv.checked&&$('#plateSuggest'))$('#plateSuggest').innerHTML='';syncGateVehicleFields();});
  f?.elements.vehicleType?.addEventListener('change',syncGateVehicleFields);syncGateVehicleFields();
  const history=$('#gateHistorySearch');if(history)history.addEventListener('input',()=>queueGateHistorySearch(history));
  if($('#plateBox'))$('#plateBox').innerHTML=plateEditorHtml('',f?.elements.vehicleType?.value||'');
}

function bindPickupGateEntry(){
 const input=$('#pickupOrderSearch'),results=document.querySelector('[data-pickup-results]'),selected=document.querySelector('[data-pickup-selected]'),clear=document.querySelector('[data-pickup-clear]');
 if(!input||!results||!selected||!clear)return;
 let timer=0,seq=0,rows=[];app.pickupSelected=null;
 input.addEventListener('input',()=>{clearTimeout(timer);const search=input.value.trim(),id=++seq;if(search.length<2){results.innerHTML='';return;}
  timer=setTimeout(async()=>{try{const data=await api('/api/pickup/orders?q='+encodeURIComponent(search));if(seq!==id||!input.isConnected)return;rows=data.orders||[];results.innerHTML=rows.map((o,i)=>`<div class="order-compact-row"><span>سفارش ${esc(fa(o.orderNo||'—'))}</span><b>${esc(o.customerName||'—')}</b><span>${esc(fa(o.customerPhone||''))}</span><span>تاریخ تحویل: ${esc(o.deliveryDate?dateLabel(o.deliveryDate):'تعیین نشده')}</span><button type="button" class="btn btn-secondary btn-sm" data-pickup-choose="${i}" ${o.hasOpenVisit?'disabled':''}>${o.hasOpenVisit?'مراجعه باز دارد':'انتخاب سفارش'}</button></div>`).join('')||'<p>سفارشی یافت نشد.</p>';}catch(e){if(seq===id)results.textContent='خطا در جست‌وجو: '+e.message;}},250);
 });
 const name=$('#gateCustomerName'),phone=$('#gateCustomerPhone');
 let otherDraft={name:'',phone:''};
 function resetPickupVehicle(){
  const form=$('#gateForm');form.elements.vehicleType.value='خودرو';form.elements.carType.value='';form.elements.purpose.value='';$('#noVehicle').checked=false;$('#plateBox').hidden=false;
  app.plate={a:'',letter:'ب',c:'',province:''};$('#plateBox').innerHTML=plateEditorHtml('','خودرو');$('#plateSuggest').innerHTML='';app.customerMatches=[];bindPlate();syncGateVehicleFields();
 }
 function setRecipientMode(other){
  if(!app.pickupSelected)return;
  name.readOnly=!other;phone.readOnly=!other;
  name.value=other?otherDraft.name:app.pickupSelected.customerName||'';
  phone.value=other?otherDraft.phone:app.pickupSelected.customerPhone||'';
  document.querySelector('label[for=gateCustomerName]').textContent=other?'نام تحویل‌گیرنده':'نام صاحب سفارش';
  document.querySelector('label[for=gateCustomerPhone]').textContent=other?'شماره تماس تحویل‌گیرنده':'شماره تماس صاحب سفارش';
  document.querySelector('[data-gate-person-title]').textContent=other?'مشخصات تحویل‌گیرنده':'مشخصات صاحب سفارش';
  document.querySelector('[data-pickup-mode-help]').textContent=other?'مشخصات شخصی که واقعاً برای تحویل مراجعه کرده است را وارد کنید.':'خود صاحب سفارش برای تحویل مراجعه کرده است.';
 }
 selected.addEventListener('change',e=>{
  if(!e.target.matches('[data-pickup-other]'))return;
  if(!e.target.checked)otherDraft={name:name.value,phone:phone.value};
  setRecipientMode(e.target.checked);if(e.target.checked)name.focus();
 });
 results.addEventListener('click',e=>{
  const button=e.target.closest('[data-pickup-choose]');if(!button)return;
  const o=rows[Number(button.dataset.pickupChoose)];if(!o)return;
  ++seq;clearTimeout(timer);app.pickupSelected=o;otherDraft={name:'',phone:''};resetPickupVehicle();
  selected.innerHTML=`<p>سفارش ${esc(fa(o.orderNo||'—'))} • صاحب سفارش: ${esc(o.customerName||'—')} • ${esc(fa(o.customerPhone||''))}</p><label class="gt-switch"><input type="checkbox" data-pickup-other> ثبت تحویل‌گیرنده</label> <span data-pickup-mode-help></span>`;
  results.innerHTML='';input.disabled=true;clear.hidden=false;
  $('#gateCustCode').value='';$('#gateCustCode').disabled=true;document.querySelector('.cust-code-entry').style.display='none';
  $('#gateCustId').value='';$('#gateCustomerCodeValue').value='';$('#gateCustomerResults').innerHTML='';$('#gateCustChip').innerHTML='';$('#plateSuggest').innerHTML='';app.customerMatches=[];
  document.querySelector('[data-gate-entry-title]').textContent='ثبت ورود برای تحویل سفارش';
  document.querySelector('[data-gate-entry-help]').textContent='اگر شخص دیگری برای تحویل مراجعه کرده، گزینه ثبت تحویل‌گیرنده را فعال کنید.';
  document.querySelector('[data-gate-entry-badge]').textContent='مراجعه برای تحویل در انبار';
  document.querySelector('[data-gate-entry-submit-help]').textContent='پس از ثبت، به انبار اطلاع داده می‌شود؛ سفارش تازه‌ای ساخته نمی‌شود.';
  $('#gateForm button[type=submit]').textContent='ثبت ورود برای تحویل';setRecipientMode(false);
 });
 clear.addEventListener('click',()=>{
  ++seq;clearTimeout(timer);app.pickupSelected=null;otherDraft={name:'',phone:''};selected.innerHTML='';results.innerHTML='';input.disabled=false;input.value='';clear.hidden=true;
  name.readOnly=false;phone.readOnly=false;name.value='';phone.value='';resetPickupVehicle();
  document.querySelector('label[for=gateCustomerName]').textContent='نام و نام خانوادگی';document.querySelector('label[for=gateCustomerPhone]').textContent='شماره تماس';
  $('#gateCustCode').disabled=false;document.querySelector('.cust-code-entry').style.display='';
  document.querySelector('[data-gate-entry-title]').textContent='ثبت ورود مشتری';document.querySelector('[data-gate-entry-help]').textContent='اطلاعات مشتری و وسیله یک‌بار ثبت می‌شود؛ دفعه‌ی بعد سوابق پلاک قابل انتخاب است.';
  document.querySelector('[data-gate-entry-badge]').textContent='ورود مستقیم به صف فروش';document.querySelector('[data-gate-person-title]').textContent='مشخصات مشتری';
  document.querySelector('[data-gate-entry-submit-help]').textContent='پس از ثبت، اعلان فوری برای کارتابل فروش ارسال می‌شود.';$('#gateForm button[type=submit]').textContent='ثبت ورود و ارسال به فروش';
 });
}

function syncGateVehicleFields(){
 const f=$('#gateForm'),field=$('#gateCarTypeField'),input=$('#gateCarType');if(!f||!field||!input)return;
 const none=!!$('#noVehicle')?.checked,vehicleField=$('#gateVehicleTypeField'),plateCol=f.querySelector('.gt-plate-col'),grid=f.querySelector('.gt-entry-vehicle');
 if(vehicleField)vehicleField.hidden=none;if(plateCol)plateCol.hidden=none;if(grid)grid.classList.toggle('is-no-vehicle',none);f.elements.vehicleType.disabled=none;
 const show=!none&&f.elements.vehicleType.value==='خودرو';field.hidden=!show;input.disabled=!show;input.required=show;
}
let gateHistoryTimer=null,gateHistorySeq=0;
function queueGateHistorySearch(input){
 clearTimeout(gateHistoryTimer);const seq=++gateHistorySeq;app.gateHistoryQ=input.value.trim();
 gateHistoryTimer=setTimeout(async()=>{try{const q=app.gateHistoryQ;const result=await api('/api/visits'+(q?'?q='+encodeURIComponent(q):''));if(seq!==gateHistorySeq||!input.isConnected||app.sub.gate!=='history'||q!==app.gateHistoryQ)return;const host=$('#gateHistoryLive');if(host)host.innerHTML=renderGateHistory(result.visits||[],true);}catch(e){if(seq===gateHistorySeq&&input.isConnected){const host=$('#gateHistoryLive');if(host)host.innerHTML=`<p role="alert">جستجو ناموفق بود: ${esc(e.message||'خطای دریافت')}</p>`;}}},200);
}

/* پلاک ایران — ظاهر جدید، همان کلاس‌ها */
function plateMarkup(p){
  const letters=['ب','پ','ت','ث','ج','چ','ح','خ','د','ذ','ر','ز','ژ','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ک','گ','ل','م','ن','و','ه','ی'];
  return `<div class="iran-plate"><div class="blue-strip"><span>IR<br>ایران</span></div><div class="plate-part"><input class="plate-a" maxlength="2" inputmode="numeric" value="${esc(p.a||'')}" placeholder="۱۲" aria-label="دو رقم اول"></div><div class="plate-part"><select class="plate-letter" aria-label="حرف پلاک">${letters.map(l=>`<option ${l===(p.letter||'ب')?'selected':''}>${l}</option>`).join('')}</select></div><div class="plate-part"><input class="plate-c" maxlength="3" inputmode="numeric" value="${esc(p.c||'')}" placeholder="۳۴۵" aria-label="سه رقم"></div><div class="plate-part plate-code"><input class="plate-province" maxlength="2" inputmode="numeric" value="${esc(p.province||'')}" placeholder="۶۷" aria-label="کد استان"></div></div><div class="plate-preview">${formatPlate(p)||'نمونه: ۱۲ ب ۴۵ - ۷'}</div>`;
}

/* کنترل خروج — برگه بررسی مدرن */
async function openExit(id,btn){
  const notices=captureEntityNotices('order',id);
  const host=$('#exitEditor');
  // v37.34.0 — بازخورد فوری: کلیک «کنترل خروج» هرگز بی‌واکنش به نظر نمی‌رسد؛
  // برگه بلافاصله با وضعیت بارگذاری باز می‌شود و دکمه تا پایان دریافت اطلاعات قفل است.
  if(host){host.innerHTML=`<section class="sd-panel gt-exit-editor"><div class="gt-exit-loading" role="status">در حال دریافت اطلاعات فاکتور…</div></section>`;host.scrollIntoView({behavior:'smooth',block:'nearest'});}
  if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');}
  try{
    const d=await api('/api/orders/'+id); const o=d.order;
    if(!$('#exitEditor'))return;
    $('#exitEditor').innerHTML=`<section class="sd-panel gt-exit-editor">
      <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--green-bg);color:var(--green)">${icon('truck',19)}</span><div><h2>کنترل خروج — ${esc(fa(o.payment?.invoiceNumber||o.orderNo||'—'))}</h2><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px"><span>${esc(storeAwareOrderName(o))}</span>${plateViewHtml(o.customer?.plate, 'بدون پلاک', true)}</div></div></div></div>
      <div class="sd-pad">
        <div class="gt-check-list">${o.items.filter(i=>i.itemStatus!=='CANCELLED').map(i=>`<label class="gt-check"><input type="checkbox" data-exit-item="${i.id}" checked><span><b>${esc(i.product?.name||'—')}</b><small>${qty(i.deliveredKg)} کیلوگرم</small></span>${badge(i.itemStatus)}</label>`).join('')}</div>
      </div>
      <p id="exitMsg" class="form-error gt-exit-msg" role="alert" hidden></p>
      <div class="sd-submit-bar"><small>همه اقلام فاکتور را با بار واقعی تطبیق دهید.</small><button class="btn btn-success btn-lg" data-action="confirm-exit" data-id="${id}">${icon('check',16)} ثبت خروج نهایی</button></div>
    </section>`;
    $('#exitEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
    finishEntityNotices(notices);return true;
  }catch(e){
    // v37.34.0 — خطا هم داخل خود برگه دیده می‌شود، نه فقط پیام گذرا
    if(host)host.innerHTML=`<section class="sd-panel gt-exit-editor"><p class="form-error gt-exit-msg" role="alert">دریافت اطلاعات فاکتور انجام نشد: ${esc(e.message||'خطای نامشخص')} — دوباره روی «کنترل خروج» بزنید.</p></section>`;
    toast(e.message);
  }finally{
    if(btn&&document.contains(btn)){btn.disabled=false;btn.removeAttribute('aria-busy');}
  }
}

/* ================================================================
   قدم ۳ — بازطراحی انبار (دومرحله‌ای) + کارتابل فروشگاه (v38)
   ================================================================ */

/* ---------------- انبار ---------------- */
app.wh38 = app.wh38 || { phase:'incoming', timer:null, storeTab:'incoming' };
if(!['incoming','preparing','history'].includes(app.wh38.storeTab)) app.wh38.storeTab='incoming'; // v37.36.0 — سربرگ «سوابق و گزارشات» هم مجاز است


async function gateOrderHistory(id){
 try{const rows=(await api('/api/gate/exit-history')).orders||[],o=rows.find(x=>x.id===id);if(!o)throw Error('سابقه خروج یافت نشد.');openModal('جزئیات سفارش خروج‌شده',`<div class="sd-pad"><h2>سفارش ${esc(fa(o.orderNo||'—'))}</h2><p>${esc(storeAwareOrderName(o))}${o.serviceRun?' · سرویس '+fa(o.serviceRun):''}</p><table class="table"><thead><tr><th>محصول</th><th>وزن (کیلوگرم)</th></tr></thead><tbody>${o.items.filter(i=>i.itemStatus!=='CANCELLED').map(i=>`<tr><td>${esc(i.product?.name||'—')}</td><td>${qty(i.deliveredKg)}</td></tr>`).join('')}</tbody></table></div>`);}catch(e){toast(e.message);}
}
