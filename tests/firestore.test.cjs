const { test, before, after, beforeEach } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, serverTimestamp, runTransaction, collection, getDocs } = require('firebase/firestore');

let env;
const profile = (role = 'member') => ({ displayName: 'Reader', photoURL: '', joinedAt: '2026-09-10', role, bio: '', themeColor: '#abcdef' });
const shelf = { title: 'Book', author: 'Author', coverUrl: '', status: 'reading', note: '', date: '2026-09-10' };
const note = { name: 'Guest', text: 'A recommendation', date: '2026-09-10' };
const db = (uid) => uid ? env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore() : env.unauthenticatedContext().firestore();
before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085') throw new Error('Tests require the local emulator at 127.0.0.1:8085.');
  env = await initializeTestEnvironment({ projectId: 'demo-bec-security', firestore: {
    host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8')
  } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const store = context.firestore();
    await Promise.all([
      setDoc(doc(store, 'members/alice'), profile()),
      setDoc(doc(store, 'members/bob'), profile()),
      setDoc(doc(store, 'members/officer'), profile('officer')),
      setDoc(doc(store, 'books/book'), { title: 'Book', comments: [note] }),
      setDoc(doc(store, 'events/event'), { title: 'Meeting', date: '2026-09-12', details: '', rsvpGoing: 0, rsvpMaybe: 0, rsvpCantAttend: 0 }),
      setDoc(doc(store, 'memberPrivate/alice'), { email: 'alice@example.test' })
    ]);
  });
});
after(async () => { if (env) await env.cleanup(); });

test('normalized catalogue metadata fits shelf, guest and officer publication schemas', async () => {
  const { normalizeCatalogMetadata } = await import(pathToFileURL(resolve(__dirname, '../book-catalog.js')).href);
  const metadata = normalizeCatalogMetadata({ title: 'T'.repeat(180), author: 'A'.repeat(120), genre: 'G'.repeat(100), synopsis: 'S'.repeat(4000), catalogKey: '/works/OL1W', pageCount: 250 });
  await assertSucceeds(setDoc(doc(db('alice'), 'memberShelves/alice/entries/catalogue'), { ...metadata, status: 'reading', note: '', date: '2026-09-12' }));
  await assertSucceeds(setDoc(doc(db(), 'pendingBooks/catalogue'), { ...metadata, name: 'Guest', why: '', comments: [], date: '2026-09-12', submittedAt: '2026-09-12', status: 'pending' }));
  await assertSucceeds(setDoc(doc(db('officer'), 'books/approved'), { ...metadata, memberName: 'Guest', name: 'Guest', why: '', comments: [], date: '2026-09-12' }));
});

test('public shelf disclosure matches current rules even when summary cards are hidden', async () => {
  await assertSucceeds(updateDoc(doc(db('alice'), 'members/alice'), { showReadingStats: false }));
  await assertSucceeds(setDoc(doc(db('alice'), 'memberShelves/alice/entries/public-note'), { ...shelf, note: 'A public thought' }));
  await assertSucceeds(getDoc(doc(db(), 'memberShelves/alice/entries/public-note')));
  await assertSucceeds(getDoc(doc(db('bob'), 'memberShelves/alice/entries/public-note')));
});

