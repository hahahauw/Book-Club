import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, collectionGroup, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, arrayUnion, onSnapshot, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { searchCatalog, loadCatalogDetails, sameBook } from "./book-catalog.js?v=2";

const firebaseConfig = {
  apiKey: "AIzaSyA-G9WsH-sMdTzXvylNSJ1b-l5XkjBEol4",
  authDomain: "book-enthusiast-club.firebaseapp.com",
  projectId: "book-enthusiast-club",
  storageBucket: "book-enthusiast-club.firebasestorage.app",
  messagingSenderId: "100530002767",
  appId: "1:100530002767:web:4c65036568a65dc154c33a"
};

const $ = (id) => document.getElementById(id);
const ui = {
  authStatus: $("authStatus"), signIn: $("signInButton"), signOut: $("signOutButton"), profile: $("profileButton"), theme: $("themeButton"), toast: $("toast"),
  announcementText: $("announcementText"), announcementForm: $("announcementForm"), announcementInput: $("announcementInput"), announcementStatus: $("announcementStatus"),
  month: $("bookOfMonth"), monthCommunity: $("monthCommunity"), monthRating: $("monthRating"), monthProgress: $("monthProgress"), monthForm: $("monthForm"), monthStars: $("monthStars"), monthFinished: $("monthFinished"), monthComment: $("monthComment"), monthMessage: $("monthMessage"), monthNotes: $("monthNotes"), monthOfficer: $("monthOfficer"), monthPicker: $("monthPicker"), saveMonth: $("saveMonthButton"),
  books: $("booksGrid"), shelfResultStatus: $("shelfResultStatus"), search: $("bookSearch"), genre: $("genreFilter"), openPending: $("openPendingButton"), pendingCount: $("pendingCount"), pendingDialog: $("pendingDialog"), pendingList: $("pendingList"),
  events: $("eventsList"), eventForm: $("eventForm"), eventTitle: $("eventTitle"), eventDate: $("eventDate"), eventDetails: $("eventDetails"),
  boardForm: $("boardForm"), boardText: $("boardText"), boardStatus: $("boardStatus"), boardGuestHint: $("boardGuestHint"), pinBoard: $("pinBoard"),
  memories: $("memoriesGrid"), memoryForm: $("memoryForm"), memoryImage: $("memoryImage"), memoryFile: $("memoryFile"), memoryCaption: $("memoryCaption"), memoryCategory: $("memoryCategory"), inviteForm: $("inviteForm"), inviteEmail: $("inviteEmail"),
  uploadSettingsForm: $("uploadSettingsForm"), cloudName: $("cloudName"), uploadPreset: $("uploadPreset"), googleBooksKey: $("googleBooksKey"), uploadSettingsStatus: $("uploadSettingsStatus"), suggestionHint: $("suggestionHint"),
  members: $("membersGrid"), suggestionDialog: $("suggestionDialog"), suggestionForm: $("suggestionForm"), suggestionMessage: $("suggestionMessage"), catalogDialog: $("catalogDialog"), catalogSearchForm: $("catalogSearchForm"), catalogQuery: $("catalogQuery"), catalogResults: $("catalogResults"), catalogPreview: $("catalogPreview"), catalogPreviewBook: $("catalogPreviewBook"), catalogDestinationGroup: $("catalogDestinationGroup"), catalogDestination: $("catalogDestination"), catalogGuestNameGroup: $("catalogGuestNameGroup"), catalogGuestName: $("catalogGuestName"), catalogGenre: $("catalogGenre"), catalogShelfNoteGroup: $("catalogShelfNoteGroup"), catalogShelfNote: $("catalogShelfNote"), catalogReasonGroup: $("catalogReasonGroup"), catalogReason: $("catalogReason"), catalogSave: $("catalogSaveButton"), catalogManual: $("catalogManualButton"), catalogMessage: $("catalogMessage"), bookDialog: $("bookDialog"), bookContent: $("bookContent"), profileDialog: $("profileDialog"), profileContent: $("profileContent")
};

const state = { user: null, profile: null, books: [], members: [], pendingBooks: [], currentPickId: null, monthAccent: "#d8e66f", ratings: [], monthRecommendationWhy: "", announcement: "", events: [], memories: [], boardPosts: [], shelfEntries: [], search: "", genre: "", openProfileId: null, stopRatings: null, stopMonthReasons: null, stopShelf: null, stopPending: null, lastDialogTrigger: null, cloudName: localStorage.getItem("becCloudName") || "", uploadPreset: localStorage.getItem("becUploadPreset") || "bookclub_unsigned", googleBooksKey: "", catalogResults: [], catalogBook: null, catalogTarget: "recommendation", catalogDuplicateConfirmation: "" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function escapeHtml(value) { const box = document.createElement("div"); box.textContent = String(value ?? ""); return box.innerHTML; }
function initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function color(value) { return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#ed7857"; }
function dateLabel(value) { const date = new Date(`${value || ""}T12:00:00`); return Number.isNaN(date.valueOf()) ? "Date to be announced" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function dateTimeLabel(value) { const date = new Date(value || ""); return Number.isNaN(date.valueOf()) ? "Recently" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }); }
function recentFirst(items) { return [...items].sort((a, b) => String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""))); }
function isMember() { return Boolean(state.user && ["member", "officer"].includes(state.profile?.role)); }
function isOfficer() { return state.profile?.role === "officer"; }
function toast(message) {
  ui.toast.textContent = message;
  if (ui.toast.showPopover && !ui.toast.matches(":popover-open")) ui.toast.showPopover();
  ui.toast.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    ui.toast.classList.remove("visible");
    if (ui.toast.hidePopover && ui.toast.matches(":popover-open")) ui.toast.hidePopover();
  }, 4200);
}
function showDialog(dialog, focusTarget) { state.lastDialogTrigger = document.activeElement; dialog.showModal(); requestAnimationFrame(() => (focusTarget || dialog.querySelector("input,select,textarea,button"))?.focus()); }
function closeDialog(dialog) { if (!dialog?.open) return; dialog.close(); const trigger = state.lastDialogTrigger; state.lastDialogTrigger = null; if (trigger?.isConnected) requestAnimationFrame(() => trigger.focus()); }
async function runBusy(button, busyText, action) { if (!button || button.disabled) return; const label = button.textContent; button.disabled = true; if (busyText) button.textContent = busyText; try { return await action(); } finally { button.disabled = false; button.textContent = label; } }
function setAuthUi() { const name = state.profile?.displayName || state.user?.displayName || "reader"; ui.authStatus.textContent = isMember() ? `Hello, ${name}` : state.user ? "Signed in — member access pending" : "Exploring as a guest"; ui.signIn.hidden = Boolean(state.user); ui.signOut.hidden = !state.user; ui.profile.hidden = !isMember(); ui.monthOfficer.hidden = !isOfficer(); ui.eventForm.hidden = !isOfficer(); ui.memoryForm.hidden = !isOfficer(); ui.inviteForm.hidden = !isOfficer(); ui.uploadSettingsForm.hidden = !isOfficer(); ui.announcementForm.hidden = !isOfficer(); ui.openPending.hidden = !isOfficer(); ui.boardForm.hidden = !isMember(); ui.boardGuestHint.hidden = isMember(); ui.monthForm.hidden = !isMember(); ui.monthMessage.hidden = !isMember(); ui.suggestionHint.textContent = isMember() ? "Search two catalogues, then add the result to the club shelf or your personal library." : "Everyone can search the catalogue. Guest suggestions are sent to officers for review."; if (isOfficer()) { ensureMonthAccentControl(); ui.cloudName.value = state.cloudName; ui.uploadPreset.value = state.uploadPreset; ui.googleBooksKey.value = state.googleBooksKey; ui.announcementInput.value = state.announcement; } syncPendingSubscription(); renderMonth(); renderEvents(); renderMemories(); renderBoard(); renderPending(); }

