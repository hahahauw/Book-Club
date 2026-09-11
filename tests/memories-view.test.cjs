const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const functions = source.slice(source.indexOf('function updateMemoryView('), source.indexOf('function resetMemoryEditor('));
function setup(hash = '') {
  const nodes = {};
  for (const id of ['homeContent','memories','memoriesHeading','top','events','memoryPhotoTitle','memoryPhotoContent','memoryPhotoDialog']) nodes[id] = { hidden: id === 'memories', focused: false, scrolled: false, focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; } };
  const links = ['#top','#memories','#events'].map(href => ({ href, getAttribute() { return href; }, setAttribute(_, value) { this.current = value; }, removeAttribute() { delete this.current; } }));
  let shown = 0; let notices = [];
  const context = vm.createContext({ $, location: { hash }, document: { querySelectorAll: () => links }, window: { scrollTo() {} },
    requestAnimationFrame: fn => fn(), updateShelfNavigation() {},
    state: { memories: [] }, ui: { memories: { classList: { toggle() {} } } },
    safeImageUrl: value => String(value || '').startsWith('https://') ? value : '',
    optimizedImageUrl: value => value, escapeHtml: value => String(value || '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    showDialog: dialog => { dialog.open = true; shown++; }, toast: value => notices.push(value),
    recentFirst: rows => rows, memoryAssociationMarkup: () => '', isOfficer: () => false, renderEvents() {}
  });
  function $(id) { return nodes[id]; }
  vm.runInContext(functions, context);
  return { context, nodes, links, shown: () => shown, notices };
}
test('direct Memories route hides the homepage and selects its navigation link', () => {
  const h = setup('#memories'); h.context.updateMemoryView(false);
  assert.equal(h.nodes.homeContent.hidden, true); assert.equal(h.nodes.memories.hidden, false); assert.equal(h.links[1].current, 'page');
});
test('route transitions restore Events and support returning to Memories', () => {
  const h = setup('#memories'); h.context.updateMemoryView(); h.context.location.hash = '#events'; h.context.updateMemoryView();
  assert.equal(h.nodes.homeContent.hidden, false); assert.equal(h.nodes.memories.hidden, true); assert.equal(h.nodes.events.scrolled, true);
  h.context.location.hash = '#memories'; h.context.updateMemoryView(); assert.equal(h.nodes.memoriesHeading.focused, true);
});
test('malformed return hash safely falls back to the homepage', () => {
  const h = setup('#memories'); h.context.updateMemoryView(false); h.context.location.hash = '#%broken'; h.context.updateMemoryView(); assert.equal(h.nodes.top.scrolled, true);
});
test('photo viewer uses escaped content and the original link', () => {
  const h = setup('#memories'); h.context.state.memories = [{ id: 'photo', title: '<img onerror=x>', imageUrl: 'https://example.test/photo.jpg' }]; h.context.openMemoryPhoto('photo');
  assert.equal(h.shown(), 1); assert.equal(h.nodes.memoryPhotoTitle.textContent, '<img onerror=x>');
  assert.match(h.nodes.memoryPhotoContent.innerHTML, /&lt;img onerror=x&gt;/); assert.match(h.nodes.memoryPhotoContent.innerHTML, /rel="noopener noreferrer"/);
});
test('missing and unsafe photos do not open an unsafe resource', () => {
  const h = setup('#memories'); h.context.openMemoryPhoto('missing'); assert.equal(h.shown(), 0); assert.equal(h.notices.length, 1);
  h.context.state.memories = [{ id: 'bad', imageUrl: 'javascript:alert(1)' }]; h.context.openMemoryPhoto('bad'); assert.doesNotMatch(h.nodes.memoryPhotoContent.innerHTML, /javascript:|<img/);
});
test('gallery photos are keyboard buttons and empty gallery has feedback', () => {
  const h = setup(); h.context.renderMemories(); assert.match(h.context.ui.memories.innerHTML, /empty-state/);
  h.context.state.memories = [{ id: 'p', title: 'A club day', imageUrl: 'https://example.test/p.jpg' }]; h.context.renderMemories();
  assert.match(h.context.ui.memories.innerHTML, /<button type="button" class="memory-photo"/); assert.match(h.context.ui.memories.innerHTML, /data-memory-focus="p"/);
});
test('gallery is outside homepage wrapper with desktop and mobile entry points', () => {
  assert.equal((html.match(/href="#memories"/g) || []).length, 2);
  assert.match(html, /<section id="memories"[^>]+ hidden>/);
  assert.equal((html.match(/id="memoryForm"/g) || []).length, 1);
  assert.equal((html.match(/id="memoriesGrid"/g) || []).length, 1);
  assert.match(html, /<dialog id="memoryPhotoDialog"[^>]+aria-labelledby="memoryPhotoTitle"/);
});
