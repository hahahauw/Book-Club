import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, onSnapshot, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { searchCatalog, loadCatalogDetails } from "./book-catalog.js";

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
  month: $("bookOfMonth"), monthCommunity: $("monthCommunity"), monthRating: $("monthRating"), monthProgress: $("monthProgress"), monthForm: $("monthForm"), monthStars: $("monthStars"), monthFinished: $("monthFinished"), monthComment: $("monthComment"), monthMessage: $("monthMessage"), monthNotes: $("monthNotes"), monthOfficer: $("monthOfficer"), monthPicker: $("monthPicker"), saveMonth: $("saveMonthButton"),
  books: $("booksGrid"), search: $("bookSearch"), genre: $("genreFilter"),
  events: $("eventsList"), eventForm: $("eventForm"), eventTitle: $("eventTitle"), eventDate: $("eventDate"), eventDetails: $("eventDetails"),
  memories: $("memoriesGrid"), memoryForm: $("memoryForm"), memoryImage: $("memoryImage"), memoryFile: $("memoryFile"), memoryCaption: $("memoryCaption"), memoryCategory: $("memoryCategory"), inviteForm: $("inviteForm"), inviteEmail: $("inviteEmail"),
  uploadSettingsForm: $("uploadSettingsForm"), cloudName: $("cloudName"), uploadPreset: $("uploadPreset"), uploadSettingsStatus: $("uploadSettingsStatus"),
  members: $("membersGrid"), suggestionDialog: $("suggestionDialog"), suggestionForm: $("suggestionForm"), suggestionMessage: $("suggestionMessage"), catalogDialog: $("catalogDialog"), catalogSearchForm: $("catalogSearchForm"), catalogQuery: $("catalogQuery"), catalogResults: $("catalogResults"), catalogPreview: $("catalogPreview"), catalogPreviewBook: $("catalogPreviewBook"), catalogDestination: $("catalogDestination"), catalogShelfNoteGroup: $("catalogShelfNoteGroup"), catalogShelfNote: $("catalogShelfNote"), catalogReasonGroup: $("catalogReasonGroup"), catalogReason: $("catalogReason"), catalogSave: $("catalogSaveButton"), catalogManual: $("catalogManualButton"), catalogMessage: $("catalogMessage"), bookDialog: $("bookDialog"), bookContent: $("bookContent"), profileDialog: $("profileDialog"), profileContent: $("profileContent")
};

