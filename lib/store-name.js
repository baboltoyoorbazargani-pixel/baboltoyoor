'use strict';
// Display only: keep the saved branch name and historical order untouched.
function storeDisplayName(value, branchNo) {
  const raw=String(value||'').trim().replace(/\s+/g,' ');
  const ascii=s=>String(s).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const prefix=/^شعبه(?:\s+([0-9۰-۹٠-٩]+))?(?:\s+|$)/;
  let rest=raw.replace(/^(?:فروشگاه(?:\s+|$))+/,'').trim();
  const match=rest.match(prefix);
  const number=Number(ascii(branchNo??match?.[1]??''));
  if(match)rest=rest.slice(match[0].length).trim();
  // Never fabricate a branch number for legacy records without one.
  return ['فروشگاه',Number.isInteger(number)&&number>0?'شعبه '+number:'',rest].filter(Boolean).join(' ');
}
module.exports={storeDisplayName};
