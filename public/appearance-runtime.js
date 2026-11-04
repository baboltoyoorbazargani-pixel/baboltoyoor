'use strict';
// Only these fixed selectors and typed values may be published. No raw CSS or
// operational data is accepted. Only explicitly supported print tables change.
(function(global){
 const selectors={
  navigation:'#appView .rail',
  navigationActive:'#appView .rail-nav .cartable-nav-item.active',
  header:'#appView .workspace-header',
  workspace:'#appView .workspace',
  panel:'#appView .sd-panel, #appView .card',
  buttonPrimary:'#appView .btn-primary, #modal .btn-primary',
  buttonSecondary:'#appView .btn-secondary, #modal .btn-secondary',
  input:'#appView input, #appView select, #appView textarea, #modal input, #modal select, #modal textarea'
 };
 const fontSelectors={navigation:'#appView .rail-nav .nav-label',navigationActive:'#appView .rail-nav .cartable-nav-item.active .nav-label',header:'#appView .workspace-header h1'};
 const fonts={vazirmatn:'"Vazirmatn",Tahoma,Arial,sans-serif',tahoma:'Tahoma,Arial,sans-serif'};
 const lightColor=v=>{if(!safeColor(v))return false;const rgb=[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>=0.5;};
 const safeColor=x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x);
 function cssFor(settings){
  const screen=settings?.screen;if(!screen||typeof screen!=='object'||Array.isArray(screen))return '';
  const rows=[];
  for(const [name,sel] of Object.entries(selectors)){
   const v=screen[name];if(!v||typeof v!=='object')continue;const parts=[];
   if(Object.hasOwn(fonts,v.fontFamily))rows.push(':is('+sel+'), :is('+sel+') *{font-family:'+fonts[v.fontFamily]+' !important}');
   if(safeColor(v.background))parts.push('background:'+v.background+' !important');
   if(safeColor(v.color))parts.push('color:'+v.color+' !important');
   if(Number.isInteger(v.fontSize)&&v.fontSize>=9&&v.fontSize<=30){if(fontSelectors[name])rows.push(fontSelectors[name]+'{font-size:'+v.fontSize+'px !important}');else parts.push('font-size:'+v.fontSize+'px !important');}
   if(Number.isInteger(v.borderRadius)&&v.borderRadius>=0&&v.borderRadius<=30)parts.push('border-radius:'+v.borderRadius+'px !important');
   if(Number.isInteger(v.spacing)&&v.spacing>=0&&v.spacing<=24)parts.push('padding:'+v.spacing+'px !important');
   if(parts.length)rows.push(sel+'{'+parts.join(';')+'}');
  }
  return rows.join('\n');
 }
 const layoutGroups={
  phoneSections:{selector:'#phoneOrderFormV25',items:['customer','items','notes','deposit','submit']},
  phoneCustomer:{selector:'#phoneOrderFormV25 > .sales-remote-customer-grid-v40',items:['name','phone','place','delivery']}
 };
 function layoutCssFor(settings){
  const rows=[];
  for(const [group,definition] of Object.entries(layoutGroups)){
   const order=settings?.layout?.[group];
   if(!Array.isArray(order)||order.length!==definition.items.length||new Set(order).size!==order.length||order.some(x=>!definition.items.includes(x)))continue;
   order.forEach((item,index)=>rows.push(definition.selector+' > [data-layout-item="'+item+'"]{order:'+index+' !important}'));
  }
  return rows.join('\n');
 }
 const printSelectors={
  invoiceTable:{root:'.inv38-sheet',table:'.inv38-table'},
  warehouseTable:{root:'.whd-doc',table:'.whd-products'},
  storeServiceTable:{root:'.service-sheet',table:'.service-table'}
 };
 function printCssFor(settings,target){
  const sel=Object.hasOwn(printSelectors,target)?printSelectors[target]:null,v=settings?.print?.[target];
  if(!sel||!v||typeof v!=='object'||Array.isArray(v))return '';
  const rows=[];
  if(Object.hasOwn(fonts,v.fontFamily))rows.push(sel.root+', '+sel.root+' *{font-family:'+fonts[v.fontFamily]+' !important}');
  if(lightColor(v.background))rows.push(sel.table+' th{background:'+v.background+' !important;color:#000000 !important;print-color-adjust:exact;-webkit-print-color-adjust:exact}');
  if(Number.isInteger(v.fontSize)&&v.fontSize>=9&&v.fontSize<=14)rows.push(sel.table+' th, '+sel.table+' td{font-size:'+v.fontSize+'px !important}');
  return rows.join('\n');
 }
 const safeMode=new URLSearchParams(global.location?.search||'').get('appearance')==='off';
 let applied=0,latest=null;
 function apply(settings){let style=document.getElementById('bt-published-appearance');if(!style){style=document.createElement('style');style.id='bt-published-appearance';document.head.appendChild(style);}style.textContent=safeMode?'':cssFor(settings)+'\n'+layoutCssFor(settings);}
 async function refresh(){
  const seq=++applied;
  try{const response=await fetch('/api/appearance',{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw Error('appearance fetch');const data=await response.json();if(seq!==applied)return;latest=data;apply(data.settings);}catch(_){/* Keep the last known style; never replace it with a stale/empty response. */}
 }
 global.BTAppearance={cssFor,layoutCssFor,printCssFor:(settings,target)=>safeMode?'':printCssFor(settings,target),refresh,safeMode,get latest(){return latest;}};
 void refresh();global.setInterval(refresh,20000);
})(window);
