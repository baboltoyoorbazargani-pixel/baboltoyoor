/* ================================================================
   v38 UI LAYER — بازطراحی رابط کاربری (قدم اول: شل + کارتابل فروش)
   این فایل بعد از app.js بارگذاری می‌شود و رندررهای کارتابل فروش را
   با طراحی جدید جایگزین می‌کند. همه‌ی شناسه‌ها و data-actionهایی که
   منطق برنامه به آن‌ها وابسته است، حفظ شده‌اند.
   ================================================================ */
window.BT_UI_BUILD='37.7.4';

/* ---------- کمکی ---------- */
/* fallback plateViewHtml for ui2 — will be overridden by app.js if loaded */
if(typeof plateViewHtml === 'undefined'){
  function plateViewHtml(value, fallback='—', compact=false){
    const raw=String(value||'').trim();
    if(!raw) return `<span style="color:var(--muted);font-size:12px;font-weight:700">${typeof esc==='function'?esc(fallback):fallback}</span>`;
    let a='',letter='',c='',prov='';
    try{
      if(typeof parsePlate==='function'){ const pr=parsePlate(raw); a=pr.a||''; letter=pr.letter||''; c=pr.c||''; prov=pr.province||''; }
      else throw new Error('no parse');
    } catch(e){
      const m=raw.match(/(\d{1,2})\s*([^\d\s\-\.]+)?\s*(\d{1,3})?\s*[-\s]*\s*(\d{1,2})?/);
      if(m){ a=m[1]||''; letter=m[2]||''; c=m[3]||''; prov=m[4]||''; } else { a=raw; }
    }
    const escFn = typeof esc==='function' ? esc : (v=>String(v||''));
    const cls = compact ? 'iran-plate is-readonly is-compact' : 'iran-plate is-readonly';
    return `<div class="${cls}" style="display:inline-grid;vertical-align:middle" dir="ltr"><div class="blue-strip"><span>IR<br>ایران</span></div><div class="plate-part"><span>${escFn(a)}</span></div><div class="plate-part"><span>${escFn(letter)}</span></div><div class="plate-part"><span>${escFn(c)}</span></div><div class="plate-part plate-code"><span>${escFn(prov)}</span></div></div>`;
  }
}

function sdEmpty(name, title, subtitle){
  return `<div class="sd-empty"><div>${icon(name,26)}</div><strong>${esc(title)}</strong><span>${esc(subtitle||'')}</div>`;
}
function sdStatusAccent(status){
  return ({WAREHOUSE_PENDING:'is-orange',WAREHOUSE_PREPARING:'is-purple',RETURNED_TO_SALES:'is-red',ORDERED:'is-blue',SETTLEMENT_PENDING:'is-blue',SETTLED:'is-green',EXITED:'is-green',SCHEDULED_REMOTE:'is-purple',STORE_PENDING_SALES:'is-orange'})[status]||'is-gray';
}
function sdTypeBadge(o){
  if(o?.orderType==='ONSITE') return '<span class="sd-type onsite">حضوری</span>';
  if(o?.orderType==='STORE') return '<span class="sd-type store">فروشگاه</span>';
  return '<span class="sd-type phone">تلفنی</span>';
}

/* جایگزین‌های سبک‌تر برای عنوان/خالی/نوع سفارش */
function salesEmptyV25(name,title,subtitle){ return sdEmpty(name,title,subtitle); }
function salesKindBadge(o){ return sdTypeBadge(o); }
function salesSectionTitle(kicker,title,subtitle,count=''){
  return `<div class="sd-head"><div class="sd-head-main"><h2>${esc(title)}</h2><p>${esc(subtitle||'')}</p></div>${count!==''?`<div class="sd-count"><strong>${qty(count)}</strong><span>مورد</span></div>`:''}</div>`;
}

/* ---------- نوار کناری ---------- */
/* renderNav is centralized in app.js; do not override the role-specific cartable sidebar here. */

/* ---------- نوار تب‌های هفت‌گانه فروش ---------- */
function renderSalesTabsV29(tab){
  const counts=Object.fromEntries(SALES_TABS_V29.map(id=>[id,navUnread('sales',id)]));
  return `<nav class="sd-tabs sd-sales-tabs" aria-label="هفت بخش کارتابل فروش">${SALES_TABS_V29.map((id,i)=>{
    const [label,sub,ico]=SALES_LABELS_V29[id],count=counts[id];
    return `<button type="button" class="sd-tab ${tab===id?'active':''}" data-sales-tab="${id}"><span class="sd-tab-index">${fa(String(i+1).padStart(2,'0'))}</span><span class="sd-tab-ico">${icon(ico,19)}</span><span class="sd-tab-copy"><strong>${esc(label)}</strong><small>${esc(sub)}</small></span><b class="sd-tab-count ${count>0?'show':''}" data-sales-count="${id}">${count>0?qty(count):''}</b></button>`;
  }).join('')}</nav>`;
}

/* ---------- تب ۱: حضوری ---------- */
function renderSalesOnsiteV25(visits){
  return `<section class="sd-pane">
    <section class="sd-panel">
      <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico">${icon('gate',20)}</span><div><h2>مشتریان حضوری</h2><p>فقط مراجعانی که نگهبانی ثبت کرده و در صف فروش قرار دارند. برای ثبت سفارش، مشتری را انتخاب کنید.</p></div></div><div class="sd-count"><strong>${qty(visits.length)}</strong><span>در صف</span></div></div>
      <label class="sd-search">${icon('search',18)}<input id="salesSearchV25" placeholder="جستجوی نام، شماره تماس یا پلاک..."></label>
      <div id="salesOnsiteListV25" class="sd-queue">${salesOnsiteRowsV25(visits)}</div>
    </section>
  </section>`;
}
function salesOnsiteRowsV25(visits){
  return visits.map(v=>`<button type="button" class="sd-queue-row" data-action="open-order" data-id="${v.id}">
    <span class="sd-avatar">${esc(initials(v.customer?.name||''))}</span>
    <span class="sd-queue-main"><strong>${esc(v.customer?.name||'—')}</strong>
      <span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${plateViewHtml(v.customer?.plate, 'بدون پلاک', true)}<span class="sd-chip">${icon('phone',12)} ${esc(v.customer?.phone||'—')}</span>${v.district?`<span class="sd-chip">${esc(v.district)}</span>`:''}</span>
    </span>
    <span class="sd-queue-time"><span class="sd-live-dot"></span> ${formatDateTime24(v.createdAt)}</span>
    <span class="sd-queue-cta">ثبت سفارش ${icon('arrow',14)}</span>
  </button>`).join('')||sdEmpty('user','صف حضوری خالی است','با ثبت مراجعه جدید در نگهبانی، مشتری در این فهرست قرار می‌گیرد.');
}

/* ---------- صفحه ثبت سفارش حضوری ---------- */
async function openOrder(visitId){
  const notices=captureEntityNotices('visit',visitId);
  try{
    const visits=(await api('/api/visits?id='+encodeURIComponent(visitId))).visits||[]; const v=visits.find(x=>x.id===visitId && x.status==='WAITING_SALES'); if(!v)return;
    app.orderDraft=[defaultOrderLine()];
    $('#content').innerHTML=renderSalesTabsV29('onsite')+`<div class="v29-sales-shell">
      <div class="sd-oe-banner">
        <div class="sd-oe-banner-right">
          <button class="btn btn-secondary" data-action="back-order-intake">${icon('arrow',15)} بازگشت</button>
          <div><h2>ثبت سفارش مشتری حضوری</h2><p>اقلام را با کد سریع یا نام محصول انتخاب کنید؛ پس از ثبت، سفارش مستقیم به انبار می‌رود.</p></div>
        </div>
        <div class="sd-oe-banner-actions"><div class="sd-stepper"><span class="done">۱ مشتری</span><i></i><span class="active">۲ سفارش</span><i></i><span>۳ انبار</span></div><span class="badge orange">در انتظار ثبت سفارش</span><button class="btn btn-primary btn-lg" data-action="submit-order" data-id="${visitId}">${icon('send',17)} ثبت و ارسال به انبار</button></div>
      </div>
      <div class="sd-oe-customer">
        <div class="onsite-customer-scroll" role="region" aria-label="مشخصات مشتری و روش تحویل" tabindex="0">
          <div class="onsite-customer-facts">
            <div><span>نام مشتری:</span><strong>${esc(v.customer?.name||'—')}</strong></div>
            <div><span>شماره تماس:</span><strong dir="auto">${esc(v.customer?.phone||'—')}</strong></div>
            <div><span>پلاک:</span>${plateViewHtml(v.customer?.plate, 'بدون پلاک', true)}</div>
            <div><span>زمان ورود:</span><strong>${esc(formatDateTime24(v.createdAt))}</strong></div>
            ${app.features?.experimentalTransport?`<div class="sd-onsite-delivery" title="سفارش بیعانه‌دار فقط تحویل در انبار است.">${deliveryModeInputHtml('onsite')}</div>`:''}
          </div>
        </div>
      </div>
      <div class="sd-oe-layout">
        <section class="sd-panel">
          <div class="sd-lines-head"><div><h3>اقلام سفارش</h3><p>محصول را با نام یا کد سریع دو رقمی انتخاب کنید؛ توضیحات هر ردیف جداگانه ثبت می‌شود.</p></div><span class="sd-chip">کیلوگرم / بسته / عدد / کارتن</span></div>
          <div class="sd-lines-body"><div id="orderLines" class="sd-lines"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;flex-wrap:wrap"><button class="btn btn-secondary" data-action="add-line">${icon('plus',16)} افزودن ردیف محصول</button><span style="font-size:11.5px;color:var(--muted)">برای حذف هر ردیف از آیکن سطل استفاده کنید.</span></div>
          </div>
        </section>
        
      </div>
    </div>`;
    renderOrderLines(); updateOrderDraftSummary();finishEntityNotices(notices);return true;
  }catch(e){toast(e.message);return false;}
}
function renderOrderLines(){
  const box=$('#orderLines'); if(!box)return;
  const units=['کیلوگرم','بسته','عدد','کارتن'];
  box.innerHTML=(app.orderDraft||[]).map((x,i)=>`<article class="sd-line sd-line-compact" data-line="${i}">
    <span class="sd-line-no">${fa(String(i+1).padStart(2,'0'))}</span>
    <div class="sd-line-cell cell-product" style="position:relative">
      <div class="input-shell"><span>${icon('search',14)}</span><input data-product-search="${i}" value="${esc(x.productLabel||'')}" placeholder="محصول (نام/کد سریع)" autocomplete="off" aria-label="محصول ردیف ${fa(String(i+1))}"></div>
      <div class="product-suggest" data-suggest-for="${i}"></div>
      ${x.productId?`<span class="sd-picked-inline" title="انتخاب شد">${icon('check',11)}<span class="code-pill">${esc(x.quickCode||'')}</span></span>`:''}
    </div>
    <div class="sd-line-cell cell-qty"><div class="input-shell"><input data-qty="${i}" inputmode="decimal" value="${esc(x.requestedQty||'')}" placeholder="مقدار" aria-label="مقدار ردیف ${fa(String(i+1))}"></div></div>
    <div class="sd-line-cell cell-unit"><div class="input-shell"><select data-unit="${i}" aria-label="واحد ردیف ${fa(String(i+1))}">${units.map(u=>`<option ${x.requestedUnit===u?'selected':''}>${u}</option>`).join('')}</select></div></div>
    <div class="sd-line-cell cell-desc"><div class="input-shell"><input type="text" data-description="${i}" value="${esc(x.description||'')}" maxlength="500" placeholder="توضیح (اختیاری)" aria-label="توضیح ردیف ${fa(String(i+1))}"></div></div>
    <button type="button" class="sd-line-del" data-action="remove-line" data-index="${i}" title="حذف ردیف" aria-label="حذف ردیف">${icon('trash',15)}</button>
  </article>`).join('');
  $$('#orderLines [data-product-search]').forEach(inp=>inp.addEventListener('input',()=>productSearch(inp.dataset.productSearch,inp.value)));
  $$('#orderLines [data-qty]').forEach(inp=>inp.addEventListener('input',()=>{app.orderDraft[Number(inp.dataset.qty)].requestedQty=inp.value;updateOrderDraftSummary()}));
  $$('#orderLines [data-unit]').forEach(sel=>sel.addEventListener('change',()=>{app.orderDraft[Number(sel.dataset.unit)].requestedUnit=sel.value;updateOrderDraftSummary()}));
  $$('#orderLines [data-description]').forEach(inp=>inp.addEventListener('input',()=>{app.orderDraft[Number(inp.dataset.description)].description=inp.value;}));
}
function updateOrderDraftSummary(){
  const box=$('#orderDraftSummary');if(!box)return;
  const valid=(app.orderDraft||[]).filter(x=>x.productId&&n(x.requestedQty)>0);
  const total=valid.reduce((s,x)=>s+n(x.requestedQty),0);
  box.innerHTML=`<div style="margin-top:10px"><div class="sd-summary-stat"><span>قلم معتبر</span><strong>${qty(valid.length)}</strong></div><div class="sd-summary-stat"><span>مجموع مقدار</span><strong>${qty(total)}</strong></div>
  <div class="sd-summary-list">${valid.map(x=>`<div><span><span class="code-pill">${esc(x.quickCode||'')}</span>${esc(x.productLabel||'')}</span><b>${qty(x.requestedQty)} ${esc(x.requestedUnit||'')}</b></div>`).join('')||'<div class="empty" style="padding:16px 8px;font-size:12px">هنوز قلم معتبری ثبت نشده است.</div>'}</div></div>`;
}

/* ---------- ردیف محصول مشترک (تلفنی / آینده) ---------- */
function renderProductPickerLine(x,i,prefix='sales'){
  const idx=String(i);
  const units=['کیلوگرم','بسته','عدد','کارتن'];
  const draftKey=({remote:'remoteDraft',phone:'phoneDraft',future:'futureDraft',store:'storeDraft',storeedit:'storeEditDraft',sales:'orderDraft',onsite:'orderDraft'})[prefix]||'orderDraft';
  if(prefix==='store'){ /* v37.5.0 — ردیف تک‌خطی فشرده فرم فروشگاه: کادر محصول باریک‌تر، مقدار/واحد/توضیح در یک خط، کمینه ارتفاع */
    return `<article class="sd-line sd-line-compact" data-line="${idx}">
    <span class="sd-line-no">${fa(String(i+1).padStart(2,'0'))}</span>
    <div class="sd-line-cell cell-product" style="position:relative">
      <div class="input-shell"><span>${icon('search',14)}</span><input data-op-product-search="store-${idx}" value="${esc(x.productLabel||'')}" placeholder="محصول (نام/کد)" autocomplete="off" aria-label="محصول ردیف ${fa(String(i+1))}"></div>
      <div class="product-suggest" data-op-suggest="store-${idx}"></div>
      ${x.productId?`<span class="sd-picked-inline" title="انتخاب شد">${icon('check',11)}<span class="code-pill">${esc(x.quickCode||'')}</span></span>`:''}
    </div>
    <div class="sd-line-cell cell-qty"><div class="input-shell"><input data-op-qty="store-${idx}" inputmode="decimal" value="${esc(x.requestedQty||'')}" placeholder="مقدار" aria-label="مقدار ردیف ${fa(String(i+1))}"></div></div>
    <div class="sd-line-cell cell-unit"><div class="input-shell"><select data-op-unit="store-${idx}" aria-label="واحد ردیف ${fa(String(i+1))}">${units.map(u=>`<option ${x.requestedUnit===u?'selected':''}>${u}</option>`).join('')}</select></div></div>
    <div class="sd-line-cell cell-desc"><div class="input-shell"><input type="text" data-op-desc="store-${idx}" value="${esc(x.description||'')}" maxlength="500" placeholder="توضیح (اختیاری)" aria-label="توضیح ردیف ${fa(String(i+1))}"></div></div>
    <button type="button" class="sd-line-del" data-action="op-remove-line" data-prefix="${prefix}" data-draft-key="${draftKey}" data-index="${idx}" title="حذف ردیف" aria-label="حذف ردیف">${icon('trash',15)}</button>
  </article>`;
  }
  return `<article class="sd-line" data-line="${idx}">
    <span class="sd-line-no">${fa(String(i+1).padStart(2,'0'))}</span>
    <div class="sd-line-cell cell-product" style="position:relative"><label>محصول (نام یا کد سریع)</label>
      <div class="input-shell"><span>${icon('search',15)}</span><input data-op-product-search="${prefix}-${idx}" aria-label="محصول ردیف ${fa(String(i+1))}" value="${esc(x.productLabel||'')}" placeholder="مثلاً 01 یا ران مرغ" autocomplete="off"></div>
      <div class="product-suggest" data-op-suggest="${prefix}-${idx}"></div>
      <div class="sd-picked ${x.productId?'':'none'}">${x.productId?`${icon('check',13)} انتخاب شد <span class="code-pill">${esc(x.quickCode||'')}</span>`:'هنوز محصولی انتخاب نشده'}</div>
    </div>
    <div class="sd-line-cell cell-qty"><label>مقدار</label><div class="input-shell"><input data-op-qty="${prefix}-${idx}" aria-label="مقدار ردیف ${fa(String(i+1))}" inputmode="decimal" value="${esc(x.requestedQty||'')}" placeholder="۰"></div></div>
    <div class="sd-line-cell cell-unit"><label>واحد</label><div class="input-shell"><select data-op-unit="${prefix}-${idx}" aria-label="واحد ردیف ${fa(String(i+1))}">${units.map(u=>`<option ${x.requestedUnit===u?'selected':''}>${u}</option>`).join('')}</select></div></div>
    <div class="sd-line-cell cell-desc"><label>توضیحات ردیف</label><div class="input-shell"><input type="text" data-op-desc="${prefix}-${idx}" aria-label="توضیح ردیف ${fa(String(i+1))}" value="${esc(x.description||'')}" maxlength="500" placeholder="توضیح برای انبار..."></div></div>
    <button type="button" class="sd-line-del" data-action="op-remove-line" data-prefix="${prefix}" data-draft-key="${draftKey}" data-index="${idx}" title="حذف ردیف" aria-label="حذف ردیف">${icon('trash',16)}</button>
  </article>`;
}
function renderFutureLineRow(x,i){ return renderProductPickerLine(x,i,'future'); }

/* ---------- تب ۲: غیرحضوری ---------- */
function sdStoreCard(o){
  return `<article class="sd-store-card">
    <div class="sd-store-top">
      <div><div class="sd-chips"><span class="order-code">${esc(fa(o.orderNo||'—'))}</span>${sdTypeBadge(o)}</div>
        <h3>${esc(o.storeName||'فروشگاه')}</h3><p></p></div>
      <span class="badge orange">در انتظار تأیید</span>
    </div>
    <div class="sd-store-items">${activeItemsOf(o).map((it,k)=>`<div><span class="sd-row-no">${fa(String(k+1))}</span><span>${esc(it.product?.name||'—')}</span><b>${qty(it.requestedQty)} ${esc(it.requestedUnit||'')}</b></div>`).join('')||'<div class="empty" style="padding:14px">قلمی در این سفارش ثبت نشده است.</div>'}</div>
    <div class="sd-store-meta"><span><b>ثبت سفارش:</b> ${formatDateTime24(o.createdAt)}</span><span><b>یادداشت:</b> ${esc(o.notes||'بدون یادداشت')}</div>
    <div class="sd-store-foot"><div class="toolbar"><button class="btn btn-secondary btn-sm" data-action="store-order-details-v25" data-id="${o.id}">${icon('eye',14)} جزئیات</button><button class="btn btn-secondary btn-sm" data-action="sales-edit-store-order" data-id="${o.id}">${icon('edit',14)} ویرایش سفارش</button><button class="btn btn-primary btn-sm" data-action="store-approve-v25" data-id="${o.id}">${icon('calendar',14)} تأیید و تعیین زمان</button></div></div>
  </article>`;
}
function remotePhoneQueueRowsV40(orders){
  const queue=(Array.isArray(orders)?orders:[]).filter(o=>o&&o.orderType==='REMOTE'&&['WAREHOUSE_PENDING','WAREHOUSE_PREPARING','RETURNED_TO_SALES','SETTLEMENT_PENDING'].includes(o.status));
  const rows=queue.map(o=>orderSummaryRow(o,{className:'phone-queue-card-v40',statusHtml:badge(o.status),itemCount:activeItemsOf(o).length,extras:[{html:`شماره تماس: ${esc(storeAwareOrderPhone(o)||'—')}`}],actionsHtml:`<button class="btn btn-secondary btn-sm" data-action="order-details" data-id="${esc(o.id)}">${icon('eye',14)} جزئیات سفارش</button>`})).join('');
  return {queue,html:rows||salesEmptyV25('phone','سفارش تلفنی فعالی در روند نیست','پس از ثبت سفارش غیرحضوری، اینجا قابل پیگیری است.')};
}
function renderSalesRemoteV32(orders){
  const all=Array.isArray(orders)?orders:[];
  const {queue,html:queueHtml}=remotePhoneQueueRowsV40(all);
  const phoneQueue=queue;
  return `<section class="sales-pane-v25 sales-pane-v40" data-sales-pane="remote"><div class="sales-panel-v25 telephone-form-v25">
    <div class="sales-section-title-v25 phone-form-title"><h2>ثبت سفارش غیرحضوری</h2></div>
    <form id="phoneOrderFormV25" class="sales-form-v25 sales-form-v40">
      <div class="sales-customer-grid-v25 sales-remote-customer-grid-v40">
        <div class="field contact-field-v41"><label for="phoneCustomerName">نام مشتری</label><div class="input-shell"><span>${icon('user',18)}</span><input id="phoneCustomerName" name="name" required placeholder="نام و نام خانوادگی"></div></div>
        <div class="field contact-field-v41"><label for="phoneCustomerPhone">شماره تماس</label><div class="input-shell"><span>${icon('phone',18)}</span><input id="phoneCustomerPhone" name="phone" required inputmode="tel" placeholder="۰۹۱۲ ..."></div></div>
        <div class="field sales-remote-place-v40"><label for="phoneDispatchPlace">محل ارسال</label><div class="input-shell"><span>${icon('truck',18)}</span><input id="phoneDispatchPlace" name="dispatchPlace" placeholder="مقصد یا آدرس ارسال"></div></div>
        ${app.features?.experimentalTransport?deliveryModeInputHtml('phone'):''}
      </div>
      ${app.features?.pickupStaging?jalaliInput('تاریخ تحویل در انبار','deliveryDate',today(),true):''}
      <div class="sales-items-head-v25"><div><span class="eyebrow">ORDER LINES</span><h3>اقلام سفارش</h3><p>با کلیدهای جهت‌دار محصول را انتخاب کنید؛ Enter از مقدار و واحد به توضیح می‌رود و در پایان ردیف، قلم بعدی را باز می‌کند. Insert نیز ردیف جدید می‌افزاید؛ ارسال فقط با دکمهٔ ثبت انجام می‌شود.</p></div></div>
      <div id="phone-lines" class="op-lines"></div>
      <div class="sales-lines-add-v41"><button type="button" class="btn btn-secondary" data-action="phone-add-line">${icon('plus',18)} افزودن ردیف محصول</button></div>
      <div class="sd-note-box sales-phone-notes-v40"><div class="sd-note-head"><span>${icon('info',17)}</span><div><strong>یادداشت تکمیلی</strong><small>هماهنگی مشتری، بسته‌بندی یا نکته‌ای که لازم است فروش و انبار بدانند.</small></div></div><textarea aria-label="یادداشت تکمیلی سفارش" name="notes" maxlength="1000" rows="4" placeholder="توضیحات سفارش را اینجا وارد کنید..."></textarea><div class="sd-note-foot"><span>حداکثر ۱۰۰۰ نویسه</span><span>متن برای واحد فروش و انبار ذخیره می‌شود.</span></div></div>
      ${depositEntryHtml()}
      <div class="sales-form-bottom-v25"><span class="form-helper-v32">واحدهای مجاز: کیلوگرم، بسته، عدد، کارتن</span><button type="submit" class="btn btn-primary btn-lg">${icon('send',18)} ثبت و ارسال به انبار</button></div>
    </form>
  </div><section class="sales-panel-v25 phone-queue-panel-v40"><div class="sales-section-title-v25"><div><span class="eyebrow">REMOTE ORDERS</span><h2>سفارش‌های تلفنی در روند</h2><p>فقط سفارش‌های غیرحضوری؛ برای ریز اقلام و گردش انبار، جزئیات را باز کنید.</p></div><div class="sales-section-count"><strong>${qty(phoneQueue.length)}</strong><span>سفارش</span></div></div><div class="phone-queue-list-v40">${queueHtml}</div></section></section>`;
}
function sdStoreInvoiceChips(o){
  const pays=Array.isArray(o.payments)?o.payments:[];
  if(!pays.length) return '';
  return `<div class="sd-store-invoices">${pays.slice().sort((a,b)=>(a.deliveryRun||0)-(b.deliveryRun||0)).map(p=>{
    const netKg=(p.priceLines||[]).reduce((sum,l)=>sum+Number(l.deliveredKg||0),0);
    const run=p.deliveryRun?` · سرویس ${p.deliveryRun===2?'دوم':'اول'}`:'';
    return `<span class="sd-store-invoice-chip" title="سند تحویل (بدون مبلغ)">${icon('receipt',12)} سند <b>${esc(fa(p.invoiceNumber||'—'))}</b>${run} · <b>${qty(netKg)}</b> کیلوگرم${p.verifiedAt?` · ${esc(formatDateTime24(p.verifiedAt))}`:''}<button class="btn chip-btn" type="button" data-action="invoice" data-id="${esc(o.id)}"${p.deliveryRun?` data-run="${p.deliveryRun}"`:''}>${icon('eye',11)} نمایش</button><button class="btn chip-btn" type="button" data-action="print-invoice" data-id="${esc(o.id)}"${p.deliveryRun?` data-run="${p.deliveryRun}"`:''}>${icon('receipt',11)} چاپ</button></span>`;
  }).join('')}</div>`;
}
function sdStoreTotalsLine(o){
  const items=activeItemsOf(o);
  const requested=items.reduce((sum,i)=>sum+n(i.requestedQty),0);
  const delivered=items.reduce((sum,i)=>sum+n(i.deliveredKg||0),0);
  return `<span>${qty(items.length)} قلم</span><span>درخواستی <b>${qty(requested)} کیلوگرم</b></span>${delivered>0?`<span>تحویلی <b>${qty(delivered)} کیلوگرم</b></span>`:''}`;
}
function storeReceiptEntries(o){
  const ds=[...(o.dispatchRuns||o.dispatches||[]),...(o.dispatch?[o.dispatch]:[])];
  return ds.filter(d=>d&&['DELIVERED','SALES_FINALIZED','CLOSED'].includes(d.status)).map(d=>{const confirmedAt=d.storeReceiptConfirmedAt||(!d.run?o.storeReceiptConfirmedAt:null);return {run:Number(d.run)||0,confirmed:!!confirmedAt,confirmedAt};}).filter((d,i,a)=>a.findIndex(x=>x.run===d.run)===i);
}
function storeReceiptSummary(o){const rows=storeReceiptEntries(o);if(!rows.length)return '';return `<div class="store-receipt-summary">${rows.map(d=>`<span class="badge ${d.confirmed?'green':'orange'}">${d.run?`سرویس ${d.run===2?'دوم':'اول'}: `:''}${d.confirmed?`دریافت فروشگاه تأیید شد · ${esc(formatDateTime24(d.confirmedAt))}`:'منتظر تأیید دریافت فروشگاه'}</span>`).join('')}</div>`;}
function renderSalesStoresV41(orders,deliveries={}){ // v37.7.9 — فروشگاه با چهار سربرگ عمودی
  const all=(Array.isArray(orders)?orders:[]).filter(o=>o&&o.orderType==='STORE');
  const incoming=all.filter(o=>o.status==='STORE_PENDING_SALES').sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const approved=all.filter(o=>o.status==='SCHEDULED_REMOTE').sort((a,b)=>String(a.scheduledAt||a.createdAt||'').localeCompare(String(b.scheduledAt||b.createdAt||'')));
  const processing=all.filter(o=>['WAREHOUSE_PENDING','WAREHOUSE_PREPARING','RETURNED_TO_SALES'].includes(o.status)).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  const history=all.filter(o=>['CLOSED','SETTLED','EXITED'].includes(o.status)||(o.payments||[]).length>0||storeReceiptEntries(o).some(d=>d.confirmed)).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  const card=(o,kind)=>`<article class="sd-store-card sd-store-card-v40 sd-store-card-compact-v41 sd-store-card-v42 ssin21-card order-summary-row" data-store-summary-id="${esc(o.id)}"><div class="sd-store-identity-v42 ssin21-id order-summary-cell order-summary-identity"><h3>${esc(o.storeName||'فروشگاه')}</h3><small class="ssin21-customer">مشتری: ${esc(o.customer?.name||'—')}</small></div><span class="order-code order-summary-cell">شماره سفارش ${esc(fa(o.orderNo||'—'))}</span><span class="ssin21-meta order-summary-cell">تاریخ ${esc(formatDateTime24(o.createdAt))}</span><span class="order-summary-cell order-summary-status">${badge(o.status)}</span><span class="ssin21-meta order-summary-cell">${qty(activeItemsOf(o).length)} قلم</span><div class="ssin21-actions order-summary-cell order-summary-actions">${kind==='history'?'<div class="ssin21-history-buttons">':''}<button class="btn btn-secondary btn-sm" data-action="store-order-details-v25" data-id="${esc(o.id)}">${icon('eye',14)} جزئیات سفارش</button>${kind==='incoming'?`<button class="btn btn-secondary btn-sm" data-action="sales-edit-store-order" data-id="${esc(o.id)}">${icon('edit',14)} ویرایش سفارش</button><button class="btn btn-primary btn-sm" data-action="store-approve-v25" data-id="${esc(o.id)}">${icon('calendar',14)} تأیید و تعیین زمان</button><button class="btn btn-secondary btn-sm" data-action="store-quick-send-v40" data-id="${esc(o.id)}">${icon('send',14)} تأیید و ارسال سریع</button>`:''}${kind==='approved'?`<button class="btn btn-secondary btn-sm" data-action="store-quick-send-v40" data-id="${esc(o.id)}">${icon('send',14)} ارسال سریع به انبار</button>`:''}${kind==='processing'&&o.status==='RETURNED_TO_SALES'?`<button class="btn btn-secondary btn-sm" data-action="edit-returned-order" data-id="${esc(o.id)}">${icon('edit',14)} اصلاح سفارش</button><button class="btn btn-primary btn-sm" data-action="resubmit-order" data-id="${esc(o.id)}">${icon('send',14)} ارسال مجدد به انبار</button>`:''}${kind==='processing'&&o.dispatch&&o.dispatch.status==='DELIVERED'?`<button class="btn btn-primary btn-sm" data-action="sales-finalize-driver-delivery" data-id="${esc(o.id)}">${icon('check',14)} تأیید نهایی تحویل${o.dispatch.run?` سرویس ${o.dispatch.run===2?'دوم':'اول'}`:''}</button>`:''}${kind==='history'?storeServicePrintButtons(o.id,storeAvailableRuns(o))+'</div>'+storeReceiptSummary(o):''}</div>${kind==='processing'&&warehouseReturnNoteHtml(o)?`<span class="order-summary-cell order-summary-note">${warehouseReturnNoteHtml(o)}</span>`:''}${kind==='processing'&&storeReceiptSummary(o)?`<span class="order-summary-cell">${storeReceiptSummary(o)}</span>`:''}</article>`;
  // v37.33.0 — محموله‌های ارسالی انبار (هر دو سرویس) در سربرگ «ورودی» فروشگاه‌های فروش نمایش داده می‌شوند (جای قبلی: «در جریان»؛ فروش آن‌ها را در ورودی پیدا نمی‌کرد)
  const shipmentsPanel=renderStoreRunShipmentsPanel(deliveries.storeRunShipments||[]);
  const panel=(id,title,rows,kind,emptyTitle,emptyText,extra='')=>`<section class="sales-store-subpanel-v43" data-store-section="${id}"${(app.salesStoreTab||'incoming')===id?'':' hidden'}><header class="sales-store-subhead-v43"><h2>${title}</h2><span>${qty(rows.length)} سفارش</span></header>${extra}<div class="sd-store-list sd-store-list-v40">${rows.map(o=>card(o,kind)).join('')||salesEmptyV25('sales',emptyTitle,emptyText)}</div></section>`;
  const shipCount=(deliveries.storeRunShipments||[]).length;
  const tabs=[['incoming','ورودی',incoming.length+shipCount],['processing','در جریان',processing.length],['approved','تأیید شده',approved.length],['history','سوابق',history.length]];
  const active=(tabs.some(t=>t[0]===app.salesStoreTab)?app.salesStoreTab:'incoming');
  return `<section class="sales-pane-v25 sales-store-pane-v40 sales-store-pane-v41 sales-store-pane-v42 sales-store-pane-v43" data-sales-pane="stores" data-sales-store-layout="v43"><nav class="sales-store-tabs-v43" aria-label="بخش‌های سفارش فروشگاه">${tabs.map(([id,label,count])=>`<button type="button" class="sales-store-tab-v43 ${active===id?'active':''}" data-store-subtab="${id}" aria-selected="${active===id}"><span>${label}</span><b>${qty(count)}</b></button>`).join('')}</nav><div class="sales-store-subpanels-v43">${panel('incoming','ورودی',incoming,'incoming',shipCount?'سفارش تازه‌ای در انتظار تأیید نیست':'سفارش ورودی وجود ندارد',shipCount?'محموله‌های وزن‌شدهٔ انبار در بالای همین بخش نمایش داده شده‌اند و برای هرکدام باید راننده تعیین شود.':'سفارش‌های تازهٔ فروشگاه در این بخش نمایش داده می‌شوند.',shipmentsPanel)}${panel('processing','در جریان',processing,'processing','سفارشی در جریان نیست','سفارش‌های در حال بررسی یا آماده‌سازی در این بخش دیده می‌شوند.')}${panel('approved','تأیید شده',approved,'approved','سفارش تأییدشده‌ای نیست','پس از تأیید و تعیین زمان، سفارش در این بخش قرار می‌گیرد.')}${panel('history','سوابق',history,'history','سابقه‌ای ثبت نشده است','سفارش‌های تکمیل‌شده و تأیید دریافت فروشگاه در این بخش نگهداری می‌شوند.')}</div></section>`;
}
/* ---------- تب ۳: در جریان ---------- */
function pickupSalesActions(o){
 if(!app.features?.pickupStaging||o.orderType!=='REMOTE'||o.deliveryMode!=='PICKUP')return '';
 if(o.pickupCancellation?.status==='PENDING_SALES')return `<button type="button" class="btn btn-primary btn-sm" data-action="pickup-approve" data-id="${esc(o.id)}">تأیید انصراف</button>`;
 if(!o.pickupHandover&&!o.warehouseCompletedAt&&o.visit?.status!=='PICKUP_PRESENT')return `<button type="button" class="btn btn-secondary btn-sm" data-action="pickup-date" data-id="${esc(o.id)}">تعیین تاریخ تحویل</button>`;
 return '';
}
async function pickupChangeDate(id){
 try{const {order:o}=await api('/api/orders/'+encodeURIComponent(id));openModal('تعیین تاریخ تحویل',`<form id="pickupDateForm">${jalaliInput('تاریخ تحویل','deliveryDate',o.deliveryDate||today(),true)}<p>این تاریخ مستقل از زمان ورود سفارش به انبار است.</p><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">بستن</button><button class="btn btn-primary">ثبت تاریخ</button></div></form>`);const form=$('#pickupDateForm');bindJalaliDates(form);form.addEventListener('submit',async e=>{e.preventDefault();const date=new FormData(form).get('deliveryDate');try{await api('/api/pickup/'+encodeURIComponent(id)+'/delivery-date',{method:'PUT',body:JSON.stringify({deliveryDate:date})});closeModal();toast('تاریخ تحویل ثبت شد.');await fetchSalesCache(true);await renderSales(app.sub.sales);}catch(err){toast(err.message);}});}catch(err){toast(err.message);}
}
async function pickupApprove(id,button){
 if(!confirm('انصراف و عدم تحویل تأیید شود؟ بیعانه برای استرداد دستی در انتظار می‌ماند.'))return;
 button.disabled=true;try{await api('/api/pickup/'+encodeURIComponent(id)+'/cancellation-approval',{method:'POST',body:'{}'});toast('انصراف تأیید شد؛ نگهبانی خروج را ثبت می‌کند.');await fetchSalesCache(true);await renderSales(app.sub.sales);await refreshIndicators();}catch(e){button.disabled=false;toast(e.message);}
}
function sdFlowCard(o,idx){
 const items=activeItemsOf(o);
 const extras=[{html:`شماره تماس: ${esc(storeAwareOrderPhone(o)||'—')}`},{html:`محل ارسال: ${esc(o.dispatchPlace||'ثبت نشده')}`},{html:`آخرین اقدام: ${esc(formatDateTime24(o.updatedAt||o.createdAt))}`}];
 if(o.scheduledAt)extras.push({html:`زمان ارسال: ${esc(salesOrderDateTime(o))}`});
 if(o.storeRun&&o.storeRun.enabled)extras.push({html:sr38Chips(o)});
 if(o.status==='RETURNED_TO_SALES'&&o.warehouseReturn?.reason)extras.push({html:warehouseReturnNoteHtml(o),className:'order-summary-note'});
 const actions=`<button class="btn btn-secondary btn-sm" data-action="order-details" data-id="${esc(o.id)}">${icon('eye',14)} جزئیات سفارش</button>${pickupSalesActions(o)}${o.status==='RETURNED_TO_SALES'&&o.pickupCancellation?.status!=='PENDING_SALES'?`<button class="btn btn-secondary btn-sm" data-action="edit-returned-order" data-id="${esc(o.id)}">${icon('edit',14)} اصلاح سفارش</button><button class="btn btn-primary btn-sm" data-action="resubmit-order" data-id="${esc(o.id)}">${icon('send',14)} ارسال مجدد به انبار</button>`:''}`;
 return orderSummaryRow(o,{className:`sd-flow-card sd-flow-card-1line ${sdStatusAccent(o.status)}`,statusHtml:badge(o.status),itemCount:items.length,extras:[{html:sdTypeBadge(o)},...extras],actionsHtml:actions});
}
function salesFlowRowsV27(orders){ return (orders||[]).map(sdFlowCard).join(''); }
function renderSalesFlowV25(orders){
  return `<section class="sd-pane"><section class="sd-panel">
    <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--blue-bg);color:var(--blue)">${icon('truck',20)}</span><div><h2>سفارش‌های در جریان</h2><p>تمام سفارش‌هایی که به انبار ارسال شده‌اند یا برای اصلاح برگشته‌اند.</p></div></div><div class="sd-count"><strong>${qty(orders.length)}</strong><span>سفارش</span></div></div>
    <div class="sd-flow-toolbar"><span class="sd-live"><i></i> مرتب بر اساس آخرین اقدام</span><span class="sd-legend"><span><i class="orange"></i>در صف انبار</span><span><i class="purple"></i>در حال آماده‌سازی</span><span><i class="gray"></i>برگشت به فروش</span></span></div>
    <div class="v26-flow-list sd-flow-list" style="padding:10px 14px 12px">${salesFlowRowsV27(orders)||sdEmpty('truck','سفارشی در جریان نیست','هر سفارشی که به انبار ارسال شود در این فهرست قرار می‌گیرد.')}</div>
  </section></section>`;
}

