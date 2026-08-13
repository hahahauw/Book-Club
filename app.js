import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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
  members: $("membersGrid"), suggestionDialog: $("suggestionDialog"), suggestionForm: $("suggestionForm"), suggestionMessage: $("suggestionMessage"), profileDialog: $("profileDialog"), profileContent: $("profileContent")
};

const state = { user: null, profile: null, books: [], members: [], currentPickId: null, ratings: [], events: [], memories: [], search: "", genre: "", openProfileId: null, stopRatings: null, stopShelf: null, cloudName: localStorage.getItem("becCloudName") || "", uploadPreset: localStorage.getItem("becUploadPreset") || "bookclub_unsigned" };
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
function setAuthUi() { const name = state.profile?.displayName || state.user?.displayName || "reader"; ui.authStatus.textContent = isMember() ? `Hello, ${name}` : state.user ? "Signed in — member access pending" : "Exploring as a guest"; ui.signIn.hidden = Boolean(state.user); ui.signOut.hidden = !state.user; ui.profile.hidden = !isMember(); ui.monthOfficer.hidden = !isOfficer(); ui.eventForm.hidden = !isOfficer(); ui.memoryForm.hidden = !isOfficer(); ui.inviteForm.hidden = !isOfficer(); ui.uploadSettingsForm.hidden = !isOfficer(); if (isOfficer()) { ui.cloudName.value = state.cloudName; ui.uploadPreset.value = state.uploadPreset; } renderMonth(); renderEvents(); renderMemories(); }

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
  ui.month.innerHTML = `<div class="month-cover">${coverMarkup(book.coverUrl, book.title)}</div><div><p class="eyebrow">BOOK OF THE MONTH</p><h3>${escapeHtml(book.title)}</h3><p>by ${escapeHtml(book.author)}</p><p>${escapeHtml(book.why || "Read along at your own pace, then leave a rating or discussion note.")}</p></div>`;
  ui.monthCommunity.hidden = false;
  const count = Math.max(state.members.length, 1), finished = state.ratings.filter((item) => item.finished).length;
  const average = state.ratings.length ? (state.ratings.reduce((sum, item) => sum + Number(item.stars || 0), 0) / state.ratings.length).toFixed(1) : "";
  ui.monthRating.textContent = average ? `${"★".repeat(Math.round(average))} ${average}/5` : "No ratings yet";
  ui.monthProgress.textContent = `${Math.round((finished / count) * 100)}% finished`;
  const mine = state.ratings.find((item) => item.memberId === state.user?.uid);
  if (mine) { ui.monthStars.value = String(mine.stars || 5); ui.monthFinished.checked = Boolean(mine.finished); ui.monthComment.value = mine.comment || ""; }
  ui.monthNotes.innerHTML = state.ratings.filter((item) => item.comment).length ? state.ratings.filter((item) => item.comment).map((item) => `<article class="month-note"><strong>${escapeHtml(item.displayName || "Club member")}</strong><span>${"★".repeat(Number(item.stars || 0))}</span><p>${escapeHtml(item.comment)}</p></article>`).join("") : '<p class="empty-state">No discussion notes yet. Be the first to leave one.</p>';
}
function subscribeRatings() { state.stopRatings?.(); state.ratings = []; const book = currentBook(); if (!book) return renderMonth(); state.stopRatings = onSnapshot(collection(db, "bookOfMonthRatings", book.id, "members"), (snapshot) => { state.ratings = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderMonth(); }, () => { ui.monthNotes.innerHTML = '<p class="empty-state">Ratings are unavailable right now.</p>'; }); }

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

