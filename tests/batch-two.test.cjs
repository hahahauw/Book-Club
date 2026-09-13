const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync('app.js', 'utf8').replace(/^import .*?;\n/gm, '');
const html = fs.readFileSync('index.html', 'utf8');
function setup(hash = '', overrides = {}) {
  const dom = new JSDOM(html, { url: 'https://fixture.test/' + hash, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, subscriptions = [], reads = [];
  w.matchMedia = () => ({ matches: false }); w.requestAnimationFrame = fn => fn();
  w.HTMLElement.prototype.scrollIntoView = function() { w.lastScrolled = this.id; };
  w.HTMLElement.prototype.scrollTo = function() {}; w.HTMLElement.prototype.scrollBy = function() {};
  w.HTMLDialogElement.prototype.showModal = function() { this.open = true; }; w.HTMLDialogElement.prototype.close = function() { this.open = false; };
  Object.assign(w, { initializeApp: () => ({}), getFirestore: () => ({}), getAuth: () => ({}), onAuthStateChanged() {},
    collection: (_, ...path) => path.join('/'), collectionGroup: (_, name) => 'group:' + name, doc: (_, ...path) => path.join('/'), query: (...args) => args, where: (...args) => args, orderBy: (...args) => args, limit: n => n,
    onSnapshot(ref) { subscriptions.push(ref); return () => {}; },
    getDocs: async ref => { reads.push(ref); return { docs: [] }; }, getDoc: async ref => { reads.push(ref); return { exists: () => false }; },
    sameBook: (a,b) => a.title === b.title, ...overrides });
  w.eval(source + '\nwindow.fixture={state,ui,setAuthUi,updateMemoryView,loadClubArchive,renderBoard,renderReadingGoal,renderBooks,renderCommunityNotice,periodReadingStats,dashboardSummaryMarkup};');
  return { dom, w, f: w.fixture, subscriptions, reads, close: () => dom.window.close() };
}
const pages = ['homeContent','libraryPage','readersPage','communityPage','archivePage','memories'];
for (const [hash, page, nav] of [['#shelf','homeContent','#shelf'],['#library','libraryPage','#library'],['#members','readersPage','#members'],['#events','communityPage','#community'],['#monthHeading','communityPage','#community'],['#announcementHeading','communityPage','#community'],['#memories','memories','#community'],['#board','archivePage','#community'],['#readingGoal','archivePage','#community'],['#%broken','homeContent','#shelf']]) {
  test(`${hash} reveals only its destination with matching desktop/mobile navigation`, async () => {
    const h=setup(hash), d=h.w.document;
    assert.deepEqual(pages.filter(id => !d.getElementById(id).hidden), [page]);
    for(const selector of ['.desktop-nav','.mobile-nav']) assert.equal(d.querySelector(selector+' [aria-current="page"]').getAttribute('href'),nav);
    const focused=d.activeElement;
    assert.match(focused.tagName,/H1|H2/); assert.equal(focused.closest('[hidden]'),null);
    await new Promise(resolve=>setImmediate(resolve));
    h.close();
  });
}
test('homepage prioritizes books; dashboard and active posting/goal controls are absent', () => {
  const h=setup(),d=h.w.document;
  assert.ok(d.querySelector('#homeContent #shelf'));
  for(const selector of ['#personalDashboard','#activity','#events','#board','#readingGoal','.feature-section','.announcement-section']) assert.equal(d.querySelector('#homeContent '+selector),null);
  assert.equal(d.getElementById('discoveryCollectionsPanel').open,false);
  for(const id of ['boardForm','readingGoalForm','readingGoalEndButton']) assert.equal(d.getElementById(id),null);
  assert.equal(new Set([...d.querySelectorAll('[id]')].map(n=>n.id)).size,d.querySelectorAll('[id]').length);
  assert.ok(h.subscriptions.every(ref=>!JSON.stringify(ref).match(/boardPosts|readingGoal|group:entries/)));
  assert.equal(h.reads.length,0,'retired content is not fetched at startup');
  h.close();
});
test('library keeps a guest sign-in explanation and reveals the reading desk after member access', () => {
  const h=setup('#library'),d=h.w.document; h.f.setAuthUi();
  assert.equal(d.getElementById('libraryGuest').hidden,false);assert.equal(h.f.ui.dashboard.hidden,true);
  h.f.state.user={uid:'reader'};h.f.state.profile={role:'member',displayName:'Reader'};h.f.setAuthUi();
  assert.equal(d.getElementById('libraryGuest').hidden,true);assert.equal(h.f.ui.dashboard.hidden,false);
  assert.equal(d.getElementById('libraryPage').hidden,false);
  assert.equal(d.getElementById('communityManagement').hidden,true);
  h.f.state.profile.role='officer';h.f.setAuthUi();assert.equal(d.getElementById('communityManagement').hidden,false);
  h.f.state.user=null;h.f.state.profile=null;h.f.setAuthUi();assert.equal(d.getElementById('libraryGuest').hidden,false);
  h.close();
});
test('route round trip preserves shelf filters and curated-collection disclosure', () => {
  const h=setup('#discovery'),d=h.w.document;
  assert.equal(d.getElementById('discoveryCollectionsPanel').open,true);
  d.getElementById('bookSearch').value='Unfinished search';
  h.w.history.replaceState(null,'','#events');h.f.updateMemoryView();
  h.w.history.replaceState(null,'','#shelf');h.f.updateMemoryView();
  assert.equal(d.getElementById('bookSearch').value,'Unfinished search');
  assert.equal(d.getElementById('discoveryCollectionsPanel').open,true);
  h.close();
});
test('archive reads once, keeps authoritative IDs, and renders no write controls even for an officer', async () => {
  let boardReads=0,goalReads=0;
  const h=setup('',{getDocs:async()=>{boardReads++;return {docs:[{id:'actual',data:()=>({id:'forged',text:'<img src=x>',displayName:'Reader'})}]};},getDoc:async()=>{goalReads++;return {exists:()=>true,data:()=>({title:'Old challenge',active:true,target:20,finalProgress:0})};}});
  h.f.state.profile={role:'officer'};h.f.state.user={uid:'officer'};
  await h.f.loadClubArchive();await h.f.loadClubArchive();
  assert.equal(boardReads,1);assert.equal(goalReads,1);assert.equal(h.f.state.boardPosts[0].id,'actual');
  assert.equal(h.f.ui.pinBoard.querySelector('button'),null);assert.equal(h.f.ui.pinBoard.querySelector('img'),null);
  assert.match(h.f.ui.pinBoard.textContent,/<img src=x>/);
  assert.match(h.f.ui.readingGoalContent.textContent,/without a final total/);
  assert.equal(h.w.document.getElementById('archiveRetry').hidden,true);
  h.close();
});
test('partial archive failure preserves the successful content and permits retry', async () => {
  let fail=true;
  const h=setup('',{getDocs:async()=>{if(fail)throw Error('Offline');return {docs:[]};},getDoc:async()=>({exists:()=>true,data:()=>({title:'Finished challenge',active:false,target:20,finalProgress:17})})});
  await h.f.loadClubArchive();assert.match(h.f.ui.readingGoalContent.textContent,/17 books/);assert.equal(h.f.state.archiveLoaded,false);
  assert.equal(h.w.document.getElementById('archiveRetry').hidden,false);
  fail=false;await h.f.loadClubArchive();assert.equal(h.f.state.archiveLoaded,true);
  h.close();
});
test('concurrent archive entry does not duplicate reads; leaving the archive cannot reveal it later', async () => {
  let finish,reads=0;const pending=new Promise(resolve=>{finish=resolve;});
  const h=setup('',{getDocs:async()=>{reads++;await pending;return {docs:[]};}});
  h.w.history.replaceState(null,'','#archive');h.f.updateMemoryView();
  const duplicate=h.f.loadClubArchive();await duplicate;assert.equal(reads,1);
  h.w.history.replaceState(null,'','#shelf');h.f.updateMemoryView();finish();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.w.document.getElementById('archivePage').hidden,true);assert.equal(h.w.document.getElementById('homeContent').hidden,false);
  h.close();
});
test('period history derives only dated shelf finishes and does not claim historical highest ratings', () => {
  const h=setup();const start=new Date(2026,8,1),end=new Date(2026,9,1);
  const stats=h.f.periodReadingStats([{status:'read',completedAt:new Date(2026,8,10),pageCount:120},{status:'read',pageCount:300}],start,end);
  assert.equal(stats.completed.length,1);assert.equal(stats.pages,120);
  assert.doesNotMatch(h.f.dashboardSummaryMarkup('September',stats,'Empty'),/highest rated|★/);
  h.close();
});
test('book labels and saved status are outside the fixed cover frame', () => {
  const h=setup(),d=h.w.document;
  h.f.state.books=[{id:'book',title:'Long book title',author:'Reader',date:'2026-09-12',genre:'Fiction'}];h.f.renderBooks();
  const card=d.querySelector('.book-card');assert.ok(card.querySelector('.shelf-cover .fallback-cover'));
  assert.equal(card.querySelector('.shelf-cover .shelf-book-copy'),null);
  assert.equal(card.querySelector('.shelf-book-copy strong').textContent,'Long book title');
  assert.equal(card.querySelector('.shelf-book-copy small').textContent,'Reader');h.close();
});
