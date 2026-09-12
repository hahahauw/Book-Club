const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const source=fs.readFileSync('app.js','utf8');
function extract(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
test('event edits preserve RSVP aggregates and detect conflicting officer edits',async()=>{
 const nodes={eventCancelEdit:{},eventStatus:{}};const button={};const ui={eventTitle:{value:'New'},eventDate:{value:'2026-09-12'},eventDetails:{value:'Details'},eventForm:{elements:[],querySelector:()=>button,reset(){}}};let patch;
 const state={user:{uid:'u'},eventEditing:{id:'e',title:'Old',date:'2026-09-12',details:''}};
 let saved={...state.eventEditing,rsvpGoing:5};
 const c=vm.createContext({state,ui,$:id=>nodes[id],isOfficer:()=>true,localDateKey:d=>d.toISOString().slice(0,10),db:{},doc:()=>({}),toast(){},runTransaction:async(_,fn)=>fn({get:async()=>({exists:()=>true,data:()=>saved}),update:(_,p)=>patch=p})});
 vm.runInContext(extract('function resetEventEditor(', 'function renderMemoryOptions('),c);
 await c.addEvent({preventDefault(){}});assert.deepEqual(Object.keys(patch).sort(),['date','details','title']);assert.equal(patch.title,'New');
 state.eventEditing={id:'e',title:'Old',date:'2026-09-12',details:''};saved.title='Other edit';patch=null;
 await c.addEvent({preventDefault(){}});assert.equal(patch,null);assert.match(nodes.eventStatus.textContent,/Another officer/);
});
test('grouping preserves all photos, event identity, and deleted-event snapshots',()=>{
 const c=vm.createContext({state:{events:[{id:'e',title:'Meeting'}]},recentFirst:rows=>rows});vm.runInContext(extract('function memoryGroups(', 'function renderMemories('),c);
 const rows=[{id:'1',eventId:'e',category:'Art'},{id:'2',eventId:'gone',eventTitleSnapshot:'Old day',category:'Art'},{id:'3'}];
 const groups=c.memoryGroups(rows,'event');assert.deepEqual(Array.from(groups,g=>g.label),['Meeting','Old day','Without an event']);assert.equal(c.memoryGroups(rows,'category')[0].items.length,2);assert.equal(c.memoryGroups(rows,'recent')[0].items.length,3);
});
test('batch retry skips saved photos and reuses uploaded URL and destination after write failure',async()=>{
 const controls=[];const node=()=>({value:'',disabled:false});const ui={memoryFile:{files:[{name:'a'},{name:'b'}]},memoryImage:node(),memoryCaption:{value:'Meeting'},memoryCategory:node(),memoryEvent:node(),memoryBook:node(),memoryStatus:{},memorySave:{},memoryCancelEdit:{},memoryForm:{elements:controls}};
 const state={user:{uid:'u'},memories:[],events:[],books:[]};let counter=0,uploads=0,writes=[],fail=true;
 const c=vm.createContext({AbortController, $:()=>({}), waitForMemoryWrite:write=>write, state,ui,isOfficer:()=>true,safeImageUrl:x=>x,db:{},collection:()=>({}),doc:()=>({id:++counter}),uploadImage:async f=>{uploads++;return 'https://image/'+f.name},serverTimestamp:()=>1,setDoc:async(ref)=>{writes.push(ref.id);if(ref.id===2&&fail)throw Error('offline');},resetMemoryEditor:()=>{state.memoryUploadQueue=null},toast(){}});
 vm.runInContext(extract('async function addMemory(', 'async function addInvite('),c);
 await c.addMemory({preventDefault(){}});assert.equal(uploads,2);assert.match(ui.memoryStatus.textContent,/1 of 2 saved/);
 fail=false;await c.addMemory({preventDefault(){}});assert.equal(uploads,2);assert.deepEqual(writes,[1,2,2]);assert.equal(state.memoryUploadQueue,null);
});