async function signIn() { ui.signIn.disabled = true; ui.authStatus.textContent = "Opening Google sign-in…"; try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (error) { console.error(error); ui.authStatus.textContent = "Could not sign in. Please try again."; } finally { ui.signIn.disabled = false; } }
async function ensureProfile(user) {
  const ref = doc(db, "members", user.uid); const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();
  const profile = { displayName: user.displayName || "Club member", photoURL: user.photoURL || "", joinedAt: new Date().toISOString(), role: "member", bio: "", themeColor: "" };
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
async function saveMonth() { if (!isOfficer() || !ui.monthPicker.value) return; try { await setDoc(doc(db, "siteSettings", "currentPick"), { bookId: ui.monthPicker.value, updatedAt: new Date().toISOString() }, { merge: true }); toast("Book of the Month updated."); } catch (error) { console.error(error); toast("Could not set the Book of the Month."); } }

function renderEvents() { ui.events.innerHTML = state.events.length ? [...state.events].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((event) => `<article class="event"><time>${escapeHtml(dateLabel(event.date))}</time><div><h3>${escapeHtml(event.title)}</h3>${event.details ? `<p>${escapeHtml(event.details)}</p>` : ""}</div>${isOfficer() ? `<button class="text-button" type="button" data-remove-event="${event.id}">Remove</button>` : ""}</article>`).join("") : '<p class="empty-state">No events have been added yet.</p>'; }
async function addEvent(event) { event.preventDefault(); if (!isOfficer()) return; try { await addDoc(collection(db, "events"), { title: ui.eventTitle.value.trim(), date: ui.eventDate.value, details: ui.eventDetails.value.trim(), createdAt: new Date().toISOString() }); ui.eventForm.reset(); } catch (error) { console.error(error); toast("Could not add the event."); } }
function renderMemories() { ui.memories.innerHTML = state.memories.length ? recentFirst(state.memories).map((memory) => `<article class="memory"><img src="${escapeHtml(memory.imageUrl)}" alt="${escapeHtml(memory.title)}"><div><small>${escapeHtml(memory.category || "Club memory")}</small><h3>${escapeHtml(memory.title)}</h3></div>${isOfficer() ? `<button class="remove-button" type="button" data-remove-memory="${memory.id}" aria-label="Remove memory">×</button>` : ""}</article>`).join("") : '<p class="empty-state">The club’s first reading memory will appear here soon.</p>'; }
async function addMemory(event) { event.preventDefault(); if (!isOfficer()) return; try { const imageUrl = ui.memoryImage.value.trim() || await uploadImage(ui.memoryFile.files?.[0]); if (!imageUrl) throw new Error("Add an image URL or choose a photo."); await addDoc(collection(db, "memories"), { imageUrl, title: ui.memoryCaption.value.trim(), category: ui.memoryCategory.value.trim(), date: new Date().toISOString() }); ui.memoryForm.reset(); } catch (error) { console.error(error); toast(error.message || "Could not add the memory."); } }
async function addInvite(event) { event.preventDefault(); if (!isOfficer()) return; const email = ui.inviteEmail.value.trim().toLowerCase(); if (!email) return; try { await setDoc(doc(db, "allowedEmails", email), { email, invitedAt: new Date().toISOString() }); ui.inviteForm.reset(); toast("That email can now create a member library."); } catch (error) { console.error(error); toast("Could not approve that email."); } }

function renderMembers() { ui.members.innerHTML = state.members.length ? state.members.map((member) => `<button type="button" class="member-card" data-member-id="${member.id}" style="--accent:${color(member.themeColor)}"><span class="member-avatar">${member.photoURL ? `<img src="${escapeHtml(member.photoURL)}" alt="">` : escapeHtml(initials(member.displayName))}</span><span><strong>${escapeHtml(member.displayName || "Club member")}</strong><small>${member.role === "officer" ? "Officer" : "Member"} library</small></span></button>`).join("") : '<p class="empty-state">Member libraries will appear here.</p>'; }
async function openProfile(uid) {
  const snapshot = await getDoc(doc(db, "members", uid)); if (!snapshot.exists()) return toast("That member library is unavailable."); const member = snapshot.data(); const own = state.user?.uid === uid; const accent = color(member.themeColor); state.openProfileId = uid;
  ui.profileContent.innerHTML = `<div class="profile-layout" style="--accent:${accent}"><aside class="profile-side"><div class="profile-avatar">${member.photoURL ? `<img src="${escapeHtml(member.photoURL)}" alt="">` : escapeHtml(initials(member.displayName))}</div><h2>${escapeHtml(member.displayName || "Club member")}</h2><p>${escapeHtml(member.bio || "A reader in the Book Enthusiasts Club.")}</p><p>Member since ${escapeHtml(dateLabel(String(member.joinedAt || "").slice(0, 10)))}</p></aside><section class="profile-library"><p class="eyebrow">PERSONAL LIBRARY</p><h3>${own ? "My shelf" : `${escapeHtml(member.displayName || "Their")}’s shelf`}</h3><div id="libraryStats" class="library-stats"></div><div id="personalBooks" class="personal-books"><p class="empty-state">Loading this library…</p></div>${own && isMember() ? `<form id="shelfForm" class="add-shelf-form"><h4>Add to my shelf</h4><input id="shelfTitle" maxlength="160" placeholder="Book title" required><input id="shelfAuthor" maxlength="100" placeholder="Author" required><input id="shelfCover" type="url" maxlength="500" placeholder="Cover image URL (optional)"><select id="shelfStatus"><option value="reading">Reading</option><option value="read">Read</option><option value="want-to-read">Want to read</option></select><textarea id="shelfNote" maxlength="280" placeholder="A small note (optional)"></textarea><button class="button" type="submit">Add book</button></form>` : ""}</section></div>`;
  if (own && isMember()) {
    const customize = document.createElement("form");
    customize.id = "profileForm"; customize.className = "profile-customize";
    customize.innerHTML = `<p class="eyebrow">MAKE IT YOURS</p><label>Display name <input id="profileNameInput" maxlength="60" value="${escapeHtml(member.displayName || "")}"></label><label>Short bio <textarea id="profileBioInput" maxlength="80">${escapeHtml(member.bio || "")}</textarea></label><label>Library colour <input id="profileColorInput" type="color" value="${accent}"></label><button type="submit" class="text-button">Save library card</button>`;
    ui.profileContent.querySelector(".profile-side").append(customize); customize.addEventListener("submit", saveProfileCard);
  }
  ui.profileDialog.showModal(); state.stopShelf?.(); state.stopShelf = onSnapshot(collection(db, "memberShelves", uid, "entries"), (shelf) => renderShelf(shelf.docs.map((entry) => ({ id: entry.id, ...entry.data() }))), () => { $("personalBooks").innerHTML = '<p class="empty-state">This library is unavailable right now.</p>'; });
  const shelfForm = $("shelfForm"); if (shelfForm) { const file = document.createElement("input"); file.id = "shelfFile"; file.type = "file"; file.accept = "image/*"; file.setAttribute("aria-label", "Upload a cover"); shelfForm.querySelector("#shelfCover").after(file); shelfForm.addEventListener("submit", addShelfBook); }
}
async function saveProfileCard(event) { event.preventDefault(); if (!isMember() || !state.openProfileId) return; try { await setDoc(doc(db, "members", state.openProfileId), { displayName: $("profileNameInput").value.trim() || "Club member", bio: $("profileBioInput").value.trim(), themeColor: $("profileColorInput").value }, { merge: true }); toast("Your library card is updated."); } catch (error) { console.error(error); toast("Could not update your library card."); } }
function renderShelf(entries) { const reading = entries.filter((entry) => entry.status === "reading").length; $("libraryStats").innerHTML = `<span>${entries.length} on shelf</span><span>${reading} reading</span>`; $("personalBooks").innerHTML = entries.length ? recentFirst(entries).map((entry) => `<article class="personal-book">${entry.coverUrl ? `<img src="${escapeHtml(entry.coverUrl)}" alt="Cover of ${escapeHtml(entry.title)}">` : `<div class="personal-fallback">${escapeHtml(entry.title)}</div>`}<div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.author)}</small><span class="status">${escapeHtml(String(entry.status || "reading").replace(/-/g, " "))}</span></div></article>`).join("") : '<p class="empty-state">This little library is waiting for its first book.</p>'; }
async function addShelfBook(event) { event.preventDefault(); if (!isMember() || !state.openProfileId) return; try { const file = $("shelfFile")?.files?.[0]; const coverUrl = $("shelfCover").value.trim() || (file ? await uploadImage(file) : ""); await addDoc(collection(db, "memberShelves", state.openProfileId, "entries"), { title: $("shelfTitle").value.trim(), author: $("shelfAuthor").value.trim(), coverUrl, status: $("shelfStatus").value, note: $("shelfNote").value.trim(), date: new Date().toISOString() }); event.target.reset(); } catch (error) { console.error(error); toast(error.message || "Could not add that book."); } }

onSnapshot(collection(db, "books"), (snapshot) => { state.books = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderBooks(); subscribeRatings(); }, () => { ui.books.innerHTML = '<p class="empty-state">The bookshelf is unavailable right now.</p>'; });
onSnapshot(collection(db, "members"), (snapshot) => { state.members = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderMembers(); renderMonth(); }, () => { ui.members.innerHTML = '<p class="empty-state">Member libraries are unavailable right now.</p>'; });
onSnapshot(doc(db, "siteSettings", "currentPick"), (snapshot) => { state.currentPickId = snapshot.data()?.bookId || null; renderBooks(); subscribeRatings(); }, () => { toast("Book of the Month could not load."); });
onSnapshot(collection(db, "events"), (snapshot) => { state.events = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderEvents(); }, () => { ui.events.innerHTML = '<p class="empty-state">Events are unavailable right now.</p>'; });
onSnapshot(collection(db, "memories"), (snapshot) => { state.memories = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); renderMemories(); }, () => { ui.memories.innerHTML = '<p class="empty-state">Reading memories are unavailable right now.</p>'; });

