import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, collectionGroup, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, arrayUnion, onSnapshot, query, where, orderBy, limit, writeBatch, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { searchCatalog, loadCatalogDetails, sameBook } from "./book-catalog.js?v=3";

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
  authStatus: $("authStatus"), signIn: $("signInButton"), signOut: $("signOutButton"), profile: $("profileButton"), theme: $("themeButton"), toast: $("toast"), notificationButton: $("notificationButton"), notificationBadge: $("notificationBadge"), notificationDialog: $("notificationDialog"), notificationList: $("notificationList"), notificationStatus: $("notificationStatus"), markNotificationsRead: $("markNotificationsRead"),
  announcementText: $("announcementText"), announcementForm: $("announcementForm"), announcementInput: $("announcementInput"), announcementStatus: $("announcementStatus"),
  month: $("bookOfMonth"), monthCommunity: $("monthCommunity"), monthRating: $("monthRating"), monthProgress: $("monthProgress"), monthForm: $("monthForm"), monthStars: $("monthStars"), monthFinished: $("monthFinished"), monthComment: $("monthComment"), monthMessage: $("monthMessage"), monthNotes: $("monthNotes"), monthOfficer: $("monthOfficer"), monthPicker: $("monthPicker"), saveMonth: $("saveMonthButton"),
  books: $("booksGrid"), shelfResultStatus: $("shelfResultStatus"), shelfNavigation: $("shelfNavigation"), shelfPrevious: $("shelfPreviousButton"), shelfExpand: $("shelfExpandButton"), shelfNext: $("shelfNextButton"), surprise: $("surpriseBookButton"), search: $("bookSearch"), genre: $("genreFilter"), openPending: $("openPendingButton"), pendingCount: $("pendingCount"), pendingDialog: $("pendingDialog"), pendingList: $("pendingList"),
  activityFeed: $("activityFeed"), activityStatus: $("activityStatus"),
  readingGoalContent: $("readingGoalContent"), readingGoalTotal: $("readingGoalTotal"), readingGoalForm: $("readingGoalForm"), readingGoalTitle: $("readingGoalTitle"), readingGoalTarget: $("readingGoalTarget"), readingGoalEndDate: $("readingGoalEndDate"), readingGoalStart: $("readingGoalStartButton"), readingGoalEnd: $("readingGoalEndButton"), readingGoalStatus: $("readingGoalStatus"),
  dashboard: $("personalDashboard"), dashboardGreeting: $("dashboardGreeting"), dashboardOpenLibrary: $("dashboardOpenLibrary"), dashboardStats: $("dashboardStats"), dashboardMonth: $("dashboardMonth"), dashboardYear: $("dashboardYear"), dashboardReading: $("dashboardReading"), dashboardWanted: $("dashboardWanted"), dashboardFinished: $("dashboardFinished"), dashboardStatus: $("dashboardStatus"),
  discovery: $("discoveryCollections"), discoveryStatus: $("discoveryStatus"),
  events: $("eventsList"), eventForm: $("eventForm"), eventTitle: $("eventTitle"), eventDate: $("eventDate"), eventDetails: $("eventDetails"),
  boardForm: $("boardForm"), boardText: $("boardText"), boardStatus: $("boardStatus"), boardGuestHint: $("boardGuestHint"), pinBoard: $("pinBoard"),
  memories: $("memoriesGrid"), memoryForm: $("memoryForm"), memoryImage: $("memoryImage"), memoryFile: $("memoryFile"), memoryCaption: $("memoryCaption"), memoryCategory: $("memoryCategory"), memoryEvent: $("memoryEvent"), memoryBook: $("memoryBook"), memoryEditId: $("memoryEditId"), memorySave: $("memorySaveButton"), memoryCancelEdit: $("memoryCancelEdit"), memoryStatus: $("memoryStatus"), inviteForm: $("inviteForm"), inviteEmail: $("inviteEmail"),
  uploadSettingsForm: $("uploadSettingsForm"), cloudName: $("cloudName"), uploadPreset: $("uploadPreset"), googleBooksKey: $("googleBooksKey"), uploadSettingsStatus: $("uploadSettingsStatus"), suggestionHint: $("suggestionHint"),
  members: $("membersGrid"), suggestionDialog: $("suggestionDialog"), suggestionForm: $("suggestionForm"), suggestionMessage: $("suggestionMessage"), catalogDialog: $("catalogDialog"), catalogSearchForm: $("catalogSearchForm"), catalogQuery: $("catalogQuery"), catalogResults: $("catalogResults"), catalogPreview: $("catalogPreview"), catalogPreviewBook: $("catalogPreviewBook"), catalogDestinationGroup: $("catalogDestinationGroup"), catalogDestination: $("catalogDestination"), catalogGuestNameGroup: $("catalogGuestNameGroup"), catalogGuestName: $("catalogGuestName"), catalogGenre: $("catalogGenre"), catalogShelfNoteGroup: $("catalogShelfNoteGroup"), catalogShelfNote: $("catalogShelfNote"), catalogReasonGroup: $("catalogReasonGroup"), catalogReason: $("catalogReason"), catalogSave: $("catalogSaveButton"), catalogManual: $("catalogManualButton"), catalogMessage: $("catalogMessage"), bookDialog: $("bookDialog"), bookContent: $("bookContent"), profileDialog: $("profileDialog"), profileContent: $("profileContent")
};

