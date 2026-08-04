import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc,
  updateDoc, setDoc, getDoc, deleteDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-G9WsH-sMdTzXvylNSJ1b-l5XkjBEol4",
  authDomain: "book-enthusiast-club.firebaseapp.com",
  projectId: "book-enthusiast-club",
  storageBucket: "book-enthusiast-club.firebasestorage.app",
  messagingSenderId: "100530002767",
  appId: "1:100530002767:web:4c65036568a65dc154c33a",
  measurementId: "G-DQS9JYY81F"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const booksCollection = collection(db, "books");

// Keep your existing officer email(s) here, in lowercase.
const ADMIN_EMAILS = ["replace-with-officer-email@example.com"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const BOOKS_PER_PAGE = 12;
const limits = { name: 60, title: 160, author: 100, genre: 80, why: 800, comment: 500, board: 280 };

const state = {
  uploadProvider: localStorage.getItem("uploadProvider") || "",
  cloudName: localStorage.getItem("cloudName") || "",
  imgbbKey: localStorage.getItem("imgbbKey") || "",
  uploadedImageUrl: null,
  isUploading: false,
  books: [],
  visibleBooks: BOOKS_PER_PAGE,
  user: null,
  member: null,
  currentPickId: null,
  pendingBooks: [],
  announcement: "",
  unsubscribePendingBooks: null
};

const elements = {
  bookshelf: document.getElementById("bookshelf"), form: document.getElementById("recForm"),
  successMessage: document.getElementById("successMsg"), uploadArea: document.getElementById("uploadArea"),
  coverUpload: document.getElementById("coverUpload"), uploadPreview: document.getElementById("uploadPreview"),
  uploadStatus: document.getElementById("uploadStatus"), setupModal: document.getElementById("setupModal"),
  suggestionModal: document.getElementById("suggestionModal"), bookDetailModal: document.getElementById("bookDetailModal"),
  profileModal: document.getElementById("profileModal"), reviewModal: document.getElementById("reviewModal"),
  memberGreeting: document.getElementById("memberGreeting"), memberSignIn: document.getElementById("memberSignIn"),
  memberProfile: document.getElementById("memberProfile"), memberSignOut: document.getElementById("memberSignOut"),
  currentPickCover: document.getElementById("currentPickCover"), currentPickPlaceholder: document.getElementById("currentPickPlaceholder"),
  currentPickTitle: document.getElementById("currentPickTitle"), currentPickAuthor: document.getElementById("currentPickAuthor"),
  currentPickDescription: document.getElementById("currentPickDescription"), currentPickMeta: document.getElementById("currentPickMeta"),
  currentPickSelect: document.getElementById("currentPickSelect"), officerPicker: document.getElementById("officerPicker"),
  officerStatus: document.getElementById("officerStatus"), loadMoreBooks: document.getElementById("loadMoreBooks"),
  announcementText: document.getElementById("announcementText"), announcementEditor: document.getElementById("announcementEditor"),
  announcementInput: document.getElementById("announcementInput"), boardForm: document.getElementById("boardForm"),
  boardText: document.getElementById("boardText"), boardStatus: document.getElementById("boardStatus"), pinBoard: document.getElementById("pinBoard"),
  reviewButton: document.getElementById("reviewButton"), pendingList: document.getElementById("pendingList")
};

function escapeHtml(value) { const node = document.createElement("div"); node.textContent = String(value || ""); return node.innerHTML; }
function initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Just now" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function isOfficer() { return Boolean(state.user?.email && ADMIN_EMAILS.includes(state.user.email.toLowerCase())); }
function isMember() { return Boolean(state.user && state.member); }

function showMessage(message, type = "success") {
  elements.successMessage.textContent = message;
  elements.successMessage.classList.toggle("error", type === "error");
  elements.successMessage.classList.add("visible");
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => elements.successMessage.classList.remove("visible"), 4500);
}
function setUploadStatus(message, type = "") { elements.uploadStatus.textContent = message; elements.uploadStatus.className = `upload-status ${type}`.trim(); }
function showModal(modal) { modal.hidden = false; requestAnimationFrame(() => modal.classList.add("active")); modal.querySelector("button")?.focus(); }
function closeModal(modal) { modal.classList.remove("active"); setTimeout(() => { modal.hidden = true; }, 180); }

