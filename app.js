import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc,
  updateDoc, setDoc, getDoc, deleteDoc, writeBatch, arrayUnion
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const BOOKS_PER_PAGE = 12;
const limits = { name: 60, title: 160, author: 100, genre: 80, why: 800, comment: 500, board: 280 };

const state = {
  uploadProvider: localStorage.getItem("uploadProvider") || "",
  cloudName: localStorage.getItem("cloudName") || "",
  imgbbKey: localStorage.getItem("imgbbKey") || "",
  uploadedImageUrl: null,
  isUploading: false,
  shelfUploadedImageUrl: null,
  shelfIsUploading: false,
  books: [],
  visibleBooks: BOOKS_PER_PAGE,
  user: null,
  member: null,
  currentPickId: null,
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
  officerToolsButton: document.getElementById("officerToolsButton"), officerSidebar: document.getElementById("officerSidebar"),
  inviteForm: document.getElementById("inviteForm"), inviteEmail: document.getElementById("inviteEmail"), inviteStatus: document.getElementById("inviteStatus"),
  invitedList: document.getElementById("invitedList"), memberList: document.getElementById("memberList"),
  pendingList: document.getElementById("pendingList"), memberDirectory: document.getElementById("memberDirectory"),
  personalShelfForm: document.getElementById("personalShelfForm"),
  shelfUploadArea: document.getElementById("shelfUploadArea"), shelfCoverUpload: document.getElementById("shelfCoverUpload"),
  shelfUploadPreview: document.getElementById("shelfUploadPreview"), shelfUploadStatus: document.getElementById("shelfUploadStatus")
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
function setShelfUploadStatus(message, type = "") { elements.shelfUploadStatus.textContent = message; elements.shelfUploadStatus.className = `upload-status ${type}`.trim(); }
function showModal(modal) { modal.hidden = false; requestAnimationFrame(() => modal.classList.add("active")); modal.querySelector("button")?.focus(); }
function closeModal(modal) { modal.classList.remove("active"); setTimeout(() => { modal.hidden = true; }, 180); }

// ====== MEMBER ACCOUNTS ======
async function signInMember() {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (error) { console.error("Sign-in failed:", error); elements.memberGreeting.textContent = "Sign-in was cancelled or unavailable."; }
}
async function ensureMemberProfile(user) {
  const memberRef = doc(db, "members", user.uid);
  const privateRef = doc(db, "memberPrivate", user.uid);
  const existing = await getDoc(memberRef);
  const existingPrivate = await getDoc(privateRef);
  const profile = existing.exists() ? existing.data() : {};
  if (!existing.exists()) {
    const batch = writeBatch(db);
    batch.set(memberRef, { displayName: user.displayName || "Club member", photoURL: user.photoURL || "", joinedAt: new Date().toISOString(), role: "member", bio: "", themeColor: "" });
    batch.set(privateRef, { email: user.email || "" });
    await batch.commit();
  } else if (!existingPrivate.exists()) {
    await setDoc(privateRef, { email: user.email || "" });
  }
  return { ...profile, displayName: profile.displayName || user.displayName || "Club member", photoURL: profile.photoURL || user.photoURL || "", joinedAt: profile.joinedAt || new Date().toISOString(), role: profile.role || "member", bio: profile.bio || "", themeColor: profile.themeColor || "" };
}
function updateMemberUi() {
  const member = isMember();
  elements.memberGreeting.textContent = member ? `Hi, ${state.member.displayName}` : "Reading as a guest";
  elements.memberSignIn.hidden = member;
  elements.memberProfile.hidden = !member;
  elements.memberSignOut.hidden = !member;
  elements.officerPicker.hidden = !isOfficer();
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
      state.member = await ensureMemberProfile(user);
      state.unsubscribeOwnMember?.();
      state.unsubscribeOwnMember = onSnapshot(doc(db, "members", user.uid), (snapshot) => {
        state.member = snapshot.exists() ? snapshot.data() : null;
        updateMemberUi(); subscribePendingBooks(); subscribeMemberManagement();
      });
    }
    catch (error) { console.error("Could not create member profile:", error); }
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
async function handleFile(file, target = "suggestion") {
  const isShelf = target === "shelf";
  const busy = isShelf ? state.shelfIsUploading : state.isUploading;
  const input = isShelf ? elements.shelfCoverUpload : elements.coverUpload;
  const preview = isShelf ? elements.shelfUploadPreview : elements.uploadPreview;
  const setStatus = isShelf ? setShelfUploadStatus : setUploadStatus;
  if (busy) return;
  if (!file.type.startsWith("image/")) return setStatus("Please upload an image file.", "error");
  if (file.size > MAX_IMAGE_BYTES) return setStatus("Please choose an image smaller than 8 MB.", "error");
  if (!configuredUploadProvider()) { setStatus("Set up cover uploads first.", "error"); showSetup(); return; }
  if (isShelf) { state.shelfIsUploading = true; } else { state.isUploading = true; }
  input.disabled = true;
  const reader = new FileReader(); reader.onload = (event) => { preview.src = event.target.result; preview.classList.add("visible"); }; reader.readAsDataURL(file);
  setStatus("Uploading…", "uploading");
  try {
    const url = state.uploadProvider === "imgbb" ? await uploadToImgbb(file) : await uploadToCloudinary(file);
    if (isShelf) state.shelfUploadedImageUrl = url; else state.uploadedImageUrl = url;
    setStatus("Uploaded", "success");
  } catch (error) { console.error(error); setStatus(`Upload failed: ${error.message}`, "error"); }
  finally { if (isShelf) state.shelfIsUploading = false; else state.isUploading = false; input.disabled = false; }
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
  elements.personalShelfForm.reset(); elements.shelfUploadPreview.classList.remove("visible"); elements.shelfUploadPreview.src = ""; elements.shelfCoverUpload.value = ""; state.shelfUploadedImageUrl = null; setShelfUploadStatus("");
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
  try {
    await addDoc(collection(db, "memberShelves", state.user.uid, "entries"), { title, author, coverUrl: state.shelfUploadedImageUrl || "", status: form.elements["shelf-status"].value, note: form.elements["shelf-note"].value.trim(), date: new Date().toISOString() });
    form.reset();
    elements.shelfUploadPreview.classList.remove("visible"); elements.shelfUploadPreview.src = ""; elements.shelfCoverUpload.value = ""; state.shelfUploadedImageUrl = null; setShelfUploadStatus("");
  }
  catch (error) { console.error(error); showMessage("Could not add that book to your shelf.", "error"); }
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
  state.members = []; state.invitedEmails = []; state.memberPrivate = [];
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

// ====== REALTIME LISTENERS ======
onSnapshot(collection(db, "members"), (snapshot) => { state.members = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderMemberDirectory(); renderMemberManagement(); }, (error) => { console.error("Member directory error:", error); elements.memberDirectory.innerHTML = '<div class="no-comments">Member profiles are unavailable right now.</div>'; });
onSnapshot(query(booksCollection, orderBy("date", "desc")), (snapshot) => { state.books = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderBooks(); }, (error) => { console.error(error); elements.bookshelf.innerHTML = '<div class="empty-shelf">Couldn’t load the shelf right now.</div>'; });
onSnapshot(doc(db, "siteSettings", "currentPick"), (snapshot) => { state.currentPickId = snapshot.data()?.bookId || null; renderCurrentPick(state.books.find((book) => book.id === state.currentPickId)); });
onSnapshot(doc(db, "siteSettings", "announcement"), (snapshot) => { state.announcement = snapshot.data()?.text || ""; elements.announcementText.textContent = state.announcement || "No announcements yet—check back soon."; if (isOfficer()) elements.announcementInput.value = state.announcement; });
onSnapshot(query(collection(db, "boardPosts"), orderBy("date", "desc")), (snapshot) => renderBoard(snapshot.docs.map((item) => item.data())), (error) => { console.error(error); elements.pinBoard.innerHTML = '<div class="no-comments">The pin board is taking a small break.</div>'; });

// ====== EVENTS ======
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]"); const action = target?.dataset.action;
  if (action === "browse-members") document.getElementById("memberDirectorySection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (action === "member-sign-in") signInMember(); if (action === "sign-out") signOut(auth);
  if (action === "show-setup") showSetup(); if (action === "close-setup") closeSetup(); if (action === "save-cloudinary") saveUploadProvider("cloudinary"); if (action === "save-imgbb") saveUploadProvider("imgbb");
  if (action === "open-suggestion") showModal(elements.suggestionModal); if (action === "close-suggestion") closeModal(elements.suggestionModal);
  if (action === "close-book-detail") closeModal(elements.bookDetailModal); if (action === "close-profile") { closeModal(elements.profileModal); state.unsubscribeProfileShelf?.(); state.unsubscribeProfileShelf = null; } if (action === "close-review") closeModal(elements.reviewModal);
  if (action === "save-current-pick") { if (isOfficer() && elements.currentPickSelect.value) setDoc(doc(db, "siteSettings", "currentPick"), { bookId: elements.currentPickSelect.value, updatedAt: new Date().toISOString() }); }
  if (action === "save-announcement") saveAnnouncement(); if (action === "open-review" && isOfficer()) showModal(elements.reviewModal);
  if (action === "open-officer-tools" && isOfficer()) showModal(elements.officerSidebar); if (action === "close-officer-tools") closeModal(elements.officerSidebar);
  if (action === "approve-pending") reviewPending(target.dataset.id, true); if (action === "reject-pending") reviewPending(target.dataset.id, false);
  if (action === "toggle-role") toggleMemberRole(target.dataset.uid);
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
elements.shelfUploadArea.addEventListener("dragover", (event) => { event.preventDefault(); elements.shelfUploadArea.classList.add("dragover"); });
elements.shelfUploadArea.addEventListener("dragleave", () => elements.shelfUploadArea.classList.remove("dragover"));
elements.shelfUploadArea.addEventListener("drop", (event) => { event.preventDefault(); elements.shelfUploadArea.classList.remove("dragover"); if (event.dataTransfer.files.length) handleFile(event.dataTransfer.files[0], "shelf"); });
elements.shelfCoverUpload.addEventListener("change", (event) => { if (event.target.files.length) handleFile(event.target.files[0], "shelf"); });
elements.form.addEventListener("submit", submitSuggestion); elements.boardForm.addEventListener("submit", postBoard);
elements.inviteForm.addEventListener("submit", addInvite);
elements.personalShelfForm.addEventListener("submit", addPersonalShelfEntry);
elements.loadMoreBooks.addEventListener("click", () => { state.visibleBooks += BOOKS_PER_PAGE; renderBooks(); });
document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; [elements.setupModal, elements.suggestionModal, elements.bookDetailModal, elements.profileModal, elements.reviewModal, elements.officerSidebar].filter((modal) => !modal.hidden).forEach(closeModal); });
document.getElementById("profileColorInput").addEventListener("input", (event) => renderProfileSwatches(event.target.value));
if (!state.uploadProvider && localStorage.getItem("setupDismissed") !== "true") setTimeout(showSetup, 600);

const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("in-view"); revealObserver.unobserve(entry.target); } }), { threshold: .15, rootMargin: "0px 0px -60px 0px" });
document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