const state = { user: null, profile: null, books: [], members: [], activities: [], activityLoaded: false, dashboardShelfEntries: [], dashboardRatings: [], dashboardLoaded: false, dashboardRatingsLoaded: false, dashboardRatingsUnavailable: false, stopDashboardShelf: null, stopDashboardRatings: null, dashboardOwnerId: null, pendingBooks: [], currentPickId: null, monthAccent: "#d8e66f", ratings: [], monthRecommendationWhy: "", announcement: "", readingGoal: null, completedGoalBooks: [], goalProgressLoaded: false, stopGoalProgress: null, events: [], eventRsvps: new Map(), stopEventRsvps: null, eventRsvpOwnerId: null, rsvpBusy: new Set(), memories: [], memoryEditingId: null, boardPosts: [], shelfEntries: [], search: sessionStorage.getItem("becShelfSearch") || "", genre: sessionStorage.getItem("becShelfGenre") || "", openProfileId: null, openProfileMember: null, profileActivities: [], stopRatings: null, stopMonthReasons: null, stopShelf: null, stopProfileActivity: null, stopPending: null, lastDialogTrigger: null, lastRandomBookId: null, randomPickerActive: false, cloudName: localStorage.getItem("becCloudName") || "", uploadPreset: localStorage.getItem("becUploadPreset") || "bookclub_unsigned", googleBooksKey: "", catalogResults: [], catalogBook: null, catalogTarget: "recommendation", catalogDuplicateConfirmation: "", activeBookId: null, legacyBookComments: [], bookComments: [], replyTarget: null, stopBookComments: null, lastCommentPost: null, bookReactions: [], reactionBookId: null, stopBookReactions: null, reactionBusy: false, notifications: [], stopNotifications: null };
const REACTION_OPTIONS = [
  ["emotional", "😭", "Emotional"], ["slow_burn", "🐌", "Slow Burn"], ["mind_blown", "🤯", "Mind-blowing"], ["comfort_read", "🧸", "Comfort Read"], ["funny", "😂", "Funny"], ["devastating", "💀", "Devastating"], ["thought_provoking", "🧠", "Thought-provoking"], ["great_romance", "❤️", "Great Romance"], ["great_worldbuilding", "🌎", "Great Worldbuilding"], ["beautiful_writing", "✍️", "Beautiful Writing"]
];
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// For HTML text and quoted attributes only; never interpolate into executable code.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
function safeImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}
function initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function color(value) { return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#ed7857"; }
function asDate(value) { if (value?.toDate instanceof Function) return value.toDate(); if (Number.isFinite(value?.seconds)) return new Date(value.seconds * 1000); return new Date(value || ""); }
function timeValue(value) { const date = asDate(value); return Number.isNaN(date.valueOf()) ? 0 : date.valueOf(); }
function dateLabel(value) { const date = new Date(`${value || ""}T12:00:00`); return Number.isNaN(date.valueOf()) ? "Date to be announced" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function dateTimeLabel(value) { const date = asDate(value); return Number.isNaN(date.valueOf()) ? "Recently" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }); }
function dateTimeAttribute(value) { const date = asDate(value); return Number.isNaN(date.valueOf()) ? "" : date.toISOString(); }
function recentFirst(items) { return [...items].sort((a, b) => String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""))); }
function newestActivities(items) { return [...items].sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt)); }
function relativeTime(value) {
  const date = asDate(value), elapsed = date.valueOf() - Date.now();
  if (Number.isNaN(date.valueOf())) return "Recently";
  const units = [["year", 31536000000], ["month", 2592000000], ["week", 604800000], ["day", 86400000], ["hour", 3600000], ["minute", 60000]];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, milliseconds] of units) if (Math.abs(elapsed) >= milliseconds || unit === "minute") return formatter.format(Math.round(elapsed / milliseconds), unit);
  return "Recently";
}
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
function activityMember(actorId) { return state.members.find((member) => member.id === actorId) || (actorId === state.user?.uid ? { ...state.profile, id: actorId } : { id: actorId, displayName: "A club member", photoURL: "" }); }
function activityAction(activity) {
  const actions = {
    started_reading: "started reading",
    finished_book: "finished",
    want_to_read: "saved for later",
    rated_book: "rated",
    discussed_book: "joined the discussion about",
    replied_to_comment: "replied in the discussion about",
    recommended_book: "recommended"
  };
  return actions[activity.type] || "shared an update about";
}
function activityRows(items, compact = false) {
  return newestActivities(items).map((activity) => {
    const member = activityMember(activity.actorId), name = member.displayName || "A club member";
    const avatar = member.photoURL ? `<img src="${escapeHtml(optimizedImageUrl(member.photoURL, 96))}" alt="" loading="lazy" decoding="async" width="44" height="44">` : escapeHtml(initials(name));
    const publicBook = activity.publicBookId && state.books.some((book) => book.id === activity.publicBookId);
    const target = publicBook ? `data-book-id="${escapeHtml(activity.publicBookId)}"` : `data-member-id="${escapeHtml(activity.actorId)}"`;
    const rating = activity.type === "rated_book" ? ` <span class="activity-rating" aria-label="${Number(activity.stars || 0)} out of 5 stars">${"★".repeat(Number(activity.stars || 0))}</span>` : "";
    return `<li><button type="button" class="activity-item${compact ? " is-compact" : ""}" ${target}><span class="activity-avatar">${avatar}</span><span class="activity-copy"><span><strong>${escapeHtml(name)}</strong> ${escapeHtml(activityAction(activity))} <cite>${escapeHtml(activity.bookTitle || "a book")}</cite>${rating}</span><small>${escapeHtml(activity.bookAuthor || "Unknown author")}</small></span><time class="activity-time" datetime="${escapeHtml(activity.createdAt || "")}" title="${escapeHtml(dateTimeLabel(activity.createdAt))}">${escapeHtml(relativeTime(activity.createdAt))}</time></button></li>`;
  }).join("");
}
function renderActivityFeed() {
  const expanded = ui.activityFeed.querySelector(".activity-more")?.open;
  ui.activityFeed.removeAttribute("aria-busy");
  ui.activityFeed.innerHTML = state.activities.length ? `<ol class="activity-list">${activityRows(newestActivities(state.activities).slice(0, 3))}</ol>${state.activities.length > 3 ? `<details class="activity-more" ${expanded ? "open" : ""}><summary>More reading updates (${state.activities.length - 3})</summary><ol class="activity-list">${activityRows(newestActivities(state.activities).slice(3))}</ol></details>` : ""}` : '<p class="empty-state">No public reading activity yet. Members can choose to share updates from their library cards.</p>';
  ui.activityStatus.textContent = state.activities.length ? `${state.activities.length} recent club ${state.activities.length === 1 ? "activity" : "activities"} loaded.` : "No public club activity yet.";
}
function renderMemberActivity() {
  const target = $("memberActivityList"); if (!target) return;
  target.removeAttribute("aria-busy");
  target.innerHTML = state.profileActivities.length ? `<ol class="activity-list profile-activity-list">${activityRows(state.profileActivities, true)}</ol>` : '<p class="empty-state">No public reading activity yet.</p>';
}
function pageCountValue(value) {
  const pages = Math.round(Number(value || 0));
  return Number.isFinite(pages) && pages > 0 && pages <= 10000 ? pages : 0;
}
function withPageCount(data, value) {
  const pages = pageCountValue(value);
  if (pages) data.pageCount = pages;
  return data;
}
function genreParts(entry) {
  return String(entry?.genre || "").split(/[,;/]/).map((genre) => genre.trim()).filter(Boolean).slice(0, 3);
}
function topGenre(entries) {
  const counts = new Map();
  entries.forEach((entry) => genreParts(entry).forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "Still exploring";
}
function periodReadingStats(entries, ratings, start, end) {
  const completed = entries.filter((entry) => entry.status === "read" && timeValue(entry.completedAt) >= start.valueOf() && timeValue(entry.completedAt) < end.valueOf());
  const withPages = completed.filter((entry) => pageCountValue(entry.pageCount));
  const pages = withPages.reduce((sum, entry) => sum + pageCountValue(entry.pageCount), 0);
  const periodRatings = ratings.filter((rating) => timeValue(rating.updatedAt) >= start.valueOf() && timeValue(rating.updatedAt) < end.valueOf());
  const highest = [...periodRatings].sort((a, b) => Number(b.stars || 0) - Number(a.stars || 0) || timeValue(b.updatedAt) - timeValue(a.updatedAt))[0];
  return { completed, pages, pageBooks: withPages.length, genre: topGenre(completed), ratings: periodRatings, highest, highestBook: highest ? state.books.find((book) => book.id === highest.bookId) : null };
}
function dashboardSummaryMarkup(title, stats, emptyCopy) {
  if (!stats.completed.length && !stats.ratings.length) return `<p class="eyebrow">${escapeHtml(title.toUpperCase())}</p><h3>${escapeHtml(title)}</h3><p class="dashboard-summary-empty">${escapeHtml(emptyCopy)}</p>`;
  const pageLine = stats.pageBooks ? `<li><strong>${stats.pages.toLocaleString()}</strong><span>${stats.pageBooks === stats.completed.length ? "pages finished" : `known pages from ${stats.pageBooks} of ${stats.completed.length} finishes`}</span></li>` : "";
  const ratingLine = stats.highest && stats.highestBook ? `<li><strong>${"★".repeat(Number(stats.highest.stars || 0))}</strong><span>highest rated: ${escapeHtml(stats.highestBook.title)}</span></li>` : "";
  const genreLine = stats.completed.some((entry) => genreParts(entry).length) ? `<li><strong>${escapeHtml(stats.genre)}</strong><span>most-read genre</span></li>` : "";
  return `<p class="eyebrow">YOUR ${escapeHtml(title.toUpperCase())}</p><h3>${escapeHtml(title)}</h3><ul><li><strong>${stats.completed.length}</strong><span>${stats.completed.length === 1 ? "book" : "books"} finished</span></li>${pageLine}${ratingLine}${genreLine}</ul>`;
}
function dashboardBookMarkup(book) {
  return `<article class="dashboard-book"><button type="button" data-dashboard-book-id="${escapeHtml(book.id)}" aria-label="Open ${escapeHtml(book.title || "Untitled book")}"><span class="dashboard-book-cover">${coverMarkup(book, "", "lazy", 360)}</span><span class="dashboard-book-copy"><strong>${escapeHtml(book.title || "Untitled book")}</strong><small>${escapeHtml(book.author || "Unknown author")}</small>${pageCountValue(book.pageCount) ? `<em>${pageCountValue(book.pageCount).toLocaleString()} pages</em>` : ""}</span></button></article>`;
}
function renderDashboardBookRow(target, entries, emptyCopy) {
  target.removeAttribute("aria-busy");
  target.innerHTML = entries.length ? entries.slice(0, 4).map(dashboardBookMarkup).join("") : `<p class="empty-state dashboard-empty">${escapeHtml(emptyCopy)} <button type="button" class="text-button" data-open-dashboard-library>Open my library</button></p>`;
}
function renderDashboard() {
  if (!isMember()) { ui.dashboard.hidden = true; return; }
  ui.dashboard.hidden = false;
  const displayName = state.profile?.displayName || "reader";
  ui.dashboardGreeting.textContent = `A private-at-a-glance view for ${displayName}, built from your personal shelf and club ratings.`;
  if (!state.dashboardLoaded) return;
  const entries = state.dashboardShelfEntries, reading = recentFirst(entries.filter((entry) => entry.status === "reading")), wanted = recentFirst(entries.filter((entry) => entry.status === "want-to-read")), finished = [...entries.filter((entry) => entry.status === "read")].sort((a, b) => timeValue(b.completedAt) - timeValue(a.completedAt) || String(b.date || "").localeCompare(String(a.date || "")));
  const readPages = finished.reduce((sum, entry) => sum + pageCountValue(entry.pageCount), 0), pageBooks = finished.filter((entry) => pageCountValue(entry.pageCount)).length;
  const currentRating = state.dashboardRatings[0];
  const stats = [
    [finished.length, "books finished"], [reading.length, "currently reading"], [wanted.length, "waiting up next"], [topGenre(entries), "most-shelved genre"]
  ];
  if (pageBooks) stats.push([readPages.toLocaleString(), pageBooks === finished.length ? "pages across finished books" : `known pages across ${pageBooks} finished books`]);
  if (currentRating) stats.push([`${Number(currentRating.stars).toFixed(1)} ★`, "your current club-pick rating"]);
  ui.dashboardStats.removeAttribute("aria-busy");
  ui.dashboardStats.innerHTML = stats.map(([value, label]) => `<article class="dashboard-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`).join("");
  const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1), monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1), yearStart = new Date(now.getFullYear(), 0, 1), yearEnd = new Date(now.getFullYear() + 1, 0, 1);
  const monthTitle = now.toLocaleDateString(undefined, { month: "long" }), yearTitle = String(now.getFullYear());
  ui.dashboardMonth.innerHTML = dashboardSummaryMarkup(monthTitle, periodReadingStats(entries, state.dashboardRatings, monthStart, monthEnd), "No newly tracked finishes or ratings yet this month. Your next ending will start the summary.");
  ui.dashboardYear.innerHTML = dashboardSummaryMarkup(`${yearTitle} so far`, periodReadingStats(entries, state.dashboardRatings, yearStart, yearEnd), "No completion dates have been recorded this year yet. Older Read books still remain in your all-time total.");
  renderDashboardBookRow(ui.dashboardReading, reading, "Nothing is marked Currently Reading yet.");
  renderDashboardBookRow(ui.dashboardWanted, wanted, "Your Want to Read section is waiting for a future favorite.");
  renderDashboardBookRow(ui.dashboardFinished, finished, "Finished books will collect here once you move them into Read.");
  ui.dashboardStatus.textContent = pageBooks && pageBooks < finished.length ? `Page totals use verified catalogue data from ${pageBooks} of ${finished.length} finished books; missing page counts are not estimated.` : finished.length && !pageBooks ? "Page totals will appear when finished books include reliable catalogue page counts. Nothing is estimated." : "Completion dates are tracked from Phase 3 onward; older Read books remain in the all-time total without being assigned a false finish date.";
}
function syncDashboardSubscriptions() {
  if (!isMember()) {
    state.stopDashboardShelf?.(); state.stopDashboardRatings?.(); state.stopDashboardShelf = null; state.stopDashboardRatings = null; state.dashboardOwnerId = null; state.dashboardShelfEntries = []; state.dashboardRatings = []; state.dashboardLoaded = false; state.dashboardRatingsLoaded = false; state.dashboardRatingsUnavailable = false; renderDashboard(); return;
  }
  if (state.dashboardOwnerId === state.user.uid && state.stopDashboardShelf) return;
  state.stopDashboardShelf?.(); state.stopDashboardRatings?.(); state.dashboardOwnerId = state.user.uid; state.dashboardShelfEntries = []; state.dashboardRatings = []; state.dashboardLoaded = false; state.dashboardRatingsLoaded = false; state.dashboardRatingsUnavailable = false; renderDashboard();
  state.stopDashboardShelf = onSnapshot(query(collection(db, "memberShelves", state.user.uid, "entries"), limit(300)), (snapshot) => {
    state.dashboardShelfEntries = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); state.dashboardLoaded = true;
    if (state.openProfileId === state.user.uid) state.shelfEntries = state.dashboardShelfEntries; renderDashboard();
  }, (error) => { console.warn("Personal dashboard shelf unavailable:", error); state.dashboardLoaded = true; ui.dashboardStats.removeAttribute("aria-busy"); ui.dashboardStats.innerHTML = '<p class="empty-state">Your dashboard could not load, but My library is still available.</p>'; ui.dashboardStatus.textContent = "Check the published Firestore rules and try reopening the page."; });
  state.dashboardRatings = state.ratings.filter((rating) => rating.memberId === state.user.uid).map((rating) => ({ ...rating, bookId: state.currentPickId || "" })); state.dashboardRatingsLoaded = true;
}
function openDashboardBook(entryId) {
  if (!isMember()) return; const entry = state.dashboardShelfEntries.find((book) => book.id === entryId); if (!entry) return;
  state.openProfileId = state.user.uid; state.openProfileMember = { ...state.profile, id: state.user.uid }; state.shelfEntries = state.dashboardShelfEntries; state.randomPickerActive = false; openBookDetails(entry, true);
}
function activityBook(activity) {
  return state.books.find((book) => book.id === activity.publicBookId) || state.books.find((book) => sameBook(book, { title: activity.bookTitle, author: activity.bookAuthor }));
}
function discoveryBookCard(book, note) {
  return `<article class="discovery-book"><button type="button" data-book-id="${escapeHtml(book.id)}" aria-label="Open ${escapeHtml(book.title || "Untitled book")}"><span class="discovery-cover">${coverMarkup(book, "", "lazy", 360)}</span><span class="discovery-copy"><strong>${escapeHtml(book.title || "Untitled book")}</strong><small>${escapeHtml(book.author || "Unknown author")}</small><em>${escapeHtml(note)}</em></span></button></article>`;
}
function discoveryLane(title, copy, items) {
  return `<section class="discovery-lane"><header><div><p class="eyebrow">A LIVING COLLECTION</p><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></div><span>${items.length} ${items.length === 1 ? "book" : "books"}</span></header><div class="discovery-row">${items.map(({ book, note }) => discoveryBookCard(book, note)).join("")}</div></section>`;
}
function renderDiscovery() {
  ui.discovery.removeAttribute("aria-busy");
  if (!state.books.length) { ui.discovery.innerHTML = '<p class="empty-state">Discovery collections will grow alongside the member bookshelf.</p>'; ui.discoveryStatus.textContent = "No discovery collections yet."; $("discoveryCategory").innerHTML = '<option>No collections yet</option>'; $("discoveryCategory").disabled = true; return; }
  const now = Date.now(), recentWindow = now - 30 * 86400000, scores = new Map(), discussionScores = new Map();
  state.activities.forEach((activity) => {
    const book = activityBook(activity); if (!book || timeValue(activity.createdAt) < recentWindow) return;
    const weight = ["discussed_book", "replied_to_comment", "finished_book"].includes(activity.type) ? 3 : ["rated_book", "recommended_book"].includes(activity.type) ? 2 : 1;
    const current = scores.get(book.id) || { book, score: 0, latest: 0 }; current.score += weight; current.latest = Math.max(current.latest, timeValue(activity.createdAt)); scores.set(book.id, current);
    if (["discussed_book", "replied_to_comment"].includes(activity.type)) discussionScores.set(book.id, (discussionScores.get(book.id) || 0) + 1);
  });
  state.books.forEach((book) => { const legacy = Array.isArray(book.comments) ? book.comments.length : 0; if (legacy) discussionScores.set(book.id, (discussionScores.get(book.id) || 0) + legacy); });
  const lanes = [], active = [...scores.values()].sort((a, b) => b.score - a.score || b.latest - a.latest);
  if (active.length >= 2 || active[0]?.score >= 4) lanes.push(discoveryLane("Active Lately", "Books showing up in the club’s recent reading, ratings, and conversations.", active.slice(0, 6).map((item) => ({ book: item.book, note: "Recently read or shared" }))));
  const discussed = state.books.map((book) => ({ book, count: discussionScores.get(book.id) || 0 })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
  if (discussed.length >= 2 || discussed[0]?.count >= 2) lanes.push(discoveryLane("In the Conversation", "Books with notes and conversations to explore.", discussed.slice(0, 6).map((item) => ({ book: item.book, note: "Readers are talking about this" }))));
  const newest = recentFirst(state.books).slice(0, 6);
  lanes.push(discoveryLane("New on the Club Shelf", "The latest recommendations added by members and approved guest readers.", newest.map((book) => ({ book, note: `Added ${dateTimeLabel(book.date)}` }))));
  const signaled = new Set([...scores.keys(), ...discussionScores.keys(), ...newest.slice(0, 2).map((book) => book.id)]), quiet = state.books.filter((book) => !signaled.has(book.id)).slice(0, 6);
  if (quiet.length >= 3) lanes.push(discoveryLane("Quiet Finds", "Books with room for the club’s next rating, reaction, or conversation.", quiet.map((book) => ({ book, note: "Waiting for a fresh conversation" }))));
  const picker = $("discoveryCategory"), previous = picker.value;
  ui.discovery.innerHTML = lanes.join("");
  const sections = [...ui.discovery.querySelectorAll(".discovery-lane")];
  picker.innerHTML = sections.map((section) => { const title = section.querySelector("h3").textContent; return `<option value="${escapeHtml(title)}">${escapeHtml(title)}</option>`; }).join("");
  picker.disabled = false;
  if (sections.some((section) => section.querySelector("h3").textContent === previous)) picker.value = previous;
  showDiscoveryCategory();
}
function showDiscoveryCategory() {
  const selected = $("discoveryCategory").value;
  ui.discovery.querySelectorAll(".discovery-lane").forEach((section) => { section.hidden = section.querySelector("h3").textContent !== selected; });
  ui.discoveryStatus.textContent = selected ? `Showing ${selected}.` : "No collections yet.";
}
$("discoveryCategory").addEventListener("change", showDiscoveryCategory);

function activityTypeForStatus(status) { return status === "read" ? "finished_book" : status === "want-to-read" ? "want_to_read" : "started_reading"; }
function activityDocumentId(type, key) { return `${state.user?.uid || "member"}_${type}_${key}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 220); }
async function recordActivity(type, book, options = {}) {
  if (!isMember() || state.profile?.shareActivity !== true || !book?.title) return false;
  const payload = {
    actorId: state.user.uid,
    type,
    bookTitle: String(book.title || "Untitled book").slice(0, 160),
    bookAuthor: String(book.author || "Unknown author").slice(0, 100),
    coverUrl: String(book.coverUrl || "").slice(0, 500),
    catalogKey: String(book.catalogKey || "").slice(0, 200),
    publicBookId: String(options.publicBookId || "").slice(0, 128),
    shelfEntryId: String(options.shelfEntryId || "").slice(0, 128),
    createdAt: new Date().toISOString()
  };
  if (type === "rated_book") payload.stars = Math.min(5, Math.max(1, Math.round(Number(options.stars || 1))));
  try {
    if (options.key) await setDoc(doc(db, "activities", activityDocumentId(type, options.key)), payload);
    else await addDoc(collection(db, "activities"), payload);
    return true;
  } catch (error) {
    console.warn("Activity was not published; the main update was still saved:", error);
    return false;
  }
}
async function clearOwnActivityHistory() {
  let removed = 0;
  for (let pass = 0; pass < 5; pass += 1) {
    const snapshot = await getDocs(query(collection(db, "activities"), where("actorId", "==", state.user.uid), limit(200)));
    if (snapshot.empty) break;
    const batch = writeBatch(db); snapshot.docs.forEach((entry) => batch.delete(entry.ref)); await batch.commit(); removed += snapshot.size;
    if (snapshot.size < 200) break;
  }
  return removed;
}

function notificationCopy(notification) {
  const actor = state.members.find((member) => member.id === notification.actorId)?.displayName || "A club member";
  const book = state.books.find((item) => item.id === notification.bookId);
  const event = state.events.find((item) => item.id === notification.eventId);
  if (notification.type === "discussion_reply") return { icon: "↩", title: `${actor} replied to your discussion`, detail: book ? `Open the discussion about ${book.title}.` : "Open the book discussion." };
  if (notification.type === "book_of_month_changed") return { icon: "📖", title: "A new Book of the Month was chosen", detail: book?.title || "See the club’s current read." };
  if (notification.type === "announcement_updated") return { icon: "📢", title: "A new club announcement was posted", detail: "Open the announcement desk for the latest update." };
  if (notification.type === "event_added") return { icon: "◇", title: "A new club event was added", detail: event?.title || "Open Club Events for the details." };
  return { icon: "✦", title: "There is a new club update", detail: "Open it to learn more." };
}
function renderNotifications() {
  const notifications = newestActivities(state.notifications), unread = notifications.filter((item) => !item.read).length;
  ui.notificationButton.hidden = !isMember(); ui.notificationBadge.hidden = unread === 0; ui.notificationBadge.textContent = unread >= 50 ? "50+" : String(unread); ui.notificationButton.setAttribute("aria-label", unread ? `Notifications, ${unread >= 50 ? "50 or more" : unread} unread` : "Notifications, none unread");
  ui.markNotificationsRead.disabled = unread === 0;
  ui.notificationList.removeAttribute("aria-busy");
  ui.notificationList.innerHTML = notifications.length ? notifications.map((notification) => { const copy = notificationCopy(notification); return `<button type="button" class="notification-item${notification.read ? "" : " is-unread"}" data-notification-id="${escapeHtml(notification.id)}"><span class="notification-icon" aria-hidden="true">${copy.icon}</span><span class="notification-copy"><strong>${escapeHtml(copy.title)}</strong><span>${escapeHtml(copy.detail)}</span><time datetime="${escapeHtml(dateTimeAttribute(notification.createdAt))}">${escapeHtml(relativeTime(notification.createdAt))}</time></span>${notification.read ? "" : '<span class="notification-dot"><span class="visually-hidden">Unread</span></span>'}</button>`; }).join("") : '<p class="empty-state">You’re all caught up. Direct replies and important club updates will appear here.</p>';
  ui.notificationStatus.textContent = notifications.length ? `${notifications.length} recent notification${notifications.length === 1 ? "" : "s"}.` : "No notifications yet.";
}
function syncNotificationSubscription() {
  if (!isMember()) {
    state.stopNotifications?.(); state.stopNotifications = null; state.notifications = []; renderNotifications(); return;
  }
  if (state.stopNotifications) return;
  ui.notificationList.setAttribute("aria-busy", "true");
  ui.notificationList.innerHTML = '<span class="skeleton skeleton-activity" aria-hidden="true"></span><span class="skeleton skeleton-activity" aria-hidden="true"></span>';
  state.stopNotifications = onSnapshot(query(collection(db, "members", state.user.uid, "notifications"), orderBy("createdAt", "desc"), limit(50)), (snapshot) => { state.notifications = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); renderNotifications(); }, (error) => { console.warn("Notifications unavailable:", error); ui.notificationList.removeAttribute("aria-busy"); ui.notificationList.innerHTML = '<p class="empty-state">Notifications could not load. The rest of the site is still available.</p>'; ui.notificationStatus.textContent = "Notifications could not load."; });
}
async function createReplyNotification(book, parent, replyId) {
  if (!isMember() || !parent?.memberId || parent.memberId === state.user.uid || parent.legacy) return false;
  const notification = { type: "discussion_reply", actorId: state.user.uid, bookId: book.id, discussionId: parent.id, replyId, eventId: "", createdAt: serverTimestamp(), read: false, readAt: null };
  try { await setDoc(doc(db, "members", parent.memberId, "notifications", `reply_${replyId}`), notification); return true; }
  catch (error) { console.warn("Reply saved, but its private notification was not delivered:", error); return false; }
}
async function publishClubNotifications(type, identifiers = {}) {
  if (!isOfficer()) return false;
  const actorId = state.user.uid;
  const notificationId = type === "book_of_month_changed" ? "book_of_month" : type === "announcement_updated" ? "announcement" : `event_${identifiers.eventId || "update"}`;
  try {
    let memberPool = state.members;
    if (!memberPool.length) { const snapshot = await getDocs(query(collection(db, "members"), limit(100))); memberPool = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); }
    const recipients = memberPool.filter((member) => member.id && member.id !== actorId && ["member", "officer"].includes(member.role)).slice(0, 100);
    if (!recipients.length) return true;
    // Small batches stay comfortably inside Firestore Security Rules' document-access limit.
    for (let index = 0; index < recipients.length; index += 10) {
      const batch = writeBatch(db), group = recipients.slice(index, index + 10);
      group.forEach((member) => batch.set(doc(db, "members", member.id, "notifications", notificationId), { type, actorId, bookId: String(identifiers.bookId || ""), discussionId: "", replyId: "", eventId: String(identifiers.eventId || ""), createdAt: serverTimestamp(), read: false, readAt: null }));
      await batch.commit();
    }
    return true;
  } catch (error) { console.warn("Club update saved, but notifications were not delivered:", error); toast("The update was saved, but member notifications could not be delivered."); return false; }
}
async function markNotificationRead(id) {
  const notification = state.notifications.find((item) => item.id === id); if (!notification || notification.read) return;
  notification.read = true; renderNotifications();
  try { await updateDoc(doc(db, "members", state.user.uid, "notifications", id), { read: true, readAt: serverTimestamp() }); }
  catch (error) { console.warn(error); notification.read = false; renderNotifications(); toast("Could not mark that notification as read."); }
}
async function markAllNotificationsRead() {
  const unread = state.notifications.filter((item) => !item.read); if (!unread.length) return;
  const previous = unread.map((item) => item.id); unread.forEach((item) => { item.read = true; }); renderNotifications();
  try { const batch = writeBatch(db); unread.forEach((item) => batch.update(doc(db, "members", state.user.uid, "notifications", item.id), { read: true, readAt: serverTimestamp() })); await batch.commit(); toast("Notifications marked as read."); }
  catch (error) { console.warn(error); state.notifications.forEach((item) => { if (previous.includes(item.id)) item.read = false; }); renderNotifications(); toast("Could not mark every notification as read."); }
}
async function openNotificationTarget(id) {
  const notification = state.notifications.find((item) => item.id === id); if (!notification) return;
  await markNotificationRead(id); closeDialog(ui.notificationDialog);
  if (notification.type === "discussion_reply") { const book = state.books.find((item) => item.id === notification.bookId); if (book) { state.randomPickerActive = false; openBookDetails(book); requestAnimationFrame(() => $("bookCommentList")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })); } else toast("That book is no longer on the public shelf."); return; }
  const target = notification.type === "book_of_month_changed" ? $("monthHeading") : notification.type === "announcement_updated" ? $("announcementHeading") : $("events");
  requestAnimationFrame(() => target?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear(), month = String(date.getMonth() + 1).padStart(2, "0"), day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function goalProgressCount() {
  if (!state.readingGoal) return 0;
  if (!state.readingGoal.active) return Math.max(0, Number(state.readingGoal.finalProgress || 0));
  const started = timeValue(state.readingGoal.startAt), end = state.readingGoal.endDate ? new Date(`${state.readingGoal.endDate}T23:59:59.999`).valueOf() : Number.POSITIVE_INFINITY;
  if (!started) return 0;
  return state.completedGoalBooks.filter((entry) => { const finished = timeValue(entry.completedAt); return finished >= started && finished <= end; }).length;
}
function renderReadingGoal() {
  const goal = state.readingGoal;
  ui.readingGoalForm.hidden = !isOfficer();
  ui.readingGoalEnd.hidden = !isOfficer() || !goal?.active;
  ui.readingGoalStart.disabled = Boolean(goal?.active);
  ui.readingGoalEnd.disabled = Boolean(goal?.active && !state.goalProgressLoaded);
  if (!goal) {
    ui.readingGoalTotal.textContent = "No active goal yet";
    ui.readingGoalContent.innerHTML = '<p class="empty-state">The next club-wide reading challenge will appear here. Officers can start one whenever the club is ready.</p>';
    return;
  }
  if (goal.active && !state.goalProgressLoaded) {
    ui.readingGoalTotal.textContent = "Counting finished books…";
    ui.readingGoalContent.innerHTML = '<div class="skeleton skeleton-activity" aria-hidden="true"></div>';
    return;
  }
  const progress = goalProgressCount(), target = Math.max(1, Number(goal.target || 1)), percent = Math.min(100, Math.round((progress / target) * 100));
  const start = dateTimeLabel(goal.startAt), deadline = goal.endDate ? dateLabel(goal.endDate) : "No deadline";
  const status = goal.active ? (progress >= target ? "Goal reached — keep the streak going!" : `${target - progress} book${target - progress === 1 ? "" : "s"} to go`) : "This challenge is complete";
  ui.readingGoalTotal.textContent = goal.active ? status : `Finished at ${progress} of ${target}`;
  ui.readingGoalContent.innerHTML = `<div class="reading-goal-header"><div><h3>${escapeHtml(goal.title || "Our shared reading goal")}</h3><p>${goal.active ? "Every newly finished personal-shelf book adds one to this shared total." : "A finished chapter in the club’s reading history."}</p></div></div><div class="reading-goal-progress"><div class="reading-goal-progress-label"><strong>${progress} / ${target} books</strong><span>${percent}%</span></div><div class="reading-goal-track" role="progressbar" aria-label="Collective reading goal" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(progress, target)}"><div class="reading-goal-fill" style="--goal-progress:${percent}%"></div></div></div><div class="reading-goal-stats"><div class="reading-goal-stat"><strong>${progress}</strong><span>books finished</span></div><div class="reading-goal-stat"><strong>${Math.max(0, target - progress)}</strong><span>still to go</span></div><div class="reading-goal-stat"><strong>${escapeHtml(start)}</strong><span>challenge started</span></div><div class="reading-goal-stat"><strong>${escapeHtml(deadline)}</strong><span>finish by</span></div></div>`;
}
function syncGoalProgressSubscription() {
  if (!state.readingGoal?.active) {
    state.stopGoalProgress?.(); state.stopGoalProgress = null; state.completedGoalBooks = []; state.goalProgressLoaded = true; renderReadingGoal(); return;
  }
  if (state.stopGoalProgress) return;
  state.goalProgressLoaded = false; renderReadingGoal();
  state.stopGoalProgress = onSnapshot(query(collectionGroup(db, "entries"), limit(500)), (snapshot) => {
    state.completedGoalBooks = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id, ownerId: entry.ref.parent.parent?.id || "" })).filter((entry) => entry.status === "read");
    state.goalProgressLoaded = true; renderReadingGoal();
  }, (error) => {
    console.warn("Collective reading progress unavailable:", error); state.goalProgressLoaded = false;
    ui.readingGoalTotal.textContent = "Progress is temporarily unavailable";
    ui.readingGoalContent.innerHTML = '<p class="empty-state">The goal is safe, but finished-book totals could not load. An officer may need to publish the included Firestore rules.</p>';
  });
}
async function saveReadingGoal(event) {
  event.preventDefault(); if (!isOfficer()) return;
  const title = ui.readingGoalTitle.value.trim(), target = Number(ui.readingGoalTarget.value), endDate = ui.readingGoalEndDate.value;
  if (!title || !Number.isInteger(target) || target < 1 || target > 1000) { ui.readingGoalStatus.textContent = "Add a name and choose a target from 1 to 1,000 books."; return; }
  if (endDate && endDate < localDateKey()) { ui.readingGoalStatus.textContent = "Choose today or a future date for the new goal."; return; }
  if (state.readingGoal?.active) { ui.readingGoalStatus.textContent = "Finish the current goal before starting another one."; return; }
  await runBusy(ui.readingGoalStart, "Starting…", async () => {
    try {
      await setDoc(doc(db, "siteSettings", "readingGoal"), { title, target, metric: "books", startAt: serverTimestamp(), endDate, active: true, finalProgress: 0, updatedAt: serverTimestamp() });
      ui.readingGoalForm.reset(); ui.readingGoalTarget.value = "50"; ui.readingGoalStatus.textContent = "The new challenge is live for everyone."; toast("Collective reading goal started.");
    } catch (error) { console.error(error); ui.readingGoalStatus.textContent = "Could not start that goal. Check the Phase 3 Firestore rules."; }
  });
}
async function finishReadingGoal() {
  if (!isOfficer() || !state.readingGoal?.active || !window.confirm("Finish this reading goal at its current total?")) return;
  await runBusy(ui.readingGoalEnd, "Finishing…", async () => {
    try { await updateDoc(doc(db, "siteSettings", "readingGoal"), { active: false, finalProgress: goalProgressCount(), updatedAt: serverTimestamp() }); ui.readingGoalStatus.textContent = "Goal finished and preserved on the page."; toast("Reading goal completed."); }
    catch (error) { console.error(error); ui.readingGoalStatus.textContent = "Could not finish the goal."; }
  });
}
function syncEventRsvpSubscription() {
  if (!isMember()) {
    state.stopEventRsvps?.(); state.stopEventRsvps = null; state.eventRsvpOwnerId = null; state.eventRsvps = new Map(); renderEvents(); return;
  }
  if (state.stopEventRsvps && state.eventRsvpOwnerId === state.user.uid) return;
  state.stopEventRsvps?.(); state.stopEventRsvps = null; state.eventRsvps = new Map(); state.eventRsvpOwnerId = state.user.uid;
  state.stopEventRsvps = onSnapshot(query(collection(db, "members", state.user.uid, "eventRsvps"), limit(100)), (snapshot) => {
    state.eventRsvps = new Map(snapshot.docs.map((entry) => [entry.id, { ...entry.data(), id: entry.id }])); renderEvents();
  }, (error) => { console.warn("Your event responses are unavailable:", error); state.eventRsvps = new Map(); renderEvents(); });
}
function setAuthUi() {
  const name = state.profile?.displayName || state.user?.displayName || "reader";
  ui.authStatus.textContent = isMember() ? `Hello, ${name}` : state.user ? "Signed in — member access pending" : "Exploring as a guest";
  ui.signIn.hidden = Boolean(state.user); ui.signOut.hidden = !state.user; ui.profile.hidden = !isMember(); ui.monthOfficer.hidden = !isOfficer(); ui.readingGoalForm.hidden = !isOfficer(); ui.eventForm.hidden = !isOfficer(); ui.memoryForm.hidden = !isOfficer(); ui.inviteForm.hidden = !isOfficer(); ui.uploadSettingsForm.hidden = !isOfficer(); ui.announcementForm.hidden = !isOfficer(); ui.openPending.hidden = !isOfficer(); ui.boardForm.hidden = !isMember(); ui.boardGuestHint.hidden = isMember(); ui.monthForm.hidden = !isMember(); ui.monthMessage.hidden = !isMember();
  ui.suggestionHint.textContent = isMember() ? "Search two catalogues, then add the result to the club shelf or your personal library." : "Everyone can search the catalogue. Guest suggestions are sent to officers for review.";
  if (isOfficer()) { ensureMonthAccentControl(); ui.cloudName.value = state.cloudName; ui.uploadPreset.value = state.uploadPreset; ui.googleBooksKey.value = state.googleBooksKey; ui.announcementInput.value = state.announcement; }
  syncPendingSubscription(); renderNotifications(); syncNotificationSubscription(); syncEventRsvpSubscription(); syncDashboardSubscriptions(); renderDashboard(); renderDiscovery(); renderMonth(); renderReadingGoal(); renderEvents(); renderMemoryOptions(); renderMemories(); renderBoard(); renderPending(); renderBookReactions();
}