// ====== MEMBER ACCOUNTS ======
async function signInMember() {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (error) { console.error("Sign-in failed:", error); elements.memberGreeting.textContent = "Sign-in was cancelled or unavailable."; }
}
async function ensureMemberProfile(user) {
  const memberRef = doc(db, "members", user.uid);
  const existing = await getDoc(memberRef);
  const profile = existing.exists() ? existing.data() : {};
  if (!existing.exists()) {
    await setDoc(memberRef, { displayName: user.displayName || "Club member", photoURL: user.photoURL || "", joinedAt: new Date().toISOString() });
  }
  return { ...profile, displayName: profile.displayName || user.displayName || "Club member", photoURL: profile.photoURL || user.photoURL || "", joinedAt: profile.joinedAt || new Date().toISOString() };
}
function updateMemberUi() {
  const member = isMember();
  elements.memberGreeting.textContent = member ? `Hi, ${state.member.displayName}` : "Reading as a guest";
  elements.memberSignIn.hidden = member;
  elements.memberProfile.hidden = !member;
  elements.memberSignOut.hidden = !member;
  elements.officerPicker.hidden = !isOfficer();
  elements.announcementEditor.hidden = !isOfficer();
  elements.reviewButton.hidden = !isOfficer();
  if (isOfficer()) elements.announcementInput.value = state.announcement;
  elements.officerStatus.textContent = isOfficer() ? "Officer controls are ready." : "";
}
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.member = null;
  if (user) {
    try { state.member = await ensureMemberProfile(user); }
    catch (error) { console.error("Could not create member profile:", error); }
  }
  updateMemberUi();
  subscribePendingBooks();
});