function optimizedImageUrl(url, width = 600) {
  const value = String(url || "");
  if (/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(value)) return value.replace(/\/image\/upload\//i, `/image/upload/f_auto,q_auto,c_limit,w_${Math.round(width)}/`);
  if (width <= 240 && /covers\.openlibrary\.org\/.*-L\.jpg/i.test(value)) return value.replace(/-L\.jpg/i, "-M.jpg");
  return value;
}
function coverMarkup(url, title, className = "", loading = "lazy") { return url ? `<img class="${className}" src="${escapeHtml(optimizedImageUrl(url, 600))}" alt="Cover of ${escapeHtml(title)}" loading="${loading}" decoding="async" width="400" height="600">` : `<div class="fallback-cover">${escapeHtml(title)}</div>`; }
function renderBooks() {
  const allGenres = [...new Set(state.books.map((book) => String(book.genre || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const selected = state.genre; ui.genre.innerHTML = '<option value="">All genres</option>' + allGenres.map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join(""); ui.genre.value = selected;
  const term = state.search.toLowerCase();
  const books = recentFirst(state.books).filter((book) => (!state.genre || book.genre === state.genre) && (!term || [book.title, book.author, book.genre, book.name, book.memberName].some((value) => String(value || "").toLowerCase().includes(term))));
  ui.shelfResultStatus.textContent = `${books.length} book${books.length === 1 ? "" : "s"} shown.`;
  ui.books.innerHTML = books.length ? books.map((book) => `<button type="button" class="book-card" data-book-id="${book.id}" aria-label="Open ${escapeHtml(book.title)}">${coverMarkup(book.coverUrl, book.title)}<span>${escapeHtml(book.title)}</span></button>`).join("") : `<p class="empty-state">${state.books.length ? "No books match that search." : "The shelf is ready for its first recommendation."}</p>`;
  ui.monthPicker.innerHTML = '<option value="">Choose a book</option>' + recentFirst(state.books).map((book) => `<option value="${book.id}" ${book.id === state.currentPickId ? "selected" : ""}>${escapeHtml(book.title)} — ${escapeHtml(book.author)}</option>`).join("");
  renderMonth();
}

function renderPending() {
  ui.pendingCount.textContent = String(state.pendingBooks.length);
  ui.pendingList.innerHTML = state.pendingBooks.length ? recentFirst(state.pendingBooks).map((book) => {
    const duplicate = state.books.some((item) => sameBook(item, book));
    return `<article class="pending-item"><div><p class="eyebrow">${duplicate ? "ALREADY ON THE CLUB SHELF" : "NEW GUEST SUGGESTION"}</p><h3>${escapeHtml(book.title || "Untitled book")}</h3><p>by ${escapeHtml(book.author || "Unknown author")}${book.genre ? ` · ${escapeHtml(book.genre)}` : ""}</p>${book.why ? `<blockquote>${escapeHtml(book.why)}</blockquote>` : ""}<small>Suggested by ${escapeHtml(book.name || "a guest reader")}</small></div><div class="pending-actions"><button type="button" class="button" data-approve-pending="${book.id}">${duplicate ? "Add note to existing book" : "Approve"}</button><button type="button" class="text-button" data-reject-pending="${book.id}">Reject</button></div></article>`;
  }).join("") : '<p class="empty-state">The guest suggestion queue is clear.</p>';
}
function syncPendingSubscription() {
  if (!isOfficer()) {
    state.stopPending?.(); state.stopPending = null; state.pendingBooks = []; renderPending(); return;
  }
  if (state.stopPending) return;
  state.stopPending = onSnapshot(collection(db, "pendingBooks"), (snapshot) => { state.pendingBooks = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderPending(); }, (error) => { console.error(error); ui.pendingList.innerHTML = '<p class="empty-state">The review queue could not load. Check the published rules.</p>'; });
}
async function reviewPending(id, approve) {
  if (!isOfficer()) return;
  const pending = state.pendingBooks.find((item) => item.id === id); if (!pending) return;
  if (!approve && !window.confirm(`Reject “${pending.title || "this suggestion"}”?`)) return;
  try {
    if (approve) {
      const existing = state.books.find((book) => sameBook(book, pending));
      if (existing) {
        if (String(pending.why || "").trim()) await updateDoc(doc(db, "books", existing.id), { comments: arrayUnion({ name: pending.name || "Guest reader", text: String(pending.why).trim().slice(0, 500), date: new Date().toISOString() }) });
        toast(existing && pending.why ? "Added the guest’s note to the existing book discussion." : "That book was already on the shelf, so no duplicate was created.");
      } else {
        await addDoc(collection(db, "books"), { name: pending.name || "Guest reader", memberName: pending.name || "Guest reader", title: pending.title || "Untitled book", author: pending.author || "Unknown author", genre: pending.genre || "", coverUrl: pending.coverUrl || "", why: pending.why || "", synopsis: pending.synopsis || "", catalogKey: pending.catalogKey || "", catalogId: pending.catalogId || "", openLibraryKey: pending.openLibraryKey || "", googleBooksId: pending.googleBooksId || "", isbn: pending.isbn || "", publicationYear: String(pending.publicationYear || ""), source: pending.source || "", date: pending.date || new Date().toISOString(), comments: [] });
        toast("Guest suggestion approved and added to the shelf.");
      }
    }
    await deleteDoc(doc(db, "pendingBooks", id));
    if (!approve) toast("Guest suggestion rejected.");
  } catch (error) { console.error(error); toast("Could not update that guest suggestion."); }
}

function currentBook() { return state.books.find((book) => book.id === state.currentPickId); }
function renderMonth() {
  const book = currentBook();
  if (!book) { ui.month.innerHTML = '<div class="month-cover placeholder-cover">The next<br>club read</div><div><p class="eyebrow">CHOSEN BY THE CLUB</p><h3>Waiting for the next chapter.</h3><p>When an officer chooses a book from the shelf, it will appear here with reader progress and discussion.</p></div>'; ui.monthCommunity.hidden = true; return; }
  ui.month.style.setProperty("--month-accent", state.monthAccent);
  const reason = book.why || state.monthRecommendationWhy || "";
  const recommender = book.memberName || book.name || "a club member";
  const story = [
    reason ? `<div class="month-description"><strong>Why ${escapeHtml(recommender)} recommends it</strong><p>${escapeHtml(reason)}</p></div>` : "",
    book.synopsis ? `<div class="month-description"><strong>About the book</strong><p>${escapeHtml(book.synopsis)}</p></div>` : "",
    !reason && !book.synopsis ? '<p>Read along at your own pace, then leave a rating or discussion note.</p>' : ""
  ].join("");
  ui.month.innerHTML = `<div class="month-cover">${coverMarkup(book.coverUrl, book.title, "", "eager")}</div><div><p class="eyebrow">BOOK OF THE MONTH</p><h3>${escapeHtml(book.title)}</h3><p>by ${escapeHtml(book.author)}</p>${story}<button type="button" class="text-button month-details" data-book-id="${escapeHtml(book.id)}">Open book details</button></div>`;
  ui.monthCommunity.hidden = false;
  ui.monthForm.hidden = !isMember(); ui.monthMessage.hidden = !isMember();
  const count = Math.max(state.members.length, 1), finished = state.ratings.filter((item) => item.finished).length;
  const average = state.ratings.length ? (state.ratings.reduce((sum, item) => sum + Number(item.stars || 0), 0) / state.ratings.length).toFixed(1) : "";
  ui.monthRating.textContent = average ? `${"★".repeat(Math.round(average))} ${average}/5` : "No ratings yet";
  ui.monthProgress.textContent = `${Math.round((finished / count) * 100)}% finished`;
  const mine = state.ratings.find((item) => item.memberId === state.user?.uid);
  if (mine) { ui.monthStars.value = String(mine.stars || 5); ui.monthFinished.checked = Boolean(mine.finished); ui.monthComment.value = mine.comment || ""; }
  else { ui.monthStars.value = "5"; ui.monthFinished.checked = false; ui.monthComment.value = ""; }
  ui.monthNotes.innerHTML = state.ratings.filter((item) => item.comment).length ? state.ratings.filter((item) => item.comment).map((item) => `<article class="month-note"><strong>${escapeHtml(item.displayName || "Club member")}</strong><span>${"★".repeat(Number(item.stars || 0))}</span><p>${escapeHtml(item.comment)}</p></article>`).join("") : '<p class="empty-state">No discussion notes yet. Be the first to leave one.</p>';
}
function subscribeRatings() { state.stopRatings?.(); state.ratings = []; const book = currentBook(); if (!book) return renderMonth(); state.stopRatings = onSnapshot(collection(db, "bookOfMonthRatings", book.id, "members"), (snapshot) => { state.ratings = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderMonth(); }, () => { ui.monthNotes.innerHTML = '<p class="empty-state">Ratings are unavailable right now.</p>'; }); }
function subscribeMonthRecommendation() { state.stopMonthReasons?.(); state.monthRecommendationWhy = ""; const book = currentBook(); if (!book) return renderMonth(); state.stopMonthReasons = onSnapshot(collection(db, "books", book.id, "recommendations"), (snapshot) => { state.monthRecommendationWhy = snapshot.docs.map((entry) => entry.data().reason).find(Boolean) || ""; renderMonth(); }, () => renderMonth()); }

function ensureMonthAccentControl() { if ($("monthAccent")) return; const label = document.createElement("label"); label.innerHTML = 'Highlight colour <input id="monthAccent" type="color" aria-label="Book of the Month highlight colour">'; ui.monthOfficer.prepend(label); $("monthAccent").value = state.monthAccent; }

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("becTheme", theme);
  const nextTheme = theme === "dark" ? "light" : "dark";
  ui.theme.textContent = `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} mode`;
  ui.theme.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#162b28" : "#17332f");
}
function configuredUpload() { return Boolean(state.cloudName && state.uploadPreset); }
async function uploadImage(file) {
  if (!file) return "";
  if (!configuredUpload()) throw new Error("An officer needs to save Cloudinary upload settings first.");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Please choose an image smaller than 8 MB.");
  const data = new FormData(); data.append("file", file); data.append("upload_preset", state.uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(state.cloudName)}/image/upload`, { method: "POST", body: data });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Image upload failed.");
  return result.secure_url;
}
async function saveUploadSettings(event) {
  event.preventDefault();
  if (!isOfficer()) return;
  const button = ui.uploadSettingsForm.querySelector("button[type=submit]");
  await runBusy(button, "Saving…", async () => {
    try {
      state.cloudName = ui.cloudName.value.trim();
      state.uploadPreset = ui.uploadPreset.value.trim() || "bookclub_unsigned";
      state.googleBooksKey = ui.googleBooksKey.value.trim();
      localStorage.setItem("becCloudName", state.cloudName);
      localStorage.setItem("becUploadPreset", state.uploadPreset);
      await setDoc(doc(db, "siteSettings", "catalog"), {
        cloudName: state.cloudName,
        uploadPreset: state.uploadPreset,
        googleBooksApiKey: state.googleBooksKey,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      ui.uploadSettingsStatus.textContent = "Saved for this club. Never enter a private Cloudinary secret here.";
    } catch (error) {
      console.error(error);
      ui.uploadSettingsStatus.textContent = "Could not save these integrations. Check the published Firestore rules.";
    }
  });
}
function ensureSuggestionUpload() { if ($("suggestFile")) return; const label = document.createElement("label"); label.textContent = "Upload a cover "; const input = document.createElement("input"); input.id = "suggestFile"; input.type = "file"; input.accept = "image/*"; label.append(input); $("suggestCover").closest("label").after(label); }
function prepareSuggestionForm() { ensureSuggestionUpload(); const signedMember = isMember(); $("suggestName").readOnly = signedMember; $("suggestName").value = signedMember ? (state.profile.displayName || "Club member") : ""; }

function catalogCover(book, className) { return book.coverUrl ? `<img src="${escapeHtml(optimizedImageUrl(book.coverUrl, 240))}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy" decoding="async" width="160" height="240">` : `<span class="${className}">${escapeHtml(book.title)}</span>`; }
function openCatalog(target = "recommendation") {
  state.catalogTarget = target; state.catalogResults = []; state.catalogBook = null; state.catalogDuplicateConfirmation = "";
  ui.catalogResults.innerHTML = ""; ui.catalogPreview.hidden = true; ui.catalogMessage.textContent = ""; ui.catalogSearchForm.reset(); ui.catalogGuestName.value = ""; ui.catalogGenre.value = ""; ui.catalogShelfNote.value = ""; ui.catalogReason.value = "";
  ui.catalogDestination.value = isMember() && target === "shelf" ? "reading" : "recommendation"; updateCatalogDestination(); showDialog(ui.catalogDialog, ui.catalogQuery);
}
function updateCatalogDestination() {
  const guest = !isMember(); const recommendation = guest || ui.catalogDestination.value === "recommendation";
  ui.catalogDestinationGroup.hidden = guest; ui.catalogGuestNameGroup.hidden = !guest;
  ui.catalogReasonGroup.hidden = !recommendation; ui.catalogShelfNoteGroup.hidden = recommendation;
  ui.catalogSave.textContent = guest ? "Send for officer review" : recommendation ? "Add club recommendation" : "Add to my shelf";
  state.catalogDuplicateConfirmation = "";
}
function renderCatalogResults() {
  ui.catalogResults.innerHTML = state.catalogResults.length ? state.catalogResults.map((book, index) => `<button type="button" class="catalog-result" data-catalog-result="${index}">${catalogCover(book, "catalog-result-cover")}<span><strong>${escapeHtml(book.title)}</strong><small>by ${escapeHtml(book.author)}</small><small>${book.publicationYear ? `First published ${escapeHtml(book.publicationYear)}` : "Publication date unavailable"}${book.isbn ? ` · ISBN ${escapeHtml(book.isbn)}` : ""}</small><span class="catalog-source">${escapeHtml(book.source || "Book catalogue")}</span></span></button>`).join("") : '<p class="empty-state">No matches yet. Try a title, author, or ISBN—or enter it manually.</p>';
}
async function submitCatalogSearch(event) {
  event.preventDefault(); const term = ui.catalogQuery.value.trim(); if (term.length < 2) return;
  const button = ui.catalogSearchForm.querySelector("button"); button.disabled = true; ui.catalogMessage.textContent = state.googleBooksKey ? "Searching Open Library and Google Books…" : "Searching Open Library…"; ui.catalogPreview.hidden = true; state.catalogBook = null;
  try { state.catalogResults = await searchCatalog(term, { googleBooksApiKey: state.googleBooksKey }); renderCatalogResults(); ui.catalogMessage.textContent = state.catalogResults.length ? "Choose the edition that looks right." : "No match found. You can enter this book manually."; }
  catch (error) { console.error(error); state.catalogResults = []; renderCatalogResults(); ui.catalogMessage.textContent = error.message || "The catalogue is unavailable right now. Manual entry still works."; }
  finally { button.disabled = false; }
}
async function selectCatalogBook(index) {
  const result = state.catalogResults[index]; if (!result) return;
  ui.catalogMessage.textContent = "Loading book details…";
  try {
    const book = await loadCatalogDetails(result); state.catalogBook = book; state.catalogDuplicateConfirmation = ""; ui.catalogGenre.value = String(book.genre || "").slice(0, 80);
    ui.catalogPreviewBook.innerHTML = `<div class="catalog-preview-book">${catalogCover(book, "catalog-preview-cover")}<div><p class="eyebrow">${escapeHtml(book.source || "BOOK CATALOGUE")}</p><h3>${escapeHtml(book.title)}</h3><p>by ${escapeHtml(book.author)}</p><p class="catalog-meta">${book.publicationYear ? `First published ${escapeHtml(book.publicationYear)}` : "Publication date unavailable"}${book.isbn ? ` · ISBN ${escapeHtml(book.isbn)}` : ""}</p>${book.synopsis ? `<p>${escapeHtml(book.synopsis)}</p>` : '<p class="catalog-meta">No synopsis is available for this edition.</p>'}</div></div>`;
    ui.catalogPreview.hidden = false; ui.catalogMessage.textContent = isMember() ? "Check the details, then choose where to save it." : "Check the details, then send it to the officers for review.";
  } catch (error) {
    console.error(error);
    state.catalogBook = result;
    ui.catalogGenre.value = String(result.genre || "").slice(0, 80);
    ui.catalogPreviewBook.innerHTML = `<div class="catalog-preview-book">${catalogCover(result, "catalog-preview-cover")}<div><p class="eyebrow">${escapeHtml(result.source || "BOOK CATALOGUE")}</p><h3>${escapeHtml(result.title)}</h3><p>by ${escapeHtml(result.author)}</p><p class="catalog-meta">Extra details are temporarily unavailable.</p></div></div>`;
    ui.catalogPreview.hidden = false;
    ui.catalogMessage.textContent = "Extra details could not load, but you can still save this result or use manual entry.";
  }
}
async function existingShelfEntry(book) {
  if (book.catalogKey) {
    const shelf = await getDocs(query(collection(db, "memberShelves", state.user.uid, "entries"), where("catalogKey", "==", book.catalogKey), limit(1)));
    if (!shelf.empty) return { id: shelf.docs[0].id, ...shelf.docs[0].data() };
  }
  const legacy = await getDocs(collection(db, "memberShelves", state.user.uid, "entries"));
  return legacy.docs.map((entry) => ({ id: entry.id, ...entry.data() })).find((entry) => sameBook(entry, book)) || null;
}
async function saveCatalogShelfBook(book, status) {
  const existing = await existingShelfEntry(book); const key = `${existing?.id || "new"}:${status}`;
  if (existing && existing.status === status) { ui.catalogMessage.textContent = `This book is already on your ${String(status).replace(/-/g, " ")} shelf.`; return false; }
  if (existing && state.catalogDuplicateConfirmation !== key) { state.catalogDuplicateConfirmation = key; ui.catalogMessage.textContent = `This book is already on your ${String(existing.status || "reading").replace(/-/g, " ")} shelf. Press the button again to move it.`; return false; }
  const metadata = { title: book.title, author: book.author, genre: ui.catalogGenre.value.trim() || existing?.genre || "", coverUrl: book.coverUrl || existing?.coverUrl || "", catalogKey: book.catalogKey || "", catalogId: book.catalogId || "", openLibraryKey: book.openLibraryKey || "", googleBooksId: book.googleBooksId || "", isbn: book.isbn || "", publicationYear: String(book.publicationYear || ""), synopsis: book.synopsis || "", source: book.source || "", status, note: ui.catalogShelfNote.value.trim() || existing?.note || "", date: existing?.date || new Date().toISOString() };
  if (existing) { await setDoc(doc(db, "memberShelves", state.user.uid, "entries", existing.id), metadata, { merge: true }); ui.catalogMessage.textContent = "Moved your existing shelf entry."; toast("Your shelf is keeping up with your reading life."); }
  else { await addDoc(collection(db, "memberShelves", state.user.uid, "entries"), metadata); ui.catalogMessage.textContent = "Added to your personal shelf."; toast("Added to your personal shelf — your library is growing."); }
  return true;
}
async function findBookConnections(book) {
  const publicMatches = state.books.filter((item) => sameBook(item, book));
  const names = new Map(); let onOwnShelf = false;
  publicMatches.forEach((item) => { const name = item.memberName || item.name; if (name) names.set(item.memberId || `name:${name}`, name); });
  try {
    const personalShelves = await getDocs(collectionGroup(db, "entries"));
    personalShelves.docs.forEach((entry) => { const item = entry.data(); if (!sameBook(item, book)) return; const ownerId = entry.ref.parent.parent?.id; if (ownerId === state.user.uid) onOwnShelf = true; else { const member = state.members.find((profile) => profile.id === ownerId); names.set(ownerId || `shelf:${entry.id}`, member?.displayName || "another member"); } });
  } catch (error) { console.warn("Personal-shelf match skipped:", error); }
  return { publicMatches, names, onOwnShelf };
}
function connectionMessage(names, onOwnShelf) {
  const otherNames = [...names.values()].filter((name) => name !== state.profile?.displayName);
  return otherNames.length ? `${otherNames[0]}${otherNames.length > 1 ? ` and ${otherNames.length - 1} other member${otherNames.length === 2 ? "" : "s"}` : ""} also recommend${otherNames.length === 1 ? "s" : ""} this book.` : onOwnShelf ? "This book is already on your personal shelf too — now the club can discover it." : "Your recommendation is now part of the club shelf.";
}
async function saveCatalogRecommendation(book) {
  const { publicMatches, names, onOwnShelf } = await findBookConnections(book);
  if (publicMatches.some((item) => item.memberId === state.user.uid)) { ui.catalogMessage.textContent = "You already recommended this book, so another copy was not added."; toast(ui.catalogMessage.textContent); return false; }
  await addDoc(collection(db, "books"), { title: book.title, author: book.author, genre: ui.catalogGenre.value.trim(), coverUrl: book.coverUrl || "", synopsis: book.synopsis || "", why: ui.catalogReason.value.trim(), memberId: state.user.uid, memberName: state.profile.displayName || "Club member", catalogKey: book.catalogKey || "", catalogId: book.catalogId || "", openLibraryKey: book.openLibraryKey || "", googleBooksId: book.googleBooksId || "", isbn: book.isbn || "", publicationYear: String(book.publicationYear || ""), source: book.source || "Book catalogue", date: new Date().toISOString(), comments: [] });
  const reaction = connectionMessage(names, onOwnShelf);
  ui.catalogMessage.textContent = reaction; toast(reaction);
  return true;
}
async function saveGuestCatalogSuggestion(book) {
  const name = ui.catalogGuestName.value.trim();
  if (!name) { ui.catalogMessage.textContent = "Please add your name before sending this suggestion."; ui.catalogGuestName.focus(); return false; }
  const publicMatch = state.books.find((item) => sameBook(item, book));
  await addDoc(collection(db, "pendingBooks"), {
    name, title: book.title || "Untitled book", author: book.author || "Unknown author", genre: ui.catalogGenre.value.trim(), coverUrl: book.coverUrl || "", why: ui.catalogReason.value.trim(), synopsis: book.synopsis || "", catalogKey: book.catalogKey || "", catalogId: book.catalogId || "", openLibraryKey: book.openLibraryKey || "", googleBooksId: book.googleBooksId || "", isbn: book.isbn || "", publicationYear: String(book.publicationYear || ""), source: book.source || "Book catalogue", date: new Date().toISOString(), comments: [], submittedAt: new Date().toISOString(), status: "pending"
  });
  const message = publicMatch ? `This book is already on the club shelf. Your note was sent to the officers for review.` : "Thanks — your suggestion was sent to the officers for review.";
  ui.catalogMessage.textContent = message; toast(message); return true;
}
async function saveCatalogBook() {
  const book = state.catalogBook; if (!book) return;
  ui.catalogSave.disabled = true;
  try { const saved = !isMember() ? await saveGuestCatalogSuggestion(book) : ui.catalogDestination.value === "recommendation" ? await saveCatalogRecommendation(book) : await saveCatalogShelfBook(book, ui.catalogDestination.value); if (saved) setTimeout(() => closeDialog(ui.catalogDialog), 900); }
  catch (error) { console.error(error); ui.catalogMessage.textContent = error.message || "Could not save this book."; }
  finally { ui.catalogSave.disabled = false; }
}
function openManualCatalogEntry() {
  const target = isMember() ? ui.catalogDestination.value : "recommendation"; closeDialog(ui.catalogDialog);
  if (target === "recommendation") { prepareSuggestionForm(); showDialog(ui.suggestionDialog, $("suggestTitle")); return; }
  const shelfForm = $("shelfForm"); if (shelfForm) { shelfForm.hidden = false; $("shelfTitle")?.focus(); } else toast("Open My library, then choose Add a book to enter it manually.");
}

async function signIn() { ui.signIn.disabled = true; ui.authStatus.textContent = "Opening Google sign-in…"; try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (error) { console.error(error); ui.authStatus.textContent = "Could not sign in. Please try again."; } finally { ui.signIn.disabled = false; } }
async function ensureProfile(user) {
  const ref = doc(db, "members", user.uid); const existing = await getDoc(ref);
  if (existing.exists()) {
    const profile = existing.data();
    if (["member", "officer"].includes(profile.role)) return profile;
    // Older library cards did not have a role. Complete that one-time migration
    // using the signed-in owner's existing public-card values, never Google data.
    const migrated = { displayName: profile.displayName || "Club member", photoURL: profile.photoURL || "", joinedAt: profile.joinedAt || new Date().toISOString(), role: "member", bio: profile.bio || "", themeColor: profile.themeColor || "", clubTitle: "", favoriteGenre: profile.favoriteGenre || "", currentlyReading: profile.currentlyReading || "" };
    await setDoc(ref, migrated, { merge: true });
    return { ...profile, ...migrated };
  }
  const profile = { displayName: "Club member", photoURL: "", joinedAt: new Date().toISOString(), role: "member", bio: "", themeColor: "", clubTitle: "", favoriteGenre: "", currentlyReading: "" };
  await setDoc(ref, profile);
  try { await setDoc(doc(db, "memberPrivate", user.uid), { email: String(user.email || "") }); }
  catch (error) { console.warn("Private member mapping could not be saved:", error); }
  return profile;
}
onAuthStateChanged(auth, async (user) => {
  state.user = user; state.profile = null;
  if (!user) return setAuthUi();
  try { state.profile = await ensureProfile(user); if (!isMember()) toast("Your member record needs an officer to restore its role."); }
  catch (error) { console.error("Member setup:", error); await signOut(auth); toast(error.code === "permission-denied" ? "This Google account is not on the invited member list." : "Could not finish member sign-in."); }
  setAuthUi();
});

async function submitSuggestion(event) {
  event.preventDefault(); const chosenFile = $("suggestFile")?.files?.[0]; const book = { name: $("suggestName").value.trim(), title: $("suggestTitle").value.trim(), author: $("suggestAuthor").value.trim(), genre: $("suggestGenre").value.trim(), coverUrl: $("suggestCover").value.trim(), why: $("suggestWhy").value.trim(), date: new Date().toISOString(), comments: [] };
  if (!book.name || !book.title || !book.author) return;
  const button = ui.suggestionForm.querySelector("button[type=submit]"); button.disabled = true;
  try {
    if (chosenFile) { ui.suggestionMessage.textContent = "Uploading cover…"; book.coverUrl = await uploadImage(chosenFile); }
    if (isMember()) {
      const { publicMatches, names, onOwnShelf } = await findBookConnections(book);
      if (publicMatches.some((item) => item.memberId === state.user.uid)) { ui.suggestionMessage.textContent = "You already recommended this book, so another copy was not added."; return; }
      await addDoc(collection(db, "books"), { ...book, memberId: state.user.uid, memberName: state.profile.displayName });
      const reaction = connectionMessage(names, onOwnShelf); ui.suggestionMessage.textContent = reaction; toast(reaction);
    } else {
      await addDoc(collection(db, "pendingBooks"), { ...book, submittedAt: new Date().toISOString(), status: "pending" });
      ui.suggestionMessage.textContent = "Sent to officers for review. Thank you!";
    }
    ui.suggestionForm.reset();
  }
  catch (error) { console.error(error); ui.suggestionMessage.textContent = error.message || "Could not send the suggestion."; }
  finally { button.disabled = false; }
}
async function saveRating(event) {
  event.preventDefault(); const book = currentBook(); if (!book) return;
  if (!isMember()) { ui.monthMessage.textContent = "Sign in with an invited member account to save an update."; return; }
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Saving…", async () => {
    try { await setDoc(doc(db, "bookOfMonthRatings", book.id, "members", state.user.uid), { memberId: state.user.uid, displayName: state.profile.displayName, stars: Number(ui.monthStars.value), finished: ui.monthFinished.checked, comment: ui.monthComment.value.trim(), updatedAt: new Date().toISOString() }); ui.monthMessage.textContent = "Your update is saved."; }
    catch (error) { console.error(error); ui.monthMessage.textContent = "Could not save your update."; }
  });
}
async function saveMonth() {
  if (!isOfficer() || !ui.monthPicker.value) return;
  await runBusy(ui.saveMonth, "Saving…", async () => {
    try { await setDoc(doc(db, "siteSettings", "currentPick"), { bookId: ui.monthPicker.value, highlightColor: $("monthAccent")?.value || state.monthAccent, updatedAt: new Date().toISOString() }, { merge: true }); toast("Book of the Month updated."); }
    catch (error) { console.error(error); toast("Could not set the Book of the Month."); }
  });
}

async function saveAnnouncement(event) {
  event.preventDefault(); if (!isOfficer()) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Saving…", async () => {
    try { await setDoc(doc(db, "siteSettings", "announcement"), { text: ui.announcementInput.value.trim(), updatedAt: new Date().toISOString() }); ui.announcementStatus.textContent = "Announcement saved for everyone."; }
    catch (error) { console.error(error); ui.announcementStatus.textContent = "Could not save the announcement."; }
  });
}

function renderEvents() { ui.events.innerHTML = state.events.length ? [...state.events].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((event) => `<article class="event"><time>${escapeHtml(dateLabel(event.date))}</time><div><h3>${escapeHtml(event.title)}</h3>${event.details ? `<p>${escapeHtml(event.details)}</p>` : ""}</div>${isOfficer() ? `<button class="text-button" type="button" data-remove-event="${event.id}">Remove</button>` : ""}</article>`).join("") : '<p class="empty-state">No events have been added yet.</p>'; }
async function addEvent(event) { event.preventDefault(); if (!isOfficer()) return; const button = event.currentTarget.querySelector("button[type=submit]"); await runBusy(button, "Adding…", async () => { try { await addDoc(collection(db, "events"), { title: ui.eventTitle.value.trim(), date: ui.eventDate.value, details: ui.eventDetails.value.trim(), createdAt: new Date().toISOString() }); ui.eventForm.reset(); toast("Event added."); } catch (error) { console.error(error); toast("Could not add the event."); } }); }
function renderMemories() { ui.memories.innerHTML = state.memories.length ? recentFirst(state.memories).map((memory) => `<article class="memory"><img src="${escapeHtml(optimizedImageUrl(memory.imageUrl, 800))}" alt="${escapeHtml(memory.title)}" loading="lazy" decoding="async" width="800" height="540"><div><small>${escapeHtml(memory.category || "Club memory")}</small><h3>${escapeHtml(memory.title)}</h3></div>${isOfficer() ? `<button class="remove-button" type="button" data-remove-memory="${memory.id}" aria-label="Remove memory">×</button>` : ""}</article>`).join("") : '<p class="empty-state">The club’s first reading memory will appear here soon.</p>'; }
async function addMemory(event) { event.preventDefault(); if (!isOfficer()) return; const button = event.currentTarget.querySelector("button[type=submit]"); await runBusy(button, "Adding…", async () => { try { const imageUrl = ui.memoryImage.value.trim() || await uploadImage(ui.memoryFile.files?.[0]); if (!imageUrl) throw new Error("Add an image URL or choose a photo."); await addDoc(collection(db, "memories"), { imageUrl, title: ui.memoryCaption.value.trim(), category: ui.memoryCategory.value.trim(), date: new Date().toISOString() }); ui.memoryForm.reset(); toast("Memory added."); } catch (error) { console.error(error); toast(error.message || "Could not add the memory."); } }); }
async function addInvite(event) { event.preventDefault(); if (!isOfficer()) return; const email = ui.inviteEmail.value.trim().toLowerCase(); if (!email) return; const button = event.currentTarget.querySelector("button[type=submit]"); await runBusy(button, "Approving…", async () => { try { await setDoc(doc(db, "allowedEmails", email), { email, invitedAt: new Date().toISOString() }); ui.inviteForm.reset(); toast("That email can now create a member library."); } catch (error) { console.error(error); toast("Could not approve that email."); } }); }

function renderBoard() {
  ui.pinBoard.innerHTML = state.boardPosts.length ? recentFirst(state.boardPosts).map((post) => `<article class="pin-note"><span class="pin-avatar">${escapeHtml(initials(post.displayName))}</span><p>${escapeHtml(post.text)}</p><footer><span>${escapeHtml(post.displayName || "Club member")} · ${escapeHtml(dateTimeLabel(post.date))}</span>${isOfficer() ? `<button type="button" class="text-button" data-remove-pin="${post.id}">Remove</button>` : ""}</footer></article>`).join("") : '<p class="empty-state">Nothing pinned yet. The board is ready for its first note.</p>';
}
async function postBoard(event) {
  event.preventDefault(); if (!isMember()) return;
  const text = ui.boardText.value.trim(); if (!text) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Pinning…", async () => {
    try { await addDoc(collection(db, "boardPosts"), { text, memberId: state.user.uid, displayName: state.profile.displayName || "Club member", photoURL: state.profile.photoURL || "", date: new Date().toISOString() }); event.currentTarget.reset(); ui.boardStatus.textContent = "Pinned for the club."; }
    catch (error) { console.error(error); ui.boardStatus.textContent = "Could not pin that note."; }
  });
}

function renderMembers() {
  ui.members.innerHTML = state.members.length ? state.members.map((member) => {
    const label = member.clubTitle || (member.role === "officer" ? "Officer" : "Member");
    const avatar = member.photoURL ? `<img src="${escapeHtml(optimizedImageUrl(member.photoURL, 192))}" alt="Portrait of ${escapeHtml(member.displayName || "club member")}" loading="lazy" decoding="async" width="96" height="96">` : escapeHtml(initials(member.displayName));
    return `<button type="button" class="member-card" data-member-id="${member.id}" style="--accent:${color(member.themeColor)}"><span class="member-avatar">${avatar}</span><span><strong>${escapeHtml(member.displayName || "Club member")}</strong><small>${escapeHtml(label)}</small></span></button>`;
  }).join("") : '<p class="empty-state">Member libraries will appear here.</p>';
}
async function openProfile(uid) {
  state.stopShelf?.();
  state.stopShelf = null;
  state.openProfileId = uid;
  ui.profileContent.innerHTML = '<p class="empty-state loading-state">Opening this member library…</p>';
  if (!ui.profileDialog.open) showDialog(ui.profileDialog);
  try {
    const snapshot = await getDoc(doc(db, "members", uid));
    if (!snapshot.exists()) throw new Error("That member library is unavailable.");
    const member = snapshot.data(), own = state.user?.uid === uid, accent = color(member.themeColor);
    ui.profileDialog.setAttribute("aria-label", `${member.displayName || "Club member"}’s member library`);
    const avatar = member.photoURL ? `<img src="${escapeHtml(optimizedImageUrl(member.photoURL, 360))}" alt="Portrait of ${escapeHtml(member.displayName || "club member")}" decoding="async" width="180" height="180">` : escapeHtml(initials(member.displayName));
    const shelfForm = own && isMember() ? `<button id="shelfFormToggle" type="button" class="text-button shelf-form-toggle" aria-expanded="false" aria-controls="shelfForm">Add a book</button><form id="shelfForm" class="add-shelf-form" hidden><h4>Add to my shelf</h4><button id="openCatalogFromShelf" type="button" class="text-button">Find a book automatically</button><label>Book title <input id="shelfTitle" maxlength="160" required></label><label>Author <input id="shelfAuthor" maxlength="100" required></label><label>Genre <input id="shelfGenre" maxlength="80" placeholder="Optional"></label><label>Cover image URL <input id="shelfCover" type="url" maxlength="500" placeholder="Optional"></label><label>Upload a cover <input id="shelfFile" type="file" accept="image/*"></label><label>Reading status <select id="shelfStatus"><option value="reading">Reading</option><option value="read">Read</option><option value="want-to-read">Want to read</option></select></label><label>A small note <textarea id="shelfNote" maxlength="280" placeholder="Optional"></textarea></label><button class="button" type="submit">Add book</button></form>` : "";
    const customize = own && isMember() ? `<details class="profile-customize"><summary>Customize my library card</summary><form id="profileForm"><label>Display name <input id="profileNameInput" maxlength="60" value="${escapeHtml(member.displayName || "")}"></label><label>Short bio <textarea id="profileBioInput" maxlength="80">${escapeHtml(member.bio || "")}</textarea></label><label>Library colour <input id="profileColorInput" type="color" value="${accent}"></label><label>Public avatar URL <input id="profilePhotoInput" type="url" maxlength="500" value="${escapeHtml(member.photoURL || "")}" placeholder="Optional image link"></label><label>Or upload an avatar <input id="profilePhotoFile" type="file" accept="image/*"></label><label>Favourite genre <input id="profileGenreInput" maxlength="40" value="${escapeHtml(member.favoriteGenre || "")}" placeholder="e.g. Fantasy"></label><label>Currently reading <input id="profileCurrentInput" maxlength="100" value="${escapeHtml(member.currentlyReading || "")}" placeholder="A book you are into right now"></label>${isOfficer() ? `<label>Club role label <select id="profileTitleInput"><option value="Officer" ${member.clubTitle !== "President" ? "selected" : ""}>Officer</option><option value="President" ${member.clubTitle === "President" ? "selected" : ""}>President</option></select></label>` : ""}<button type="submit" class="text-button">Save library card</button></form></details>` : "";
    ui.profileContent.innerHTML = `<div class="profile-layout" style="--accent:${accent}"><aside class="profile-side"><div class="profile-avatar">${avatar}</div><h2>${escapeHtml(member.displayName || "Club member")}</h2><p>${escapeHtml(member.bio || "A reader in the Book Enthusiasts Club.")}</p><p>Member since ${escapeHtml(dateLabel(String(member.joinedAt || "").slice(0, 10)))}</p><div class="profile-meta">${member.clubTitle ? `<span>${escapeHtml(member.clubTitle)}</span>` : ""}${member.favoriteGenre ? `<span>Usually reading ${escapeHtml(member.favoriteGenre)}</span>` : ""}${member.currentlyReading ? `<span>Currently: ${escapeHtml(member.currentlyReading)}</span>` : ""}</div>${customize}</aside><section class="profile-library"><p class="eyebrow">PERSONAL LIBRARY</p><h3>${own ? "My shelf" : `${escapeHtml(member.displayName || "Their")}’s shelf`}</h3><div id="libraryStats" class="library-stats"></div><div id="personalBooks" class="personal-books"><p class="empty-state loading-state">Loading this library…</p></div>${shelfForm}</section></div>`;
    $("profileForm")?.addEventListener("submit", saveProfileCard);
    $("shelfForm")?.addEventListener("submit", addShelfBook);
    $("openCatalogFromShelf")?.addEventListener("click", () => openCatalog("shelf"));
    $("shelfFormToggle")?.addEventListener("click", (event) => { const form = $("shelfForm"), open = form.hidden; form.hidden = !open; event.currentTarget.setAttribute("aria-expanded", String(open)); event.currentTarget.textContent = open ? "Hide add-book form" : "Add a book"; });
    state.stopShelf?.();
    state.stopShelf = onSnapshot(collection(db, "memberShelves", uid, "entries"), (shelf) => renderShelf(shelf.docs.map((entry) => ({ id: entry.id, ...entry.data() }))), () => { $("personalBooks").innerHTML = '<p class="empty-state">This library is unavailable right now. Check your connection and try reopening it.</p>'; });
  } catch (error) {
    console.error(error);
    ui.profileContent.innerHTML = `<p class="empty-state profile-error">${escapeHtml(error.message || "That member library could not open.")}</p>`;
  }
}
async function saveProfileCard(event) {
  event.preventDefault();
  if (!isMember() || state.openProfileId !== state.user?.uid) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Saving…", async () => {
    try {
      const avatarFile = $("profilePhotoFile")?.files?.[0];
      const updates = {
        displayName: $("profileNameInput").value.trim() || "Club member",
        photoURL: avatarFile ? await uploadImage(avatarFile) : ($("profilePhotoInput")?.value.trim() || ""),
        bio: $("profileBioInput").value.trim(),
        themeColor: $("profileColorInput").value,
        favoriteGenre: $("profileGenreInput")?.value.trim() || "",
        currentlyReading: $("profileCurrentInput")?.value.trim() || ""
      };
      if (isOfficer()) updates.clubTitle = $("profileTitleInput")?.value || "Officer";
      await setDoc(doc(db, "members", state.openProfileId), updates, { merge: true });
      state.profile = { ...state.profile, ...updates };
      setAuthUi();
      toast("Your library card is updated.");
      await openProfile(state.openProfileId);
    } catch (error) {
      console.error(error);
      toast(error.message || "Could not update your library card.");
    }
  });
}
function shelfStatusOptions(value) { return [["reading", "Reading"], ["read", "Read"], ["want-to-read", "Want to read"]].map(([key, label]) => `<option value="${key}" ${key === value ? "selected" : ""}>${label}</option>`).join(""); }
function renderCommentList(comments = []) {
  return comments.length ? comments.map((comment) => `<article class="book-comment"><span class="comment-avatar">${escapeHtml(initials(comment.name))}</span><div><p><strong>${escapeHtml(comment.name || "Club member")}</strong><time>${escapeHtml(dateTimeLabel(comment.date))}</time></p><div>${escapeHtml(comment.text)}</div></div></article>`).join("") : '<p class="empty-state">No discussion notes yet. A member can start the conversation.</p>';
}
function renderShelf(entries) {
  const stats = $("libraryStats"), shelf = $("personalBooks");
  if (!stats || !shelf) return;
  const reading = entries.filter((entry) => entry.status === "reading").length;
  state.shelfEntries = entries;
  stats.innerHTML = `<span>${entries.length} on shelf</span><span>${reading} reading</span>`;
  shelf.innerHTML = entries.length ? recentFirst(entries).map((entry) => `<article class="personal-book"><button type="button" class="personal-cover-button" data-shelf-book-id="${entry.id}" aria-label="Open ${escapeHtml(entry.title)}">${entry.coverUrl ? `<img src="${escapeHtml(optimizedImageUrl(entry.coverUrl, 480))}" alt="Cover of ${escapeHtml(entry.title)}" loading="lazy" decoding="async" width="240" height="360">` : `<span class="personal-fallback">${escapeHtml(entry.title)}</span>`}</button><div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.author)}</small><span class="status">${escapeHtml(String(entry.status || "reading").replace(/-/g, " "))}</span></div></article>`).join("") : '<p class="empty-state">This little library is waiting for its first book.</p>';
}

function openBookDetails(book, personal = false) {
  const title = book.title || "Untitled book";
  ui.bookDialog.setAttribute("aria-label", `Book details: ${title}`);
  const about = book.synopsis || "";
  const canEditShelf = personal && isMember() && state.user?.uid === state.openProfileId;
  const canEditPublic = !personal && isOfficer();
  const shelfEditor = canEditShelf ? `<form id="detailShelfStatusForm" class="book-status-form"><label>Move this book to <select id="detailShelfStatus">${shelfStatusOptions(book.status || "reading")}</select></label><button class="button" type="submit">Update status</button><button id="removeShelfBook" class="text-button danger-button" type="button">Remove from my shelf</button><p id="bookDetailMessage" class="form-message" aria-live="polite"></p></form>` : "";
  const publicEditor = canEditPublic ? `<form id="bookEditForm" class="book-edit-form"><h3>Officer book details</h3><label>Title <input id="bookEditTitle" maxlength="160" value="${escapeHtml(title)}" required></label><label>Author <input id="bookEditAuthor" maxlength="100" value="${escapeHtml(book.author || "")}" required></label><label>Genre <input id="bookEditGenre" maxlength="80" value="${escapeHtml(book.genre || "")}"></label><label>Cover URL <input id="bookEditCover" type="url" maxlength="500" value="${escapeHtml(book.coverUrl || "")}"></label><label>Or upload a cover <input id="bookEditCoverFile" type="file" accept="image/*"></label><label>About the book <textarea id="bookEditSynopsis" maxlength="3000">${escapeHtml(about)}</textarea></label><button class="button" type="submit">Save book details</button><p id="bookEditMessage" class="form-message" aria-live="polite"></p></form>` : "";
  const personalDetails = `<p><strong>${escapeHtml(String(book.status || "reading").replace(/-/g, " "))}</strong></p>${book.note ? `<p><strong>Reader’s note</strong><br>${escapeHtml(book.note)}</p>` : ""}${about ? `<p><strong>About the book</strong><br>${escapeHtml(about)}</p>` : ""}${shelfEditor}`;
  const discussion = `<section class="book-discussion"><h3>Club discussion</h3><div id="bookCommentList" class="book-comment-list">${renderCommentList(book.comments || [])}</div>${isMember() ? '<form id="bookCommentForm" class="book-comment-form"><label for="bookCommentText">Add a note</label><textarea id="bookCommentText" maxlength="500" placeholder="A thought, question, or reaction…" required></textarea><button class="button" type="submit">Post note</button><p id="bookCommentMessage" class="form-message" aria-live="polite"></p></form>' : '<p class="form-message">Invited members can join the discussion after signing in.</p>'}</section>`;
  const publicDetails = `${about ? `<p><strong>About the book</strong><br>${escapeHtml(about)}</p>` : ""}${book.why ? `<p><strong>Why this member recommends it</strong><br>${escapeHtml(book.why)}</p>` : '<div id="legacyRecommendation"></div>'}${book.memberName || book.name ? `<p class="book-recommender">Recommended by ${escapeHtml(book.memberName || book.name)}</p>` : ""}${book.memberId ? `<button type="button" class="text-button recommender-link" data-member-id="${escapeHtml(book.memberId)}">View this reader’s library</button>` : ""}${discussion}${publicEditor}`;
  ui.bookContent.innerHTML = `<div class="book-detail"><div class="book-detail-cover">${coverMarkup(book.coverUrl, title)}</div><div><p class="eyebrow">${personal ? "FROM A MEMBER LIBRARY" : "FROM THE MEMBER BOOKSHELF"}</p><h2>${escapeHtml(title)}</h2><p class="book-byline">by ${escapeHtml(book.author || "Unknown author")}</p>${book.genre ? `<span class="book-tag">${escapeHtml(book.genre)}</span>` : ""}${personal ? personalDetails : publicDetails}</div></div>`;
  showDialog(ui.bookDialog);
  $("detailShelfStatusForm")?.addEventListener("submit", (event) => updateShelfStatus(event, book.id));
  $("removeShelfBook")?.addEventListener("click", () => removeShelfBook(book.id, title));
  $("bookCommentForm")?.addEventListener("submit", (event) => postBookComment(event, book.id));
  $("bookEditForm")?.addEventListener("submit", (event) => saveBookMetadata(event, book.id));
  if (!personal && !book.why) loadLegacyRecommendation(book.id);
}

async function loadLegacyRecommendation(bookId) {
  const target = $("legacyRecommendation"); if (!target) return;
  try {
    const snapshot = await getDocs(collection(db, "books", bookId, "recommendations"));
    const entry = snapshot.docs.find((item) => item.data().reason), recommendation = entry?.data();
    if (target && recommendation) target.innerHTML = `<p><strong>Why this member recommends it</strong><br>${escapeHtml(recommendation.reason)}</p><p class="book-recommender">Recommended by ${escapeHtml(recommendation.displayName || "a club member")}</p>${entry?.id ? `<button type="button" class="text-button recommender-link" data-member-id="${escapeHtml(entry.id)}">View this reader’s library</button>` : ""}`;
  } catch (error) { console.warn("Legacy recommendation unavailable:", error); }
}

async function removeShelfBook(entryId, title) {
  if (!isMember() || state.openProfileId !== state.user?.uid || !window.confirm(`Remove “${title}” from your personal shelf?`)) return;
  try { await deleteDoc(doc(db, "memberShelves", state.openProfileId, "entries", entryId)); closeDialog(ui.bookDialog); toast("Removed from your personal shelf."); }
  catch (error) { console.error(error); $("bookDetailMessage").textContent = "Could not remove this book."; }
}

async function postBookComment(event, bookId) {
  event.preventDefault();
  if (!isMember()) return;
  const text = $("bookCommentText")?.value.trim();
  if (!text) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Posting…", async () => {
    try {
      const comment = { name: state.profile.displayName || "Club member", text, date: new Date().toISOString() };
      await updateDoc(doc(db, "books", bookId), { comments: arrayUnion(comment) });
      const book = state.books.find((item) => item.id === bookId);
      if (book) book.comments = [...(book.comments || []), comment];
      $("bookCommentList").innerHTML = renderCommentList(book?.comments || [comment]);
      event.currentTarget.reset();
      $("bookCommentMessage").textContent = "Your note is part of the club discussion.";
    } catch (error) {
      console.error(error);
      $("bookCommentMessage").textContent = "Could not post your note. Check your connection and try again.";
    }
  });
}

async function updateShelfStatus(event, entryId) {
  event.preventDefault();
  if (!isMember() || state.openProfileId !== state.user?.uid) return;
  const status = $("detailShelfStatus")?.value;
  const entry = state.shelfEntries.find((item) => item.id === entryId);
  if (!status || !entry) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Updating…", async () => {
    try {
      await setDoc(doc(db, "memberShelves", state.openProfileId, "entries", entryId), {
        title: entry.title || "Untitled book",
        author: entry.author || "Unknown author",
        coverUrl: entry.coverUrl || "",
        status,
        note: entry.note || "",
        date: entry.date || new Date().toISOString()
      }, { merge: true });
      $("bookDetailMessage").textContent = "Reading status updated for everyone who views your shelf.";
      toast("Reading status updated.");
    } catch (error) {
      console.error(error);
      $("bookDetailMessage").textContent = "Could not update that status.";
    }
  });
}

async function saveBookMetadata(event, bookId) {
  event.preventDefault();
  if (!isOfficer()) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Saving…", async () => {
    try {
      const coverFile = $("bookEditCoverFile")?.files?.[0];
      await setDoc(doc(db, "books", bookId), {
        title: $("bookEditTitle").value.trim(),
        author: $("bookEditAuthor").value.trim(),
        genre: $("bookEditGenre").value.trim(),
        coverUrl: coverFile ? await uploadImage(coverFile) : $("bookEditCover").value.trim(),
        synopsis: $("bookEditSynopsis").value.trim()
      }, { merge: true });
      $("bookEditMessage").textContent = "Book details saved. The member’s personal reason was left unchanged.";
      toast("Book details updated.");
    } catch (error) {
      console.error(error);
      $("bookEditMessage").textContent = "Could not update these details.";
    }
  });
}

async function addShelfBook(event) {
  event.preventDefault();
  if (!isMember() || state.openProfileId !== state.user?.uid) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Adding…", async () => {
    try {
      const candidate = { title: $("shelfTitle").value.trim(), author: $("shelfAuthor").value.trim() };
      const existing = await existingShelfEntry(candidate);
      if (existing) { toast(`“${candidate.title}” is already on your personal shelf. Open its cover to change the reading status.`); return; }
      const file = $("shelfFile")?.files?.[0];
      const coverUrl = $("shelfCover").value.trim() || (file ? await uploadImage(file) : "");
      await addDoc(collection(db, "memberShelves", state.openProfileId, "entries"), {
        title: candidate.title,
        author: candidate.author,
        genre: $("shelfGenre").value.trim(),
        coverUrl,
        status: $("shelfStatus").value,
        note: $("shelfNote").value.trim(),
        date: new Date().toISOString()
      });
      event.currentTarget.reset();
      toast("Added to your personal shelf — your library is growing.");
    } catch (error) {
      console.error(error);
      toast(error.message || "Could not add that book.");
    }
  });
}

onSnapshot(collection(db, "books"), (snapshot) => { state.books = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderBooks(); subscribeRatings(); subscribeMonthRecommendation(); }, () => { ui.books.innerHTML = '<p class="empty-state">The bookshelf is unavailable right now.</p>'; });
onSnapshot(collection(db, "members"), (snapshot) => { state.members = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderMembers(); renderMonth(); }, () => { ui.members.innerHTML = '<p class="empty-state">Member libraries are unavailable right now.</p>'; });
onSnapshot(doc(db, "siteSettings", "currentPick"), (snapshot) => { const pick = snapshot.data() || {}; state.currentPickId = pick.bookId || null; state.monthAccent = /^#[0-9a-f]{6}$/i.test(pick.highlightColor || "") ? pick.highlightColor : "#d8e66f"; if ($("monthAccent")) $("monthAccent").value = state.monthAccent; renderBooks(); subscribeRatings(); subscribeMonthRecommendation(); }, () => { toast("Book of the Month could not load."); });
onSnapshot(doc(db, "siteSettings", "announcement"), (snapshot) => { state.announcement = snapshot.data()?.text || ""; ui.announcementText.textContent = state.announcement || "No announcement yet—check back after the next library meeting."; if (isOfficer()) ui.announcementInput.value = state.announcement; }, () => { ui.announcementText.textContent = "The club announcement could not load right now."; });
onSnapshot(doc(db, "siteSettings", "catalog"), (snapshot) => {
  const settings = snapshot.data() || {};
  state.googleBooksKey = String(settings.googleBooksApiKey || "").trim();
  if (typeof settings.cloudName === "string") state.cloudName = settings.cloudName.trim();
  if (typeof settings.uploadPreset === "string") state.uploadPreset = settings.uploadPreset.trim() || "bookclub_unsigned";
  if (isOfficer()) {
    ui.googleBooksKey.value = state.googleBooksKey;
    ui.cloudName.value = state.cloudName;
    ui.uploadPreset.value = state.uploadPreset;
  }
}, (error) => console.warn("Catalogue settings unavailable:", error));
onSnapshot(collection(db, "events"), (snapshot) => { state.events = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderEvents(); }, () => { ui.events.innerHTML = '<p class="empty-state">Events are unavailable right now.</p>'; });
onSnapshot(collection(db, "memories"), (snapshot) => { state.memories = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderMemories(); }, () => { ui.memories.innerHTML = '<p class="empty-state">Reading memories are unavailable right now.</p>'; });
onSnapshot(collection(db, "boardPosts"), (snapshot) => { state.boardPosts = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderBoard(); }, () => { ui.pinBoard.innerHTML = '<p class="empty-state">The pinboard is taking a short break.</p>'; });

ui.signIn.addEventListener("click", signIn); ui.signOut.addEventListener("click", () => signOut(auth)); ui.profile.addEventListener("click", () => openProfile(state.user.uid));
ui.profileDialog.addEventListener("close", () => { state.stopShelf?.(); state.stopShelf = null; });
$("openSuggestionButton").addEventListener("click", () => openCatalog("recommendation")); ui.openPending.addEventListener("click", () => showDialog(ui.pendingDialog)); ui.suggestionForm.addEventListener("submit", submitSuggestion); ui.catalogSearchForm.addEventListener("submit", submitCatalogSearch); ui.catalogDestination.addEventListener("change", updateCatalogDestination); ui.catalogSave.addEventListener("click", saveCatalogBook); ui.catalogManual.addEventListener("click", openManualCatalogEntry); ui.monthForm.addEventListener("submit", saveRating); ui.saveMonth.addEventListener("click", saveMonth); ui.announcementForm.addEventListener("submit", saveAnnouncement); ui.eventForm.addEventListener("submit", addEvent); ui.memoryForm.addEventListener("submit", addMemory); ui.boardForm.addEventListener("submit", postBoard); ui.inviteForm.addEventListener("submit", addInvite); ui.uploadSettingsForm.addEventListener("submit", saveUploadSettings); ui.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")); setTheme(localStorage.getItem("becTheme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
ui.search.addEventListener("input", (event) => { state.search = event.target.value; renderBooks(); }); ui.genre.addEventListener("change", (event) => { state.genre = event.target.value; renderBooks(); });
document.addEventListener("click", async (event) => {
  const close = event.target.closest("[data-close]");
  if (close) {
    const dialog = $(close.dataset.close);
    closeDialog(dialog);
    if (dialog === ui.profileDialog) { state.stopShelf?.(); state.stopShelf = null; }
  }
  const catalogResult = event.target.closest("[data-catalog-result]");
  if (catalogResult) await selectCatalogBook(Number(catalogResult.dataset.catalogResult));
  const book = event.target.closest("[data-book-id]");
  if (book) { const item = state.books.find((entry) => entry.id === book.dataset.bookId); if (item) openBookDetails(item); }
  const shelfBook = event.target.closest("[data-shelf-book-id]");
  if (shelfBook) { const item = state.shelfEntries.find((entry) => entry.id === shelfBook.dataset.shelfBookId); if (item) openBookDetails(item, true); }
  const member = event.target.closest("[data-member-id]");
  if (member) openProfile(member.dataset.memberId);
  const approvePending = event.target.closest("[data-approve-pending]");
  if (approvePending && !approvePending.disabled) { approvePending.disabled = true; await reviewPending(approvePending.dataset.approvePending, true); if (approvePending.isConnected) approvePending.disabled = false; }
  const rejectPending = event.target.closest("[data-reject-pending]");
  if (rejectPending && !rejectPending.disabled) { rejectPending.disabled = true; await reviewPending(rejectPending.dataset.rejectPending, false); if (rejectPending.isConnected) rejectPending.disabled = false; }
  const removeEvent = event.target.closest("[data-remove-event]");
  if (removeEvent && isOfficer() && window.confirm("Remove this event from the public calendar?")) {
    try { await deleteDoc(doc(db, "events", removeEvent.dataset.removeEvent)); toast("Event removed."); }
    catch (error) { console.error(error); toast("Could not remove that event."); }
  }
  const removeMemory = event.target.closest("[data-remove-memory]");
  if (removeMemory && isOfficer() && window.confirm("Remove this photo from Reading Memories?")) {
    try { await deleteDoc(doc(db, "memories", removeMemory.dataset.removeMemory)); toast("Memory removed."); }
    catch (error) { console.error(error); toast("Could not remove that memory."); }
  }
  const removePin = event.target.closest("[data-remove-pin]");
  if (removePin && isOfficer() && window.confirm("Remove this note from the club pinboard?")) {
    try { await deleteDoc(doc(db, "boardPosts", removePin.dataset.removePin)); toast("Pin removed."); }
    catch (error) { console.error(error); toast("Could not remove that pin."); }
  }
});
document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const text = image.alt.replace(/^(Cover of|Portrait of)\s+/i, "") || "Image unavailable";
  const fallback = document.createElement("span");
  if (image.closest(".personal-book")) fallback.className = "personal-fallback";
  else if (image.closest(".catalog-result")) fallback.className = "catalog-result-cover";
  else if (image.closest(".catalog-preview-book")) fallback.className = "catalog-preview-cover";
  else if (image.closest(".memory")) fallback.className = "image-fallback memory-fallback";
  else if (image.closest(".member-avatar,.profile-avatar")) fallback.className = "image-fallback avatar-fallback";
  else fallback.className = "fallback-cover";
  fallback.textContent = text;
  image.replaceWith(fallback);
}, true);
