import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  query, orderBy, doc, updateDoc, setDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

// Book Enthusiasts Club — GitHub Pages client application
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
const limits = { name: 60, title: 160, author: 100, genre: 80, why: 800, comment: 500 };

// Add the Google email addresses of club officers before publishing.
// Example: ["officer@example.edu", "librarian@example.edu"]
const ADMIN_EMAILS = ["rizalded60@gmail.com"];

const state = {
  uploadProvider: localStorage.getItem("uploadProvider") || "",
  cloudName: localStorage.getItem("cloudName") || "",
  imgbbKey: localStorage.getItem("imgbbKey") || "",
  uploadedImageUrl: null,
  books: [],
  isUploading: false,
  currentPickId: null,
  user: null
};

const elements = {
  bookshelf: document.getElementById("bookshelf"),
  form: document.getElementById("recForm"),
  successMessage: document.getElementById("successMsg"),
  uploadArea: document.getElementById("uploadArea"),
  coverUpload: document.getElementById("coverUpload"),
  uploadPreview: document.getElementById("uploadPreview"),
  uploadStatus: document.getElementById("uploadStatus"),
  setupModal: document.getElementById("setupModal"),
  currentPickCover: document.getElementById("currentPickCover"),
  currentPickPlaceholder: document.getElementById("currentPickPlaceholder"),
  currentPickTitle: document.getElementById("currentPickTitle"),
  currentPickAuthor: document.getElementById("currentPickAuthor"),
  currentPickDescription: document.getElementById("currentPickDescription"),
  currentPickMeta: document.getElementById("currentPickMeta"),
  currentPickSelect: document.getElementById("currentPickSelect"),
  officerPicker: document.getElementById("officerPicker"),
  officerSignIn: document.getElementById("officerSignIn"),
  officerStatus: document.getElementById("officerStatus"),
  bookDetailModal: document.getElementById("bookDetailModal")
};

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = String(value || "");
  return node.innerHTML;
}

function showMessage(message, type = "success") {
  elements.successMessage.textContent = message;
  elements.successMessage.classList.toggle("error", type === "error");
  elements.successMessage.classList.add("visible");
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => elements.successMessage.classList.remove("visible"), 4500);
}

function setUploadStatus(message, type = "") {
  elements.uploadStatus.textContent = message;
  elements.uploadStatus.className = `upload-status ${type}`.trim();
}

// ====== SETUP MODAL ======
function showSetup() {
  elements.setupModal.classList.add("active");
  document.getElementById("cloudNameInput").value = state.cloudName;
  document.getElementById("imgbbKeyInput").value = state.imgbbKey;
  switchProviderTab(state.uploadProvider === "imgbb" ? "imgbb" : "cloudinary");
}

function closeSetup() {
  elements.setupModal.classList.remove("active");
  localStorage.setItem("setupDismissed", "true");
}

function switchProviderTab(provider) {
  document.querySelectorAll(".provider-tab").forEach((tab) =>
    tab.classList.toggle("active", tab.dataset.provider === provider)
  );
  document.querySelectorAll(".provider-panel").forEach((panel) =>
    panel.classList.toggle("active", panel.id === `panel-${provider}`)
  );
}

function saveUploadProvider(provider) {
  const fieldId = provider === "cloudinary" ? "cloudNameInput" : "imgbbKeyInput";
  const value = document.getElementById(fieldId).value.trim();
  if (!value) {
    showMessage("Please enter the required upload setting first.", "error");
    return;
  }
  localStorage.setItem(provider === "cloudinary" ? "cloudName" : "imgbbKey", value);
  localStorage.setItem("uploadProvider", provider);
  window.location.reload();
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "show-setup") showSetup();
  if (action === "close-setup") closeSetup();
  if (action === "save-cloudinary") saveUploadProvider("cloudinary");
  if (action === "save-imgbb") saveUploadProvider("imgbb");
  if (action === "sign-in") signInOfficer();
  if (action === "sign-out") signOut(auth);
  if (action === "save-current-pick") saveCurrentPick();
  if (action === "close-book-detail") closeBookDetail();
  const tab = event.target.closest(".provider-tab");
  if (tab) switchProviderTab(tab.dataset.provider);
});