function optimizedImageUrl(url, width = 600) {
  const value = safeImageUrl(url);
  if (/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(value)) return value.replace(/\/image\/upload\//i, `/image/upload/f_auto,q_auto,c_limit,w_${Math.round(width)}/`);
  if (width <= 240 && /covers\.openlibrary\.org\/.*-L\.jpg/i.test(value)) return value.replace(/-L\.jpg/i, "-M.jpg");
  return value;
}
function automaticCoverUrl(book) { const isbn = String(book?.isbn || "").replace(/[^0-9X]/gi, ""); if (safeImageUrl(book?.coverUrl)) return safeImageUrl(book.coverUrl); if (book?.googleBooksId) return `https://books.google.com/books/content?id=${encodeURIComponent(book.googleBooksId)}&printsec=frontcover&img=1&zoom=2&source=gbs_api`; if (isbn) return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`; return ""; }
function coverRetryAttributes(book) { return `data-cover-title="${escapeHtml(book.title || "")}" data-cover-author="${escapeHtml(book.author || "")}" data-cover-isbn="${escapeHtml(book.isbn || "")}" data-google-books-id="${escapeHtml(book.googleBooksId || "")}"`; }
function coverImageMarkup(book, width = 600, className = "", loading = "lazy") { return `<img class="${escapeHtml(className)}" src="${escapeHtml(optimizedImageUrl(automaticCoverUrl(book), width))}" alt="Cover of ${escapeHtml(book.title || "Untitled book")}" ${coverRetryAttributes(book)} loading="${escapeHtml(loading)}" decoding="async" referrerpolicy="no-referrer" ${loading === "eager" ? 'fetchpriority="high"' : ""} width="400" height="600">`; }
function coverMarkup(book, className = "", loading = "lazy", width = 600) { return automaticCoverUrl(book) ? coverImageMarkup(book, width, className, loading) : `<div class="fallback-cover">${escapeHtml(book.title || "Untitled book")}</div>`; }
const shelfAddedMessages = [
  "Added to your shelf — another story has found a home.",
  "Shelved! Your little library just gained a new chapter.",
  "Book added — your reading corner is looking even better.",
  "Safe on the shelf! Future you has something new to read.",
  "Another book joins the collection. Excellent choice.",
  "Added to your personal shelf — happy reading!"
];
function shelfAddedMessage() { let index = Math.floor(Math.random() * shelfAddedMessages.length); if (shelfAddedMessage.last === index) index = (index + 1) % shelfAddedMessages.length; shelfAddedMessage.last = index; return shelfAddedMessages[index]; }
function updateShelfNavigation() {
  const expanded = ui.books.classList.contains("is-expanded");
  ui.shelfNavigation.classList.toggle("is-expanded", expanded); ui.shelfExpand.setAttribute("aria-expanded", String(expanded)); ui.shelfExpand.textContent = expanded ? "Show fewer books" : "Show all books";
  const scrollable = !expanded && ui.books.scrollWidth > ui.books.clientWidth + 2;
  ui.shelfPrevious.disabled = !scrollable || ui.books.scrollLeft <= 2; ui.shelfNext.disabled = !scrollable || ui.books.scrollLeft + ui.books.clientWidth >= ui.books.scrollWidth - 2;
}
function moveShelf(direction) { const card = ui.books.querySelector(".book-card"); const distance = card ? card.getBoundingClientRect().width + 12 : ui.books.clientWidth * .8; ui.books.scrollBy({ left: direction * distance * 2, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
function toggleShelfLayout() { ui.books.classList.toggle("is-expanded"); sessionStorage.setItem("becShelfExpanded", String(ui.books.classList.contains("is-expanded"))); ui.books.scrollTo({ left: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); updateShelfNavigation(); }
function visibleBooks() {
  const term = state.search.toLowerCase();
  return recentFirst(state.books).filter((book) => (!state.genre || genreParts(book).some((genre) => genre.toLocaleLowerCase() === state.genre)) && (!term || [book.title, book.author, book.genre, book.name, book.memberName].some((value) => String(value || "").toLowerCase().includes(term))));
}
function pickRandomBook() {
  const unique = visibleBooks().filter((book, index, books) => books.findIndex((candidate) => sameBook(candidate, book)) === index);
  if (!unique.length) { toast("No books match the current shelf filters yet."); return; }
  const choices = unique.length > 1 ? unique.filter((book) => book.id !== state.lastRandomBookId) : unique;
  const book = choices[Math.floor(Math.random() * choices.length)];
  state.lastRandomBookId = book.id; state.randomPickerActive = true;
  openBookDetails(book);
}
function renderBooks() {
  const scrollLeft = ui.books.scrollLeft;
  ui.books.removeAttribute("aria-busy");
  ui.books.classList.toggle("is-expanded", sessionStorage.getItem("becShelfExpanded") === "true");
  ui.search.value = state.search;
  const allGenres = [...new Set(state.books.flatMap(genreParts).map((genre) => genre.toLocaleLowerCase()))].sort();
  state.genre = allGenres.includes(state.genre.toLocaleLowerCase()) ? state.genre.toLocaleLowerCase() : "";
  const selected = state.genre; ui.genre.innerHTML = '<option value="">All genres</option>' + allGenres.map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join(""); ui.genre.value = selected;
  const books = visibleBooks();
  ui.shelfResultStatus.textContent = `${books.length} book${books.length === 1 ? "" : "s"} shown.`;
  ui.books.innerHTML = books.length ? books.map((book) => `<button type="button" class="book-card" data-book-id="${escapeHtml(book.id)}" aria-label="Open ${escapeHtml(book.title)}">${coverMarkup(book)}<span class="shelf-book-copy"><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author || "Unknown author")}</small></span></button>`).join("") : `<p class="empty-state">${state.books.length ? "No books match that search." : "The shelf is ready for its first recommendation."}</p>`;
  ui.monthPicker.innerHTML = '<option value="">Choose a book</option>' + recentFirst(state.books).map((book) => `<option value="${escapeHtml(book.id)}" ${book.id === state.currentPickId ? "selected" : ""}>${escapeHtml(book.title)} — ${escapeHtml(book.author)}</option>`).join("");
  renderMonth(); requestAnimationFrame(() => { if (!ui.books.classList.contains("is-expanded")) ui.books.scrollLeft = Math.min(scrollLeft, Math.max(0, ui.books.scrollWidth - ui.books.clientWidth)); updateShelfNavigation(); });
}

function renderPending() {
  ui.pendingCount.textContent = String(state.pendingBooks.length);
  ui.pendingList.innerHTML = state.pendingBooks.length ? recentFirst(state.pendingBooks).map((book) => {
    const duplicate = state.books.some((item) => sameBook(item, book));
    return `<article class="pending-item"><div><p class="eyebrow">${duplicate ? "ALREADY ON THE CLUB SHELF" : "NEW GUEST SUGGESTION"}</p><h3>${escapeHtml(book.title || "Untitled book")}</h3><p>by ${escapeHtml(book.author || "Unknown author")}${book.genre ? ` · ${escapeHtml(book.genre)}` : ""}</p>${book.why ? `<blockquote>${escapeHtml(book.why)}</blockquote>` : ""}<small>Suggested by ${escapeHtml(book.name || "a guest reader")}</small></div><div class="pending-actions"><button type="button" class="button" data-approve-pending="${escapeHtml(book.id)}">${duplicate ? "Add note to existing book" : "Approve"}</button><button type="button" class="text-button" data-reject-pending="${escapeHtml(book.id)}">Reject</button></div></article>`;
  }).join("") : '<p class="empty-state">The guest suggestion queue is clear.</p>';
}
function syncPendingSubscription() {
  if (!isOfficer()) {
    state.stopPending?.(); state.stopPending = null; state.pendingBooks = []; renderPending(); return;
  }
  if (state.stopPending) return;
  state.stopPending = onSnapshot(collection(db, "pendingBooks"), (snapshot) => { state.pendingBooks = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); renderPending(); }, (error) => { console.error(error); ui.pendingList.innerHTML = '<p class="empty-state">The review queue could not load. Check the published rules.</p>'; });
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
        await addDoc(collection(db, "books"), withPageCount({ name: pending.name || "Guest reader", memberName: pending.name || "Guest reader", title: pending.title || "Untitled book", author: pending.author || "Unknown author", genre: pending.genre || "", coverUrl: pending.coverUrl || "", why: pending.why || "", synopsis: pending.synopsis || "", catalogKey: pending.catalogKey || "", catalogId: pending.catalogId || "", openLibraryKey: pending.openLibraryKey || "", googleBooksId: pending.googleBooksId || "", isbn: pending.isbn || "", publicationYear: String(pending.publicationYear || ""), source: pending.source || "", date: pending.date || new Date().toISOString(), comments: [] }, pending.pageCount));
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
  const preview = reason || book.synopsis || "Read along at your own pace, then join the conversation.";
  const story = `<div class="month-description"><strong>${reason ? `Recommended by ${escapeHtml(recommender)}` : "About this month’s pick"}</strong><p>${escapeHtml(String(preview).length > 240 ? String(preview).slice(0, 237) + "…" : preview)}</p></div>`;
  ui.month.innerHTML = `<div class="month-cover">${coverMarkup(book, "", "eager")}</div><div><p class="eyebrow">BOOK OF THE MONTH</p><h3>${escapeHtml(book.title)}</h3><p>by ${escapeHtml(book.author)}</p>${story}<button type="button" class="button month-details" data-book-id="${escapeHtml(book.id)}">View book &amp; discussion</button></div>`;
  ui.monthCommunity.hidden = false;
  ui.monthForm.hidden = !isMember(); ui.monthMessage.hidden = !isMember();
  const count = state.ratings.length, finished = state.ratings.filter((item) => item.finished).length;
  const average = state.ratings.length ? (state.ratings.reduce((sum, item) => sum + Number(item.stars || 0), 0) / state.ratings.length).toFixed(1) : "";
  ui.monthRating.textContent = average ? `★ ${average}/5 · ${count} ${count === 1 ? "rating" : "ratings"}` : "No ratings yet";
  ui.monthProgress.textContent = count ? `${finished} of ${count} responding readers finished` : "No reading updates yet";
  const mine = state.ratings.find((item) => item.memberId === state.user?.uid);
  if (mine) { ui.monthStars.value = String(mine.stars || 5); ui.monthFinished.checked = Boolean(mine.finished); ui.monthComment.value = mine.comment || ""; }
  else { ui.monthStars.value = "5"; ui.monthFinished.checked = false; ui.monthComment.value = ""; }
  ui.monthNotes.innerHTML = state.ratings.filter((item) => item.comment).length ? state.ratings.filter((item) => item.comment).map((item) => `<article class="month-note"><strong>${escapeHtml(item.displayName || "Club member")}</strong><span>${"★".repeat(Number(item.stars || 0))}</span><p>${escapeHtml(item.comment)}</p></article>`).join("") : '<p class="empty-state">No discussion notes yet. Be the first to leave one.</p>';
}
function subscribeRatings() { state.stopRatings?.(); state.ratings = []; state.dashboardRatings = []; const book = currentBook(); if (!book) { renderDashboard(); return renderMonth(); } state.stopRatings = onSnapshot(collection(db, "bookOfMonthRatings", book.id, "members"), (snapshot) => { state.ratings = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); state.dashboardRatings = isMember() ? state.ratings.filter((rating) => rating.memberId === state.user.uid).map((rating) => ({ ...rating, bookId: book.id })) : []; renderMonth(); renderDashboard(); }, () => { ui.monthNotes.innerHTML = '<p class="empty-state">Ratings are unavailable right now.</p>'; state.dashboardRatings = []; renderDashboard(); }); }
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

function catalogCover(book, className) { return automaticCoverUrl(book) ? coverImageMarkup(book, 240) : `<span class="${className}">${escapeHtml(book.title)}</span>`; }
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
    ui.catalogPreviewBook.innerHTML = `<div class="catalog-preview-book">${catalogCover(book, "catalog-preview-cover")}<div><p class="eyebrow">${escapeHtml(book.source || "BOOK CATALOGUE")}</p><h3>${escapeHtml(book.title)}</h3><p>by ${escapeHtml(book.author)}</p><p class="catalog-meta">${book.publicationYear ? `First published ${escapeHtml(book.publicationYear)}` : "Publication date unavailable"}${book.isbn ? ` · ISBN ${escapeHtml(book.isbn)}` : ""}${pageCountValue(book.pageCount) ? ` · ${pageCountValue(book.pageCount).toLocaleString()} pages` : ""}</p>${book.synopsis ? `<p>${escapeHtml(book.synopsis)}</p>` : '<p class="catalog-meta">No synopsis is available for this edition.</p>'}</div></div>`;
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
    if (!shelf.empty) return { ...shelf.docs[0].data(), id: shelf.docs[0].id };
  }
  const legacy = await getDocs(collection(db, "memberShelves", state.user.uid, "entries"));
  return legacy.docs.map((entry) => ({ ...entry.data(), id: entry.id })).find((entry) => sameBook(entry, book)) || null;
}
async function saveCatalogShelfBook(book, status) {
  const existing = await existingShelfEntry(book); const key = `${existing?.id || "new"}:${status}`;
  if (existing && existing.status === status) { ui.catalogMessage.textContent = `This book is already on your ${String(status).replace(/-/g, " ")} shelf.`; return false; }
  if (existing && state.catalogDuplicateConfirmation !== key) { state.catalogDuplicateConfirmation = key; ui.catalogMessage.textContent = `This book is already on your ${String(existing.status || "reading").replace(/-/g, " ")} shelf. Press the button again to move it.`; return false; }
  const metadata = withPageCount({ title: book.title, author: book.author, genre: ui.catalogGenre.value.trim() || existing?.genre || "", coverUrl: book.coverUrl || existing?.coverUrl || "", catalogKey: book.catalogKey || "", catalogId: book.catalogId || "", openLibraryKey: book.openLibraryKey || "", googleBooksId: book.googleBooksId || "", isbn: book.isbn || "", publicationYear: String(book.publicationYear || ""), synopsis: book.synopsis || "", source: book.source || "", status, note: ui.catalogShelfNote.value.trim() || existing?.note || "", date: existing?.date || new Date().toISOString() }, book.pageCount || existing?.pageCount);
  if (status === "read") metadata.completedAt = serverTimestamp();
  if (existing) {
    await setDoc(doc(db, "memberShelves", state.user.uid, "entries", existing.id), metadata, { merge: true });
    await recordActivity(activityTypeForStatus(status), metadata, { shelfEntryId: existing.id, key: `${existing.id}_${status}` });
    ui.catalogMessage.textContent = "Moved your existing shelf entry."; toast("Your shelf is keeping up with your reading life.");
  } else {
    const added = await addDoc(collection(db, "memberShelves", state.user.uid, "entries"), metadata);
    await recordActivity(activityTypeForStatus(status), metadata, { shelfEntryId: added.id, key: `${added.id}_${status}` });
    const message = shelfAddedMessage(); ui.catalogMessage.textContent = message; toast(message);
  }
  return true;
}
async function findBookConnections(book) {
  const publicMatches = state.books.filter((item) => sameBook(item, book));
  const names = new Map(); let onOwnShelf = false;
  publicMatches.forEach((item) => { const name = item.memberName || item.name; if (name) names.set(item.memberId || `name:${name}`, name); });
  try {
    const personalShelves = book.catalogKey ? await getDocs(query(collectionGroup(db, "entries"), where("catalogKey", "==", book.catalogKey), limit(30))) : await getDocs(query(collection(db, "memberShelves", state.user.uid, "entries"), limit(100)));
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
  const recommendation = withPageCount({ title: book.title, author: book.author, genre: ui.catalogGenre.value.trim(), coverUrl: book.coverUrl || "", synopsis: book.synopsis || "", why: ui.catalogReason.value.trim(), memberId: state.user.uid, memberName: state.profile.displayName || "Club member", catalogKey: book.catalogKey || "", catalogId: book.catalogId || "", openLibraryKey: book.openLibraryKey || "", googleBooksId: book.googleBooksId || "", isbn: book.isbn || "", publicationYear: String(book.publicationYear || ""), source: book.source || "Book catalogue", date: new Date().toISOString(), comments: [] }, book.pageCount);
  const added = await addDoc(collection(db, "books"), recommendation);
  await recordActivity("recommended_book", recommendation, { publicBookId: added.id, key: added.id });
  const reaction = connectionMessage(names, onOwnShelf);
  ui.catalogMessage.textContent = reaction; toast(reaction);
  return true;
}
async function saveGuestCatalogSuggestion(book) {
  const name = ui.catalogGuestName.value.trim();
  if (!name) { ui.catalogMessage.textContent = "Please add your name before sending this suggestion."; ui.catalogGuestName.focus(); return false; }
  const publicMatch = state.books.find((item) => sameBook(item, book));
  await addDoc(collection(db, "pendingBooks"), withPageCount({
    name, title: book.title || "Untitled book", author: book.author || "Unknown author", genre: ui.catalogGenre.value.trim(), coverUrl: book.coverUrl || "", why: ui.catalogReason.value.trim(), synopsis: book.synopsis || "", catalogKey: book.catalogKey || "", catalogId: book.catalogId || "", openLibraryKey: book.openLibraryKey || "", googleBooksId: book.googleBooksId || "", isbn: book.isbn || "", publicationYear: String(book.publicationYear || ""), source: book.source || "Book catalogue", date: new Date().toISOString(), comments: [], submittedAt: new Date().toISOString(), status: "pending"
  }, book.pageCount));
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
    const phaseOneDefaults = {
      favoriteBookIds: Array.isArray(profile.favoriteBookIds) ? profile.favoriteBookIds.slice(0, 3) : [],
      shareActivity: typeof profile.shareActivity === "boolean" ? profile.shareActivity : false,
      showReadingStats: typeof profile.showReadingStats === "boolean" ? profile.showReadingStats : true
    };
    if (["member", "officer"].includes(profile.role)) {
      if (!Array.isArray(profile.favoriteBookIds) || typeof profile.shareActivity !== "boolean" || typeof profile.showReadingStats !== "boolean") await setDoc(ref, phaseOneDefaults, { merge: true });
      return { ...profile, ...phaseOneDefaults };
    }
    // Older library cards did not have a role. Complete that one-time migration
    // using the signed-in owner's existing public-card values, never Google data.
    const migrated = { displayName: profile.displayName || "Club member", photoURL: profile.photoURL || "", joinedAt: profile.joinedAt || new Date().toISOString(), role: "member", bio: profile.bio || "", themeColor: profile.themeColor || "", clubTitle: "", favoriteGenre: profile.favoriteGenre || "", currentlyReading: profile.currentlyReading || "", ...phaseOneDefaults };
    await setDoc(ref, migrated, { merge: true });
    return { ...profile, ...migrated };
  }
  const profile = { displayName: "Club member", photoURL: "", joinedAt: new Date().toISOString(), role: "member", bio: "", themeColor: "", clubTitle: "", favoriteGenre: "", currentlyReading: "", favoriteBookIds: [], shareActivity: false, showReadingStats: true };
  await setDoc(ref, profile);
  try { await setDoc(doc(db, "memberPrivate", user.uid), { email: String(user.email || "") }); }
  catch (error) { console.warn("Private member mapping could not be saved:", error); }
  return profile;
}
onAuthStateChanged(auth, async (user) => {
  if (state.user?.uid !== user?.uid) {
    state.stopNotifications?.(); state.stopNotifications = null; state.notifications = [];
    state.stopEventRsvps?.(); state.stopEventRsvps = null; state.eventRsvpOwnerId = null; state.eventRsvps = new Map();
    state.stopDashboardShelf?.(); state.stopDashboardShelf = null; state.stopDashboardRatings?.(); state.stopDashboardRatings = null; state.dashboardOwnerId = null; state.dashboardShelfEntries = []; state.dashboardRatings = []; state.dashboardLoaded = false; state.dashboardRatingsLoaded = false; state.dashboardRatingsUnavailable = false;
  }
  state.user = user; state.profile = null;
  if (!user) return setAuthUi();
  try { state.profile = await ensureProfile(user); if (!isMember()) toast("Your member record needs an officer to restore its role."); }
  catch (error) { console.error("Member setup:", error); await signOut(auth); toast(error.code === "permission-denied" ? "This Google account is not on the invited member list." : "Could not finish member sign-in."); }
  setAuthUi();
});

async function submitSuggestion(event) {
  event.preventDefault(); const chosenFile = $("suggestFile")?.files?.[0]; const book = withPageCount({ name: $("suggestName").value.trim(), title: $("suggestTitle").value.trim(), author: $("suggestAuthor").value.trim(), genre: $("suggestGenre").value.trim(), coverUrl: $("suggestCover").value.trim(), why: $("suggestWhy").value.trim(), date: new Date().toISOString(), comments: [] }, $("suggestPages")?.value);
  if (!book.name || !book.title || !book.author) return;
  const button = ui.suggestionForm.querySelector("button[type=submit]"); button.disabled = true;
  try {
    if (chosenFile) { ui.suggestionMessage.textContent = "Uploading cover…"; book.coverUrl = await uploadImage(chosenFile); }
    if (isMember()) {
      const { publicMatches, names, onOwnShelf } = await findBookConnections(book);
      if (publicMatches.some((item) => item.memberId === state.user.uid)) { ui.suggestionMessage.textContent = "You already recommended this book, so another copy was not added."; return; }
      const recommendation = { ...book, memberId: state.user.uid, memberName: state.profile.displayName };
      const added = await addDoc(collection(db, "books"), recommendation);
      await recordActivity("recommended_book", recommendation, { publicBookId: added.id, key: added.id });
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
    try {
      const previous = state.ratings.find((item) => item.memberId === state.user.uid);
      const update = { memberId: state.user.uid, displayName: state.profile.displayName, stars: Number(ui.monthStars.value), finished: ui.monthFinished.checked, comment: ui.monthComment.value.trim(), updatedAt: new Date().toISOString() };
      if (previous && Number(previous.stars) === update.stars && Boolean(previous.finished) === update.finished && String(previous.comment || "") === update.comment) { ui.monthMessage.textContent = "Nothing changed — your last update is already saved."; return; }
      await setDoc(doc(db, "bookOfMonthRatings", book.id, "members", state.user.uid), update);
      const type = update.finished && !previous?.finished ? "finished_book" : update.comment && update.comment !== String(previous?.comment || "") ? "discussed_book" : "rated_book";
      await recordActivity(type, book, { publicBookId: book.id, stars: update.stars, key: `month_${book.id}_${type}` });
      ui.monthMessage.textContent = "Your update is saved.";
    }
    catch (error) { console.error(error); ui.monthMessage.textContent = "Could not save your update."; }
  });
}
async function saveMonth() {
  if (!isOfficer() || !ui.monthPicker.value) return;
  const nextBookId = ui.monthPicker.value, changedBook = nextBookId !== state.currentPickId;
  await runBusy(ui.saveMonth, "Saving…", async () => {
    try { await setDoc(doc(db, "siteSettings", "currentPick"), { bookId: nextBookId, highlightColor: $("monthAccent")?.value || state.monthAccent, updatedAt: new Date().toISOString() }, { merge: true }); if (changedBook) await publishClubNotifications("book_of_month_changed", { bookId: nextBookId }); toast("Book of the Month updated."); }
    catch (error) { console.error(error); toast("Could not set the Book of the Month."); }
  });
}

async function saveAnnouncement(event) {
  event.preventDefault(); if (!isOfficer()) return;
  const nextAnnouncement = ui.announcementInput.value.trim(), changedAnnouncement = nextAnnouncement !== state.announcement;
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Saving…", async () => {
    try { await setDoc(doc(db, "siteSettings", "announcement"), { text: nextAnnouncement, updatedAt: new Date().toISOString() }); if (changedAnnouncement && nextAnnouncement) await publishClubNotifications("announcement_updated"); ui.announcementStatus.textContent = "Announcement saved for everyone."; }
    catch (error) { console.error(error); ui.announcementStatus.textContent = "Could not save the announcement."; }
  });
}

function eventDateLabel(value) {
  const date = new Date(`${value || ""}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? "Date to be announced" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}
