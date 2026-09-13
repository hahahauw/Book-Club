// Read-only diagnostic. Accepts a deliberately exported JSON file, never database credentials.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { bookConnections, automaticConversation } from '../book-identity.js';
export function identityReport(input) {
  if (!Array.isArray(input.books) || !Array.isArray(input.shelves)) throw new Error('Expected books[] and shelves[] arrays. See SHARED_BOOKS.md.');
  const ids = new Set();
  for (const book of input.books) {
    if (typeof book.id !== 'string' || !book.id || ids.has(book.id)) throw new Error('Public books must have distinct, nonempty document IDs.');
    ids.add(book.id);
  }
  const pairs = input.books.flatMap((book, index) => bookConnections(book, input.books.slice(index + 1)).map(item => ({ bookIds: [book.id, item.book.id], match: item.match, action: 'review; keep both records and their threads' })));
  const shelves = input.shelves.map(entry => {
    if (!entry.ownerId || !entry.id) throw new Error('Shelf records need ownerId and the original entry id.');
    const candidates = bookConnections(entry, input.books), selected = automaticConversation(candidates);
    return { ownerId: entry.ownerId, entryId: entry.id, suggestedConversationId: selected?.id || null, confidence: selected ? 'shared identifier; metadata review still advised' : candidates.length ? 'manual choice required' : 'no public conversation found', candidates: candidates.map(item => ({ bookId: item.book.id, match: item.match })), preserveEntryId: true };
  });
  return { mode: 'read-only', counts: { publicBooks: input.books.length, shelfEntries: input.shelves.length, candidatePairs: pairs.length }, candidatePairs: pairs, shelves, retainedReferences: ['public book IDs', 'shelf entry IDs', 'favorites', 'legacy comments', 'threaded comments and replies', 'monthly ratings and notes', 'recommendations', 'activities', 'notifications', 'memory book links', 'current pick'], mutations: [] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/book-identity-report.mjs exported-books-and-shelves.json');
    process.stdout.write(JSON.stringify(identityReport(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2) + '\n');
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