/* ---------- تب ۴: تسویه ---------- */
function renderSalesSettlementV25(orders){
  const pending=orders.filter(o=>o.status==='SETTLEMENT_PENDING');
  const finalized=orders.filter(o=>['SETTLED','EXITED'].includes(o.status)||((o.payments||[]).length&&!['SETTLEMENT_PENDING','CANCELLED'].includes(o.status)&&!o.payment?.archived)); // v37.5.0 — فاکتور هر سرویس سفارش فروشگاه هم دیده می‌شود
  return `<section class="sd-pane stl-pane">
    <div class="stl-layout">
      <aside class="sd-panel stl-queue-panel">
        <div class="stl-block-head"><div><span class="stl-eyebrow">۰۴ / تسویه</span><h2>آماده تسویه</h2></div><span class="sd-count" style="min-width:56px"><strong>${qty(pending.length)}</strong><span>سفارش</span></span></div>
        <div class="v26-settlement-list stl-queue-list">${settlementPendingRowsV27(pending)}</div>
      </aside>
      <section class="stl-main" id="stlMain">${stl.orderId ? '' : stlEmptyHtml()}</section>
    </div>
    <section class="sd-panel">
      <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--green-bg);color:var(--green)">${icon('receipt',19)}</span><div><h2>فاکتورهای صادرشده</h2><p>نمایش، چاپ و پیگیری وضعیت تأیید خروج نزد نگهبانی.</p></div></div><div class="sd-count"><strong>${qty(finalized.length)}</strong><span>فاکتور</span></div></div>
      <div class="v26-invoice-list sd-invoice-list">${invoiceRowsV27(finalized)}</div>
    </section>
  </section>`;
}
function settlementPendingRowsV27(rows){
 return rows.map(o=>{
  const name=storeAwareOrderName(o),number=fa(o.orderNo||'—');
  const description=`${name}، شماره سفارش ${number}، تاریخ ${formatDateTime24(o.createdAt)}، ${qty(activeItemsOf(o).length)} قلم، آماده تسویه`;
  return `<button type="button" class="stl-queue-item stl-queue-item-card ${stl.orderId===o.id?'active':''}" data-stl="select" data-id="${esc(o.id)}" title="${esc(description)}" aria-label="${esc(description)}"><span class="stl-queue-customer" title="${esc(name)}">${esc(name)}</span><span class="stl-queue-order">سفارش <bdi>${esc(number)}</bdi></span></button>`;
 }).join('')||'<div class="stl-q-empty">سفارشی در انتظار تسویه نیست.</div>';
}

function invoiceRowsV27(rows){
 return rows.flatMap(o=>(o.payments&&o.payments.length>1?o.payments:[o.payment]).filter(Boolean).map(pay=>{
  const run=pay.deliveryRun||null;
  const status=o.transportWorkflow===1&&o.status==='CLOSED'?'<span class="badge green">فاکتور بسته شد</span>':o.status==='EXITED'?'<span class="badge green">خروج ثبت شد</span>':(run&&o.status==='CLOSED')?'<span class="badge green">نهایی و بسته‌شده</span>':'<span class="badge orange">آماده خروج</span>';
  const extras=[{html:`فاکتور ${esc(fa(pay.invoiceNumber||'—'))}`},...(run?[{html:`سرویس ${run===2?'دوم':'اول'}`}]:[]),{html:o.orderType==='STORE'?'سند وزنی — بدون مبلغ':money(pay.totalAmount||0)},{html:verificationBadges(pay)},{html:`زمان تسویه: ${esc(formatDateTime24(pay.verifiedAt||o.updatedAt||o.createdAt))}`}];
  const actions=`<button class="btn btn-secondary btn-sm" data-action="invoice" data-id="${esc(o.id)}"${run?` data-run="${run}"`:''}>${icon('eye',13)} فاکتور</button><button class="btn btn-primary btn-sm" data-action="print-invoice" data-id="${esc(o.id)}"${run?` data-run="${run}"`:''}>${icon('receipt',13)} چاپ</button>`;
  return orderSummaryRow(o,{className:'sd-invoice-row',statusHtml:status,itemCount:activeItemsOf(o).length,extras,actionsHtml:actions});
 })).join('')||sdEmpty('receipt','فاکتور نهایی‌شده‌ای وجود ندارد','پس از تسویه، فاکتور در این فهرست قرار می‌گیرد.');
}
function stlEmptyHtml(){
  return `<div class="stl-empty"><div class="stl-empty-ico">${icon('receipt',26)}</div><b>یک سفارش از فهرست انتخاب کنید</b><span>بعد از انتخاب، قیمت‌گذاری اقلام و ثبت تسویه در همین بخش انجام می‌شود.</span></div>`;
}
function stlRowHtml(o){
  return window.BTSettlementRenderers.row(o);
}
function stlFormHtml(o){
  return window.BTSettlementRenderers.form(o);
}

/* ---------- تب ۵: سفارش‌های روزهای آتی ---------- */
function futureOrderRowsV25(orders){
 const rows=(orders||[]).map(o=>{
  const actions=`<button class="btn btn-secondary btn-sm" data-action="order-details" data-id="${esc(o.id)}">${icon('eye',13)} جزئیات سفارش</button>`+(o.orderType==='REMOTE'&&o.pickupCancellation?.status!=='PENDING_SALES'?`<button class="btn btn-ghost btn-sm" data-action="future-edit" data-id="${esc(o.id)}">${icon('edit',13)} ویرایش زمان</button>${o.visit?.status!=='PICKUP_PRESENT'?`<button class="btn btn-ghost btn-sm danger-text" data-action="future-cancel" data-id="${esc(o.id)}">${icon('trash',13)} لغو</button>`:''}`:'');
  const extras=[{html:sdTypeBadge(o)},{html:`ورود به انبار: ${esc(dateLabel(o.scheduledDate))} ${esc(fa(time24(o.scheduledAt)))}`},{html:`تاریخ تحویل: ${o.deliveryDate?esc(dateLabel(o.deliveryDate)):'ثبت نشده'}`},{html:`مقصد: ${esc(o.dispatchPlace||'ثبت نشده')}`},{html:`شماره تماس: ${esc(storeAwareOrderPhone(o)||'—')}`}];
  if(o.deposit)extras.push({html:depositSummaryHtml(o.deposit),className:'order-summary-deposit'});
  return orderSummaryRow(o,{className:'fx-row',statusHtml:badge(o.status),itemCount:activeItemsOf(o).length,extras,actionsHtml:actions+pickupSalesActions(o)});
 }).join('');
 return rows||sdEmpty('calendar','سفارشی برای روزهای آینده برنامه‌ریزی نشده است','سفارش‌های آینده پس از ثبت در این تقویم قرار می‌گیرند.');
}
function futureFormV38(orders){
  const future=salesFutureOrders(orders||[]);
  return `<div class="fx-grid"><section class="fx-form">
    <div class="fx-card">
      <div class="fx-card-head"><span class="fx-ico">${icon('calendar',16)}</span><h3>ثبت سفارش برنامه‌ریزی‌شده</h3><span class="fx-list-count">${qty(future.length)} برنامه فعال</span></div>
      <div class="fx-card-body fx-body-compact"><p class="fx-intro">مشتری، <b>زمان ورود به کارتابل انبار</b> و اقلام را وارد کنید؛ سفارش در زمان سررسید خودکار وارد صف انبار می‌شود.</p>
        <form id="futureOrderFormV25" class="fx-form fx-form-compact">
          <div class="fx-grid-2 future-contact-grid-v40 fx-top-grid">
            <div class="field future-contact-field-v40 contact-field-v41"><label for="futureCustomerName">نام مشتری</label><div class="input-shell"><span>${icon('user',16)}</span><input id="futureCustomerName" name="name" required placeholder="نام و نام خانوادگی"></div></div>
            <div class="field future-contact-field-v40 contact-field-v41"><label for="futureCustomerPhone">شماره تماس</label><div class="input-shell"><span>${icon('phone',16)}</span><input id="futureCustomerPhone" name="phone" required inputmode="tel" placeholder="۰۹۱۲ ..."></div></div>
            ${jalaliDateTimeInput('زمان ورود به کارتابل انبار','scheduledDate','scheduledTime',nextDayIso(),'08:00',true)}
            ${jalaliInput('تاریخ تحویل','deliveryDate','',true)}
            <div class="field fx-addr-field"><label for="futureDispatchPlace">محل ارسال</label><div class="input-shell"><span>${icon('truck',16)}</span><input id="futureDispatchPlace" name="dispatchPlace" required placeholder="آدرس یا محل ارسال"></div></div>
            ${app.features?.experimentalTransport?deliveryModeInputHtml('future'):''}
          </div>
          <div class="sd-lines-head fx-lines-head"><h3>اقلام سفارش</h3></div>
          <div id="future-lines" class="sd-lines"></div>
          <div class="fx-lines-add">
            <button type="button" class="btn btn-secondary btn-sm" data-action="future-add-line">${icon('plus',15)} افزودن قلم جدید</button>
            <small>واحدهای مجاز: کیلوگرم، بسته، عدد، کارتن</small>
          </div>
          <div class="field future-note-v40 fx-note"><label for="futureNotes">یادداشت و توضیحات</label><textarea name="notes" maxlength="1000" rows="1" id="futureNotes" placeholder="هماهنگی، بسته‌بندی، محدودیت تحویل یا نکته مهم..."></textarea></div>
          ${depositEntryHtml()}
          <div class="fx-foot fx-foot-compact">
            <button type="submit" class="btn btn-primary">${icon('send',16)} ثبت برنامه ارسال</button>
            <button type="reset" class="btn btn-secondary">${icon('refresh',15)} پاک کردن فرم</button>
          </div>
        </form>
      </div>
    </div>
  </section>
  <section class="fx-card" style="align-self:start"><div class="fx-card-head"><span class="fx-ico" style="background:var(--purple-bg);color:var(--purple)">${icon('calendar',16)}</span><h3>سفارش‌های ثبت‌شده</h3><span class="fx-list-count">${qty(future.length)} مورد</span></div>
    <div class="fx-card-body"><div id="futureOrderListV25" class="fx-list-grid">${futureOrderRowsV25(future)}</div></div>
  </section><section class="fx-card deposit-refund-panel"><div class="fx-card-head"><h3>استرداد بیعانه سفارش‌های لغوشده</h3></div><div class="fx-card-body" id="depositRefundList">در حال دریافت…</div></section></div>`;
}
window.renderSalesFutureV25=function(orders){ return futureFormV38(orders); };
function renderSalesStoreDeliveryDetails(o,finalized=false){
 const d=o.dispatch||{}, lines=Array.isArray(d.lines)?d.lines:[];
 const rows=lines.map((l,i)=>`<div class="sales-store-delivery-line"><b>${fa(String(i+1))}. ${esc(l.productName||'قلم')}</b><span>تحویلی: ${qty(l.deliveredKg)} کیلوگرم</span><span>مرجوعی: ${qty(l.returnKg||0)} کیلوگرم</span><span>کسری: ${qty(l.shortageKg||0)} کیلوگرم</span>${l.reason?`<span>علت: ${esc(l.reason)}</span>`:''}</div>`).join('');
 const confirmed=d.storeReceiptConfirmedAt||(!d.run&&o.storeReceiptConfirmedAt);
 return `<article class="sales-store-delivery-details"><div class="sales-delivery-card-head"><div><span class="order-code">${esc(fa(o.orderNo||'—'))}</span><h3>${esc(o.storeName||'فروشگاه')}</h3></div><span class="badge blue">${d.run?`سرویس ${d.run===2?'دوم':'اول'}`:'محموله'} — بدون مبلغ</span></div><div class="sales-delivery-meta"><span><small>راننده</small><b>${esc(d.driverName||'—')}</b></span><span><small>پلاک</small>${plateViewHtml(d.driverPlate,'—',true)}</span><span><small>زمان تحویل</small><b>${esc(formatDateTime24(d.deliveredAt))}</b></span><span><small>تأیید دریافت فروشگاه</small><b>${confirmed?`دریافت توسط فروشگاه تأیید شد • ${esc(formatDateTime24(confirmed))}`:'در انتظار تأیید'}</b></span></div><div class="sales-store-delivery-lines">${rows||'<div class="empty">اقلام تحویل ثبت نشده است.</div>'}</div>${d.note?`<p class="sales-delivery-note">${esc(d.note)}</p>`:''}<footer class="sales-delivery-actions">${finalized?`<span class="sales-finalized-stamp">ثبت نهایی ${esc(formatDateTime24(d.salesFinalizedAt||d.closedAt))}</span>`:`<button type="button" class="btn btn-primary" data-action="sales-finalize-driver-delivery" data-id="${esc(o.id)}">تأیید نهایی فروش</button>`}</footer></article>`;
}
function renderSalesDeliveryCardV38(o, finalized = false) {
  if(o.orderType==='STORE')return renderSalesStoreDeliveryDetails(o,finalized);
  const d=o.dispatch||{};
  const lines=d.lines||[];
  const sum=(key)=>lines.reduce((n,line)=>n+Number(line[key]||0),0);
  const gross=Number(d.grossAmount??d.approvedTotalAmount??o.payment?.grossAmount??o.payment?.totalAmount??0);
  const returnDeduction=Number(d.returnDeduction??o.payment?.returnDeduction??0);
  const payable=Number(d.amountDue??o.payment?.totalAmount??Math.max(0,gross-returnDeduction));
  const paymentLabels={CASH:'نقدی',POS:'پوز',CARD_TRANSFER:'کارت‌به‌کارت',CHECK:'چک',CREDIT:'معوق'};
  const paymentRows=(d.settlementMethods||o.payment?.settlementMethods||[]).map((m,i)=>{const details=[m.deviceSnapshot?`دستگاه ${m.deviceSnapshot.title} • پایانه ${m.deviceSnapshot.terminalNumber} • ${m.deviceSnapshot.bank}`:'',m.bank?`بانک ${m.bank}`:'',m.reference?`پیگیری ${m.reference}`:'',m.checkNumber?`چک ${m.checkNumber}`:'',m.dueDate?`سررسید ${fa(m.dueDate)}`:'',m.type!=='CREDIT'&&m.reason?`علت: ${m.reason}`:'',m.checkStatus?`وضعیت چک: ${m.checkStatus==='PENDING'?'در انتظار وصول':m.checkStatus}`:''].filter(Boolean).join(' • ');return `<tr><td>${fa(String(i+1))}</td><td><b>${esc(paymentLabels[m.type]||m.type||'—')}</b></td><td>${money(m.amount)}</td><td>${esc(details||'—')}</td></tr>`}).join('');
  const paymentCount=(d.settlementMethods||o.payment?.settlementMethods||[]).length;
  const lineRows=lines.map((line,i)=>`<div class="sales-delivery-line"><span class="sd-row-no">${fa(String(i+1))}</span><div class="sd-line-body"><div class="sd-line-top"><strong>${esc(line.productName||'قلم')}</strong><span class="sd-line-amount"><b>${money(line.grossAmount??Math.round(Number(line.deliveredKg||0)*Number(line.unitPrice||0)))}</b></span></div><div class="sd-line-stats"><span>تحویلی <b>${qty(line.deliveredKg)}</b> کیلو</span><span>فی <b>${money(line.unitPrice||0)}</b></span><span>مرجوع <b>${qty(line.returnKg)}</b></span><span>کسری <b>${qty(line.shortageKg)}</b></span><span>خالص <b>${qty(line.netKg)}</b></span></div>${line.reason?`<small class="sd-line-reason">علت: ${esc(line.reason)}</small>`:''}</div></div>`).join('');
  return `<article class="sd-panel sales-delivery-card">
    <header class="sales-delivery-card-head"><div><span class="order-code">${esc(fa(o.orderNo||'—'))}</span><h3>${esc(storeAwareOrderName(o))}</h3>${o.orderType==='STORE'?'':`<small>${esc(storeAwareOrderPhone(o))}</small>`}</div><div class="sales-delivery-badges">${d.run?`<span class="badge blue">سرویس ${d.run===2?'دوم':'اول'}</span>`:''}<span class="badge ${finalized?'green':'orange'}">${finalized?(d.status==='CLOSED'?'بسته‌شده؛ سابقه قدیمی':'نهایی‌شده توسط فروش'):'منتظر تأیید فروش'}</span>${o.orderType==='STORE'?`<span class="badge ${(d.storeReceiptConfirmedAt||(!d.run&&o.storeReceiptConfirmedAt))?'green':'orange'}">${(d.storeReceiptConfirmedAt||(!d.run&&o.storeReceiptConfirmedAt))?'دریافت توسط فروشگاه تأیید شد':'منتظر تأیید فروشگاه'}</span>`:''}</div></header>
    <div class="sales-delivery-meta"><span><small>راننده</small><b>${esc(d.driverName||'—')}</b></span><span><small>پلاک</small>${plateViewHtml(d.driverPlate, '—', true)}</span><span><small>زمان تحویل</small><b>${esc(formatDateTime24(d.deliveredAt))}</b></span><span><small>روش‌های ثبت‌شده</small><b>${(d.settlementMethods||o.payment?.settlementMethods||[]).map(x=>paymentLabels[x.type]||x.type).join('، ')|| (d.settlementType==='CASH'?'نقدی':d.settlementType==='CREDIT'?'معوق':'—')}</b></span><span><small>شمارهٔ فاکتور</small><b>${esc(fa(o.payment?.invoiceNumber||'پس از تأیید نهایی فروش'))}</b></span>${o.orderType==='STORE'?`<span><small>تأیید دریافت فروشگاه${d.run?` — محمولهٔ سرویس ${d.run===2?'دوم':'اول'}`:''}</small><b>${(d.storeReceiptConfirmedAt||(!d.run&&o.storeReceiptConfirmedAt))?`تأیید شد • ${esc(formatDateTime24(d.storeReceiptConfirmedAt||o.storeReceiptConfirmedAt))}`:'در انتظار تأیید فروشگاه'}</b></span>`:''}</div>
    <div class="sales-delivery-lines">${lineRows||'<div class="empty">جزئیات اقلام تحویل ثبت نشده است.</div>'}</div>
    <div class="sales-delivery-summary"><span><small>${d.fullReturn?'مرجوعی کلی':'مرجوعی'}</small><b>${qty(sum('returnKg'))} کیلو</b></span><span><small>کسری</small><b>${qty(sum('shortageKg'))} کیلو</b></span><span><small>مبلغ اولیه</small><b>${money(gross)}</b></span><span><small>کسر مرجوعی</small><b>${money(returnDeduction)}</b></span><span class="payable"><small>قابل تسویه</small><b>${money(payable)}</b></span></div>
    <details class="sales-delivery-payments"><summary>جزئیات روش‌ها و تراکنش‌های دریافت‌شده${paymentCount?` (${fa(String(paymentCount))} روش)`:''}</summary>${paymentRows?`<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>روش</th><th>مبلغ</th><th>مشخصات تراکنش</th></tr></thead><tbody>${paymentRows}</tbody></table></div>`:'<div class="empty">جزئیات تراکنش‌ها در این تحویل ثبت نشده است.</div>'}</details>
    ${d.note?`<p class="sales-delivery-note"><b>یادداشت راننده:</b> ${esc(d.note)}</p>`:''}
    <footer class="sales-delivery-actions">${finalized?`<span class="sales-finalized-stamp">ثبت نهایی ${esc(formatDateTime24(d.salesFinalizedAt||d.closedAt))} • ${esc(d.salesFinalizedBy||d.closedBy||'فروش')}</span>`:`<button type="button" class="btn btn-primary btn-lg" data-action="sales-finalize-driver-delivery" data-id="${esc(o.id)}">${icon('check',17)} تأیید نهایی فروش</button>`}</footer>
  </article>`;
}
function renderSalesDeliveryTrackingV18(o) {
  const d=o.dispatch||{};
  const labels={ASSIGNED:'تخصیص‌یافته؛ منتظر اعلام خروج راننده',DRIVER_EXIT_REPORTED:'اعلام خروج راننده؛ منتظر تأیید نگهبانی',IN_TRANSIT:'در مسیر مشتری'};
  return `<article class="sd-panel sales-delivery-card sales-delivery-tracking" data-delivery-order="${esc(o.id)}">
    <header class="sales-delivery-card-head"><div><span class="order-code">${esc(fa(o.orderNo||'—'))}</span><h3>${esc(storeAwareOrderName(o))}</h3>${o.orderType==='STORE'?'':`<small dir="ltr">${esc(storeAwareOrderPhone(o))}</small>`}</div><span class="badge blue">${d.run?`سرویس ${d.run===2?'دوم':'اول'} » `:''}${esc(labels[d.status]||'در حال ارسال')}</span></header>
    <div class="sales-delivery-meta"><span><small>راننده</small><b>${esc(d.driverName||'—')}</b></span><span><small>پلاک</small>${plateViewHtml(d.driverPlate,'—',true)}</span><span><small>زمان تخصیص</small><b>${esc(formatDateTime24(d.assignedAt))}</b></span><span><small>آخرین تغییر</small><b>${esc(formatDateTime24(o.updatedAt||d.assignedAt))}</b></span>${o.orderType==='STORE'?'':`<span><small>مبلغ تأییدشده فروش</small><b>${money(d.approvedTotalAmount||0)}</b></span>`}</div>
    <p class="sales-delivery-note">این سفارش هنوز تحویل مشتری نشده است؛ پس از ثبت تحویل توسط راننده به بخش «منتظر تأیید فروش» منتقل می‌شود.</p>
  </article>`;
}
function renderStoreRunShipmentsPanel(shipments){ // v37.5.0
  const list=Array.isArray(shipments)?shipments:[];
  if(!list.length)return '';
  const chips=list.map(s=>`<div class="sr-ship-row order-compact-row"><span class="order-code">${esc(fa(s.orderNo||'—'))}</span><b>${esc(s.storeName||'فروشگاه')}</b><span>سرویس ${s.run===2?'دوم':'اول'}</span><span>${qty((s.items||[]).length)} قلم</span><span>وزن سرویس: ${qty((s.items||[]).reduce((sum,l)=>sum+Number(l.serviceKg??l.deliveredKg??0),0))} کیلوگرم</span><span>${esc(formatDateTime24(s.sentAt||''))}</span><button type="button" class="btn btn-primary btn-sm" data-action="sr-ship-open" data-order="${esc(s.orderId)}" data-run="${s.run}">جزئیات و تعیین راننده</button></div>`).join('');
  return `<section class="sr-ship-panel" data-delivery-section="storeRunShipments"><header><div><span class="sales-delivery-column-index">۰۰</span><h2>اقلام سرویس ارسال‌شده از انبار</h2><p>انبار اقلام وزن‌شدهٔ همان سرویس را فرستاده است؛ برای هر محموله راننده تعیین کنید تا سند تحویل وزنی همان سرویس صادر شود.</p></div><span class="sd-count"><strong>${qty(list.length)}</strong><span>درخواست</span></span></header><div class="sr-ship-list">${chips}</div></section>`;
}

function salesDeliverySummaryRow(o){
 const service=o.transportService,d=o.dispatch||{},run=Number(service?.run??d.run??0)||0;
 const state=service?`<span class="badge blue">${esc(service.label||'—')}</span>`:dspBadge(d.status);
 const driver=service?.driverName||d.driverName||'تعیین نشده';
 const lineCount=(service?.lines||d.lines||o.items||[]).length;
 // Every actual order/service uses the same compact structure as the store desk;
 // each field is separate so the divider stays visible even on narrow screens.
 return `<article class="order-compact-row sales-delivery-summary-row" data-delivery-order="${esc(o.id)}" data-delivery-run="${run}"><div class="sales-distribution-cell sales-distribution-identity"><strong>${esc(storeAwareOrderName(o))}</strong>${o.orderType==='STORE'&&o.customer?.name?`<small>مشتری: ${esc(o.customer.name)}</small>`:''}</div><span class="sales-distribution-cell order-code">شماره سفارش ${esc(fa(o.orderNo||'—'))}</span><span class="sales-distribution-cell">تاریخ ${esc(formatDateTime24(o.createdAt))}</span>${run?`<span class="sales-distribution-cell">سرویس ${run===2?'دوم':'اول'}</span>`:''}<span class="sales-distribution-cell">${state}</span><span class="sales-distribution-cell">راننده: ${esc(driver)}</span><span class="sales-distribution-cell">${qty(lineCount)} قلم</span><span class="sales-distribution-cell sales-distribution-actions"><button type="button" class="btn btn-secondary btn-sm" data-action="sales-delivery-details" data-id="${esc(o.id)}" data-run="${run}">جزئیات سفارش</button></span></article>`;
}
async function openSalesDeliveryDetails(id,run){
 const notices=captureEntityNotices('order',id,Number(run)||null);
 const data=app.salesCache?.dispatchDeliveries||{};const views=[...(data.active||[]),...(data.pending||[]),...(data.finalized||[])];
 const o=views.find(v=>v.id===id&&Number(v.transportService?.run??v.dispatch?.run??0)===Number(run||0));if(!o)return toast('محموله دیگر در فهرست نیست؛ صفحه را تازه کنید.');
 if(o.transportService){openModal('جزئیات ارسال و بازگشت مدارک',transportSalesDetailsHtml(o));finishEntityNotices(notices);return true;}
 const completed=['DELIVERED','SALES_FINALIZED','CLOSED'].includes(o.dispatch?.status);
 openModal('جزئیات تحویل سفارش',completed?renderSalesDeliveryCardV38(o,o.dispatch.status!=='DELIVERED'):renderSalesDeliveryTrackingV18(o)+`<button type="button" class="btn btn-secondary" data-action="order-details" data-id="${esc(o.id)}">جزئیات اقلام سفارش</button>`);
 finishEntityNotices(notices);return true;
}
function transportSalesDetailsHtml(o){
 const s=o.transportService||{},store=o.orderType==='STORE',lines=Array.isArray(s.lines)?s.lines:[];
 const rows=lines.map((l,i)=>`<tr><td>${fa(String(i+1))}</td><td>${esc(l.productName||'—')}</td><td>${qty(l.deliveredKg)} کیلوگرم</td></tr>`).join('');
 const disabled=app.features?.experimentalTransport===false&&(store||s.section!=='history');
 const action=disabled?'':store?`<button type="button" class="btn btn-primary" data-action="order-details" data-id="${esc(o.id)}">بررسی وضعیت و مدارک سرویس</button>`:o.status==='SETTLEMENT_PENDING'?`<button type="button" class="btn btn-primary" data-action="transport-sales-work" data-id="${esc(o.id)}">بررسی فاکتور و مدارک</button>`:o.status==='CLOSED'&&o.payment?`<button type="button" class="btn btn-primary" data-action="invoice" data-id="${esc(o.id)}">نمایش فاکتور بسته‌شده</button>`:'';
 return `<article class="sd-panel sales-delivery-card"><header><span class="order-code">${esc(fa(o.orderNo||'—'))}</span><h3>${esc(storeAwareOrderName(o))}</h3><span class="badge blue">${esc(s.label||'—')}</span>${s.run?` <span>سرویس ${s.run===2?'دوم':'اول'} — بدون تسویه مالی</span>`:''}</header><div class="sales-delivery-meta"><span><small>راننده</small><b>${esc(s.driverName||'تعیین نشده')}</b></span><span><small>تماس</small><b>${esc(fa(s.driverPhone||'—'))}</b></span><span><small>خودرو و پلاک</small><b>${esc(s.vehicleType||'—')} ${esc(fa(s.vehiclePlate||''))}</b></span><span><small>سند انبار</small><b>${esc(fa(s.warehouseDocumentNo||'—'))}</b></span>${!store?`<span><small>فاکتور</small><b>${esc(fa(s.invoiceNumber||'ثبت نشده'))}</b></span>`:''}</div>${disabled?'<p role="alert">گردش آزمایشی غیرفعال است؛ اطلاعات فقط برای مشاهده نمایش داده می‌شود.</p>':''}<p>${s.section==='assigned'?'خروج ثبت نشده و هیچ تحویل یا امضای مشتری تأیید نشده است.':s.section==='inTransit'?'خروج ثبت شده؛ دریافت مقصد هنوز تأیید نشده است.':s.outcome==='NOT_DELIVERED'?'این سفارش به مشتری تحویل نشده است.':''}</p><div class="table-wrap"><table class="table"><thead><tr><th>ردیف</th><th>محصول</th><th>وزن سند انبار</th></tr></thead><tbody>${rows||'<tr><td colspan="3">سند وزن این سرویس هنوز در دسترس نیست.</td></tr>'}</tbody></table></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">بستن</button>${action}</div></article>`;
}
function renderSalesDeliveryV38(data={}) {
  const active=Array.isArray(data.active)?data.active:[];
  const assigned=Array.isArray(data.assigned)?data.assigned:active.filter(o=>['ASSIGNED','DRIVER_EXIT_REPORTED'].includes(o.dispatch?.status));
  const inTransit=Array.isArray(data.inTransit)?data.inTransit:active.filter(o=>o.dispatch?.status==='IN_TRANSIT');
  const delivered=Array.isArray(data.pending)?data.pending:[];
  const history=Array.isArray(data.finalized)?data.finalized:[];
  const total=Math.max(0,Number(data.finalizedTotal??history.length));
  const offset=Math.max(0,Number(data.finalizedOffset)||0),limit=Math.max(1,Number(data.finalizedLimit)||30);
  const modern=!!app.features?.experimentalTransport||[...assigned,...inTransit,...delivered,...history].some(o=>o.transportService);
  const columns=[
    {id:'assigned',title:'واگذار شده',desc:modern?'ارسال‌های آماده یا منتظر تخصیص و خروج.':'به راننده واگذار شده یا منتظر تأیید خروج نگهبانی است.',rows:assigned,empty:'سفارش واگذارشده‌ای نیست'},
    {id:'inTransit',title:'در حال ارسال',desc:'خروج تأیید شده و سفارش در مسیر است.',rows:inTransit,empty:'سفارشی در مسیر نیست'},
    {id:'delivered',title:modern?'تحویل شده / بازگشت':'تحویل شده',desc:modern?'مدارک برگشتی یا دریافت فروشگاه را بررسی کنید.':'تحویل راننده را بررسی و در صورت صحت نهایی کنید.',rows:delivered,empty:'موردی منتظر بررسی نیست'},
    {id:'history',title:'سوابق',desc:modern?'ارسال‌های بسته‌شده، شامل موارد تحویل‌نشده.':'تحویل‌های نهایی‌شده و بسته‌شده.',rows:history,empty:'سابقهٔ نهایی‌شده‌ای نیست'},
  ];
  const selected=columns.some(c=>c.id===app.salesDeliveryTab)?app.salesDeliveryTab:'assigned';
  const pages=`<nav class="sales-delivery-pages" aria-label="صفحه‌بندی سوابق تحویل"><button type="button" class="btn btn-secondary btn-sm" data-action="sales-delivery-history-page" data-offset="${Math.max(0,offset-limit)}" ${offset===0?'disabled':''}>صفحه قبل</button><span>${total?`${qty(offset+1)} تا ${qty(Math.min(offset+history.length,total))} از ${qty(total)} محموله`:'۰ محموله'}</span><button type="button" class="btn btn-secondary btn-sm" data-action="sales-delivery-history-page" data-offset="${offset+limit}" ${offset+limit>=total?'disabled':''}>صفحه بعد</button></nav>`;
  return `<section class="sd-pane sales-delivery-pane">${data.error?'<div class="sales-delivery-error" role="alert">دریافت فهرست پخش ناموفق بود. اطلاعات قبلی، در صورت وجود، حفظ شده و ممکن است قدیمی باشد؛ نوسازی خودکار دوباره تلاش می‌کند.</div>':''}
    <nav class="sales-delivery-tabs" role="tablist" aria-label="مراحل پخش">${columns.map(c=>`<button type="button" role="tab" id="delivery-tab-${c.id}" aria-controls="delivery-panel-${c.id}" aria-selected="${c.id===selected}" tabindex="${c.id===selected?'0':'-1'}" class="sales-delivery-tab ${c.id===selected?'active':''}" data-delivery-tab="${c.id}"><span>${c.title}</span>${c.id==='history'?'':`<b>${qty(c.rows.length)}</b>`}</button>`).join('')}</nav>
    ${columns.map(c=>`<section class="sales-delivery-panel" role="tabpanel" id="delivery-panel-${c.id}" aria-labelledby="delivery-tab-${c.id}" data-delivery-section="${c.id}" ${c.id===selected?'':'hidden'}><header class="sales-delivery-panel-head"><div><h2>${c.title}</h2><p>${c.desc}</p></div><span>${qty(c.id==='history'?total:c.rows.length)} محموله</span></header><div class="sales-delivery-column-list">${c.rows.length?c.rows.map(salesDeliverySummaryRow).join(''):sdEmpty(c.id==='assigned'||c.id==='inTransit'?'truck':'receipt',c.empty,data.error?'دریافت اطلاعات ناموفق بود؛ نوسازی خودکار دوباره تلاش می‌کند.':'')}</div>${c.id==='history'?pages:''}</section>`).join('')}</section>`;
}
async function salesDeliveryHistoryPage(button){
  if(button.disabled)return;
  button.disabled=true;
  const previous=Number(app.salesDeliveryHistoryOffset)||0;
  try{
    if(app.salesFetchPromise)await app.salesFetchPromise;
    app.salesDeliveryHistoryOffset=Number(button.dataset.offset)||0;
    const data=await fetchSalesCache(true);
    if(data.dispatchDeliveries?.error)throw new Error('دریافت سوابق ناموفق بود.');
    app.salesDeliveryHistoryOffset=data.dispatchDeliveries.finalizedOffset||0;
    if(app.page==='sales'&&app.sub.sales==='delivery')paintSalesPaneV29('delivery',data);
  }catch(err){app.salesDeliveryHistoryOffset=previous;button.disabled=false;toast(err.message);}
}

