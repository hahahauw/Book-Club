const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const shared = source.slice(source.indexOf('async function existingShelfEntry('), source.indexOf('async function findBookConnections('));
const handler = source.slice(source.indexOf('async function addClubBookToShelf('), source.indexOf('\nfunction openBookDetails('));
const book = { id: 'public-1', title: 'A book', author: 'Author', isbn: '9780000000001', catalogKey: 'openlibrary:OL1W', coverUrl: 'https://example.test/cover.jpg', pageCount: 250, why: 'Another reader’s reason', comments: ['Do not copy'] };
function setup(options = {}) {
  const rows = new Map(); const writes = []; const activities = [];
  const button = { disabled: false }; const message = { textContent: '' }; const select = { value: options.status || 'want-to-read' };
  const form = { querySelector: (selector) => selector === 'button[type="submit"]' ? button : selector === 'select' ? select : message };
  const state = { user: options.guest ? null : { uid: 'owner' } };
  let signIns = 0; let lock = Promise.resolve();
  const context = vm.createContext({
    crypto: require('node:crypto').webcrypto, TextEncoder, state, console: { error() {} }, isMember: () => !!state.user,
    ui: { signIn: { click: () => signIns++ } }, toast() {}, db: {},
    collection: (_, ...path) => path.join('/'), doc: (_, ...path) => ({ path: path.join('/'), id: path.at(-1) }),
    getDocs: async () => { if (options.beforeRead) await options.beforeRead(state); if (options.fail) throw new Error('offline'); return { docs: options.existing ? [{ data: () => options.existing }] : [] }; },
    sameBook: (a, b) => a.catalogKey === b.catalogKey,
    automaticCoverUrl: (b) => b.coverUrl || '', withPageCount: (data, pages) => ({ ...data, ...(pages ? { pageCount: pages } : {}) }),
    serverTimestamp: () => 'SERVER_TIMESTAMP', activityTypeForStatus: (status) => status,
    recordActivity: async (...args) => activities.push(args),
    runTransaction: (_, callback) => {
      const result = lock.then(() => callback({ get: async (ref) => ({ exists: () => rows.has(ref.path), data: () => rows.get(ref.path) }), set: (ref, value) => { rows.set(ref.path, value); writes.push({ ref, value }); } }));
      lock = result.catch(() => {}); return result;
    }
  });
  vm.runInContext(shared + handler, context);
  return { state, writes, activities, message, button, signIns: () => signIns, run: (customForm = form) => context.addClubBookToShelf({ preventDefault() {}, currentTarget: customForm }, book) };
}
for (const status of ['reading', 'read', 'want-to-read']) test(`adds a club book to ${status} with only shelf metadata`, async () => {
  const h = setup({ status }); await h.run();
  assert.equal(h.writes.length, 1); const { ref, value } = h.writes[0];
  assert.match(ref.path, /^memberShelves\/owner\/entries\/book_[a-f0-9]{64}$/);
  assert.equal(value.status, status); assert.equal(value.catalogKey, book.catalogKey); assert.equal(value.isbn, book.isbn);
  assert.equal(value.pageCount, 250); assert.equal(value.note, '');
  assert.equal(value.why, undefined); assert.equal(value.comments, undefined); assert.equal(value.memberId, undefined);
  assert.equal(value.completedAt, status === 'read' ? 'SERVER_TIMESTAMP' : undefined);
  assert.equal(h.activities.length, 1); assert.equal(h.button.disabled, false); assert.match(h.message.textContent, /Added/);
});
test('existing shelf entry is not moved or overwritten', async () => {
  const h = setup({ existing: { ...book, status: 'read', note: 'My own note' } }); await h.run();
  assert.equal(h.writes.length, 0); assert.match(h.message.textContent, /Already on your read shelf/);
});
test('guest is offered sign-in and cannot write', async () => {
  const h = setup({ guest: true }); await h.run(); assert.equal(h.signIns(), 1); assert.equal(h.writes.length, 0);
});
test('double submission and later retry retain a single destination entry', async () => {
  const h = setup(); await Promise.all([h.run(), h.run()]); await h.run();
  assert.equal(h.writes.length, 1); assert.equal(h.activities.length, 1); assert.match(h.message.textContent, /existing entry was kept/);
});
test('two independent forms racing use one transaction destination', async () => {
  const h = setup(); const form2 = { querySelector: (selector) => selector === 'button[type="submit"]' ? { disabled: false } : selector === 'select' ? { value: 'read' } : { textContent: '' } };
  await Promise.all([h.run(), h.run(form2)]); assert.equal(h.writes.length, 1);
});
test('failure restores the button and gives retry feedback', async () => {
  const h = setup({ fail: true }); await h.run(); assert.equal(h.writes.length, 0); assert.equal(h.button.disabled, false); assert.match(h.message.textContent, /try again/);
});
test('account switch during lookup cannot write to either account', async () => {
  const h = setup({ beforeRead: (state) => { state.user = { uid: 'someone-else' }; } }); await h.run();
  assert.equal(h.writes.length, 0); assert.equal(h.button.disabled, false);
});
