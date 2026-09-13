const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8'),catalog=fs.readFileSync('book-catalog.js','utf8');
function extract(name){const m=new RegExp('(?:async )?function '+name+'\\(').exec(source);assert.ok(m,name);const end=source.slice(m.index+1).search(/\n(?:async )?function /);return source.slice(m.index,m.index+1+end);}
function load(c,names){vm.runInContext(names.map(extract).join('\n'),c);}
function library(){
 const rows=new Map(),writes=[];let lock=Promise.resolve();
 const state={user:{uid:'u'}};const ui={catalogMessage:{},catalogGenre:{value:'API genre'},catalogShelfNote:{value:'API note'}};
 const c=vm.createContext({state,ui,crypto:webcrypto,TextEncoder,db:{},isMember:()=>!!state.user,collection:(_, ...p)=>p.join('/'),doc:(_, ...p)=>({path:p.join('/'),id:p.at(-1)}),getDocs:async()=>({docs:[...rows].map(([path,data])=>({id:path.split('/').pop(),data:()=>data}))}),serverTimestamp:()=>({server:true}),withPageCount:(p,n)=>({...p,...(n?{pageCount:n}:{})}),recordActivity:async()=>{},activityTypeForStatus:s=>s,shelfAddedMessage:()=> 'Added',toast(){},runTransaction:(_,fn)=>{const result=lock.then(()=>fn({get:async r=>({exists:()=>rows.has(r.path),data:()=>rows.get(r.path)}),set:(r,d)=>{rows.set(r.path,d);writes.push({kind:'create',data:d})},update:(r,p)=>{rows.set(r.path,{...rows.get(r.path),...p});writes.push({kind:'update',data:p})}}));lock=result.catch(()=>{});return result;}});
 vm.runInContext(catalog.replaceAll('export ',''),c);load(c,['existingShelfEntry','shelfEntryId','requireShelfOwner','createShelfEntry','moveShelfEntry','saveCatalogShelfBook']);return {c,state,ui,rows,writes};
}
test('catalogue move preserves custom metadata and known completion date',async()=>{
 const h=library();const original={title:'My corrected title',author:'Writer',isbn:'9780000000001',status:'reading',note:'Personal note',coverUrl:'my-cover',synopsis:'My synopsis',completedAt:'2020-05-12',pageCount:444};h.rows.set('memberShelves/u/entries/legacy',original);
 const book={title:'API title',author:'Writer',isbn:original.isbn};assert.equal(await h.c.saveCatalogShelfBook(book,'read'),false);assert.equal(h.writes.length,0);
 assert.equal(await h.c.saveCatalogShelfBook(book,'read'),true);const saved=h.rows.get('memberShelves/u/entries/legacy');assert.deepEqual(saved,{...original,status:'read'});assert.deepEqual(Object.keys(h.writes[0].data),['status']);
});
test('concurrent additions with normalized title and author use one destination',async()=>{
 const h=library();const a={title:'Été',author:'A Writer',status:'reading'},b={title:'Ete',author:'A. Writer',status:'read'};
 const results=await Promise.all([h.c.createShelfEntry(a,a,'u'),h.c.createShelfEntry(b,b,'u')]);assert.equal(results.filter(r=>r.added).length,1);assert.equal(h.rows.size,1);
});
test('Unicode-only titles are matched without collapsing distinct books',async()=>{
 const h=library();assert.equal(h.c.sameBook({title:'집이 없어',author:'와난'},{title:'집이 없어',author:'와난'}),true);
 assert.notEqual(await h.c.shelfEntryId({title:'집이 없어',author:'와난'}),await h.c.shelfEntryId({title:'다른 책',author:'와난'}));
});
test('same Read status with an intentionally unknown completion date keeps it unknown',async()=>{
 const h=library();h.rows.set('memberShelves/u/entries/e',{title:'Book',status:'read'});await h.c.moveShelfEntry('u','e','read');assert.equal(h.rows.get('memberShelves/u/entries/e').completedAt,undefined);
});
test('moving a deleted entry cannot recreate it',async()=>{const h=library();await assert.rejects(h.c.moveShelfEntry('u','missing','read'),/removed/);assert.equal(h.writes.length,0);});
test('cleared Memory associations stay cleared through a live option refresh',()=>{
 const ui={memoryEvent:{value:'',insertAdjacentHTML(){}},memoryBook:{value:'',insertAdjacentHTML(){}}};const state={memoryEditingId:'m',memories:[{id:'m',eventId:'e',bookId:'b'}],events:[{id:'e',title:'Event'}],books:[{id:'b',title:'Book'}]};const c=vm.createContext({ui,state,escapeHtml:String,eventDateLabel:String});load(c,['renderMemoryOptions']);c.renderMemoryOptions();assert.equal(ui.memoryEvent.value,'');assert.equal(ui.memoryBook.value,'');
});
test('replying to notification-loaded older comment selects and posts its actual parent',async()=>{
 const older={id:'old',rootId:'root',memberId:'other',name:'Reader'};let written;
 const state={user:{uid:'u'},profile:{displayName:'Me'},activeBookId:'b',books:[{id:'b'}],notificationComments:[older],bookComments:[],legacyBookComments:[]};
 const form={querySelector:()=>({}),isConnected:false};const nodes={bookCommentText:{value:'My response',focus(){}},bookCommentMessage:{}};
 const c=vm.createContext({state,$:id=>nodes[id],isMember:()=>true,renderReplyContext(){},runBusy:async(_,__,fn)=>fn(),db:{},collection:()=>({}),doc:()=>({id:'reply'}),serverTimestamp:()=>0,setDoc:async(_,p)=>{written=p},recordActivity:async()=>{},createReplyNotification:async()=>{},toast(){},console});
 load(c,['combinedBookComments','setReplyTarget','postBookComment']);c.setReplyTarget('old');assert.equal(state.replyTarget.id,'old');await c.postBookComment({preventDefault(){},currentTarget:form},'b');assert.equal(written.parentId,'old');assert.equal(written.rootId,'root');
});
test('slow profile request cannot replace a newer destination or attach a listener',async()=>{
 const pending=[];let listeners=0;const state={};const ui={profileDialog:{open:true},profileContent:{innerHTML:''}};
 const c=vm.createContext({state,ui,db:{},doc:(_,__,uid)=>uid,getDoc:uid=>new Promise(resolve=>pending.push({uid,resolve})),escapeHtml:String,console:{error(){}},onSnapshot:()=>listeners++});load(c,['openProfile']);
 const a=c.openProfile('a'),b=c.openProfile('b');pending[1].resolve({exists:()=>false});await b;const newContent=ui.profileContent.innerHTML;pending[0].resolve({exists:()=>true});await a;
 assert.equal(ui.profileContent.innerHTML,newContent);assert.equal(state.openProfileId,'b');assert.equal(listeners,0);
});
test('pinboard avatar prefers current member photo and keeps snapshot fallback',()=>{
 const c=vm.createContext({state:{members:[{id:'u',photoURL:'https://current',displayName:'Current'}]},safeImageUrl:s=>s||'',optimizedImageUrl:s=>s,escapeHtml:String,initials:s=>s[0]});load(c,['pinAvatar']);
 const html=c.pinAvatar({memberId:'u',photoURL:'https://old',displayName:'Old'});assert.match(html,/src="https:\/\/current"/);assert.match(html,/data-pin-fallback="https:\/\/old"/);assert.match(html,/data-pin-initials="C"/);
});
test('Cloudinary timeout aborts the request and offers retry',async()=>{
 let expire;const c=vm.createContext({state:{cloudName:'club',uploadPreset:'preset'},configuredUpload:()=>true,AbortController,FormData:class{append(){}},setTimeout:fn=>{expire=fn;return 1},clearTimeout(){},fetch:(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))});load(c,['uploadImage']);const upload=c.uploadImage({type:'image/jpeg',size:100});expire();await assert.rejects(upload,/timed out.*retry/);
});
test('batch stop aborts the current upload and marks remaining photos resumable',()=>{
 const controller=new AbortController(),state={memoryUploadController:controller},button={},ui={memoryStatus:{}};const c=vm.createContext({state,ui,$:()=>button});load(c,['stopMemoryUploads']);c.stopMemoryUploads();assert.equal(controller.signal.aborted,true);assert.equal(state.memoryUploadStopped,true);assert.equal(button.disabled,true);
});