elements.setupModal.addEventListener("click", (event) => {
  if (event.target === elements.setupModal) closeSetup();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.setupModal.classList.contains("active")) closeSetup();
  if (event.key === "Escape" && !elements.bookDetailModal.hidden) closeBookDetail();
});
if (!state.uploadProvider && localStorage.getItem("setupDismissed") !== "true") {
  setTimeout(showSetup, 600);
}

// ====== IMAGE UPLOAD ======
function configuredUploadProvider() {
  return state.uploadProvider &&
    (state.uploadProvider !== "cloudinary" || state.cloudName) &&
    (state.uploadProvider !== "imgbb" || state.imgbbKey);
}

elements.uploadArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.uploadArea.classList.add("dragover");
});
elements.uploadArea.addEventListener("dragleave", () => elements.uploadArea.classList.remove("dragover"));
elements.uploadArea.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.uploadArea.classList.remove("dragover");
  if (event.dataTransfer.files.length) handleFile(event.dataTransfer.files[0]);
});
elements.coverUpload.addEventListener("change", (event) => {
  if (event.target.files.length) handleFile(event.target.files[0]);
});

async function handleFile(file) {
  if (state.isUploading) return;
  if (!file.type.startsWith("image/")) return setUploadStatus("Please upload an image file.", "error");
  if (file.size > MAX_IMAGE_BYTES) return setUploadStatus("Please choose an image smaller than 8 MB.", "error");
  if (!configuredUploadProvider()) {
    setUploadStatus("Set up cover uploads first (⚙ above).", "error");
    showSetup();
    return;
  }
  state.isUploading = true;
  elements.coverUpload.disabled = true;
  const reader = new FileReader();
  reader.onload = (event) => {
    elements.uploadPreview.src = event.target.result;
    elements.uploadPreview.classList.add("visible");
  };
  reader.readAsDataURL(file);
  setUploadStatus("Uploading…", "uploading");
  try {
    state.uploadedImageUrl = state.uploadProvider === "imgbb"
      ? await uploadToImgbb(file)
      : await uploadToCloudinary(file);
    setUploadStatus("Uploaded", "success");
  } catch (error) {
    console.error("Image upload failed:", error);
    setUploadStatus(`Upload failed: ${error.message}`, "error");
  } finally {
    state.isUploading = false;
    elements.coverUpload.disabled = false;
  }
}

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "bookclub_unsigned");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${state.cloudName}/image/upload`, { method: "POST", body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) throw new Error(data.error?.message || "Cloudinary upload failed");
  return data.secure_url;
}

async function uploadToImgbb(file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(state.imgbbKey)}`, { method: "POST", body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error?.message || "ImgBB upload failed");
  return data.data.url;
}

// ====== FIRESTORE AND BOOKSHELF ======
function isOfficer() {
  return Boolean(state.user?.email && ADMIN_EMAILS.includes(state.user.email.toLowerCase()));
}

function setOfficerStatus(message = "") {
  elements.officerStatus.textContent = message;
}

function updateOfficerControls() {
  const officer = isOfficer();
  elements.officerPicker.hidden = !officer;
  elements.officerSignIn.hidden = officer;
  if (state.user && !officer) setOfficerStatus(`${state.user.email} is not an approved officer.`);
  if (!state.user) setOfficerStatus("Officers can sign in to choose the club feature.");
  if (officer) setOfficerStatus(`Signed in as ${state.user.email}`);
}

onAuthStateChanged(auth, (user) => {
  state.user = user;
  updateOfficerControls();
});

async function signInOfficer() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error("Officer sign-in failed:", error);
    setOfficerStatus("Sign-in was cancelled or unavailable. Check the Firebase setup instructions.");
  }
}

async function saveCurrentPick() {
  if (!isOfficer()) return;
  const bookId = elements.currentPickSelect.value;
  if (!bookId) return setOfficerStatus("Choose a book first.");
  try {
    await setDoc(doc(db, "siteSettings", "currentPick"), { bookId, updatedAt: new Date().toISOString() }, { merge: true });
    setOfficerStatus("The Current Pick has been updated.");
  } catch (error) {
    console.error("Could not save Current Pick:", error);
    setOfficerStatus("Couldn’t save the Current Pick. Check your Firestore rules.");
  }
}

