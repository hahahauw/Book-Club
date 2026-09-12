# First security and reliability repair batch

## Catalogue and visibility baseline — 12 September 2026

The follow-up repair starts from `522ddeaf240414f0c9b7f5294a0f8002920fa1dd`. It changes frontend disclosure and catalogue payload preparation, with no rule deployment, permission changes or stored-data migration.

- The common metadata contract is title 160, author 100, genre 80, synopsis 3,000, source 100 and publication year 20 characters. Catalogue identifiers retain their values and reject excessive lengths; invalid/overlong cover URLs are omitted. The preview and officer queue disclose shortening or unusable metadata. The original provider response is not mutated.
- New guest submissions use the public-book synopsis limit even though pending-book rules permit 4,000 characters. Approval normalizes older queue records to the public limit. Publication must succeed before the pending record is deleted; the pre-existing multi-write approval flow still needs a separate idempotency repair.
- Shelf notes, reading status and completion dates remain public under the checked-in rules. The note editors now say so, and hiding summary cards is described as a display preference. Private notes require a separate document/rules migration; wording alone does not provide privacy.
- **Deployment parity is still unverified.** This session has repository access but no captured Firebase console/rules release or production schema export. Before changing rules, record the active rules release, compare it with `firestore.rules`, and inventory existing shelf and queue field names/types. Do not treat emulator success as confirmation of production authorization.
- `firebase.test.json` remains emulator-only. Runtime Firebase stays at CDN version 10.12.5; the test SDK/CLI versions are separately recorded in `tests/README.md`. This batch does not silently upgrade the deployed SDK.

### Earlier security batch

Prepared against main commit `04d22a857efe625a9f734ff2acd37c164edade06`.
This branch is a review proposal. No production rules or data were changed and no deployment was performed.

## Changes

- Encode quotes as well as HTML delimiters in both HTML entry points. Escape document IDs in generated attributes. Accept HTTPS image URLs, upgrading HTTP, and reject credentials and other schemes. This does not restrict images to trusted hosts or eliminate third-party image tracking.
- Remove the legacy page's inline image-error JavaScript. Its fallback uses `textContent`.
- Put authoritative Firestore snapshot IDs (and derived owner/legacy flags) after document data when constructing frontend records. Existing forged `id` fields can no longer redirect UI actions to another document.
- Ignore malformed legacy-comment entries when normalizing discussions.
- Capture submit forms before asynchronous work in pinboard, manual shelf, and discussion handlers. Distinguish a failed primary write from a successful save followed by failed UI work. Avoid resetting a replacement discussion form.
- Add the owner's supplied Firestore rules to version control. The intended authorization/schema changes are limited to the two items below; other policies are retained.

## Rule changes and compatibility

1. `validCommentAppend` is officer-only and requires exact equality with the previous list plus one validated trailing comment. The earlier `hasAll` condition did not preserve order or multiplicity and only validated the final element. Member discussion writes continue through the immutable threaded-comment collection. Officer approval of guest recommendations can still append a note to an existing book. An older client that tries member writes to the legacy array will now receive permission-denied.
2. Shelf writes use an explicit field allowlist with types and limits for catalogue metadata. Required manual-entry fields and optional catalogue fields used by the current client are supported, including string or integer publication years. Stored `id`, `ownerId`, and arbitrary extra fields are rejected.

**Before publishing these rules:** compare the supplied baseline with the currently deployed rules; the repository did not previously contain a rules file, and live deployment parity has not been established. Inventory existing shelf field names and types using a read-only check. Extra legacy fields survive merge updates and will cause those updates to fail under the stricter schema. Plan any necessary cleanup separately; this branch does not migrate or delete records. Malformed legacy comments are hidden defensively, not removed from Firestore.

## Validation

Regression checks run against isolated DOMs and the local Firestore emulator with project `demo-bec-security`. They cover quoted input and metadata, document identity, malformed legacy comments, success/failure feedback for the three affected submit handlers, shelf ownership/schema, legacy comment tampering, threaded comments, role escalation, private email reads, and atomic RSVP transitions. See `tests/README.md` for commands. Expected permission-denied logs correspond to negative assertions.

These are targeted regression checks, not a complete security certification. Real-browser Google sign-in, image-provider behavior, live data compatibility, and a staged end-to-end officer guest-approval flow still require verification before release. Broader audit findings, including membership revocation, public reading-data policy, guest-submission abuse, deletion/retention, book identity, accessibility, and cross-tab races, remain separate repair work.

## Suggested release order

Review this draft, inspect live schema compatibility, and test the affected workflows in a staging environment. Publish frontend hardening first or alongside the reviewed rules. Publish the rules only after the shelf compatibility check. This repository contains only an emulator configuration (`firebase.test.json`); it does not introduce a production deployment target or automatic deployment workflow.
