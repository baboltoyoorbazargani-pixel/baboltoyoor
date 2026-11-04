'use strict';
// A deliberately constrained foundation for a visual editor: no raw CSS,
// selectors, URLs, text or HTML can be stored or published through this API.
// Only explicitly supported screen and document elements are customizable.
const { fail } = require('./http');
const targets = Object.freeze({
  screen: ['navigation','navigationActive','header','workspace','panel','buttonPrimary','buttonSecondary','input'],
  print: ['invoice','warehouseDocument','storeService','invoiceTable','warehouseTable','storeServiceTable'],
});
const properties = Object.freeze({
  fontFamily: v => typeof v==='string' && ['vazirmatn','tahoma'].includes(v),
  background: v => typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v),
  color: v => typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v),
  fontSize: v => Number.isInteger(v) && v>=9 && v<=30,
  borderRadius: v => Number.isInteger(v) && v>=0 && v<=30,
  spacing: v => Number.isInteger(v) && v>=0 && v<=24,
});
// Header background must remain readable with black ink even if the printer
// suppresses background colors. Reject dark colors rather than hiding data.
function lightColor(v) {
  if(!/^#[0-9a-f]{6}$/i.test(v))return false;
  const rgb=[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>=0.5;
}
function normalize(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'تنظیمات طراحی معتبر نیست.');
  if(Object.keys(input).some(k=>!['screen','print'].includes(k)))fail(400,'بخش طراحی ناشناخته است.');
  const out={screen:{},print:{}};
  for(const scope of ['screen','print']){
    const groups=input[scope]??{};
    if(!groups||typeof groups!=='object'||Array.isArray(groups))fail(400,'بخش طراحی معتبر نیست.');
    for(const [target,styles] of Object.entries(groups)){
      if(!targets[scope].includes(target)||!styles||typeof styles!=='object'||Array.isArray(styles))fail(400,'عنصر طراحی معتبر نیست.');
      const clean={};
      for(const [key,value] of Object.entries(styles)){
        if(!Object.hasOwn(properties,key)||!properties[key](value))fail(400,'مقدار تنظیم ظاهری معتبر نیست.');
        if(scope==='print' && ['invoiceTable','warehouseTable','storeServiceTable'].includes(target)) {
          if(!['background','fontSize','fontFamily'].includes(key) || (key==='fontSize' && (value<9||value>14)) || (key==='background' && !lightColor(value))) fail(400,'برای چاپ فقط رنگ روشن و اندازه ۹ تا ۱۴ مجاز است.');
        }
        clean[key]=typeof value==='string'?value.toLowerCase():value;
      }
      out[scope][target]=clean;
    }
  }
  return out;
}
const empty=()=>({screen:{},print:{}});
const initial=()=>({version:0,published:empty(),draftRevision:0,draft:null});
module.exports={normalize,empty,initial};