function eventCounts(event) {
  return {
    going: Math.max(0, Number(event.rsvpGoing || 0)),
    maybe: Math.max(0, Number(event.rsvpMaybe || 0)),
    cant_attend: Math.max(0, Number(event.rsvpCantAttend || 0))
  };
}
function linkedEventMemories(eventId) { return state.memories.filter((memory) => memory.eventId === eventId); }
function eventMemoryStrip(eventId) {
  const memories = linkedEventMemories(eventId); if (!memories.length) return "";
  const visible = recentFirst(memories).slice(0, 5);
  return `<div class="event-memories" aria-label="${memories.length} linked reading ${memories.length === 1 ? "memory" : "memories"}">${visible.map((memory) => `<button type="button" class="event-memory" data-memory-focus="${escapeHtml(memory.id)}" aria-label="View memory: ${escapeHtml(memory.title || "Club memory")}"><img src="${escapeHtml(optimizedImageUrl(memory.imageUrl, 240))}" alt="" loading="lazy" decoding="async" width="152" height="116"></button>`).join("")}${memories.length > visible.length ? `<span class="event-memory-count">+${memories.length - visible.length} more</span>` : ""}</div>`;
}
function eventRsvpMarkup(event, past) {
  const counts = eventCounts(event), mine = state.eventRsvps.get(event.id)?.status || "", busy = state.rsvpBusy.has(event.id);
  const countChips = `<div class="rsvp-counts" aria-label="Anonymous attendance totals"><span class="rsvp-count is-going">Going <strong>${counts.going}</strong></span><span class="rsvp-count is-maybe">Maybe <strong>${counts.maybe}</strong></span><span class="rsvp-count is-declined">Can’t go <strong>${counts.cant_attend}</strong></span></div>`;
  let picker = '<p class="form-message">Invited members can RSVP after signing in.</p>';
  if (past) picker = '<p class="form-message">RSVPs are closed for this past event.</p>';
  else if (isMember()) picker = `<div class="rsvp-picker" aria-label="Your RSVP"><button type="button" class="rsvp-option${mine === "going" ? " is-selected" : ""}" data-rsvp-event="${escapeHtml(event.id)}" data-rsvp-status="going" data-rsvp="going" aria-pressed="${String(mine === "going")}" ${busy ? "disabled" : ""}>✓ Going</button><button type="button" class="rsvp-option${mine === "maybe" ? " is-selected" : ""}" data-rsvp-event="${escapeHtml(event.id)}" data-rsvp-status="maybe" data-rsvp="maybe" aria-pressed="${String(mine === "maybe")}" ${busy ? "disabled" : ""}>? Maybe</button><button type="button" class="rsvp-option${mine === "cant_attend" ? " is-selected" : ""}" data-rsvp-event="${escapeHtml(event.id)}" data-rsvp-status="cant_attend" data-rsvp="declined" aria-pressed="${String(mine === "cant_attend")}" ${busy ? "disabled" : ""}>× Can’t go</button></div>`;
  return `<div class="event-rsvp"><div class="event-rsvp-header"><span class="event-rsvp-title">Attendance</span>${countChips}</div>${picker}</div>`;
}
function eventCard(event, past) {
  const memories = linkedEventMemories(event.id), counts = eventCounts(event), responseTotal = counts.going + counts.maybe + counts.cant_attend;
  const historyLocked = memories.length > 0 || responseTotal > 0;
  const officerAction = isOfficer() ? (historyLocked ? '<span class="form-message">Kept in club history</span>' : `<button class="text-button" type="button" data-remove-event="${escapeHtml(event.id)}">Remove event</button>`) : "";
  return `<article id="event-${escapeHtml(event.id)}" class="event"><time datetime="${escapeHtml(event.date || "")}">${escapeHtml(eventDateLabel(event.date))}</time><div><h3>${escapeHtml(event.title)}</h3>${event.details ? `<p>${escapeHtml(event.details)}</p>` : ""}</div>${eventRsvpMarkup(event, past)}${eventMemoryStrip(event.id)}${officerAction}</article>`;
}
function renderEvents() {
  const archiveOpen = ui.events.querySelector(".event-archive")?.open;
  if (!state.events.length) { ui.events.innerHTML = '<p class="empty-state">No events have been added yet.</p>'; return; }
  const today = localDateKey(), upcoming = [...state.events].filter((event) => String(event.date || "") >= today).sort((a, b) => String(a.date).localeCompare(String(b.date))), past = [...state.events].filter((event) => String(event.date || "") < today).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const group = (title, items, isPast) => `<section class="event-group${isPast ? " is-past" : ""}"><header class="event-group-header"><h3 class="event-group-title">${title}</h3><span class="event-group-count">${items.length} ${items.length === 1 ? "event" : "events"}</span></header><div class="event-group-list">${items.length ? items.map((event) => eventCard(event, isPast)).join("") : `<p class="empty-state">${isPast ? "Past club days will collect here." : "Nothing is scheduled yet."}</p>`}</div></section>`;
  ui.events.innerHTML = `<div class="event-groups">${group("Coming up", upcoming, false)}${past.length ? `<details class="event-archive" ${archiveOpen ? "open" : ""}><summary>Past events (${past.length})</summary>${group("From the club archive", past, true)}</details>` : ""}</div>`;
}
async function saveEventRsvp(eventId, status) {
  if (!isMember() || !["going", "maybe", "cant_attend"].includes(status) || state.rsvpBusy.has(eventId)) return;
  const event = state.events.find((item) => item.id === eventId); if (!event || String(event.date || "") < localDateKey()) return;
  const previousRsvp = state.eventRsvps.get(eventId), previousCounts = eventCounts(event);
  if (previousRsvp?.status === status) { toast("That is already your RSVP for this event."); return; }
  const optimisticCounts = { ...previousCounts };
  if (previousRsvp?.status) optimisticCounts[previousRsvp.status] = Math.max(0, optimisticCounts[previousRsvp.status] - 1);
  optimisticCounts[status] += 1;
  state.eventRsvps.set(eventId, { memberId: state.user.uid, eventId, status, updatedAt: new Date() });
  event.rsvpGoing = optimisticCounts.going; event.rsvpMaybe = optimisticCounts.maybe; event.rsvpCantAttend = optimisticCounts.cant_attend; state.rsvpBusy.add(eventId); renderEvents();
  try {
    await runTransaction(db, async (transaction) => {
      const eventRef = doc(db, "events", eventId), responseRef = doc(db, "members", state.user.uid, "eventRsvps", eventId);
      const [eventSnapshot, responseSnapshot] = await Promise.all([transaction.get(eventRef), transaction.get(responseRef)]);
      if (!eventSnapshot.exists()) throw new Error("This event is no longer available.");
      const savedEvent = eventSnapshot.data(), savedPrevious = responseSnapshot.data()?.status || "", next = eventCounts(savedEvent);
      if (savedPrevious === status) return;
      if (savedPrevious) {
        if (next[savedPrevious] < 1) throw new Error("The attendance total needs an officer to repair it before this RSVP can change.");
        next[savedPrevious] -= 1;
      }
      next[status] += 1;
      transaction.update(eventRef, { rsvpGoing: next.going, rsvpMaybe: next.maybe, rsvpCantAttend: next.cant_attend });
      transaction.set(responseRef, { memberId: state.user.uid, eventId, status, updatedAt: serverTimestamp() });
    });
    toast(status === "going" ? "See you there — RSVP saved!" : status === "maybe" ? "Maybe noted. You can update it anytime before the event." : "Thanks for letting the club know.");
  } catch (error) {
    console.error(error); if (previousRsvp) state.eventRsvps.set(eventId, previousRsvp); else state.eventRsvps.delete(eventId);
    event.rsvpGoing = previousCounts.going; event.rsvpMaybe = previousCounts.maybe; event.rsvpCantAttend = previousCounts.cant_attend; toast(error.message || "Could not save that RSVP.");
  } finally { state.rsvpBusy.delete(eventId); renderEvents(); }
}
async function addEvent(event) {
  event.preventDefault(); if (!isOfficer()) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Adding…", async () => {
    try { const added = await addDoc(collection(db, "events"), { title: ui.eventTitle.value.trim(), date: ui.eventDate.value, details: ui.eventDetails.value.trim(), createdAt: new Date().toISOString(), rsvpGoing: 0, rsvpMaybe: 0, rsvpCantAttend: 0 }); await publishClubNotifications("event_added", { eventId: added.id }); ui.eventForm.reset(); toast("Event added."); }
    catch (error) { console.error(error); toast("Could not add the event."); }
  });
}
function renderMemoryOptions() {
  if (!ui.memoryEvent || !ui.memoryBook) return;
  const selectedEvent = ui.memoryEvent.value || state.memories.find((memory) => memory.id === state.memoryEditingId)?.eventId || "";
  const selectedBook = ui.memoryBook.value || state.memories.find((memory) => memory.id === state.memoryEditingId)?.bookId || "";
  const events = [...state.events].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  ui.memoryEvent.innerHTML = '<option value="">No event selected</option>' + events.map((event) => `<option value="${escapeHtml(event.id)}">${escapeHtml(eventDateLabel(event.date))} — ${escapeHtml(event.title)}</option>`).join("");
  ui.memoryBook.innerHTML = '<option value="">No book selected</option>' + [...state.books].sort((a, b) => String(a.title).localeCompare(String(b.title))).map((book) => `<option value="${escapeHtml(book.id)}">${escapeHtml(book.title)} — ${escapeHtml(book.author || "Unknown author")}</option>`).join("");
  if (selectedEvent && !events.some((event) => event.id === selectedEvent)) ui.memoryEvent.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(selectedEvent)}">Unavailable event — keep saved link</option>`);
  if (selectedBook && !state.books.some((book) => book.id === selectedBook)) ui.memoryBook.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(selectedBook)}">Unavailable book — keep saved link</option>`);
  ui.memoryEvent.value = selectedEvent; ui.memoryBook.value = selectedBook;
}
function memoryAssociationMarkup(memory) {
  const event = state.events.find((item) => item.id === memory.eventId), book = state.books.find((item) => item.id === memory.bookId);
  const eventTitle = memory.eventId ? (event?.title || memory.eventTitleSnapshot || "") : "", bookTitle = memory.bookId ? (book?.title || memory.bookTitleSnapshot || "") : "";
  return `${eventTitle ? `<button type="button" class="memory-link" data-event-jump="${escapeHtml(memory.eventId || "")}">Event: ${escapeHtml(eventTitle)}</button>` : ""}${bookTitle ? (book ? `<button type="button" class="memory-link" data-book-id="${escapeHtml(book.id)}">Book: ${escapeHtml(bookTitle)}</button>` : `<span class="memory-association">Book: ${escapeHtml(bookTitle)}</span>`) : ""}`;
}
function renderMemories() {
  ui.memories.innerHTML = state.memories.length ? recentFirst(state.memories).map((memory) => `<article id="memory-${escapeHtml(memory.id)}" class="memory"><img src="${escapeHtml(optimizedImageUrl(memory.imageUrl, 800))}" alt="${escapeHtml(memory.title)}" loading="lazy" decoding="async" width="800" height="540"><div><small>${escapeHtml(memory.category || "Club memory")}</small><h3>${escapeHtml(memory.title)}</h3>${memoryAssociationMarkup(memory)}</div>${isOfficer() ? `<div class="memory-link-controls"><button type="button" data-edit-memory="${escapeHtml(memory.id)}">Edit</button></div><button class="remove-button" type="button" data-remove-memory="${escapeHtml(memory.id)}" aria-label="Remove memory">×</button>` : ""}</article>`).join("") : '<p class="empty-state">The club’s first reading memory will appear here soon.</p>';
  renderEvents();
}
function resetMemoryEditor() {
  state.memoryEditingId = null; ui.memoryEditId.value = ""; ui.memoryForm.reset(); ui.memorySave.textContent = "Add memory"; ui.memoryCancelEdit.hidden = true; ui.memoryStatus.textContent = ""; renderMemoryOptions();
}
function editMemory(memoryId) {
  if (!isOfficer()) return; const memory = state.memories.find((item) => item.id === memoryId); if (!memory) return;
  state.memoryEditingId = memoryId; ui.memoryEditId.value = memoryId; ui.memoryImage.value = memory.imageUrl || ""; ui.memoryCaption.value = memory.title || ""; ui.memoryCategory.value = memory.category || ""; renderMemoryOptions(); ui.memoryEvent.value = memory.eventId || ""; ui.memoryBook.value = memory.bookId || ""; ui.memorySave.textContent = "Save changes"; ui.memoryCancelEdit.hidden = false; ui.memoryStatus.textContent = "Editing this memory. Leave the image fields unchanged to keep its current photo."; ui.memoryForm.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); ui.memoryCaption.focus();
}
async function addMemory(event) {
  event.preventDefault(); if (!isOfficer()) return;
  await runBusy(ui.memorySave, state.memoryEditingId ? "Saving…" : "Adding…", async () => {
    try {
      const existing = state.memories.find((memory) => memory.id === state.memoryEditingId), file = ui.memoryFile.files?.[0];
      const imageUrl = file ? await uploadImage(file) : (ui.memoryImage.value.trim() || existing?.imageUrl || "");
      if (!imageUrl) throw new Error("Add an image URL or choose a photo.");
      const linkedEvent = state.events.find((item) => item.id === ui.memoryEvent.value), linkedBook = state.books.find((item) => item.id === ui.memoryBook.value);
      const payload = { imageUrl, title: ui.memoryCaption.value.trim(), category: ui.memoryCategory.value.trim(), date: existing?.date || new Date().toISOString(), eventId: ui.memoryEvent.value, bookId: ui.memoryBook.value, eventTitleSnapshot: linkedEvent?.title || (ui.memoryEvent.value ? existing?.eventTitleSnapshot || "" : ""), eventDateSnapshot: linkedEvent?.date || (ui.memoryEvent.value ? existing?.eventDateSnapshot || "" : ""), bookTitleSnapshot: linkedBook?.title || (ui.memoryBook.value ? existing?.bookTitleSnapshot || "" : ""), bookAuthorSnapshot: linkedBook?.author || (ui.memoryBook.value ? existing?.bookAuthorSnapshot || "" : ""), updatedAt: serverTimestamp() };
      if (existing) await setDoc(doc(db, "memories", existing.id), payload, { merge: true }); else await addDoc(collection(db, "memories"), payload);
      const changed = Boolean(existing); resetMemoryEditor(); toast(changed ? "Reading memory updated." : "Reading memory added.");
    } catch (error) { console.error(error); ui.memoryStatus.textContent = error.message || "Could not save the memory."; }
  });
}
async function addInvite(event) { event.preventDefault(); if (!isOfficer()) return; const email = ui.inviteEmail.value.trim().toLowerCase(); if (!email) return; const button = event.currentTarget.querySelector("button[type=submit]"); await runBusy(button, "Approving…", async () => { try { await setDoc(doc(db, "allowedEmails", email), { email, invitedAt: new Date().toISOString() }); ui.inviteForm.reset(); toast("That email can now create a member library."); } catch (error) { console.error(error); toast("Could not approve that email."); } }); }

