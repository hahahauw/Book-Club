const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
function extract(name) {
  const start = source.search(new RegExp('(?:async )?function ' + name + '\\('));
  const end = source.slice(start + 1).search(/\n(?:async )?function /);
  return source.slice(start, start + 1 + end);
}
function load(context, names) { vm.runInContext(names.map(extract).join('\n'), context); }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('denied storage getters do not break preferences or same-visit changes', () => {
  const window = {};
  for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw Error('Storage denied'); } });
  const c = vm.createContext({ window, preferenceFallback: new Map() });
  load(c, ['readPreference']);
  vm.runInContext(source.slice(source.indexOf('function writePreference('), source.indexOf('\nconst state =')), c);
  assert.equal(c.readPreference('localStorage', 'theme'), null);
  c.writePreference('localStorage', 'theme', 'dark');
  c.writePreference('sessionStorage', 'expanded', true);
  assert.equal(c.readPreference('localStorage', 'theme'), 'dark');
  assert.equal(c.readPreference('sessionStorage', 'expanded'), 'true');
});
test('quota failure preserves new choice while successful storage reads see other-tab changes', () => {
  const data = new Map([['theme', 'light']]); let fail = true;
  const storage = { getItem: key => data.get(key), setItem(key, value) { if (fail) throw Error('Quota'); data.set(key, value); } };
  const c = vm.createContext({ window: { localStorage: storage }, preferenceFallback: new Map() });
  load(c, ['readPreference']);
  vm.runInContext(source.slice(source.indexOf('function writePreference('), source.indexOf('\nconst state =')), c);
  c.writePreference('localStorage', 'theme', 'dark'); assert.equal(c.readPreference('localStorage', 'theme'), 'dark');
  fail = false; c.writePreference('localStorage', 'theme', 'light'); data.set('theme', 'dark');
  assert.equal(c.readPreference('localStorage', 'theme'), 'dark');
});
test('switching catalogue results immediately makes the old book unsaveable and ignores late details', async () => {
  const pending = [deferred(), deferred()];
  const state = { catalogResults: [{ title: 'A', author: 'Author' }, { title: 'B', author: 'Author' }], catalogBook: { title: 'Old' } };
  const ui = { catalogPreview: { hidden: false }, catalogMessage: {}, catalogGenre: {}, catalogPreviewBook: {} };
  const c = vm.createContext({ state, ui, loadCatalogDetails: book => pending[book.title === 'A' ? 0 : 1].promise, catalogCover: () => '', escapeHtml: String, pageCountValue: () => 0, isMember: () => true });
  load(c, ['selectCatalogBook']);
  const first = c.selectCatalogBook(0);
  assert.equal(state.catalogBook, null); assert.equal(ui.catalogPreview.hidden, true);
  const second = c.selectCatalogBook(1);
  pending[1].resolve(state.catalogResults[1]); await second;
  pending[0].resolve(state.catalogResults[0]); await first;
  assert.equal(state.catalogBook.title, 'B'); assert.match(ui.catalogPreviewBook.innerHTML, /<h3>B<\/h3>/);
});
test('new catalogue search clears old selectable results before the network responds', async () => {
  const pending = deferred(); let cleared = false;
  const state = { catalogResults: [{ title: 'Old' }], catalogBook: {} };
  const button = {};
  const ui = { catalogQuery: { value: 'New' }, catalogSearchForm: { querySelector: () => button }, catalogMessage: {}, catalogPreview: {}, catalogResults: { replaceChildren() { cleared = true; } } };
  const c = vm.createContext({ state, ui, searchCatalog: () => pending.promise, renderCatalogResults() {} });
  load(c, ['submitCatalogSearch']); const request = c.submitCatalogSearch({ preventDefault() {} });
  assert.equal(state.catalogResults.length, 0); assert.equal(cleared, true); assert.equal(state.catalogBook, null);
  pending.resolve([]); await request; assert.equal(button.disabled, false);
});
test('catalogue save blocks duplicate submission and restores control states on failure', async () => {
  const pending = deferred(); let writes = 0;
  const controls = [{ disabled: false }, { disabled: true }];
  const state = { catalogBook: { title: 'Book' } };
  const ui = { catalogDestination: { value: 'reading' }, catalogMessage: {}, catalogDialog: { querySelectorAll: () => controls } };
  const c = vm.createContext({ state, ui, isMember: () => true, saveCatalogShelfBook: async () => { writes++; await pending.promise; throw Error('Offline'); }, console: { error() {} } });
  load(c, ['saveCatalogBook']);
  const first = c.saveCatalogBook(); await c.saveCatalogBook();
  assert.equal(writes, 1); assert.ok(controls.every(control => control.disabled));
  pending.resolve(); await first;
  assert.equal(controls[0].disabled, false); assert.equal(controls[1].disabled, true); assert.equal(state.catalogSaving, false);
  assert.equal(ui.catalogMessage.textContent, 'Offline');
});
test('successful catalogue save closes immediately without a delayed close affecting a later session', async () => {
  let closed = 0;
  const c = vm.createContext({ state: { catalogBook: {} }, ui: { catalogDestination: { value: 'reading' }, catalogDialog: { querySelectorAll: () => [] } }, isMember: () => true, saveCatalogShelfBook: async () => true, closeDialog: () => closed++ });
  load(c, ['saveCatalogBook']); await c.saveCatalogBook(); assert.equal(closed, 1);
});
test('manual entry opens own library and keeps selected shelf with an expanded accessible form', async () => {
  let opened, focused = false;
  const state = { user: { uid: 'me' } }, ui = { catalogDestination: { value: 'want-to-read' }, catalogDialog: {}, profileDialog: { open: false } };
  const nodes = { shelfForm: { hidden: true, isConnected: true }, shelfFormToggle: { setAttribute(key, value) { this[key] = value; } }, shelfStatus: {}, shelfTitle: { focus() { focused = true; } } };
  const c = vm.createContext({ state, ui, isMember: () => true, closeDialog() {}, $: id => nodes[id], openProfile: async uid => { opened = uid; state.openProfileId = uid; ui.profileDialog.open = true; }, requestAnimationFrame: fn => fn() });
  load(c, ['openManualCatalogEntry']); await c.openManualCatalogEntry();
  assert.equal(opened, 'me'); assert.equal(nodes.shelfForm.hidden, false); assert.equal(nodes.shelfStatus.value, 'want-to-read');
  assert.equal(nodes.shelfFormToggle['aria-expanded'], 'true'); assert.equal(focused, true);
});
test('profile loading and failed reads both retain a touch-accessible close action', async () => {
  const pending = deferred(), state = {}, ui = { profileDialog: { open: true }, profileContent: {} };
  const c = vm.createContext({ state, ui, db: {}, doc() {}, getDoc: () => pending.promise, escapeHtml: String, console: { error() {} } });
  load(c, ['openProfile']); const request = c.openProfile('missing');
  assert.match(ui.profileContent.innerHTML, /data-close="profileDialog"/);
  pending.resolve({ exists: () => false }); await request;
  assert.match(ui.profileContent.innerHTML, /data-close="profileDialog"/); assert.match(ui.profileContent.innerHTML, /role="status"/);
});
test('nested dialog close and Escape return to each dialog opener', () => {
  const callbacks = [], document = { activeElement: null };
  const node = () => ({ isConnected: true, closest: () => null, focus() { document.activeElement = this; } });
  function dialog() {
    const item = { open: false, children: [], addEventListener(_, fn) { this.onclose = fn; }, showModal() { this.open = true; }, close() { this.open = false; document.activeElement = null; this.onclose(); }, contains(n) { return this.children.includes(n); }, querySelector() { return this.children[0]; } };
    item.children.push(node()); return item;
  }
  const c = vm.createContext({ document, requestAnimationFrame: fn => callbacks.push(fn), dialogTriggers: new WeakMap(), dialogStack: [] });
  load(c, ['showDialog', 'restoreDialogFocus', 'closeDialog']);
  const flush = () => { while (callbacks.length) callbacks.shift()(); };
  const home = node(), parent = dialog(), child = dialog(); home.focus(); c.showDialog(parent); flush();
  const opener = parent.children[0]; c.showDialog(child); flush();
  child.close(); flush(); assert.equal(document.activeElement, opener);
  c.closeDialog(parent); flush(); assert.equal(document.activeElement, home);
});
