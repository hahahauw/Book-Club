const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const source=fs.readFileSync('app.js','utf8');const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
test('reply destination fetches older reply and ancestors, focuses exact reply without opening spoiler',async()=>{
 const reply={id:'r',parentId:'p',rootId:'root',text:'reply'};const fetched=[];let focused=false,rendered=0;
 const node={dataset:{commentId:'r'},setAttribute(){},focus(){focused=true},scrollIntoView(){}};
 const state={activeBookId:'b'};const c=vm.createContext({state,db:{},doc:(_, ...parts)=>parts.join('/'),getDoc:async path=>{const id=path.split('/').pop();fetched.push(id);return {id,exists:()=>true,data:()=>id==='r'?reply:{text:'parent'}}},$:()=>({querySelectorAll:()=>[node]}),renderBookComments:()=>rendered++,toast(){}});
 vm.runInContext(extract('async function revealNotificationReply(', 'function localDateKey('),c);
 await c.revealNotificationReply('b','r');assert.deepEqual(fetched,['r','p','root']);assert.equal(state.notificationComments.length,3);assert.equal(focused,true);assert.equal(rendered,1);assert.equal(state.highlightedReplyId,'r');
});
test('late reply fetch cannot redirect a different book',async()=>{
 let resolve;const state={activeBookId:'a'};let rendered=false;
 const c=vm.createContext({state,db:{},doc:()=>({}),getDoc:()=>new Promise(r=>resolve=r),renderBookComments:()=>rendered=true,toast(){}});vm.runInContext(extract('async function revealNotificationReply(', 'function localDateKey('),c);
 const pending=c.revealNotificationReply('a','r');state.activeBookId='b';resolve({exists:()=>true});await pending;assert.equal(rendered,false);assert.equal(state.notificationComments,undefined);
});
test('saved-book labels use current account shelf and never another open profile',()=>{
 const state={user:{uid:'u'},dashboardOwnerId:'u',dashboardShelfEntries:[{isbn:'1',status:'want-to-read'}],shelfEntries:[{isbn:'2',status:'read'}]};
 const c=vm.createContext({state,isMember:()=>true,sameBook:(a,b)=>a.isbn===b.isbn});vm.runInContext(extract('function savedShelfEntry(', 'function savedBookBadge('),c);
 assert.equal(c.savedBookLabel({isbn:'1'}),'In My library · want to read');assert.equal(c.savedBookLabel({isbn:'2'}),'');state.user.uid='other';assert.equal(c.savedBookLabel({isbn:'1'}),'');
});
test('larger catalogue results retain deduplication and source failure fallback',async()=>{
 const code=fs.readFileSync('book-catalog.js','utf8');const start=code.indexOf('async function searchOpenLibrary('),end=code.indexOf('export async function loadCatalogDetails(');
 const urls=[];let failGoogle=false;
 const c=vm.createContext({URLSearchParams,OPEN_LIBRARY_SEARCH_URL:'https://open.test',GOOGLE_BOOKS_SEARCH_URL:'https://google.test',normalizeOpenLibrary:x=>x,normalizeGoogleBooks:x=>x,mergeResults:rows=>[...new Map(rows.map(row=>[row.title,row])).values()],fetchJson:async url=>{urls.push(url);if(url.startsWith('https://google')&&failGoogle)throw Error('offline');const rows=Array.from({length:20},(_,i)=>({title:String(i),openLibraryKey:'o'+i,googleBooksId:'g'+i}));return {docs:rows,items:rows}}});
 vm.runInContext(code.slice(start,end).replace('export async function','async function'),c);
 assert.equal((await c.searchCatalog('books',{googleBooksApiKey:'key'})).length,20);assert.match(urls[0],/limit=20/);assert.match(urls[1],/maxResults=20/);
 failGoogle=true;assert.equal((await c.searchCatalog('books',{googleBooksApiKey:'key'})).length,20);
});
