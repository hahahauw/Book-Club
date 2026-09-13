// Conversation identity is separate from shelf ownership and edition metadata.
// Text similarity suggests a choice; it never authorizes an automatic merge.
export function identityText(value) {
  return String(value || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function identifiers(book) {
  const work = [book.openLibraryKey, book.catalogKey].map(value => String(value || "")).find(value => /^\/works\/OL\d+W$/.test(value)) || "";
  const isbn = String(book.isbn || "").replace(/[\s-]/g, "").toUpperCase();
  return { work, isbn: /^(?:\d{9}[\dX]|\d{13})$/.test(isbn) ? isbn : "", google: String(book.googleBooksId || ""), catalogue: String(book.catalogKey || "") };
}
export function bookMatch(first, second) {
  const a = identifiers(first), b = identifiers(second);
  const sameText = identityText(first.title) && identityText(first.author) && identityText(first.title) === identityText(second.title) && identityText(first.author) === identityText(second.author);
  const sameId = Object.keys(a).some(key => a[key] && a[key] === b[key]);
  if (a.work && b.work && a.work !== b.work) return sameText || sameId ? "conflicting-identifiers" : null;
  if (sameId) return "identifier";
  return sameText ? "title-author" : null;
}
export function bookConnections(book, books) {
  return books.map(candidate => ({ book: candidate, match: bookMatch(book, candidate) })).filter(item => item.match).sort((a, b) => String(a.book.id).localeCompare(String(b.book.id)));
}
export function automaticConversation(connections) {
  const exact = connections.filter(item => item.match === "identifier");
  return exact.length === 1 ? exact[0].book : null;
}
export function sharedBookIdentity(book) {
  const ids = identifiers(book);
  for (const key of ["work", "isbn", "google", "catalogue"]) if (ids[key]) return JSON.stringify([key, ids[key]]);
  const title = identityText(book.title), author = identityText(book.author);
  if (!title || !author) throw new Error("A title and author are required.");
  return JSON.stringify(["title-author", title, author]);
}
