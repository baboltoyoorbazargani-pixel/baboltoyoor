'use strict';
(function(){
  const failures=new Set();let online=navigator.onLine;
  function paint(){
    let el=document.getElementById('btConnectionState');
    if(!el){el=document.createElement('div');el.id='btConnectionState';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el);}
    const failed=!online||failures.size>0;el.hidden=!failed;
    el.textContent=!online?'اتصال شبکه قطع است؛ اطلاعات ممکن است قدیمی باشد. تغییرات ذخیره‌نشده خودکار ارسال نمی‌شوند.':'به‌روزرسانی برخی اطلاعات ناموفق بود؛ اتصال را بررسی کنید. داده‌های قبلی نمایش داده می‌شوند.';
  }
  window.btConnection={success(path){failures.delete(path);paint()},failure(path){failures.add(path);paint()}};
  window.addEventListener('offline',()=>{online=false;paint()});window.addEventListener('online',()=>{online=true;paint()});
})();
