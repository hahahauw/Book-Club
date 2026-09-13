const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync('app.js', 'utf8');
const ast = require('acorn').parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const identitySource = fs.readFileSync('book-identity.js','utf8').replaceAll('export ', '');
const identity = vm.createContext({}); vm.runInContext(identitySource, identity);
function extract(name) { const n = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); assert.ok(n, name); return source.slice(n.start,n.end); }
const book = { title: 'A Book', author: 'An Author', catalogKey: '/works/OL1W', openLibraryKey: '/works/OL1W', isbn: '9780140328721', synopsis: 'A story.', genre: 'Fiction', coverUrl: '', publicationYear: '2000' };
const original = { ...book, id: 'old-public-id', memberName: 'Original reader', memberId: 'bob', why: 'Original reason', comments: [{ name: 'Guest', text: 'Original note', date: '2025-01-01' }] };
function harness(names, overrides = {}) {
  const dom = new JSDOM('<div id="container"></div>', { url: 'https://fixture.test', runScripts: 'outside-only' });
  const w = dom.window; Object.defineProperty(w, 'crypto', { value: webcrypto });
  Object.assign(w, { TextEncoder, console: { error(){}, warn(){} }, ...overrides });
  w.$ = id => w.document.getElementById(id);
  w.eval(identitySource + '\n' + fs.readFileSync('book-catalog.js','utf8').replaceAll('export ', '') + '\n' + names.map(extract).join('\n'));
  return { dom, w, container: w.$('container'), close: () => dom.window.close() };
}
function recommendationHarness(options = {}) {
  const rows = new Map((options.books || []).map(item => ['books/'+item.id, structuredClone(item)]));
  if(options.reason) rows.set('books/old-public-id/recommendations/alice', options.reason);
  const writes = [], activities = []; let lock = Promise.resolve();
  const state = {user: {uid:'alice'}, profile: {role:'member', displayName:'Alice'}};
  const h = harness(['isMember','requireShelfOwner','escapeHtml','conversationLabel','recommendationChoice','saveSharedRecommendation'], {
    state, db:{}, collection: (_, ...path) => path.join('/'), doc: (_, ...path) => ({path:path.join('/'),id:path.at(-1)}),
    getDocs: async () => { if (options.beforeRead) await options.beforeRead(state); return {docs: [...rows].filter(([path]) => path.split('/').length===2).map(([path, value]) => ({id:path.split('/')[1],data:()=>value}))}; },
    runTransaction: (_,callback) => { const p = lock.then(async () => {
      const pending = [];
      const result = await callback({ get: async ref => { if(options.beforeTransactionRead) await options.beforeTransactionRead(state); return {exists:()=>rows.has(ref.path),data:()=>rows.get(ref.path)}; }, set: (ref,value) => { if(options.fail)throw Error('offline'); pending.push([ref.path,structuredClone(value)]); } });
      pending.forEach(([path,value]) => {rows.set(path,value);writes.push({path,value});}); return result;
    }); lock=p.catch(()=>{});return p; },
    recordActivity: async (...args) => { activities.push(args); if(options.activityFail)throw Error('Activity offline'); }
  });
  return {...h, state, rows, writes, activities, save:(value=book,reason='My reason',target=h.container) => h.w.saveSharedRecommendation(value,reason,target)};
}
test('only a single shared identifier selects a conversation automatically', () => {
  assert.equal(identity.bookMatch(book,{...book,title:'Edited title'}),'identifier');
  assert.equal(identity.bookMatch(book,{title:'a book',author:'an author'}),'title-author');
  assert.equal(identity.bookMatch(book,{...book,openLibraryKey:'/works/OL2W',catalogKey:'/works/OL2W'}),'conflicting-identifiers');
  assert.equal(identity.bookMatch(book,{title:'A Book',author:'Someone else'}),null);
  assert.equal(identity.automaticConversation(identity.bookConnections(book,[original])).id,original.id);
  assert.equal(identity.automaticConversation(identity.bookConnections(book,[original,{...original,id:'other'}])),null);
  assert.equal(identity.automaticConversation(identity.bookConnections(book,[{id:'manual',title:book.title,author:book.author}])),null);
});
test('new publication and reader reason are atomic; a later reader reuses the book', async () => {
  const h = recommendationHarness(); const first = await h.save();
  assert.match(first.id,/^shared_[a-f0-9]{64}$/); assert.equal(h.writes.length,2);
  assert.equal(h.rows.get('books/'+first.id).why,''); assert.equal(h.rows.get('books/'+first.id+'/recommendations/alice').reason,'My reason');
  h.state.user={uid:'carol'};h.state.profile.displayName='Carol';const second=await h.save(book,'Another perspective');
  assert.equal(second.id,first.id);assert.equal(h.writes.filter(x=>x.path.split('/').length===2).length,1);
  assert.equal(h.rows.get('books/'+first.id+'/recommendations/carol').displayName,'Carol');h.close();
});
test('concurrent forms and repeat saves do not add duplicate book or endorsement records', async () => {
  const h=recommendationHarness();const other=h.w.document.createElement('div');
  const results=await Promise.all([h.save(),h.save(book,'My reason',other)]);assert.equal(results[0].id,results[1].id);
  const again=await h.save();assert.equal(again.changed,false);assert.equal(h.rows.size,2);assert.equal(h.activities.length,1);h.close();
});
test('recommending again from an add form cannot erase the reader’s existing reason',async()=>{
  const h=recommendationHarness({books:[original],reason:{memberId:'alice',displayName:'Alice',reason:'Keep this thought',createdAt:'2020',updatedAt:'2020'}});const result=await h.save(book,'');assert.equal(result.changed,false);assert.equal(h.writes.length,0);assert.equal(h.rows.get('books/'+original.id+'/recommendations/alice').reason,'Keep this thought');h.close();
});
test('legacy metadata, comments, ID and original reason survive a new recommendation', async () => {
  const h=recommendationHarness({books:[original]}); const before=JSON.stringify(h.rows.get('books/'+original.id));
  const result=await h.save({...book, title:'Updated catalogue title'},'New reader note');
  assert.equal(result.id,original.id);assert.equal(JSON.stringify(h.rows.get('books/'+original.id)),before);
  assert.ok(h.writes.every(item=>item.path==='books/old-public-id/recommendations/alice'));h.close();
});
test('updating an endorsement preserves createdAt and writes only the current reader', async () => {
  const h=recommendationHarness({books:[original],reason:{memberId:'alice',displayName:'Alice',reason:'Before',createdAt:'2020-01-01',updatedAt:'2020-01-01'}});
  await h.w.saveSharedRecommendation(book,'After',h.container,'alice',original.id);assert.equal(h.writes[0].value.createdAt,'2020-01-01');assert.equal(h.writes[0].value.reason,'After');h.close();
});
for(const candidates of [[{id:'manual',title:book.title,author:book.author}],[original,{...original,id:'other'}]]) test('uncertain or duplicate matches require a choice before any write',async()=>{
  const h=recommendationHarness({books:candidates});await assert.rejects(h.save(),/Choose a conversation/);assert.equal(h.writes.length,0);
  const select=h.container.querySelector('select');assert.equal(h.w.document.activeElement,select);select.value=candidates.at(-1).id;
  assert.equal((await h.save()).id,candidates.at(-1).id);assert.equal(h.writes.length,1);h.close();
});
test('rejecting title matches cannot silently reuse a deterministic record', async () => {
  const h=recommendationHarness();const manual={title:'A Book',author:'An Author'};await h.save(manual);
  await assert.rejects(h.save(manual),/Choose a conversation/);h.container.querySelector('select').value='__new';
  await assert.rejects(h.save(manual),/already uses these book details/);assert.equal(h.rows.size,2);h.close();
});
for(const stage of ['beforeRead','beforeTransactionRead']) test(`account change at ${stage} prevents recommendation writes`,async()=>{
  const h=recommendationHarness({[stage]:(state)=>{state.user={uid:'other'};}});await assert.rejects(h.save(),/session changed/);assert.equal(h.writes.length,0);h.close();
});
test('failed atomic publication leaves neither record; an activity failure does not undo success',async()=>{
  const failed=recommendationHarness({fail:true});await assert.rejects(failed.save(),/offline/);assert.equal(failed.rows.size,0);failed.close();
  const saved=recommendationHarness({activityFail:true});assert.equal((await saved.save()).changed,true);assert.equal(saved.rows.size,2);saved.close();
});
function ratingHarness(options={}) {
  const state={user:{uid:'alice'},profile:{role:'member',displayName:'Alice'},activeBookId:original.id,bookContextToken:{},bookRatings:[]};let saved=options.previous,writes=0;
  const h=harness(['isMember','requireShelfOwner','escapeHtml','sharedRatingMarkup','ratingDraftKey','rememberRatingDraft','renderBookRatings','saveBookRating','runBusy'],{
    state,db:{},doc:(_, ...path)=>path.join('/'),recordActivity:async()=>{if(options.activityFail)throw Error('activity offline');},runTransaction:async(_,callback)=>{
      if(options.wait)await options.wait;
      return callback({get:async()=>{if(options.beforeRead)options.beforeRead(state);if(options.fail)throw Error('offline');return {exists:()=>!!saved,data:()=>saved};},set:(ref,data)=>{assert.equal(ref,'bookOfMonthRatings/'+original.id+'/members/alice');saved=data;writes++;}});
    }
  });
  h.container.innerHTML=h.w.sharedRatingMarkup();h.w.$('bookStars').value='4';
  return {...h,state,read:()=>saved,writes:()=>writes,save:()=>h.w.saveBookRating({preventDefault(){},currentTarget:h.w.$('bookRatingForm')},original)};
}
test('rating updates preserve historical completion and note without making a shelf write',async()=>{
  const h=ratingHarness({previous:{stars:2,finished:true,comment:'Old monthly note'}});await h.save();
  assert.equal(h.read().finished,true);assert.equal(h.read().comment,'Old monthly note');assert.equal(h.read().stars,4);h.close();
});
test('first rating has no separate reading completion or discussion state',async()=>{
  const h=ratingHarness();await h.save();assert.equal(h.read().finished,false);assert.equal(h.read().comment,'');h.close();
});
test('subscription refreshes preserve edited rating and acknowledged drafts yield to remote values',()=>{
  const h=ratingHarness();const draft=h.w.rememberRatingDraft();h.state.bookRatings=[{id:'alice',stars:1}];h.w.renderBookRatings();assert.equal(h.w.$('bookStars').value,'4');
  draft.dirty=false;h.state.bookRatings=[{id:'alice',stars:4}];h.w.renderBookRatings();assert.equal(h.state.ratingDrafts.size,0);
  h.state.bookRatings=[{id:'alice',stars:3}];h.w.renderBookRatings();assert.equal(h.w.$('bookStars').value,'3');h.close();
});
test('rating drafts are scoped to account and conversation',()=>{
  const h=ratingHarness();h.w.rememberRatingDraft();h.state.activeBookId='another';h.w.renderBookRatings();assert.equal(h.w.$('bookStars').value,'');
  h.state.activeBookId=original.id;h.w.renderBookRatings();assert.equal(h.w.$('bookStars').value,'4');h.state.user={uid:'bob'};h.w.renderBookRatings();assert.equal(h.w.$('bookStars').value,'');h.close();
});
test('newer selection survives an in-flight rating save',async()=>{
  let release;const wait=new Promise(r=>release=r);const h=ratingHarness({wait});const saving=h.save();h.w.$('bookStars').value='2';h.w.rememberRatingDraft();release();await saving;
  h.state.bookRatings=[{id:'alice',stars:4}];h.w.renderBookRatings();assert.equal(h.w.$('bookStars').value,'2');assert.match(h.w.$('bookRatingMessage').textContent,/newer choice/);h.close();
});
test('failed rating save retains a retryable choice; invalid and unchanged values do not write',async()=>{
  const failed=ratingHarness({fail:true});await failed.save();assert.equal(failed.w.$('bookStars').value,'4');assert.match(failed.w.$('bookRatingMessage').textContent,/try again/);failed.close();
  const unchanged=ratingHarness({previous:{stars:4,finished:true,comment:'Old'}});await unchanged.save();assert.equal(unchanged.writes(),0);unchanged.w.$('bookStars').value='';await unchanged.save();assert.equal(unchanged.writes(),0);unchanged.close();
});
test('malformed historical note is retained instead of silently normalized away',async()=>{
  const previous={stars:2,finished:true,comment:'x'.repeat(281)};const h=ratingHarness({previous});await h.save();assert.equal(h.writes(),0);assert.equal(h.read(),previous);assert.match(h.w.$('bookRatingMessage').textContent,/needs review/);h.close();
});
test('account switch prevents rating write; book switch prevents stale feedback',async()=>{
  const switched=ratingHarness({beforeRead:state=>{state.user={uid:'bob'};}});await switched.save();assert.equal(switched.writes(),0);switched.close();
  let release;const wait=new Promise(r=>release=r);const h=ratingHarness({wait});const saving=h.save();h.state.bookContextToken={};h.w.$('bookRatingMessage').textContent='New book';release();await saving;assert.equal(h.w.$('bookRatingMessage').textContent,'New book');h.close();
});
test('historical notes are escaped and collapsed behind a spoiler warning',()=>{
  const h=ratingHarness();h.state.bookRatings=[{id:'alice',stars:4,comment:'<img src=x> The ending',displayName:'<script>Reader</script>'}];h.w.renderBookRatings();
  assert.equal(h.container.querySelector('.historical-notes').open,false);assert.match(h.container.querySelector('summary').textContent,/spoilers/);assert.equal(h.container.querySelector('img,script'),null);h.close();
});
function fullHarness(){
  const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://fixture.test',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window,subscriptions=[];
  w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollTo=function(){};w.HTMLElement.prototype.scrollIntoView=function(){};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  Object.assign(w,{initializeApp:()=>({}),getFirestore:()=>({}),getAuth:()=>({}),onAuthStateChanged:(_,callback)=>{w.authCallback=callback;},collection:(_, ...path)=>path.join('/'),doc:(_, ...path)=>path.join('/'),query:(ref)=>ref,orderBy:()=>{},limit:()=>{},where:()=>{},onSnapshot:(ref,next,error)=>{const sub={ref,next,error,stopped:false};subscriptions.push(sub);return ()=>{sub.stopped=true;};},getDocs:async()=>({docs:[]}),getDoc:async()=>({exists:()=>false})});
  w.eval(identitySource+'\n'+fs.readFileSync('book-catalog.js','utf8').replaceAll('export ','')+'\n'+source.replace(/^import .*?;\n/gm,'')+'\nwindow.fixture={state,ui,openBookDetails,stopBookSocialSubscriptions,renderMonth,subscribeMonthRecommendation};');
  const f=w.fixture;Object.assign(f.state,{user:{uid:'alice'},profile:{role:'member',displayName:'Alice',favoriteBookIds:['personal-id']},openProfileId:'alice',dashboardOwnerId:'alice',books:[original],shelfEntries:[],dashboardShelfEntries:[]});
  return {dom,w,f,subscriptions,close:()=>dom.window.close(),emit:(ref,rows)=>subscriptions.findLast(sub=>sub.ref===ref&&!sub.stopped).next({docs:rows.map(row=>({id:row.id,data:()=>row}))})};
}
test('personal shelf controls and shared discussion use their own authoritative IDs',()=>{
  const h=fullHarness();const personal={...book,id:'personal-id',status:'read',note:'My own note'};h.f.state.shelfEntries=[personal];h.f.openBookDetails(personal,true);
  assert.equal(h.f.state.activeBookId,original.id);assert.ok(h.w.document.getElementById('detailShelfStatusForm'));assert.equal(h.w.document.getElementById('favoriteToggle').getAttribute('aria-pressed'),'true');
  assert.match(h.f.ui.bookContent.textContent,/My own note/);assert.match(h.f.ui.bookContent.textContent,/Original note/);
  const active=h.subscriptions.filter(sub=>!sub.stopped&&/comments|reactions|ratings|Ratings|recommendations/.test(sub.ref));assert.ok(active.every(sub=>sub.ref.includes(original.id)));assert.equal(active.length,4);
  h.emit('bookOfMonthRatings/'+original.id+'/members',[{id:'alice',stars:5,finished:true,comment:'Historical thought'}]);assert.match(h.w.document.getElementById('bookRatingSummary').textContent,/5.0 out of 5/);
  assert.equal(new Set([...h.w.document.querySelectorAll('[id]')].map(n=>n.id)).size,h.w.document.querySelectorAll('[id]').length);h.close();
});
test('ambiguous personal match has no social write controls until explicitly selected; all threads remain reachable',()=>{
  const h=fullHarness();h.f.state.books=[original,{...original,id:'older-public-id'}];h.f.openBookDetails({...book,id:'personal'},true);
  assert.equal(h.f.state.activeBookId,null);assert.equal(h.w.document.getElementById('bookRatingForm'),null);assert.equal(h.w.document.querySelectorAll('[data-conversation-id]').length,2);
  h.w.document.querySelector('[data-conversation-id="older-public-id"]').click();assert.equal(h.f.state.activeBookId,'older-public-id');assert.ok(h.w.document.querySelector('[data-conversation-id="old-public-id"]'));h.close();
});
test('public Manage my copy returns to the owned entry, preserving favorite identity',()=>{
  const h=fullHarness();h.f.state.dashboardShelfEntries=[{...book,id:'personal-id',status:'read'}];h.f.openBookDetails(original);assert.equal(h.w.document.getElementById('clubShelfForm'),null);h.w.document.getElementById('manageMyCopy').click();assert.equal(h.w.document.activeElement.id,'bookDetailTitle');assert.equal(h.f.state.openProfileId,'alice');assert.equal(h.w.document.getElementById('favoriteToggle').getAttribute('aria-pressed'),'true');assert.equal(h.f.state.activeBookId,original.id);h.close();
});
test('closing and reopening the same book ignores stale subscription values and errors',()=>{
  const h=fullHarness();h.f.openBookDetails(original);const old=h.subscriptions.filter(sub=>!sub.stopped&&sub.ref.includes(original.id));h.f.ui.bookDialog.close();assert.ok(old.every(sub=>sub.stopped));h.f.openBookDetails(original);
  old.forEach(sub=>{sub.next({docs:[{id:'old',data:()=>({stars:1,reason:'Stale reason',comment:'Stale comment'})}]});sub.error(Error('stale'));});
  assert.equal(h.f.state.bookRatings.length,0);assert.equal(h.f.state.bookRecommendations.length,0);assert.doesNotMatch(h.f.ui.bookContent.textContent,/Stale|could not load/);h.close();
});
test('recommendations retain attribution, escape content and never overwrite a typed draft',()=>{
  const h=fullHarness();h.f.openBookDetails(original);const field=h.w.document.querySelector('#bookRecommendationForm textarea');field.value='Unfinished draft';field.dispatchEvent(new h.w.Event('input'));
  h.emit('books/'+original.id+'/recommendations',[{id:'alice',displayName:'Alice',reason:'Server value'},{id:'carol',displayName:'Carol',reason:'<img src=x>'}]);assert.equal(field.value,'Unfinished draft');assert.match(h.w.document.getElementById('bookRecommendationList').textContent,/Carol/);assert.equal(h.w.document.getElementById('bookRecommendationList').querySelector('img'),null);h.close();
});
test('monthly preview uses the actual endorsement author and ignores a superseded selection',()=>{
  const h=fullHarness();h.f.state.books=[{...original,why:''}];h.f.state.currentPickId=original.id;h.f.subscribeMonthRecommendation();const old=h.subscriptions.findLast(sub=>sub.ref==='books/'+original.id+'/recommendations');
  old.next({docs:[{data:()=>({reason:'My perspective',displayName:'Carol'})}]});assert.match(h.f.ui.month.textContent,/Recommended by Carol/);
  h.f.state.currentPickId=null;h.f.subscribeMonthRecommendation();old.next({docs:[{data:()=>({reason:'Wrong book',displayName:'Alice'})}]});assert.doesNotMatch(h.f.ui.month.textContent,/Wrong book/);h.close();
});
test('sign-out stops shared subscriptions, closes book details and clears rating drafts',async()=>{
  const h=fullHarness();h.f.openBookDetails(original);h.f.state.ratingDrafts=new Map([['alice',['draft']]]);const subs=h.subscriptions.filter(sub=>!sub.stopped&&sub.ref.includes(original.id));await h.w.authCallback(null);
  assert.equal(h.f.ui.bookDialog.open,false);assert.equal(h.f.state.ratingDrafts.size,0);assert.ok(subs.every(sub=>sub.stopped));h.close();
});
test('dry-run identity report retains references, separates conflicts and never mutates input',async()=>{
  const {identityReport}=await import('../scripts/book-identity-report.mjs');const input={books:[original,{...book,id:'conflict',catalogKey:'/works/OL9W',openLibraryKey:'/works/OL9W'}],shelves:[{...book,ownerId:'alice',id:'personal-id',note:'Keep',status:'read',completedAt:'2025-01-01'}]};const before=JSON.stringify(input);const report=identityReport(input);
  assert.equal(report.mode,'read-only');assert.deepEqual(report.mutations,[]);assert.equal(report.candidatePairs[0].match,'conflicting-identifiers');assert.equal(report.shelves[0].entryId,'personal-id');assert.equal(report.shelves[0].suggestedConversationId,original.id);assert.equal(JSON.stringify(input),before);assert.ok(report.retainedReferences.includes('favorites'));assert.throws(()=>identityReport({books:[original,original],shelves:[]}),/distinct/);
});