const state = { user: null, profile: null, books: [], members: [], currentPickId: null, monthAccent: "#d8e66f", ratings: [], events: [], memories: [], shelfEntries: [], search: "", genre: "", openProfileId: null, stopRatings: null, stopShelf: null, cloudName: localStorage.getItem("becCloudName") || "", uploadPreset: localStorage.getItem("becUploadPreset") || "bookclub_unsigned", catalogResults: [], catalogBook: null, catalogTarget: "recommendation", catalogDuplicateConfirmation: "" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function escapeHtml(value) { const box = document.createElement("div"); box.textContent = String(value ?? ""); return box.innerHTML; }
function initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function color(value) { return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#ed7857"; }
function dateLabel(value) { const date = new Date(`${value || ""}T12:00:00`); return Number.isNaN(date.valueOf()) ? "Date to be announced" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function recentFirst(items) { return [...items].sort((a, b) => String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""))); }
function isMember() { return Boolean(state.user && ["member", "officer"].includes(state.profile?.role)); }
function isOfficer() { return state.profile?.role === "officer"; }
function toast(message) { ui.toast.textContent = message; ui.toast.classList.add("visible"); clearTimeout(toast.timer); toast.timer = setTimeout(() => ui.toast.classList.remove("visible"), 4200); }
function setAuthUi() { const name = state.profile?.displayName || state.user?.displayName || "reader"; ui.authStatus.textContent = isMember() ? `Hello, ${name}` : state.user ? "Signed in — member access pending" : "Exploring as a guest"; ui.signIn.hidden = Boolean(state.user); ui.signOut.hidden = !state.user; ui.profile.hidden = !isMember(); ui.monthOfficer.hidden = !isOfficer(); ui.eventForm.hidden = !isOfficer(); ui.memoryForm.hidden = !isOfficer(); ui.inviteForm.hidden = !isOfficer(); ui.uploadSettingsForm.hidden = !isOfficer(); ui.monthForm.hidden = !isMember(); ui.monthMessage.hidden = !isMember(); if (isOfficer()) { ensureMonthAccentControl(); ui.cloudName.value = state.cloudName; ui.uploadPreset.value = state.uploadPreset; } renderMonth(); renderEvents(); renderMemories(); }

function coverMarkup(url, title, className = "") { return url ? `<img class="${className}" src="${escapeHtml(url)}" alt="Cover of ${escapeHtml(title)}">` : `<div class="fallback-cover">${escapeHtml(title)}</div>`; }
function renderBooks() {
  const allGenres = [...new Set(state.books.map((book) => String(book.genre || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const selected = state.genre; ui.genre.innerHTML = '<option value="">All genres</option>' + allGenres.map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join(""); ui.genre.value = selected;
  const term = state.search.toLowerCase();
  const books = recentFirst(state.books).filter((book) => (!state.genre || book.genre === state.genre) && (!term || [book.title, book.author, book.genre, book.name, book.memberName].some((value) => String(value || "").toLowerCase().includes(term))));
  ui.books.innerHTML = books.length ? books.map((book) => `<button type="button" class="book-card" data-book-id="${book.id}" aria-label="Open ${escapeHtml(book.title)}">${coverMarkup(book.coverUrl, book.title)}<span>${escapeHtml(book.title)}</span></button>`).join("") : `<p class="empty-state">${state.books.length ? "No books match that search." : "The shelf is ready for its first recommendation."}</p>`;
  ui.monthPicker.innerHTML = '<option value="">Choose a book</option>' + recentFirst(state.books).map((book) => `<option value="${book.id}" ${book.id === state.currentPickId ? "selected" : ""}>${escapeHtml(book.title)} — ${escapeHtml(book.author)}</option>`).join("");
  renderMonth();
}

function currentBook() { return state.books.find((book) => book.id === state.currentPickId); }
function renderMonth() {
  const book = currentBook();
  if (!book) { ui.month.innerHTML = '<div class="month-cover placeholder-cover">The next<br>club read</div><div><p class="eyebrow">CHOSEN BY THE CLUB</p><h3>Waiting for the next chapter.</h3><p>When an officer chooses a book from the shelf, it will appear here with reader progress and discussion.</p></div>'; ui.monthCommunity.hidden = true; return; }
  ui.month.style.setProperty("--month-accent", state.monthAccent);
  ui.month.innerHTML = `<div class="month-cover">${coverMarkup(book.coverUrl, book.title)}</div><div><p class="eyebrow">BOOK OF THE MONTH</p><h3>${escapeHtml(book.title)}</h3><p>by ${escapeHtml(book.author)}</p><p>${escapeHtml(book.synopsis || book.why || "Read along at your own pace, then leave a rating or discussion note.")}</p></div>`;
  ui.monthCommunity.hidden = false;
  ui.monthForm.hidden = !isMember(); ui.monthMessage.hidden = !isMember();
  const count = Math.max(state.members.length, 1), finished = state.ratings.filter((item) => item.finished).length;
  const average = state.ratings.length ? (state.ratings.reduce((sum, item) => sum + Number(item.stars || 0), 0) / state.ratings.length).toFixed(1) : "";
  ui.monthRating.textContent = average ? `${"★".repeat(Math.round(average))} ${average}/5` : "No ratings yet";
  ui.monthProgress.textContent = `${Math.round((finished / count) * 100)}% finished`;
  const mine = state.ratings.find((item) => item.memberId === state.user?.uid);
  if (mine) { ui.monthStars.value = String(mine.stars || 5); ui.monthFinished.checked = Boolean(mine.finished); ui.monthComment.value = mine.comment || ""; }
  ui.monthNotes.innerHTML = state.ratings.filter((item) => item.comment).length ? state.ratings.filter((item) => item.comment).map((item) => `<article class="month-note"><strong>${escapeHtml(item.displayName || "Club member")}</strong><span>${"★".repeat(Number(item.stars || 0))}</span><p>${escapeHtml(item.comment)}</p></article>`).join("") : '<p class="empty-state">No discussion notes yet. Be the first to leave one.</p>';
}
function subscribeRatings() { state.stopRatings?.(); state.ratings = []; const book = currentBook(); if (!book) return renderMonth(); state.stopRatings = onSnapshot(collection(db, "bookOfMonthRatings", book.id, "members"), (snapshot) => { state.ratings = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderMonth(); }, () => { ui.monthNotes.innerHTML = '<p class="empty-state">Ratings are unavailable right now.</p>'; }); }

function ensureMonthAccentControl() { if ($("monthAccent")) return; const label = document.createElement("label"); label.innerHTML = 'Highlight colour <input id="monthAccent" type="color" aria-label="Book of the Month highlight colour">'; ui.monthOfficer.prepend(label); $("monthAccent").value = state.monthAccent; }

function setTheme(theme) { document.documentElement.dataset.theme = theme; localStorage.setItem("becTheme", theme); ui.theme.textContent = theme === "dark" ? "Light mode" : "Dark mode"; ui.theme.setAttribute("aria-pressed", String(theme === "dark")); }
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
function saveUploadSettings(event) { event.preventDefault(); if (!isOfficer()) return; state.cloudName = ui.cloudName.value.trim(); state.uploadPreset = ui.uploadPreset.value.trim() || "bookclub_unsigned"; if (!state.cloudName) { ui.uploadSettingsStatus.textContent = "Enter the club Cloudinary cloud name."; return; } localStorage.setItem("becCloudName", state.cloudName); localStorage.setItem("becUploadPreset", state.uploadPreset); ui.uploadSettingsStatus.textContent = "Saved in this browser."; }
function ensureSuggestionUpload() { if ($("suggestFile")) return; const label = document.createElement("label"); label.textContent = "Upload a cover "; const input = document.createElement("input"); input.id = "suggestFile"; input.type = "file"; input.accept = "image/*"; label.append(input); $("suggestCover").closest("label").after(label); }

function catalogCover(book, className) { return book.coverUrl ? `<img src="${escapeHtml(book.coverUrl)}" alt="Cover of ${escapeHtml(book.title)}">` : `<span class="${className}">${escapeHtml(book.title)}</span>`; }
function openCatalog(target = "recommendation") {
  if (!isMember()) { ensureSuggestionUpload(); ui.suggestionDialog.showModal(); return; }
  state.catalogTarget = target; state.catalogResults = []; state.catalogBook = null; state.catalogDuplicateConfirmation = "";
  ui.catalogResults.innerHTML = ""; ui.catalogPreview.hidden = true; ui.catalogMessage.textContent = ""; ui.catalogSearchForm.reset(); ui.catalogShelfNote.value = ""; ui.catalogReason.value = "";
  ui.catalogDestination.value = target === "shelf" ? "reading" : "recommendation"; updateCatalogDestination(); ui.catalogDialog.showModal(); ui.catalogQuery.focus();
}
function updateCatalogDestination() {
  const recommendation = ui.catalogDestination.value === "recommendation";
  ui.catalogReasonGroup.hidden = !recommendation; ui.catalogShelfNoteGroup.hidden = recommendation;
  ui.catalogSave.textContent = recommendation ? "Add club recommendation" : "Add to my shelf";
  state.catalogDuplicateConfirmation = "";
}
function renderCatalogResults() {
  ui.catalogResults.innerHTML = state.catalogResults.length ? state.catalogResults.map((book, index) => `<button type="button" class="catalog-result" data-catalog-result="${index}">${catalogCover(book, "catalog-result-cover")}<span><strong>${escapeHtml(book.title)}</strong><small>by ${escapeHtml(book.author)}</small><small>${book.publicationYear ? `First published ${escapeHtml(book.publicationYear)}` : "Publication date unavailable"}${book.isbn ? ` · ISBN ${escapeHtml(book.isbn)}` : ""}</small></span></button>`).join("") : '<p class="empty-state">No matches yet. Try a title, author, or ISBN—or enter it manually.</p>';
}
async function submitCatalogSearch(event) {
  event.preventDefault(); const term = ui.catalogQuery.value.trim(); if (term.length < 2) return;
  const button = ui.catalogSearchForm.querySelector("button"); button.disabled = true; ui.catalogMessage.textContent = "Searching the catalogue…"; ui.catalogPreview.hidden = true; state.catalogBook = null;
  try { state.catalogResults = await searchCatalog(term); renderCatalogResults(); ui.catalogMessage.textContent = state.catalogResults.length ? "Choose the edition that looks right." : "No match found. You can enter this book manually."; }
  catch (error) { console.error(error); state.catalogResults = []; renderCatalogResults(); ui.catalogMessage.textContent = error.message || "The catalogue is unavailable right now. Manual entry still works."; }
  finally { button.disabled = false; }
}
async function selectCatalogBook(index) {
  const result = state.catalogResults[index]; if (!result) return;
  ui.catalogMessage.textContent = "Loading book details…";
  const book = await loadCatalogDetails(result); state.catalogBook = book; state.catalogDuplicateConfirmation = "";
  ui.catalogPreviewBook.innerHTML = `<div class="catalog-preview-book">${catalogCover(book, "catalog-preview-cover")}<div><p class="eyebrow">OPEN LIBRARY</p><h3>${escapeHtml(book.title)}</h3><p>by ${escapeHtml(book.author)}</p><p class="catalog-meta">${book.publicationYear ? `First published ${escapeHtml(book.publicationYear)}` : "Publication date unavailable"}${book.isbn ? ` · ISBN ${escapeHtml(book.isbn)}` : ""}</p>${book.synopsis ? `<p>${escapeHtml(book.synopsis)}</p>` : '<p class="catalog-meta">No synopsis is available for this edition.</p>'}</div></div>`;
  ui.catalogPreview.hidden = false; ui.catalogMessage.textContent = "Check the details, then choose where to save it.";
}
async function existingShelfEntry(book) {
  const shelf = await getDocs(query(collection(db, "memberShelves", state.user.uid, "entries"), where("catalogKey", "==", book.catalogKey), limit(1)));
  if (!shelf.empty) return { id: shelf.docs[0].id, ...shelf.docs[0].data() };
  const normalizedTitle = String(book.title).toLowerCase().replace(/[^a-z0-9]/g, ""); const normalizedAuthor = String(book.author).toLowerCase().replace(/[^a-z0-9]/g, "");
  const legacy = await getDocs(collection(db, "memberShelves", state.user.uid, "entries"));
  return legacy.docs.map((entry) => ({ id: entry.id, ...entry.data() })).find((entry) => String(entry.title || "").toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedTitle && String(entry.author || "").toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedAuthor) || null;
}
async function saveCatalogShelfBook(book, status) {
  const existing = await existingShelfEntry(book); const key = `${existing?.id || "new"}:${status}`;
  if (existing && existing.status === status) { ui.catalogMessage.textContent = `This book is already on your ${String(status).replace(/-/g, " ")} shelf.`; return false; }
  if (existing && state.catalogDuplicateConfirmation !== key) { state.catalogDuplicateConfirmation = key; ui.catalogMessage.textContent = `This book is already on your ${String(existing.status || "reading").replace(/-/g, " ")} shelf. Press the button again to move it.`; return false; }
  const metadata = { title: book.title, author: book.author, coverUrl: book.coverUrl, catalogKey: book.catalogKey, catalogId: book.catalogId, isbn: book.isbn, publicationYear: book.publicationYear, synopsis: book.synopsis, source: book.source, status, note: ui.catalogShelfNote.value.trim(), date: new Date().toISOString() };
  if (existing) { await setDoc(doc(db, "memberShelves", state.user.uid, "entries", existing.id), metadata, { merge: true }); ui.catalogMessage.textContent = "Moved your existing shelf entry."; }
  else { await addDoc(collection(db, "memberShelves", state.user.uid, "entries"), metadata); ui.catalogMessage.textContent = "Added to your personal shelf."; }
  return true;
}
async function saveCatalogRecommendation(book) {
  const directRef = doc(db, "books", book.catalogId); const direct = await getDoc(directRef);
  let sharedRef = directRef; let exists = direct.exists();
  if (!exists) {
    const title = String(book.title).toLowerCase().replace(/[^a-z0-9]/g, ""); const author = String(book.author).toLowerCase().replace(/[^a-z0-9]/g, "");
    const shelf = await getDocs(collection(db, "books"));
    const match = shelf.docs.find((entry) => String(entry.data().title || "").toLowerCase().replace(/[^a-z0-9]/g, "") === title && String(entry.data().author || "").toLowerCase().replace(/[^a-z0-9]/g, "") === author);
    if (match) { sharedRef = match.ref; exists = true; }
  }
  if (!exists) await setDoc(sharedRef, { title: book.title, author: book.author, genre: book.genre || "", coverUrl: book.coverUrl, synopsis: book.synopsis || "", catalogKey: book.catalogKey, isbn: book.isbn || "", publicationYear: book.publicationYear || "", source: book.source, date: new Date().toISOString(), comments: [] });
  await setDoc(doc(sharedRef, "recommendations", state.user.uid), { memberId: state.user.uid, displayName: state.profile.displayName || "Club member", reason: ui.catalogReason.value.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
  ui.catalogMessage.textContent = exists ? "Your reason was added to the shared recommendation." : "Added to the club bookshelf.";
  return true;
}
async function saveCatalogBook() {
  const book = state.catalogBook; if (!book || !isMember()) return;
  ui.catalogSave.disabled = true;
  try { const saved = ui.catalogDestination.value === "recommendation" ? await saveCatalogRecommendation(book) : await saveCatalogShelfBook(book, ui.catalogDestination.value); if (saved) setTimeout(() => ui.catalogDialog.close(), 700); }
  catch (error) { console.error(error); ui.catalogMessage.textContent = error.message || "Could not save this book."; }
  finally { ui.catalogSave.disabled = false; }
}
function openManualCatalogEntry() {
  const target = ui.catalogDestination.value; ui.catalogDialog.close();
  if (target === "recommendation") { ensureSuggestionUpload(); ui.suggestionDialog.showModal(); return; }
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
  await setDoc(ref, profile); await setDoc(doc(db, "memberPrivate", user.uid), { email: String(user.email || "").toLowerCase() });
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
  try { if (chosenFile) { ui.suggestionMessage.textContent = "Uploading cover…"; book.coverUrl = await uploadImage(chosenFile); } if (isMember()) await addDoc(collection(db, "books"), { ...book, memberId: state.user.uid, memberName: state.profile.displayName }); else await addDoc(collection(db, "pendingBooks"), { ...book, submittedAt: new Date().toISOString(), status: "pending" }); ui.suggestionForm.reset(); ui.suggestionMessage.textContent = isMember() ? "Added to the bookshelf." : "Sent to officers for review. Thank you!"; }
  catch (error) { console.error(error); ui.suggestionMessage.textContent = error.message || "Could not send the suggestion."; }
  finally { button.disabled = false; }
}
async function saveRating(event) { event.preventDefault(); const book = currentBook(); if (!book) return; if (!isMember()) { ui.monthMessage.textContent = "Sign in with an invited member account to save an update."; return; } try { await setDoc(doc(db, "bookOfMonthRatings", book.id, "members", state.user.uid), { memberId: state.user.uid, displayName: state.profile.displayName, stars: Number(ui.monthStars.value), finished: ui.monthFinished.checked, comment: ui.monthComment.value.trim(), updatedAt: new Date().toISOString() }); ui.monthMessage.textContent = "Your update is saved."; } catch (error) { console.error(error); ui.monthMessage.textContent = "Could not save your update."; } }
async function saveMonth() { if (!isOfficer() || !ui.monthPicker.value) return; try { await setDoc(doc(db, "siteSettings", "currentPick"), { bookId: ui.monthPicker.value, highlightColor: $("monthAccent")?.value || state.monthAccent, updatedAt: new Date().toISOString() }, { merge: true }); toast("Book of the Month updated."); } catch (error) { console.error(error); toast("Could not set the Book of the Month."); } }

function renderEvents() { ui.events.innerHTML = state.events.length ? [...state.events].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((event) => `<article class="event"><time>${escapeHtml(dateLabel(event.date))}</time><div><h3>${escapeHtml(event.title)}</h3>${event.details ? `<p>${escapeHtml(event.details)}</p>` : ""}</div>${isOfficer() ? `<button class="text-button" type="button" data-remove-event="${event.id}">Remove</button>` : ""}</article>`).join("") : '<p class="empty-state">No events have been added yet.</p>'; }
async function addEvent(event) { event.preventDefault(); if (!isOfficer()) return; try { await addDoc(collection(db, "events"), { title: ui.eventTitle.value.trim(), date: ui.eventDate.value, details: ui.eventDetails.value.trim(), createdAt: new Date().toISOString() }); ui.eventForm.reset(); } catch (error) { console.error(error); toast("Could not add the event."); } }
function renderMemories() { ui.memories.innerHTML = state.memories.length ? recentFirst(state.memories).map((memory) => `<article class="memory"><img src="${escapeHtml(memory.imageUrl)}" alt="${escapeHtml(memory.title)}"><div><small>${escapeHtml(memory.category || "Club memory")}</small><h3>${escapeHtml(memory.title)}</h3></div>${isOfficer() ? `<button class="remove-button" type="button" data-remove-memory="${memory.id}" aria-label="Remove memory">×</button>` : ""}</article>`).join("") : '<p class="empty-state">The club’s first reading memory will appear here soon.</p>'; }
async function addMemory(event) { event.preventDefault(); if (!isOfficer()) return; try { const imageUrl = ui.memoryImage.value.trim() || await uploadImage(ui.memoryFile.files?.[0]); if (!imageUrl) throw new Error("Add an image URL or choose a photo."); await addDoc(collection(db, "memories"), { imageUrl, title: ui.memoryCaption.value.trim(), category: ui.memoryCategory.value.trim(), date: new Date().toISOString() }); ui.memoryForm.reset(); } catch (error) { console.error(error); toast(error.message || "Could not add the memory."); } }
async function addInvite(event) { event.preventDefault(); if (!isOfficer()) return; const email = ui.inviteEmail.value.trim().toLowerCase(); if (!email) return; try { await setDoc(doc(db, "allowedEmails", email), { email, invitedAt: new Date().toISOString() }); ui.inviteForm.reset(); toast("That email can now create a member library."); } catch (error) { console.error(error); toast("Could not approve that email."); } }

function renderMembers() { ui.members.innerHTML = state.members.length ? state.members.map((member) => { const label = member.clubTitle || (member.role === "officer" ? "Officer" : "Member"); return `<button type="button" class="member-card" data-member-id="${member.id}" style="--accent:${color(member.themeColor)}"><span class="member-avatar">${member.photoURL ? `<img src="${escapeHtml(member.photoURL)}" alt="">` : escapeHtml(initials(member.displayName))}</span><span><strong>${escapeHtml(member.displayName || "Club member")}</strong><small>${escapeHtml(label)}</small></span></button>`; }).join("") : '<p class="empty-state">Member libraries will appear here.</p>'; }
async function openProfile(uid) {
  const snapshot = await getDoc(doc(db, "members", uid)); if (!snapshot.exists()) return toast("That member library is unavailable."); const member = snapshot.data(); const own = state.user?.uid === uid; const accent = color(member.themeColor); state.openProfileId = uid;
  ui.profileContent.innerHTML = `<div class="profile-layout" style="--accent:${accent}"><aside class="profile-side"><div class="profile-avatar">${member.photoURL ? `<img src="${escapeHtml(member.photoURL)}" alt="">` : escapeHtml(initials(member.displayName))}</div><h2>${escapeHtml(member.displayName || "Club member")}</h2><p>${escapeHtml(member.bio || "A reader in the Book Enthusiasts Club.")}</p><p>Member since ${escapeHtml(dateLabel(String(member.joinedAt || "").slice(0, 10)))}</p></aside><section class="profile-library"><p class="eyebrow">PERSONAL LIBRARY</p><h3>${own ? "My shelf" : `${escapeHtml(member.displayName || "Their")}’s shelf`}</h3><div id="libraryStats" class="library-stats"></div><div id="personalBooks" class="personal-books"><p class="empty-state">Loading this library…</p></div>${own && isMember() ? `<form id="shelfForm" class="add-shelf-form"><h4>Add to my shelf</h4><input id="shelfTitle" maxlength="160" placeholder="Book title" required><input id="shelfAuthor" maxlength="100" placeholder="Author" required><input id="shelfCover" type="url" maxlength="500" placeholder="Cover image URL (optional)"><select id="shelfStatus"><option value="reading">Reading</option><option value="read">Read</option><option value="want-to-read">Want to read</option></select><textarea id="shelfNote" maxlength="280" placeholder="A small note (optional)"></textarea><button class="button" type="submit">Add book</button></form>` : ""}</section></div>`;
  const profileMeta = document.createElement("div"); profileMeta.className = "profile-meta";
  profileMeta.innerHTML = `${member.clubTitle ? `<span>${escapeHtml(member.clubTitle)}</span>` : ""}${member.favoriteGenre ? `<span>Usually reading ${escapeHtml(member.favoriteGenre)}</span>` : ""}${member.currentlyReading ? `<span>Currently: ${escapeHtml(member.currentlyReading)}</span>` : ""}`;
  if (profileMeta.innerHTML) ui.profileContent.querySelector(".profile-side").append(profileMeta);
  if (own && isMember()) {
    const customize = document.createElement("form");
    customize.id = "profileForm"; customize.className = "profile-customize";
    customize.innerHTML = `<p class="eyebrow">MAKE IT YOURS</p><label>Display name <input id="profileNameInput" maxlength="60" value="${escapeHtml(member.displayName || "")}"></label><label>Short bio <textarea id="profileBioInput" maxlength="80">${escapeHtml(member.bio || "")}</textarea></label><label>Library colour <input id="profileColorInput" type="color" value="${accent}"></label><details class="card-extra-options"><summary>More card details</summary><label>Favourite genre <input id="profileGenreInput" maxlength="40" value="${escapeHtml(member.favoriteGenre || "")}" placeholder="e.g. Fantasy"></label><label>Currently reading <input id="profileCurrentInput" maxlength="100" value="${escapeHtml(member.currentlyReading || "")}" placeholder="A book you are into right now"></label>${isOfficer() ? `<label>Club role label <select id="profileTitleInput"><option value="Officer" ${member.clubTitle !== "President" ? "selected" : ""}>Officer</option><option value="President" ${member.clubTitle === "President" ? "selected" : ""}>President</option></select></label>` : ""}</details><button type="submit" class="text-button">Save library card</button>`;
    const avatarLabel = document.createElement("label"); avatarLabel.innerHTML = `Public avatar URL <input id="profilePhotoInput" type="url" maxlength="500" value="${escapeHtml(member.photoURL || "")}" placeholder="Optional image link">`; customize.querySelector("#profileColorInput").closest("label").after(avatarLabel);
    ui.profileContent.querySelector(".profile-side").append(customize); customize.addEventListener("submit", saveProfileCard);
  }
  ui.profileDialog.showModal(); state.stopShelf?.(); state.stopShelf = onSnapshot(collection(db, "memberShelves", uid, "entries"), (shelf) => renderShelf(shelf.docs.map((entry) => ({ id: entry.id, ...entry.data() }))), () => { $("personalBooks").innerHTML = '<p class="empty-state">This library is unavailable right now.</p>'; });
  const shelfForm = $("shelfForm"); if (shelfForm) { const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "text-button shelf-form-toggle"; toggle.textContent = "Add a book"; shelfForm.before(toggle); shelfForm.hidden = true; toggle.addEventListener("click", () => { shelfForm.hidden = !shelfForm.hidden; toggle.textContent = shelfForm.hidden ? "Add a book" : "Hide add-book form"; }); const catalogButton = document.createElement("button"); catalogButton.id = "openCatalogFromShelf"; catalogButton.type = "button"; catalogButton.className = "text-button"; catalogButton.textContent = "Find a book automatically"; shelfForm.querySelector("h4").after(catalogButton); catalogButton.addEventListener("click", () => openCatalog("shelf")); const file = document.createElement("input"); file.id = "shelfFile"; file.type = "file"; file.accept = "image/*"; file.setAttribute("aria-label", "Upload a cover"); shelfForm.querySelector("#shelfCover").after(file); shelfForm.addEventListener("submit", addShelfBook); }
}
async function saveProfileCard(event) { event.preventDefault(); if (!isMember() || !state.openProfileId) return; try { const updates = { displayName: $("profileNameInput").value.trim() || "Club member", photoURL: $("profilePhotoInput")?.value.trim() || "", bio: $("profileBioInput").value.trim(), themeColor: $("profileColorInput").value, favoriteGenre: $("profileGenreInput")?.value.trim() || "", currentlyReading: $("profileCurrentInput")?.value.trim() || "" }; if (isOfficer()) updates.clubTitle = $("profileTitleInput")?.value || "Officer"; await setDoc(doc(db, "members", state.openProfileId), updates, { merge: true }); state.profile = { ...state.profile, ...updates }; setAuthUi(); toast("Your library card is updated."); } catch (error) { console.error(error); toast("Could not update your library card."); } }
function shelfStatusOptions(value) { return [["reading", "Reading"], ["read", "Read"], ["want-to-read", "Want to read"]].map(([key, label]) => `<option value="${key}" ${key === value ? "selected" : ""}>${label}</option>`).join(""); }
function renderShelf(entries) { const reading = entries.filter((entry) => entry.status === "reading").length; const own = state.user?.uid === state.openProfileId && isMember(); state.shelfEntries = entries; $("libraryStats").innerHTML = `<span>${entries.length} on shelf</span><span>${reading} reading</span>`; $("personalBooks").innerHTML = entries.length ? recentFirst(entries).map((entry) => `<article class="personal-book"><button type="button" class="personal-cover-button" data-shelf-book-id="${entry.id}" aria-label="Open ${escapeHtml(entry.title)}">${entry.coverUrl ? `<img src="${escapeHtml(entry.coverUrl)}" alt="Cover of ${escapeHtml(entry.title)}">` : `<span class="personal-fallback">${escapeHtml(entry.title)}</span>`}</button><div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.author)}</small><span class="status">${escapeHtml(String(entry.status || "reading").replace(/-/g, " "))}</span>${own ? `<button type="button" class="text-button shelf-status-button" data-edit-shelf-id="${entry.id}">Change status</button><div id="shelf-editor-${entry.id}" class="shelf-editor" hidden><select id="shelf-status-${entry.id}" aria-label="New reading status">${shelfStatusOptions(entry.status || "reading")}</select><button type="button" class="text-button" data-save-shelf-id="${entry.id}">Save</button></div>` : ""}</div></article>`).join("") : '<p class="empty-state">This little library is waiting for its first book.</p>'; }
async function loadRecommendationReasons(bookId) { const target = $("bookReasons"); if (!target) return; try { const snapshot = await getDocs(collection(db, "books", bookId, "recommendations")); const reasons = snapshot.docs.map((entry) => entry.data()).filter((item) => item.reason); target.innerHTML = reasons.length ? `<h3>Why members recommend it</h3>${reasons.map((item) => `<article class="book-reason"><strong>${escapeHtml(item.displayName || "Club member")}</strong><p>${escapeHtml(item.reason)}</p></article>`).join("")}` : ""; } catch { target.innerHTML = ""; } }
function openBookDetails(book, personal = false) { const title = book.title || "Untitled book"; const about = book.synopsis || ""; ui.bookContent.innerHTML = `<div class="book-detail"><div class="book-detail-cover">${coverMarkup(book.coverUrl, title)}</div><div><p class="eyebrow">${personal ? "FROM A MEMBER LIBRARY" : "FROM THE MEMBER BOOKSHELF"}</p><h2>${escapeHtml(title)}</h2><p class="book-byline">by ${escapeHtml(book.author || "Unknown author")}</p>${book.genre ? `<span class="book-tag">${escapeHtml(book.genre)}</span>` : ""}${personal ? `<p><strong>${escapeHtml(String(book.status || "reading").replace(/-/g, " "))}</strong>${book.note ? ` · ${escapeHtml(book.note)}` : ""}</p>${about ? `<p><strong>About the book</strong><br>${escapeHtml(about)}</p>` : ""}` : `${about ? `<p><strong>About the book</strong><br>${escapeHtml(about)}</p>` : ""}${book.why ? `<p><strong>Why they recommend it</strong><br>${escapeHtml(book.why)}</p>` : ""}${book.memberName || book.name ? `<p class="book-recommender">Recommended by ${escapeHtml(book.memberName || book.name)}</p>` : ""}<div id="bookReasons" class="book-reasons"></div>`}</div></div>`; ui.bookDialog.showModal(); if (!personal) loadRecommendationReasons(book.id); }
async function updateShelfStatus(entryId) { if (!isMember() || !state.openProfileId) return; const status = $(`shelf-status-${entryId}`)?.value; if (!status) return; try { await setDoc(doc(db, "memberShelves", state.openProfileId, "entries", entryId), { status }, { merge: true }); toast("Reading status updated."); } catch (error) { console.error(error); toast("Could not update that status."); } }
async function addShelfBook(event) { event.preventDefault(); if (!isMember() || !state.openProfileId) return; try { const file = $("shelfFile")?.files?.[0]; const coverUrl = $("shelfCover").value.trim() || (file ? await uploadImage(file) : ""); await addDoc(collection(db, "memberShelves", state.openProfileId, "entries"), { title: $("shelfTitle").value.trim(), author: $("shelfAuthor").value.trim(), coverUrl, status: $("shelfStatus").value, note: $("shelfNote").value.trim(), date: new Date().toISOString() }); event.target.reset(); } catch (error) { console.error(error); toast(error.message || "Could not add that book."); } }

onSnapshot(collection(db, "books"), (snapshot) => { state.books = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderBooks(); subscribeRatings(); }, () => { ui.books.innerHTML = '<p class="empty-state">The bookshelf is unavailable right now.</p>'; });
onSnapshot(collection(db, "members"), (snapshot) => { state.members = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderMembers(); renderMonth(); }, () => { ui.members.innerHTML = '<p class="empty-state">Member libraries are unavailable right now.</p>'; });
onSnapshot(doc(db, "siteSettings", "currentPick"), (snapshot) => { const pick = snapshot.data() || {}; state.currentPickId = pick.bookId || null; state.monthAccent = /^#[0-9a-f]{6}$/i.test(pick.highlightColor || "") ? pick.highlightColor : "#d8e66f"; if ($("monthAccent")) $("monthAccent").value = state.monthAccent; renderBooks(); subscribeRatings(); }, () => { toast("Book of the Month could not load."); });
onSnapshot(collection(db, "events"), (snapshot) => { state.events = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderEvents(); }, () => { ui.events.innerHTML = '<p class="empty-state">Events are unavailable right now.</p>'; });
onSnapshot(collection(db, "memories"), (snapshot) => { state.memories = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderMemories(); }, () => { ui.memories.innerHTML = '<p class="empty-state">Reading memories are unavailable right now.</p>'; });

ui.signIn.addEventListener("click", signIn); ui.signOut.addEventListener("click", () => signOut(auth)); ui.profile.addEventListener("click", () => openProfile(state.user.uid));
$("openSuggestionButton").addEventListener("click", () => openCatalog("recommendation")); ui.suggestionForm.addEventListener("submit", submitSuggestion); ui.catalogSearchForm.addEventListener("submit", submitCatalogSearch); ui.catalogDestination.addEventListener("change", updateCatalogDestination); ui.catalogSave.addEventListener("click", saveCatalogBook); ui.catalogManual.addEventListener("click", openManualCatalogEntry); ui.monthForm.addEventListener("submit", saveRating); ui.saveMonth.addEventListener("click", saveMonth); ui.eventForm.addEventListener("submit", addEvent); ui.memoryForm.addEventListener("submit", addMemory); ui.inviteForm.addEventListener("submit", addInvite); ui.uploadSettingsForm.addEventListener("submit", saveUploadSettings); ui.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")); setTheme(localStorage.getItem("becTheme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
ui.search.addEventListener("input", (event) => { state.search = event.target.value; renderBooks(); }); ui.genre.addEventListener("change", (event) => { state.genre = event.target.value; renderBooks(); });
document.addEventListener("click", async (event) => { const close = event.target.closest("[data-close]"); if (close) $(close.dataset.close).close(); const catalogResult = event.target.closest("[data-catalog-result]"); if (catalogResult) await selectCatalogBook(Number(catalogResult.dataset.catalogResult)); const book = event.target.closest("[data-book-id]"); if (book) { const item = state.books.find((entry) => entry.id === book.dataset.bookId); if (item) openBookDetails(item); } const shelfBook = event.target.closest("[data-shelf-book-id]"); if (shelfBook) { const item = state.shelfEntries.find((entry) => entry.id === shelfBook.dataset.shelfBookId); if (item) openBookDetails(item, true); } const editShelf = event.target.closest("[data-edit-shelf-id]"); if (editShelf) { const editor = $(`shelf-editor-${editShelf.dataset.editShelfId}`); if (editor) editor.hidden = !editor.hidden; } const saveShelf = event.target.closest("[data-save-shelf-id]"); if (saveShelf) await updateShelfStatus(saveShelf.dataset.saveShelfId); const member = event.target.closest("[data-member-id]"); if (member) openProfile(member.dataset.memberId); const removeEvent = event.target.closest("[data-remove-event]"); if (removeEvent && isOfficer()) await deleteDoc(doc(db, "events", removeEvent.dataset.removeEvent)); const removeMemory = event.target.closest("[data-remove-memory]"); if (removeMemory && isOfficer()) await deleteDoc(doc(db, "memories", removeMemory.dataset.removeMemory)); });
document.addEventListener("error", (event) => { if (event.target.matches(".book-card img")) event.target.replaceWith(Object.assign(document.createElement("div"), { className: "fallback-cover", textContent: event.target.alt.replace("Cover of ", "") })); if (event.target.matches(".memory img")) event.target.closest(".memory")?.remove(); if (event.target.matches(".personal-book img")) event.target.replaceWith(Object.assign(document.createElement("div"), { className: "personal-fallback", textContent: event.target.alt.replace("Cover of ", "") })); if (event.target.matches(".catalog-result img")) event.target.replaceWith(Object.assign(document.createElement("span"), { className: "catalog-result-cover", textContent: event.target.alt.replace("Cover of ", "") })); }, true);