function renderBoard() {
  ui.pinBoard.innerHTML = state.boardPosts.length ? recentFirst(state.boardPosts).map((post) => `<article class="pin-note"><span class="pin-avatar">${escapeHtml(initials(post.displayName))}</span><p>${escapeHtml(post.text)}</p><footer><span>${escapeHtml(post.displayName || "Club member")} · ${escapeHtml(dateTimeLabel(post.date))}</span>${isOfficer() ? `<button type="button" class="text-button" data-remove-pin="${escapeHtml(post.id)}">Remove</button>` : ""}</footer></article>`).join("") : '<p class="empty-state">Nothing pinned yet. The board is ready for its first note.</p>';
}
async function postBoard(event) {
  event.preventDefault(); if (!isMember()) return;
  const text = ui.boardText.value.trim(); if (!text) return;
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  await runBusy(button, "Pinning…", async () => {
    let saved = false;
    try { await addDoc(collection(db, "boardPosts"), { text, memberId: state.user.uid, displayName: state.profile.displayName || "Club member", photoURL: state.profile.photoURL || "", date: new Date().toISOString() }); saved = true; if (form.isConnected) form.reset(); ui.boardStatus.textContent = "Pinned for the club."; }
    catch (error) { console.error(error); ui.boardStatus.textContent = saved ? "Your note was saved. Reopen the page to refresh the board." : "Could not pin that note."; }
  });
}

