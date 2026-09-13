const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const acorn = require('acorn');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync('app.js', 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const catalog = vm.createContext({ URL, URLSearchParams, AbortController, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync('book-catalog.js', 'utf8').replaceAll('export ', ''), catalog);
function harness(names, globals = {}) {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'https://fixture.test', runScripts: 'outside-only' });
  const w = dom.window;
  Object.assign(w, { normalizeCatalogMetadata: catalog.normalizeCatalogMetadata, catalogMetadataNotice: catalog.catalogMetadataNotice, ...globals });
  w.$ = id => w.document.getElementById(id);
  w.ui = Object.fromEntries(['catalogPreview', 'catalogPreviewBook', 'catalogResults', 'catalogQuery', 'catalogMessage', 'catalogGenre', 'catalogGuestName', 'catalogReason', 'catalogShelfNote'].map(id => [id, w.$(id)]));
  w.ui.catalogSave = w.$('catalogSaveButton');
  w.HTMLElement.prototype.scrollIntoView = function(options) { w.lastScrolled = { element: this, options }; };
  w.eval(names.map(name => { const node = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); assert.ok(node, name); return source.slice(node.start, node.end); }).join('\n'));
  return dom;
}
const example = { title: 'A book', author: 'A reader', genre: 'Fiction', synopsis: 'A story.', catalogKey: '/works/OL1W', pageCount: 123, coverUrl: 'https://example.test/cover.jpg' };
for (const index of [0, 8, 17]) test(`selection ${index + 1} focuses details; Back restores the exact result and query`, async () => {
  const state = { catalogResults: Array.from({ length: 18 }, (_, i) => ({ ...example, title: `Book ${i}` })) };
  const dom = harness(['escapeHtml', 'renderCatalogResults', 'selectCatalogBook', 'revealCatalogPreview', 'returnToCatalogResults'], { state, catalogCover: () => '', savedBookBadge: () => '', pageCountValue: Number, loadCatalogDetails: async book => book, isMember: () => true });
  const w = dom.window; w.ui.catalogQuery.value = 'My search'; w.renderCatalogResults();
  await w.selectCatalogBook(index);
  assert.equal(w.ui.catalogResults.hidden, true);
  assert.equal(w.ui.catalogPreview.hidden, false);
  assert.equal(w.document.activeElement.id, 'catalogSelectedTitle');
  assert.equal(w.lastScrolled.element, w.ui.catalogPreview);
  w.returnToCatalogResults();
  assert.equal(w.document.activeElement.dataset.catalogResult, String(index));
  assert.equal(w.ui.catalogQuery.value, 'My search');
  assert.equal(w.ui.catalogResults.children.length, 18);
  assert.equal(w.ui.catalogPreview.hidden, true);
  dom.window.close();
});
test('failed extra details retain a visible, focused and saveable search result', async () => {
  const state = { catalogResults: [example] };
  const dom = harness(['escapeHtml', 'selectCatalogBook', 'revealCatalogPreview'], { state, catalogCover: () => '', loadCatalogDetails: async () => { throw Error('Offline'); }, console: { error() {} } });
  await dom.window.selectCatalogBook(0);
  assert.equal(dom.window.document.activeElement.id, 'catalogSelectedTitle');
  assert.equal(dom.window.ui.catalogSave.disabled, false);
  assert.match(dom.window.ui.catalogMessage.textContent, /still save/);
  dom.window.close();
});
test('metadata respects shared limits, preserves identity, strips nested markup and drops unusable URLs', () => {
  const book = { ...example, title: 'T'.repeat(180), author: ['A'.repeat(110)], genre: 'G'.repeat(100), synopsis: { value: '<p>' + 'S'.repeat(4000) + '</p>' }, coverUrl: 'https://example.test/' + 'x'.repeat(510), source: 'X'.repeat(120), publicationYear: 'Y'.repeat(30) };
  const normalized = catalog.normalizeCatalogMetadata(book);
  for (const [field, maximum] of Object.entries({ title: 160, author: 100, genre: 80, synopsis: 3000, source: 100, publicationYear: 20 })) assert.equal(normalized[field].length, maximum);
  assert.equal(normalized.catalogKey, book.catalogKey);
  assert.equal(normalized.coverUrl, '');
  assert.equal(normalized.pageCount, 123);
  assert.equal(book.title.length, 180, 'provider object is not mutated');
  assert.match(catalog.catalogMetadataNotice(book), /synopsis.*shortened/);
  assert.match(catalog.catalogMetadataNotice(book), /cover link cannot be saved/);
});
test('overlong identifiers are rejected intact and invalid page counts are omitted', () => {
  assert.throws(() => catalog.normalizeCatalogMetadata({ ...example, catalogKey: 'x'.repeat(201) }), /enter the book manually/);
  for (const pageCount of [0, -1, 10001, 'invalid']) assert.equal('pageCount' in catalog.normalizeCatalogMetadata({ ...example, pageCount }), false);
  assert.equal(catalog.normalizeCatalogMetadata({ ...example, coverUrl: 'javascript:alert(1)' }).coverUrl, '');
});
for (const flow of ['saveCatalogShelfBook', 'saveCatalogRecommendation', 'saveGuestCatalogSuggestion']) test(`${flow} writes bounded provider metadata`, async () => {
  let written;
  const state = { user: { uid: 'reader' }, profile: { displayName: 'Reader' }, books: [] };
  const dom = harness([flow], { state, saveSharedRecommendation: async payload => { written = payload; return {id:'entry',changed:true}; }, requireShelfOwner() {}, existingShelfEntry: async () => null, findBookConnections: async () => ({ publicMatches: [], names: new Map(), onOwnShelf: false }), withPageCount: (book, pages) => ({ ...book, pageCount: pages }), createShelfEntry: async (_, payload) => { written = payload; return { added: true, id: 'entry' }; }, addDoc: async (_, payload) => { written = payload; return { id: 'entry' }; }, db: {}, collection: () => ({}), sameBook: () => false, activityTypeForStatus: () => 'started_reading', recordActivity: async () => {}, shelfAddedMessage: () => 'Saved', connectionMessage: () => 'Saved', toast() {} });
  dom.window.ui.catalogGenre.value = 'Fiction'; dom.window.ui.catalogGuestName.value = 'Guest';
  await dom.window[flow]({ ...example, title: 'T'.repeat(170), synopsis: 'S'.repeat(4000) }, 'reading');
  assert.equal(written.title.length, 160); assert.equal(written.synopsis.length, 3000); assert.equal(written.catalogKey, example.catalogKey);
  dom.window.close();
});
test('older pending synopsis can be approved within the public schema, and write failure retains the pending record', async () => {
  for (const fails of [false, true]) {
    let written, deleted = false;
    const state = { pendingBooks: [{ ...example, id: 'pending', name: 'Guest', synopsis: 'S'.repeat(4000) }], books: [] };
    const dom = harness(['reviewPending'], { state, isOfficer: () => true, db: {}, collection: () => ({}), doc: () => ({}), addDoc: async (_, payload) => { written = payload; if (fails) throw Error('Offline'); }, deleteDoc: async () => { deleted = true; }, toast() {}, console: { error() {} } });
    await dom.window.reviewPending('pending', true);
    assert.equal(written.synopsis.length, 3000); assert.equal(deleted, !fails);
    dom.window.close();
  }
});
test('header offset tracks actual height as the header wraps', () => {
  const dom = harness(['updateHeaderOffset']);
  const header = dom.window.document.querySelector('.site-header');
  for (const height of [62, 78.25, 128]) {
    header.getBoundingClientRect = () => ({ height }); dom.window.updateHeaderOffset();
    assert.equal(dom.window.document.documentElement.style.getPropertyValue('--header-offset'), `${Math.ceil(height) + 16}px`);
  }
  dom.window.close();
});