test('owner can create manual and catalogue shelves, then move a book', async () => {
  const ref = doc(db('alice'), 'memberShelves/alice/entries/entry');
  await assertSucceeds(setDoc(ref, shelf));
  await assertSucceeds(updateDoc(ref, { status: 'read', completedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(ref, { ...shelf, catalogKey: 'isbn:9780140328721', isbn: '9780140328721', publicationYear: 1988, pageCount: 240, source: 'openlibrary' }));
});
test('shelf rejects foreign writes, forged IDs, unexpected fields, and malformed metadata', async () => {
  await assertFails(setDoc(doc(db('bob'), 'memberShelves/alice/entries/entry'), shelf));
  await assertFails(setDoc(doc(db(), 'memberShelves/alice/entries/entry'), shelf));
  for (const invalid of [{ id: 'victim' }, { role: 'officer' }, { catalogKey: {} }, { isbn: 'x'.repeat(21) }]) {
    await assertFails(setDoc(doc(db('alice'), 'memberShelves/alice/entries/entry'), { ...shelf, ...invalid }));
  }
});
test('members cannot append to legacy arrays; officers can preserve a guest note', async () => {
  const added = { ...note, text: 'Another note' };
  await assertFails(updateDoc(doc(db('alice'), 'books/book'), { comments: [note, added] }));
  await assertSucceeds(updateDoc(doc(db('officer'), 'books/book'), { comments: [note, added] }));
});
test('legacy append cannot reorder or replace history, or insert an invalid earlier element', async () => {
  const ref = doc(db('officer'), 'books/book');
  const added = { ...note, text: 'Another note' };
  await assertFails(updateDoc(ref, { comments: [null, note] }));
  await assertFails(updateDoc(ref, { comments: [added, note] }));
  await assertFails(updateDoc(ref, { comments: [{ ...note, text: 'Changed' }, added] }));
  await assertFails(updateDoc(ref, { comments: [] }));
});
test('members can post immutable threaded comments and replies but cannot spoof names', async () => {
  const store = db('alice');
  const comment = { memberId: 'alice', name: 'Reader', text: 'Thoughts', createdAt: serverTimestamp(), parentId: '', rootId: 'root', spoiler: false, spoilerScope: '' };
  await assertSucceeds(setDoc(doc(store, 'books/book/comments/root'), comment));
  await assertSucceeds(setDoc(doc(store, 'books/book/comments/reply'), { ...comment, parentId: 'root' }));
  await assertFails(setDoc(doc(store, 'books/book/comments/spoof'), { ...comment, rootId: 'spoof', name: 'Someone else' }));
  await assertFails(updateDoc(doc(store, 'books/book/comments/root'), { text: 'Edited' }));
});
test('role escalation and private email reads remain denied', async () => {
  await assertFails(updateDoc(doc(db('alice'), 'members/alice'), { role: 'officer' }));
  await assertFails(getDoc(doc(db('bob'), 'memberPrivate/alice')));
  await assertSucceeds(getDoc(doc(db('alice'), 'memberPrivate/alice')));
});
test('RSVP atomic transition remains allowed and independent count edits remain denied', async () => {
  const store = db('alice'), event = doc(store, 'events/event'), rsvp = doc(store, 'members/alice/eventRsvps/event');
  await assertFails(updateDoc(event, { rsvpGoing: 10 }));
  await assertSucceeds(runTransaction(store, async (transaction) => {
    const snapshot = await transaction.get(event);
    transaction.set(rsvp, { memberId: 'alice', eventId: 'event', status: 'going', updatedAt: serverTimestamp() });
    transaction.update(event, { rsvpGoing: snapshot.data().rsvpGoing + 1 });
  }));
});


test('ratings belong to any existing shared book, while foreign, guest and orphan writes are denied', async () => {
  const rating = { memberId: 'alice', displayName: 'Reader', stars: 4, finished: true, comment: 'Historical monthly note', updatedAt: '2026-09-13' };
  // No currentPick setting exists in this fixture: ordinary shared books can be rated.
  const store = db('alice'), ref = doc(store, 'bookOfMonthRatings/book/members/alice');
  await assertSucceeds(setDoc(ref, rating));
  await assertSucceeds(runTransaction(store, async transaction => {
    const before = await transaction.get(ref); transaction.set(ref, { ...before.data(), stars: 5 });
  }));
  const saved = (await getDoc(ref)).data();
  require('node:assert/strict').equal(saved.comment, rating.comment);
  require('node:assert/strict').equal(saved.finished, true);
  await assertFails(setDoc(doc(db('bob'), 'bookOfMonthRatings/book/members/alice'), rating));
  await assertFails(setDoc(doc(db(), 'bookOfMonthRatings/book/members/alice'), rating));
  await assertFails(setDoc(doc(db('alice'), 'bookOfMonthRatings/missing/members/alice'), rating));
  await assertFails(setDoc(ref, { ...rating, stars: 0 }));
});
test('recommendations require a parent book and cannot be written for another reader', async () => {
  const reason = { memberId: 'alice', displayName: 'Reader', reason: 'A reason', createdAt: '2026-09-13', updatedAt: '2026-09-13' };
  await assertSucceeds(setDoc(doc(db('alice'), 'books/book/recommendations/alice'), reason));
  await assertFails(setDoc(doc(db('alice'), 'books/missing/recommendations/alice'), reason));
  await assertFails(setDoc(doc(db('bob'), 'books/book/recommendations/alice'), reason));
  await assertFails(setDoc(doc(db(), 'books/book/recommendations/alice'), reason));
  await assertFails(updateDoc(doc(db('alice'), 'books/book'), { title: 'Changed by recommender' }));
});
test('production shared publication transaction creates one book and one recommendation during concurrent saves', async () => {
  const assert = require('node:assert/strict');
  const source = readFileSync(resolve(__dirname, '../app.js'), 'utf8');
  const ast = require('acorn').parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const extract = name => { const node = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); return source.slice(node.start, node.end); };
  const identity = await import(pathToFileURL(resolve(__dirname, '../book-identity.js')).href);
  const catalog = await import(pathToFileURL(resolve(__dirname, '../book-catalog.js')).href);
  const state = { user: { uid: 'alice' }, profile: { role: 'member', displayName: 'Reader' } };
  const dependencies = { state, db: db('alice'), collection, getDocs, doc, runTransaction, ...identity, normalizeCatalogMetadata: catalog.normalizeCatalogMetadata, recordActivity: async () => {}, crypto: require('node:crypto').webcrypto, TextEncoder, console };
  const save = Function(...Object.keys(dependencies), ['isMember','requireShelfOwner','escapeHtml','conversationLabel','recommendationChoice','saveSharedRecommendation'].map(extract).join('\n') + '\nreturn saveSharedRecommendation;')(...Object.values(dependencies));
  const metadata = { title: 'Shared transaction book', author: 'Author', catalogKey: '/works/OL88W', genre: 'Fiction', coverUrl: '', synopsis: 'Keep this context.' };
  const container = { querySelector: () => null };
  const [a,b] = await Promise.all([save(metadata, 'My reason', container), save(metadata, 'My reason', container)]);
  assert.equal(a.id,b.id);
  assert.equal((await getDocs(collection(db(), 'books'))).docs.filter(row => row.data().title === metadata.title).length,1);
  const publicBook = doc(db(), 'books', a.id), originalData = (await getDoc(publicBook)).data();
  assert.equal(originalData.why, '');
  state.user = { uid: 'bob' };
  dependencies.db = db('bob');
  const saveAsBob = Function(...Object.keys(dependencies), ['isMember','requireShelfOwner','escapeHtml','conversationLabel','recommendationChoice','saveSharedRecommendation'].map(extract).join('\n') + '\nreturn saveSharedRecommendation;')(...Object.values(dependencies));
  const second = await saveAsBob(metadata, 'Another reader', container);
  assert.equal(second.id, a.id);
  assert.equal((await getDocs(collection(db(), 'books', a.id, 'recommendations'))).size, 2);
  assert.deepEqual((await getDoc(publicBook)).data(), originalData);
});