function renderCurrentPick(book) {
  const hasCover = Boolean(book?.coverUrl);
  elements.currentPickCover.hidden = !hasCover;
  elements.currentPickPlaceholder.hidden = hasCover;
  if (hasCover) elements.currentPickCover.src = book.coverUrl;
  elements.currentPickPlaceholder.querySelector("span").innerHTML = book ? escapeHtml(book.title).replace(/ /g, "<br>") : "Your First<br>Book Here";
  elements.currentPickTitle.textContent = book?.title || "The Current Pick";
  elements.currentPickAuthor.textContent = book ? `by ${book.author}` : "Choose a book from the shelf";
  elements.currentPickDescription.textContent = book?.why || "When your officers select a member recommendation, it will become the club’s Current Pick right here.";
  elements.currentPickMeta.textContent = book ? `Recommended by ${book.name}${book.genre ? ` · ${book.genre}` : ""}` : "Waiting for the next read";
}

onSnapshot(doc(db, "siteSettings", "currentPick"), (snapshot) => {
  state.currentPickId = snapshot.data()?.bookId || null;
  renderCurrentPick(state.books.find((book) => book.id === state.currentPickId));
}, (error) => console.error("Current Pick settings error:", error));

function renderCommentList(comments) {
  if (!comments?.length) return '<div class="no-comments">No comments yet — be the first!</div>';
  return comments.map((comment) => `
    <div class="comment-item">
      <div class="comment-author">${escapeHtml(comment.name)}</div>
      <div class="comment-text">${escapeHtml(comment.text)}</div>
    </div>`).join("");
}

function renderBooks() {
  if (!state.books.length) {
    elements.bookshelf.innerHTML = '<div class="empty-shelf">The shelf is waiting for its first books.<span class="sub">Be the first to add one below!</span></div>';
    populateCurrentPickOptions();
    return;
  }
  elements.bookshelf.innerHTML = state.books.map((book) => `
    <article class="book-card" data-book-id="${book.id}" role="button" tabindex="0" aria-label="Open details for ${escapeHtml(book.title)}">
      ${book.coverUrl
        ? `<img class="book-card-cover" src="${escapeHtml(book.coverUrl)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy">`
        : `<div class="book-card-cover-placeholder"><span>${escapeHtml(book.title)}</span></div>`}
      <div class="book-card-overlay" aria-hidden="true">
        <span>${escapeHtml(book.title)}</span>
        <small>Open book</small>
      </div>
    </article>`).join("");
  populateCurrentPickOptions();
}

function populateCurrentPickOptions() {
  const selectedId = state.currentPickId || "";
  elements.currentPickSelect.innerHTML = '<option value="">Choose a recommendation…</option>' + state.books.map((book) =>
    `<option value="${book.id}" ${book.id === selectedId ? "selected" : ""}>${escapeHtml(book.title)} — ${escapeHtml(book.author)}</option>`
  ).join("");
  renderCurrentPick(state.books.find((book) => book.id === state.currentPickId));
}

let lastFocusedElement = null;
function openBookDetail(book) {
  lastFocusedElement = document.activeElement;
  document.getElementById("bookDetailTitle").textContent = book.title;
  document.getElementById("bookDetailAuthor").textContent = `by ${book.author}`;
  document.getElementById("bookDetailWhy").textContent = book.why || "No note was added with this recommendation.";
  document.getElementById("bookDetailMeta").textContent = `Recommended by ${book.name}${book.genre ? ` · ${book.genre}` : ""}`;
  document.getElementById("bookDetailComments").innerHTML = renderCommentList(book.comments || []);
  document.getElementById("bookDetailCommentForm").dataset.bookId = book.id;
  const image = document.getElementById("bookDetailCover");
  const placeholder = document.getElementById("bookDetailPlaceholder");
  image.hidden = !book.coverUrl;
  placeholder.hidden = Boolean(book.coverUrl);
  placeholder.textContent = book.title;
  if (book.coverUrl) image.src = book.coverUrl;
  elements.bookDetailModal.hidden = false;
  elements.bookDetailModal.classList.add("active");
  elements.bookDetailModal.querySelector("[data-action=close-book-detail]").focus();
}

