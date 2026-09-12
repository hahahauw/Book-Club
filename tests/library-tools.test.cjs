const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function extract(name){const m=new RegExp('(?:async )?function '+name+'\\(').exec(source);assert.ok(m);const end=source.slice(m.index+1).search(/\n(?:async )?function /);return source.slice(m.index,m.index+1+end);}
function base(extra={}){const c=vm.createContext({console:{error(){}},...extra});vm.runInContext(['asDate','timeValue','localDateKey','completionDateInput','parseCompletionDate','filterLibraryEntries','savePersonalEntry'].map(extract).join('\n'),c);return c;}
const rows=[{id:'1',title:'Été',author:'Z',status:'read',completedAt:'2000-05-01',date:'2000-03-01'},{id:'2',title:'집이 없어',author:'와난',status:'reading',date:'2000-04-01'},{id:'3',title:'Alpha',author:'A',status:'read',date:'2000-01-01'}];
test('search handles accents and Korean while combining status filters',()=>{const c=base();assert.equal(c.filterLibraryEntries(rows,'ete','read').length,1);assert.equal(c.filterLibraryEntries(rows,'와난')[0].id,'2');assert.equal(c.filterLibraryEntries(rows,'와난','read').length,0);});
test('sorting never mutates the source and puts unknown completion dates last',()=>{const c=base();assert.equal(c.filterLibraryEntries(rows,'','','added')[0].id,'2');assert.equal(c.filterLibraryEntries(rows,'','','title')[0].id,'3');assert.equal(c.filterLibraryEntries(rows,'','','author')[0].id,'3');assert.equal(c.filterLibraryEntries(rows,'','read','finished')[0].id,'1');assert.equal(rows[0].id,'1');});
test('optional completion date accepts real dates and rejects invalid or future dates',()=>{const c=base();assert.equal(c.parseCompletionDate(''),null);assert.equal(c.completionDateInput(c.parseCompletionDate('2000-02-29')),'2000-02-29');assert.throws(()=>c.parseCompletionDate('2001-02-29'));assert.throws(()=>c.parseCompletionDate('9999-01-01'));});
function editor(options={}){
 const deleted={delete:true};let write=null;const book={id:'shelf1',title:'Old',author:'Writer',status:'read',catalogKey:'catalog:keep',completedAt:'2000-01-01T12:00:00',pageCount:123};
 const values={title:'Corrected title',author:'Writer',genre:'Fantasy',coverUrl:'',coverFile:'',note:'Updated note',synopsis:'',pageCount:'',completedAt:'' ,...options.values};
 const fields=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value,files:[]} ]));const message={textContent:''};const elements=Object.values(fields);elements.namedItem=k=>fields[k];const form={isConnected:false,elements,querySelector:selector=>selector==='[role="status"]'?message:{}};
 const state={user:{uid:'owner'},openProfileId:'owner',shelfEntries:[{...book}]};
 const c=base({state,isMember:()=>!!state.user,safeImageUrl:v=>v.startsWith('https://')?v:'',runBusy:async(b,l,fn)=>fn(),deleteField:()=>deleted,db:{},doc:(_, ...p)=>p.join('/'),toast(){},uploadImage:async()=>'',runTransaction:async(_,fn)=>fn({get:async()=>({exists:()=>!options.missing,data:()=>({...book,status:options.status||'read'})}),update:(ref,patch)=>{write={ref,patch}}})});
 return {c,book,state,message,deleted,fields,form,write:()=>write,run:()=>c.savePersonalEntry({preventDefault(){},currentTarget:form},book)};
}
test('editing updates the same record and clears optional fields without touching identifiers',async()=>{const h=editor();await h.run();assert.equal(h.write().ref,'memberShelves/owner/entries/shelf1');assert.equal(h.write().patch.title,'Corrected title');assert.equal(h.write().patch.pageCount,h.deleted);assert.equal(h.write().patch.completedAt,h.deleted);assert.equal(h.write().patch.catalogKey,undefined);assert.equal(h.state.shelfEntries[0].catalogKey,'catalog:keep');});
test('unchanged finish date preserves its exact timestamp',async()=>{const h=editor({values:{completedAt:'2000-01-01'}});await h.run();assert.equal(h.write().patch.completedAt,undefined);});
test('editing cannot recreate a removed entry',async()=>{const h=editor({missing:true});await h.run();assert.equal(h.write(),null);assert.match(h.message.textContent,/removed/);});
test('a concurrently changed reading status blocks completion-date edits',async()=>{const h=editor({status:'reading'});await h.run();assert.equal(h.write(),null);assert.match(h.message.textContent,/status changed/);});
test('invalid page counts do not write',async()=>{const h=editor({values:{pageCount:'2.5'}});await h.run();assert.equal(h.write(),null);assert.match(h.message.textContent,/whole number/);});

test('personal editor locks captured fields during save and restores disabled states after failure',async()=>{
 const h=editor();h.fields.completedAt.disabled=true;h.fields.title.disabled=false;let finish;
 h.c.runTransaction=()=>new Promise((resolve,reject)=>finish=()=>reject(Error('offline')));
 const saving=h.run();assert.equal(h.fields.title.disabled,true);assert.equal(h.fields.note.disabled,true);
 finish();await saving;assert.equal(h.fields.title.disabled,false);assert.equal(h.fields.completedAt.disabled,true);assert.equal(h.fields.title.value,'Corrected title');
});