// ====== SETUP AND UPLOADS ======
function showSetup() { elements.setupModal.hidden = false; elements.setupModal.classList.add("active"); document.getElementById("cloudNameInput").value = state.cloudName; document.getElementById("imgbbKeyInput").value = state.imgbbKey; }
function closeSetup() { closeModal(elements.setupModal); localStorage.setItem("setupDismissed", "true"); }
function switchProviderTab(provider) { document.querySelectorAll(".provider-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.provider === provider)); document.querySelectorAll(".provider-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${provider}`)); }
function saveUploadProvider(provider) {
  const value = document.getElementById(provider === "cloudinary" ? "cloudNameInput" : "imgbbKeyInput").value.trim();
  if (!value) return showMessage("Please enter the required upload setting first.", "error");
  localStorage.setItem(provider === "cloudinary" ? "cloudName" : "imgbbKey", value); localStorage.setItem("uploadProvider", provider); window.location.reload();
}
function configuredUploadProvider() { return state.uploadProvider && (state.uploadProvider !== "cloudinary" || state.cloudName) && (state.uploadProvider !== "imgbb" || state.imgbbKey); }
async function handleFile(file) {
  if (state.isUploading) return;
  if (!file.type.startsWith("image/")) return setUploadStatus("Please upload an image file.", "error");
  if (file.size > MAX_IMAGE_BYTES) return setUploadStatus("Please choose an image smaller than 8 MB.", "error");
  if (!configuredUploadProvider()) { setUploadStatus("Set up cover uploads first.", "error"); showSetup(); return; }
  state.isUploading = true; elements.coverUpload.disabled = true;
  const reader = new FileReader(); reader.onload = (event) => { elements.uploadPreview.src = event.target.result; elements.uploadPreview.classList.add("visible"); }; reader.readAsDataURL(file);
  setUploadStatus("Uploading…", "uploading");
  try { state.uploadedImageUrl = state.uploadProvider === "imgbb" ? await uploadToImgbb(file) : await uploadToCloudinary(file); setUploadStatus("Uploaded", "success"); }
  catch (error) { console.error(error); setUploadStatus(`Upload failed: ${error.message}`, "error"); }
  finally { state.isUploading = false; elements.coverUpload.disabled = false; }
}
async function uploadToCloudinary(file) { const data = new FormData(); data.append("file", file); data.append("upload_preset", "bookclub_unsigned"); const response = await fetch(`https://api.cloudinary.com/v1_1/${state.cloudName}/image/upload`, { method: "POST", body: data }); const result = await response.json().catch(() => ({})); if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Cloudinary upload failed"); return result.secure_url; }
async function uploadToImgbb(file) { const data = new FormData(); data.append("image", file); const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(state.imgbbKey)}`, { method: "POST", body: data }); const result = await response.json().catch(() => ({})); if (!response.ok || !result.success) throw new Error(result.error?.message || "ImgBB upload failed"); return result.data.url; }

// ====== BOOKS, COMMENTS, AND PROFILES ======
function renderCommentList(comments) {
  if (!comments?.length) return '<div class="no-comments">No comments yet — be the first!</div>';
  return comments.map((comment) => `<div class="comment-item"><div class="comment-avatar">${escapeHtml(initials(comment.name))}</div><div><div class="comment-author">${escapeHtml(comment.name)} <span>${formatDate(comment.date)}</span></div><div class="comment-text">${escapeHtml(comment.text)}</div></div></div>`).join("");
}
function renderBooks() {
  const shown = state.books.slice(0, state.visibleBooks);
  elements.bookshelf.innerHTML = shown.length ? shown.map((book) => `<article class="book-card" data-book-id="${book.id}" role="button" tabindex="0" aria-label="Open details for ${escapeHtml(book.title)}">${book.coverUrl ? `<img class="book-card-cover" src="${escapeHtml(book.coverUrl)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy">` : `<div class="book-card-cover-placeholder"><span>${escapeHtml(book.title)}</span></div>`}<div class="book-card-overlay"><span>${escapeHtml(book.title)}</span><small>Open book</small></div></article>`).join("") : '<div class="empty-shelf">The shelf is waiting for its first books.<span class="sub">Be the first to add one below!</span></div>';
  elements.loadMoreBooks.hidden = state.visibleBooks >= state.books.length;
  populateCurrentPickOptions();
}
function populateCurrentPickOptions() { elements.currentPickSelect.innerHTML = '<option value="">Choose a recommendation…</option>' + state.books.map((book) => `<option value="${book.id}" ${book.id === state.currentPickId ? "selected" : ""}>${escapeHtml(book.title)} — ${escapeHtml(book.author)}</option>`).join(""); renderCurrentPick(state.books.find((book) => book.id === state.currentPickId)); }
function renderCurrentPick(book) { const covered = Boolean(book?.coverUrl); elements.currentPickCover.hidden = !covered; elements.currentPickPlaceholder.hidden = covered; if (covered) elements.currentPickCover.src = book.coverUrl; elements.currentPickPlaceholder.querySelector("span").innerHTML = book ? escapeHtml(book.title).replace(/ /g, "<br>") : "Your First<br>Book Here"; elements.currentPickTitle.textContent = book?.title || "The Current Pick"; elements.currentPickAuthor.textContent = book ? `by ${book.author}` : "Choose a book from the shelf"; elements.currentPickDescription.textContent = book?.why || "When officers select a member recommendation, it will become the club’s Current Pick right here."; elements.currentPickMeta.textContent = book ? `Recommended by ${book.name}${book.genre ? ` · ${book.genre}` : ""}` : "Waiting for the next read"; }
function openBookDetail(book) { document.getElementById("bookDetailTitle").textContent = book.title; document.getElementById("bookDetailAuthor").textContent = `by ${book.author}`; document.getElementById("bookDetailWhy").textContent = book.why || "No note was added with this recommendation."; document.getElementById("bookDetailMeta").textContent = `${book.genre || "No genre"} · Recommended by ${book.memberName || book.name}`; document.getElementById("bookDetailComments").innerHTML = renderCommentList(book.comments || []); document.getElementById("bookDetailCommentForm").dataset.bookId = book.id; const profileButton = document.getElementById("bookDetailProfile"); profileButton.dataset.memberId = book.memberId || ""; profileButton.textContent = book.memberId ? `View ${book.memberName || book.name}'s shelf` : ""; profileButton.hidden = !book.memberId; const image = document.getElementById("bookDetailCover"); const placeholder = document.getElementById("bookDetailPlaceholder"); image.hidden = !book.coverUrl; placeholder.hidden = Boolean(book.coverUrl); placeholder.textContent = book.title; if (book.coverUrl) image.src = book.coverUrl; showModal(elements.bookDetailModal); }
async function openProfile(memberId) {
  if (!memberId) return;
  const snapshot = await getDoc(doc(db, "members", memberId));
  if (!snapshot.exists()) return showMessage("This member profile is not available yet.", "error");
  const member = snapshot.data(); const own = state.user?.uid === memberId;
  const photo = document.getElementById("profilePhoto"), initial = document.getElementById("profileInitial"); photo.hidden = !member.photoURL; initial.hidden = Boolean(member.photoURL); if (member.photoURL) photo.src = member.photoURL; initial.textContent = initials(member.displayName); document.getElementById("profileName").textContent = member.displayName; document.getElementById("profileJoined").textContent = `Member since ${formatDate(member.joinedAt)}`; const ownBooks = state.books.filter((book) => book.memberId === memberId); document.getElementById("profileBooks").innerHTML = ownBooks.length ? ownBooks.map((book) => `<button type="button" data-book-id="${book.id}" class="profile-book">${escapeHtml(book.title)}</button>`).join("") : '<p class="hint">No shelf additions yet.</p>'; const edit = document.getElementById("profileEdit"); edit.hidden = !own; if (own) document.getElementById("profileNameInput").value = member.displayName; elements.profileModal.dataset.memberId = memberId; showModal(elements.profileModal);
}
async function postComment(event) { event.preventDefault(); const form = event.target; const name = form.elements["comment-name"].value.trim(); const text = form.elements["comment-text"].value.trim(); if (!name || !text) return; const button = form.querySelector("button[type=submit]"); button.disabled = true; try { await updateDoc(doc(db, "books", form.dataset.bookId), { comments: arrayUnion({ name, text, date: new Date().toISOString() }) }); form.reset(); } catch (error) { console.error(error); showMessage("Could not post your comment — check your connection and try again.", "error"); } finally { button.disabled = false; } }

// ====== SUGGESTIONS AND OFFICER REVIEW ======
async function submitSuggestion(event) {
  event.preventDefault(); const data = new FormData(elements.form); const book = { name: data.get("name").trim(), title: data.get("bookTitle").trim(), author: data.get("author").trim(), genre: data.get("genre").trim(), why: data.get("why").trim(), coverUrl: state.uploadedImageUrl, comments: [], date: new Date().toISOString() };
  if (!book.name || !book.title || !book.author) return showMessage("Please fill in your name, title, and author.", "error");
  const button = elements.form.querySelector("button[type=submit]"); button.disabled = true;
  try {
    if (isMember()) { await addDoc(booksCollection, { ...book, memberId: state.user.uid, memberName: state.member.displayName, memberPhoto: state.member.photoURL || "" }); showMessage("Your recommendation has been added to the shelf!"); }
    else { await addDoc(collection(db, "pendingBooks"), { ...book, submittedAt: new Date().toISOString(), status: "pending" }); showMessage("Thanks — an officer will review this before it goes on the shelf."); }
    elements.form.reset(); elements.uploadPreview.classList.remove("visible"); elements.uploadPreview.src = ""; elements.coverUpload.value = ""; state.uploadedImageUrl = null; setUploadStatus("");
  } catch (error) { console.error(error); showMessage("Could not send your suggestion. Please try again.", "error"); }
  finally { button.disabled = false; }
}
function renderPendingBooks() { elements.pendingList.innerHTML = state.pendingBooks.length ? state.pendingBooks.map((book) => `<article class="pending-book"><strong>${escapeHtml(book.title)}</strong><span>by ${escapeHtml(book.author)} · suggested by ${escapeHtml(book.name)}</span><p>${escapeHtml(book.why || "No note")}</p><button type="button" data-action="approve-pending" data-id="${book.id}">Approve</button><button type="button" data-action="reject-pending" data-id="${book.id}" class="text-link-btn">Reject</button></article>`).join("") : '<p class="hint">No suggestions waiting for review.</p>'; }
function subscribePendingBooks() {
  state.unsubscribePendingBooks?.();
  state.pendingBooks = [];
  renderPendingBooks();
  if (!isOfficer()) return;
  state.unsubscribePendingBooks = onSnapshot(query(collection(db, "pendingBooks"), orderBy("submittedAt", "desc")), (snapshot) => {
    state.pendingBooks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderPendingBooks();
  }, (error) => console.error("Pending suggestions error:", error));
}
async function reviewPending(id, approved) { if (!isOfficer()) return; const pending = state.pendingBooks.find((book) => book.id === id); if (!pending) return; try { if (approved) { const { id: ignored, submittedAt, status, ...book } = pending; await addDoc(booksCollection, { ...book, approvedAt: new Date().toISOString() }); } await deleteDoc(doc(db, "pendingBooks", id)); } catch (error) { console.error(error); showMessage("Could not update this suggestion.", "error"); } }

// ====== ANNOUNCEMENTS AND PIN BOARD ======
async function saveAnnouncement() { if (!isOfficer()) return; const text = elements.announcementInput.value.trim(); try { await setDoc(doc(db, "siteSettings", "announcement"), { text, updatedAt: new Date().toISOString() }); } catch (error) { console.error(error); showMessage("Could not save the announcement.", "error"); } }
function renderBoard(posts) { elements.pinBoard.innerHTML = posts.length ? posts.map((post) => `<article class="pin-note"><div class="pin-avatar">${escapeHtml(initials(post.displayName))}</div><p>${escapeHtml(post.text)}</p><span>${escapeHtml(post.displayName)} · ${formatDate(post.date)}</span></article>`).join("") : '<div class="no-comments">No pins yet. Leave the first note!</div>'; }
async function postBoard(event) { event.preventDefault(); const text = elements.boardText.value.trim(); if (!isMember()) { elements.boardStatus.textContent = "Sign in as a member to pin a note."; return; } if (!text) return; const button = elements.boardForm.querySelector("button"); button.disabled = true; try { await addDoc(collection(db, "boardPosts"), { text, memberId: state.user.uid, displayName: state.member.displayName, photoURL: state.member.photoURL || "", date: new Date().toISOString() }); elements.boardText.value = ""; elements.boardStatus.textContent = "Pinned!"; } catch (error) { console.error(error); elements.boardStatus.textContent = "Could not pin that note."; } finally { button.disabled = false; } }

// ====== REALTIME LISTENERS ======
onSnapshot(query(booksCollection, orderBy("date", "desc")), (snapshot) => { state.books = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderBooks(); }, (error) => { console.error(error); elements.bookshelf.innerHTML = '<div class="empty-shelf">Couldn’t load the shelf right now.</div>'; });
onSnapshot(doc(db, "siteSettings", "currentPick"), (snapshot) => { state.currentPickId = snapshot.data()?.bookId || null; renderCurrentPick(state.books.find((book) => book.id === state.currentPickId)); });
onSnapshot(doc(db, "siteSettings", "announcement"), (snapshot) => { state.announcement = snapshot.data()?.text || ""; elements.announcementText.textContent = state.announcement || "No announcements yet—check back soon."; if (isOfficer()) elements.announcementInput.value = state.announcement; });
onSnapshot(query(collection(db, "boardPosts"), orderBy("date", "desc")), (snapshot) => renderBoard(snapshot.docs.map((item) => item.data())), (error) => { console.error(error); elements.pinBoard.innerHTML = '<div class="no-comments">The pin board is taking a small break.</div>'; });

// ====== EVENTS ======
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]"); const action = target?.dataset.action;
  if (action === "member-sign-in") signInMember(); if (action === "sign-out") signOut(auth);
  if (action === "show-setup") showSetup(); if (action === "close-setup") closeSetup(); if (action === "save-cloudinary") saveUploadProvider("cloudinary"); if (action === "save-imgbb") saveUploadProvider("imgbb");
  if (action === "open-suggestion") showModal(elements.suggestionModal); if (action === "close-suggestion") closeModal(elements.suggestionModal);
  if (action === "close-book-detail") closeModal(elements.bookDetailModal); if (action === "close-profile") closeModal(elements.profileModal); if (action === "close-review") closeModal(elements.reviewModal);
  if (action === "save-current-pick") { if (isOfficer() && elements.currentPickSelect.value) setDoc(doc(db, "siteSettings", "currentPick"), { bookId: elements.currentPickSelect.value, updatedAt: new Date().toISOString() }); }
  if (action === "save-announcement") saveAnnouncement(); if (action === "open-review" && isOfficer()) showModal(elements.reviewModal);
  if (action === "approve-pending") reviewPending(target.dataset.id, true); if (action === "reject-pending") reviewPending(target.dataset.id, false);
  if (action === "show-profile") openProfile(state.user?.uid); if (target?.id === "bookDetailProfile") openProfile(target.dataset.memberId);
  if (action === "save-profile") { const name = document.getElementById("profileNameInput").value.trim(); if (name && state.user) setDoc(doc(db, "members", state.user.uid), { displayName: name }, { merge: true }).then(() => { state.member.displayName = name; updateMemberUi(); }); }
  const tab = event.target.closest(".provider-tab"); if (tab) switchProviderTab(tab.dataset.provider);
  const profileBook = event.target.closest(".profile-book"); if (profileBook) { const book = state.books.find((item) => item.id === profileBook.dataset.bookId); if (book) { closeModal(elements.profileModal); openBookDetail(book); } }
});
elements.bookshelf.addEventListener("click", (event) => { const card = event.target.closest(".book-card"); const book = state.books.find((item) => item.id === card?.dataset.bookId); if (book) openBookDetail(book); });
elements.bookshelf.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key) && event.target.matches(".book-card")) { event.preventDefault(); const book = state.books.find((item) => item.id === event.target.dataset.bookId); if (book) openBookDetail(book); } });
elements.bookshelf.addEventListener("error", (event) => { if (event.target.matches(".book-card-cover")) { const placeholder = document.createElement("div"); placeholder.className = "book-card-cover-placeholder"; placeholder.textContent = event.target.alt.replace(/^Cover of /, ""); event.target.replaceWith(placeholder); } }, true);
elements.bookDetailModal.addEventListener("submit", (event) => { if (event.target.matches(".comment-form")) postComment(event); });
elements.bookDetailModal.addEventListener("click", (event) => { if (event.target === elements.bookDetailModal) closeModal(elements.bookDetailModal); });
elements.suggestionModal.addEventListener("click", (event) => { if (event.target === elements.suggestionModal) closeModal(elements.suggestionModal); });
elements.profileModal.addEventListener("click", (event) => { if (event.target === elements.profileModal) closeModal(elements.profileModal); });
elements.reviewModal.addEventListener("click", (event) => { if (event.target === elements.reviewModal) closeModal(elements.reviewModal); });
elements.uploadArea.addEventListener("dragover", (event) => { event.preventDefault(); elements.uploadArea.classList.add("dragover"); });
elements.uploadArea.addEventListener("dragleave", () => elements.uploadArea.classList.remove("dragover"));
elements.uploadArea.addEventListener("drop", (event) => { event.preventDefault(); elements.uploadArea.classList.remove("dragover"); if (event.dataTransfer.files.length) handleFile(event.dataTransfer.files[0]); });
elements.coverUpload.addEventListener("change", (event) => { if (event.target.files.length) handleFile(event.target.files[0]); });
elements.form.addEventListener("submit", submitSuggestion); elements.boardForm.addEventListener("submit", postBoard);
elements.loadMoreBooks.addEventListener("click", () => { state.visibleBooks += BOOKS_PER_PAGE; renderBooks(); });
document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; [elements.setupModal, elements.suggestionModal, elements.bookDetailModal, elements.profileModal, elements.reviewModal].filter((modal) => !modal.hidden).forEach(closeModal); });
if (!state.uploadProvider && localStorage.getItem("setupDismissed") !== "true") setTimeout(showSetup, 600);

const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("in-view"); revealObserver.unobserve(entry.target); } }), { threshold: .15, rootMargin: "0px 0px -60px 0px" });
document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
