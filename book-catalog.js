const SEARCH_URL = "https://openlibrary.org/search.json";

function text(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value && typeof value === "object") return value.value || "";
  return String(value || "").trim();
}

function cleanKey(value) {
  return String(value || "").replace(/^\/+/, "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function catalogDocumentId(catalogKey, isbn = "") {
  return `openlibrary-${cleanKey(catalogKey || isbn)}`;
}

function coverUrl(coverId, isbn) {
  if (coverId) return `https://covers.openlibrary.org/b/id/${encodeURIComponent(coverId)}-L.jpg?default=false`;
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;
  return "";
}

function normalizeResult(item) {
  const isbn = Array.isArray(item.isbn) ? item.isbn.find((value) => /^97[89]\d{10}$/.test(String(value))) || item.isbn[0] : "";
  const catalogKey = String(item.key || "").startsWith("/") ? item.key : `/${item.key || ""}`;
  return {
    catalogKey,
    catalogId: catalogDocumentId(catalogKey, isbn),
    title: text(item.title) || "Untitled book",
    author: text(item.author_name) || "Unknown author",
    publicationYear: item.first_publish_year || "",
    isbn: isbn || "",
    coverUrl: coverUrl(item.cover_i, isbn),
    synopsis: text(item.first_sentence),
    genre: text(item.subject?.slice?.(0, 2)),
    source: "Open Library"
  };
}

export async function searchCatalog(query) {
  const term = String(query || "").trim();
  if (term.length < 2) return [];
  const params = new URLSearchParams({
    q: /^97[89]\d{10}$|^\d{9}[\dXx]$/.test(term.replace(/[\s-]/g, "")) ? `isbn:${term.replace(/[\s-]/g, "")}` : term,
    fields: "key,title,author_name,first_publish_year,isbn,cover_i,first_sentence,subject",
    limit: "8"
  });
  const response = await fetch(`${SEARCH_URL}?${params}`);
  if (!response.ok) throw new Error("The book catalogue could not be reached.");
  const data = await response.json();
  return (data.docs || []).map(normalizeResult).filter((book) => book.catalogKey && book.title);
}

export async function loadCatalogDetails(book) {
  if (!book?.catalogKey) return book;
  try {
    const response = await fetch(`https://openlibrary.org${book.catalogKey}.json`);
    if (!response.ok) return book;
    const work = await response.json();
    const synopsis = text(work.description) || book.synopsis;
    const subjects = Array.isArray(work.subjects) ? work.subjects.slice(0, 2).join(", ") : book.genre;
    return { ...book, synopsis, genre: subjects || book.genre };
  } catch {
    return book;
  }
}
