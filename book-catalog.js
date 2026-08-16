const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const GOOGLE_BOOKS_SEARCH_URL = "https://www.googleapis.com/books/v1/volumes";
const REQUEST_TIMEOUT = 9000;

function text(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value && typeof value === "object") return value.value || "";
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanKey(value) {
  return String(value || "").replace(/^\/+/, "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function normalizeIsbn(value) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = values.map((item) => String(item || "").replace(/[^0-9X]/gi, ""));
  return normalized.find((item) => /^97[89]\d{10}$/.test(item)) || normalized.find((item) => /^\d{9}[\dX]$/i.test(item)) || "";
}

function identity(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function secureUrl(value) {
  return String(value || "").replace(/^http:/, "https:");
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Catalogue request failed (${response.status}).`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function catalogDocumentId(catalogKey, bookIsbn = "") {
  const value = String(catalogKey || "");
  const google = value.startsWith("googlebooks:");
  return `${google ? "googlebooks" : "openlibrary"}-${cleanKey(google ? value.slice("googlebooks:".length) : (value || bookIsbn))}`;
}

export function sameBook(first, second) {
  if (first?.catalogKey && second?.catalogKey && first.catalogKey === second.catalogKey) return true;
  const firstIsbn = normalizeIsbn(first?.isbn), secondIsbn = normalizeIsbn(second?.isbn);
  if (firstIsbn && secondIsbn && firstIsbn === secondIsbn) return true;
  return Boolean(identity(first?.title) && identity(first?.author)
    && identity(first.title) === identity(second?.title)
    && identity(first.author) === identity(second?.author));
}

function openLibraryCover(coverId, bookIsbn) {
  if (coverId) return `https://covers.openlibrary.org/b/id/${encodeURIComponent(coverId)}-L.jpg?default=false`;
  if (bookIsbn) return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(bookIsbn)}-L.jpg?default=false`;
  return "";
}

function normalizeOpenLibrary(item) {
  const bookIsbn = normalizeIsbn(item.isbn);
  const openLibraryKey = String(item.key || "").startsWith("/") ? item.key : `/${item.key || ""}`;
  return {
    catalogKey: openLibraryKey,
    catalogId: catalogDocumentId(openLibraryKey, bookIsbn),
    openLibraryKey,
    googleBooksId: "",
    title: text(item.title) || "Untitled book",
    author: text(item.author_name) || "Unknown author",
    publicationYear: item.first_publish_year || "",
    isbn: bookIsbn,
    coverUrl: openLibraryCover(item.cover_i, bookIsbn),
    synopsis: text(item.first_sentence),
    genre: text(item.subject?.slice?.(0, 2)),
    source: "Open Library",
    sources: ["Open Library"]
  };
}

function normalizeGoogleBooks(item) {
  const info = item.volumeInfo || {};
  const identifiers = (info.industryIdentifiers || []).map((entry) => entry.identifier);
  const bookIsbn = normalizeIsbn(identifiers);
  const catalogKey = `googlebooks:${item.id || bookIsbn}`;
  return {
    catalogKey,
    catalogId: catalogDocumentId(catalogKey, bookIsbn),
    openLibraryKey: "",
    googleBooksId: item.id || "",
    title: text(info.title) || "Untitled book",
    author: text(info.authors) || "Unknown author",
    publicationYear: String(info.publishedDate || "").slice(0, 4),
    isbn: bookIsbn,
    coverUrl: secureUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail),
    synopsis: text(info.description),
    genre: text(info.categories?.slice?.(0, 2)),
    source: "Google Books",
    sources: ["Google Books"]
  };
}

function quality(book) {
  return (book.coverUrl ? 2 : 0) + (book.synopsis ? Math.min(book.synopsis.length / 200, 3) : 0) + (book.genre ? 1 : 0) + (book.isbn ? 1 : 0);
}

function mergeBook(first, second) {
  const preferred = quality(second) > quality(first) ? second : first;
  const alternate = preferred === first ? second : first;
  const sources = [...new Set([...(first.sources || [first.source]), ...(second.sources || [second.source])].filter(Boolean))];
  return {
    ...preferred,
    publicationYear: preferred.publicationYear || alternate.publicationYear,
    isbn: preferred.isbn || alternate.isbn,
    coverUrl: preferred.coverUrl || alternate.coverUrl,
    synopsis: String(preferred.synopsis || "").length >= String(alternate.synopsis || "").length ? preferred.synopsis : alternate.synopsis,
    genre: preferred.genre || alternate.genre,
    openLibraryKey: first.openLibraryKey || second.openLibraryKey,
    googleBooksId: first.googleBooksId || second.googleBooksId,
    source: sources.join(" + "),
    sources
  };
}

function mergeResults(results) {
  return results.reduce((books, candidate) => {
    const match = books.findIndex((book) => sameBook(book, candidate));
    if (match === -1) books.push(candidate);
    else books[match] = mergeBook(books[match], candidate);
    return books;
  }, []);
}

async function searchOpenLibrary(term) {
  const compact = term.replace(/[\s-]/g, "");
  const params = new URLSearchParams({ q: /^97[89]\d{10}$|^\d{9}[\dXx]$/.test(compact) ? `isbn:${compact}` : term, fields: "key,title,author_name,first_publish_year,isbn,cover_i,first_sentence,subject", limit: "10" });
  const data = await fetchJson(`${OPEN_LIBRARY_SEARCH_URL}?${params}`);
  return (data.docs || []).map(normalizeOpenLibrary).filter((book) => book.openLibraryKey && book.title);
}

async function searchGoogleBooks(term, apiKey) {
  const compact = term.replace(/[\s-]/g, "");
  const params = new URLSearchParams({ q: /^97[89]\d{10}$|^\d{9}[\dXx]$/.test(compact) ? `isbn:${compact}` : term, maxResults: "10", printType: "books", projection: "full", key: apiKey });
  const data = await fetchJson(`${GOOGLE_BOOKS_SEARCH_URL}?${params}`);
  return (data.items || []).map(normalizeGoogleBooks).filter((book) => book.googleBooksId && book.title);
}

export async function searchCatalog(query, options = {}) {
  const term = String(query || "").trim();
  if (term.length < 2) return [];
  const searches = [searchOpenLibrary(term)];
  if (options.googleBooksApiKey) searches.push(searchGoogleBooks(term, options.googleBooksApiKey));
  const settled = await Promise.allSettled(searches);
  const books = settled.filter((result) => result.status === "fulfilled").flatMap((result) => result.value);
  if (!books.length && settled.every((result) => result.status === "rejected")) throw new Error("The book catalogues could not be reached. Manual entry still works.");
  return mergeResults(books).slice(0, 12);
}

export async function loadCatalogDetails(book) {
  if (!book?.openLibraryKey) return book;
  try {
    const work = await fetchJson(`https://openlibrary.org${book.openLibraryKey}.json`);
    const synopsis = text(work.description);
    const genre = Array.isArray(work.subjects) ? work.subjects.slice(0, 2).join(", ") : "";
    return { ...book, synopsis: synopsis.length > String(book.synopsis || "").length ? synopsis : book.synopsis, genre: book.genre || genre };
  } catch {
    return book;
  }
}
