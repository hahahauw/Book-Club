import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc,
  updateDoc, setDoc, getDoc, deleteDoc, writeBatch, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

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
  bookSearch: "",
  genreFilter: "",
  user: null,
  member: null,
  currentPickId: null,
  bookMonth: null,
  bookMonthRatings: [],
  events: [],
  memories: [],
  pendingBooks: [],
  announcement: "",
  unsubscribePendingBooks: null,
  unsubscribeMemberManagement: null,
  members: [],
  invitedEmails: [],
  memberPrivate: [],
  unsubscribeOwnMember: null,
  profileShelfEntries: [],
  unsubscribeProfileShelf: null
  ,unsubscribeBookMonthRatings: null
};

const elements = {
  bookshelf: document.getElementById("bookshelf"), form: document.getElementById("recForm"),
  bookSearch: document.getElementById("bookSearch"), genreFilter: document.getElementById("genreFilter"),
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
  officerToolsButton: document.getElementById("officerToolsButton"), officerSidebar: document.getElementById("officerSidebar"),
  inviteForm: document.getElementById("inviteForm"), inviteEmail: document.getElementById("inviteEmail"), inviteStatus: document.getElementById("inviteStatus"),
  invitedList: document.getElementById("invitedList"), memberList: document.getElementById("memberList"),
  pendingList: document.getElementById("pendingList"), memberDirectory: document.getElementById("memberDirectory"),
  personalShelfForm: document.getElementById("personalShelfForm"), profileStats: document.getElementById("profileStats")
  ,bookMonthFeature: document.getElementById("bookMonthFeature"), bookMonthAverage: document.getElementById("bookMonthAverage"),
  bookMonthProgress: document.getElementById("bookMonthProgress"), bookMonthPrompt: document.getElementById("bookMonthPrompt"),
  bookMonthRatingForm: document.getElementById("bookMonthRatingForm"), bookMonthStars: document.getElementById("bookMonthStars"),
  bookMonthFinished: document.getElementById("bookMonthFinished"), bookMonthComment: document.getElementById("bookMonthComment"),
  bookMonthStatus: document.getElementById("bookMonthStatus"), bookMonthComments: document.getElementById("bookMonthComments"),
  bookMonthOfficer: document.getElementById("bookMonthOfficer"), bookMonthSelect: document.getElementById("bookMonthSelect"), bookMonthLabel: document.getElementById("bookMonthLabel"),
  eventsList: document.getElementById("eventsList"), eventForm: document.getElementById("eventForm"), eventTitle: document.getElementById("eventTitle"), eventDate: document.getElementById("eventDate"), eventDetails: document.getElementById("eventDetails"),
  memoriesGallery: document.getElementById("memoriesGallery"), memoryForm: document.getElementById("memoryForm"), memoryImageUrl: document.getElementById("memoryImageUrl"), memoryTitle: document.getElementById("memoryTitle"), memoryCategory: document.getElementById("memoryCategory")
};

