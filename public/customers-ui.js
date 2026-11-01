/* ============================================================
   پرونده مشتریان — هر مشتری «کد مشتری» ثابت دارد.
   نگهبانی (ورود با کد/تلفن/پلاک) و فروش و فروشگاه همه به همین پرونده وصل می‌شوند.
   ============================================================ */
const CUST_VEHICLES = ['خودرو', 'موتورسیکلت', 'وانت', 'بدون وسیله'];
const custUi = { q: '', timer: null, rows: [] };

/* fallback plateViewHtml */
if(typeof plateViewHtml === 'undefined'){
  function plateViewHtml(value, fallback='—', compact=false){
    const raw=String(value||'').trim();
    if(!raw) return `<span style="color:var(--muted);font-size:12px;font-weight:700">${typeof admE==='function'?admE(fallback):typeof custEsc==='function'?custEsc(fallback):fallback}</span>`;
    let a='',letter='',c='',prov='';
    try{ if(typeof parsePlate==='function'){ const pr=parsePlate(raw); a=pr.a||''; letter=pr.letter||''; c=pr.c||''; prov=pr.province||''; } else throw 0; } catch(e){
      const m=raw.match(/(\d{1,2})\s*([^\d\s\-\.]+)?\s*(\d{1,3})?\s*[-\s]*\s*(\d{1,2})?/);
      if(m){ a=m[1]||''; letter=m[2]||''; c=m[3]||''; prov=m[4]||''; } else { a=raw; }
    }
    const escFn = typeof admE==='function' ? admE : typeof custEsc==='function' ? custEsc : (typeof esc==='function'?esc:(v=>String(v||'')));
    const cls = compact ? 'iran-plate is-readonly is-compact' : 'iran-plate is-readonly';
    return `<div class="${cls}" style="display:inline-grid;vertical-align:middle" dir="ltr"><div class="blue-strip"><span>IR<br>ایران</span></div><div class="plate-part"><span>${escFn(a)}</span></div><div class="plate-part"><span>${escFn(letter)}</span></div><div class="plate-part"><span>${escFn(c)}</span></div><div class="plate-part plate-code"><span>${escFn(prov)}</span></div></div>`;
  }
}

function custEsc(v) { return esc(v == null ? '' : String(v)); }

async function renderCustomers() {
  const c = $('#content');
  c.innerHTML = `<section class="sd-panel cust-panel">
    <div class="sd-head">
      <div class="sd-head-main"><span class="sd-head-ico">${icon('user', 20)}</span>
        <div><h2>پرونده مشتریان</h2><p>هر مشتری یک کد ثابت دارد. مراجعه‌ی بعدی با کد، شماره تماس یا پلاک به همین پرونده وصل می‌شود و نیازی به ثبت دوباره نیست.</p></div></div>
      <div class="sd-count"><strong id="custTotal">${fa(0)}</strong><span>مشتری</span></div>
    </div>
    <div class="cust-toolbar">
      <div class="input-shell cust-search"><span>${icon('search', 16)}</span><input id="custSearch" aria-label="جستجوی مشتری با کد، نام، تلفن، پلاک یا کد ملی" value="${custEsc(custUi.q)}" placeholder="جستجو: کد، نام، تلفن، پلاک، کد ملی" autocomplete="off"></div>
      <button class="btn btn-primary" type="button" data-action="cust-new">${icon('plus', 16)} مشتری جدید</button>
    </div>
    <div id="custList" class="cust-list"><div class="sd-queue-empty">در حال بارگذاری…</div></div>
  </section>`;
  $('#custSearch').addEventListener('input', (e) => {
    clearTimeout(custUi.timer);
    custUi.q = e.target.value;
    custUi.timer = setTimeout(custLoad, 220);
  });
  c.onclick = custClick;
  await custLoad();
}

async function custLoad() {
  const list = $('#custList');
  if (!list) return;
  try {
    const d = await api('/api/customers?limit=300&q=' + encodeURIComponent(custUi.q.trim()));
    custUi.rows = d.customers || [];
    const total = $('#custTotal'); if (total) total.textContent = fa(d.total || 0);
    list.innerHTML = custUi.rows.length ? custUi.rows.map(custRowHtml).join('')
      : sdEmpty('user', 'مشتری پیدا نشد', custUi.q ? 'عبارت جستجو را تغییر دهید یا مشتری جدید ثبت کنید.' : 'با «مشتری جدید» اولین پرونده را بسازید.');
  } catch (err) { list.innerHTML = `<div class="form-error">${custEsc(err.message)}</div>`; }
}

