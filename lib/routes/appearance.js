'use strict';
// Drafts do not affect users. Only an explicitly published version is public.
const {route,fail}=require('../http');
const store=require('../store');
const tx=require('../transport-transaction');
const appearance=require('../appearance');
const read=()=>store.get().appearanceDesign||appearance.initial();
const check=(value,actual)=>{if(!Number.isSafeInteger(value)||value!==actual)fail(409,'طرح تغییر کرده است؛ ابتدا آخرین نسخه را دریافت کنید.');};
route('GET','/api/appearance',{auth:false},async()=>{const state=read();return {body:{version:state.version,settings:state.published}};});
route('GET','/api/admin/appearance',{roles:['admin']},async()=>({body:read()}));
route('PUT','/api/admin/appearance/draft',{roles:['admin']},async ctx=>tx(()=>{
 const state=read();check(ctx.body.draftRevision,state.draftRevision);
 const settings=appearance.normalize(ctx.body.settings);
 const next={...state,draftRevision:state.draftRevision+1,draft:{baseVersion:state.version,settings}};
 store.get().appearanceDesign=next;
 store.audit(ctx.user,'APPEARANCE_DRAFT_SAVED','settings','appearance',{draftRevision:next.draftRevision},ctx);
 return {body:next};
}));
route('POST','/api/admin/appearance/publish',{roles:['admin']},async ctx=>tx(()=>{
 const state=read();check(ctx.body.version,state.version);check(ctx.body.draftRevision,state.draftRevision);
 if(!state.draft||state.draft.baseVersion!==state.version)fail(409,'پیش‌نویس آماده انتشار نیست.');
 const settings=appearance.normalize(state.draft.settings);
 const next={version:state.version+1,published:settings,previous:state.published,draftRevision:state.draftRevision+1,draft:null};
 store.get().appearanceDesign=next;
 store.audit(ctx.user,'APPEARANCE_PUBLISHED','settings','appearance',{version:next.version},ctx);
 return {body:next};
}));
route('POST','/api/admin/appearance/restore',{roles:['admin']},async ctx=>tx(()=>{
 const state=read();check(ctx.body.version,state.version);check(ctx.body.draftRevision,state.draftRevision);
 const next={version:state.version+1,published:appearance.normalize(state.previous||appearance.empty()),previous:state.published,draftRevision:state.draftRevision+1,draft:null};
 store.get().appearanceDesign=next;
 store.audit(ctx.user,'APPEARANCE_RESTORED','settings','appearance',{version:next.version},ctx);
 return {body:next};
}));