function renderMembers() {
  ui.members.removeAttribute("aria-busy");
  ui.members.innerHTML = state.members.length ? state.members.map((member) => {
    const label = member.clubTitle || (member.role === "officer" ? "Officer" : "Member");
    const avatar = member.photoURL ? `<img src="${escapeHtml(optimizedImageUrl(member.photoURL, 192))}" alt="Portrait of ${escapeHtml(member.displayName || "club member")}" loading="lazy" decoding="async" width="96" height="96">` : escapeHtml(initials(member.displayName));
    return `<button type="button" class="member-card" data-member-id="${escapeHtml(member.id)}" style="--accent:${color(member.themeColor)}"><span class="member-avatar">${avatar}</span><span><strong>${escapeHtml(member.displayName || "Club member")}</strong><small>${escapeHtml(label)}</small></span></button>`;
  }).join("") : '<p class="empty-state">Member libraries will appear here.</p>';
}
async function openProfile(uid) {
  state.stopShelf?.();
  state.stopShelf = null;
  state.stopProfileActivity?.();
  state.stopProfileActivity = null; state.profileActivities = [];
  state.openProfileId = uid;
  state.openProfileMember = null;
  ui.profileContent.innerHTML = '<div class="skeleton skeleton-profile" aria-hidden="true"></div><p class="visually-hidden" role="status">Opening this member library…</p>';
  if (!ui.profileDialog.open) showDialog(ui.profileDialog);
  try {
    const snapshot = await getDoc(doc(db, "members", uid));
    if (!snapshot.exists()) throw new Error("That member library is unavailable.");
    const member = snapshot.data(), own = state.user?.uid === uid, accent = color(member.themeColor);
    state.openProfileMember = { ...member, id: uid };
    ui.profileDialog.setAttribute("aria-label", `${member.displayName || "Club member"}’s member library`);
    const avatar = member.photoURL ? `<img src="${escapeHtml(optimizedImageUrl(member.photoURL, 360))}" alt="Portrait of ${escapeHtml(member.displayName || "club member")}" decoding="async" width="180" height="180">` : escapeHtml(initials(member.displayName));
    const shelfForm = own && isMember() ? `<button id="shelfFormToggle" type="button" class="text-button shelf-form-toggle" aria-expanded="false" aria-controls="shelfForm">Add a book</button><form id="shelfForm" class="add-shelf-form" hidden><h4>Add to my shelf</h4><button id="openCatalogFromShelf" type="button" class="text-button">Find a book automatically</button><label>Book title <input id="shelfTitle" maxlength="160" required></label><label>Author <input id="shelfAuthor" maxlength="100" required></label><label>Genre <input id="shelfGenre" maxlength="80" placeholder="Optional"></label><label>Page count <input id="shelfPages" type="number" min="1" max="10000" inputmode="numeric" placeholder="Optional"></label><label>Cover image URL <input id="shelfCover" type="url" maxlength="500" placeholder="Optional"></label><label>Upload a cover <input id="shelfFile" type="file" accept="image/*"></label><label>Reading status <select id="shelfStatus"><option value="reading">Reading</option><option value="read">Read</option><option value="want-to-read">Want to read</option></select></label><label>A small note <textarea id="shelfNote" maxlength="280" placeholder="Optional"></textarea></label><button class="button" type="submit">Add book</button></form>` : "";
    const customize = own && isMember() ? `<details class="profile-customize"><summary>Customize my library card</summary><form id="profileForm"><label>Display name <input id="profileNameInput" maxlength="60" value="${escapeHtml(member.displayName || "")}"></label><label>Short bio <textarea id="profileBioInput" maxlength="80">${escapeHtml(member.bio || "")}</textarea></label><label>Library colour <input id="profileColorInput" type="color" value="${accent}"></label><label>Public avatar URL <input id="profilePhotoInput" type="url" maxlength="500" value="${escapeHtml(member.photoURL || "")}" placeholder="Optional image link"></label><label>Or upload an avatar <input id="profilePhotoFile" type="file" accept="image/*"></label><label>Favourite genre <input id="profileGenreInput" maxlength="40" value="${escapeHtml(member.favoriteGenre || "")}" placeholder="e.g. Fantasy"></label><label>Currently reading <input id="profileCurrentInput" maxlength="100" value="${escapeHtml(member.currentlyReading || "")}" placeholder="A book you are into right now"></label><label class="checkbox-line"><input id="profileShowStats" type="checkbox" ${member.showReadingStats !== false ? "checked" : ""}> Show my reading summary to visitors</label><label class="checkbox-line"><input id="profileShareActivity" type="checkbox" ${member.shareActivity === true ? "checked" : ""}> Share meaningful reading activity</label><p class="activity-privacy-note">This shares book titles and actions such as started, finished, rated, or discussed. It never shares your email, notes, or comment text.</p>${isOfficer() ? `<label>Club role label <select id="profileTitleInput"><option value="Officer" ${member.clubTitle !== "President" ? "selected" : ""}>Officer</option><option value="President" ${member.clubTitle === "President" ? "selected" : ""}>President</option></select></label>` : ""}<button type="submit" class="text-button">Save library card</button></form></details>` : "";
    ui.profileContent.innerHTML = `<div class="profile-layout" style="--accent:${accent}"><aside class="profile-side"><div class="profile-avatar">${avatar}</div><h2>${escapeHtml(member.displayName || "Club member")}</h2><p>${escapeHtml(member.bio || "A reader in the Book Enthusiasts Club.")}</p><p>Member since ${escapeHtml(dateLabel(String(member.joinedAt || "").slice(0, 10)))}</p><div class="profile-meta">${member.clubTitle ? `<span>${escapeHtml(member.clubTitle)}</span>` : ""}${member.favoriteGenre ? `<span>Usually reading ${escapeHtml(member.favoriteGenre)}</span>` : ""}${member.currentlyReading ? `<span>Currently: ${escapeHtml(member.currentlyReading)}</span>` : ""}</div>${customize}</aside><section class="profile-library"><p class="eyebrow">PERSONAL LIBRARY</p><h3>${own ? "My shelf" : `${escapeHtml(member.displayName || "Their")}’s shelf`}</h3><div id="libraryStats" class="library-stats"><span class="skeleton skeleton-pill" aria-hidden="true"></span><span class="skeleton skeleton-pill" aria-hidden="true"></span></div><div id="readingSnapshot" class="profile-reading-summary" aria-live="polite"><span class="skeleton skeleton-stat" aria-hidden="true"></span><span class="skeleton skeleton-stat" aria-hidden="true"></span></div><section class="profile-favorites"><div class="profile-section-heading"><h4>Top 3 favorites</h4><p>${own ? "Open a shelf book to pin or unpin it." : "A small peek at their all-time picks."}</p></div><div id="favoriteBooks" class="favorite-books" aria-busy="true"><span class="skeleton skeleton-cover" aria-hidden="true"></span><span class="skeleton skeleton-cover" aria-hidden="true"></span><span class="skeleton skeleton-cover" aria-hidden="true"></span></div></section><div id="personalBooks" class="personal-books" aria-busy="true"><span class="skeleton skeleton-cover" aria-hidden="true"></span><span class="skeleton skeleton-cover" aria-hidden="true"></span><span class="skeleton skeleton-cover" aria-hidden="true"></span></div>${shelfForm}<section class="profile-activity"><h4>Recent reading activity</h4><div id="memberActivityList" aria-busy="true"><div class="skeleton skeleton-activity" aria-hidden="true"></div></div></section></section></div>`;
    $("profileForm")?.addEventListener("submit", saveProfileCard);
    $("shelfForm")?.addEventListener("submit", addShelfBook);
    $("openCatalogFromShelf")?.addEventListener("click", () => openCatalog("shelf"));
    $("shelfFormToggle")?.addEventListener("click", (event) => { const form = $("shelfForm"), open = form.hidden; form.hidden = !open; event.currentTarget.setAttribute("aria-expanded", String(open)); event.currentTarget.textContent = open ? "Hide add-book form" : "Add a book"; });
    state.stopShelf?.();
    state.stopShelf = onSnapshot(collection(db, "memberShelves", uid, "entries"), (shelf) => renderShelf(shelf.docs.map((entry) => ({ ...entry.data(), id: entry.id }))), () => { $("personalBooks").innerHTML = '<p class="empty-state">This library is unavailable right now. Check your connection and try reopening it.</p>'; });
    if (member.shareActivity === true) state.stopProfileActivity = onSnapshot(query(collection(db, "activities"), where("actorId", "==", uid), limit(30)), (activity) => { state.profileActivities = newestActivities(activity.docs.map((entry) => ({ ...entry.data(), id: entry.id }))).slice(0, 10); renderMemberActivity(); }, () => { const target = $("memberActivityList"); if (target) { target.removeAttribute("aria-busy"); target.innerHTML = '<p class="empty-state">Public activity is unavailable right now.</p>'; } });
    else renderMemberActivity();
  } catch (error) {
    console.error(error);
    ui.profileContent.innerHTML = `<p class="empty-state profile-error">${escapeHtml(error.message || "That member library could not open.")}</p>`;
  }
}
async function saveProfileCard(event) {
  event.preventDefault();
  if (!isMember() || state.openProfileId !== state.user?.uid) return;
  const nextShareActivity = Boolean($("profileShareActivity")?.checked);
  const disablingActivity = state.profile?.shareActivity === true && !nextShareActivity;
  if (disablingActivity && !window.confirm("Turn off activity sharing and remove your existing public activity history? Your shelf, ratings, and comments will stay intact.")) return;
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
        currentlyReading: $("profileCurrentInput")?.value.trim() || "",
        shareActivity: nextShareActivity,
        showReadingStats: Boolean($("profileShowStats")?.checked)
      };
      if (isOfficer()) updates.clubTitle = $("profileTitleInput")?.value || "Officer";
      if (disablingActivity) await clearOwnActivityHistory();
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
function legacyCommentId(comment, index) {
  const seed = `${comment?.name || ""}|${comment?.text || ""}|${comment?.date || ""}|${index}`;
  let hash = 2166136261;
  for (let position = 0; position < seed.length; position += 1) hash = Math.imul(hash ^ seed.charCodeAt(position), 16777619);
  return `legacy_${index}_${(hash >>> 0).toString(36)}`;
}
function normalizeLegacyComments(comments = []) {
  return (Array.isArray(comments) ? comments : []).filter((comment) => comment && typeof comment === "object" && typeof comment.text === "string").map((comment, index) => {
    const id = legacyCommentId(comment, index);
    return { id, memberId: "", name: comment.name || "Club member", text: comment.text || "", createdAt: comment.date || "", parentId: "", rootId: id, spoiler: false, spoilerScope: "", legacy: true };
  });
}
function combinedBookComments() {
  return [...state.legacyBookComments, ...state.bookComments];
}
function orderedBookComments(comments) {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const roots = comments.filter((comment) => !comment.parentId || !byId.has(comment.rootId)).sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt));
  const included = new Set(); const result = [];
  roots.forEach((root) => {
    result.push(root); included.add(root.id);
    comments.filter((comment) => comment.id !== root.id && comment.rootId === root.id).sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt)).forEach((reply) => { result.push(reply); included.add(reply.id); });
  });
  comments.filter((comment) => !included.has(comment.id)).sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt)).forEach((comment) => result.push(comment));
  return result;
}
function renderCommentList(comments = []) {
  if (!comments.length) return '<p class="empty-state">No discussion notes yet. A member can start the conversation.</p>';
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  return orderedBookComments(comments).map((comment) => {
    const parent = byId.get(comment.parentId), isReply = Boolean(comment.parentId);
    const replyLabel = isReply ? `<span class="comment-thread">Replying to ${escapeHtml(parent?.name || "an earlier note")}</span>` : "";
    const content = comment.spoiler ? `<details class="spoiler-panel"><summary>Reveal spoiler${comment.spoilerScope ? ` · ${escapeHtml(comment.spoilerScope)}` : ""}</summary><p class="spoiler-text">${escapeHtml(comment.text)}</p></details>` : `<p class="comment-content">${escapeHtml(comment.text)}</p>`;
    const replyAction = isMember() && !comment.legacy ? `<button type="button" class="text-button" data-reply-comment="${escapeHtml(comment.id)}">Reply</button>` : "";
    return `<article class="book-comment${isReply ? " is-reply" : ""}" data-comment-id="${escapeHtml(comment.id)}"><span class="comment-avatar">${escapeHtml(initials(comment.name))}</span><div><header class="comment-header"><strong>${escapeHtml(comment.name || "Club member")}</strong><time datetime="${escapeHtml(dateTimeAttribute(comment.createdAt))}">${escapeHtml(dateTimeLabel(comment.createdAt))}</time></header>${replyLabel}${content}${replyAction ? `<div class="comment-actions">${replyAction}</div>` : ""}</div></article>`;
  }).join("");
}
function renderBookComments() {
  const target = $("bookCommentList"); if (!target) return;
  target.removeAttribute("aria-busy"); target.innerHTML = renderCommentList(combinedBookComments());
}
function subscribeBookComments(bookId) {
  state.stopBookComments?.(); state.stopBookComments = null; state.bookComments = []; renderBookComments();
  const target = $("bookCommentList"); target?.setAttribute("aria-busy", "true");
  state.stopBookComments = onSnapshot(query(collection(db, "books", bookId, "comments"), orderBy("createdAt", "desc"), limit(80)), (snapshot) => {
    if (state.activeBookId !== bookId) return;
    state.bookComments = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id, legacy: false })); renderBookComments();
  }, (error) => {
    console.warn("Book discussion replies unavailable:", error); target?.removeAttribute("aria-busy");
    const status = $("bookCommentMessage"); if (status) status.textContent = "Older notes are still visible, but new discussion replies could not load.";
  });
}
function renderReplyContext() {
  const context = $("bookReplyContext"), label = $("bookReplyLabel"); if (!context || !label) return;
  context.hidden = !state.replyTarget;
  label.textContent = state.replyTarget ? `Replying to ${state.replyTarget.name || "a club member"}` : "";
  const formLabel = $("bookCommentFormLabel"); if (formLabel) formLabel.textContent = state.replyTarget ? "Write a reply" : "Add a note";
}
function setReplyTarget(commentId) {
  const target = state.bookComments.find((comment) => comment.id === commentId); if (!target) return;
  state.replyTarget = target; renderReplyContext(); $("bookCommentText")?.focus();
}
function clearReplyTarget() { state.replyTarget = null; renderReplyContext(); }
function updateSpoilerScopeVisibility() {
  const enabled = Boolean($("bookCommentSpoiler")?.checked), label = $("bookSpoilerScopeLabel");
  if (label) label.hidden = !enabled;
  if (!enabled && $("bookSpoilerScope")) $("bookSpoilerScope").value = "";
}
function renderBookReactions() {
  const summary = $("reactionSummary"), picker = $("reactionPicker"), status = $("reactionStatus"); if (!summary || !picker) return;
  const counts = new Map(); state.bookReactions.forEach((item) => counts.set(item.reaction, (counts.get(item.reaction) || 0) + 1));
  const active = REACTION_OPTIONS.filter(([code]) => counts.has(code));
  summary.innerHTML = active.length ? active.map(([code, emoji, label]) => `<span class="reaction-summary-chip"><span aria-hidden="true">${emoji}</span>${escapeHtml(label)} <strong>${counts.get(code)}</strong></span>`).join("") : '<p class="empty-state">No reactions yet. Members can add the first one.</p>';
  const mine = state.bookReactions.find((item) => item.memberId === state.user?.uid)?.reaction || "";
  picker.innerHTML = isMember() ? REACTION_OPTIONS.map(([code, emoji, label]) => `<button type="button" class="reaction-chip${mine === code ? " is-selected" : ""}" data-book-reaction="${code}" aria-pressed="${String(mine === code)}" ${state.reactionBusy ? "disabled" : ""}><span aria-hidden="true">${emoji}</span>${escapeHtml(label)}</button>`).join("") : '<p class="form-message">Sign in with an invited member account to add a reaction.</p>';
  if (status && !state.reactionBusy && !status.dataset.keepMessage) status.textContent = !isMember() ? "" : mine ? "Your reaction is visible in the total." : "Choose one reaction that fits this book.";
}
function subscribeBookReactions(bookId) {
  state.stopBookReactions?.(); state.stopBookReactions = null; state.reactionBookId = bookId; state.bookReactions = []; renderBookReactions();
  state.stopBookReactions = onSnapshot(query(collection(db, "books", bookId, "reactions"), limit(100)), (snapshot) => {
    if (state.reactionBookId !== bookId) return;
    state.bookReactions = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); renderBookReactions();
  }, (error) => { console.warn("Book reactions unavailable:", error); const status = $("reactionStatus"); if (status) { status.dataset.keepMessage = "true"; status.textContent = "Reactions could not load, but the rest of the book details still work."; } });
}
async function toggleBookReaction(reaction) {
  if (!isMember() || state.reactionBusy || !state.reactionBookId || !REACTION_OPTIONS.some(([code]) => code === reaction)) return;
  const bookId = state.reactionBookId;
  const previous = state.bookReactions.map((item) => ({ ...item })), mine = state.bookReactions.find((item) => item.memberId === state.user.uid), removing = mine?.reaction === reaction;
  state.reactionBusy = true;
  state.bookReactions = state.bookReactions.filter((item) => item.memberId !== state.user.uid);
  if (!removing) state.bookReactions.push({ id: state.user.uid, memberId: state.user.uid, reaction, updatedAt: new Date() });
  renderBookReactions();
  const status = $("reactionStatus"); if (status) { delete status.dataset.keepMessage; status.textContent = removing ? "Removing your reaction…" : "Saving your reaction…"; }
  try {
    const ref = doc(db, "books", bookId, "reactions", state.user.uid);
    if (removing) await deleteDoc(ref); else await setDoc(ref, { memberId: state.user.uid, reaction, updatedAt: serverTimestamp() });
    if (state.reactionBookId === bookId && status) status.textContent = removing ? "Reaction removed." : "Reaction saved for the club.";
  } catch (error) {
    console.error(error);
    if (state.reactionBookId === bookId) { state.bookReactions = previous; if (status) { status.dataset.keepMessage = "true"; status.textContent = "Could not save that reaction. Check your connection and try again."; } }
  } finally { if (state.reactionBookId === bookId) { state.reactionBusy = false; renderBookReactions(); } }
}
function stopBookSocialSubscriptions() {
  state.stopBookComments?.(); state.stopBookComments = null; state.stopBookReactions?.(); state.stopBookReactions = null;
  state.activeBookId = null; state.reactionBookId = null; state.legacyBookComments = []; state.bookComments = []; state.bookReactions = []; state.replyTarget = null; state.reactionBusy = false;
}
function renderShelf(entries) {
  const stats = $("libraryStats"), shelf = $("personalBooks"), snapshot = $("readingSnapshot"), favorites = $("favoriteBooks");
  if (!stats || !shelf) return;
  const reading = entries.filter((entry) => entry.status === "reading").length, read = entries.filter((entry) => entry.status === "read").length, wanted = entries.filter((entry) => entry.status === "want-to-read").length;
  const own = state.openProfileId === state.user?.uid, member = state.openProfileMember || {}, preferredIds = (own ? state.profile?.favoriteBookIds : member.favoriteBookIds) || [];
  const genreCounts = entries.reduce((counts, entry) => { const genre = String(entry.genre || "").trim(); if (genre) counts.set(genre, (counts.get(genre) || 0) + 1); return counts; }, new Map());
  const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "Still exploring";
  state.shelfEntries = entries;
  const finishedWithPages = entries.filter((entry) => entry.status === "read" && pageCountValue(entry.pageCount));
  const knownPages = finishedWithPages.reduce((sum, entry) => sum + pageCountValue(entry.pageCount), 0);
  stats.innerHTML = `<span>${entries.length} ${entries.length === 1 ? "book" : "books"} on shelf</span>`;
  if (snapshot) snapshot.innerHTML = own || member.showReadingStats !== false ? `<article class="reading-summary-card"><strong>${entries.length}</strong><span>books collected</span></article><article class="reading-summary-card"><strong>${read}</strong><span>finished</span></article><article class="reading-summary-card"><strong>${reading}</strong><span>currently reading</span></article><article class="reading-summary-card"><strong>${wanted}</strong><span>want to read</span></article><article class="reading-summary-card"><strong>${escapeHtml(topGenre)}</strong><span>most-shelved genre</span></article>${knownPages ? `<article class="reading-summary-card"><strong>${knownPages.toLocaleString()}</strong><span>${finishedWithPages.length === read ? "pages finished" : `known pages across ${finishedWithPages.length} finished books`}</span></article>` : ""}` : '<p class="empty-state">This member keeps their reading summary private.</p>';
  if (favorites) {
    const favoriteEntries = preferredIds.map((id) => entries.find((entry) => entry.id === id)).filter(Boolean).slice(0, 3);
    favorites.removeAttribute("aria-busy");
    favorites.closest(".profile-favorites").hidden = !own && !favoriteEntries.length;
    favorites.innerHTML = favoriteEntries.length ? favoriteEntries.map((entry, index) => `<article class="favorite-book"><button type="button" class="favorite-book-open" data-shelf-book-id="${escapeHtml(entry.id)}"><span class="favorite-cover">${automaticCoverUrl(entry) ? coverImageMarkup(entry, 320) : `<span class="personal-fallback">${escapeHtml(entry.title)}</span>`}</span><span class="favorite-title">${escapeHtml(entry.title)}</span><span class="favorite-position">Favorite ${index + 1}</span></button></article>`).join("") : `<p class="empty-state">${own ? "No favorites pinned yet. Open one of your shelf books to add it to your Top 3." : "No favorite books shared yet."}</p>`;
  }
  shelf.removeAttribute("aria-busy");
  shelf.innerHTML = entries.length ? recentFirst(entries).map((entry) => `<article class="personal-book"><button type="button" class="personal-cover-button" data-shelf-book-id="${escapeHtml(entry.id)}" aria-label="Open ${escapeHtml(entry.title)}">${automaticCoverUrl(entry) ? coverImageMarkup(entry, 480) : `<span class="personal-fallback">${escapeHtml(entry.title)}</span>`}</button><div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.author)}</small><span class="status">${escapeHtml(String(entry.status || "reading").replace(/-/g, " "))}</span></div></article>`).join("") : '<p class="empty-state">This little library is waiting for its first book.</p>';
}