function custRowHtml(c) {
  const plate = c.plate ? `${plateViewHtml(c.plate, '—', true)}` : '';
  const district = c.district ? `<span class="sd-chip">${custEsc(c.district)}</span>` : '';
  return `<article class="cust-row" data-action="cust-open" data-id="${custEsc(c.id)}" role="button" tabindex="0">
    <span class="cust-code">${custEsc(c.code)}</span>
    <span class="cust-main"><strong>${custEsc(c.name)}</strong><small>${custEsc(c.phone || '—')}</small></span>
    <span class="cust-chips">${plate}${district}</span>
    <span class="cust-stats"><small>${fa(c.visitCount || 0)} مراجعه • ${fa(c.orderCount || 0)} سفارش</small><small>${c.lastActivityAt ? dt(c.lastActivityAt) : 'بدون فعالیت'}</small></span>
    <span class="cust-open">${icon('arrow', 16)}</span>
  </article>`;
}

function custClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'cust-new') return custForm(null);
  if (a === 'cust-open') return custDetail(el.dataset.id);
}

// فرم ثبت/ویرایش. c=null یعنی مشتری جدید.
function custFormHtml(c) {
  const v = (k) => custEsc(c?.[k] || '');
  const vt = c?.vehicleType || 'بدون وسیله';
  return `<form id="custForm" class="cust-form" data-id="${custEsc(c?.id || '')}">
    <div class="cust-form-grid">
      <label class="cust-field cust-span2"><span>نام و نام خانوادگی *</span><input name="name" required maxlength="120" value="${v('name')}"></label>
      <label class="cust-field"><span>شماره تماس *</span><input name="phone" required inputmode="tel" maxlength="30" value="${v('phone')}"></label>
      <label class="cust-field"><span>شماره دوم</span><input name="phone2" inputmode="tel" maxlength="30" value="${v('phone2')}"></label>
      <label class="cust-field"><span>کد ملی</span><input name="nationalId" inputmode="numeric" maxlength="10" value="${v('nationalId')}"></label>
      <label class="cust-field"><span>نوع وسیله</span><select name="vehicleType">${CUST_VEHICLES.map((x) => `<option ${x === vt ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <div class="cust-field"><span>پلاک</span>${plateEditorHtml(c?.plate||'',vt)}</div>
      <label class="cust-field"><span>محله</span><input name="district" maxlength="100" value="${v('district')}"></label>
      <label class="cust-field cust-span2"><span>شرکت / واحد</span><input name="company" maxlength="120" value="${v('company')}"></label>
      <label class="cust-field cust-span2"><span>نشانی</span><input name="address" maxlength="250" value="${v('address')}"></label>
      <label class="cust-field cust-span2"><span>یادداشت</span><textarea name="notes" rows="2" maxlength="1000">${v('notes')}</textarea></label>
    </div>
    <div id="custMsg" class="form-error"></div>
    <div class="cust-form-actions">
      <button class="btn btn-secondary" type="button" data-cust-cancel>انصراف</button>
      <button class="btn btn-primary" type="submit">${c ? 'ذخیره تغییرات' : 'ثبت مشتری و صدور کد'}</button>
    </div>
  </form>`;
}

function custForm(c) {
  openModal(c ? `ویرایش مشتری ${c.code}` : 'مشتری جدید', custFormHtml(c));
  const f = $('#custForm');
  bindPlateEditor(f);
  f.addEventListener('submit', (e) => custSubmit(e, c));
  f.querySelector('[data-cust-cancel]').addEventListener('click', () => (c ? custDetail(c.id) : closeModal()));
}

async function custSubmit(e, c) {
  e.preventDefault();
  const form = e.target;
  const body = Object.fromEntries(new FormData(form));
  const msg = $('#custMsg');
  try {
    body.plate = plateEditorValue(form);
    if(c && form.querySelector('[data-plate-editor]').dataset.dirty!=='1') delete body.plate;
    const d = c
      ? await api('/api/customers/' + c.id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/api/customers', { method: 'POST', body: JSON.stringify(body) });
    toast(c ? 'پرونده مشتری به‌روز شد.' : `مشتری ثبت شد؛ کد مشتری: ${d.customer.code}`);
    await custLoad();
    await custDetail(d.customer.id);
  } catch (err) { if (msg) msg.textContent = err.message; }
}

async function custDetail(id) {
  try {
    const d = await api('/api/customers/' + id);
    const c = d.customer;
    const row = (label, val) => `<div class="cust-kv"><small>${label}</small><b>${custEsc(val || '—')}</b></div>`;
    const visits = (d.visits || []).map((v) => `<li><span>${dt(v.createdAt)}</span><b>${custEsc(v.purpose || 'مراجعه')}</b><small>${custEsc(v.district || '')}</small></li>`).join('');
    const orders = (d.orders || []).map((o) => `<li><span>${dt(o.createdAt)}</span><b>${custEsc(o.orderNo || '')}</b><small>${custEsc(o.orderType || '')} • ${custEsc(o.status || '')}</small></li>`).join('');
    openModal(`پرونده مشتری — ${c.code}`, `<div class="cust-detail">
      <div class="cust-hero"><span class="cust-code cust-code-lg">${custEsc(c.code)}</span>
        <div><strong>${custEsc(c.name)}</strong><small>${custEsc(c.phone || '')}</small></div>
        <button class="btn btn-secondary btn-sm" type="button" data-cust-edit>${icon('edit', 14)} ویرایش</button>${normalizeRole(app.user?.roleCode) === 'admin' ? `<button class="btn btn-secondary btn-sm" type="button" data-cust-delete>${icon('trash', 14)} حذف</button>` : ''}</div>
      <div class="cust-kv-grid">
        ${row('شماره دوم', c.phone2)}${row('کد ملی', c.nationalId)}<div class="cust-kv"><small>پلاک</small><div>${plateViewHtml(c.plate, '—', true)}</div></div>${row('نوع وسیله', c.vehicleType)}
        ${row('محله', c.district)}${row('شرکت / واحد', c.company)}${row('نشانی', c.address)}${row('یادداشت', c.notes)}
      </div>
      <div class="cust-history">
        <div><h4>آخرین مراجعه‌ها (${fa((d.visits || []).length)})</h4><ul>${visits || '<li class="cust-none">مراجعه‌ای ثبت نشده است.</li>'}</ul></div>
        <div><h4>سفارش‌ها (${fa((d.orders || []).length)})</h4><ul>${orders || '<li class="cust-none">سفارشی ثبت نشده است.</li>'}</ul></div>
      </div>
    </div>`);
    $('#modal').querySelector('[data-cust-edit]').addEventListener('click', () => custForm(c));
    $('#modal').querySelector('[data-cust-delete]')?.addEventListener('click', async () => {
      if (!confirm(`پرونده ${c.code} — ${c.name} حذف شود؟ این کار برگشت ندارد.`)) return;
      try { await api('/api/customers/' + c.id, { method: 'DELETE' }); toast('پرونده مشتری حذف شد.'); closeModal(); await custLoad(); }
      catch (err) { toast(err.message); }
    });
  } catch (err) { toast(err.message); }
}

// ---- ورود نگهبانی: انتخاب مشتری قبلی با کد یا از پیشنهادها ----
function custGateChip(c) {
  const box = $('#gateCustChip');
  if (!box) return;
  box.innerHTML = c
    ? `<div class="cust-chip-picked">${icon('user', 14)} مشتری قبلی: <b>${custEsc(c.code)}</b> — ${custEsc(c.name)} <button type="button" class="cust-chip-x" data-action="gate-cust-clear">لغو انتخاب</button></div>`
    : '';
}

// «7»، «00007» یا «C-00007» → 00007
function custCodeOf(raw) {
  const s = en(String(raw || '')).trim().toUpperCase().replace(/\s+/g, '');
  const m = /^(?:C-?)?(\d{1,8})$/.exec(s);
  return m ? m[1].padStart(5, '0') : s;
}

async function gateCodeLookup() {
  const input = $('#gateCustCode');
  const raw = (input?.value || '').trim();
  if (!raw) return toast('کد مشتری را وارد کنید.');
  try {
    const d = await api('/api/customers/search?q=' + encodeURIComponent(raw));
    const want = custCodeOf(raw);
    const exact = (d.customers || []).find((x) => String(x.code).toUpperCase() === want);
    if (!exact) return toast('مشتری با این کد پیدا نشد.');
    gateFillCustomer(exact);
  } catch (err) { toast(err.message); }
}

function gateFillCustomer(c) {
  const f = $('#gateForm');
  if (!f) return;
  f.elements.name.value = c.name || '';
  f.elements.phone.value = c.phone || '';
  if (c.vehicleType) f.elements.vehicleType.value = c.vehicleType;
  $('#plateBox').innerHTML = plateEditorHtml(c.plate || '',f.elements.vehicleType.value);
  bindPlate();
  $('#gateCustId').value = c.id;
  $('#gateCustCode').value = c.code;
  $('#plateSuggest').innerHTML = '';
  custGateChip(c);
}

// جایگزین pickCustomer در app.js: انتخاب از پیشنهادهای پلاک/نام/تلفن، همراه با کد مشتری.
function pickCustomer(i) {
  const c = app.customerMatches[i];
  if (!c) return;
  gateFillCustomer(c);
  toast(`سوابق مشتری ${c.code} بازیابی شد.`);
}

function gateClearCustomer() {
  const id = $('#gateCustId'); if (id) id.value = '';
  const code = $('#gateCustCode'); if (code) code.value = '';
  custGateChip(null);
}

// رویدادهای سراسری کارت‌های مشتری در نگهبانی و مودال‌ها
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'gate-code-lookup') return gateCodeLookup();
  if (el.dataset.action === 'gate-cust-clear') return gateClearCustomer();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'gateCustCode') { e.preventDefault(); gateCodeLookup(); }
  const row = e.target.closest?.('[data-action="cust-open"]');
  if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); custDetail(row.dataset.id); }
});