ui.signIn.addEventListener("click", signIn); ui.signOut.addEventListener("click", () => signOut(auth)); ui.profile.addEventListener("click", () => openProfile(state.user.uid));
$("openSuggestionButton").addEventListener("click", () => { ensureSuggestionUpload(); ui.suggestionDialog.showModal(); }); ui.suggestionForm.addEventListener("submit", submitSuggestion); ui.monthForm.addEventListener("submit", saveRating); ui.saveMonth.addEventListener("click", saveMonth); ui.eventForm.addEventListener("submit", addEvent); ui.memoryForm.addEventListener("submit", addMemory); ui.inviteForm.addEventListener("submit", addInvite); ui.uploadSettingsForm.addEventListener("submit", saveUploadSettings); ui.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")); setTheme(localStorage.getItem("becTheme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
ui.search.addEventListener("input", (event) => { state.search = event.target.value; renderBooks(); }); ui.genre.addEventListener("change", (event) => { state.genre = event.target.value; renderBooks(); });
document.addEventListener("click", async (event) => { const close = event.target.closest("[data-close]"); if (close) $(close.dataset.close).close(); const book = event.target.closest("[data-book-id]"); if (book) { const item = state.books.find((entry) => entry.id === book.dataset.bookId); if (item) toast(`${item.title} — ${item.author}`); } const member = event.target.closest("[data-member-id]"); if (member) openProfile(member.dataset.memberId); const removeEvent = event.target.closest("[data-remove-event]"); if (removeEvent && isOfficer()) await deleteDoc(doc(db, "events", removeEvent.dataset.removeEvent)); const removeMemory = event.target.closest("[data-remove-memory]"); if (removeMemory && isOfficer()) await deleteDoc(doc(db, "memories", removeMemory.dataset.removeMemory)); });
document.addEventListener("error", (event) => { if (event.target.matches(".book-card img")) event.target.replaceWith(Object.assign(document.createElement("div"), { className: "fallback-cover", textContent: event.target.alt.replace("Cover of ", "") })); if (event.target.matches(".memory img")) event.target.closest(".memory")?.remove(); if (event.target.matches(".personal-book img")) event.target.replaceWith(Object.assign(document.createElement("div"), { className: "personal-fallback", textContent: event.target.alt.replace("Cover of ", "") })); }, true);
