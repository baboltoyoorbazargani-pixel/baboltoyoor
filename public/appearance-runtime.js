'use strict';
// Only these fixed selectors and typed values may be published. No raw CSS or
// operational data is accepted. The separate print documents are not changed.
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
 const safeColor=x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x);
 function cssFor(settings){
  const screen=settings?.screen;if(!screen||typeof screen!=='object'||Array.isArray(screen))return '';
  const rows=[];
  for(const [name,sel] of Object.entries(selectors)){
   const v=screen[name];if(!v||typeof v!=='object')continue;const parts=[];
   if(safeColor(v.background))parts.push('background:'+v.background+' !important');
   if(safeColor(v.color))parts.push('color:'+v.color+' !important');
   if(Number.isInteger(v.fontSize)&&v.fontSize>=9&&v.fontSize<=30){if(fontSelectors[name])rows.push(fontSelectors[name]+'{font-size:'+v.fontSize+'px !important}');else parts.push('font-size:'+v.fontSize+'px !important');}
   if(Number.isInteger(v.borderRadius)&&v.borderRadius>=0&&v.borderRadius<=30)parts.push('border-radius:'+v.borderRadius+'px !important');
   if(Number.isInteger(v.spacing)&&v.spacing>=0&&v.spacing<=24)parts.push('padding:'+v.spacing+'px !important');
   if(parts.length)rows.push(sel+'{'+parts.join(';')+'}');
  }
  return rows.join('\n');
 }
 const safeMode=new URLSearchParams(global.location?.search||'').get('appearance')==='off';
 let applied=0,latest=null;
 function apply(settings){let style=document.getElementById('bt-published-appearance');if(!style){style=document.createElement('style');style.id='bt-published-appearance';document.head.appendChild(style);}style.textContent=safeMode?'':cssFor(settings);}
 async function refresh(){
  const seq=++applied;
  try{const response=await fetch('/api/appearance',{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw Error('appearance fetch');const data=await response.json();if(seq!==applied)return;latest=data;apply(data.settings);}catch(_){/* Keep the last known style; never replace it with a stale/empty response. */}
 }
 global.BTAppearance={cssFor,refresh,safeMode,get latest(){return latest;}};
 void refresh();global.setInterval(refresh,20000);
})(window);