async function toggleFavorite(entryId) {
  if (!isMember() || state.openProfileId !== state.user?.uid) return;
  const current = Array.isArray(state.profile?.favoriteBookIds) ? [...state.profile.favoriteBookIds] : [], active = current.includes(entryId);
  if (!active && current.length >= 3) { toast("Your Top 3 is full. Unpin another favorite first."); return; }
  const next = active ? current.filter((id) => id !== entryId) : [...current, entryId];
  try {
    await updateDoc(doc(db, "members", state.user.uid), { favoriteBookIds: next });
    state.profile = { ...state.profile, favoriteBookIds: next };
    state.openProfileMember = { ...state.openProfileMember, favoriteBookIds: next };
    const member = state.members.find((item) => item.id === state.user.uid); if (member) member.favoriteBookIds = next;
    renderShelf(state.shelfEntries);
    const button = $("favoriteToggle"); if (button) { button.setAttribute("aria-pressed", String(!active)); button.classList.toggle("is-favorite", !active); button.textContent = active ? "Add to my Top 3" : "Remove from my Top 3"; }
    toast(active ? "Removed from your Top 3." : "Pinned to your Top 3 favorites.");
  } catch (error) { console.error(error); toast("Could not update your favorites."); }
}

async function addClubBookToShelf(event, book) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = form.querySelector('[role="status"]');
  if (button.disabled) return;
  if (!isMember()) {
    message.textContent = "Sign in with your approved member account, then add this book.";
    if (!state.user) ui.signIn.click();
    return;
  }
  const uid = state.user.uid;
  const status = form.querySelector('select').value;
  if (!["reading", "read", "want-to-read"].includes(status)) return;
  button.disabled = true;
  message.textContent = "Adding to your shelf…";
  try {
    const entries = await getDocs(collection(db, "memberShelves", uid, "entries"));
    if (!isMember() || state.user?.uid !== uid) throw new Error("Your session changed. Reopen this book and try again.");
    const existing = entries.docs.find((entry) => sameBook(entry.data(), book));
    if (existing) {
      message.textContent = `Already on your ${String(existing.data().status || "reading").replace(/-/g, " ")} shelf. You can edit it in My library.`;
      return;
    }
    const text = (value, max) => String(value || "").trim().slice(0, max);
    const entry = withPageCount({
      title: text(book.title, 160) || "Untitled book", author: text(book.author, 100) || "Unknown author",
      coverUrl: text(automaticCoverUrl(book), 500), genre: text(book.genre, 80),
      synopsis: text(book.synopsis, 3000), catalogKey: text(book.catalogKey, 200),
      catalogId: text(book.catalogId, 200), openLibraryKey: text(book.openLibraryKey, 200),
      googleBooksId: text(book.googleBooksId, 200), isbn: text(book.isbn, 20),
      publicationYear: text(book.publicationYear, 20), source: text(book.source, 100),
      status, note: "", date: new Date().toISOString()
    }, book.pageCount);
    if (status === "read") entry.completedAt = serverTimestamp();
    // A stable destination plus a transaction prevents two tabs adding this club book twice.
    const ref = doc(db, "memberShelves", uid, "entries", `club_${book.id}`);
    const added = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!isMember() || state.user?.uid !== uid) throw new Error("Your session changed. Reopen this book and try again.");
      if (snapshot.exists()) return false;
      transaction.set(ref, entry);
      return true;
    });
    message.textContent = added ? `Added to your ${status.replace(/-/g, " ")} shelf. Find it in My library.` : "This book is already in My library. Your existing entry was kept.";
    if (added) {
      toast("Added to your shelf.");
      if (state.user?.uid === uid) await recordActivity(activityTypeForStatus(status), entry, { shelfEntryId: ref.id, publicBookId: book.id, key: `${ref.id}_${status}` });
    }
  } catch (error) {
    console.error(error);
    message.textContent = error.code === "permission-denied" ? "Could not add this book. Check that your member account still has access, then try again." : "Could not add this book. Check your connection and signed-in account, then try again.";
  } finally {
    button.disabled = false;
  }
}

function openBookDetails(book, personal = false) {
  stopBookSocialSubscriptions();
  const title = book.title || "Untitled book";
  ui.bookDialog.setAttribute("aria-label", `Book details: ${title}`);
  const about = book.synopsis || "";
  const canEditShelf = personal && isMember() && state.user?.uid === state.openProfileId;
  const canEditPublic = !personal && isOfficer();
  const isFavorite = canEditShelf && (state.profile?.favoriteBookIds || []).includes(book.id);
  const shelfEditor = canEditShelf ? `<button id="favoriteToggle" type="button" class="favorite-toggle${isFavorite ? " is-favorite" : ""}" aria-pressed="${String(isFavorite)}">${isFavorite ? "Remove from my Top 3" : "Add to my Top 3"}</button><form id="detailShelfStatusForm" class="book-status-form"><label>Move this book to <select id="detailShelfStatus">${shelfStatusOptions(book.status || "reading")}</select></label><button class="button" type="submit">Update status</button><button id="removeShelfBook" class="text-button danger-button" type="button">Remove from my shelf</button><p id="bookDetailMessage" class="form-message" aria-live="polite"></p></form>` : "";
  const publicEditor = canEditPublic ? `<form id="bookEditForm" class="book-edit-form"><h3>Officer book details</h3><label>Title <input id="bookEditTitle" maxlength="160" value="${escapeHtml(title)}" required></label><label>Author <input id="bookEditAuthor" maxlength="100" value="${escapeHtml(book.author || "")}" required></label><label>Genre <input id="bookEditGenre" maxlength="80" value="${escapeHtml(book.genre || "")}"></label><label>Page count <input id="bookEditPages" type="number" min="1" max="10000" inputmode="numeric" value="${pageCountValue(book.pageCount) || ""}" placeholder="Optional"></label><label>Cover URL <input id="bookEditCover" type="url" maxlength="500" value="${escapeHtml(book.coverUrl || "")}"></label><label>Or upload a cover <input id="bookEditCoverFile" type="file" accept="image/*"></label><label>About the book <textarea id="bookEditSynopsis" maxlength="3000">${escapeHtml(about)}</textarea></label><button class="button" type="submit">Save book details</button><p id="bookEditMessage" class="form-message" aria-live="polite"></p></form>` : "";
  const personalDetails = `<p><strong>${escapeHtml(String(book.status || "reading").replace(/-/g, " "))}</strong>${pageCountValue(book.pageCount) ? ` · ${pageCountValue(book.pageCount).toLocaleString()} pages` : ""}</p>${book.note ? `<p><strong>Reader’s note</strong><br>${escapeHtml(book.note)}</p>` : ""}${about ? `<p><strong>About the book</strong><br>${escapeHtml(about)}</p>` : ""}${shelfEditor}`;
  if (!personal) { state.activeBookId = book.id; state.legacyBookComments = normalizeLegacyComments(book.comments || []); }
  const reactions = `<section class="book-reactions" aria-labelledby="reactionHeading"><div><h3 id="reactionHeading">Quick reactions</h3><p>A small pulse-check from club readers. Each member gets one reaction per book.</p></div><div id="reactionSummary" class="reaction-summary" aria-live="polite"><p class="empty-state">Loading reactions…</p></div><div id="reactionPicker" class="reaction-picker"></div><p id="reactionStatus" class="form-message" aria-live="polite"></p></section>`;
  const discussion = `<section class="book-discussion" aria-labelledby="bookDiscussionHeading"><h3 id="bookDiscussionHeading">Club discussion</h3><p class="catalog-meta">Leave a note, reply to another reader, or tuck spoilers safely behind a warning.</p><div id="bookCommentList" class="book-comment-list">${renderCommentList(state.legacyBookComments)}</div>${isMember() ? '<form id="bookCommentForm" class="book-comment-form"><div id="bookReplyContext" class="reply-context" hidden><span id="bookReplyLabel"></span><button type="button" class="text-button" data-cancel-reply>Cancel reply</button></div><label id="bookCommentFormLabel" for="bookCommentText">Add a note</label><textarea id="bookCommentText" maxlength="500" placeholder="A thought, question, or reaction…" required></textarea><div class="comment-options"><label class="spoiler-toggle"><input id="bookCommentSpoiler" type="checkbox"> Hide this note as a spoiler</label><label id="bookSpoilerScopeLabel" hidden>Spoiler label (optional)<input id="bookSpoilerScope" maxlength="80" placeholder="For example: ending or chapter 12"></label></div><button class="button" type="submit">Post note</button><p id="bookCommentMessage" class="form-message" aria-live="polite"></p></form>' : '<p class="form-message">Invited members can read everything here, then join the discussion after signing in.</p>'}</section>`;
  const reroll = !personal && state.randomPickerActive ? '<button type="button" class="button button-quiet surprise-again" data-surprise-again>🎲 Pick another book</button>' : "";
  const addToShelf = `<form id="clubShelfForm" class="club-shelf-form"><label>Add to my shelf<select aria-label="Choose my shelf">${shelfStatusOptions("want-to-read")}</select></label><button class="button" type="submit">${isMember() ? "Add to my shelf" : "Sign in to add"}</button><p class="form-message" role="status" aria-live="polite"></p></form>`;
  const publicDetails = `${addToShelf}${reroll}${pageCountValue(book.pageCount) ? `<p class="catalog-meta">${pageCountValue(book.pageCount).toLocaleString()} pages in this edition</p>` : ""}${about ? `<p><strong>About the book</strong><br>${escapeHtml(about)}</p>` : ""}${book.why ? `<p><strong>Why this member recommends it</strong><br>${escapeHtml(book.why)}</p>` : '<div id="legacyRecommendation"></div>'}${book.memberName || book.name ? `<p class="book-recommender">Recommended by ${escapeHtml(book.memberName || book.name)}</p>` : ""}${book.memberId ? `<button type="button" class="text-button recommender-link" data-member-id="${escapeHtml(book.memberId)}">View this reader’s library</button>` : ""}${publicEditor}`;
  ui.bookContent.innerHTML = `<div class="book-detail"><div class="book-detail-cover">${coverMarkup({ ...book, title })}</div><div><p class="eyebrow">${personal ? "FROM A MEMBER LIBRARY" : "FROM THE MEMBER BOOKSHELF"}</p><h2>${escapeHtml(title)}</h2><p class="book-byline">by ${escapeHtml(book.author || "Unknown author")}</p>${book.genre ? `<span class="book-tag">${escapeHtml(book.genre)}</span>` : ""}${personal ? personalDetails : publicDetails}</div>${personal ? "" : `<div class="book-conversation">${reactions}${discussion}</div>`}</div>`;
  if (!ui.bookDialog.open) showDialog(ui.bookDialog);
  $("clubShelfForm")?.addEventListener("submit", (event) => addClubBookToShelf(event, book));
  $("detailShelfStatusForm")?.addEventListener("submit", (event) => updateShelfStatus(event, book.id));
  $("favoriteToggle")?.addEventListener("click", () => toggleFavorite(book.id));
  $("removeShelfBook")?.addEventListener("click", () => removeShelfBook(book.id, title));
  $("bookCommentForm")?.addEventListener("submit", (event) => postBookComment(event, book.id));
  $("bookCommentSpoiler")?.addEventListener("change", updateSpoilerScopeVisibility);
  $("bookEditForm")?.addEventListener("submit", (event) => saveBookMetadata(event, book.id));
  if (!personal) { subscribeBookComments(book.id); subscribeBookReactions(book.id); }
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
  try {
    const favoriteIds = Array.isArray(state.profile?.favoriteBookIds) ? state.profile.favoriteBookIds : [];
    if (favoriteIds.includes(entryId)) {
      const next = favoriteIds.filter((id) => id !== entryId), batch = writeBatch(db);
      batch.delete(doc(db, "memberShelves", state.openProfileId, "entries", entryId));
      batch.update(doc(db, "members", state.user.uid), { favoriteBookIds: next });
      await batch.commit(); state.profile = { ...state.profile, favoriteBookIds: next }; state.openProfileMember = { ...state.openProfileMember, favoriteBookIds: next };
    } else await deleteDoc(doc(db, "memberShelves", state.openProfileId, "entries", entryId));
    closeDialog(ui.bookDialog); toast("Removed from your personal shelf.");
  }
  catch (error) { console.error(error); $("bookDetailMessage").textContent = "Could not remove this book."; }
}

