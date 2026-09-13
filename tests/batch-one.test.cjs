const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function extract(name){ const match=new RegExp('(?:async )?function '+name+'\\(').exec(source); assert.ok(match); const end=source.slice(match.index+1).search(/\n(?:async )?function /); return source.slice(match.index,match.index+1+end); }
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

