'use strict';
// A deliberately constrained foundation for a visual editor: no raw CSS,
// selectors, URLs, text or HTML can be stored or published through this API.
// The initial editor covers only fixed screen groups; print integration is not implemented.
const { fail } = require('./http');
const targets = Object.freeze({
  screen: ['navigation','navigationActive','header','workspace','panel','buttonPrimary','buttonSecondary','input'],
  print: ['invoice','warehouseDocument','storeService'],
});
const properties = Object.freeze({
  background: v => typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v),
  color: v => typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v),
  fontSize: v => Number.isInteger(v) && v>=9 && v<=30,
  borderRadius: v => Number.isInteger(v) && v>=0 && v<=30,
  spacing: v => Number.isInteger(v) && v>=0 && v<=24,
});
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
