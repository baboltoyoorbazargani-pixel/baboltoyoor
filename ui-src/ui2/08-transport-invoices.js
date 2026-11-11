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