async function postBookComment(event, bookId) {
  event.preventDefault();
  if (!isMember() || state.activeBookId !== bookId) return;
  const text = $("bookCommentText")?.value.trim();
  if (!text) return;
  const parent = state.replyTarget && state.bookComments.find((comment) => comment.id === state.replyTarget.id);
  const spoiler = Boolean($("bookCommentSpoiler")?.checked), spoilerScope = spoiler ? ($("bookSpoilerScope")?.value.trim() || "").slice(0, 80) : "";
  const signature = `${bookId}|${parent?.id || "root"}|${text}|${spoiler}|${spoilerScope}`;
  if (state.lastCommentPost?.signature === signature && Date.now() - state.lastCommentPost.time < 8000) { $("bookCommentMessage").textContent = "That note was already posted a moment ago."; return; }
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  await runBusy(button, "Posting…", async () => {
    let saved = false;
    try {
      const book = state.books.find((item) => item.id === bookId);
      if (!book) throw new Error("This book is no longer available.");
      const commentRef = doc(collection(db, "books", bookId, "comments"));
      const comment = { memberId: state.user.uid, name: state.profile.displayName || "Club member", text, createdAt: serverTimestamp(), parentId: parent?.id || "", rootId: parent ? (parent.rootId || parent.id) : commentRef.id, spoiler, spoilerScope };
      await setDoc(commentRef, comment);
      saved = true;
      state.lastCommentPost = { signature, time: Date.now() };
      await recordActivity(parent ? "replied_to_comment" : "discussed_book", book, { publicBookId: bookId, key: commentRef.id });
      if (parent) await createReplyNotification(book, parent, commentRef.id);
      if (state.activeBookId === bookId && $("bookCommentForm") === form) {
        form.reset(); clearReplyTarget(); updateSpoilerScopeVisibility();
        $("bookCommentMessage").textContent = parent ? "Your reply is part of the conversation." : "Your note is part of the club discussion.";
      }
    } catch (error) {
      console.error(error);
      if (state.activeBookId === bookId && $("bookCommentForm") === form && $("bookCommentMessage")) $("bookCommentMessage").textContent = saved ? "Your note was saved. Reopen the discussion to refresh it." : error.message === "This book is no longer available." ? error.message : "Could not post your note. Check your connection and try again.";
    }
  });
}

async function updateShelfStatus(event, entryId) {
  event.preventDefault();
  if (!isMember() || state.openProfileId !== state.user?.uid) return;
  const status = $("detailShelfStatus")?.value;
  const entry = state.shelfEntries.find((item) => item.id === entryId);
  if (!status || !entry) return;
  if (entry.status === status) { $("bookDetailMessage").textContent = "That book is already in this reading section."; return; }
  const button = event.currentTarget.querySelector("button[type=submit]");
  await runBusy(button, "Updating…", async () => {
    try {
      const updates = {
        title: entry.title || "Untitled book",
        author: entry.author || "Unknown author",
        coverUrl: entry.coverUrl || "",
        status,
        note: entry.note || "",
        date: entry.date || new Date().toISOString()
      };
      if (status === "read") updates.completedAt = serverTimestamp();
      await setDoc(doc(db, "memberShelves", state.openProfileId, "entries", entryId), updates, { merge: true });
      await recordActivity(activityTypeForStatus(status), { ...entry, status }, { shelfEntryId: entryId, key: `${entryId}_${status}` });
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
      await setDoc(doc(db, "books", bookId), withPageCount({
        title: $("bookEditTitle").value.trim(),
        author: $("bookEditAuthor").value.trim(),
        genre: $("bookEditGenre").value.trim(),
        coverUrl: coverFile ? await uploadImage(coverFile) : $("bookEditCover").value.trim(),
        synopsis: $("bookEditSynopsis").value.trim()
      }, $("bookEditPages")?.value), { merge: true });
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
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  await runBusy(button, "Adding…", async () => {
    let saved = false;
    try {
      const candidate = { title: $("shelfTitle").value.trim(), author: $("shelfAuthor").value.trim() };
      const existing = await existingShelfEntry(candidate);
      if (existing) { toast(`“${candidate.title}” is already on your personal shelf. Open its cover to change the reading status.`); return; }
      const file = $("shelfFile")?.files?.[0];
      const coverUrl = $("shelfCover").value.trim() || (file ? await uploadImage(file) : "");
      const status = $("shelfStatus").value;
      const shelfBook = withPageCount({
        title: candidate.title,
        author: candidate.author,
        genre: $("shelfGenre").value.trim(),
        coverUrl,
        status,
        note: $("shelfNote").value.trim(),
        date: new Date().toISOString()
      }, $("shelfPages")?.value);
      if (status === "read") shelfBook.completedAt = serverTimestamp();
      const added = await addDoc(collection(db, "memberShelves", state.openProfileId, "entries"), shelfBook);
      saved = true;
      await recordActivity(activityTypeForStatus(status), shelfBook, { shelfEntryId: added.id, key: `${added.id}_${status}` });
      if (form.isConnected) form.reset();
      toast(shelfAddedMessage());
    } catch (error) {
      console.error(error);
      toast(saved ? "Your book was saved. Reopen your library to refresh it." : (error.message || "Could not add that book."));
    }
  });
}

onSnapshot(collection(db, "books"), (snapshot) => { state.books = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); renderBooks(); renderNotifications(); renderMemoryOptions(); renderMemories(); renderDashboard(); renderDiscovery(); subscribeRatings(); subscribeMonthRecommendation(); }, () => { ui.books.removeAttribute("aria-busy"); ui.books.innerHTML = '<p class="empty-state">The bookshelf is unavailable right now.</p>'; });
onSnapshot(collection(db, "members"), (snapshot) => { state.members = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); renderMembers(); renderMonth(); renderNotifications(); renderDashboard(); if (state.activityLoaded) renderActivityFeed(); }, () => { ui.members.removeAttribute("aria-busy"); ui.members.innerHTML = '<p class="empty-state">Member libraries are unavailable right now.</p>'; });
onSnapshot(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(20)), (snapshot) => { state.activities = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); state.activityLoaded = true; renderActivityFeed(); renderDiscovery(); }, (error) => { console.warn("Activity feed unavailable:", error); state.activityLoaded = true; ui.activityFeed.removeAttribute("aria-busy"); ui.activityFeed.innerHTML = '<p class="empty-state">Recent club activity could not load. The rest of the site is still available.</p>'; ui.activityStatus.textContent = "Recent club activity could not load."; renderDiscovery(); });
onSnapshot(doc(db, "siteSettings", "currentPick"), (snapshot) => { const pick = snapshot.data() || {}; state.currentPickId = pick.bookId || null; state.monthAccent = /^#[0-9a-f]{6}$/i.test(pick.highlightColor || "") ? pick.highlightColor : "#d8e66f"; if ($("monthAccent")) $("monthAccent").value = state.monthAccent; renderBooks(); subscribeRatings(); subscribeMonthRecommendation(); }, () => { toast("Book of the Month could not load."); });
onSnapshot(doc(db, "siteSettings", "announcement"), (snapshot) => { state.announcement = snapshot.data()?.text || ""; ui.announcementText.textContent = state.announcement || "No announcement yet—check back after the next library meeting."; if (isOfficer()) ui.announcementInput.value = state.announcement; }, () => { ui.announcementText.textContent = "The club announcement could not load right now."; });
onSnapshot(doc(db, "siteSettings", "readingGoal"), (snapshot) => { state.readingGoal = snapshot.exists() ? snapshot.data() : null; syncGoalProgressSubscription(); renderReadingGoal(); }, (error) => { console.warn("Reading goal unavailable:", error); ui.readingGoalTotal.textContent = "Reading goal unavailable"; ui.readingGoalContent.innerHTML = '<p class="empty-state">The shared goal could not load. The rest of the site is still available.</p>'; });
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
onSnapshot(collection(db, "events"), (snapshot) => { state.events = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); renderMemoryOptions(); renderMemories(); renderNotifications(); }, () => { ui.events.innerHTML = '<p class="empty-state">Events are unavailable right now.</p>'; });
onSnapshot(collection(db, "memories"), (snapshot) => { state.memories = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); renderMemories(); }, () => { ui.memories.innerHTML = '<p class="empty-state">Reading memories are unavailable right now.</p>'; });
onSnapshot(collection(db, "boardPosts"), (snapshot) => { state.boardPosts = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })); renderBoard(); }, () => { ui.pinBoard.innerHTML = '<p class="empty-state">The pinboard is taking a short break.</p>'; });

ui.signIn.addEventListener("click", signIn); ui.signOut.addEventListener("click", () => signOut(auth)); ui.profile.addEventListener("click", () => openProfile(state.user.uid)); ui.dashboardOpenLibrary.addEventListener("click", () => openProfile(state.user.uid));
ui.profileDialog.addEventListener("close", () => { state.stopShelf?.(); state.stopShelf = null; state.stopProfileActivity?.(); state.stopProfileActivity = null; state.openProfileMember = null; });
ui.bookDialog.addEventListener("close", stopBookSocialSubscriptions);
ui.notificationButton.addEventListener("click", () => { renderNotifications(); showDialog(ui.notificationDialog); });
ui.markNotificationsRead.addEventListener("click", markAllNotificationsRead);
$("openSuggestionButton").addEventListener("click", () => openCatalog("recommendation")); ui.openPending.addEventListener("click", () => showDialog(ui.pendingDialog)); ui.suggestionForm.addEventListener("submit", submitSuggestion); ui.catalogSearchForm.addEventListener("submit", submitCatalogSearch); ui.catalogDestination.addEventListener("change", updateCatalogDestination); ui.catalogSave.addEventListener("click", saveCatalogBook); ui.catalogManual.addEventListener("click", openManualCatalogEntry); ui.monthForm.addEventListener("submit", saveRating); ui.saveMonth.addEventListener("click", saveMonth); ui.announcementForm.addEventListener("submit", saveAnnouncement); ui.readingGoalForm.addEventListener("submit", saveReadingGoal); ui.readingGoalEnd.addEventListener("click", finishReadingGoal); ui.eventForm.addEventListener("submit", addEvent); ui.memoryForm.addEventListener("submit", addMemory); ui.memoryCancelEdit.addEventListener("click", resetMemoryEditor); ui.boardForm.addEventListener("submit", postBoard); ui.inviteForm.addEventListener("submit", addInvite); ui.uploadSettingsForm.addEventListener("submit", saveUploadSettings); ui.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")); setTheme(localStorage.getItem("becTheme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
ui.search.addEventListener("input", (event) => { state.search = event.target.value; sessionStorage.setItem("becShelfSearch", state.search); renderBooks(); }); ui.genre.addEventListener("change", (event) => { state.genre = event.target.value; sessionStorage.setItem("becShelfGenre", state.genre); renderBooks(); });
ui.shelfPrevious.addEventListener("click", () => moveShelf(-1)); ui.shelfNext.addEventListener("click", () => moveShelf(1)); ui.shelfExpand.addEventListener("click", toggleShelfLayout); ui.books.addEventListener("scroll", updateShelfNavigation, { passive: true }); window.addEventListener("resize", updateShelfNavigation);
ui.surprise.addEventListener("click", pickRandomBook);
document.addEventListener("click", async (event) => {
  const close = event.target.closest("[data-close]");
  if (close) {
    const dialog = $(close.dataset.close);
    closeDialog(dialog);
    if (dialog === ui.profileDialog) { state.stopShelf?.(); state.stopShelf = null; state.stopProfileActivity?.(); state.stopProfileActivity = null; state.openProfileMember = null; }
  }
  const surpriseAgain = event.target.closest("[data-surprise-again]");
  if (surpriseAgain) pickRandomBook();
  const notification = event.target.closest("[data-notification-id]");
  if (notification) await openNotificationTarget(notification.dataset.notificationId);
  const reply = event.target.closest("[data-reply-comment]");
  if (reply) setReplyTarget(reply.dataset.replyComment);
  if (event.target.closest("[data-cancel-reply]")) clearReplyTarget();
  const reaction = event.target.closest("[data-book-reaction]");
  if (reaction) await toggleBookReaction(reaction.dataset.bookReaction);
  const rsvp = event.target.closest("[data-rsvp-event][data-rsvp-status]");
  if (rsvp) await saveEventRsvp(rsvp.dataset.rsvpEvent, rsvp.dataset.rsvpStatus);
  const memoryEdit = event.target.closest("[data-edit-memory]");
  if (memoryEdit) editMemory(memoryEdit.dataset.editMemory);
  const memoryFocus = event.target.closest("[data-memory-focus]");
  if (memoryFocus) { const target = $(`memory-${memoryFocus.dataset.memoryFocus}`); target?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); target?.animate?.([{ outlineColor: "transparent" }, { outlineColor: "var(--orange)" }, { outlineColor: "transparent" }], { duration: 1300 }); }
  const eventJump = event.target.closest("[data-event-jump]");
  if (eventJump?.dataset.eventJump) $(`event-${eventJump.dataset.eventJump}`)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  const catalogResult = event.target.closest("[data-catalog-result]");
  if (catalogResult) await selectCatalogBook(Number(catalogResult.dataset.catalogResult));
  const monthDescriptionToggle = event.target.closest("[data-toggle-month-description]");
  if (monthDescriptionToggle) { const synopsis = $(monthDescriptionToggle.getAttribute("aria-controls")); const expanded = monthDescriptionToggle.getAttribute("aria-expanded") === "true"; synopsis?.classList.toggle("is-collapsed", expanded); monthDescriptionToggle.setAttribute("aria-expanded", String(!expanded)); monthDescriptionToggle.textContent = expanded ? "Read full description" : "Show less"; }
  const dashboardBook = event.target.closest("[data-dashboard-book-id]");
  if (dashboardBook) openDashboardBook(dashboardBook.dataset.dashboardBookId);
  if (event.target.closest("[data-open-dashboard-library]") && isMember()) openProfile(state.user.uid);
  const book = event.target.closest("[data-book-id]");
  if (book) { const item = state.books.find((entry) => entry.id === book.dataset.bookId); if (item) { state.randomPickerActive = false; openBookDetails(item); } }
  const shelfBook = event.target.closest("[data-shelf-book-id]");
  if (shelfBook) { const item = state.shelfEntries.find((entry) => entry.id === shelfBook.dataset.shelfBookId); if (item) { state.randomPickerActive = false; openBookDetails(item, true); } }
  const member = event.target.closest("[data-member-id]");
  if (member) openProfile(member.dataset.memberId);
  const approvePending = event.target.closest("[data-approve-pending]");
  if (approvePending && !approvePending.disabled) { approvePending.disabled = true; await reviewPending(approvePending.dataset.approvePending, true); if (approvePending.isConnected) approvePending.disabled = false; }
  const rejectPending = event.target.closest("[data-reject-pending]");
  if (rejectPending && !rejectPending.disabled) { rejectPending.disabled = true; await reviewPending(rejectPending.dataset.rejectPending, false); if (rejectPending.isConnected) rejectPending.disabled = false; }
  const removeEvent = event.target.closest("[data-remove-event]");
  if (removeEvent && isOfficer() && window.confirm("Remove this event from the public calendar?")) {
    const savedEvent = state.events.find((item) => item.id === removeEvent.dataset.removeEvent), counts = eventCounts(savedEvent || {}), linked = linkedEventMemories(removeEvent.dataset.removeEvent).length;
    if (linked || counts.going + counts.maybe + counts.cant_attend) { toast("This event has memories or RSVPs, so it is being kept in the club archive."); return; }
    try { await deleteDoc(doc(db, "events", removeEvent.dataset.removeEvent)); toast("Event removed."); }
    catch (error) { console.error(error); toast("Could not remove that event."); }
  }
  const removeMemory = event.target.closest("[data-remove-memory]");
  if (removeMemory && isOfficer() && window.confirm("Remove this photo from Reading Memories?")) {
    try { await deleteDoc(doc(db, "memories", removeMemory.dataset.removeMemory)); if (state.memoryEditingId === removeMemory.dataset.removeMemory) resetMemoryEditor(); toast("Memory removed."); }
    catch (error) { console.error(error); toast("Could not remove that memory."); }
  }
  const removePin = event.target.closest("[data-remove-pin]");
  if (removePin && isOfficer() && window.confirm("Remove this note from the club pinboard?")) {
    try { await deleteDoc(doc(db, "boardPosts", removePin.dataset.removePin)); toast("Pin removed."); }
    catch (error) { console.error(error); toast("Could not remove that pin."); }
  }
});
async function retryCoverImage(image) {
  const isbn = String(image.dataset.coverIsbn || "").replace(/[^0-9X]/gi, ""); const googleId = image.dataset.googleBooksId || ""; const current = image.currentSrc || image.src;
  const openLibrary = isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false` : "";
  const googleBooks = googleId ? `https://books.google.com/books/content?id=${encodeURIComponent(googleId)}&printsec=frontcover&img=1&zoom=2&source=gbs_api` : "";
  const candidates = /openlibrary/i.test(current) ? [["google", googleBooks], ["open", openLibrary]] : [["open", openLibrary], ["google", googleBooks]];
  for (const [provider, url] of candidates) { const marker = provider === "open" ? "coverTriedOpen" : "coverTriedGoogle"; if (url && url !== current && image.dataset[marker] !== "true") { image.dataset[marker] = "true"; image.src = url; return true; } }
  if (image.dataset.coverRecoveryTried === "true" || !image.dataset.coverTitle) return false;
  image.dataset.coverRecoveryTried = "true";
  try {
    const probe = { title: image.dataset.coverTitle, author: image.dataset.coverAuthor, isbn, googleBooksId: googleId };
    const results = await searchCatalog(`${probe.title} ${probe.author}`.trim(), { googleBooksApiKey: state.googleBooksKey });
    const match = results.find((book) => sameBook(book, probe) && book.coverUrl && optimizedImageUrl(book.coverUrl, 600) !== current);
    if (match) { image.dataset.coverIsbn = match.isbn || isbn; image.dataset.googleBooksId = match.googleBooksId || googleId; image.src = optimizedImageUrl(match.coverUrl, 600); return true; }
  } catch (error) { console.warn("Automatic cover recovery skipped:", error); }
  return false;
}
document.addEventListener("error", async (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (image.dataset.coverTitle && await retryCoverImage(image)) return;
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
