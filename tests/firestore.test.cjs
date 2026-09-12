const { test, before, after, beforeEach } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, serverTimestamp, runTransaction } = require('firebase/firestore');

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
