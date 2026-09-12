const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function extract(name){ const match=new RegExp('(?:async )?function '+name+'\\(').exec(source); assert.ok(match); const end=source.slice(match.index+1).search(/\n(?:async )?function /); return source.slice(match.index,match.index+1+end); }
function setup(extra={}){
 const ui={monthStars:{value:'4',focus(){}},monthFinished:{checked:false},monthComment:{value:'My unfinished thought'},monthMessage:{textContent:''}};
 const state={user:{uid:'u'},profile:{displayName:'Reader'},ratings:[]}; let book={id:'a'};
 const c=vm.createContext({ui,state,currentBook:()=>book,isMember:()=>!!state.user,console:{error(){}},...extra});
 vm.runInContext(['monthDraftKey','rememberMonthDraft','syncMonthForm','saveRating'].map(extract).join('\n'),c);
 state.monthFormKey=c.monthDraftKey();
 return {c,ui,state,book:b=>{book=b}};
}
test('live updates preserve all edited fields',()=>{
 const h=setup();h.ui.monthFinished.checked=true;h.c.rememberMonthDraft();h.c.syncMonthForm({stars:1,finished:false,comment:'Remote value'});
 assert.equal(h.ui.monthStars.value,'4');assert.equal(h.ui.monthFinished.checked,true);assert.equal(h.ui.monthComment.value,'My unfinished thought');
});
test('drafts are scoped to book and account; saved values load when no draft exists',()=>{
 const h=setup();h.c.rememberMonthDraft();h.book({id:'b'});h.c.syncMonthForm({stars:2,comment:'Saved B'});assert.equal(h.ui.monthComment.value,'Saved B');
 h.book({id:'a'});h.c.syncMonthForm();assert.equal(h.ui.monthComment.value,'My unfinished thought');h.state.user={uid:'other'};h.c.syncMonthForm();assert.equal(h.ui.monthComment.value,'');assert.equal(h.ui.monthStars.value,'');
});
test('acknowledged saved draft yields to subsequent remote updates',()=>{
 const h=setup();const d=h.c.rememberMonthDraft();d.dirty=false;h.c.syncMonthForm({stars:4,finished:false,comment:d.comment});assert.equal(h.state.monthDrafts.size,0);h.c.syncMonthForm({stars:3,comment:'Other tab'});assert.equal(h.ui.monthComment.value,'Other tab');
});
const event={preventDefault(){},currentTarget:{querySelector:()=>({})}};
test('a failed save preserves the draft and provides retry feedback',async()=>{
 const h=setup({moveShelfEntry:async(uid,id,status)=>({status}),runBusy:async(b,l,fn)=>fn(),setDoc:async()=>{throw Error('offline')},doc:()=>({}),db:{}});await h.c.saveRating(event);assert.equal(h.state.monthDrafts.size,1);assert.match(h.ui.monthMessage.textContent,/draft is still here/);
});
test('typing during a save preserves newer edits after the write resolves',async()=>{
 let release;const pending=new Promise(r=>{release=r});
 const h=setup({moveShelfEntry:async(uid,id,status)=>({status}),runBusy:async(b,l,fn)=>fn(),setDoc:()=>pending,doc:()=>({}),db:{},recordActivity:async()=>{}});
 const saving=h.c.saveRating(event);h.ui.monthComment.value='Newer words';h.c.rememberMonthDraft();release();await saving;
 h.c.syncMonthForm({stars:4,comment:'My unfinished thought'});assert.equal(h.ui.monthComment.value,'Newer words');assert.match(h.ui.monthMessage.textContent,/newer edits are not saved/);
});
test('an unselected rating cannot be submitted',async()=>{
 const h=setup();h.ui.monthStars.value='';await h.c.saveRating(event);assert.match(h.ui.monthMessage.textContent,/Choose a rating/);
});
test('notifications reveal the homepage and expand the specific archived event',async()=>{
 const archive={open:false};let visible=false,scrolled=false;
 const target={closest:()=>archive,scrollIntoView(){assert.equal(visible,true);scrolled=true}};
 const c=vm.createContext({state:{notifications:[{id:'n',type:'event_added',eventId:'e'}]},ui:{notificationDialog:{}},markNotificationRead:async()=>{},closeDialog(){},location:{hash:'#memories'},updateMemoryView(){visible=true},$:id=>id==='event-e'?target:null,requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:true})});
 vm.runInContext(extract('openNotificationTarget'),c);await c.openNotificationTarget('n');assert.equal(c.location.hash,'events');assert.equal(archive.open,true);assert.equal(scrolled,true);
});
test('successful status save immediately updates the open label',async()=>{
 const form={querySelector:()=>({})},label={textContent:'reading'},message={};const entry={id:'e',title:'Book',status:'reading'};
 const nodes={detailShelfStatus:{value:'read'},detailShelfStatusForm:form,detailShelfStatusLabel:label,bookDetailMessage:message};
 const c=vm.createContext({state:{user:{uid:'u'},openProfileId:'u',shelfEntries:[entry]},$:id=>nodes[id],isMember:()=>true,moveShelfEntry:async(uid,id,status)=>({status}),runBusy:async(b,l,fn)=>fn(),serverTimestamp:()=>0,setDoc:async()=>{},doc:()=>({}),db:{},recordActivity:async()=>{},activityTypeForStatus:s=>s,toast(){},console});
 vm.runInContext(extract('updateShelfStatus'),c);await c.updateShelfStatus({preventDefault(){},currentTarget:form},'e');assert.equal(label.textContent,'read');assert.equal(entry.status,'read');
});