async function salesViewDeliverySignatureV38(id,run=0) {
  try {
    const data=await api(`/api/sales/dispatch-deliveries/${encodeURIComponent(id)}${run?`?run=${encodeURIComponent(run)}`:''}`);
    if(!data.signatureData)return toast('برای این تحویل امضای دیجیتال ثبت نشده است.');
    const d=data.order?.dispatch||{};
    openModal(`امضای مشتری — سفارش ${data.order?.orderNo||''}`,`<div class="sales-delivery-signature"><img src="${esc(data.signatureData)}" alt="امضای ثبت‌شدهٔ مشتری"><small>ثبت‌شده توسط ${esc(d.deliveredBy||'راننده')} • ${esc(formatDateTime24(d.deliveredAt))}</small></div>`);
  } catch(err) { toast(err.message); }
}
document.addEventListener('click',e=>{const el=e.target.closest('#modal [data-action]');if(!el)return;const a=el.dataset.action;if(a==='sales-finalize-driver-delivery')void salesFinalizeDeliveryV38(el.dataset.id,el).then(ok=>{if(ok)closeModal()});else if(a==='sales-view-driver-signature')void salesViewDeliverySignatureV38(el.dataset.id,Number(el.dataset.run)||0);else if(a==='order-details')void openOrderDetails(el.dataset.id);});
async function srSalesOpenShip(orderId, run) { // v37.6.0
  const notices=captureEntityNotices('order',orderId,run);
  try {
    const [det, drv] = await Promise.all([api('/api/orders/'+encodeURIComponent(orderId)), api('/api/dispatch/drivers')]);
    const o = det.order || {};
    const ops = o.storeRunOps || {};
    const sh = run === 2 ? ops.r2Shipment : ops.r1Shipment;
    const label = run === 2 ? 'دوم' : 'اول';
    if (!sh || sh.status !== 'PENDING_SALES') { toast('این درخواست ارسال دیگر در انتظار نیست؛ فهرست نوسازی می‌شود.'); const data = await fetchSalesCache(true); if (app.page === 'sales' && app.sub.sales === 'delivery') paintSalesPaneV29('delivery', data); if (app.page === 'sales' && app.sub.sales === 'stores') paintSalesPaneV29('stores', data); return; }
    const items = (o.items || []).filter((i) => (sh.itemIds || []).includes(i.id));
    // v37.33.0 — مودال فقط وزن همان سرویس را نشان می‌دهد (نه جمع انباشتهٔ دو سرویس در deliveredKg)
    const runKgOf = (i) => { const v = ((o.storeRun && o.storeRun.items) || []).find((x) => x.itemId === i.id); return v ? Number(run === 2 ? v.r2Kg || 0 : v.r1Kg || 0) : Number(i.deliveredKg || 0); };
    // v37.6.0 — فلوی فروشگاه کاملاً بدون قیمت: فقط اقلام/وزن + انتخاب راننده
    openModal(`تعیین رانندهٔ محمولهٔ سرویس ${label}`, `<form id="srShipForm" class="sr-ship-form">
      <div class="sr-ship-modal-order"><span class="order-code">${esc(fa(o.orderNo||'—'))}</span><b>${esc(o.storeName||'فروشگاه')}</b><span class="st-run-chip st-run-r${run===2?2:1}">سرویس ${label}</span></div>
      <p class="sr-ship-hint">این محموله با رانندهٔ همین سرویس به فروشگاه ارسال می‌شود؛ فاکتور سرویس به‌صورت سند تحویل وزنی (بدون مبلغ) صادر می‌گردد.</p>
      <div class="sr-ship-items">${items.map((i) => `<div class="sr-ship-item"><div class="sr-ship-item-info"><b>${esc(i.product?.name || 'قلم')}</b><span>وزن سرویس: <b>${qty(runKgOf(i))} کیلوگرم</b></span>${run===2?`<span>ماندهٔ سرویس دوم: <b>${qty(Math.max(0,Number(i.requestedQty||0)-Number(((o.storeRun?.items||[]).find(x=>x.itemId===i.id)?.r1Kg)||0)))} ${esc(i.requestedUnit||'')}</b></span>`:''}</div></div>`).join('')}</div>
      <div class="field"><label>رانندهٔ محمولهٔ سرویس ${label}</label><div class="input-shell"><select id="srShipDriver" required><option value="">— انتخاب راننده —</option>${(drv.drivers || []).map((d) => `<option value="${esc(d.id)}">${esc(d.fullName)} — ${esc(d.plate || 'بدون پلاک')}</option>`).join('')}</select></div><div id="srShipPlate">${plateViewHtml('','—',true)}</div></div>
      <div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">انصراف</button><button type="submit" class="btn btn-primary">${icon('send',16)} واگذاری به راننده</button></div>
    </form>`);
    $('#srShipDriver')?.addEventListener('change',e=>{$('#srShipPlate').innerHTML=plateViewHtml((drv.drivers||[]).find(d=>d.id===e.target.value)?.plate,'—',true);});
    $('#srShipForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const driverId = $('#srShipDriver')?.value || '';
      if (!driverId) return toast('رانندهٔ این محموله را انتخاب کنید.');
      if (!confirm(`محمولهٔ سرویس ${label} (${items.length} قلم) به رانندهٔ انتخاب‌شده واگذار می‌شود. ادامه می‌دهید؟`)) return;
      try {
        await api('/api/orders/' + encodeURIComponent(orderId) + '/send-dispatch', { method: 'POST', body: JSON.stringify({ driverId, run }) });
        closeModal(); toast(`محمولهٔ سرویس ${label} به راننده واگذار شد.`);
        const data = await fetchSalesCache(true); if (app.page === 'sales' && app.sub.sales === 'delivery') paintSalesPaneV29('delivery', data); if (app.page === 'sales' && app.sub.sales === 'stores') paintSalesPaneV29('stores', data); await refreshIndicators();
      } catch (err) { toast(err.message); }
    });
    finishEntityNotices(notices);return true;
  } catch (err) { toast(err.message);return false; }
}
async function salesFinalizeDeliveryV38(id,button) {
  if(button?.disabled)return false;
  if(button)button.disabled=true;
  try {
    await api(`/api/sales/dispatch-deliveries/${encodeURIComponent(id)}/finalize`,{method:'POST',body:'{}'});
  } catch(err) {
    toast(err.message);
    if(button)button.disabled=false;
    return false;
  }
  toast('تحویل بازبینی و ثبت نهایی شد؛ به نگهبانی ارجاعی ارسال نشد.');
  try {
    const data=await fetchSalesCache(true);
    if(app.page==='sales'&&app.sub.sales==='delivery')paintSalesPaneV29('delivery',data);
    if(app.page==='sales'&&app.sub.sales==='stores')paintSalesPaneV29('stores',data);
    await refreshIndicators();
  } catch(err) { toast('تحویل ثبت شد، اما تازه‌سازی صفحه ناموفق بود: '+err.message); }
  return true;
}
window.salesV29RenderPane=function(tab,data){
  if(tab==='onsite') return renderSalesOnsiteV25((data.visits||[]).filter(v=>v.status==='WAITING_SALES'));
  if(tab==='remote') return renderSalesRemoteV32(data.orders||[]);
  if(tab==='stores') return renderSalesStoresV41(data.orders||[], data.dispatchDeliveries||{});
  if(tab==='flow') return renderSalesFlowV25(salesFlowOrders(data.orders||[]));
  if(tab==='settlement') return renderSalesSettlementV25(salesAllInSettlement(data.orders||[]));
  if(tab==='delivery') return renderSalesDeliveryV38(data.dispatchDeliveries||{});
  if(tab==='future') return futureFormV38(data.orders||[]);
  return renderSalesOnsiteV25((data.visits||[]).filter(v=>v.status==='WAITING_SALES'));
};

/* ---------- به‌روزرسانی زنده (اصولِ یکسان با رندر اولیه) ---------- */
function paintSalesPaneV29(tab,data){
  const pane=app.salesV29.panes?.[tab]; if(!pane)return;
  if(pane.dataset.renderedV29!=='1'){
    pane.innerHTML=salesV29RenderPane(tab,data);
    pane.dataset.renderedV29='1';
    bindSalesPaneV29(tab);
    if(tab==='settlement' && stl.orderId) void stlOpen(stl.orderId);
    return;
  }
  if(tab==='onsite'){
    const list=pane.querySelector('#salesOnsiteListV25'); if(list)list.innerHTML=salesOnsiteRowsV25((data.visits||[]).filter(v=>v.status==='WAITING_SALES'));
  }else if(tab==='remote'){
    const live=remotePhoneQueueRowsV40(data.orders||[]);
    const host=pane.querySelector('.phone-queue-list-v40'); if(host)host.innerHTML=live.html;
    const count=pane.querySelector('.phone-queue-panel-v40 .sales-section-count strong'); if(count)count.textContent=qty(live.queue.length);
  }else if(tab==='stores'){
    pane.innerHTML=salesV29RenderPane(tab,data);
  }else if(tab==='flow'){
    const list=pane.querySelector('.v26-flow-list'); if(list)list.innerHTML=salesFlowRowsV27(salesFlowOrders(data.orders||[]))||sdEmpty('truck','سفارشی در جریان نیست','هر سفارشی که به انبار ارسال شود در این فهرست قرار می‌گیرد.');
  }else if(tab==='settlement'){
    const all=salesAllInSettlement(data.orders||[]);
    const p=pane.querySelector('.v26-settlement-list'); if(p)p.innerHTML=settlementPendingRowsV27(all.filter(o=>o.status==='SETTLEMENT_PENDING'));
    const i=pane.querySelector('.v26-invoice-list'); if(i)i.innerHTML=invoiceRowsV27(all.filter(o=>['SETTLED','EXITED'].includes(o.status)||((o.payments||[]).length&&!['SETTLEMENT_PENDING','CANCELLED'].includes(o.status)&&!o.payment?.archived))); // v37.5.0
  }else if(tab==='delivery'){
    pane.innerHTML=renderSalesDeliveryV38(data.dispatchDeliveries||{});
  }else if(tab==='future'){
    const list=pane.querySelector('#futureOrderListV25'); if(list)list.innerHTML=futureOrderRowsV25(salesFutureOrders(data.orders||[]));
    void refreshDepositRefunds();
  }
}

/* ================================================================
   قدم ۲ — بازطراحی کارتابل نگهبانی (v38)
   قراردادها حفظ شده‌اند: #gateForm, #noVehicle, #plateBox,
   #plateSuggest, #exitEditor, [data-exit-item], data-sub="gate:*"
   + رفع باگ قدیمی: اتصال کلیک پیشنهادهای پلاک (pick-customer)
   ================================================================ */

/* جلوگیری از تداخل هندلر فروش با دکمه‌های نگهبانی */
(function(){
  const _salesClick = salesV29ClickHandler;
  window.salesV29ClickHandler = function(e){ if(app.page==='gate') return; return _salesClick(e); };
  const _refresh = refreshIndicators;
  window.refreshIndicators = async function(){ await _refresh(); $$('.sd-tab-count[data-badge-key]').forEach(el=>el.classList.toggle('show',!!String(el.textContent).trim())); };
})();

function gtQueueRow(v){
  return `<div class="sd-queue-row" style="grid-template-columns:auto minmax(0,1fr) auto;cursor:default">
    <span class="sd-avatar">${esc(initials(v.customer?.name||''))}</span>
    <span class="sd-queue-main"><strong>${esc(v.customer?.name||'—')}</strong><span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px">${v.customer?.code?`<span class="sd-chip cust-code-chip">${esc(v.customer.code)}</span>`:''}${plateViewHtml(v.customer?.plate, 'بدون پلاک', true)}<span class="sd-chip">${esc(v.customer?.phone||'—')}</span></span></span>
    ${badge(v.status)}
  </div>`;
}