function escapeHtml(value) { const node = document.createElement("div"); node.textContent = String(value || ""); return node.innerHTML; }
function initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Just now" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function safeColor(value) { return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#e8623d"; }
function isOfficer() { return state.member?.role === "officer"; }
function isMember() { return Boolean(state.user && state.member && ["member", "officer"].includes(state.member.role)); }

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
  elements.memberGreeting.textContent = "Opening Google sign-in…";
  elements.memberSignIn.disabled = true;
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (error) {
    console.error("Sign-in failed:", error);
    elements.memberGreeting.textContent = error.code === "auth/popup-closed-by-user" ? "Sign-in was cancelled." : "Could not open Google sign-in. Please try again.";
  }
  finally { elements.memberSignIn.disabled = false; }
}
async function ensureMemberProfile(user) {
  const memberRef = doc(db, "members", user.uid);
  const privateRef = doc(db, "memberPrivate", user.uid);
  const existing = await getDoc(memberRef);
  const existingPrivate = await getDoc(privateRef);
  const profile = existing.exists() ? existing.data() : {};
  const normalisedProfile = {
    displayName: profile.displayName || user.displayName || "Club member",
    photoURL: profile.photoURL || user.photoURL || "",
    joinedAt: profile.joinedAt || new Date().toISOString(),
    role: profile.role || "member",
    bio: profile.bio || "",
    themeColor: profile.themeColor || ""
  };
  if (!existing.exists()) {
    const batch = writeBatch(db);
    batch.set(memberRef, normalisedProfile);
    batch.set(privateRef, { email: user.email || "" });
    await batch.commit();
  } else {
    // Older site versions created a profile without a role, bio, or theme color.
    // Rewrite only that old schema into the current safe member profile format.
    const profileFields = ["displayName", "photoURL", "joinedAt", "role", "bio", "themeColor"];
    const needsMigration = profileFields.some((field) => !(field in profile)) || Object.keys(profile).some((field) => !profileFields.includes(field));
    if (needsMigration) await setDoc(memberRef, normalisedProfile);
    if (!existingPrivate.exists()) await setDoc(privateRef, { email: user.email || "" });
  }
  return normalisedProfile;
}
function updateMemberUi() {
  const member = isMember();
  elements.memberGreeting.textContent = member ? `Hi, ${state.member.displayName}` : "Reading as a guest";
  elements.memberSignIn.hidden = member;
  elements.memberProfile.hidden = !member;
  elements.memberSignOut.hidden = !member;
  elements.officerPicker.hidden = !isOfficer();
  elements.bookMonthOfficer.hidden = true;
  elements.eventForm.hidden = !isOfficer();
  elements.memoryForm.hidden = !isOfficer();
  elements.announcementEditor.hidden = !isOfficer();
  elements.officerToolsButton.hidden = !isOfficer();
  if (isOfficer()) elements.announcementInput.value = state.announcement;
  elements.officerStatus.textContent = isOfficer() ? "Officer controls are ready." : "";
}
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.member = null;
  if (user) {
    try {
      elements.memberGreeting.textContent = "Setting up your member library…";
      state.member = await ensureMemberProfile(user);
      state.unsubscribeOwnMember?.();
      state.unsubscribeOwnMember = onSnapshot(doc(db, "members", user.uid), (snapshot) => {
        state.member = snapshot.exists() ? snapshot.data() : null;
        updateMemberUi(); subscribePendingBooks(); subscribeMemberManagement();
      });
    }
    catch (error) {
      console.error("Could not create member profile:", error);
      const notApproved = error.code === "permission-denied";
      elements.memberGreeting.textContent = notApproved ? "This Google account is not on the member list yet." : "Could not finish member sign-in.";
      showMessage(notApproved ? "Ask an officer to add your email under Officer tools → Manage members." : "Member sign-in needs attention. Please try again.", "error");
      await signOut(auth);
    }
  } else { state.unsubscribeOwnMember?.(); state.unsubscribeOwnMember = null; }
  updateMemberUi();
  subscribePendingBooks();
  subscribeMemberManagement();
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
function filteredBooks() {
  const search = state.bookSearch.trim().toLowerCase();
  return state.books.filter((book) => {
    const matchesSearch = !search || [book.title, book.author, book.genre, book.name, book.memberName]
      .some((value) => String(value || "").toLowerCase().includes(search));
    return matchesSearch && (!state.genreFilter || String(book.genre || "").toLowerCase() === state.genreFilter);
  });
}
function populateGenreFilter() {
  if (!elements.genreFilter) return;
  const genres = [...new Set(state.books.map((book) => String(book.genre || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const current = state.genreFilter;
  elements.genreFilter.innerHTML = '<option value="">All genres</option>' + genres.map((genre) => `<option value="${escapeHtml(genre.toLowerCase())}">${escapeHtml(genre)}</option>`).join("");
  elements.genreFilter.value = current;
}
function renderBooks() {
  const books = filteredBooks(); const shown = books.slice(0, state.visibleBooks);
  elements.bookshelf.innerHTML = shown.length ? shown.map((book) => `<article class="book-card" data-book-id="${book.id}" role="button" tabindex="0" aria-label="Open details for ${escapeHtml(book.title)}">${book.coverUrl ? `<img class="book-card-cover" src="${escapeHtml(book.coverUrl)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy">` : `<div class="book-card-cover-placeholder"><span>${escapeHtml(book.title)}</span></div>`}<div class="book-card-overlay"><span>${escapeHtml(book.title)}</span><small>Open book</small></div></article>`).join("") : `<div class="empty-shelf">${state.books.length ? "No books match that search." : "The shelf is waiting for its first books."}<span class="sub">${state.books.length ? "Try another title, author, or genre." : "Be the first to add one below!"}</span></div>`;
  elements.loadMoreBooks.hidden = state.visibleBooks >= books.length;
  populateGenreFilter();
  populateCurrentPickOptions();
  populateBookMonthOptions();
}
function populateBookMonthOptions() {
  if (!elements.bookMonthSelect) return;
  elements.bookMonthSelect.innerHTML = '<option value="">Choose a member recommendation…</option>' + state.books.map((book) => `<option value="${book.id}" ${book.id === state.bookMonth?.bookId ? "selected" : ""}>${escapeHtml(book.title)} — ${escapeHtml(book.author)}</option>`).join("");
}
function renderBookMonth() {
  const book = state.books.find((item) => item.id === state.bookMonth?.bookId);
  const ratings = state.bookMonthRatings; const totalMembers = Math.max(state.members.length, 1);
  const finished = ratings.filter((rating) => rating.finished).length;
  const average = ratings.length ? (ratings.reduce((sum, rating) => sum + Number(rating.stars || 0), 0) / ratings.length).toFixed(1) : null;
  elements.bookMonthAverage.textContent = average ? `${"★".repeat(Math.round(average))} ${average}/5` : "No ratings yet";
  elements.bookMonthProgress.textContent = `${Math.round((finished / totalMembers) * 100)}% finished`;
  elements.bookMonthFeature.innerHTML = book ? `<div class="book-month-cover">${book.coverUrl ? `<img src="${escapeHtml(book.coverUrl)}" alt="Cover of ${escapeHtml(book.title)}">` : `<span>${escapeHtml(book.title)}</span>`}</div><div><p class="section-kicker">${escapeHtml(state.bookMonth.label || "This month’s club read")}</p><h3>${escapeHtml(book.title)}</h3><p class="author">by ${escapeHtml(book.author)}</p><p>${escapeHtml(book.why || "Read along at your own pace, then leave a rating or discussion note.")}</p></div>` : '<div class="book-month-placeholder">The next club read is being chosen.</div>';
  elements.bookMonthPrompt.textContent = book ? `Finished readers: ${finished} of ${state.members.length || 0}. Add your own update whenever you are ready.` : "When the club chooses a book, you can share a star rating and a thought here.";
  elements.bookMonthRatingForm.hidden = !book;
  const ownRating = ratings.find((rating) => rating.memberId === state.user?.uid);
  if (ownRating) { elements.bookMonthStars.value = String(ownRating.stars || 5); elements.bookMonthFinished.checked = Boolean(ownRating.finished); elements.bookMonthComment.value = ownRating.comment || ""; }
  else { elements.bookMonthRatingForm.reset(); }
  elements.bookMonthComments.innerHTML = ratings.filter((rating) => rating.comment).length ? ratings.filter((rating) => rating.comment).map((rating) => `<article class="month-comment"><strong>${escapeHtml(rating.displayName || "Member")}</strong><span>${"★".repeat(Number(rating.stars || 0))}</span><p>${escapeHtml(rating.comment)}</p></article>`).join("") : '<p class="hint">No discussion notes yet. Be the first to leave one.</p>';
  populateBookMonthOptions();
}
function subscribeBookMonthRatings(bookId) {
  state.unsubscribeBookMonthRatings?.(); state.bookMonthRatings = []; renderBookMonth();
  if (!bookId) return;
  state.unsubscribeBookMonthRatings = onSnapshot(collection(db, "bookOfMonthRatings", bookId, "members"), (snapshot) => { state.bookMonthRatings = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderBookMonth(); }, (error) => { console.error("Book of the Month ratings error:", error); elements.bookMonthComments.innerHTML = '<p class="hint">Ratings are unavailable right now.</p>'; });
}
async function saveBookMonthRating(event) {
  event.preventDefault(); const bookId = state.bookMonth?.bookId;
  if (!bookId) return; if (!isMember()) { elements.bookMonthStatus.textContent = "Only invited club members can save a reading update."; return; }
  const button = elements.bookMonthRatingForm.querySelector("button"); button.disabled = true;
  try { await setDoc(doc(db, "bookOfMonthRatings", bookId, "members", state.user.uid), { memberId: state.user.uid, displayName: state.member.displayName, stars: Number(elements.bookMonthStars.value), finished: elements.bookMonthFinished.checked, comment: elements.bookMonthComment.value.trim(), updatedAt: new Date().toISOString() }); elements.bookMonthStatus.textContent = "Your reading update is saved."; }
  catch (error) { console.error(error); elements.bookMonthStatus.textContent = "Could not save your reading update."; }
  finally { button.disabled = false; }
}
async function saveBookMonth() {
  if (!isOfficer() || !elements.bookMonthSelect.value) return;
  try { await setDoc(doc(db, "siteSettings", "currentPick"), { bookId: elements.bookMonthSelect.value, label: elements.bookMonthLabel.value.trim(), updatedAt: new Date().toISOString() }); showMessage("Book of the Month updated."); }
  catch (error) { console.error(error); showMessage("Could not update Book of the Month.", "error"); }
}
function populateCurrentPickOptions() { elements.currentPickSelect.innerHTML = '<option value="">Choose a recommendation…</option>' + state.books.map((book) => `<option value="${book.id}" ${book.id === state.currentPickId ? "selected" : ""}>${escapeHtml(book.title)} — ${escapeHtml(book.author)}</option>`).join(""); renderCurrentPick(state.books.find((book) => book.id === state.currentPickId)); }
function renderCurrentPick(book) { const covered = Boolean(book?.coverUrl); elements.currentPickCover.hidden = !covered; elements.currentPickPlaceholder.hidden = covered; if (covered) elements.currentPickCover.src = book.coverUrl; elements.currentPickPlaceholder.querySelector("span").innerHTML = book ? escapeHtml(book.title).replace(/ /g, "<br>") : "Your First<br>Book Here"; elements.currentPickTitle.textContent = book?.title || "The Current Pick"; elements.currentPickAuthor.textContent = book ? `by ${book.author}` : "Choose a book from the shelf"; elements.currentPickDescription.textContent = book?.why || "When officers select a member recommendation, it will become the club’s Current Pick right here."; elements.currentPickMeta.textContent = book ? `Recommended by ${book.name}${book.genre ? ` · ${book.genre}` : ""}` : "Waiting for the next read"; }
function openBookDetail(book) { document.getElementById("bookDetailTitle").textContent = book.title; document.getElementById("bookDetailAuthor").textContent = `by ${book.author}`; document.getElementById("bookDetailWhy").textContent = book.why || "No note was added with this recommendation."; document.getElementById("bookDetailMeta").textContent = `${book.genre || "No genre"} · Recommended by ${book.memberName || book.name}`; document.getElementById("bookDetailComments").innerHTML = renderCommentList(book.comments || []); document.getElementById("bookDetailCommentForm").dataset.bookId = book.id; const profileButton = document.getElementById("bookDetailProfile"); profileButton.dataset.memberId = book.memberId || ""; profileButton.textContent = book.memberId ? `View ${book.memberName || book.name}'s shelf` : ""; profileButton.hidden = !book.memberId; const image = document.getElementById("bookDetailCover"); const placeholder = document.getElementById("bookDetailPlaceholder"); image.hidden = !book.coverUrl; placeholder.hidden = Boolean(book.coverUrl); placeholder.textContent = book.title; if (book.coverUrl) image.src = book.coverUrl; showModal(elements.bookDetailModal); }
const PROFILE_COLORS = ["#e8623d", "#c94a28", "#2a7f7a", "#1f5f5b", "#f4d35e", "#f2b6b0", "#a8cdd8", "#6b6154"];
function renderProfileSwatches(selected) { document.getElementById("profileSwatches").innerHTML = PROFILE_COLORS.map((color) => `<button type="button" class="color-swatch ${color.toLowerCase() === selected.toLowerCase() ? "selected" : ""}" data-color="${color}" style="--swatch:${color}" aria-label="Use ${color}"></button>`).join(""); }
async function openProfile(memberId) {
  if (!memberId) return;
  const snapshot = await getDoc(doc(db, "members", memberId));
  if (!snapshot.exists()) return showMessage("This member profile is not available yet.", "error");
  const member = snapshot.data(); const own = state.user?.uid === memberId;
  const accent = /^#[0-9a-f]{6}$/i.test(member.themeColor || "") ? member.themeColor : "#e8623d";
  const photo = document.getElementById("profilePhoto"), initial = document.getElementById("profileInitial"), bio = document.getElementById("profileBio");
  elements.profileModal.style.setProperty("--profile-accent", accent);
  photo.hidden = !member.photoURL; initial.hidden = Boolean(member.photoURL); if (member.photoURL) photo.src = member.photoURL;
  initial.textContent = initials(member.displayName); initial.style.background = accent; document.getElementById("profileName").textContent = member.displayName;
  bio.textContent = member.bio || ""; bio.hidden = !member.bio; document.getElementById("profileJoined").textContent = `Member since ${formatDate(member.joinedAt)}`;
  const edit = document.getElementById("profileEdit"); edit.hidden = !own; elements.personalShelfForm.hidden = !own;
  if (own) { document.getElementById("profileNameInput").value = member.displayName; document.getElementById("profileBioInput").value = member.bio || ""; document.getElementById("profileColorInput").value = accent; renderProfileSwatches(accent); }
  elements.profileModal.dataset.memberId = memberId; document.getElementById("profileShelfTitle").textContent = own ? "My shelf" : `${member.displayName}'s shelf`;
  subscribeProfileShelf(memberId); showModal(elements.profileModal);
}

function renderProfileShelf() {
  const entries = state.profileShelfEntries;
  document.getElementById("profileShelfCount").textContent = entries.length ? `${entries.length} book${entries.length === 1 ? "" : "s"}` : "";
  document.getElementById("profileBooks").innerHTML = entries.length ? entries.map((entry) => `
    <article class="personal-book">
      ${entry.coverUrl ? `<img src="${escapeHtml(entry.coverUrl)}" alt="Cover of ${escapeHtml(entry.title)}">` : `<div class="personal-book-placeholder">${escapeHtml(entry.title)}</div>`}
      <div><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.author)}</span><small>${escapeHtml(entry.status.replace(/-/g, " "))}</small>${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}</div>
      ${state.user?.uid === elements.profileModal.dataset.memberId ? `<button type="button" class="remove-shelf-book" data-action="remove-shelf-book" data-entry-id="${entry.id}" aria-label="Remove ${escapeHtml(entry.title)}">×</button>` : ""}
    </article>`).join("") : '<p class="hint">This shelf is waiting for its first book.</p>';
}

function subscribeProfileShelf(memberId) {
  state.unsubscribeProfileShelf?.();
  state.profileShelfEntries = [];
  renderProfileShelf();
  state.unsubscribeProfileShelf = onSnapshot(query(collection(db, "memberShelves", memberId, "entries"), orderBy("date", "desc")), (snapshot) => { state.profileShelfEntries = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderProfileShelf(); }, (error) => { console.error("Personal shelf error:", error); document.getElementById("profileBooks").innerHTML = '<p class="hint">This shelf is unavailable right now.</p>'; });
}

async function addPersonalShelfEntry(event) {
  event.preventDefault();
  if (!isMember() || state.user?.uid !== elements.profileModal.dataset.memberId) return;
  const form = event.target; const title = form.elements["shelf-title"].value.trim(); const author = form.elements["shelf-author"].value.trim();
  if (!title || !author) return;
  const button = form.querySelector("button"); button.disabled = true;
  try { await addDoc(collection(db, "memberShelves", state.user.uid, "entries"), { title, author, coverUrl: form.elements["shelf-cover"].value.trim(), status: form.elements["shelf-status"].value, note: form.elements["shelf-note"].value.trim(), date: new Date().toISOString() }); form.reset(); }
  catch (error) { console.error(error); showMessage("Could not add that book to your shelf.", "error"); }
  finally { button.disabled = false; }
}

// Personal shelves deliberately use the same small form for adding and editing.
// Keeping one path means books retain the same validation and Firestore shape.
function renderProfileShelf() {
  const entries = state.profileShelfEntries;
  const own = state.user?.uid === elements.profileModal.dataset.memberId;
  const reading = entries.filter((entry) => entry.status === "reading").length;
  const finished = entries.filter((entry) => entry.status === "read").length;
  document.getElementById("profileShelfCount").textContent = entries.length ? `${entries.length} book${entries.length === 1 ? "" : "s"}` : "New shelf";
  elements.profileStats.innerHTML = `<span><strong>${entries.length}</strong> on shelf</span><span><strong>${reading}</strong> reading</span><span><strong>${finished}</strong> finished</span>`;
  document.getElementById("profileBooks").innerHTML = entries.length ? entries.map((entry) => `
    <article class="personal-book">
      ${entry.coverUrl ? `<img src="${escapeHtml(entry.coverUrl)}" alt="Cover of ${escapeHtml(entry.title)}">` : `<div class="personal-book-placeholder">${escapeHtml(entry.title)}</div>`}
      <div><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.author)}</span><small>${escapeHtml(entry.status.replace(/-/g, " "))}</small>${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}</div>
      ${own ? `<div class="shelf-book-actions"><button type="button" class="edit-shelf-book" data-action="edit-shelf-book" data-entry-id="${entry.id}">Edit</button><button type="button" class="remove-shelf-book" data-action="remove-shelf-book" data-entry-id="${entry.id}" aria-label="Remove ${escapeHtml(entry.title)}">×</button></div>` : ""}
    </article>`).join("") : '<p class="hint shelf-empty">This shelf is waiting for its first book.</p>';
}
function editPersonalShelfEntry(entryId) {
  if (state.user?.uid !== elements.profileModal.dataset.memberId) return;
  const entry = state.profileShelfEntries.find((item) => item.id === entryId); if (!entry) return;
  const form = elements.personalShelfForm;
  form.elements["shelf-title"].value = entry.title || "";
  form.elements["shelf-author"].value = entry.author || "";
  form.elements["shelf-cover"].value = entry.coverUrl || "";
  form.elements["shelf-status"].value = entry.status || "reading";
  form.elements["shelf-note"].value = entry.note || "";
  form.dataset.entryId = entryId;
  form.querySelector("h4").textContent = "Edit shelf book";
  form.querySelector("button[type=submit]").textContent = "Save changes";
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
async function addPersonalShelfEntry(event) {
  event.preventDefault();
  if (!isMember() || state.user?.uid !== elements.profileModal.dataset.memberId) return;
  const form = event.target; const title = form.elements["shelf-title"].value.trim(); const author = form.elements["shelf-author"].value.trim();
  if (!title || !author) return;
  const button = form.querySelector("button[type=submit]"); button.disabled = true;
  const entry = { title, author, coverUrl: form.elements["shelf-cover"].value.trim(), status: form.elements["shelf-status"].value, note: form.elements["shelf-note"].value.trim(), date: new Date().toISOString() };
  try {
    if (form.dataset.entryId) await updateDoc(doc(db, "memberShelves", state.user.uid, "entries", form.dataset.entryId), entry);
    else await addDoc(collection(db, "memberShelves", state.user.uid, "entries"), entry);
    form.reset(); delete form.dataset.entryId;
    form.querySelector("h4").textContent = "Add to my shelf";
    button.textContent = "Add to my shelf";
  } catch (error) { console.error(error); showMessage("Could not save that shelf book.", "error"); }
  finally { button.disabled = false; }
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

function subscribeMemberManagement() {
  state.unsubscribeMemberManagement?.();
  state.invitedEmails = []; state.memberPrivate = [];
  renderMemberManagement();
  if (!isOfficer()) return;
  const unsubscribers = [
    onSnapshot(collection(db, "allowedEmails"), (snapshot) => { state.invitedEmails = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderMemberManagement(); }),
    onSnapshot(collection(db, "memberPrivate"), (snapshot) => { state.memberPrivate = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderMemberManagement(); })
  ];
  state.unsubscribeMemberManagement = () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

function renderMemberManagement() {
  const joinedEmails = new Set(state.memberPrivate.map((member) => String(member.email || "").toLowerCase()));
  const pendingInvites = state.invitedEmails.filter((invite) => !joinedEmails.has(String(invite.id).toLowerCase()));
  elements.invitedList.innerHTML = pendingInvites.length ? pendingInvites.map((invite) => `<div class="member-row"><span>${escapeHtml(invite.id)}</span></div>`).join("") : '<p class="hint">No waiting invitations.</p>';
  elements.memberList.innerHTML = state.members.length ? state.members.map((member) => `<div class="member-row"><span><strong>${escapeHtml(member.displayName)}</strong><small>${escapeHtml(member.role)}</small></span><button type="button" data-action="toggle-role" data-uid="${member.id}">${member.role === "officer" ? "Make member" : "Make officer"}</button></div>`).join("") : '<p class="hint">No members have joined yet.</p>';
}

function renderMemberDirectory() {
  elements.memberDirectory.innerHTML = state.members.length ? state.members.map((member) => `
    <button type="button" class="member-card" data-profile-id="${member.id}" style="--member-accent:${safeColor(member.themeColor)}">
      ${member.photoURL ? `<img src="${escapeHtml(member.photoURL)}" alt="${escapeHtml(member.displayName)}">` : `<span class="member-card-initial">${escapeHtml(initials(member.displayName))}</span>`}
      <span class="member-card-name">${escapeHtml(member.displayName)}</span>
      <small>${member.role === "officer" ? "Officer" : "Member"}</small>
    </button>`).join("") : '<div class="no-comments">Member profiles will appear here soon.</div>';
}

function renderMemberManagement() {
  const joinedEmails = new Set(state.memberPrivate.map((member) => String(member.email || "").toLowerCase()));
  const pendingInvites = state.invitedEmails.filter((invite) => !joinedEmails.has(String(invite.id).toLowerCase()));
  elements.invitedList.innerHTML = pendingInvites.length ? pendingInvites.map((invite) => `<div class="member-row"><span>${escapeHtml(invite.id)}</span><button type="button" class="text-link-btn" data-action="revoke-invite" data-email="${escapeHtml(invite.id)}">Remove</button></div>`).join("") : '<p class="hint">No waiting invitations.</p>';
  elements.memberList.innerHTML = state.members.length ? state.members.map((member) => `<div class="member-row"><span><strong>${escapeHtml(member.displayName)}</strong><small>${escapeHtml(member.role || "member")}</small></span><button type="button" data-action="toggle-role" data-uid="${member.id}">${member.role === "officer" ? "Make member" : "Make officer"}</button></div>`).join("") : '<p class="hint">No members have joined yet.</p>';
}

async function addInvite(event) {
  event.preventDefault();
  if (!isOfficer()) return;
  const email = elements.inviteEmail.value.trim().toLowerCase();
  if (!email) return;
  try {
    await setDoc(doc(db, "allowedEmails", email), { email, invitedAt: new Date().toISOString() });
    elements.inviteEmail.value = "";
    elements.inviteStatus.textContent = "Invitation added.";
  } catch (error) { console.error(error); elements.inviteStatus.textContent = "Could not add that invitation."; }
}
async function revokeInvite(email) {
  if (!isOfficer() || !email) return;
  try { await deleteDoc(doc(db, "allowedEmails", email)); elements.inviteStatus.textContent = "Unused invitation removed."; }
  catch (error) { console.error(error); elements.inviteStatus.textContent = "Could not remove that invitation."; }
}

async function toggleMemberRole(uid) {
  if (!isOfficer()) return;
  const member = state.members.find((entry) => entry.id === uid);
  if (!member) return;
  try { await updateDoc(doc(db, "members", uid), { role: member.role === "officer" ? "member" : "officer" }); }
  catch (error) { console.error(error); showMessage("Could not update that role.", "error"); }
}
async function reviewPending(id, approved) { if (!isOfficer()) return; const pending = state.pendingBooks.find((book) => book.id === id); if (!pending) return; try { if (approved) { const { id: ignored, submittedAt, status, ...book } = pending; await addDoc(booksCollection, { ...book, approvedAt: new Date().toISOString() }); } await deleteDoc(doc(db, "pendingBooks", id)); } catch (error) { console.error(error); showMessage("Could not update this suggestion.", "error"); } }

// ====== ANNOUNCEMENTS AND PIN BOARD ======
async function saveAnnouncement() { if (!isOfficer()) return; const text = elements.announcementInput.value.trim(); try { await setDoc(doc(db, "siteSettings", "announcement"), { text, updatedAt: new Date().toISOString() }); } catch (error) { console.error(error); showMessage("Could not save the announcement.", "error"); } }
function renderBoard(posts) { elements.pinBoard.innerHTML = posts.length ? posts.map((post) => `<article class="pin-note"><div class="pin-avatar">${escapeHtml(initials(post.displayName))}</div><p>${escapeHtml(post.text)}</p><span>${escapeHtml(post.displayName)} · ${formatDate(post.date)}</span></article>`).join("") : '<div class="no-comments">No pins yet. Leave the first note!</div>'; }
async function postBoard(event) { event.preventDefault(); const text = elements.boardText.value.trim(); if (!isMember()) { elements.boardStatus.textContent = "Sign in as a member to pin a note."; return; } if (!text) return; const button = elements.boardForm.querySelector("button"); button.disabled = true; try { await addDoc(collection(db, "boardPosts"), { text, memberId: state.user.uid, displayName: state.member.displayName, photoURL: state.member.photoURL || "", date: new Date().toISOString() }); elements.boardText.value = ""; elements.boardStatus.textContent = "Pinned!"; } catch (error) { console.error(error); elements.boardStatus.textContent = "Could not pin that note."; } finally { button.disabled = false; } }

function renderBoard(posts) {
  elements.pinBoard.innerHTML = posts.length ? posts.map((post) => `<article class="pin-note"><div class="pin-avatar">${escapeHtml(initials(post.displayName))}</div><p>${escapeHtml(post.text)}</p><span>${escapeHtml(post.displayName)} · ${formatDate(post.date)}</span>${isOfficer() ? `<button type="button" class="remove-pin" data-action="remove-pin" data-id="${post.id}" aria-label="Remove this pin">×</button>` : ""}</article>`).join("") : '<div class="no-comments">No pins yet. Leave the first note!</div>';
}
async function removePin(id) {
  if (!isOfficer() || !id) return;
  try { await deleteDoc(doc(db, "boardPosts", id)); }
  catch (error) { console.error(error); showMessage("Could not remove that pin.", "error"); }
}
function formatEventDate(value) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.valueOf()) ? "Date to be announced" : date.toLocaleDateString(undefined, { month: "long", day: "numeric" }); }
function renderEvents() {
  elements.eventsList.innerHTML = state.events.length ? state.events.map((event) => `<article class="event-item"><time datetime="${escapeHtml(event.date)}">${escapeHtml(formatEventDate(event.date))}</time><div><h3>${escapeHtml(event.title)}</h3>${event.details ? `<p>${escapeHtml(event.details)}</p>` : ""}</div>${isOfficer() ? `<button type="button" class="text-link-btn" data-action="remove-event" data-id="${event.id}">Remove</button>` : ""}</article>`).join("") : '<p class="hint">No events have been added yet. Check back soon.</p>';
}
async function addEvent(event) {
  event.preventDefault(); if (!isOfficer()) return;
  const title = elements.eventTitle.value.trim(), date = elements.eventDate.value, details = elements.eventDetails.value.trim(); if (!title || !date) return;
  try { await addDoc(collection(db, "events"), { title, date, details, createdAt: new Date().toISOString() }); elements.eventForm.reset(); showMessage("Event added."); }
  catch (error) { console.error(error); showMessage("Could not add that event.", "error"); }
}
async function removeEvent(id) { if (!isOfficer() || !id) return; try { await deleteDoc(doc(db, "events", id)); } catch (error) { console.error(error); showMessage("Could not remove that event.", "error"); } }
function renderMemories() {
  elements.memoriesGallery.innerHTML = state.memories.length ? state.memories.map((memory) => `<article class="memory-card"><img src="${escapeHtml(memory.imageUrl)}" alt="${escapeHtml(memory.title)}" loading="lazy"><div><span>${escapeHtml(memory.category || "Club memory")}</span><h3>${escapeHtml(memory.title)}</h3></div>${isOfficer() ? `<button type="button" class="remove-memory" data-action="remove-memory" data-id="${memory.id}" aria-label="Remove ${escapeHtml(memory.title)}">×</button>` : ""}</article>`).join("") : '<p class="hint">The club’s first reading memory will appear here soon.</p>';
}
async function addMemory(event) {
  event.preventDefault(); if (!isOfficer()) return;
  const imageUrl = elements.memoryImageUrl.value.trim(), title = elements.memoryTitle.value.trim(), category = elements.memoryCategory.value.trim(); if (!imageUrl || !title) return;
  try { await addDoc(collection(db, "memories"), { imageUrl, title, category, date: new Date().toISOString() }); elements.memoryForm.reset(); showMessage("Reading memory added."); }
  catch (error) { console.error(error); showMessage("Could not add that memory.", "error"); }
}
async function removeMemory(id) { if (!isOfficer() || !id) return; try { await deleteDoc(doc(db, "memories", id)); } catch (error) { console.error(error); showMessage("Could not remove that memory.", "error"); } }

// ====== REALTIME LISTENERS ======
onSnapshot(collection(db, "members"), (snapshot) => { state.members = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderMemberDirectory(); renderMemberManagement(); renderBookMonth(); }, (error) => { console.error("Member directory error:", error); elements.memberDirectory.innerHTML = '<div class="no-comments">Member profiles are unavailable right now.</div>'; });
onSnapshot(query(booksCollection, orderBy("date", "desc")), (snapshot) => { state.books = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderBooks(); }, (error) => { console.error(error); elements.bookshelf.innerHTML = '<div class="empty-shelf">Couldn’t load the shelf right now.</div>'; });
onSnapshot(doc(db, "siteSettings", "currentPick"), (snapshot) => { state.currentPickId = snapshot.data()?.bookId || null; renderCurrentPick(state.books.find((book) => book.id === state.currentPickId)); });
onSnapshot(doc(db, "siteSettings", "currentPick"), (snapshot) => { state.bookMonth = snapshot.exists() ? snapshot.data() : null; elements.bookMonthLabel.value = state.bookMonth?.label || ""; subscribeBookMonthRatings(state.bookMonth?.bookId); renderBookMonth(); }, (error) => { console.error("Book of the Month error:", error); elements.bookMonthFeature.innerHTML = '<p class="hint">Book of the Month is unavailable right now.</p>'; });
onSnapshot(doc(db, "siteSettings", "announcement"), (snapshot) => { state.announcement = snapshot.data()?.text || ""; elements.announcementText.textContent = state.announcement || "No announcements yet—check back soon."; if (isOfficer()) elements.announcementInput.value = state.announcement; });
onSnapshot(query(collection(db, "boardPosts"), orderBy("date", "desc")), (snapshot) => renderBoard(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (error) => { console.error(error); elements.pinBoard.innerHTML = '<div class="no-comments">The pin board is taking a small break.</div>'; });
onSnapshot(query(collection(db, "events"), orderBy("date", "asc")), (snapshot) => { state.events = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderEvents(); }, (error) => { console.error("Events error:", error); elements.eventsList.innerHTML = '<p class="hint">Events are unavailable right now.</p>'; });
onSnapshot(query(collection(db, "memories"), orderBy("date", "desc")), (snapshot) => { state.memories = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderMemories(); }, (error) => { console.error("Memories error:", error); elements.memoriesGallery.innerHTML = '<p class="hint">Reading memories are unavailable right now.</p>'; });

// ====== EVENTS ======
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]"); const action = target?.dataset.action;
  if (action === "browse-members") document.getElementById("memberDirectorySection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (action === "member-sign-in") signInMember(); if (action === "sign-out") signOut(auth);
  if (action === "show-setup") showSetup(); if (action === "close-setup") closeSetup(); if (action === "save-cloudinary") saveUploadProvider("cloudinary"); if (action === "save-imgbb") saveUploadProvider("imgbb");
  if (action === "open-suggestion") showModal(elements.suggestionModal); if (action === "close-suggestion") closeModal(elements.suggestionModal);
  if (action === "close-book-detail") closeModal(elements.bookDetailModal); if (action === "close-profile") { closeModal(elements.profileModal); state.unsubscribeProfileShelf?.(); state.unsubscribeProfileShelf = null; } if (action === "close-review") closeModal(elements.reviewModal);
  if (action === "save-current-pick") { if (isOfficer() && elements.currentPickSelect.value) setDoc(doc(db, "siteSettings", "currentPick"), { bookId: elements.currentPickSelect.value, updatedAt: new Date().toISOString() }, { merge: true }); }
  if (action === "save-book-month") saveBookMonth();
  if (action === "save-announcement") saveAnnouncement(); if (action === "open-review" && isOfficer()) showModal(elements.reviewModal);
  if (action === "open-officer-tools" && isOfficer()) showModal(elements.officerSidebar); if (action === "close-officer-tools") closeModal(elements.officerSidebar);
  if (action === "approve-pending") reviewPending(target.dataset.id, true); if (action === "reject-pending") reviewPending(target.dataset.id, false);
  if (action === "revoke-invite") revokeInvite(target.dataset.email); if (action === "remove-pin") removePin(target.dataset.id);
  if (action === "remove-event") removeEvent(target.dataset.id); if (action === "remove-memory") removeMemory(target.dataset.id);
  if (action === "toggle-role") toggleMemberRole(target.dataset.uid);
  if (action === "edit-shelf-book") editPersonalShelfEntry(target.dataset.entryId);
  if (action === "remove-shelf-book" && state.user?.uid === elements.profileModal.dataset.memberId) deleteDoc(doc(db, "memberShelves", state.user.uid, "entries", target.dataset.entryId));
  if (action === "show-profile") openProfile(state.user?.uid); const detailProfile = event.target.closest("#bookDetailProfile"); if (detailProfile) openProfile(detailProfile.dataset.memberId);
  if (action === "save-profile") { const name = document.getElementById("profileNameInput").value.trim(); const bio = document.getElementById("profileBioInput").value.trim(); const themeColor = document.getElementById("profileColorInput").value; if (name && state.user) setDoc(doc(db, "members", state.user.uid), { displayName: name, bio, themeColor }, { merge: true }).then(() => { Object.assign(state.member, { displayName: name, bio, themeColor }); updateMemberUi(); }); }
  const tab = event.target.closest(".provider-tab"); if (tab) switchProviderTab(tab.dataset.provider);
  const swatch = event.target.closest(".color-swatch"); if (swatch) { document.getElementById("profileColorInput").value = swatch.dataset.color; renderProfileSwatches(swatch.dataset.color); }
  const profileBook = event.target.closest(".profile-book"); if (profileBook) { const book = state.books.find((item) => item.id === profileBook.dataset.bookId); if (book) { closeModal(elements.profileModal); openBookDetail(book); } }
  const memberCard = event.target.closest(".member-card"); if (memberCard) openProfile(memberCard.dataset.profileId);
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
elements.inviteForm.addEventListener("submit", addInvite);
elements.personalShelfForm.addEventListener("submit", addPersonalShelfEntry);
elements.bookMonthRatingForm.addEventListener("submit", saveBookMonthRating);
elements.eventForm.addEventListener("submit", addEvent);
elements.memoryForm.addEventListener("submit", addMemory);
elements.loadMoreBooks.addEventListener("click", () => { state.visibleBooks += BOOKS_PER_PAGE; renderBooks(); });
elements.bookSearch?.addEventListener("input", (event) => { state.bookSearch = event.target.value; state.visibleBooks = BOOKS_PER_PAGE; renderBooks(); });
elements.genreFilter?.addEventListener("change", (event) => { state.genreFilter = event.target.value; state.visibleBooks = BOOKS_PER_PAGE; renderBooks(); });
elements.profileModal.addEventListener("error", (event) => { if (event.target.matches(".personal-book img")) { const placeholder = document.createElement("div"); placeholder.className = "personal-book-placeholder"; placeholder.textContent = event.target.alt.replace(/^Cover of /, ""); event.target.replaceWith(placeholder); } if (event.target.id === "profilePhoto") { event.target.hidden = true; document.getElementById("profileInitial").hidden = false; } }, true);
document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; [elements.setupModal, elements.suggestionModal, elements.bookDetailModal, elements.profileModal, elements.reviewModal, elements.officerSidebar].filter((modal) => !modal.hidden).forEach(closeModal); });
document.getElementById("profileColorInput").addEventListener("input", (event) => renderProfileSwatches(event.target.value));
if (!state.uploadProvider && localStorage.getItem("setupDismissed") !== "true") setTimeout(showSetup, 600);

try {
  document.body.classList.add("js-ready");
  if (!("IntersectionObserver" in window)) throw new Error("IntersectionObserver unavailable");
  const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("in-view"); revealObserver.unobserve(entry.target); } }), { threshold: .15, rootMargin: "0px 0px -60px 0px" });
  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
} catch (error) {
  console.warn("Entrance animation disabled:", error);
  document.body.classList.remove("js-ready");
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("in-view"));
}