function closeBookDetail() {
  elements.bookDetailModal.classList.remove("active");
  elements.bookDetailModal.hidden = true;
  lastFocusedElement?.focus();
}

elements.bookDetailModal.addEventListener("click", (event) => {
  if (event.target === elements.bookDetailModal) closeBookDetail();
});

elements.bookshelf.addEventListener("click", (event) => {
  const card = event.target.closest(".book-card");
  if (!card) return;
  const book = state.books.find((entry) => entry.id === card.dataset.bookId);
  if (book) openBookDetail(book);
});
elements.bookshelf.addEventListener("keydown", (event) => {
  if (!event.target.matches(".book-card") || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  const book = state.books.find((entry) => entry.id === event.target.dataset.bookId);
  if (book) openBookDetail(book);
});
elements.bookshelf.addEventListener("error", (event) => {
  if (!event.target.matches(".book-card-cover")) return;
  const placeholder = document.createElement("div");
  placeholder.className = "book-card-cover-placeholder";
  placeholder.textContent = event.target.alt.replace(/^Cover of /, "");
  event.target.replaceWith(placeholder);
}, true);
async function postComment(event) {
  event.preventDefault();
  const form = event.target;
  const name = form.elements["comment-name"].value.trim();
  const text = form.elements["comment-text"].value.trim();
  if (!name || !text) return;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "…";
  try {
    await updateDoc(doc(db, "books", form.dataset.bookId), { comments: arrayUnion({ name, text, date: new Date().toISOString() }) });
    form.reset();
  } catch (error) {
    console.error("Failed to post comment:", error);
    showMessage("Could not post your comment — check your connection and try again.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Post";
  }
}

elements.bookDetailModal.addEventListener("submit", (event) => {
  if (event.target.matches(".comment-form")) postComment(event);
});

const connectionTimeout = setTimeout(() => {
  if (!state.firestoreConnected) elements.bookshelf.innerHTML = '<div class="empty-shelf">Couldn’t connect to the shelf.<span class="sub">Reload the page, or check your internet connection.</span></div>';
}, 5000);
onSnapshot(query(booksCollection, orderBy("date", "desc")), (snapshot) => {
  state.firestoreConnected = true;
  clearTimeout(connectionTimeout);
  state.books = snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));
  renderBooks();
  const openBookId = document.getElementById("bookDetailCommentForm").dataset.bookId;
  const openBook = state.books.find((book) => book.id === openBookId);
  if (!elements.bookDetailModal.hidden && openBook) {
    document.getElementById("bookDetailComments").innerHTML = renderCommentList(openBook.comments || []);
  }
}, (error) => {
  clearTimeout(connectionTimeout);
  console.error("Firestore sync error:", error);
  elements.bookshelf.innerHTML = `<div class="empty-shelf">Couldn’t load the shelf right now.<span class="sub">${error.code === "permission-denied" ? "The database rules are blocking access — the site owner needs to update Firestore security rules." : "Check your connection and refresh."}</span></div>`;
});

// ====== RECOMMENDATION FORM ======
elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(elements.form);
  const book = {
    name: data.get("name").trim(), title: data.get("bookTitle").trim(), author: data.get("author").trim(),
    genre: data.get("genre").trim(), why: data.get("why").trim(), coverUrl: state.uploadedImageUrl,
    comments: [], date: new Date().toISOString()
  };
  if (!book.name || !book.title || !book.author) return showMessage("Please fill in your name, the title, and the author.", "error");
  const button = elements.form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Adding…";
  try {
    await addDoc(booksCollection, book);
    elements.form.reset();
    elements.uploadPreview.classList.remove("visible");
    elements.uploadPreview.src = "";
    elements.coverUpload.value = "";
    setUploadStatus("");
    state.uploadedImageUrl = null;
    showMessage("Your book has been added to the shelf!");
    document.querySelector(".bookshelf").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error("Failed to add book:", error);
    showMessage("Could not add your book — check your connection and try again.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Add to the shelf";
  }
});

const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) {
    entry.target.classList.add("in-view");
    revealObserver.unobserve(entry.target);
  }
}), { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