function gateDispatchFocusMarkup(data){
  const rows=data.leaving||[];
  const cards=rows.map(o=>gateDispatchCard(o,'exit')).join('')||sdEmpty('truck','سفارشی در انتظار تأیید خروج نیست','پس از ثبت خروج راننده، سفارش برای کنترل در این بخش نمایش داده می‌شود.');
  return `<section class="sd-panel gate-dispatch-focus" aria-label="در انتظار تأیید خروج"><div class="gate-tab-context"><p>خروج اعلام‌شده را پس از کنترل تأیید کنید.</p><span class="sd-count"><strong>${qty(rows.length)}</strong><span>سفارش</span></span></div><div class="adm-list dsp-list gate-dispatch-vertical-list">${cards}</div></section>`;
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
  const exitOrders=tab==='exit'?((await api('/api/orders?status=SETTLED')).orders||[]):[];
  const pickupExits=tab==='exit'&&app.features?.pickupStaging?(await fetchPagedList('/api/pickup/active','orders')).orders:[];
  if(app.page!=='gate'||app.sub.gate!==tab||app.gateRenderSeq!==renderSeq)return;
  let html='<span class="gate-ui-build" data-ui-build="37.3.18" hidden></span><div class="gate-workspace-content">';
  if(tab==='entry')html+=renderGateEntry();
  else if(tab==='waiting')html+=renderGateWaiting(visits.filter(v=>v.status==='WAITING_SALES'));
  else if(tab==='history')html+=`<div class="gate-history-search"><label for="gateHistorySearch">جستجوی سوابق مراجعه</label><input id="gateHistorySearch" type="search" maxlength="80" value="${esc(app.gateHistoryQ||'')}" placeholder="نام، شماره تماس، پلاک، کد یا هدف مراجعه" autocomplete="off"><small>آخرین ۱۰۰ نتیجه نمایش داده می‌شود.</small></div><div id="gateHistoryLive" aria-live="polite">${renderGateHistory(visits,true)}</div>`;
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
    ${app.features?.pickupStaging?`<div class="sd-pad" data-pickup-search><label for="pickupOrderSearch">جست‌وجوی سفارش غیرحضوری برای تحویل در انبار</label><div class="cust-code-row"><input id="pickupOrderSearch" type="search" maxlength="80" placeholder="شماره سفارش، نام یا شماره تماس صاحب سفارش"><button type="button" class="btn btn-secondary" data-pickup-clear hidden>بازگشت به ورود عادی</button></div><div data-pickup-results aria-live="polite"></div><div data-pickup-selected></div></div>`:''}
    <form id="gateForm" autocomplete="on">
      <div class="sd-pad gt-entry-pad">
        <div class="gt-fieldset">
          <div class="gt-fieldset-title" data-gate-person-title>${icon('user',16)} مشخصات مشتری</div>
          <div class="gt-entry-cust">
            <div class="cust-code-entry"><div class="field"><label for="gateCustCode">جستجوی مشتری <small>(کد، نام، تماس یا پلاک)</small></label><div class="cust-code-row"><div class="input-shell"><span>${icon('search',16)}</span><input id="gateCustCode" name="customerSearch" autocomplete="off" placeholder="کد، نام، تماس یا پلاک" aria-controls="gateCustomerResults" aria-autocomplete="list" aria-expanded="false" role="combobox"></div><button type="button" class="btn btn-secondary" data-action="gate-code-lookup">جستجو</button></div></div><input type="hidden" name="customerId" id="gateCustId"><input type="hidden" name="customerCode" id="gateCustomerCodeValue"><div id="gateCustomerResults" class="gate-customer-results" aria-live="polite"></div><div id="gateCustChip"></div></div>
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
  return `<article class="gt-exit-card" data-order="${esc(o.id)}">${field('مشتری',name)}${field('شماره و تاریخ سفارش',fa(o.orderNo||'—')+' • '+dt(o.createdAt))}${field('شماره فاکتور',fa(o.payment?.invoiceNumber||'—'))}${field('پلاک',fa(plate),plateViewHtml(o.customer?.plate,'بدون پلاک',true))}${field('شماره تماس',fa(phone))}${field('مبلغ',String(o.payment?.totalAmount??'—'),money(o.payment?.totalAmount))}${field('زمان تسویه',dt(o.payment?.verifiedAt))}${field('تعداد اقلام',String(activeItemsOf(o).length),qty(activeItemsOf(o).length)+' قلم')}<div class="gt-exit-actions"><button class="btn btn-secondary btn-sm" data-action="invoice" data-id="${esc(o.id)}">${icon('eye',14)} فاکتور</button><button class="btn btn-success btn-sm" data-action="open-exit" data-id="${esc(o.id)}">${icon('check',14)} کنترل خروج</button></div></article>`;
}
function renderGateExit(orders){
  if(app.features?.pickupStaging)orders=orders.filter(o=>!o.pickupHandover);
  return `<section class="sd-panel gt-exit-panel">
    <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--green-bg);color:var(--green)">${icon('check',19)}</span><div><h2>فاکتورهای آماده خروج</h2><p>فقط فاکتورهای تسویه‌شده در این کارتابل قابل کنترل هستند.</p></div></div><div class="sd-count"><strong>${qty(orders.length)}</strong><span>آماده</span></div></div>
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
    if(a==='invoice')return previewInvoice(el.dataset.id);
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
      <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--green-bg);color:var(--green)">${icon('truck',19)}</span><div><h2>کنترل خروج — ${esc(fa(o.payment?.invoiceNumber||o.orderNo||'—'))}</h2><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px"><span>${esc(storeAwareOrderName(o))}</span>${plateViewHtml(o.customer?.plate, 'بدون پلاک', true)}</div></div></div><div class="toolbar"><button class="btn btn-secondary btn-sm" data-action="invoice" data-id="${id}">${icon('receipt',14)} فاکتور</button></div></div>
      <div class="sd-pad">
        <div class="gt-check-list">${o.items.filter(i=>i.itemStatus!=='CANCELLED').map(i=>`<label class="gt-check"><input type="checkbox" data-exit-item="${i.id}" checked><span><b>${esc(i.product?.name||'—')}</b><small>${qty(i.deliveredKg)} کیلوگرم • ${money(i.finalAmount)}</small></span>${badge(i.itemStatus)}</label>`).join('')}</div>
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

function wh38Tabs(active){
  const inc=badgeCount('warehouseIncomingRegular')||badgeCount('warehouseIncoming'), prep=badgeCount('warehousePreparingRegular')||badgeCount('warehousePreparing'), st=badgeCount('warehouseStores');
  return `<div class="wh38-tabs">
    <button type="button" class="wh38-tab ${active==='incoming'?'active':''}" data-wh38-tab="incoming"><span class="wh38-tab-idx">۰۱</span><span>${icon('truck',22)}</span><div><b>سفارش‌های ورودی</b><small>فقط مشتریان عادی — تأیید ورود به آماده‌سازی</small></div><em>${qty(inc)}</em></button>
    <button type="button" class="wh38-tab ${active==='preparing'?'active':''}" data-wh38-tab="preparing"><span class="wh38-tab-idx">۰۲</span><span>${icon('scale',22)}</span><div><b>آماده‌سازی و تحویل</b><small>فقط مشتریان عادی — ثبت وزن و ارسال به تسویه فروش</small></div><em>${qty(prep)}</em></button>
    <button type="button" class="wh38-tab ${active==='stores'?'active':''}" data-wh38-tab="stores" data-testid="wh-stores-tab"><span class="wh38-tab-idx">۰۳</span><span>${icon('store',22)}</span><div><b>فروشگاه‌ها</b><small>تأیید، آماده‌سازی و سرویس‌های ارسال فروشگاه‌ها</small></div><em>${qty(st)}</em></button>
    <button type="button" class="wh38-tab wh38-tab-history ${active==='history'?'active':''}" data-wh38-tab="history"><span class="wh38-tab-idx">۰۴</span><span>${icon('reports',22)}</span><div><b>سوابق و گزارش</b><small>سفارش‌های تحویل‌شده، خلاصهٔ کالاها و چاپ گزارش</small></div></button>
  </div>`;
}
/* v37.3.18 — compact incoming header: customer and three equal metadata cells. */
function wh38IncomingHeader(o){
  const name=storeAwareOrderName(o);
  const created=formatDateTime24(o.createdAt);
  const updated=formatDateTime24(o.updatedAt||o.createdAt);
  const contact=o.orderType==='STORE'?(o.dispatchPlace||''):(storeAwareOrderPhone(o));
  return `<div class="wh38-incoming-heading"><div class="sd-chips"><span class="order-code">${esc(fa(o.orderNo||'—'))}</span>${sdTypeBadge(o)}</div>${badge(o.status)}</div>
    <div class="wh38-incoming-summary-scroll"><div class="wh38-incoming-summary">
      <div class="wh38-incoming-cell wh38-incoming-customer"><b>${o.orderType==='STORE'?'فروشگاه':'مشتری'}</b><h3 title="${esc(name)}">${esc(name)}</h3></div>
      <div class="wh38-incoming-cell"><b>اقلام</b><span>${qty(activeItemsOf(o).length)} قلم</span></div>
      <div class="wh38-incoming-cell"><b>ثبت</b><span title="${esc(created)}">${esc(created)}</span></div>
      <div class="wh38-incoming-cell"><b>آخرین اقدام</b><span title="${esc(updated)}">${esc(updated)}</span></div>
    </div></div>
    <p class="wh38-incoming-contact">${esc(contact||'محل ارسال ثبت نشده')}${o.deliveryDate?` <span class="wh38-delivery-date"> • تاریخ تحویل: <b>${esc(dateLabel(o.deliveryDate))}</b></span>`:''}</p>`;
}
/* v37.9.0 — Warehouse > Stores: horizontal sub-tabs (like Guard/Sales) + vertical forms.
   The order header is deliberately one line: order no. + store + items + time (+place).
   Full timestamps stay in the title tooltip; the 4-cell summary is not used for stores. */
function wh38StoreTabs(active,counts){
  // v37.36.0 — سربرگ سوم «سوابق و گزارشات»: سفارش‌های فروشگاهی که کار انبارشان پایان یافته
  const tabs=[['incoming','ورودی'],['preparing','آماده‌سازی و سرویس‌ها'],['history','سوابق و گزارشات']];
  return `<nav class="wh38-store-tabs" role="tablist" aria-label="بخش‌های فروشگاه در انبار">${tabs.map(([id,label])=>`<button type="button" role="tab" class="wh38-store-tab ${active===id?'active':''}" data-wh38-store-tab="${id}" aria-selected="${active===id}"><span>${label}</span><b>${qty(counts[id]||0)}</b></button>`).join('')}</nav><div class="wh-store-doc-shortcut"><button type="button" class="btn btn-secondary btn-sm" data-wh-store-docs-link>${icon('receipt',14)} اسناد انبار سرویس‌های فروشگاه</button></div>`;
}
function wh38StoreHeader(o){
  const name=storeAwareOrderName(o);
  const created=formatDateTime24(o.createdAt);
  const updated=formatDateTime24(o.updatedAt||o.createdAt);
  const place=String(o.dispatchPlace||'').trim();
  const tip=`ثبت: ${created} • آخرین اقدام: ${updated}${place?` • محل ارسال: ${place}`:''}`;
  return `<div class="wh38-store-head" title="${esc(tip)}"><span class="order-code">${esc(fa(o.orderNo||'—'))}</span><strong class="wh38-store-name" title="${esc(name)}">${esc(name)}</strong><span class="wh38-store-meta">${qty(activeItemsOf(o).length)} قلم • ${esc(created)}${place?` • ${esc(place)}`:''}</span>${badge(o.status)}</div>`;
}
function wh38StoreList(orders,kind){
  if(kind==='incoming') return `<div class="wh38-store-list whsin22-list">${orders.map(o=>`<article class="wh38-card wh38-store-card whsin22-card order-summary-row"><div class="whsin22-id order-summary-cell order-summary-identity"><strong class="whsin22-store" title="${esc(o.storeName||'فروشگاه')}">${esc(o.storeName||'فروشگاه')}</strong><small class="whsin22-customer">مشتری: ${esc(o.customer?.name||'—')}</small></div><span class="order-code order-summary-cell">شماره سفارش ${esc(fa(o.orderNo||'—'))}</span><span class="whsin22-time order-summary-cell" title="ثبت: ${esc(formatDateTime24(o.createdAt))}${o.scheduledAt?` • زمان ارسال: ${esc(formatDateTime24(o.scheduledAt))}`:''}">${icon('calendar',13)} ${esc(formatDateTime24(o.createdAt))}</span><span class="order-summary-cell order-summary-status">${badge(o.status)}</span><span class="order-summary-cell">${qty((o.items||[]).filter(i=>i.itemStatus!=='CANCELLED').length)} قلم</span><div class="whsin22-actions order-summary-cell order-summary-actions"><button type="button" class="btn btn-secondary btn-sm" data-action="wh38-store-details" data-id="${o.id}">${icon('eye',14)} جزئیات</button></div></article>`).join('')}</div>`;
  if(kind==='preparing') return `<div class="wh38-store-list whsin22-list">${orders.map(o=>`<article class="wh38-card wh38-store-card whsin22-card whprep23-card order-summary-row"><div class="whsin22-id order-summary-cell order-summary-identity"><strong class="whsin22-store" title="${esc(o.storeName||'فروشگاه')}">${esc(o.storeName||'فروشگاه')}</strong><small class="whsin22-customer">مشتری: ${esc(o.customer?.name||'—')}</small></div><span class="order-code order-summary-cell">شماره سفارش ${esc(fa(o.orderNo||'—'))}</span><span class="order-summary-cell">تاریخ ${esc(formatDateTime24(o.createdAt))}</span><span class="order-summary-cell order-summary-status">${badge(o.status)}</span><span class="whprep23-count order-summary-cell">${qty(activeItemsOf(o).length)} قلم</span><div class="whsin22-actions order-summary-cell order-summary-actions"><button type="button" class="btn btn-primary btn-sm" data-action="wh38-start" data-id="${o.id}">${icon('eye',14)} جزئیات</button></div></article>`).join('')}</div>`;
  return `<div class="wh38-store-list">${orders.map((o,i)=>`<article class="wh38-card wh38-store-card">
    <div class="wh38-no">${fa(String(i+1).padStart(2,'0'))}</div>
    <div class="wh38-store-card-main">
      ${wh38StoreHeader(o)}
      <div class="wh38-items">${activeItemsOf(o).map((it,k)=>`<div><span>${fa(String(k+1))}</span><span style="font-weight:800">${esc(it.product?.name||'—')}</span><b>${qty(it.requestedQty)} ${esc(it.requestedUnit||'')}</b></div>`).join('')}</div>
      ${kind==='preparing'&&o.storeRun&&o.storeRun.enabled?sr38Chips(o):''}
      <div class="wh38-actions">${kind==='incoming'
        ?`<button type="button" class="btn btn-primary btn-lg" data-action="wh38-accept" data-id="${o.id}">${icon('check',17)} تأیید دریافت و ورود به آماده‌سازی</button>`
        :`<button type="button" class="btn btn-primary btn-lg" data-action="wh38-start" data-id="${o.id}">${icon('scale',17)} ${o.storeRun&&o.storeRun.enabled?'برگهٔ سرویس‌های ارسال (سفارش فروشگاه)':'شروع آماده‌سازی و ثبت وزن'}</button>`}</div>
    </div>
  </article>`).join('')}</div>`;
}
/* v37.22.0 — جزئیات کامل سفارش ورودی فروشگاه در انبار؛ تأیید در پایان فهرست اقلام و ورود به آماده‌سازی */
/* v37.35.0 — همان فرم، فشرده: سربرگ و مشخصات در دو خط، برچسب ستون‌ها فقط در سطر عنوان،
   ردیف‌های تک‌خطی کوتاه‌تر؛ شبکهٔ شش‌خانه و تکرار نام فروشگاه/مشتری حذف شد تا ارتفاع کم شود. */
async function wh38StoreDetails(id){
  const notices=captureEntityNotices('order',id);
  try{
    const d=await api('/api/orders/'+id); const o=d.order||{};
    if(o.orderType!=='STORE') return toast('این سفارش از نوع فروشگاهی نیست.');
    const items=activeItemsOf(o);
    const canAccept=o.status==='WAREHOUSE_PENDING';
    openModal('جزئیات سفارش فروشگاه',`<div class="whsin22-detail whd35-detail"><div class="whd35-head"><div class="whd35-title"><h2>${esc(o.storeName||'فروشگاه')}</h2><span>مشتری: ${esc(o.customer?.name||'—')}</span></div>${badge(o.status)}</div><div class="whd35-meta"><span>شماره سفارش <b>${esc(fa(o.orderNo||'—'))}</b></span><span>ثبت <b>${esc(formatDateTime24(o.createdAt))}</b></span>${o.scheduledAt?`<span>زمان ارسال <b>${esc(formatDateTime24(o.scheduledAt))}</b></span>`:''}${o.dispatchPlace?`<span>محل ارسال <b>${esc(o.dispatchPlace)}</b></span>`:''}</div>${o.notes?`<div class="detail-note whd35-note"><span>${icon('info',14)}</span><div><b>یادداشت سفارش</b><p>${esc(o.notes)}</p></div></div>`:''}<div class="whd23-list whd35-list"><div class="whd23-row whd35-headrow" aria-hidden="true"><span></span><span>محصول</span><span>مقدار</span><span>واحد</span><span>توضیحات</span></div>${items.map((it,k)=>`<div class="whd23-row"><span class="whd23-num">${fa(String(k+1))}</span><div class="whd23-box whd23-product"><b title="${esc(it.product?.name||'—')}">${esc(it.product?.name||'—')}</b></div><div class="whd23-box"><b>${qty(it.requestedQty)}</b></div><div class="whd23-box"><b>${esc(it.requestedUnit||'')}</b></div><div class="whd23-box whd23-desc"><b title="${esc(it.description||'بدون توضیح')}">${esc(it.description||'بدون توضیح')}</b></div></div>`).join('')||'<div class="empty">قلمی در این سفارش ثبت نشده است.</div>'}</div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">بستن</button>${canAccept?`<button type="button" class="btn btn-primary" data-action="wh38-accept-details" data-id="${o.id}">${icon('check',16)} تأیید دریافت و ورود به آماده‌سازی</button>`:''}</div></div>`);
    finishEntityNotices(notices);return true;
  }catch(e){toast(e.message);return false;}
}
async function wh38AcceptFromDetails(id,btn){
  const notices=captureEntityNotices('order',id);
  if(btn)btn.disabled=true;
  try{
    await api('/api/orders/'+id+'/warehouse/accept',{method:'POST'});
    finishEntityNotices(notices);
    closeModal();
    toast('سفارش تأیید شد و وارد مرحله آماده‌سازی شد.');
    await refreshIndicators();
    if(app.wh38.phase==='stores') wh38Paint('stores');
  }catch(e){ toast(e.message); if(btn)btn.disabled=false; }
}
function wh38List(orders,kind){
 if(!orders.length)return sdEmpty(kind==='incoming'?'truck':'scale',kind==='incoming'?'سفارش ورودی جدیدی نیست':'سفارشی در مرحله آماده‌سازی نیست','');
 return `<div class="wh38-list wh38-incoming-list order-compact-scroll">${orders.map(o=>orderSummaryRow(o,{className:'wh38-card wh38-incoming-card order-compact-row',statusHtml:badge(o.status),itemCount:activeItemsOf(o).length,extras:o.deliveryDate?[{html:`تاریخ تحویل: ${esc(dateLabel(o.deliveryDate))}`}]:[],actionsHtml:`<button type="button" class="btn btn-secondary btn-sm" data-action="wh38-order-details" data-id="${esc(o.id)}">${icon('eye',14)} جزئیات سفارش</button>${app.features?.pickupStaging&&o.visit?.status==='PICKUP_PRESENT'&&!o.pickupCancellation?`<button type="button" class="btn btn-secondary btn-sm" data-action="pickup-cancel" data-id="${esc(o.id)}">ثبت انصراف بدون تحویل</button>`:''}${o.pickupCancellation?.status==='PENDING_SALES'?'در انتظار تأیید انصراف فروش':kind==='incoming'?`<button type="button" class="btn btn-primary btn-sm" data-action="wh38-accept" data-id="${esc(o.id)}">تأیید دریافت</button>`:`<button type="button" class="btn btn-primary btn-sm" data-action="wh38-start" data-id="${esc(o.id)}">شروع آماده‌سازی</button>`}`})).join('')}</div>`;
}
async function wh38Paint(phase){
  if(phase==='history') return; // سوابق با فیلترهای کاربر؛ نوسازی خودکار ۷ ثانیه‌ای فیلترها را به‌هم نمی‌زند
  const host=$('#wh38Body'); if(!host||host.dataset.sheet==='1')return;
  try{
    if(phase==='delivered'){ await whDeliveredPaint(host); return; }
    if(phase==='stores'){ // v37.9.0 — فروشگاه‌های انبار: سربرگ افقی، فرم/فهرست عمودی زیر آن
      const active=['incoming','preparing','history'].includes(app.wh38.storeTab)?app.wh38.storeTab:'incoming'; app.wh38.storeTab=active;
      if(active==='history'&&host.querySelector('[data-wh38-store-history]')) return; // v37.36.0 — فیلترهای سوابق با تازه‌سازی خودکار ۷ ثانیه‌ای به‌هم نمی‌ریزد
      const [inc,prep,histAll]=(await Promise.all([fetchPagedList('/api/orders?status=WAREHOUSE_PENDING','orders'),fetchPagedList('/api/orders?status=WAREHOUSE_PREPARING','orders'),api('/api/warehouse/history?from=2000-01-01&to='+today()+'&orderType=STORE')]));
      const incRows=((inc&&inc.orders)||[]).filter(o=>o.orderType==='STORE');
      // v37.19.0 — سفارشی که عملیات انبارش پایان یافته (finalizedAt) دیگر کار انباری ندارد و تا نهایی‌شدن محموله‌ها نزد فروش می‌ماند؛ در فهرست آماده‌سازی انبار نمی‌ماند.
      const prepRows=((prep&&prep.orders)||[]).filter(o=>o.orderType==='STORE'&&!(o.storeRunOps&&o.storeRunOps.finalizedAt));
      const counts={incoming:incRows.length,preparing:prepRows.length,history:(histAll&&histAll.summary&&histAll.summary.orders)||0};
      if(active==='history'){
        host.innerHTML=`<div class="wh38-store-pane">${wh38StoreTabs(active,counts)}<section class="wh38-store-panel" role="tabpanel" data-wh38-store-panel="history"><div data-wh38-store-history></div></section></div>`;
        renderWhStoreHistory();
        return;
      }
      const rows=active==='preparing'?prepRows:incRows;
      const empty=active==='preparing'
        ?'<div class="sd-empty"><div>'+icon('scale',26)+'</div><strong>سفارش فروشگاهی در حال آماده‌سازی نیست</strong><span>پس از تأیید دریافت، سفارش فروشگاه برای سرویس‌بندی و ثبت وزن اینجا قرار می‌گیرد.</span></div>'
        :'<div class="sd-empty"><div>'+icon('store',26)+'</div><strong>سفارش فروشگاهی ورودی نیست</strong><span>وقتی فروش سفارش فروشگاه را به انبار ارسال کند، در همین سربرگ نمایش داده می‌شود.</span></div>';
      host.innerHTML=`<div class="wh38-store-pane">${wh38StoreTabs(active,counts)}<section class="wh38-store-panel" role="tabpanel" data-wh38-store-panel="${active}">${rows.length?wh38StoreList(rows,active):empty}</section></div>`;
      return;
    }
    const status=phase==='incoming'?'WAREHOUSE_PENDING':'WAREHOUSE_PREPARING';
    const orders=(((await fetchPagedList('/api/orders?status='+encodeURIComponent(status),'orders')).orders)||[]).filter(o=>o.orderType!=='STORE'); // v37.6.0 — سفارش‌های فروشگاه از تب‌های عادی انبار جدا شدند
    let waiting='';
    if(app.features?.pickupStaging&&phase==='incoming'){
      const active=(await fetchPagedList('/api/pickup/active','orders')).orders;
      const early=active.filter(o=>['SCHEDULED_REMOTE','RETURNED_TO_SALES'].includes(o.status)&&!o.cancellation);
      if(early.length)waiting=`<section class="sd-panel"><h3>مراجعهٔ سفارش‌های هنوز فعال‌نشده در انبار</h3>${early.map(o=>`<div class="order-compact-row"><b>سفارش ${esc(fa(o.orderNo||'—'))}</b><span>صاحب سفارش: ${esc(o.customerName)}</span><span>تحویل‌گیرنده: ${esc(o.recipient?.name||'—')}</span><button type="button" class="btn btn-secondary btn-sm" data-action="pickup-cancel" data-id="${esc(o.id)}">ثبت انصراف بدون تحویل</button></div>`).join('')}</section>`;
    }
    host.innerHTML=waiting+wh38List(orders,phase);
  }
  catch{ host.innerHTML='<div class="empty">خطا در دریافت صف انبار.</div>'; }
}
// Completed regular warehouse orders: this is a read-only warehouse document,
// The printed acknowledgement requires the customer's handwritten signature;
// producing it alone does not record or verify a signature.
app.whDelivered=app.whDelivered||{q:'',offset:0,seq:0};
async function whDeliveredPaint(host){
  if(!host.querySelector('[data-wh-delivered]')){
    host.innerHTML=`<section class="wh-delivered" data-wh-delivered><div class="wh-delivered-heading"><div><h2>تحویل شده</h2><p>سفارش‌های مشتریان عادی پس از ثبت وزن نهایی انبار؛ سفارش‌های فروشگاه در بخش فروشگاه‌ها هستند.</p></div></div><form class="wh-delivered-search"><label for="whDeliveredQ">جستجوی سند، سفارش، مشتری یا کالا</label><div><input id="whDeliveredQ" type="search" maxlength="80" value="${esc(app.whDelivered.q)}" placeholder="شماره سند یا سفارش، نام یا شماره تماس"><button class="btn btn-secondary" type="submit">جستجو</button></div></form><div id="whDeliveredRows" aria-live="polite">در حال دریافت سفارش‌ها…</div></section>`;
    host.querySelector('form').addEventListener('submit',e=>{e.preventDefault();app.whDelivered.q=host.querySelector('#whDeliveredQ').value.trim();app.whDelivered.offset=0;whDeliveredLoad();});
  }
  await whDeliveredLoad();
}
function whDeliveredRow(o){
 const handover=o.deliveryMode==='DELIVERY'?(o.handedOverToDriver?'تحویل به راننده ثبت شد':(o.driverName?'در انتظار تحویل به راننده':'در انتظار تعیین راننده')):'وزن نهایی ثبت شد';
 return orderSummaryRow(o,{className:'wh-delivered-row',name:o.customerName||'—',statusHtml:`<span class="badge blue">${handover}</span>`,itemCount:o.itemCount,extras:[{html:`سند ${esc(fa(o.warehouseDocumentNo||'—'))}`},{html:`${qty(o.deliveredKg)} کیلوگرم`},{html:`ثبت وزن: ${esc(formatDateTime24(o.completedAt))}`}],actionsHtml:`<button type="button" class="btn btn-secondary btn-sm" data-action="wh-delivered-details" data-id="${esc(o.id)}" ${o.deliveryMode==='DELIVERY'&&!o.driverName?'disabled title="پس از تعیین راننده قابل چاپ است"':''}>${icon('eye',14)} جزئیات و چاپ</button>`});
}
async function whDeliveredLoad(){
  const st=app.whDelivered,seq=++st.seq;
  try{
    const d=await api('/api/warehouse/delivered?'+new URLSearchParams({q:st.q,offset:String(st.offset)}));
    if(seq!==st.seq||app.wh38.phase!=='delivered')return;
    if(d.offset>=d.total&&d.offset>0){st.offset=Math.max(0,Math.ceil(d.total/d.limit-1)*d.limit);return whDeliveredLoad();}
    const host=$('#whDeliveredRows');if(!host)return;
    host.innerHTML=`<div class="order-compact-scroll wh-delivered-list">${d.orders.map(whDeliveredRow).join('')||'<div class="empty">سفارش وزن‌نهایی‌شده‌ای یافت نشد.</div>'}</div><div class="wh-delivered-pages"><button type="button" class="btn btn-secondary btn-sm" data-action="wh-delivered-prev" ${d.offset===0?'disabled':''}>قبلی</button><span>${qty(d.total)} سفارش${d.total?` • ${qty(d.offset+1)} تا ${qty(Math.min(d.offset+d.limit,d.total))}`:''}</span><button type="button" class="btn btn-secondary btn-sm" data-action="wh-delivered-next" ${d.offset+d.limit>=d.total?'disabled':''}>بعدی</button></div>`;
  }catch(e){const host=$('#whDeliveredRows');if(host&&seq===st.seq)host.innerHTML=`<div class="empty">خطا در دریافت سفارش‌ها: ${esc(e.message)}</div>`;}
}
// The interactive document keeps every recorded weighing separate; print omits them entirely.
function whDocumentTares(line){
 const types=[['basket18','سبد ۱٫۸ کیلوگرمی',true],['basket25','سبد ۲٫۵ کیلوگرمی',true],['box300','کارتن ۳۰۰ گرمی',true],['box600','کارتن ۶۰۰ گرمی',true],['rackKg','راک',false],['cartKg','گاری',false]];
 const rows=Array.isArray(line.weighings)?line.weighings:[];
 const batches=rows.map((row,index)=>{
  const chips=types.map(([key,label,count])=>{const amount=Number(row[key]);return Number.isFinite(amount)&&amount>0?`<span class="whd-tare-chip"><span>${label}</span><b>${qty(amount)} ${count?'عدد':'کیلوگرم'}</b></span>`:'';}).join('');
  const weight=key=>row[key]==null||!Number.isFinite(Number(row[key]))?'نامشخص':qty(row[key]);
  return `<div class="whd-tare-batch"><b>نوبت ${fa(index+1)}</b><span>ناخالص ${weight('grossKg')} کیلوگرم · کسر ${weight('tareKg')} کیلوگرم · خالص ${weight('netKg')} کیلوگرم</span><div class="whd-tare-list">${chips||'<span class="whd-tare-empty">بدون ناخالصی</span>'}</div></div>`;
 }).join('');
 const incomplete=line.missingWeighings?'<span class="whd-tare-unknown">بخشی از جزئیات ثبت نشده</span>':(!Array.isArray(line.weighings)?'<span class="whd-tare-unknown">جزئیات ثبت نشده</span>':'');
 return batches||incomplete?batches+incomplete:'<span class="whd-tare-empty">—</span>';
}
function whDocumentProducts(lines,print=false){
 lines=Array.isArray(lines)?lines:[];
 let grams=0,unknown=!lines.length;
 const rows=lines.map((line,index)=>{
  const available=!line.outOfStock, n=line.deliveredKg==null?NaN:Number(line.deliveredKg);
  if(available){if(Number.isFinite(n)&&n>=0)grams+=Math.round(n*1000);else unknown=true;}
  return `<tr><td class="whd-number">${fa(index+1)}</td><td class="whd-product"><b>${esc(line.productName||'—')}</b></td>${print?'':`<td class="whd-tare-cell">${available?whDocumentTares(line):'<span class="whd-tare-empty">—</span>'}</td>`}<td class="whd-quantity whd-net">${available?(Number.isFinite(n)&&n>=0?qty(n):'نامشخص'):'ناموجود'}</td></tr>`;
 }).join('')||`<tr><td colspan="${print?3:4}">جزئیات اقلام در سابقه موجود نیست.</td></tr>`;
 return `<div class="whd-table-scroll"><table class="whd-products${print?' whd-print-products':''}"><colgroup><col class="whd-col-number"><col class="whd-col-product">${print?'':'<col class="whd-col-tares">'}<col class="whd-col-weight"></colgroup><thead><tr><th>ردیف</th><th>محصول</th>${print?'':'<th>ناخالصی‌های کسرشده</th>'}<th>جمع خالص (کیلوگرم)</th></tr></thead><tbody>${rows}</tbody></table></div><div class="whd-total"><span>جمع کل خالص</span><strong>${unknown?'نامشخص':qty(grams/1000)+' کیلوگرم'}</strong></div>`;
}
function whDeliveredDocument(o,print=false){
  const customer=esc(o.customerName||'—'), phone=esc(fa(o.customerPhone||'—'));
  const driver=o.deliveryMode==='DELIVERY'?esc(o.driverName||'—'):'';
  const recipient=o.deliveryMode==='PICKUP'&&o.recipient?.name?o.recipient:null;
  const recipientInfo=recipient?`<div class="whd-meta"><span><span class="whd-label">تحویل‌گیرنده:</span><b>${esc(recipient.name)}</b></span><span><span class="whd-label">تماس تحویل‌گیرنده:</span><b dir="ltr">${esc(fa(recipient.phone||'—'))}</b></span><span><span class="whd-label">وسیله:</span><b>${esc([recipient.vehicleType,recipient.carType].filter(Boolean).join(' — ')||'—')}</b></span><span><span class="whd-label">پلاک:</span><b>${esc(fa(recipient.plate||'بدون پلاک'))}</b></span></div>`:'';
  const receiverName=recipient?esc(recipient.name):customer,receiverPhone=recipient?esc(fa(recipient.phone||'—')):phone;
  return `<div class="whd-doc"><div class="whd-head"><div class="whd-document-number"><span>شماره سند انبار</span><b dir="ltr">${esc(fa(o.warehouseDocumentNo||'—'))}</b></div><div class="whd-meta"><span><span class="whd-label">نام مشتری:</span><b>${customer}</b></span><span><span class="whd-label">شماره تماس:</span><b dir="ltr">${phone}</b></span><span><span class="whd-label">شماره سفارش:</span><b dir="ltr">${esc(fa(o.orderNo))}</b></span><span><span class="whd-label">تاریخ ثبت سفارش:</span><b>${esc(formatDateTime24(o.createdAt))}</b></span></div></div>${recipientInfo}${whDocumentProducts(o.items,print)}<section class="whd-acknowledgement"><p class="whd-declaration">اینجانب (${receiverName}) ${recipient?`به عنوان تحویل‌گیرنده سفارش مشتری (${customer}) `:''}اقلام فوق را صحیح و سالم تحویل گرفته و اقلام تحویلی به صورت امانت تا زمان پرداخت مبلغی ریالی آن نزد اینجانب امانت می باشد.</p><div class="whd-signature"><span>${driver?'امضاء مشتری پس از تحویل':recipient?'امضاء تحویل‌گیرنده':'امضاء'}</span><b>${receiverName} – ${receiverPhone}</b></div>${driver?`<p class="whd-declaration">اینجانب (${driver}) اقلام فوق را از انبار برای حمل و تحویل به مشتری دریافت نمودم.</p><div class="whd-signature"><span>امضاء راننده هنگام دریافت از انبار</span><b>${driver} – ${esc(fa(o.driverPhone||'—'))}</b></div>`:''}</section></div>`;
}
function whCanRegisterHandover(){return app.page==='warehouse' && ['warehouse','admin'].includes(normalizeRole(app.user?.roleCode));}
async function whDeliveredDetails(id){
  const notices=captureEntityNotices('order',id);
  try{
    const {order}=await api('/api/warehouse/delivered/'+encodeURIComponent(id));
    openModal('جزئیات سند انبار',whDeliveredDocument(order)+`<div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">بستن</button><button type="button" class="btn btn-primary" data-wh-delivered-print>${icon('receipt',16)} چاپ سند انبار</button>${order.handoverToken&&whCanRegisterHandover()?'<button type="button" class="btn btn-primary" data-wh-handover>ثبت تحویل و چاپ سند</button>':''}</div>`);
    $('#modal [data-wh-delivered-print]').addEventListener('click',()=>whDeliveredPrint(id));
    $('#modal [data-wh-handover]')?.addEventListener('click',e=>whTransportHandover(e.currentTarget,id,0,order.handoverToken));
    BTPrintDigits.convert(document.querySelector('#modal .whd-doc'));
    finishEntityNotices(notices);return true;
  }catch(e){toast(e.message);return false;}
}
async function whTransportHandover(button,id,run,token){
  if(!confirm('آیا کالا را واقعاً به راننده تحویل داده‌اید؟ پس از ثبت، سند برای چاپ باز می‌شود؛ امضای دستی راننده را روی نسخه چاپی بگیرید. این ثبت، تحویل به مشتری یا تسویه نیست.'))return;
  button.disabled=true;
  let result;
  try{result=await api('/api/warehouse/transport-handovers/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({run,handoverToken:token,physicalHandoverConfirmed:true})});}
  catch(e){button.disabled=false;toast(e.message);return;}
  closeModal();
  toast('تحویل فیزیکی ثبت شد. سند را چاپ و امضای دستی راننده را دریافت کنید.');
  try{whPrintDocument(result.handover.document,run);}catch(e){toast('تحویل ثبت شد اما چاپ باز نشد؛ از جزئیات سند دوباره چاپ کنید.');}
  if(run)void loadWhStoreDocuments();else void whDeliveredLoad();
}
function whPrintDocument(doc,run){
  const body=run?whStoreDocument(doc,true):whDeliveredDocument(doc,true);
  BTPrintFrame.html(BTPrintDigits.documentHtml(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/warehouse-document.css"><title>سند انبار ${esc(fa(doc.warehouseDocumentNo||'—'))}</title><style>body{margin:0;padding:0;font-family:"Vazirmatn",Tahoma,sans-serif}@page{size:A4;margin:12mm}</style></head><body>${body}<script src="/print-ready.js"><\/script></body></html>`));
}
async function whDeliveredPrint(id){
  try{const {order}=await api('/api/warehouse/delivered/'+encodeURIComponent(id));whPrintDocument(order,0);}catch(e){toast(e.message);}
}
/* ---------- v37.36.0 — سربرگ «سوابق و گزارشات» فروشگاه‌ها در کارتابل انبار ---------- */
app.whStoreHist = app.whStoreHist || { range:'today', from:'', to:'', q:'', data:null, seq:0 };
function renderWhStoreHistory(){
  const host=document.querySelector('[data-wh38-store-history]'); if(!host) return;
  const st=app.whStoreHist;
  if(!st.from||!st.to){ [st.from,st.to]=whhRange(st.range||'today'); }
  const ranges=[['today','امروز'],['yesterday','دیروز'],['week','۷ روز اخیر'],['month','۳۰ روز اخیر']];
  host.innerHTML=`<section class="whh wh-store-hist">
    <div data-wh-store-documents></div>
    <div class="sd-panel whh-toolbar">
      <div class="whh-ranges" role="group" aria-label="بازهٔ سریع">${ranges.map(([k,l])=>`<button type="button" class="whh-range ${st.range===k?'active':''}" data-action="wh-store-history-range" data-range="${k}">${l}</button>`).join('')}</div>
      <label class="adm-date">از<input type="date" id="whsFrom" value="${esc(st.from)}"></label>
      <label class="adm-date">تا<input type="date" id="whsTo" value="${esc(st.to)}"></label>
      <div class="input-shell whh-search"><span>${icon('search',16)}</span><input id="whsQ" type="search" placeholder="سفارش، فروشگاه یا کالا" value="${esc(st.q)}"></div>
      <button type="button" class="btn btn-primary whh-print" data-action="wh-store-history-print">${icon('receipt',16)} چاپ گزارش</button>
    </div>
    <div id="whsHistBody"><div class="whh-loading">در حال دریافت سوابق فروشگاه‌ها…</div></div>
  </section>`;
  $('#whsFrom').addEventListener('change',e=>{ st.from=e.target.value||st.from; st.range=''; markWhsRange(); loadWhStoreHistory(); });
  $('#whsTo').addEventListener('change',e=>{ st.to=e.target.value||st.to; st.range=''; markWhsRange(); loadWhStoreHistory(); });
  let tq=null; $('#whsQ').addEventListener('input',e=>{ st.q=e.target.value; clearTimeout(tq); tq=setTimeout(()=>loadWhStoreHistory(),300); });
  host.querySelector('.wh-store-hist').addEventListener('click',e=>{
    const el=e.target.closest('[data-action]'); if(!el) return;
    if(el.dataset.action==='wh-store-history-range'){ st.range=el.dataset.range; [st.from,st.to]=whhRange(st.range); renderWhStoreHistory(); }
    else if(el.dataset.action==='wh-store-history-print'){ printWhStoreHistory(); }
    else if(el.dataset.action==='print-store-service'){ e.stopPropagation(); printStoreService(el.dataset.id,Number(el.dataset.run)); }
  });
  renderWhStoreDocuments();
  loadWhStoreHistory();
}
// Individual store-service handover documents remain available even while the
// order is still being prepared or after it leaves the preparation list.
app.whStoreDocs=app.whStoreDocs||{q:'',offset:0,seq:0};
function renderWhStoreDocuments(){
  const host=document.querySelector('[data-wh-store-documents]');if(!host)return;
  const st=app.whStoreDocs;
  host.innerHTML=`<section class="wh-delivered wh-store-documents"><div class="wh-delivered-heading"><div><h2>اسناد انبار سرویس‌های فروشگاه</h2><p>برای هر سرویس سند جداگانه پس از تعیین راننده قابل چاپ است.</p></div><button type="button" class="btn btn-secondary btn-sm" data-store-doc-action="refresh">به‌روزرسانی</button></div><form class="wh-delivered-search"><label for="whStoreDocsQ">جستجوی سند، سفارش، فروشگاه، راننده یا کالا</label><div><input id="whStoreDocsQ" type="search" maxlength="80" value="${esc(st.q)}"><button class="btn btn-secondary" type="submit">جستجو</button></div></form><div data-wh-store-doc-rows aria-live="polite">در حال دریافت اسناد…</div></section>`;
  host.querySelector('form').addEventListener('submit',e=>{e.preventDefault();st.q=host.querySelector('#whStoreDocsQ').value.trim();st.offset=0;loadWhStoreDocuments();});
  host.addEventListener('click',e=>{const btn=e.target.closest('[data-store-doc-action]');if(!btn)return;e.stopPropagation();if(btn.dataset.storeDocAction==='refresh'){loadWhStoreDocuments();}else if(btn.dataset.storeDocAction==='prev'){st.offset=Math.max(0,st.offset-50);loadWhStoreDocuments();}else if(btn.dataset.storeDocAction==='next'){st.offset+=50;loadWhStoreDocuments();}else if(btn.dataset.storeDocAction==='details'){whStoreDocumentDetails(btn.dataset.id,Number(btn.dataset.run));}});
  loadWhStoreDocuments();
}
function whStoreDocumentRow(x){
 const driver=x.driverName?'تحویل‌گیرنده: '+esc(x.driverName):(x.driverStatus==='PENDING'?'در انتظار تعیین راننده':'نام راننده در سوابق موجود نیست');
 const status=typeof x.handedOverToDriver==='boolean'?(x.handedOverToDriver?'تحویل به راننده ثبت شد':'در انتظار تحویل به راننده'):(x.driverName?'راننده تعیین شده':'در انتظار راننده');
 return orderSummaryRow(x,{className:'wh-delivered-row',name:x.storeName||'—',statusHtml:`<span class="badge blue">${status}</span>`,itemCount:x.itemCount,extras:[{html:`سند ${esc(fa(x.warehouseDocumentNo||'—'))}`},{html:`سرویس ${x.run===2?'دوم':'اول'}`},{html:driver}],actionsHtml:`<button type="button" class="btn btn-secondary btn-sm" data-store-doc-action="details" data-id="${esc(x.orderId)}" data-run="${x.run}" ${x.driverName?'':(x.driverStatus==='PENDING'?'disabled title="پس از تعیین راننده قابل چاپ است"':'disabled title="نام راننده در سوابق موجود نیست"')}>${icon('eye',14)} جزئیات و چاپ</button>`});
}
async function loadWhStoreDocuments(){
  const st=app.whStoreDocs,seq=++st.seq;
  try{
    const params=new URLSearchParams({q:st.q,offset:String(st.offset)}),d=await api('/api/warehouse/store-documents?'+params);
    if(seq!==st.seq)return;
    if(d.offset>=d.total&&d.offset>0){st.offset=Math.max(0,Math.ceil(d.total/d.limit-1)*d.limit);return loadWhStoreDocuments();}
    const host=document.querySelector('[data-wh-store-doc-rows]');if(!host)return;
    host.innerHTML=`<div class="order-compact-scroll wh-delivered-list">${d.documents.map(whStoreDocumentRow).join('')||'<div class="empty">سند سرویس فروشگاهی یافت نشد.</div>'}</div><div class="wh-delivered-pages"><button type="button" class="btn btn-secondary btn-sm" data-store-doc-action="prev" ${d.offset===0?'disabled':''}>قبلی</button><span>${qty(d.total)} سند${d.total?` • ${qty(d.offset+1)} تا ${qty(Math.min(d.offset+d.limit,d.total))}`:''}</span><button type="button" class="btn btn-secondary btn-sm" data-store-doc-action="next" ${d.offset+d.limit>=d.total?'disabled':''}>بعدی</button></div>`;
  }catch(e){const host=document.querySelector('[data-wh-store-doc-rows]');if(host&&seq===st.seq)host.innerHTML=`<div class="empty">خطا در دریافت اسناد: ${esc(e.message)}</div>`;}
}
function whStoreDocument(o,print=false){
  const shop=esc(o.storeName||'—'),driver=esc(o.driverName||'—'),run=o.run===2?'دوم':'اول';
  return `<div class="whd-doc"><div class="whd-head"><div class="whd-document-number"><span>شماره سند انبار</span><b dir="ltr">${esc(fa(o.warehouseDocumentNo||'—'))}</b></div><div class="whd-meta whd-store-meta"><span><span class="whd-label">فروشگاه:</span><b>${shop}</b></span><span><span class="whd-label">تحویل‌گیرنده:</span><b>${driver}</b></span><span><span class="whd-label">شماره سفارش:</span><b dir="ltr">${esc(fa(o.orderNo))}</b></span><span><span class="whd-label">تاریخ ثبت سفارش:</span><b>${esc(formatDateTime24(o.createdAt))}</b></span><span><span class="whd-label">سرویس:</span><b>${run}</b></span></div></div>${whDocumentProducts(o.lines,print)}<section class="whd-acknowledgement"><p class="whd-declaration">اینجانب (${driver}) اقلام فوق را صحیح و سالم از انبار جهت حمل و تحویل به ${shop} دریافت نمودم.</p><div class="whd-signature"><span>امضاء تحویل‌گیرنده</span><b>${driver}</b></div></section></div>`;
}
async function whStoreDocumentDetails(id,run){
  try{const {document:doc}=await api('/api/warehouse/store-documents/'+encodeURIComponent(id)+'/'+run);openModal('سند انبار سرویس '+(run===2?'دوم':'اول'),whStoreDocument(doc)+`<div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">بستن</button><button type="button" class="btn btn-primary" data-wh-store-print>${icon('receipt',16)} چاپ سند انبار</button>${doc.handoverToken&&whCanRegisterHandover()?'<button type="button" class="btn btn-primary" data-wh-handover>ثبت تحویل و چاپ سند</button>':''}</div>`);$('#modal [data-wh-store-print]').addEventListener('click',()=>whStoreDocumentPrint(id,run));$('#modal [data-wh-handover]')?.addEventListener('click',e=>whTransportHandover(e.currentTarget,id,run,doc.handoverToken));}catch(e){toast(e.message);}
}
async function whStoreDocumentPrint(id,run){
  try{const {document:doc}=await api('/api/warehouse/store-documents/'+encodeURIComponent(id)+'/'+run);whPrintDocument(doc,run);}catch(e){toast(e.message);}
}
function markWhsRange(){ $$('.wh-store-hist .whh-range').forEach(b=>b.classList.toggle('active',b.dataset.range===app.whStoreHist.range)); }
async function loadWhStoreHistory(){
  const st=app.whStoreHist; const seq=++st.seq;
  const params=new URLSearchParams({from:st.from,to:st.to,orderType:'STORE'}); if(st.q.trim()) params.set('q',st.q.trim());
  try{
    const d=await api('/api/warehouse/history?'+params.toString());
    if(seq!==st.seq) return;
    st.data=d; st.from=d.from; st.to=d.to;
    const b=$('#whsHistBody'); if(b) b.innerHTML=whhBody(d,{title:'سوابق و گزارشات فروشگاه‌ها',sub:'سفارش‌های فروشگاهی که کار انبارشان پایان یافته و وزن نهایی‌شان ثبت شده است.'});
  }catch(err){ const b=$('#whsHistBody'); if(b) b.innerHTML=`<div class="empty">خطا در دریافت سوابق فروشگاه‌ها: ${esc(err.message)}</div>`; }
}
function printWhStoreHistory(){
  const d=app.whStoreHist.data; if(!d) return toast('ابتدا سوابق بارگذاری شود.');
  const s=d.summary||{};
  const rows=(d.rows||[]).map((r,k)=>`<tr><td>${fa(k+1)}</td><td>${dateLabel(r.day)} ${whhTime(r.completedAt)}</td><td dir="ltr">${esc(fa(r.orderNo))}</td><td>${esc(r.customerName)}</td><td>${r.items.map(i=>`${esc(i.productName)}: ${i.outOfStock?'<b class="oos">ناموجود</b>':qty(i.deliveredKg)+' کیلو'+(i.r1Kg!=null||i.r2Kg!=null?` (سرویس اول ${qty(i.r1Kg||0)}${Number(i.r2Kg)>0?'، سرویس دوم '+qty(i.r2Kg):''})`:'')}`).join('<br>')}</td><td>${qty(r.deliveredKg)}</td><td>${esc(r.completedBy)}</td></tr>`).join('')||'<tr><td colspan="7" class="none">سابقه‌ای در این بازه نیست.</td></tr>';
  const prod=(s.byProduct||[]).map(p=>`<tr><td>${esc(p.productName)}</td><td>${qty(p.orders)}</td><td>${qty(p.deliveredKg)}</td><td>${p.outOfStock?qty(p.outOfStock):'—'}</td></tr>`).join('');
  BTPrintFrame.html(BTPrintDigits.documentHtml(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts.css"><title>گزارش سوابق فروشگاه‌ها ${esc(whhRangeText(d.from,d.to).replace(/<[^>]+>/g,''))}</title><style>
    *{box-sizing:border-box}body{font-family:"B Yekan","Vazirmatn",Tahoma,sans-serif;color:#1b2027;padding:26px;margin:0}
    header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #e30613;padding-bottom:12px;margin-bottom:16px}
    header h1{font-size:21px;margin:0}header p{margin:4px 0 0;color:#555;font-size:12px}header img{width:54px;height:54px;object-fit:contain}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.box{border:1px solid #ddd;border-radius:10px;padding:9px 10px;font-size:11px;color:#555}.box strong{display:block;font-size:19px;color:#b40f23;margin-top:3px}
    h2{font-size:14px;margin:18px 0 6px;border-right:4px solid #e30613;padding-right:8px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8d8d8;padding:6px 7px;font-size:11px;text-align:right;vertical-align:top}th{background:#f4f4f4}
    .oos{color:#b4232d}.none{text-align:center;color:#777}footer{margin-top:22px;font-size:10px;color:#777;display:flex;justify-content:space-between}
    @media print{body{padding:0}tr{page-break-inside:avoid}}</style></head><body>
    <header><div><h1>گزارش سوابق فروشگاه‌ها — انبار بابل طیور</h1><p>بازه: ${whhRangeText(d.from,d.to)}${app.whStoreHist.q?` • جستجو: «${esc(app.whStoreHist.q)}»`:''}</p></div><img src="/logo.png" alt=""></header>
    <div class="grid"><div class="box">سفارش فروشگاهی تکمیل‌شده<strong>${qty(s.orders||0)}</strong></div><div class="box">وزن کل (کیلوگرم)<strong>${qty(s.deliveredKg||0)}</strong></div><div class="box">اقلام ثبت‌شده<strong>${qty(s.itemCount||0)}</strong></div><div class="box">اقلام ناموجود<strong>${qty(s.outOfStock||0)}</strong></div></div>
    <h2>سفارش‌ها</h2><table><thead><tr><th>#</th><th>زمان تکمیل انبار</th><th>سفارش</th><th>فروشگاه</th><th>اقلام و وزن تحویلی (سرویس‌ها)</th><th>جمع (کیلو)</th><th>ثبت‌کننده</th></tr></thead><tbody>${rows}</tbody></table>
    ${prod?`<h2>خلاصهٔ کالاها</h2><table><thead><tr><th>کالا</th><th>تعداد سفارش</th><th>وزن تحویلی (کیلو)</th><th>ناموجود</th></tr></thead><tbody>${prod}</tbody></table>`:''}
    <footer><span>تهیه‌کننده: ${esc(app.user?.fullName||app.user?.username||'')}</span><span>تاریخ چاپ: ${esc(todayText())} ${whhTime((typeof serverEpoch==='function'?new Date(serverEpoch()):new Date()).toISOString())}</span></footer>
    <script src="/print-ready.js"><\/script></body></html>`));
}
function wh38Shell(phase){
  const c=$('#content'); if(!c)return;
  app.wh38.phase=phase;
  // Warehouse phases are selected from the role rail; do not render the legacy in-page tab strip too.
  c.innerHTML=`<section class="wh38-shell"><div id="wh38Body"></div></section>`;
  c.onclick=async e=>{
    if(e.target.closest('[data-wh-store-docs-link]')){app.wh38.storeTab='history';await wh38Paint('stores');document.querySelector('[data-wh-store-documents]')?.scrollIntoView({block:'start'});return;}
    const st=e.target.closest('[data-wh38-store-tab]');
    if(st){ app.wh38.storeTab=['incoming','preparing','history'].includes(st.dataset.wh38StoreTab)?st.dataset.wh38StoreTab:'incoming'; wh38Paint('stores'); return; }
    const t=e.target.closest('[data-wh38-tab]');
    if(t){ app.wh38.phase=t.dataset.wh38Tab; wh38Shell(app.wh38.phase); return; }
    const el=e.target.closest('[data-action]'); if(!el)return;
    const a=el.dataset.action, id=el.dataset.id;
    try{
      if(a==='pickup-cancel'){ const reason=prompt('دلیل انصراف را وارد کنید:');if(!reason?.trim())return;if(!confirm('آیا انبار تأیید می‌کند هیچ کالایی به این مراجعه تحویل نشده است؟'))return;el.disabled=true;await api('/api/pickup/'+encodeURIComponent(id)+'/cancellation',{method:'POST',body:JSON.stringify({reason,confirmedNoGoods:true})});toast('عدم تحویل ثبت شد و در انتظار تأیید فروش است.');await refreshIndicators();wh38Shell(app.wh38.phase);return;}
      if(a==='wh-delivered-details'){ return whDeliveredDetails(id); }
      if(a==='wh-delivered-prev'){ app.whDelivered.offset=Math.max(0,app.whDelivered.offset-50); return whDeliveredLoad(); }
      if(a==='wh-delivered-next'){ app.whDelivered.offset+=50; return whDeliveredLoad(); }
      if(a==='print-store-service'){ return printStoreService(id,Number(el.dataset.run)); }
      if(a==='wh38-accept'){ const notices=captureEntityNotices('order',id); el.disabled=true; await api('/api/orders/'+id+'/warehouse/accept',{method:'POST'}); finishEntityNotices(notices); toast('سفارش تأیید شد و وارد مرحله آماده‌سازی شد.'); await refreshIndicators(); if(app.page==='warehouse'&&app.wh38.phase==='incoming')wh38Shell('incoming'); else if(app.wh38.phase==='stores')wh38Paint('stores'); }
      else if(a==='wh38-store-details'){ wh38StoreDetails(id); }
      else if(a==='wh38-order-details'){ await openOrderDetails(id); }
      else if(a==='wh38-start'){ el.disabled=true; const r=await api('/api/orders/'+id+'/warehouse/start-preparing',{method:'POST',body:'{}'}); toast('آماده‌سازی سفارش ثبت شد.'); if(r.order&&r.order.storeRun&&r.order.storeRun.enabled) sr38Sheet(r.order); else wh38Sheet(r.order); }
      else if(a==='wh-weight-details'){whOpenWeighing(el.closest('article')?.querySelector('[data-wh38-weight],[data-sr38-weight]'));}
      else if(a==='wh38-save-draft'){ el.disabled=true;try{await wh38SaveDraft(id);}finally{el.disabled=false;} }
      else if(a==='wh38-finalize'){ await wh38Finalize(id); }
      else if(a==='wh38-return'){ const reason=prompt('دلیل ارجاع به فروش را وارد کنید:','اصلاح سفارش / اصلاح وزن')||''; if(!reason)return; await api('/api/orders/'+id+'/return-sales',{method:'POST',body:JSON.stringify({reason})}); toast('سفارش به فروش ارجاع شد.'); await refreshIndicators(); if(app.wh38.phase==='stores'){app.wh38.storeTab='preparing'; wh38Shell('stores');}else wh38Shell('preparing'); }
      else if(a==='sr38-history'){const it=(app.wh38.sheetOrder?.items||[]).find(x=>x.id===el.dataset.item);if(it)openModal('سوابق وزن‌کشی — '+(it.product?.name||'محصول'),sr38Hist(it));}
      else if(a==='sr38-back'){ if(app.wh38.phase==='stores'){app.wh38.storeTab='preparing'; wh38Shell('stores');}else wh38Shell('preparing'); }
      else if(a==='sr38-weight'){ const inp=el.closest('.sr38-ops')?.querySelector('input[data-sr38-weight]'); const raw=String(inp?inp.value:'').trim(); const kg=whWeightNet(inp); const run=Number(el.dataset.run)===2?2:1; if(raw===''||!Number.isFinite(kg)||kg<0){ toast('وزن واقعی را وارد کنید؛ برای انتقال این قلم به سرویس دوم، وزن صفر ثبت کنید.'); return; } if(kg===0){ if(run===2){ toast('در سرویس دوم وزن صفر ثبت نمی‌شود؛ اگر کالا موجود نیست «عدم موجودی» و اگر تمام شده «تکمیل محصول» را بزنید.'); return; } if(!confirm('وزن صفر وارد شده است؛ این قلم به سرویس دوم منتقل شود؟'))return; el.disabled=true; if(await sr38Post(id,'move',{itemId:el.dataset.item})) toast('وزن صفر ثبت شد؛ قلم به سرویس دوم منتقل شد.'); return; } el.disabled=true; if(await sr38Post(id,'weights',{run,items:[{itemId:el.dataset.item,deliveredKg:kg,weighings:whWeightPayload(inp)}]})) toast('وزن واقعی سرویس '+(run===2?'دوم':'اول')+' ثبت شد؛ این وزن ذخیره شد؛ تا ارسال سرویس و تحویل به راننده، تحویل فیزیکی ثبت نمی‌شود.'); }
      else if(a==='sr38-move'){ if(!confirm('این محصول به سرویس دوم منتقل شود؟ وزن‌های ثبت‌شده سرویس اول حفظ می‌شود.'))return; el.disabled=true; if(await sr38Post(id,'move',{itemId:el.dataset.item})) toast('قلم به سرویس دوم منتقل شد.'); }
      else if(a==='sr38-complete'){ if(!confirm('ارسال این محصول نهایی و «تکمیل‌شده» ثبت شود؟'))return; el.disabled=true; if(await sr38Post(id,'complete',{itemId:el.dataset.item})) toast('ارسال قلم تکمیل شد.'); }
      else if(a==='sr38-oos'){ const reason=prompt('توضیح «عدم موجودی / بسته با کسری» برای این قلم (اختیاری):','مانده درخواست در انبار موجود نیست'); if(reason===null)return; el.disabled=true; if(await sr38Post(id,'out-of-stock',{itemId:el.dataset.item,note:reason||''})) toast('قلم با «عدم موجودی» بسته شد.'); }
      else if(a==='sr38-finalize'){ await sr38Finalize(id); }
      else if(a==='sr38-send-run'){ const run=Number(el.dataset.run)===2?2:1; const label=run===2?'دوم':'اول'; if(!confirm(`همهٔ اقلام وزن‌شدهٔ ارسال‌نشدهٔ سرویس ${label} به فروش ارسال می‌شوند تا راننده تعیین شود؛ پس از ارسال، وزن اقلام ارسال‌شده قفل می‌شود، اما اگر بعداً قلم تازه‌ای برای همین سرویس وزن شود، با همین دکمه به همان محموله افزوده می‌شود. ادامه می‌دهید؟`))return; el.disabled=true; if(await sr38Post(id,'send-run',{run})) toast(`اقلام سرویس ${label} به فروش ارسال شد؛ در سربرگ «ورودی» فروشگاه‌های فروش برای تعیین راننده دیده می‌شود.`); else el.disabled=false; }
    }catch(err){ toast(err.message); el.disabled=false; }
  };
  if(app.wh38.timer){clearInterval(app.wh38.timer);app.wh38.timer=null}
  app.wh38.timer=setInterval(()=>{ if(app.page==='warehouse') wh38Paint(app.wh38.phase); },7000);
  if(phase==='history') renderWarehouseHistory(); else wh38Paint(phase);
}
// A small modal keeps the preparation row single-line; the draft stays local
// until the existing explicit weight/finalize action succeeds on the server.
const whWeighingDrafts=new WeakMap();
function whParseWeight(s){const v=String(s).trim().replace(/[۰-۹٠-٩]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.includes(d)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(d):'٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫/g,'.');return /^(?:\d+|\d{1,3}(?:[,٬]\d{3})+)(?:\.\d+)?$/.test(v)?Number(v.replace(/[,٬]/g,'')):NaN;}
function whWeightNet(input){const draft=whWeighingDrafts.get(input);return draft?draft.reduce((s,r)=>s+Math.round(r.netKg*1000),0)/1000:(input.value.trim()?whParseWeight(input.value):0);}
function whWeightPayload(input){const draft=whWeighingDrafts.get(input);return draft?draft.map(({netKg,...row})=>row):[{grossKg:input.value,basket18:0,basket25:0,box300:0,box600:0,rackKg:0,cartKg:0}];}
function whOpenWeighing(input){
 if(!input||input.disabled)return;
 const original=whWeighingDrafts.get(input),initial=original?original.map(x=>({...x})):[{grossKg:input.value}];
 const tareTypes=[['basket18','سبد ۱٫۸ کیلویی',true],['basket25','سبد ۲٫۵ کیلویی',true],['box300','کارتن ۳۰۰ گرمی',true],['box600','کارتن ۶۰۰ گرمی',true],['rackKg','راک',false],['cartKg','گاری',false]];
 const group=(key='',value='')=>{
  const type=tareTypes.find(x=>x[0]===key);
  return `<div class="wh-tare-group" data-wt-group><label class="wh-tare-kind"><span>نوع ناخالصی</span><select data-wt-type aria-label="نوع ناخالصی"><option value="">بدون ناخالصی</option>${tareTypes.map(([k,label])=>`<option value="${k}" ${key===k?'selected':''}>${label}</option>`).join('')}</select></label><label class="wh-tare-amount" data-wt-amount-label ${type?'':'hidden'}><span>${type?.[2]?'تعداد':'وزن (کیلوگرم)'}</span><input type="text" inputmode="decimal" autocomplete="off" data-wt-value value="${esc(String(value))}" aria-label="${type?.[2]?'تعداد':'وزن ناخالصی به کیلوگرم'}" ${type?'':'disabled'}></label><button type="button" class="btn btn-secondary btn-sm wh-tare-remove" data-wt-remove-tare aria-label="حذف ناخالصی">×</button></div>`;
 };
 const line=(row={})=>{
  const selected=tareTypes.filter(([key])=>Number(row[key])>0);
  return `<div class="wh-weight-line" data-wt-line><button type="button" class="btn btn-secondary btn-sm wh-wt-select" data-wt-select-line aria-pressed="false">نوبت</button><label class="wh-gross"><span>وزن ناخالص (کیلوگرم)</span><input type="text" inputmode="decimal" autocomplete="off" data-wt-field="grossKg" value="${esc(String(row.grossKg??''))}" aria-label="وزن ناخالص"></label><div class="wh-tare-groups" data-wt-groups>${selected.length?selected.map(([key])=>group(key,row[key])).join(''):group()}</div><div class="wh-weight-net"><span>وزن خالص</span><b data-wt-net>—</b></div><button type="button" class="btn btn-secondary btn-sm" data-wt-remove>حذف نوبت</button></div>`;
 };
 openModal('وزن ناخالص و ناخالصی‌ها',`<div class="wh-weight-dialog"><p>نوع ناخالصی را انتخاب کنید و تعداد یا وزن آن را وارد کنید؛ برای ترکیب چند نوع از «افزودن ناخالصی» استفاده کنید. وزن‌ها به کیلوگرم است.</p><div class="wh-weight-scroll"><div data-wt-lines>${initial.map(line).join('')}</div></div><div class="wh-weight-summary">جمع وزن خالص: <b data-wt-total>—</b></div><p data-wt-error role="alert"></p><div class="modal-actions"><button type="button" class="btn btn-secondary" data-wt-add-tare>افزودن ناخالصی</button><button type="button" class="btn btn-secondary" data-wt-add>افزودن نوبت</button><button type="button" class="btn btn-secondary" data-wt-clear>پاک کردن جزئیات</button><button type="button" class="btn btn-primary" data-wt-apply>تأیید وزن</button></div></div>`);
 const host=$('#modal .wh-weight-dialog'),container=host.querySelector('[data-wt-lines]');
 let activeLine=container.querySelector('[data-wt-line]');
 function selectLine(line){
  if(line&&container.contains(line))activeLine=line;
  const lines=[...container.querySelectorAll('[data-wt-line]')];
  if(!lines.includes(activeLine))activeLine=lines[0];
  lines.forEach((el,i)=>{const selected=el===activeLine,btn=el.querySelector('[data-wt-select-line]');el.classList.toggle('is-active',selected);btn.textContent='نوبت '+fa(i+1);btn.setAttribute('aria-pressed',String(selected));});
  host.querySelector('[data-wt-add-tare]').textContent=lines.length>1?'افزودن ناخالصی به نوبت '+fa(lines.indexOf(activeLine)+1):'افزودن ناخالصی';
 }
 function syncOptions(el){const selects=[...el.querySelectorAll('[data-wt-type]')],used=new Set(selects.map(x=>x.value).filter(Boolean));for(const select of selects)for(const option of select.options)option.disabled=!!option.value&&option.value!==select.value&&used.has(option.value);}
 function calculate(){let sum=0,error='',rows=[];for(const el of container.querySelectorAll('[data-wt-line]')){
  const v={grossKg:whParseWeight(el.querySelector('[data-wt-field=grossKg]').value),basket18:0,basket25:0,box300:0,box600:0,rackKg:0,cartKg:0},seen=new Set();let duplicate=false;
  for(const entry of el.querySelectorAll('[data-wt-group]')){const key=entry.querySelector('[data-wt-type]').value;if(!key)continue;if(seen.has(key))duplicate=true;seen.add(key);v[key]=whParseWeight(entry.querySelector('[data-wt-value]').value);}
  const kg=['grossKg','rackKg','cartKg'],counts=['basket18','basket25','box300','box600'];
  const good=!duplicate&&kg.every(k=>Number.isFinite(v[k])&&v[k]>=0&&v[k]<=100000&&Math.abs(v[k]*1000-Math.round(v[k]*1000))<.000001)&&counts.every(k=>Number.isInteger(v[k])&&v[k]>=0&&v[k]<=100000);
  const gross=Math.round(v.grossKg*1000),tare=v.basket18*1800+v.basket25*2500+v.box300*300+v.box600*600+Math.round(v.rackKg*1000)+Math.round(v.cartKg*1000),net=(gross-tare)/1000;
  if(!good||!(net>0)){error=duplicate?'هر نوع ناخالصی در هر نوبت فقط یک بار قابل انتخاب است.':'اعداد معتبر و حداکثر سه رقم اعشار وارد کنید؛ مجموع ناخالصی باید کمتر از ناخالص باشد.';el.querySelector('[data-wt-net]').textContent='—';continue;}
  v.netKg=net;sum+=net;rows.push(v);el.querySelector('[data-wt-net]').textContent=qty(net);
 }if(!rows.length||sum>100000)error=error||'جمع وزن خالص نامعتبر است.';host.querySelector('[data-wt-error]').textContent=error;host.querySelector('[data-wt-total]').textContent=error?'—':qty(sum)+' کیلوگرم';return error?null:rows;}
 for(const el of container.querySelectorAll('[data-wt-line]'))syncOptions(el);
 selectLine(activeLine);
 host.addEventListener('focusin',e=>{const line=e.target.closest('[data-wt-line]');if(line)selectLine(line);});
 host.addEventListener('input',calculate);
 host.addEventListener('change',e=>{if(!e.target.matches('[data-wt-type]'))return;const entry=e.target.closest('[data-wt-group]'),type=tareTypes.find(x=>x[0]===e.target.value),label=entry.querySelector('[data-wt-amount-label]'),amount=entry.querySelector('[data-wt-value]');label.hidden=!type;amount.disabled=!type;amount.value='';label.querySelector('span').textContent=type?.[2]?'تعداد':'وزن (کیلوگرم)';amount.setAttribute('aria-label',type?.[2]?'تعداد':'وزن ناخالصی به کیلوگرم');syncOptions(entry.closest('[data-wt-line]'));calculate();if(type)amount.focus();});
 host.addEventListener('click',e=>{
  const el=e.target.closest('[data-wt-line]');
  if(e.target.closest('[data-wt-select-line]'))selectLine(el);
  if(e.target.closest('[data-wt-add-tare]')){const row=activeLine,list=row.querySelector('[data-wt-groups]'),blank=[...list.querySelectorAll('[data-wt-type]')].find(x=>!x.value);if(blank){blank.focus();return;}if(list.children.length>=tareTypes.length)return;list.insertAdjacentHTML('beforeend',group());syncOptions(row);list.lastElementChild.querySelector('select').focus();calculate();}
  if(e.target.closest('[data-wt-remove-tare]')){const entry=e.target.closest('[data-wt-group]'),list=entry.parentElement;entry.remove();if(!list.children.length)list.insertAdjacentHTML('beforeend',group());syncOptions(el);calculate();}
  if(e.target.closest('[data-wt-add]')){if(container.children.length>=100)return;container.insertAdjacentHTML('beforeend',line());selectLine(container.lastElementChild);activeLine.querySelector('[data-wt-field=grossKg]').focus();calculate();}
  if(e.target.closest('[data-wt-remove]')){if(container.children.length>1){el.remove();selectLine(null);}calculate();}
  if(e.target.closest('[data-wt-clear]')){whWeighingDrafts.delete(input);input.readOnly=false;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));closeModal();}
  if(e.target.closest('[data-wt-apply]')){const rows=calculate();if(!rows)return;whWeighingDrafts.set(input,rows);input.value=String(rows.reduce((s,r)=>s+Math.round(r.netKg*1000),0)/1000);input.readOnly=true;input.dispatchEvent(new Event('input',{bubbles:true}));closeModal();}
 });calculate();
}
function wh38Sheet(o){
  const body=$('#wh38Body'); if(!body)return;
  body.dataset.sheet='1';
  app.wh38.sheetOrder=o;
  const items=activeItemsOf(o);
  body.innerHTML=`<section class="wh38-sheet">
    <div class="wh38-sheet-head wh38-sheet-head-compact"><div class="wh38-sheet-heading"><span class="stl-eyebrow">آماده‌سازی و تحویل</span>${badge(o.status)}</div>${orderCustomerStripHtml(o)}${o.deliveryDate?`<div class="wh38-sheet-delivery-date">تاریخ تحویل: <b>${esc(dateLabel(o.deliveryDate))}</b></div>`:''}</div>
    ${app.features?.pickupStaging&&o.visit?.status==='PICKUP_PRESENT'?`<div class="wh38-note"><b>تحویل‌گیرنده: ${esc(o.visit.recipient?.name||'—')}</b><span>تماس: ${esc(fa(o.visit.recipient?.phone||'—'))} • ${esc([o.visit.recipient?.vehicleType,o.visit.recipient?.carType,o.visit.recipient?.plate].filter(Boolean).join(' — '))}</span></div>`:''}
    <div class="wh38-progress"><span class="done">۱ سفارش ورودی</span><i></i><span class="active">۲ آماده‌سازی</span><i></i><span>۳ ارسال به تسویه فروش</span></div>
    <div class="wh38-note"><b>وزن آماده‌سازی</b><span>وزن‌ها را پیش از مراجعه ذخیره کنید؛ ذخیره به‌معنای تحویل یا ارسال به تسویه نیست. برای هر قلم وزن خالص را وارد کنید؛ برای محاسبه از وزن ناخالص و سبد، کارتن، راک یا گاری روی «ناخالصی» بزنید. اقلام ناموجود را با «عدم موجودی» مشخص کنید. <strong data-wh38-draft-status aria-live="polite">${o.warehouseWeightDraft?.revision?'وزن آماده‌سازی ذخیره شده است.':'تغییرات را با دکمه ذخیره ثبت کنید.'}</strong></span></div>
    <div class="wh38-prep-items">${items.map((it,k)=>`<article class="wh38-prep-item">
      <div class="wh38-prep-num">${fa(String(k+1))}</div>
      <div class="wh38-prep-cell"><span class="wh38-cell-label">محصول</span><div class="wh38-cell-box wh38-prep-title" title="${esc(it.product?.name||'—')}"><strong>${esc(it.product?.name||'—')}</strong></div></div>
      <div class="wh38-prep-cell"><span class="wh38-cell-label">مقدار درخواستی</span><div class="wh38-cell-box wh38-req"><b>${qty(it.requestedQty)} ${esc(it.requestedUnit||'')}</b></div></div>
      <div class="wh38-prep-cell"><span class="wh38-cell-label">توضیحات ردیف</span><div class="wh38-cell-box wh38-prep-desc" title="${esc(it.description||'بدون توضیح')}">${esc(it.description||'بدون توضیح')}</div></div>
      <div class="wh38-prep-cell wh38-weight"><label class="wh38-cell-label" for="wh38-weight-${esc(it.id)}">وزن خالص (کیلوگرم)</label><div class="wh38-cell-box wh-weight-main"><input id="wh38-weight-${esc(it.id)}" type="text" inputmode="decimal" autocomplete="off" aria-label="وزن خالص ${esc(it.product?.name||'محصول')} به کیلوگرم" data-wh38-weight="${it.id}" placeholder="۰٫۰۰۰"><button type="button" class="btn btn-secondary btn-sm wh-weight-open" data-action="wh-weight-details">ناخالصی</button></div></div>
      <div class="wh38-stock-cell"><span class="wh38-cell-label">عدم موجودی</span><label class="wh38-oos" title="عدم موجودی ${esc(it.product?.name||'محصول')}"><input type="checkbox" aria-label="عدم موجودی ${esc(it.product?.name||'محصول')}" data-wh38-oos="${it.id}"></label></div>
    </article>`).join('')}</div>
    <div class="wh38-sheet-foot"><div><span>جمع وزن نهایی</span><strong id="wh38Total">۰ کیلوگرم</strong></div>
      <div class="toolbar"><button type="button" class="btn btn-secondary btn-lg" data-action="wh38-save-draft" data-id="${o.id}">ذخیره وزن‌ها</button><button type="button" class="btn btn-secondary btn-lg" data-action="wh38-return" data-id="${o.id}">${icon('arrow',16)} ارجاع به فروش</button><button type="button" class="btn btn-primary btn-lg" data-action="wh38-finalize" data-id="${o.id}">${icon('send',17)} ${app.features?.pickupStaging&&o.deliveryMode==='PICKUP'&&o.orderType==='REMOTE'?'ثبت وزن و تحویل واقعی و چاپ':'ثبت وزن نهایی و ارسال به فروش'}</button></div></div>
  </section>`;
  const saved=new Map((o.warehouseWeightDraft?.items||[]).map(x=>[x.itemId,x]));
  $$('#wh38Body [data-wh38-weight]').forEach(el=>{
    const row=saved.get(el.dataset.wh38Weight);if(row){const check=$(`#wh38Body [data-wh38-oos="${el.dataset.wh38Weight}"]`);if(row.outOfStock){check.checked=true;el.disabled=true;}else{el.value=String(row.deliveredKg);if(Array.isArray(row.weighings)&&row.weighings.length){whWeighingDrafts.set(el,row.weighings.map(x=>({...x})));el.readOnly=true;}}}
    el.addEventListener('input',()=>{wh38Total();const status=$('#wh38Body [data-wh38-draft-status]');if(status)status.textContent='تغییرات جدید هنوز ذخیره نشده است.';});
  });
  $$('#wh38Body [data-wh38-oos]').forEach(ch=>ch.addEventListener('change',()=>{ const w=$(`#wh38Body [data-wh38-weight="${ch.dataset.wh38Oos}"]`); if(w){w.disabled=ch.checked; if(ch.checked){w.value='';w.readOnly=false;whWeighingDrafts.delete(w);}} wh38Total();const status=$('#wh38Body [data-wh38-draft-status]');if(status)status.textContent='تغییرات جدید هنوز ذخیره نشده است.'; }));
  wh38Total();
}
async function wh38SaveDraft(id){
  const selected=app.wh38.sheetOrder;if(!selected||selected.id!==id)return toast('سفارش مجدداً باز شود.');
  const collect=()=>$$('#wh38Body [data-wh38-weight]').flatMap(w=>{
    const out=$(`#wh38Body [data-wh38-oos="${w.dataset.wh38Weight}"]`)?.checked||false;
    if(out)return [{itemId:w.dataset.wh38Weight,outOfStock:true}];
    if(!w.value.trim())return [];
    return [{itemId:w.dataset.wh38Weight,outOfStock:false,deliveredKg:whWeightNet(w),...(whWeighingDrafts.has(w)?{weighings:whWeightPayload(w)}:{})}];
  });
  const items=collect();
  if(items.some(x=>!x.outOfStock&&(!Number.isFinite(x.deliveredKg)||x.deliveredKg<=0)))return toast('وزن‌های واردشده باید معتبر و مثبت باشند.');
  try{const {draft}=await api('/api/orders/'+encodeURIComponent(id)+'/warehouse/draft',{method:'POST',body:JSON.stringify({revision:selected.warehouseWeightDraft?.revision||0,items})});selected.warehouseWeightDraft=draft;const status=$('#wh38Body [data-wh38-draft-status]');if(status)status.textContent=JSON.stringify(collect())===JSON.stringify(items)?'وزن آماده‌سازی ذخیره شده است.':'تغییرات جدید هنوز ذخیره نشده است.';toast('وزن‌ها ذخیره شد؛ تحویل کالا هنوز ثبت نشده است.');}
  catch(e){toast(e.message);}
}
function wh38Total(){ const total=$$('#wh38Body [data-wh38-weight]').reduce((s,e)=>s+(e.disabled?0:whWeightNet(e)),0); const el=$('#wh38Total'); if(el)el.textContent=Number.isFinite(total)?qty(total)+' کیلوگرم':'وزن نامعتبر'; }
async function wh38Finalize(id){
  const items=$$('#wh38Body [data-wh38-weight]').map(w=>{ const out=$(`#wh38Body [data-wh38-oos="${w.dataset.wh38Weight}"]`)?.checked||false; return {itemId:w.dataset.wh38Weight, deliveredKg:out?0:whWeightNet(w), outOfStock:out,...(!out?{weighings:whWeightPayload(w)}:{})}; });
  if(!items.length)return toast('قلمی برای ثبت وزن وجود ندارد.');
  if(items.some(x=>!x.outOfStock&&(!Number.isFinite(x.deliveredKg)||x.deliveredKg<=0)))return toast('برای همه اقلام موجود وزن نهایی معتبر وارد کنید.');
  let result;
  const draftRevision=app.wh38.sheetOrder?.warehouseWeightDraft?.revision||0;
  let selected=app.wh38.sheetOrder;
  if(app.features?.pickupStaging&&selected?.id===id&&selected.orderType==='REMOTE'&&selected.deliveryMode==='PICKUP'){
    try{selected=(await api('/api/orders/'+encodeURIComponent(id))).order;}catch(e){return toast(e.message);}
  }
  const pickup=app.features?.pickupStaging&&selected?.id===id&&selected.orderType==='REMOTE'&&selected.deliveryMode==='PICKUP'&&(selected.pickupWorkflow===1||selected.visit?.status==='PICKUP_PRESENT'||!selected.warehouseCompletedAt);
  if(pickup&&selected.visit?.status!=='PICKUP_PRESENT')return toast('ابتدا نگهبانی ورود تحویل‌گیرنده را برای این سفارش ثبت کند.');
  if(pickup&&!confirm(`آیا کالا را واقعاً به ${selected.visit.recipient?.name||'تحویل‌گیرنده ثبت‌شده'} (${selected.visit.recipient?.phone||'—'}) داده‌اید؟ پس از ثبت، سند برای امضای دستی چاپ می‌شود.`))return;
  try{if(pickup)result=await api('/api/pickup/'+encodeURIComponent(id)+'/handover',{method:'POST',body:JSON.stringify({items,draftRevision,physicalHandoverConfirmed:true})});else result=await api('/api/orders/'+id+'/warehouse',{method:'POST',body:JSON.stringify({items,draftRevision})});}
  catch(e){toast(e.message);return;}
  if(pickup){try{whPrintDocument(result.handover.document,0);}catch(e){toast('تحویل ثبت شد؛ چاپ را از بخش تحویل‌شده تکرار کنید.');}if(app.page==='warehouse'){toast('تحویل واقعی ثبت شد؛ سند را چاپ و امضای دستی تحویل‌گیرنده را دریافت کنید.');wh38Shell('preparing');void refreshIndicators();}return;}
  if(app.page!=='warehouse')return;
  void refreshIndicators();
  const order=result.order;
  if(order?.transportWorkflow===1&&order.deliveryMode==='DELIVERY'){
    app.sub.warehouse='delivered';renderNav();wh38Shell('delivered');
    if(order.transportAssignments?.['0']?.driverId){toast('وزن نهایی ثبت شد؛ پس از تحویل کالا، تحویل به راننده را ثبت کنید.');await whDeliveredDetails(id);}
    else toast('وزن نهایی ثبت شد؛ پس از تعیین راننده در ترابری، از بخش تحویل‌شده سند را باز کنید.');
  }else{toast('وزن نهایی ثبت شد و سفارش برای تسویه فروش ارسال شد.');wh38Shell('preparing');}

}
/* ---------------- v37.4.0 — سفارش فروشگاه: برگهٔ دو سرویس ارسال انبار ---------------- */
const SR38_STATUS_LABEL={AWAITING_R1:'در انتظار سرویس اول',IN_SHIPPING:'وزن ذخیره‌شده',MOVED_R2:'در انتظار سرویس دوم',COMPLETED:'تکمیل‌شده',CLOSED_SHORT:'بسته با کسری'};
function sr38Chips(o){ const sr=o&&o.storeRun; if(!sr||!sr.enabled)return ''; const c=sr.counts||{total:0,completed:0,remaining:0,short:0};
  return `<div class="st-run-chips"><span class="st-run-chip st-run-overall">${esc(sr.overallLabel||'')}</span><span class="st-run-chip st-run-r1 st-run-${esc(sr.r1Status||'PENDING')}">سرویس اول: ${esc(sr.r1StatusLabel||'')}</span><span class="st-run-chip st-run-r2 st-run-${esc(sr.r2Status||'NOT_NEEDED')}">سرویس دوم: ${esc(sr.r2StatusLabel||'')}</span><span class="st-run-chip">اقلام ${qty(c.completed)}/${qty(c.total)} تکمیل${c.short?` · ${qty(c.short)} بسته با کسری`:''}</span>${sr.r1StageLabel?`<span class="st-run-chip st-run-stage">سرویس اول ← فروش: ${esc(sr.r1StageLabel)}</span>`:''}${sr.r2StageLabel?`<span class="st-run-chip st-run-stage">سرویس دوم ← فروش: ${esc(sr.r2StageLabel)}</span>`:''}</div>`; }

/* ---------- v37.5.0 — ارسال هر سرویس وزن‌شده به فروش (تعیین راننده و تحویل فیزیکی) ---------- */
function sr38SendBtn(o,run,view){ const ops=o.storeRunOps||{}; const sh=run===2?ops.r2Shipment:ops.r1Shipment;
  const items=view||[]; const label=run===2?'دوم':'اول';
  if(sh){ // v37.33.0 — اگر پس از ارسال، قلم تازه‌ای برای همین سرویس وزن شده باشد، «ارسال قلم‌های جدید» به همان محموله فعال می‌شود
    const fresh=items.filter(v=>Number(run===2?v.r2Kg||0:v.r1Kg||0)>0&&!(run===2?v.sentInR2:v.sentInR1));
    if(sh.status==='PENDING_SALES'&&fresh.length){ return `<span class="st-run-chip st-run-stage" title="اقلام این سرویس به فروش ارسال شده‌اند">${icon('check',13)} سرویس ${label} به فروش ارسال شد</span><button type="button" class="btn btn-primary btn-lg" data-action="sr38-send-run" data-id="${o.id}" data-run="${run}" title="این قلم‌های تازه به همان محمولهٔ نزد فروش افزوده می‌شوند">${icon('send',16)} ارسال ${qty(fresh.length)} قلم جدید سرویس ${label} به فروش</button>`; }
    return `<span class="st-run-chip st-run-stage" title="اقلام این سرویس به فروش ارسال شده‌اند">${icon('check',13)} سرویس ${label} به فروش ارسال شد</span>`; }
  const ready=run===1?items.some(v=>Number(v.r1Kg||0)>0&&!v.sentInR1):items.some(v=>Number(v.r2Kg||0)>0&&!v.sentInR2);
  // v37.33.0 — سرویس دوم پیش از ارسال سرویس اول واقعاً غیرفعال است (قبلاً کلیک فقط خطای سرور می‌داد)
  // و عنوان راهنما همیشه با وضعیت واقعی دکمه یکی است.
  const blocked=run===2&&!ops.r1Shipment;
  const off=blocked||!ready;
  const why=blocked?'نخست اقلام سرویس اول را به فروش ارسال کنید':(!ready?'پس از ثبت وزن این سرویس فعال می‌شود':'');
  return `<button type="button" class="btn btn-secondary btn-lg" data-action="sr38-send-run" data-id="${o.id}" data-run="${run}" ${off?'disabled':''} ${why?`title="${esc(why)}"`:''}>${icon('send',16)} ارسال سرویس ${label} به فروش</button>`; }
function sr38Hist(it){ const rows=[...((it.runR1)||[]).map(e=>({run:1,e})),...((it.runR2)||[]).map(e=>({run:2,e}))].sort((a,b)=>String(a.e.at).localeCompare(String(b.e.at)));
  if(!rows.length)return '<div class="st-run-hist-empty">هنوز وزنی ثبت نشده است.</div>';
  return `<ul class="sr38-hist">${rows.map(({run,e})=>`<li><b>+ ${qty(e.kg)} کیلوگرم</b><span>سرویس ${fa(String(run))}</span><span>${esc((e.at||'').slice(11,16)||'')}</span><span>${esc(e.byName||'')}</span>${e.note?`<small>${esc(e.note)}</small>`:''}</li>`).join('')}</ul>`; }
function sr38Sheet(o){
  const body=$('#wh38Body'); if(!body)return;
  body.dataset.sheet='1';
  app.wh38.sheetOrder=o;
  const sr=o.storeRun||{};
  const items=activeItemsOf(o);
  const viewById={};(sr.items||[]).forEach(v=>{viewById[v.itemId]=v});
  const unresolved=(sr.items||[]).filter(v=>v.runStatus!=='COMPLETED'&&v.runStatus!=='CLOSED_SHORT');
  const totalSent=items.reduce((sum,it)=>{const v=viewById[it.id]||{};return sum+Number(v.totalKg||0)},0);
  const closedRows=[],groups={1:[],2:[]};
  items.forEach((it,k)=>{
    const v=viewById[it.id]||{}; const closed=!!(it.runCompleted||it.shortageClosed); const run=it.movedToR2?2:1;
    const hist=(it.runR1||[]).length+(it.runR2||[]).length;
    const wts=`<span class="sr318-weights" aria-label="وزن و سوابق"><span class="sr318-wts">س۱ <b>${qty(v.r1Kg||0)}</b> • س۲ <b>${qty(v.r2Kg||0)}</b> • جمع <b>${qty(v.totalKg||0)} کیلوگرم</b></span>${hist?`<button type="button" class="btn btn-secondary btn-sm sr318-history-button" data-action="sr38-history" data-item="${esc(it.id)}">سوابق (${qty(hist)})</button>`:''}</span>`;
    const head=`<span class="wh38-prep-num sr318-num">${fa(String(k+1))}</span><strong class="sr318-name" title="${esc(it.product?.name||'—')}">${esc(it.product?.name||'—')}</strong><span class="st-run-chip st-run-${esc(v.runStatus||'AWAITING_R1')}">${esc(SR38_STATUS_LABEL[v.runStatus]||'')}</span><span class="sr318-req">درخواست <b>${qty(it.requestedQty)} ${esc(it.requestedUnit||'')}</b></span>${wts}`;
    if(closed){ closedRows.push(`<article class="wh38-prep-item sr38-item sr318-row sr318-closed ${v.runStatus==='COMPLETED'?'sr38-done':''}${v.runStatus==='CLOSED_SHORT'?'sr38-short':''}">${head}<span class="sr318-final">${it.runCompleted?`تکمیل‌شده — وزن ذخیره‌شده ${qty(v.totalKg||0)} کیلوگرم`:`بسته با کسری — وزن ذخیره‌شده ${qty(v.totalKg||0)} کیلوگرم${it.shortageClosed.note?` · ${esc(it.shortageClosed.note)}`:''}`}</span></article>`); return; }
    groups[run].push(`<article class="wh38-prep-item sr38-item sr318-row" data-sr318-row="${run}">${head}<div class="sr38-ops sr318-ops"><div class="wh38-cell-box sr38-weight-box sr318-wbox"><input type="text" inputmode="decimal" autocomplete="off" placeholder="۰٫۰۰۰" aria-label="وزن خالص ${esc(it.product?.name||'محصول')} به کیلوگرم" data-sr38-weight="${it.id}"><b>کیلوگرم</b></div><button type="button" class="btn btn-secondary btn-sm wh-weight-open" data-action="wh-weight-details">ناخالصی</button><button type="button" class="btn btn-primary btn-sm" data-action="sr38-weight" data-id="${o.id}" data-item="${it.id}" data-run="${run}">${icon('scale',13)} ذخیره وزن</button>${!it.movedToR2?`<button type="button" class="btn btn-secondary btn-sm" data-action="sr38-move" data-id="${o.id}" data-item="${it.id}">${icon('arrow',13)} سرویس دوم</button>`:''}<button type="button" class="btn btn-secondary btn-sm" data-action="sr38-complete" data-id="${o.id}" data-item="${it.id}">${icon('check',13)} تکمیل محصول</button><button type="button" class="btn btn-ghost btn-sm danger-text" data-action="sr38-oos" data-id="${o.id}" data-item="${it.id}">${icon('trash',13)} عدم موجودی</button></div></article>`);
  });
  const groupHtml=(run,title,sub)=>`<section class="sr318-group" data-sr318-group="${run}"><header class="sr318-group-head"><b>سرویس ${title}</b><small>${sub}</small><span class="sr318-gcount">${qty(groups[run].length)} قلم فعال</span></header><div class="sr318-rows">${groups[run].join('')||'<div class="sr318-empty">قلم فعالی در این سرویس نیست.</div>'}</div></section>`;
  body.innerHTML=`<section class="wh38-sheet st-run-sheet st-run-sheet-v318">
    <div class="wh38-sheet-head wh38-sheet-head-compact wh38-store-sheet-head">${wh38StoreHeader(o)}</div>
    <div class="sr318-summary"><span>وضعیت کلی: <b>${esc(sr.overallLabel||'—')}</b></span><span>سرویس اول: <b>${esc(sr.r1StatusLabel||'—')}</b></span><span>سرویس دوم: <b>${esc(sr.r2StatusLabel||'—')}</b></span><span>جمع وزن ذخیره‌شده: <b>${qty(totalSent)} کیلوگرم</b></span><span>حل‌نشده: <b>${qty(unresolved.length)} قلم</b></span></div>
    <div class="sr318-sendnote">وزن هر قلم با «ذخیره وزن» برای سرویس مربوط در سامانه می‌ماند؛ هر ثبت، یک نوبت تازه به جمع همان سرویس اضافه می‌کند و به‌تنهایی ثبت تحویل نیست.</div><div class="sr318-sendline">${sr38SendBtn(o,1,sr.items)}${sr38SendBtn(o,2,sr.items)}${storeServicePrintButtons(o.id,storeAvailableRuns(o))}<span class="sr318-sendnote">سند (فاکتور) هر سرویس جدا و فقط با اقلام همان سرویس صادر می‌شود. با ثبت وزن: قلم کامل یا ناقص، به مقدار ثبت‌شده وارد فاکتور همان سرویس می‌شود؛ وزن صفر، قلم را به سرویس دوم می‌برد و ماندهٔ قلم ناقص هم با دکمهٔ «سرویس دوم» منتقل می‌شود؛ اگر بعد از ارسال یک سرویس، قلم تازه‌ای برای همان سرویس وزن شود، دکمهٔ «ارسال قلم جدید» آن را به همان محمولهٔ نزد فروش می‌افزاید.</span></div>
    ${groupHtml(1,'اول','ثبت وزن و ارسال صبح')}
    ${groupHtml(2,'دوم','ماندهٔ اقلام منتقل‌شده و ارسال ظهر')}
    ${closedRows.length?`<details class="sr318-done-box"><summary>اقلام تعیین‌تکلیف‌شده (${qty(closedRows.length)})</summary><div class="sr318-rows">${closedRows.join('')}</div></details>`:''}
    <div class="wh38-sheet-foot sr318-foot"><div><span>اقلام حل‌نشده</span><strong>${qty(unresolved.length)} قلم</strong></div>
      <div class="toolbar sr38-sendbar"><button type="button" class="btn btn-secondary" data-action="sr38-back" data-id="${o.id}">${icon('arrow',15)} بازگشت به فهرست</button><button type="button" class="btn btn-secondary" data-action="wh38-return" data-id="${o.id}">${icon('arrow',15)} ارجاع به فروش</button>${sr38SendBtn(o,1,sr.items)}${sr38SendBtn(o,2,sr.items)}<button type="button" class="btn btn-primary" data-action="sr38-finalize" data-id="${o.id}">${icon('send',16)} پایان عملیات ارسال امروز</button></div></div>
  </section>`;
}
async function sr38Post(id,ep,payload){
 // Repainting a saved row must not discard other rows the operator is still editing.
 const pending=$$('#wh38Body [data-sr38-weight]').filter(w=>w.value.trim()&&w.dataset.sr38Weight!==(payload.itemId||payload.items?.[0]?.itemId)).map(w=>({id:w.dataset.sr38Weight,value:w.value,rows:whWeighingDrafts.get(w)}));
 const restore=()=>pending.forEach(x=>{const w=$$('#wh38Body [data-sr38-weight]').find(el=>el.dataset.sr38Weight===x.id);if(w){w.value=x.value;if(x.rows){whWeighingDrafts.set(w,x.rows);w.readOnly=true;}}});
 try{ await api('/api/orders/'+id+'/store-run/'+ep,{method:'POST',body:JSON.stringify(payload)}); const fresh=await api('/api/orders/'+id); if(fresh.order&&fresh.order.storeRun&&fresh.order.storeRun.finalizedAt){ toast('کار انبار این سفارش پایان یافت و سفارش به سوابق انبار رفت.'); await refreshIndicators(); if(app.wh38.phase==='stores'){app.wh38.storeTab='preparing'; wh38Shell('stores');}else wh38Shell('preparing'); return true; } if(fresh.order&&fresh.order.storeRun&&$('#wh38Body[data-sheet="1"]')){sr38Sheet(fresh.order);restore();} await refreshIndicators(); return true; }catch(e){ toast(e.message); try{ const fresh=await api('/api/orders/'+id); if(fresh.order&&fresh.order.storeRun&&$('#wh38Body[data-sheet="1"]')){sr38Sheet(fresh.order);restore();} }catch(_){} return false; } } // v37.33.0 — هنگام خطا هم برگه از سرور بازرندر می‌شود تا عدد ردشده روی صفحه نماند و «ثبت‌شده» به نظر نرسد
// v37.35.0 — همین‌که سرور کار انبار را پایان‌یافته اعلام کند (ثبت وزن سرویس دوم و ارسال آن، یا آخرین «تکمیل محصول»)، برگه بسته و فهرست آماده‌سازی نشان داده می‌شود؛ سفارش دیگر آنجا نمی‌ماند.
async function sr38Finalize(id){
  // v37.23.0 — «تصمیم پایان روز» حذف شد؛ هر محصول با دکمهٔ «تکمیل محصول» (پس از ثبت وزن) یا «عدم موجودی» بسته می‌شود
  // و پایان عملیات فقط وقتی زده می‌شود که همهٔ اقلام بسته شده باشند. (پیش‌تر نبودِ فهرست تصمیم، تابع را بی‌صدا برمی‌گرداند.)
  const openRows=$$('#wh38Body [data-sr318-row]').length;
  if(openRows)return toast(`هنوز ${fa(String(openRows))} قلم بسته نشده است؛ هر محصول را با دکمهٔ «تکمیل محصول» (پس از ثبت وزن) یا «عدم موجودی» ببندید، سپس «پایان عملیات ارسال امروز» را بزنید.`);
  if(!confirm('همهٔ اقلام این سفارش بسته شده‌اند؛ عملیات ارسال امروز پایان یابد و فرم از کارتابل انبار خارج شود؟'))return;
  try{ const r=await api('/api/orders/'+id+'/store-run/finalize-day',{method:'POST',body:JSON.stringify({decisions:[]})}); if(r.order&&r.order.status==='WAREHOUSE_PREPARING'&&r.order.storeRun&&$('#wh38Body[data-sheet="1"]')){ toast('عملیات ارسال روز پایان یافت؛ سفارش تا نهایی‌شدن محموله‌های راه باز می‌ماند.'); sr38Sheet(r.order); await refreshIndicators(); } else { toast('عملیات ارسال روز پایان یافت؛ وضعیت سفارش به‌روز شد.'); await refreshIndicators(); if(app.wh38.phase==='stores'){app.wh38.storeTab='preparing'; wh38Shell('stores');}else wh38Shell('preparing'); } }catch(e){ toast(e.message); }
}
window.renderWarehouse=async function(){
  if(app.timer){clearInterval(app.timer);app.timer=null}
  app.page='warehouse';
  if(app.whV33&&app.whV33.timer){clearInterval(app.whV33.timer);app.whV33.timer=null}
  wh38Shell(app.wh38.phase||'incoming');
};

/* ---------------- فروشگاه ---------------- */
// v37.5.0 — نمای هر محموله (سرویس) از یک سفارش؛ فاکتور و تأیید دریافت به‌ازای هر محموله
function st38ViewsOf(o){
  const ds=o.transportWorkflow===1&&o.orderType==='STORE'?Object.values(o.transportStoreTrips||{}).map(t=>{
    const sh=t.run===1?o.storeRunOps?.r1Shipment:o.storeRunOps?.r2Shipment;
    return {...t,status:t.status==='RECEIPT_CONFIRMED'?'DELIVERED':t.status,deliveredAt:t.storeReceiptConfirmedAt||null,shipmentItemIds:sh?.itemIds||[],shipmentWeights:sh?.weights||{}};
  }):[...(Array.isArray(o.dispatchRuns)?o.dispatchRuns:[]),...(o.dispatch?[o.dispatch]:[])].filter(Boolean);
  if(!ds.length)return [o];
  return ds.map((d)=>{
    const pay=d.run?(o.payments||[]).find((p)=>(p.deliveryRun||null)===(d.run||null)):o.payment;
    const view=Object.assign({},o,{dispatch:d,payment:pay||o.payment});
    delete view.dispatchRuns;
    return view;
  });
}
function st38RunSummaryHtml(o){ // v37.5.0 — جمع‌بندی هر محمولهٔ سرویس در جزئیات سفارش
  const ds=[...(Array.isArray(o.dispatchRuns)?o.dispatchRuns:[]),...(o.dispatch?[o.dispatch]:[])].filter((d)=>d&&d.status);
  if(!ds.length)return '';
  const labels={ASSIGNED:'به راننده واگذار شد',DRIVER_EXIT_REPORTED:'منتظر تأیید خروج نگهبان',IN_TRANSIT:'در حال ارسال به فروشگاه',DELIVERED:'تحویل ثبت شد (منتظر نهایی فروش)',SALES_FINALIZED:'نهایی‌شده نزد فروش',CLOSED:'بسته‌شده'};
  const lines=ds.map((d,i)=>`<div class="st-run-run-line"><span class="st-run-chip st-run-r${d.run===2?2:1}">${d.run===2?'محمولهٔ سرویس دوم':d.run===1?'محمولهٔ سرویس اول':'محموله'}</span><span>${esc(labels[d.status]||d.status)}</span><span>راننده: <b>${esc(d.driverName||'—')}</b></span><span>تحویل: <b>${esc(formatDateTime24(d.deliveredAt||''))}</b></span><span>تأیید دریافت: <b>${d.storeReceiptConfirmedAt?`تأیید شد • ${esc(formatDateTime24(d.storeReceiptConfirmedAt))}`:'نیامده'}</b></span></div>`).join('');
  return `<div class="st-run-runs-summary">${lines}</div>`;
}
function st38DeliveredDetails(o){
 const d=o.dispatch||{},lines=Array.isArray(d.lines)?d.lines:[];
 const payable=Number(d.amountDue??o.payment?.totalAmount??d.approvedTotalAmount??0);
 const methods=d.settlementMethods||o.payment?.settlementMethods||[];
 const labels={CASH:'نقدی',POS:'پوز',CARD_TRANSFER:'کارت‌به‌کارت',CHECK:'چک',CREDIT:'معوق'};
 const isRun = d.run === 1 || d.run === 2;
 const runChip = isRun ? `<span class="st-run-chip st-run-r${d.run === 2 ? 2 : 1}">محمولهٔ سرویس ${d.run === 2 ? 'دوم' : 'اول'}</span>` : '';
 const confirmed = !!d.storeReceiptConfirmedAt;
 const confirmedAt = d.storeReceiptConfirmedAt || '';
 const freeFlow=o.orderType==='STORE'; // v37.6.0 — فلوی فروشگاه بدون هیچ مبالغی؛ سند این عرضه وزنی است
 const rows=freeFlow?lines.map((line,i)=>`<tr><td>${fa(String(i+1))}</td><td>${esc(line.productName||'قلم')}</td><td>${qty(line.deliveredKg)}</td><td>${qty(line.returnKg||0)}</td><td>${qty(line.shortageKg||0)}</td><td>${qty(line.netKg??Math.max(0,Number(line.deliveredKg||0)-Number(line.returnKg||0)-Number(line.shortageKg||0)))}</td><td>${esc(line.reason||'—')}</td></tr>`).join('')
 :lines.map((line,i)=>`<tr><td>${fa(String(i+1))}</td><td>${esc(line.productName||'قلم')}</td><td>${qty(line.deliveredKg)}</td><td>${qty(line.returnKg||0)}</td><td>${qty(line.shortageKg||0)}</td><td>${qty(line.netKg||0)}</td><td>${esc(line.reason||'—')}</td><td>${money(line.unitPrice||0)}</td><td>${money(line.amountDue??line.grossAmount??0)}</td></tr>`).join('');
 const paid=freeFlow?'':methods.map(m=>`${esc(labels[m.type]||m.type)} ${money(m.amount)}${m.deviceSnapshot?` • ${esc(m.deviceSnapshot.title)} / پایانه ${esc(m.deviceSnapshot.terminalNumber)}`:''}${m.reference?` • پیگیری ${esc(m.reference)}`:''}`).join('، ');
 const summaryCell=freeFlow
   ?`<span>جمع وزن سند <b>${qty((lines||[]).reduce((sm,l)=>sm+Number(l.deliveredKg||0),0))} کیلوگرم</b></span><span>سند تحویل <b>${esc(fa(o.transportWorkflow===1?(d.warehouseDocumentNo||'—'):(o.payment?.invoiceNumber||'پس از تأیید نهایی فروش')))}</b></span>`
   :`<span>مبلغ قابل تسویه <b>${money(payable)}</b></span><span>فاکتور <b>${esc(fa(o.payment?.invoiceNumber||'پس از تأیید نهایی فروش'))}</b></span>${paid?`<span>روش‌های دریافت <b>${paid}</b></span>`:''}`;
 return `<article class="st38-delivered-card"><header><div><span class="order-code">${esc(fa(o.orderNo||'—'))}</span>${runChip}<h3>${esc(o.storeName||'فروشگاه')} </h3><p>${o.transportWorkflow===1?'تأیید فروشگاه':'ثبت تحویل راننده'}: ${formatDateTime24(d.deliveredAt)} • راننده: ${esc(d.driverName||'—')}</p></div><span class="badge ${confirmed?'green':'orange'}">${confirmed?'دریافت تأیید شد':'منتظر تأیید فروشگاه'}</span></header><div class="st38-delivered-items table-wrap"><table class="table store-shipment-table"><thead><tr><th>ردیف</th><th>محصول</th><th>تحویلی (کیلو)</th><th>مرجوعی</th><th>کسری</th><th>خالص</th><th>علت</th>${freeFlow?'':'<th>فی</th><th>مبلغ</th>'}</tr></thead><tbody>${rows||`<tr><td colspan="${freeFlow?7:9}">ریز اقلام تحویل در دسترس نیست.</td></tr>`}</tbody></table></div><div class="st38-delivered-summary">${summaryCell}</div>${d.note?`<p class="st38-delivered-note"><b>یادداشت راننده:</b> ${esc(d.note)}</p>`:''}<footer>${confirmed?`<span class="st38-confirmed-stamp">تأیید شما: ${formatDateTime24(confirmedAt)}</span>`:`<span class="subtle">${isRun?'اقلام همین محموله را کنترل و دریافت را تأیید کنید؛ محمولهٔ دیگر جداگانه تأیید می‌شود.':'لطفاً اقلام تحویلی را کنترل و دریافت را تأیید کنید.'}</span><button type="button" class="btn btn-primary" data-action="store-confirm-delivery" data-id="${esc(o.id)}"${isRun?` data-run="${d.run}"`:''}>${icon('check',16)} تأیید دریافت ${isRun?'محمولهٔ سرویس '+(d.run===2?'دوم':'اول'):'تحویل'}</button>`}</footer></article>`;
}
function st38DeliveredRow(o){
 const d=o.dispatch||{},run=Number(d.run)||0;
 return orderSummaryRow(o,{className:'st38-delivered-card order-compact-row',statusHtml:`<span class="badge ${d.storeReceiptConfirmedAt?'green':'orange'}">${d.storeReceiptConfirmedAt?'دریافت تأیید شد':'منتظر تأیید دریافت'}</span>`,itemCount:(d.lines||[]).length,extras:[...(run?[{html:`سرویس ${run===2?'دوم':'اول'}`}]:[]),{html:`زمان تحویل: ${esc(formatDateTime24(d.deliveredAt))}`}],actionsHtml:`<button type="button" class="btn btn-secondary btn-sm" data-action="store-delivery-details" data-id="${esc(o.id)}" data-run="${run}">جزئیات سفارش</button>`});
}

async function confirmStoreDelivery(el){
 const run=Number(el.dataset.run)||0,label=run===2?'سرویس دوم':run===1?'سرویس اول':'';
 if(!confirm(run?`اقلام و وزن محمولهٔ ${label} را کنترل کرده‌اید و دریافت همین محموله را تأیید می‌کنید؟ (محمولهٔ دیگر جداگانه تأیید می‌شود)`:'اقلام و وزن تحویل‌شده را کنترل کرده‌اید و دریافت این سفارش را تأیید می‌کنید؟'))return;
 el.disabled=true;try{await api('/api/store/orders/'+encodeURIComponent(el.dataset.id)+'/confirm-receipt',{method:'POST',body:JSON.stringify(run?{run}:{})});closeModal();toast(run?`دریافت محمولهٔ ${label} تأیید شد.`:'دریافت سفارش تأیید شد.');await renderStorePortal();}catch(err){el.disabled=false;toast(err.message)}
}
document.addEventListener('click',e=>{const el=e.target.closest('#modal [data-action=store-confirm-delivery]');if(el)void confirmStoreDelivery(el)});

async function openStoreDeliveryDetails(id,run){
 const notices=captureEntityNotices('order',id,run||null);
 try{const o=(await api('/api/store/orders/'+encodeURIComponent(id))).order;const views=st38ViewsOf(o);const view=views.find(v=>Number(v.dispatch?.run||0)===Number(run||0));if(!view)return toast('این محموله در دسترس نیست.');openModal('جزئیات محموله', ['DELIVERED','SALES_FINALIZED','CLOSED'].includes(view.dispatch?.status)?st38DeliveredDetails(view):st38TransitDetails(view));finishEntityNotices(notices);return true;}
 catch(e){toast(e.message);return false;}
}

function st38TransitDetails(o){
 const d=o.dispatch||{},weights=d.shipmentWeights||{},ids=new Set(d.shipmentItemIds||[]);
 if(!ids.size&&d.run){for(const id of Object.keys(weights))ids.add(id);if(!ids.size)for(const i of o.items||[]){if((d.run===2?i.runR2:i.runR1)?.some(e=>Number(e.kg)>0))ids.add(i.id);}}
 const items=(o.items||[]).filter(i=>i.itemStatus!=='CANCELLED'&&(!d.run||ids.has(i.id)));
 const weightOf=i=>Object.prototype.hasOwnProperty.call(weights,i.id)?qty(weights[i.id]):d.run?qty(((d.run===2?i.runR2:i.runR1)||[]).reduce((sum,e)=>sum+Number(e.kg||0),0)):'—';
 const rows=items.map((i,k)=>`<tr><td>${fa(String(k+1))}</td><td>${esc(i.product?.name||'—')}</td><td>${qty(i.requestedQty)} ${esc(i.requestedUnit||'')}</td><td>${weightOf(i)}</td><td>${esc(i.description||'—')}</td></tr>`).join('');
 return `<div class="store-shipment-details"><div class="store-shipment-meta"><span>شماره سفارش: <b>${esc(fa(o.orderNo||'—'))}</b></span><span>${d.run?`سرویس ${d.run===2?'دوم':'اول'}`:'محموله'}</span><span>راننده: <b>${esc(d.driverName||'—')}</b></span>${st38OrderBadge(o)}</div><div class="table-wrap"><table class="table store-shipment-table"><thead><tr><th>ردیف</th><th>محصول</th><th>مقدار درخواستی</th><th>وزن این سرویس (کیلوگرم)</th><th>توضیحات</th></tr></thead><tbody>${rows||'<tr><td colspan="5">قلمی برای این محموله ثبت نشده است.</td></tr>'}</tbody></table></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">بستن</button>${o.transportWorkflow===1&&d.status==='IN_TRANSIT'?`<button type="button" class="btn btn-primary" data-action="store-confirm-delivery" data-id="${esc(o.id)}" data-run="${Number(d.run)||0}">تأیید دریافت همین سرویس</button>`:''}</div></div>`;
}
function st38OrderBadge(o){const d=o.dispatch;if(!d)return badge(o.status);const labels={ASSIGNED:'به راننده واگذار شد',DRIVER_EXIT_REPORTED:'منتظر تأیید خروج',IN_TRANSIT:'در حال ارسال'};const tone={ASSIGNED:'orange',DRIVER_EXIT_REPORTED:'purple',IN_TRANSIT:'blue'};return `<span class="badge ${tone[d.status]||'gray'}">${esc(labels[d.status]||d.status)}</span>`}
function st38Row(o){
 const run=Number(o.dispatch?.run)||0;
 return orderSummaryRow(o,{className:'st38-row order-compact-row',statusHtml:st38OrderBadge(o),itemCount:o.dispatch?dspScopedItems(o).length:activeItemsOf(o).length,extras:run?[{html:`سرویس ${run===2?'دوم':'اول'}`}]:[],actionsHtml:`<button type="button" class="btn btn-secondary btn-sm" data-action="${o.dispatch?'store-delivery-details':'store-order-details'}" data-id="${esc(o.id)}" data-run="${run}">جزئیات سفارش</button>`});
}

// All orders remain visible as one order even when their two services progress separately.
const ST_REGISTERED_LABELS={
  STORE_PENDING_SALES:'در انتظار بررسی فروش', SCHEDULED_REMOTE:'تأیید شده، در انتظار زمان ارسال به انبار',
  WAREHOUSE_PENDING:'در صف دریافت انبار', WAREHOUSE_PREPARING:'در حال آماده‌سازی در انبار',
  RETURNED_TO_SALES:'برگشت به فروش برای اصلاح', SETTLEMENT_PENDING:'آماده بررسی فروش',
  SETTLED:'تأیید شده', EXITED:'خروج ثبت شده', CLOSED:'تکمیل و بسته‌شده',
  CANCELLED:'لغو شده', OUT_OF_STOCK:'عدم موجودی', DELIVERED:'تحویل ثبت شده'
};
function stRegisteredRow(o){
  const showProgress=!['STORE_PENDING_SALES','CANCELLED'].includes(o.status);
  const items=(o.items||[]).filter(i=>i.itemStatus!=='CANCELLED');
  const status=ST_REGISTERED_LABELS[o.status]||o.status||'نامشخص';
  const stageLabels={SENT_TO_SALES:'منتظر راننده',ASSIGNED:'راننده تعیین شد',DRIVER_EXIT_REPORTED:'منتظر خروج',IN_TRANSIT:'در مسیر',DELIVERED:'تحویل ثبت شد',SALES_FINALIZED:'نهایی‌شده نزد فروش',CLOSED:'نهایی‌شده نزد فروش',RECEIPT_CONFIRMED:'دریافت تأیید شد'};
  const service=(run)=>{const sr=o.storeRun||{},stage=run===1?sr.r1Stage:sr.r2Stage,full=run===1?sr.r1StageLabel:sr.r2StageLabel;const weights=(sr.items||[]).some(v=>Number(run===1?v.r1Kg:v.r2Kg)>0);const label=stage?(stageLabels[stage]||full||stage):(weights?'وزن‌کشی ثبت شده':'در انتظار');return `<span class="st-registered-service" title="${esc(full||label)}">سرویس ${run===1?'اول':'دوم'}: ${esc(label)}</span>`;};
  const extras=showProgress&&o.storeRun?.enabled?[{html:service(1)},{html:service(2)}]:[];
  const actions=`<button type="button" class="btn btn-secondary btn-sm" data-action="store-order-details" data-id="${esc(o.id)}">${icon('eye',13)} جزئیات سفارش</button>${o.status==='STORE_PENDING_SALES'?`<button type="button" class="btn btn-secondary btn-sm" data-action="edit-store-order" data-id="${esc(o.id)}">${icon('edit',13)} ویرایش</button><button type="button" class="btn btn-ghost btn-sm danger-text" data-action="cancel-store-order" data-id="${esc(o.id)}">${icon('trash',13)} لغو</button>`:''}`;
  return orderSummaryRow(o,{className:'st-registered-card',statusHtml:`<span class="badge ${o.status==='CANCELLED'?'gray':o.status==='CLOSED'?'green':'blue'}">${esc(status)}</span>`,itemCount:items.length,extras,actionsHtml:actions}).replace(' data-order=', ' data-store-order-id="'+esc(o.id)+'" data-order=');
}
async function renderStoreRegistered(){
  const root=$('#content'),limit=25;
  let offset=Math.max(0,Math.floor(Number(app.storeRegisteredOffset)||0)),seq=0,signature='';
  root.innerHTML=`<section class="sd-panel st-registered-panel"><header class="st-registered-head"><div><h2>سفارش‌های ثبت‌شده</h2><p>از بررسی فروش تا آماده‌سازی انبار و تحویل؛ هر سفارش و سرویس‌های آن را اینجا پیگیری کنید.</p></div><span class="st-registered-live" role="status">در حال دریافت اطلاعات…</span></header><p class="st-registered-scroll-hint">برای دیدن تمام ستون‌ها در صفحهٔ کوچک، فهرست را افقی جابه‌جا کنید.</p><div class="st-registered-scroll" tabindex="0" role="region" aria-label="فهرست افقی سفارش‌ها"><div id="storeRegisteredList" class="st-registered-list"><div class="empty">در حال دریافت سفارش‌ها…</div></div></div><div id="storeRegisteredPages" class="st-registered-pages"></div></section>`;
  const current=()=>root.isConnected && app.page==='store' && app.sub.store==='registered';
  async function refresh(force=false){
    const request=++seq;
    try{
      const data=await api(`/api/store/orders?offset=${offset}&limit=${limit}`);
      if(!current()||request!==seq)return;
      if(offset>0&&offset>=data.total){offset=data.total?Math.floor((data.total-1)/limit)*limit:0;app.storeRegisteredOffset=offset;return refresh(true);}
      const nextSignature=JSON.stringify([data.orders,data.total,offset]);
      if(force||nextSignature!==signature){
        const focused=document.activeElement, focusedCard=focused?.closest?.('[data-store-order-id]');
        const focusOrder=focusedCard?.dataset.storeOrderId, focusAction=focused?.dataset?.action;
        const focusPage=focused?.dataset?.registeredPage;
        signature=nextSignature;
        $('#storeRegisteredList').innerHTML=(data.orders||[]).map(stRegisteredRow).join('')||sdEmpty('receipt','هنوز سفارشی ثبت نشده است','سفارش‌های ثبت‌شدهٔ همین حساب فروشگاه در این بخش نمایش داده می‌شوند.');
        $('#storeRegisteredPages').innerHTML=`<button type="button" class="btn btn-secondary btn-sm" data-registered-page="previous" ${offset===0?'disabled':''}>صفحه قبل</button><span>${data.total?`${qty(offset+1)} تا ${qty(Math.min(offset+limit,data.total))} از ${qty(data.total)} سفارش`:'۰ سفارش'}</span><button type="button" class="btn btn-secondary btn-sm" data-registered-page="next" ${offset+limit>=data.total?'disabled':''}>صفحه بعد</button>`;
        if(focusOrder){const card=[...root.querySelectorAll('[data-store-order-id]')].find(x=>x.dataset.storeOrderId===focusOrder);const button=[...(card?.querySelectorAll('[data-action]')||[])].find(x=>x.dataset.action===focusAction)||card?.querySelector('[data-action=store-order-details]');button?.focus({preventScroll:true});}
        else if(focusPage){const button=[...root.querySelectorAll('[data-registered-page]')].find(x=>x.dataset.registeredPage===focusPage&&!x.disabled);button?.focus({preventScroll:true});}
      }
      root.querySelector('.st-registered-live').textContent='به‌روزرسانی خودکار • '+formatDateTime24(new Date().toISOString());
    }catch(e){if(current()&&request===seq){root.querySelector('.st-registered-live').textContent='به‌روزرسانی ناموفق؛ تلاش مجدد خودکار';if(!signature)$('#storeRegisteredList').innerHTML=`<div class="empty">دریافت سفارش‌ها ناموفق بود: ${esc(e.message)}</div>`;}}
  }
  root.onclick=async e=>{
    const page=e.target.closest('[data-registered-page]');
    if(page){offset=Math.max(0,offset+(page.dataset.registeredPage==='next'?limit:-limit));app.storeRegisteredOffset=offset;signature='';await refresh(true);return;}
    const el=e.target.closest('[data-action]');if(!el)return;
    if(el.dataset.action==='store-order-details')return openStoreOrderDetails(el.dataset.id);
    if(el.dataset.action==='edit-store-order')return openStoreOrderEdit(el.dataset.id);
    if(el.dataset.action==='cancel-store-order'&&confirm('این سفارش لغو شود؟')){el.disabled=true;try{await api('/api/store/orders/'+encodeURIComponent(el.dataset.id)+'/cancel',{method:'POST',body:JSON.stringify({reason:'لغو توسط فروشگاه'})});toast('سفارش لغو شد.');el.blur();await refresh(true);}catch(err){el.disabled=false;toast(err.message);}}
  };
  await refresh(true);
  if(current()){let polling=false;app.timer=setInterval(()=>{if(polling)return;polling=true;refresh().finally(()=>{polling=false;});},3500);}
}

async function renderStorePortal(){
  if(app.timer){clearInterval(app.timer);app.timer=null}
  if(app.sub.store==='registered')return renderStoreRegistered();
  const d=await api('/api/store/orders'); const orders=d.orders||[];const isDeliveryView=app.sub.store==='delivery';app.storePortalTab=isDeliveryView?'delivery':'create';app.storeDeliveryTab=app.storeDeliveryTab==='delivered'?'delivered':'inProgress';
  const deliveredViews=orders.flatMap((o)=>st38ViewsOf(o)).filter((v)=>v.dispatch&&['DELIVERED','SALES_FINALIZED','CLOSED'].includes(v.dispatch.status)).sort((a,b)=>String(b.dispatch.deliveredAt||'').localeCompare(String(a.dispatch.deliveredAt||''))); // v37.5.0 — هر محموله کارت جدا
  const transitOrders=orders.flatMap(o=>st38ViewsOf(o)).filter(v=>v.dispatch&&['ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'].includes(v.dispatch.status)).sort((a,b)=>String(b.dispatch.assignedAt||b.updatedAt||'').localeCompare(String(a.dispatch.assignedAt||a.updatedAt||'')));
  const allDispatchViews=orders.flatMap((o)=>st38ViewsOf(o));
  const stagedOrders=new Set(orders.filter((o)=>{ const vs=allDispatchViews.filter((v)=>v.id===o.id); return vs.some((v)=>v.dispatch&&['DELIVERED','SALES_FINALIZED','CLOSED','ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'].includes(v.dispatch.status))||o.dispatch&&['ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'].includes(o.dispatch.status); }));
  const incomingOrders=orders.filter(o=>!stagedOrders.has(o)&&o.status!=='CANCELLED'&&o.approvalStatus!=='CANCELLED').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  $('#content').innerHTML=`<div style="display:grid;gap:18px">
    <section class="sd-panel"><div class="sd-pad st38-hero">
      <div class="sd-head-main" style="align-items:center"><span class="sd-head-ico" style="background:var(--orange-bg);color:var(--orange)">${icon('sales',20)}</span><div><h2 style="font-size:20px;font-weight:1000;margin:0">ثبت سفارش و پیگیری تحویل</h2><p style="margin:4px 0 0;font-size:13px;color:var(--muted)">ثبت سفارش توسط فروشگاه، بررسی توسط واحد فروش و ورود به انبار پس از تعیین زمان ارسال.</p></div></div>
      <div class="st38-hero-badge"><span>${esc(app.user.storeName||app.user.fullName||'فروشگاه')}</span><small>دسترسی اختصاصی فروشگاه</small></div>
    </div></section>
    ${!isDeliveryView?`    <div class="st38-grid">
      <section class="sd-panel">
        <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico">${icon('plus',19)}</span><div><h2>ثبت سفارش جدید</h2><p>فروشگاه فقط سفارش و اقلام را ثبت می‌کند؛ تاریخ و ساعت ارسال بعداً توسط واحد فروش تعیین می‌شود.</p></div></div></div>
        <form id="storeOrderForm" style="display:contents">
          <div class="sd-pad" style="padding-bottom:6px">
            <div class="gt-grid2">
              <div class="field"><label for="storeCustomerName">نام مشتری</label><div class="input-shell"><span>${icon('user',16)}</span><input id="storeCustomerName" name="name" required placeholder="نام و نام خانوادگی مشتری"></div></div>
              <div class="field"><label for="storeCustomerPhone">شماره تماس</label><div class="input-shell"><span>${icon('phone',16)}</span><input id="storeCustomerPhone" name="phone" required inputmode="tel" placeholder="۰۹۱۲ ..."></div></div>
            </div>
            <div class="st38-lock" style="margin-top:13px"><span>${icon('lock',17)}</span><div><strong>زمان ارسال</strong><span>توسط واحد فروش تعیین می‌شود؛ فروشگاه مستقیم به انبار دسترسی ندارد.</span></div></div>
          </div>
          <div class="sd-lines-head"><div><h3>اقلام سفارش</h3><p>محصول، مقدار، واحد و توضیح هر ردیف.</p></div></div>
          <div class="sd-lines-body"><div id="store-lines" class="sd-lines"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:13px;flex-wrap:wrap"><button type="button" class="btn btn-secondary" data-action="store-add-line">${icon('plus',15)} افزودن ردیف</button><small style="font-size:11px;color:var(--muted)">واحدهای مجاز: کیلوگرم، بسته، عدد، کارتن</small></div>
            <div class="field" style="margin-top:15px"><label for="storeOrderNotes">یادداشت سفارش</label><textarea id="storeOrderNotes" name="notes" rows="2" maxlength="1000" placeholder="توضیحات برای فروش یا انبار..."></textarea></div>
          </div>
          <div class="sd-submit-bar"><div><strong style="font-size:13.5px">ارسال برای تأیید فروش</strong><small style="display:block;font-size:11px;color:var(--muted)">فروشگاه مستقیماً به انبار دسترسی ندارد.</small></div><button class="btn btn-primary btn-lg" type="submit">${icon('send',16)} ثبت سفارش</button></div>
        </form>
      </section></div>`:''}    ${isDeliveryView?`<section class="st38-delivery-panel sd-panel"><header class="st38-delivery-heading"><div><span class="eyebrow">STORE DELIVERY</span><h2>تحویل سفارش‌ها</h2><p>وضعیت ارسال سفارش‌ها و محموله‌های فروشگاه را از این بخش پیگیری کنید.</p></div></header><nav class="store-delivery-tabs" aria-label="وضعیت تحویل"><button type="button" class="${app.storeDeliveryTab==='inProgress'?'active':''}" data-store-delivery-tab="inProgress">در حال تحویل <b>${qty(transitOrders.length)}</b></button><button type="button" class="${app.storeDeliveryTab==='delivered'?'active':''}" data-store-delivery-tab="delivered">تحویل شده <b>${qty(deliveredViews.length)}</b></button></nav><div id="storeDeliveryRows" class="st38-delivery-list">${app.storeDeliveryTab==='delivered'?deliveredViews.map(st38DeliveredRow).join('')||sdEmpty('check','محموله‌ای تحویل نشده است','پس از ثبت تحویل راننده در این بخش نمایش داده می‌شود.'):transitOrders.map(st38Row).join('')||sdEmpty('truck','سفارشی در حال تحویل نیست','سفارش پس از واگذاری به راننده در این بخش قرار می‌گیرد.')}</div></section>`:''}
  </div>`;
  if(isDeliveryView){$('#content #storeOrderForm')?.remove();$('#content .st38-grid')?.remove();}else{app.storeDraft=[defaultOrderLine()];renderOrderLineArea('store','storeDraft');}
  $('#content').onclick=async e=>{
    const tab=e.target.closest('[data-store-delivery-tab]');if(tab){app.storeDeliveryTab=tab.dataset.storeDeliveryTab==='delivered'?'delivered':'inProgress';app.storePortalTab='delivery';await renderStorePortal();return;}
    const el=e.target.closest('[data-action]'); if(!el)return; const a=el.dataset.action;
    if(a==='store-add-line'){app.storeDraft.push(defaultOrderLine());renderOrderLineArea('store','storeDraft');}
    else if(a==='op-remove-line'&&el.dataset.prefix==='store'){const i=Number(el.dataset.index);if(app.storeDraft.length>1){app.storeDraft.splice(i,1);renderOrderLineArea('store','storeDraft')}}
    else if(a==='op-pick-product'&&el.dataset.prefix==='store'){pickOperationProduct(Number(el.dataset.index),el.dataset.productId,el.dataset.label,el.dataset.quick,'store','storeDraft')}
    else if(a==='store-order-details'){return openStoreOrderDetails(el.dataset.id)}
    else if(a==='store-delivery-details'){return openStoreDeliveryDetails(el.dataset.id,Number(el.dataset.run)||0)}
    else if(a==='edit-store-order'){return openStoreOrderEdit(el.dataset.id)}
    else if(a==='store-confirm-delivery'){return confirmStoreDelivery(el)}
    else if(a==='cancel-store-order'){if(confirm('این سفارش لغو شود؟')){try{await api('/api/store/orders/'+el.dataset.id+'/cancel',{method:'POST',body:JSON.stringify({reason:'لغو توسط فروشگاه'})});toast('سفارش لغو شد.');await renderStorePortal()}catch(err){toast(err.message)}}}
  };
  $('#storeOrderForm')?.addEventListener('submit',async e=>{
    e.preventDefault(); const f=Object.fromEntries(new FormData(e.target));
    const items=app.storeDraft.filter(x=>x.productId&&n(x.requestedQty)>0).map(x=>({productId:x.productId,requestedQty:n(x.requestedQty),requestedUnit:x.requestedUnit,description:String(x.description||'').trim()}));
    if(!items.length)return toast('حداقل یک محصول معتبر وارد کنید.');
    try{ await api('/api/store/orders',{method:'POST',body:JSON.stringify({...f,items})}); toast('سفارش ثبت و برای بررسی فروش ارسال شد.'); app.storeRegisteredOffset=0; await go('store','registered'); }catch(err){ toast(err.message); }
  });
  app.timer=setInterval(async()=>{try{const x=(await api('/api/store/orders')).orders||[];if(document.activeElement?.closest?.('#storeOrderForm'))return;const done=x.flatMap((o)=>st38ViewsOf(o)).filter(v=>v.dispatch&&['DELIVERED','SALES_FINALIZED','CLOSED'].includes(v.dispatch.status)).sort((a,b)=>String(b.dispatch.deliveredAt||'').localeCompare(String(a.dispatch.deliveredAt||'')));const moving=x.filter(o=>o.dispatch&&['ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'].includes(o.dispatch.status)).sort((a,b)=>String(b.dispatch.assignedAt||b.updatedAt||'').localeCompare(String(a.dispatch.assignedAt||a.updatedAt||'')));const staged=new Set(x.filter((o)=>{const vs=st38ViewsOf(o);return vs.some(v=>v.dispatch&&['DELIVERED','SALES_FINALIZED','CLOSED','ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'].includes(v.dispatch.status))||(o.dispatch&&['ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'].includes(o.dispatch.status));}));const incoming=x.filter(o=>!staged.has(o)&&o.status!=='CANCELLED'&&o.approvalStatus!=='CANCELLED').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));const deliveryEl=$('#storeDeliveryRows');if(deliveryEl){const transitViews=x.flatMap(o=>st38ViewsOf(o)).filter(v=>v.dispatch&&['ASSIGNED','DRIVER_EXIT_REPORTED','IN_TRANSIT'].includes(v.dispatch.status));const deliveredNow=x.flatMap(o=>st38ViewsOf(o)).filter(v=>v.dispatch&&['DELIVERED','SALES_FINALIZED','CLOSED'].includes(v.dispatch.status));deliveryEl.innerHTML=app.storeDeliveryTab==='delivered'?(deliveredNow.map(st38DeliveredRow).join('')||sdEmpty('check','محموله‌ای تحویل نشده است','پس از ثبت تحویل راننده در این بخش نمایش داده می‌شود.')):(transitViews.map(st38Row).join('')||sdEmpty('truck','سفارشی در حال تحویل نیست','سفارش پس از واگذاری به راننده در این بخش قرار می‌گیرد.'));const dtabs=$$('.store-delivery-tabs b');if(dtabs[0])dtabs[0].textContent=qty(transitViews.length);if(dtabs[1])dtabs[1].textContent=qty(deliveredNow.length);}const inEl=$('#storeIncomingList'),movingEl=$('#storeTransitList'),doneEl=$('#storeDeliveredList');if(inEl)inEl.innerHTML=incoming.map(st38Row).join('')||sdEmpty('receipt','سفارش ورودی ندارید','سفارش‌های تازه پس از ثبت در این ستون دیده می‌شوند.');if(movingEl)movingEl.innerHTML=moving.map(st38Row).join('')||sdEmpty('truck','سفارشی در مسیر نیست','پس از واگذاری سفارش به راننده در این ستون ظاهر می‌شود.');if(doneEl)doneEl.innerHTML=done.map(st38DeliveredRow).join('')||sdEmpty('check','سفارشی تحویل نشده است','پس از ثبت تحویل راننده در این ستون نمایش داده می‌شود.');const counts=$$('.st38-store-stage .sd-count strong');if(counts[0])counts[0].textContent=qty(incoming.length);if(counts[1])counts[1].textContent=qty(moving.length);if(counts[2])counts[2].textContent=qty(done.length);}catch{}},3500);
}

/* ================================================================
   قدم ۴ — داشبورد + گزارش‌ها + مدیریت (v38)
   ================================================================ */

function mg38Kpi(label,value,hint,ico,tone,text=false){
  return `<article class="mg38-kpi t-${tone}"><span class="mg38-accent" aria-hidden="true"></span><span class="mg38-ico">${icon(ico,20)}</span><div class="mg38-copy"><span class="mg38-lbl">${esc(label)}</span><b class="mg38-val">${text?value:qty(value)}</b><small>${esc(hint)}</small></div></article>`;
}

/* ---------------- داشبورد ---------------- */
async function renderDashboard(){
  if(app.timer){clearInterval(app.timer);app.timer=null}
  const d=await api('/api/dashboard'); const c=d.counts||{};
  $('#content').innerHTML=`<div style="display:grid;gap:16px">
    <div class="db38-hero">
      <div class="db38-hero-right"><span class="db38-logo db38-logo-img"><img src="/logo.png" alt="بابل طیور"></span><div><h2>مرکز کنترل عملیات</h2><p>نمای لحظه‌ای از ورود مشتری، فروش، انبار، تسویه و خروج؛ با تمرکز روی اقدام بعدی هر واحد.</p></div></div>
      <div class="db38-hero-left">
        <span class="db38-live"><i></i> نمای زندهٔ سامانه</span>
        <div class="db38-date"><small>امروز</small><b>${esc(todayText())}</b></div>
        <button class="btn btn-primary" data-page="reports">${icon('reports',16)} گزارش مدیریتی</button>
        <button class="btn btn-secondary" data-page="admin">${icon('settings',16)} تنظیمات</button>
      </div>
    </div>
    <div class="mg38-kpis">
      ${mg38Kpi('ورودی امروز',c.visitsToday||0,'مراجعه ثبت‌شده در نگهبانی','gate','red')}
      ${mg38Kpi('منتظر فروش',c.waitingSales||0,'مشتری آماده ثبت سفارش','sales','blue')}
      ${mg38Kpi('در صف انبار',c.pendingWarehouse||0,'سفارش آماده اقدام انبار','warehouse','orange')}
      ${mg38Kpi('آماده خروج',c.readyExit||0,'فاکتور نهایی و آماده کنترل','check','green')}
      ${mg38Kpi('برنامه آینده',c.remoteScheduled||0,'سفارش‌های زمان‌بندی‌شده','calendar','purple')}
    </div>
    <section class="dbc-section" id="dbCharts" aria-label="تحلیل محصولات">${dbcShell()}</section>
    <div class="db38-grid db38-grid-single">
      <section class="sd-panel">
        <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--blue-bg);color:var(--blue)">${icon('receipt',19)}</span><div><h2>آخرین فعالیت‌ها</h2><p>تازه‌ترین سفارش‌های ثبت‌شده در سامانه.</p></div></div><button class="btn btn-ghost btn-sm" data-page="reports">مشاهده همه ${icon('arrow',13)}</button></div>
        <div class="sd-pad"><div class="db38-activity">${(d.recent||[]).slice(0,7).map(o=>`<div class="db38-act"><span class="db38-aico">${icon(o.orderType==='REMOTE'||o.orderType==='STORE'?'calendar':'receipt',16)}</span><div><b>${esc(storeAwareOrderName(o))}</b><small>${orderKindLabel(o)} ${badge(o.status)}</small></div><time>${formatDateTime24(o.createdAt)}</time></div>`).join('')||sdEmpty('receipt','فعالیتی ثبت نشده است','با ثبت اولین مراجعه یا سفارش، رویدادها در اینجا دیده می‌شوند.')}</div></div>
      </section>
    </div>
  </div>`;
  dbcLoad();
}

/* ---------------- v37.3.18 — نمودارهای داشبورد به تفکیک محصول ----------------
   جایگزین بخش «جریان عملیات». سه نمودار میله‌ای افقی (بدون کتابخانهٔ بیرونی، کاملاً آفلاین):
   ۱) فروش (مبلغ خالص فاکتورهای تسویه‌شده)  ۲) سفارش‌ها (تعداد سفارش)  ۳) تحویل انبار (کیلوگرم) */
app.dbc = app.dbc || { days:30, seq:0 };
const DBC_TOP = 7;
function dbcMoney(v){
  const n=Number(v||0), f=(x,d=1)=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:d}).format(x);
  if(n>=1e10) return `${f(n/1e9,2)} میلیارد`;
  if(n>=1e9) return `${f(n/1e6,0)} میلیون`;
  if(n>=1e6) return `${f(n/1e6)} میلیون`;
  return qty(n);
}
function dbcShell(){
  const ranges=[[1,'امروز'],[7,'۷ روز'],[30,'۳۰ روز'],[90,'۹۰ روز']];
  return `<div class="dbc-head"><div class="sd-head-main"><span class="sd-head-ico">${icon('reports',19)}</span><div><h2>تحلیل محصولات</h2><p id="dbcRangeText">آمار فروش، سفارش‌ها و تحویل انبار به تفکیک محصول</p></div></div>
    <div class="dbc-ranges" role="group" aria-label="بازهٔ زمانی نمودارها">${ranges.map(([d,l])=>`<button type="button" class="dbc-range ${app.dbc.days===d?'active':''}" data-dbc-days="${d}">${l}</button>`).join('')}</div></div>
    <div class="dbc-grid" id="dbcGrid">${['sales','orders','warehouse'].map(k=>`<article class="dbc-card t-${k} is-loading"><div class="dbc-skel"></div><div class="dbc-skel"></div><div class="dbc-skel"></div></article>`).join('')}</div>`;
}
function dbcBars(rows, valueOf, labelOf, subOf, tone){
  if(!rows.length) return `<div class="dbc-empty">${icon('reports',22)}<b>داده‌ای در این بازه نیست</b><span>بازهٔ بلندتری انتخاب کنید.</span></div>`;
  let list=rows.slice(0,DBC_TOP);
  const rest=rows.slice(DBC_TOP);
  const total=rows.reduce((t,r)=>t+valueOf(r),0)||1;
  if(rest.length){ list=list.concat([{ _other:true, productName:`سایر محصولات (${fa(rest.length)} کالا)`, _v:rest.reduce((t,r)=>t+valueOf(r),0), _rows:rest }]); }
  const max=Math.max(1,...list.map(r=>r._other?r._v:valueOf(r)));
  return `<ol class="dbc-bars">${list.map((r,i)=>{
    const v=r._other?r._v:valueOf(r); const pct=Math.round(v/total*100); const w=Math.max(2,Math.round(v/max*100));
    const tip=r._other?r._rows.map(x=>`${x.productName}: ${labelOf(x)}`).join('\n'):`${r.productName}\n${labelOf(r)}${subOf?` • ${subOf(r)}`:''}`;
    return `<li class="dbc-bar ${r._other?'is-other':''}" title="${esc(tip)}">
      <div class="dbc-bar-top"><span class="dbc-rank">${r._other?'…':fa(i+1)}</span><span class="dbc-name">${esc(r.productName)}</span><b class="dbc-val">${r._other?esc(labelOf({_sum:v})):esc(labelOf(r))}</b></div>
      <div class="dbc-track"><i style="width:${w}%"></i><em>${fa(pct)}٪</em></div>
      ${!r._other&&subOf?`<small class="dbc-sub">${esc(subOf(r))}</small>`:''}
    </li>`; }).join('')}</ol>`;
}
function dbcUnits(u){ return Object.entries(u||{}).filter(([,v])=>v>0).map(([k,v])=>`${qty(v)} ${k}`).join(' + ') || '—'; }
function dbcRender(d){
  const S=d.sales, O=d.orders, W=d.warehouse;
  const card=(k,ico,title,metric,totalHtml,totalSub,body)=>`<article class="dbc-card t-${k}">
    <header class="dbc-card-head"><span class="dbc-ico">${icon(ico,18)}</span><div><h3>${title}</h3><small>${metric}</small></div></header>
    <div class="dbc-total"${k==='sales'?` title="${esc(money(S.totalAmount))}"`:''}><b>${totalHtml}</b><span>${totalSub}</span></div>${body}</article>`;
  const salesLabel=(r)=>r._sum!=null?`${dbcMoney(r._sum)} ریال`:`${dbcMoney(r.amount)} ریال`;
  const ordersLabel=(r)=>r._sum!=null?`${qty(r._sum)} سفارش`:`${qty(r.orders)} سفارش`;
  const whLabel=(r)=>r._sum!=null?`${qty(r._sum)} کیلوگرم`:`${qty(r.kg)} کیلوگرم`;
  $('#dbcGrid').innerHTML=
    card('sales','sales','آمار فروش به تفکیک محصول','مبلغ خالص فاکتورهای تسویه‌شده (پس از کسر مرجوعی)',`${dbcMoney(S.totalAmount)} <em>ریال</em>`,`${qty(S.invoices)} فاکتور • ${qty(S.totalKg)} کیلوگرم`,
      dbcBars(S.rows,r=>r.amount,salesLabel,r=>`${qty(r.kg)} کیلوگرم • ${qty(r.orders)} فاکتور`))
    +card('orders','receipt','آمار سفارشات به تفکیک محصول','تعداد سفارش‌های ثبت‌شده‌ای که هر محصول را دارند',`${qty(O.totalOrders)} <em>سفارش</em>`,`${qty(O.totalLines)} ردیف کالا`,
      dbcBars(O.rows,r=>r.orders,ordersLabel,r=>`درخواستی: ${dbcUnits(r.units)}`))
    +card('warehouse','warehouse','تحویل انبار به تفکیک محصول','وزن نهایی ثبت‌شده در انبار',`${qty(W.totalKg)} <em>کیلوگرم</em>`,`${qty(W.orders)} سفارش${W.outOfStock?` • ${qty(W.outOfStock)} قلم ناموجود`:''}`,
      dbcBars(W.rows.filter(r=>r.kg>0||r.outOfStock),r=>r.kg,whLabel,r=>`${qty(r.orders)} سفارش${r.outOfStock?` • ${qty(r.outOfStock)} بار ناموجود`:''}`));
  const t=$('#dbcRangeText'); if(t) t.textContent=d.from===d.to?`امروز، ${todayText()}`:`از ${dateLabel(d.from).replace(/<[^>]+>/g,'')} تا ${dateLabel(d.to).replace(/<[^>]+>/g,'')}`;
}
async function dbcLoad(){
  const host=$('#dbCharts'); if(!host) return;
  if(!host.dataset.bound){ host.dataset.bound='1'; host.addEventListener('click',e=>{ const b=e.target.closest('[data-dbc-days]'); if(!b) return; e.stopPropagation(); app.dbc.days=Number(b.dataset.dbcDays); $$('.dbc-range').forEach(x=>x.classList.toggle('active',x===b)); dbcLoad(); }); }
  const seq=++app.dbc.seq;
  try{ const d=await api('/api/dashboard/products?days='+app.dbc.days); if(seq!==app.dbc.seq||!$('#dbcGrid')) return; dbcRender(d); }
  catch(err){ const g=$('#dbcGrid'); if(g) g.innerHTML=`<div class="empty">خطا در دریافت آمار محصولات: ${esc(err.message)}</div>`; }
}

/* ---------------- گزارش‌ها ---------------- */
async function renderReports(){
  if(app.timer){clearInterval(app.timer);app.timer=null}
  const d=await api('/api/reports'); const districts=d.gate.byDistrict||[]; const max=Math.max(1,...districts.map(x=>x.count)); const remote=d.remote||{};
  const barMax=Math.max(1,...(remote.byDate||[]).map(i=>i.count));
  const bars=(rows,fmt)=>rows.map(x=>`<div class="rp38-bar"><span>${esc(fmt(x))}</span><div class="rp38-track"><i style="width:${Math.max(8,Math.round(x.count/barMax*100))}%"></i></div><b>${qty(x.count)}</b></div>`).join('');
  $('#content').innerHTML=`<div style="display:grid;gap:16px">
    <div class="db38-hero">
      <div class="db38-hero-right"><span class="db38-logo db38-logo-img"><img src="/logo.png" alt="بابل طیور"></span><div><h2>مرکز گزارش‌گیری</h2><p>عملکرد عملیاتی، سفارش‌های آینده و وضعیت مالی در یک نمای یکپارچه.</p></div></div>
      <div class="db38-hero-left"><button class="btn btn-primary" data-action="rp38-print">${icon('receipt',16)} چاپ گزارش</button></div>
    </div>
    <div class="mg38-kpis">
      ${mg38Kpi('ورودی امروز',d.gate.today,'نگهبانی','gate','red')}
      ${mg38Kpi('سفارش‌های امروز',d.sales.todayOrders,'فروش','sales','blue')}
      ${mg38Kpi('تحویل‌شده',d.warehouse.deliveredOrders,'انبار','warehouse','orange')}
      ${mg38Kpi('درآمد ثبت‌شده',moneyCompact(d.finance.revenue),'مالی','receipt','green',true)}
      ${mg38Kpi('غیرحضوری برنامه‌ریزی‌شده',remote.scheduled||0,'آینده','calendar','purple')}
    </div>
    <div class="rp38-grid">
      <section class="sd-panel">
        <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--purple-bg);color:var(--purple)">${icon('calendar',19)}</span><div><h2>تقویم سفارش‌های غیرحضوری</h2><p>تعداد سفارش‌های برنامه‌ریزی‌شده به تفکیک تاریخ.</p></div></div></div>
        <div class="sd-pad">${(remote.byDate||[]).filter(x=>x.date!=='بدون تاریخ').slice(0,12).length?bars((remote.byDate||[]).filter(x=>x.date!=='بدون تاریخ').slice(0,12),x=>dateLabel(x.date)):'<div class="empty">سفارش غیرحضوری برنامه‌ریزی‌شده‌ای ثبت نشده است.</div>'}</div>
      </section>
      <section class="sd-panel">
        <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico" style="background:var(--orange-bg);color:var(--orange)">${icon('scale',19)}</span><div><h2>وضعیت صف‌ها</h2><p>تصیر فعلی عملیات در یک نگاه.</p></div></div></div>
        <div class="sd-pad"><div class="rp38-minis">
          <div class="rp38-mini"><b>${qty(d.sales.pendingWarehouse)}</b><span>صف انبار</span></div>
          <div class="rp38-mini"><b>${qty(d.sales.pendingSettlement)}</b><span>آماده تسویه</span></div>
          <div class="rp38-mini"><b>${qty(d.finance.readyExit)}</b><span>آماده خروج</span></div>
          <div class="rp38-mini"><b>${qty(remote.dueToday||0)}</b><span>غیرحضوری امروز</span></div>
        </div></div>
      </section>
      <section class="sd-panel">
        <div class="sd-head"><div class="sd-head-main"><span class="sd-head-ico">${icon('gate',19)}</span><div><h2>ورودی بر اساس محله</h2><p>پراکنش جغرافیایی مراجعه‌کنندگان نگهبانی.</p></div></div></div>
        <div class="sd-pad">${districts.length?districts.map(x=>`<div class="rp38-bar"><span>${esc(x.district)}</span><div class="rp38-track"><i style="width:${Math.max(8,Math.round(x.count/max*100))}%"></i></div><b>${qty(x.count)}</b></div>`).join(''):'<div class="empty">داده‌ای برای نمایش نیست.</div>'}</div>
      </section>
      <section class="sd-panel rp38-highlight">
        <div class="sd-pad" style="text-align:center">
          <span class="stl-eyebrow" style="color:var(--purple)">REMOTE ORDERS</span>
          <div class="rp38-big">${qty(remote.scheduled||0)}</div>
          <b style="font-size:14px">سفارش غیرحضوری در انتظار تاریخ تحویل</b>
          <p style="margin:6px 0 0;font-size:12px;color:var(--muted)">کل ثبت‌شده: <strong>${qty(remote.total||0)}</strong> سفارش غیرحضوری</p>
        </div>
      </section>
    </div>
  </div>`;
}

/* ---------------- مدیریت ---------------- */
function ad38TabClick(e){
  const t=e.target.closest('[data-ad38-tab]'); if(!t)return;
  app.ad38Tab=t.dataset.ad38Tab;
  $$('#content [data-ad38-tab]').forEach(b=>b.classList.toggle('active',b.dataset.ad38Tab===app.ad38Tab));
  $$('#content [data-ad38-pane]').forEach(s=>s.classList.toggle('hidden-pane',s.dataset.ad38Pane!==app.ad38Tab));
}

/* ---------------- قالب چاپ فاکتور (v38) ---------------- */
/* v37.17.0 — سطرهای سند هر سرویس فقط از دادهٔ همان سرویس ساخته می‌شوند.
   وزن کل قلم (مجموع سرویس اول و دوم) هرگز نباید در سند یک سرویس نمایش داده شود. */
function storeRunInvoiceLines(o,p){
  const priceLines=Array.isArray(p?.priceLines)?p.priceLines:[];
  if(priceLines.length) return priceLines.map(x=>({productName:x.productName,deliveredKg:Number(x.deliveredKg??0)}));
  const items=(o.items||[]).filter(i=>i.itemStatus!=='CANCELLED');
  const run=p?.deliveryRun||null;
  if(run===1||run===2){
    const key=run===1?'runR1':'runR2';
    const lines=items.map(i=>({productName:i.product?.name,deliveredKg:(Array.isArray(i[key])?i[key]:[]).reduce((sum,e)=>sum+Number(e.kg||0),0)})).filter(x=>x.deliveredKg>0);
    if(lines.length) return lines;
    const ds=[...(Array.isArray(o.dispatchRuns)?o.dispatchRuns:[]),...(o.dispatch?[o.dispatch]:[])].find(d=>d&&d.run===run);
    if(ds&&ds.shipmentWeights) return items.filter(i=>Number(ds.shipmentWeights[i.id]||0)>0).map(i=>({productName:i.product?.name,deliveredKg:Number(ds.shipmentWeights[i.id]||0)}));
    return [];
  }
  return items.map(i=>({productName:i.product?.name,deliveredKg:i.deliveredKg}));
}
// Experimental sales invoice: this document is a price statement before delivery,
// not evidence of customer signature or settlement.
function transportDraftInvoiceHtml(order,invoice){
 const lines=Array.isArray(invoice.priceLines)?invoice.priceLines:[];
 return `<div class="inv38-sheet inv38-compact"><div class="inv38-head"><div class="inv38-sales-title">فاکتور فروش و تحویل</div><div class="inv38-meta"><div><span>شماره فاکتور</span><b>${esc(fa(invoice.invoiceNumber||'—'))}</b></div><div><span>تاریخ ثبت</span><b>${esc(dt(invoice.createdAt))}</b></div><div><span>شماره سفارش</span><b>${esc(fa(order.orderNo||'—'))}</b></div></div></div><div class="inv38-rule"></div><div class="inv38-cust"><div><span>مشتری</span><b>${esc(invoice.customerName||'—')}</b></div><div><span>شماره تماس</span><b>${esc(fa(invoice.customerPhone||'—'))}</b></div><div><span>وضعیت</span><b>پیش از تحویل و تعیین تسویه</b></div></div><div class="inv38-table-scroll"><table class="inv38-table"><thead><tr><th>#</th><th>محصول</th><th>وزن ارسالی</th><th>فی</th><th>مبلغ</th></tr></thead><tbody>${lines.map((l,i)=>`<tr><td>${fa(String(i+1))}</td><td>${esc(l.productName||'—')}</td><td>${qty(l.deliveredKg)} کیلوگرم</td><td>${money(l.unitPrice)}</td><td>${money(l.amount)}</td></tr>`).join('')}</tbody></table></div><div class="inv38-bottom"><div class="inv38-total"><div class="inv38-total-box"><div><span>جمع اقلام</span><b>${money(invoice.subtotalAmount)}</b></div><div><span>تخفیف</span><b>${money(invoice.discountAmount)}</b></div><div><span>اضافات</span><b>${money(invoice.additionsAmount)}</b></div><div class="grand"><span>مبلغ پیش از مرجوعی</span><b>${money(invoice.totalAmount)}</b></div></div></div><div class="inv38-verify"><div class="inv38-verify-box"><div class="inv38-vitem"><span>امضای دستی مشتری پس از دریافت کالا</span><strong>${esc(invoice.customerName||'—')} – ${esc(fa(invoice.customerPhone||'—'))}</strong></div></div></div></div><p>این سند به‌تنهایی تأیید تحویل، امضا یا تسویه نیست.</p></div>`;
}
async function transportDraftPreview(id){
 try{const data=await api('/api/sales/transport-invoices/'+encodeURIComponent(id));openModal('فاکتور پیش از خروج',transportDraftInvoiceHtml(data,data.invoice)+`<div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">بستن</button><button type="button" class="btn btn-primary" data-ti-print>چاپ فاکتور</button></div>`);$('#modal [data-ti-print]').addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;const requested=await transportDraftPrint(id);button.disabled=false;if(requested&&app.page==='sales'&&app.sub.sales==='settlement'){closeModal();stlClose();app.salesDeliveryTab='assigned';await go('sales','delivery');}});BTPrintDigits.convert(document.querySelector('#modal .inv38-sheet'));}catch(e){toast(e.message);}
}
async function transportDraftPrint(id){
 try{const data=await api('/api/sales/transport-invoices/'+encodeURIComponent(id));return BTPrintFrame.html(BTPrintDigits.documentHtml(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/design.css"><link rel="stylesheet" href="/invoice-compact.css"><title>فاکتور ${esc(fa(data.invoice.invoiceNumber))}</title><style>body{margin:0;padding:12mm;font-family:"Vazirmatn",Tahoma,sans-serif}@page{size:A4;margin:0}</style></head><body>${transportDraftInvoiceHtml(data,data.invoice)}<script src="/print-ready.js"><\/script></body></html>`));}catch(e){toast(e.message);return false;}
}
// Keep return and financial closure inside the delivery cartable. Fetch a fresh
// order and ignore responses belonging to an already closed/replaced modal.
async function openTransportDeliveryWork(id){
 const notices=captureEntityNotices('order',id);
 openModal('فاکتور و بازگشت مدارک پخش','<div id="transportDeliveryWork" role="region">در حال دریافت اطلاعات سفارش…</div>');
 const host=$('#transportDeliveryWork');
 async function load(){
  if(!host?.isConnected)return;
  host.innerHTML='<div role="status">در حال دریافت اطلاعات سفارش…</div>';
  try{
   const data=await api('/api/orders/'+encodeURIComponent(id));
   if(!host.isConnected||$('#transportDeliveryWork')!==host)return;
   const order=data.order;
   if(!order||order.status!=='SETTLEMENT_PENDING'||!order.transportInvoice)throw Error('این فاکتور دیگر در مرحله کار پخش نیست.');
   let devices=[],devicesError=false;
   if(order.transportReturn){try{devices=(await api('/api/payment-devices')).devices||[];}catch(_){devicesError=true;}}
   if(!host.isConnected||$('#transportDeliveryWork')!==host)return;
   Object.assign(stl,{orderId:id,order,devices,devicesError});
   const done=async()=>{closeModal();stlReset();app.salesDeliveryTab='history';try{if(app.salesFetchPromise)await app.salesFetchPromise.catch(()=>{});const fresh=await fetchSalesCache(true);if(app.page==='sales'&&app.sub.sales==='delivery')paintSalesPaneV29('delivery',fresh);}catch(e){toast('فاکتور بسته شد اما نوسازی فهرست ناموفق بود.');}};
   transportSalesInvoicePanel(order,host,load,done);
   finishEntityNotices(notices);
   if(order.transportReturn){app.salesDeliveryTab='delivered';void fetchSalesCache(true).then(fresh=>{if(host.isConnected&&app.page==='sales'&&app.sub.sales==='delivery')paintSalesPaneV29('delivery',fresh);}).catch(()=>{});}
   return true;
  }catch(e){
   if(!host.isConnected||$('#transportDeliveryWork')!==host)return;
   host.innerHTML=`<div class="stl-load-error" role="alert"><b>اطلاعات پخش باز نشد.</b><span>${esc(e.message||'خطا در دریافت اطلاعات')}</span><button type="button" class="btn btn-secondary" data-tr-work-retry>تلاش دوباره</button></div>`;
   host.querySelector('[data-tr-work-retry]').onclick=load;
  }
 }
 return load();
}
function transportSalesInvoicePanel(order,host=$('#stlMain'),reload=()=>stlOpen(order.id),onClosed=null){
 const hand=order.transportHandovers?.['0'],invoice=order.transportInvoice;
 if(!hand){host.innerHTML='<section class="sd-panel sd-pad"><h2>فاکتور پخش</h2><p>در انتظار ثبت تحویل فیزیکی کالا به راننده در انبار.</p></section>';return;}
 if(invoice){
  const stage=order.transportReturn?transportClosureFormHtml(order):order.transportDeparture?transportReturnFormHtml(): '<p>فاکتور آماده چاپ است؛ تأیید خروج بر عهده ترابری است.</p>';
  const deviceWarning=order.transportReturn&&stl.devicesError?`<div class="stl-load-error" role="alert"><b>فهرست دستگاه‌های پوز دریافت نشد.</b><span>سایر روش‌های تسویه قابل استفاده‌اند؛ برای انتخاب پوز، فهرست دستگاه‌ها را دوباره دریافت کنید.</span><button type="button" class="btn btn-secondary btn-sm" data-ts-devices-retry>دریافت دوباره دستگاه‌ها</button></div>`:'';
  host.innerHTML=`<section class="sd-panel sd-pad tr-invoice-panel"><h2>فاکتور پخش ${esc(fa(invoice.invoiceNumber))}</h2>${transportOrderServiceHtml(order,false)}<button type="button" class="btn btn-secondary" data-ti-preview>${onClosed?'چاپ مجدد فاکتور':'پیش‌نمایش و چاپ فاکتور'}</button>${deviceWarning}${stage}</section>`;
  host.querySelector('[data-ti-preview]').onclick=()=>onClosed?transportDraftPrint(order.id):transportDraftPreview(order.id);
  if(order.transportReturn)bindTransportClosure(host,order,onClosed);else if(order.transportDeparture)bindTransportReturn(host,order,reload);
  return;
 }
 const lines=(hand.document?.items||[]).filter(i=>!i.outOfStock&&Number(i.deliveredKg)>0);
 host.innerHTML=`<section class="sd-panel sd-pad tr-invoice-panel"><h2>فاکتور پیش از خروج</h2><p>پس از ثبت، فاکتور هنوز تسویه‌شده یا تحویل‌شده نیست. قیمت اقلام را با دقت بررسی کنید.</p><form data-ti-form class="tr-form"><div class="tr-table-scroll"><table class="table tr-invoice-table"><thead><tr><th>محصول</th><th>وزن</th><th>قیمت هر کیلو (ریال)</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${esc(l.productName||'—')}</td><td>${qty(l.deliveredKg)}</td><td><input required inputmode="numeric" data-ti-price="${esc(l.itemId||'')}" data-ti-weight="${esc(String(l.deliveredKg))}" aria-label="قیمت ${esc(l.productName||'قلم')}" placeholder="ریال"></td></tr>`).join('')}</tbody></table></div><div class="tr-adjustments"><label class="tr-field"><span>تخفیف (ریال)</span><input name="discountAmount" inputmode="numeric" value="۰"></label><label class="tr-field"><span>اضافات (ریال)</span><input name="additionsAmount" inputmode="numeric" value="۰"></label></div><div class="tr-totals" data-ti-summary aria-live="polite">مبلغ پس از تکمیل قیمت‌ها نمایش داده می‌شود.</div><div class="modal-actions"><button type="submit" class="btn btn-primary">ثبت فاکتور پیش از خروج</button></div><p data-ti-error role="alert"></p></form></section>`;
 const form=host.querySelector('[data-ti-form]');const moneyInputs=[...form.querySelectorAll('[data-ti-price], [name=discountAmount], [name=additionsAmount]')];
 const recalc=()=>{
  const prices=[...form.querySelectorAll('[data-ti-price]')],raw=el=>transportMoneyNumber(el.value),summary=form.querySelector('[data-ti-summary]');
  if(prices.some(x=>!x.value.trim()||raw(x)===null||raw(x)<=0)||moneyInputs.some(x=>raw(x)===null)){summary.textContent='مبلغ پس از تکمیل قیمت‌های معتبر نمایش داده می‌شود.';return false;}
  const lineAmounts=prices.map(x=>Math.round(Number(x.dataset.tiWeight)*raw(x))),subtotal=lineAmounts.reduce((sum,x)=>sum+x,0),total=subtotal-raw(form.elements.discountAmount)+raw(form.elements.additionsAmount);
  if(moneyInputs.some(x=>raw(x)>1e12)||lineAmounts.some(x=>!Number.isSafeInteger(x)||x>1e12)||!Number.isSafeInteger(subtotal)||subtotal>1e12||!Number.isSafeInteger(total)||total<=0||total>1e12){summary.textContent='قیمت‌ها و مبلغ نهایی باید در محدوده مجاز باشند و مبلغ نهایی مثبت باشد.';return false;}
  summary.textContent=`جمع اقلام: ${money(subtotal)} • مبلغ فاکتور: ${money(total)}`;return true;
 };
 moneyInputs.forEach(input=>input.addEventListener('input',()=>{transportFormatMoneyInput(input);form.querySelector('[data-ti-error]').textContent='';recalc();}));
 form.onsubmit=async e=>{e.preventDefault();if(!recalc()){form.querySelector('[data-ti-error]').textContent='قیمت‌ها و مبالغ فاکتور را بررسی کنید.';return;}if(!confirm('قیمت‌ها و مبالغ فاکتور را بررسی کرده‌اید؟ این ثبت تسویه نیست.'))return;const button=form.querySelector('[type=submit]');button.disabled=true;try{const body={items:[...form.querySelectorAll('[data-ti-price]')].map(i=>({itemId:i.dataset.tiPrice,unitPrice:transportMoneyNumber(i.value)})),discountAmount:transportMoneyNumber(form.elements.discountAmount.value),additionsAmount:transportMoneyNumber(form.elements.additionsAmount.value)};await api('/api/sales/transport-invoices/'+encodeURIComponent(order.id),{method:'POST',body:JSON.stringify(body)});toast('فاکتور ثبت شد؛ پرداخت یا تحویل مشتری ثبت نشده است.');await stlOpen(order.id);}catch(err){form.querySelector('[data-ti-error]').textContent=err.message;button.disabled=false;}};
}
// Sales explicitly records the physical paperwork and then the financial close.
function transportReturnFormHtml(){return `<form data-ts-return class="tr-form tr-return-form"><h3>بازگشت مدارک راننده</h3><p>خروج به معنی دریافت توسط مشتری نیست. مدارک برگشتی را بررسی کنید.</p><label><input type="checkbox" name="documents" required> مدارک این سفارش به فروش بازگشته است.</label><div><label>نتیجه تحویل <select name="outcome" required><option value="">انتخاب کنید</option><option value="DELIVERED">تحویل به مشتری</option><option value="NOT_DELIVERED">تحویل‌نشده</option></select></label></div><label data-ts-signature hidden><input type="checkbox" name="signature"> امضای دستی مشتری روی سند کاغذی بررسی شد.</label><div><label>یادداشت <input name="note" maxlength="500"></label></div><button class="btn btn-primary" type="submit">ثبت بازگشت مدارک</button><p data-ts-error role="alert"></p></form>`;}
function bindTransportReturn(host,order,reload=()=>stlOpen(order.id)){
 const f=host.querySelector('[data-ts-return]'),sig=f.querySelector('[data-ts-signature]');
 f.elements.outcome.onchange=()=>{sig.hidden=f.elements.outcome.value!=='DELIVERED';if(sig.hidden)f.elements.signature.checked=false;};
 f.onsubmit=async e=>{e.preventDefault();if(!f.elements.documents.checked)return;if(f.elements.outcome.value==='DELIVERED'&&!f.elements.signature.checked){f.querySelector('[data-ts-error]').textContent='ابتدا امضای دستی مشتری روی سند بررسی و تأیید شود.';return;}if(!confirm('بازگشت مدارک و نتیجه انتخاب‌شده را ثبت می‌کنید؟'))return;const button=f.querySelector('[type=submit]');button.disabled=true;try{await api('/api/sales/transport-returns/'+encodeURIComponent(order.id),{method:'POST',body:JSON.stringify({documentsReturned:true,outcome:f.elements.outcome.value,customerSignatureOnPaper:f.elements.signature.checked,note:f.elements.note.value})});toast('بازگشت مدارک ثبت شد؛ فاکتور هنوز بسته نشده است.');await reload();}catch(err){f.querySelector('[data-ts-error]').textContent=err.message;button.disabled=false;}};
}
function transportClosureFormHtml(order){
 const notDelivered=order.transportReturn.outcome==='NOT_DELIVERED',lines=order.transportInvoice.priceLines||[];
 return `<form data-ts-close class="tr-form tr-close-form"><h3>مرجوعی و بستن فاکتور</h3><p>${notDelivered?'سفارش تحویل نشده است؛ همه اقلام باید مرجوع شوند.':'وزن و علت مرجوعی را بررسی کنید؛ اقلام بدون مرجوعی را صفر بگذارید.'}</p><div class="tr-table-scroll"><table class="table tr-return-table"><thead><tr><th>محصول</th><th>وزن ارسالی</th><th>مرجوعی (کیلوگرم)</th><th>علت</th></tr></thead><tbody>${lines.map(l=>`<tr data-ts-line data-id="${esc(l.itemId)}"><td>${esc(l.productName)}</td><td>${qty(l.deliveredKg)}</td><td><input data-ts-kg aria-label="وزن مرجوعی ${esc(l.productName)}" inputmode="decimal" value="${notDelivered?esc(fa(String(l.deliveredKg))):'۰'}" ${notDelivered?'readonly':''}></td><td><input data-ts-reason aria-label="علت مرجوعی ${esc(l.productName)}" maxlength="300"></td></tr>`).join('')}</tbody></table></div><p>مبلغ فاکتور پیش از مرجوعی: <b>${money(order.transportInvoice.totalAmount)}</b> — قابل تسویه پس از مرجوعی: <b data-ts-total>—</b></p><p>در مرجوعی کامل مبلغ فاکتور صفر می‌شود؛ در مرجوعی جزئی کسر تا سقف مبلغ فاکتور است. چک تا زمان وصول، پرداخت‌شده محسوب نمی‌شود.</p><h4>روش‌های تسویه</h4><p>برای هر دریافتی یا معوق یک ردیف وارد کنید. هیچ مبلغی به‌صورت خودکار دریافت تلقی نمی‌شود.</p><div data-ts-payments></div><button type="button" class="btn btn-secondary" data-ts-add>افزودن روش تسویه</button><p data-ts-sum aria-live="polite"></p><label><input type="checkbox" name="checked" required> مرجوعی‌ها، وجوه، رسیدها و روش‌های تسویه را بررسی کردم.</label><div class="modal-actions"><button type="submit" class="btn btn-primary">بستن فاکتور</button></div><p data-ts-error role="alert"></p></form>`;
}
function transportClosureAmount(invoice,rows){
 if(rows.length!==(invoice.priceLines||[]).length)return null;
 let returned=0,all=true;
 for(let i=0;i<rows.length;i++){
  const raw=en(String(rows[i]??'')).trim().replace(/٫/g,'.');if(!/^\d+(?:\.\d{1,3})?$/.test(raw))return null;
  const kg=Number(raw),line=invoice.priceLines[i];if(!Number.isFinite(kg)||kg<0||kg>Number(line.deliveredKg))return null;
  if(kg!==Number(line.deliveredKg))all=false;returned+=Math.round(kg*Number(line.unitPrice));
 }
 return Number(invoice.totalAmount)-(all?Number(invoice.totalAmount):Math.min(returned,Number(invoice.totalAmount)));
}
// Format only valid digits and grouping; invalid characters remain visible and block submission.
function transportMoneyNumber(value){const text=en(String(value??'')).trim();if(!text)return 0;if(!/^[0-9,٬\s]+$/.test(text))return null;const digits=text.replace(/[,٬\s]/g,'');if(!digits)return null;const n=Number(digits);return Number.isSafeInteger(n)?n:null;}
function transportFormatMoneyInput(input){const raw=en(input.value),caret=input.selectionStart??raw.length;if(!/^[0-9,٬\s]*$/.test(raw)){input.setCustomValidity('فقط عدد معتبر وارد کنید.');return;}input.setCustomValidity('');const before=raw.slice(0,caret).replace(/\D/g,'').length,digits=raw.replace(/\D/g,'');input.value=fa(digits.replace(/\B(?=(\d{3})+(?!\d))/g,'٬'));let pos=0,count=0;while(pos<input.value.length&&count<before){if(/[0-9]/.test(en(input.value[pos])))count++;pos++;}input.setSelectionRange(pos,pos);}
function transportPaymentRowHtml(devices){return `<div data-ts-payrow class="stl-payment-row tr-payment-row"><label class="tr-field"><span>روش</span><select data-ts-type><option value="CASH">نقدی</option><option value="POS">پوز</option><option value="CARD_TRANSFER">کارت‌به‌کارت</option><option value="CHECK">چک</option><option value="CREDIT">معوق</option></select></label><label class="tr-field"><span>مبلغ (ریال)</span><input data-ts-amount inputmode="numeric" required></label><div data-ts-extra hidden></div><button type="button" class="btn btn-secondary btn-sm" data-ts-remove>حذف</button></div>`;}

function bindTransportClosure(host,order,onClosed=null){
 const f=host.querySelector('[data-ts-close]'),invoice=order.transportInvoice,devices=stl.devices||[],paymentHost=f.querySelector('[data-ts-payments]');
 const retryDevices=host.querySelector('[data-ts-devices-retry]');
 if(retryDevices)retryDevices.onclick=async()=>{
  retryDevices.disabled=true;
  try{
   const data=await api('/api/payment-devices');if(!host.isConnected||stl.orderId!==order.id)return;
   devices.splice(0,devices.length,...(data.devices||[]));stl.devicesError=false;
   f.querySelectorAll('[data-ts-device]').forEach(select=>{const previous=select.value;select.innerHTML='<option value="">انتخاب کنید</option>'+devices.filter(d=>d.isActive!==false).map(d=>`<option value="${esc(d.id)}">${esc(d.title)} — ${esc(d.bank||'')}</option>`).join('');select.value=previous;});
   retryDevices.closest('.stl-load-error')?.remove();
  }catch(err){toast(err.message||'دریافت دستگاه‌ها ناموفق بود.');retryDevices.disabled=false;}
 };
 const recalc=()=>{const lines=[...f.querySelectorAll('[data-ts-line]')],total=transportClosureAmount(invoice,lines.map(r=>r.querySelector('[data-ts-kg]').value));f.querySelector('[data-ts-total]').textContent=total===null?'وزن مرجوعی نامعتبر است':money(total);const sum=f.querySelector('[data-ts-sum]');if(sum){const rows=[...f.querySelectorAll('[data-ts-payrow]')],values=rows.map(r=>transportMoneyNumber(r.querySelector('[data-ts-amount]')?.value));sum.textContent=values.some(x=>x===null)?'مبلغ روش تسویه نامعتبر است.':`جمع روش‌های تسویه: ${money(values.reduce((a,b)=>a+b,0))}${total===null?'':` • اختلاف با مبلغ قابل تسویه: ${money(total-values.reduce((a,b)=>a+b,0))}`}`;}return total;};
 const details=row=>{const type=row.querySelector('[data-ts-type]').value,box=row.querySelector('[data-ts-extra]');let h='';if(type==='POS')h=`<label class="tr-field"><span>دستگاه پوز</span><select data-ts-device><option value="">انتخاب کنید</option>${devices.filter(d=>d.isActive!==false).map(d=>`<option value="${esc(d.id)}">${esc(d.title)} — ${esc(d.bank||'')}</option>`).join('')}</select></label><label class="tr-field"><span>شماره پیگیری</span><input data-ts-reference></label>`;if(type==='CARD_TRANSFER')h='<label class="tr-field"><span>بانک مقصد</span><input data-ts-bank></label><label class="tr-field"><span>شناسه پیگیری</span><input data-ts-reference></label>';if(type==='CHECK')h='<label class="tr-field"><span>بانک</span><input data-ts-bank></label><label class="tr-field"><span>شماره چک</span><input data-ts-check></label><label class="tr-field"><span>تاریخ سررسید</span><input type="date" data-ts-due></label>';box.innerHTML=h;box.hidden=!h;};
 f.querySelectorAll('[data-ts-kg]').forEach(el=>el.addEventListener('input',recalc));
 f.querySelector('[data-ts-add]').onclick=()=>{if(paymentHost.querySelectorAll('[data-ts-payrow]').length>=20)return toast('حداکثر ۲۰ ردیف تسویه مجاز است.');paymentHost.insertAdjacentHTML('beforeend',transportPaymentRowHtml(devices));const row=paymentHost.lastElementChild;row.querySelector('[data-ts-type]').onchange=()=>details(row);row.querySelector('[data-ts-amount]').oninput=e=>{transportFormatMoneyInput(e.target);recalc();};row.querySelector('[data-ts-remove]').onclick=()=>{row.remove();recalc();};recalc();};
 f.onsubmit=async e=>{e.preventDefault();const total=recalc(),error=f.querySelector('[data-ts-error]');if(total===null){error.textContent='وزن مرجوعی را بررسی کنید.';return;}const rows=[...f.querySelectorAll('[data-ts-payrow]')],methods=rows.map(row=>{const v=k=>row.querySelector('[data-ts-'+k+']')?.value||'';return {type:v('type'),amount:transportMoneyNumber(v('amount')),deviceId:v('device'),reference:v('reference'),bank:v('bank'),checkNumber:v('check'),dueDate:v('due')};});if(total>0&&!methods.length){error.textContent='برای مبلغ قابل تسویه حداقل یک روش مشخص کنید.';return;}if(total===0&&methods.length){error.textContent='برای مبلغ صفر، ردیف تسویه ثبت نکنید.';return;}if(methods.some(m=>m.amount===null||m.amount<1||m.amount>1e12)){error.textContent='مبلغ هر روش باید عدد صحیح بین ۱ و ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ ریال باشد.';return;}if(methods.reduce((sum,m)=>sum+m.amount,0)!==total){error.textContent='جمع روش‌های تسویه باید دقیقاً برابر مبلغ قابل تسویه باشد.';return;}if(methods.some(m=>m.type==='POS'&&!m.deviceId)){error.textContent='دستگاه پوز فعال را انتخاب کنید.';return;}if(methods.some(m=>m.type==='CARD_TRANSFER'&&(!m.bank.trim()||!m.reference.trim()))){error.textContent='بانک مقصد و شناسه پیگیری کارت‌به‌کارت الزامی است.';return;}if(methods.some(m=>m.type==='CHECK'&&(!m.bank.trim()||!m.checkNumber.trim()||!m.dueDate))){error.textContent='بانک، شماره و تاریخ سررسید چک الزامی است.';return;}if(!f.elements.checked.checked)return;if(!confirm('فاکتور با مرجوعی و روش‌های تسویه ثبت‌شده بسته شود؟ این عملیات قابل بازگشت نیست.'))return;
  const returns=[...f.querySelectorAll('[data-ts-line]')].map(row=>({itemId:row.dataset.id,returnKg:en(row.querySelector('[data-ts-kg]').value).trim().replace(/٫/g,'.'),reason:row.querySelector('[data-ts-reason]').value}));const button=f.querySelector('[type=submit]');button.disabled=true;try{await api('/api/sales/transport-invoices/'+encodeURIComponent(order.id)+'/close',{method:'POST',body:JSON.stringify({returns,settlementMethods:methods})});toast('فاکتور بسته شد؛ معوق و چک‌های وصول‌نشده جداگانه پیگیری می‌شوند.');if(app.salesCache)app.salesCache.fetchedAt=0;if(onClosed)await onClosed();else{stlClose();await renderSales('settlement');}}catch(err){error.textContent=err.message;button.disabled=false;}};
 recalc();
}
function invoiceHtml(o,paySel){
  const p=paySel||o.payment||{};
  const pickupDoc=o.pickupHandover?.document;
  const signatureContact=pickupDoc?.recipient?esc(pickupDoc.recipient.name||'—')+' – '+esc(pickupDoc.recipient.phone||'—'):esc((p.customerName ?? o.customer?.name) || '—')+' – '+esc((p.customerPhone ?? o.customer?.phone) || '—');
  if(o.orderType==='STORE'){ // v37.6.0 — سند تحویل وزنی فروشگاه (بدون هیچ مبلغی)
    const run=p.deliveryRun||null;
    const lines=storeRunInvoiceLines(o,p); // v37.17.0 — فقط اقلام و وزن همان سرویس
    const totalKg=lines.reduce((sum,x)=>sum+Number(x.deliveredKg??0),0);
    return `<div class="inv38-sheet inv38-compact"><div class="inv38-head"><div class="inv38-brand"><img src="/logo.png" alt="بابل طیور"><div><b>بابل طیور</b><span>سند تحویل وزنی فروشگاه — بدون مبلغ</span></div></div><div class="inv38-meta"><div><span>شماره سند</span><b>${esc(fa(p.invoiceNumber||'—'))}</b></div><div><span>تاریخ ثبت</span><b>${esc(dt(p.verifiedAt||o.createdAt))}</b></div><div><span>شماره سفارش</span><b>${esc(fa(o.orderNo||'—'))}${run?` · سرویس ${run===2?'دوم':'اول'}`:''}</b></div></div></div><div class="inv38-rule"></div><div class="inv38-cust"><div><span>فروشگاه</span><b>${esc(o.storeName||'—')}</b></div><div><span>محل تحویل</span><b>${esc(o.dispatchPlace||'—')}</b></div><div><span>وضعیت</span><b>سند وزنی — خارج از مسیر پرداخت</b></div></div><div class="inv38-table-scroll" role="region" tabindex="0"><table class="inv38-table"><thead><tr><th>#</th><th>محصول</th><th>وزن تحویلی</th></tr></thead><tbody>${lines.map((i,k)=>`<tr><td>${fa(String(k+1))}</td><td><b>${esc(i.productName||'—')}</b></td><td>${qty(i.deliveredKg)} کیلوگرم</td></tr>`).join('')}</tbody></table></div><div class="inv38-bottom"><div class="inv38-total"><div class="inv38-total-box"><div><span>جمع وزن محموله</span><b>${qty(totalKg)} کیلوگرم</b></div><div class="grand"><span>نوع سند</span><b>سند تحویل وزنی</b></div><div style="margin-top:6px"><small>این سند صرفاً وزن تحویل‌شده را اعلام می‌کند و ارزش ریالی ندارد.</small></div></div></div><div class="inv38-verify"><div class="inv38-verify-box"><div class="inv38-verify-grid"><div class="inv38-vitem"><span>امضاء</span><strong>${signatureContact}</strong></div></div></div></div></div></div>`;
  }
  const items=o.transportWorkflow===1&&Array.isArray(o.transportInvoice?.priceLines)?o.transportInvoice.priceLines.map(l=>({product:{name:l.productName},deliveredKg:l.deliveredKg,unitPrice:l.unitPrice,finalAmount:l.amount})):(o.items||[]).filter(i=>i.itemStatus!=='CANCELLED').map(i=>{const snap=pickupDoc?.items?.find(x=>x.itemId===i.id);return snap?{...i,product:{...i.product,name:snap.productName}}:i;});
  const subtotal=items.reduce((sum,i)=>sum+n(i.finalAmount),0);
  const returns=Math.max(0,n(p.returnDeduction||0));
  const difference=n(p.totalAmount)-subtotal+returns;
  const discount=p.discountAmount != null ? n(p.discountAmount) : Math.max(0,-difference);
  const additions=p.additionsAmount != null ? n(p.additionsAmount) : Math.max(0,difference);
  const customerName=esc((pickupDoc?.customerName ?? p.customerName ?? o.customer?.name)||'—');const customerPhone=esc((pickupDoc?.customerPhone ?? p.customerPhone ?? o.customer?.phone)||'—');
  const recipient=pickupDoc?.recipient||null;
  const recipientInfo=recipient?`<div class="inv38-cust"><div><span>تحویل‌گیرنده</span><b>${esc(recipient.name||'—')}</b></div><div><span>تماس تحویل‌گیرنده</span><b dir="ltr">${esc(recipient.phone||'—')}</b></div><div><span>وسیله / پلاک</span><b>${esc([recipient.vehicleType,recipient.carType,recipient.plate].filter(Boolean).join(' — ')||'—')}</b></div></div>`:'';
  const settleLabels=Object.assign(Object.create(null),{CASH:'نقدی',POS:'پوز',CARD_TRANSFER:'کارت‌به‌کارت',CHECK:'چک',CREDIT:'معوق'});
  const methods=Array.isArray(p.settlementMethods)?p.settlementMethods:[];
  const amountKnown=v=>(typeof v==='number'||typeof v==='string')&&String(v).trim()!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0;
  const methodsComplete=methods.length>0&&methods.every(m=>m&&settleLabels[String(m.type||'').toUpperCase()]&&amountKnown(m.amount));
  const types=[...new Set(methods.map(m=>String(m?.type||'').toUpperCase()).filter(Boolean))];
  const due=amountKnown(p.amountDue)?Number(p.amountDue):(!p.deposit&&(p.depositAmount==null||Number(p.depositAmount)===0)&&amountKnown(p.totalAmount)?Number(p.totalAmount):null);
  const depositOnly=Array.isArray(p.settlementMethods)&&methods.length===0&&due===0&&Number(p.depositAmount)>0;
  const noCollection=o.transportWorkflow===1&&Number(p.totalAmount)===0&&methods.length===0;
  const settlementKind=noCollection?'بدون دریافتی؛ مرجوعی کامل':types.length>1?'ترکیبی':types.length===1?(settleLabels[types[0]]||'نامشخص'):(depositOnly?'از محل بیعانه':(settleLabels[p.settlementType]||'ثبت نشده'));
  const credit=noCollection?0:methodsComplete?methods.reduce((sum,m)=>sum+(String(m.type).toUpperCase()==='CREDIT'?Number(m.amount):0),0):(depositOnly?0:null);
  const account=p.debtAccount;
  const paid=account&&Array.isArray(account.receipts)&&account.receipts.every(r=>r&&amountKnown(r.amount)&&['CLEARED','PENDING','RETURNED','REVERSED'].includes(r.status))?account.receipts.filter(r=>r.status==='CLEARED').reduce((sum,r)=>sum+Number(r.amount),0):null;
  const current=account&&amountKnown(account.initial)&&paid!==null&&paid<=Number(account.initial)?Number(account.initial)-paid:null;
  const recordedSum=methodsComplete?methods.reduce((sum,m)=>sum+Number(m.amount),0):null;
  const paymentRows=methods.map(m=>{
    m=m||{};const type=String(m.type||'').toUpperCase();
    const details=[m.deviceSnapshot?.title?`دستگاه ${m.deviceSnapshot.title}`:'',m.deviceSnapshot?.bank?`بانک ${m.deviceSnapshot.bank}`:'',m.bank?`بانک ${m.bank}`:'',m.reference?`پیگیری ${m.reference}`:'',m.checkNumber?`شماره چک ${m.checkNumber}`:'',m.dueDate?`سررسید ${m.dueDate}`:'',type==='CHECK'?({PENDING:'در انتظار وصول',CLEARED:'وصول شد',RETURNED:'برگشتی',REVERSED:'وصول ابطال‌شده'}[m.checkStatus]||''):'',type!=='CREDIT'&&m.reason?`علت ${m.reason}`:''].filter(Boolean).join(' • ');
    return `<div class="inv38-payment-row"><div><span>${esc(settleLabels[type]||type||'نامشخص')}</span>${details?`<small>${esc(details)}</small>`:''}</div><b>${amountKnown(m.amount)?money(m.amount):'نامشخص'}</b></div>`;
  }).join('');
  const paymentBox=`<section class="inv38-payment-box" aria-label="روش‌های تسویه"><h3>روش‌های تسویه</h3><div class="inv38-payment-row"><span>نوع تسویه</span><b>${esc(settlementKind)}</b></div>${due!==null?`<div class="inv38-payment-row"><span>قابل تسویه</span><b>${money(due)}</b></div>`:''}${paymentRows||`<div class="inv38-payment-empty">${noCollection?'مبلغ پس از مرجوعی صفر است؛ دریافتی ثبت نشده است.':depositOnly?'تمام مبلغ از بیعانه لحاظ‌شده تأمین شده است.':'جزئیات روش پرداخت ثبت نشده است.'}</div>`}<div class="inv38-payment-row inv38-payment-balance"><span>${account?'مانده معوق':'معوق'}</span><b>${account?(current===null?'نامشخص':money(current)):(credit===null?'نامشخص':money(credit))}</b></div>${recordedSum!==null&&due!==null&&recordedSum!==due?'<small class="inv38-payment-note">جمع روش‌های ثبت‌شده با مبلغ قابل تسویه یکسان نیست؛ بررسی لازم است.</small>':''}</section>`;
  return `<div class="inv38-sheet inv38-compact">
  <div class="inv38-head">
    <div class="inv38-sales-title">فاکتور فروش و تحویل</div>
    <div class="inv38-meta"><div><span>شماره فاکتور</span><b>${esc(fa(p.invoiceNumber||'—'))}</b></div><div><span>${o.transportWorkflow===1&&o.deliveryMode!=='PICKUP'?'تاریخ بستن فاکتور':'تاریخ تسویه'}</span><b>${esc(dt(p.verifiedAt||o.createdAt))}</b></div><div><span>شماره سفارش</span><b>${esc(fa(o.orderNo||'—'))}</b></div></div>
  </div>
  <div class="inv38-rule"></div>
  <div class="inv38-cust"><div><span>مشتری</span><b>${customerName}</b></div><div><span>شماره تماس</span><b class="inv38-phone" dir="ltr">${customerPhone}</b></div><div><span>وضعیت</span><b>${o.transportWorkflow===1&&o.deliveryMode!=='PICKUP'?(o.transportReturn?.outcome==='NOT_DELIVERED'?'تحویل‌نشده؛ فاکتور بسته شده':'فاکتور بسته شده؛ وضعیت مالی در روش‌های تسویه'):'تسویه نهایی و آماده خروج'}</b></div></div>
  ${recipientInfo}
  <p class="inv38-scroll-hint">برای مشاهده همه ستون‌های اقلام، جدول را افقی پیمایش کنید.</p><div class="inv38-table-scroll" role="region" aria-label="اقلام فاکتور؛ برای مشاهده همه ستون‌ها افقی پیمایش کنید" tabindex="0"><table class="inv38-table"><thead><tr><th>#</th><th>محصول</th><th>وزن تحویلی</th><th>فی</th><th>مبلغ</th></tr></thead><tbody>${items.map((i,k)=>`<tr><td>${fa(String(k+1))}</td><td><b>${esc(i.product?.name||'—')}</b></td><td>${qty(i.deliveredKg)} کیلوگرم</td><td>${money(i.unitPrice)}</td><td>${money(i.finalAmount)}</td></tr>`).join('')}</tbody></table></div>
  <div class="inv38-bottom inv38-with-payments"><div class="inv38-total"><div class="inv38-total-box"><div><span>جمع اقلام</span><b>${money(subtotal)}</b></div><div><span>تخفیفات</span><b>${money(discount)}</b></div><div><span>اضافات</span><b>${money(additions)}</b></div>${returns?`<div><span>کسر مرجوعی</span><b>${money(returns)}</b></div>`:''}${p.deposit?`<div><span>بیعانه دریافت‌شده (${esc(({CASH:'نقدی',POS:'پوز',CARD_TRANSFER:'کارت‌به‌کارت'})[p.deposit?.type]||'')})${p.deposit?.reference?` • پیگیری ${esc(p.deposit.reference)}`:''}</span><b>${money(p.deposit.amount)}</b></div>${p.deposit.refundedAmount?`<div><span>استرداد دستی بیعانه</span><b>${money(p.deposit.refundedAmount)}</b></div><div><span>بیعانه لحاظ‌شده</span><b>${money(p.depositAmount)}</b></div>`:''}<div><span>مانده پس از کسر بیعانه (پیش از تسویه)</span><b>${amountKnown(p.amountDue)?money(p.amountDue):'نامشخص'}</b></div>`:''}<div class="grand"><span>مبلغ نهایی</span><b>${money(p.totalAmount)}</b></div></div></div>
  ${paymentBox}
  <div class="inv38-verify">
    <div class="inv38-verify-box"><div class="inv38-verify-grid"><div class="inv38-vitem"><span>${recipient?'امضاء تحویل‌گیرنده':'امضاء'}</span><strong>${signatureContact}</strong></div></div></div>
  </div>
  </div>
  </div>`;
}
async function printInvoice(id,run){return openInvoicePrint(id,run)}

/* ---------------- چاپ گزارش مدیریتی (v38) ---------------- */
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action="rp38-print"]'); if(!el)return;
  try{
    const d=await api('/api/reports'); const remote=d.remote||{};
    BTPrintFrame.html(BTPrintDigits.documentHtml(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts.css"><title>گزارش مدیریتی بابل طیور</title><link rel="stylesheet" href="/design.css"><style>html{background:#fff}body{margin:0;padding:22px;background:#fff}@media print{body{padding:0}}</style></head><body>
    <div class="inv38-sheet">
      <div class="rpt38-head"><div class="inv38-brand"><img src="/logo.png" alt="بابل طیور"><div><h1>گزارش مدیریتی بابل طیور</h1><p>${esc(todayText())} • سامانه یکپارچه عملیات مشتریان</p></div></div></div>
      <div class="inv38-rule"></div>
      <div class="rpt38-kpis">
        <div><span>ورودی امروز</span><strong>${qty(d.gate?.today||0)}</strong></div>
        <div><span>سفارش‌های امروز</span><strong>${qty(d.sales?.todayOrders||0)}</strong></div>
        <div><span>درآمد ثبت‌شده</span><strong>${esc(moneyCompact(d.finance?.revenue||0))}</strong></div>
        <div><span>غیرحضوری آینده</span><strong>${qty(remote.scheduled||0)}</strong></div>
      </div>
      <h2 class="rpt38-h2">برنامه سفارش‌های غیرحضوری</h2>
      <table class="rpt38-table"><thead><tr><th>تاریخ</th><th>تعداد سفارش</th></tr></thead><tbody>${(remote.byDate||[]).map(x=>`<tr><td>${esc(dateLabel(x.date))}</td><td>${qty(x.count)}</td></tr>`).join('')||'<tr><td colspan="2">موردی ثبت نشده است.</td></tr>'}</tbody></table>
      <h2 class="rpt38-h2">ورودی بر اساس محله</h2>
      <table class="rpt38-table"><thead><tr><th>محله</th><th>تعداد مراجعه</th></tr></thead><tbody>${(d.gate.byDistrict||[]).map(x=>`<tr><td>${esc(x.district)}</td><td>${qty(x.count)}</td></tr>`).join('')||'<tr><td colspan="2">موردی ثبت نشده است.</td></tr>'}</tbody></table>
      <div class="inv38-foot">بابل طیور • گزارش داخلی • ${esc(todayText())}</div>
    </div>
    <script src="/print-ready.js"><\/script></body></html>`));
    }catch(err){toast(err.message)}
});
