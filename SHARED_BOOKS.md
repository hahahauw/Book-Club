# Batch 3 — Shared book context

## Contracts and compatibility

| Record | Responsibility | Preservation rule |
| --- | --- | --- |
| `books/{bookId}` | Shared book metadata and conversation identity | Existing IDs, creator fields, original `why`, legacy comment arrays remain intact. New records use deterministic `shared_` IDs. |
| `books/{bookId}/recommendations/{uid}` | One public endorsement/reason per reader | Add forms preserve an existing reason; editing it in book details preserves `createdAt`; it never edits another reader or the parent book. |
| `memberShelves/{uid}/entries/{entryId}` | Reader-owned copy, edition metadata, reading status, finish date and public shelf note | No migration or added link field. Original entry IDs continue to back Top 3 favorites. |
| `books/{bookId}/comments` and `/reactions` | Shared threaded conversation and reactions | Personal copies open the selected public context; writes always use its public ID. Legacy arrays remain visible. |
| `bookOfMonthRatings/{bookId}/members/{uid}` | One rating per reader and shared book | Legacy collection name retained to avoid moving records. New UI edits stars only; transactions retain existing `finished` and `comment` fields. Historical monthly notes are read-only behind a spoiler disclosure. |
| `siteSettings/currentPick` | Featured book selection | Points to the original public ID; now opens the same book controls as the shelf. |

Reading completion is managed through My library, not a second monthly checkbox. New discussion notes use threaded comments, not the historical monthly comment field. Rating a book creates no shelf entry and does not mark it finished.

## Identity decisions

`book-identity.js` is pure and shared by the interface and dry-run diagnostic. One matching catalogue/work/ISBN identifier can select an existing conversation. Conflicting known Open Library work IDs cannot auto-select even if another identifier matches. Multiple identifier matches require a choice. Normalized title + author is only a candidate: the user chooses the existing conversation before a recommendation write or personal-library discussion is opened.

Identifiers are matching evidence, not bibliographic verification. Different provider IDs may refer to the same work; editions may have different ISBNs. No client algorithm can guarantee a canonical work catalogue from inconsistent metadata. New records are keyed by work ID, ISBN, Google ID, catalogue key, then normalized title/author. A transaction prevents duplicate creation for that same identity and atomically writes the reader reason. Different identities created concurrently can still produce separate records; the diagnostic surfaces potential matches for review. A rejected manual text match is not silently reused through an ID collision.

No automatic merge or deletion occurs. A book can show links to other matching older conversations. Their comments, ratings and links stay separate. An explicit personal-to-conversation choice is for the current view, not a persistent verified link. Reopening a text-only entry may require choosing again. Adding permanent mappings requires a reviewed migration and shelf-schema change in a later batch.

## Migration diagnostic

Run locally against a deliberately prepared JSON export:

```sh
node scripts/book-identity-report.mjs exported-books-and-shelves.json
```

Input shape:

```json
{
  "books": [{ "id": "original-public-id", "title": "Example", "author": "Author", "catalogKey": "/works/OL1W" }],
  "shelves": [{ "ownerId": "reader-id", "id": "original-entry-id", "title": "Example", "author": "Author", "catalogKey": "/works/OL1W" }]
}
```

Use document IDs from export paths, not an embedded `id` field. The script reads this file and prints a JSON report to stdout. It has no Firebase SDK, credentials, network calls or write mode. It reports candidate public-book pairs, identifier conflicts, and per-shelf suggested/ambiguous/missing destinations while retaining all IDs. It does not inspect or count subcollection content; the retained-reference list is a preservation requirement, not proof of an exhaustive production backup.

A future consolidation must inventory all legacy and threaded comments, replies, endorsements, ratings, favorites, activities, notifications, current pick and memory book references before proposing redirects. Do not delete an old record merely because the report finds a match. No production export was available or run for this batch, so there is no claim that production duplicates have been resolved.

## Rule changes and release order

The checked-in rules previously allowed rating writes only for the current monthly selection. This batch allows an authorized member to rate any existing public book, with the same owner and bounded-field checks. Recommendations now require a parent book to exist after the transaction (`existsAfter`), including atomic new publication. Unauthorized/foreign writes stay denied. The historic rating schema remains compatible with older clients during rollout.

1. Review the draft PR, identity decisions and emulator results.
2. Compare the deployed rules with this repository. Reconcile any deployment-only changes before deploying; do not blindly replace uninspected production rules.
3. Back up production data and deploy the reviewed rules through the existing Firebase release process. This coding session does not deploy rules.
4. Verify in staging that a member can rate a non-monthly book, two readers can recommend the same book, and guest/foreign/orphan writes are rejected. Use test accounts and seeded fixtures.
5. Complete rendered checks below, then release the frontend through the normal GitHub Pages process. Keep this PR draft until these gates pass.

The new frontend can read existing content with old rules, but ratings outside the monthly selection will be denied until the rule change is deployed. Do not publish the frontend first. If rolling back the frontend, leave shared parent records and endorsement subcollections intact. An older frontend can resume creating duplicates; do not treat frontend rollback as a data rollback.

## Validation and remaining checks

Automated checks execute production functions with isolated DOM/database boundaries; the Firestore emulator checks the local rules and real transaction retries. They do not establish production rule parity, real-device layout, contrast or deployed behavior.

Before release, inspect both themes at 320, 390, 768, 820, 821, 1024 and desktop widths:

- Public book → Manage my copy → status/favorite/edit controls. Confirm the displayed edition and personal note remain intact.
- Open a personal entry with one exact match, two exact matches, a text-only candidate, and no public counterpart. Check choice labels wrap and remain keyboard/touch accessible. Verify all older conversations remain reachable.
- Recommend from catalogue, manual entry and a personal library. Duplicate/uncertain choices must keep the typed reason and focus the selector; changing a result must clear its old choice. Repeated saves should not add another record.
- Open the monthly read, rate it, type a new rating during a pending save, switch books, reopen, and sign out. No stale values or write-success messages should appear in another context.
- Expand historical notes deliberately; verify spoiler warning, readable themes, no automatic expansion on load, and no new monthly completion/comment form.
- Verify recommendation attribution and public reader links, dialog Escape/close and focus return, narrow select controls, long names/titles, loading/error/retry states and mobile keyboard behavior.

Keep guest suggestion approval in view during future migration planning: it still uses the existing officer approval path and preserves guest reasons as legacy notes. This batch consolidates signed-in member recommendation creation; it does not rewrite historical or pending guest submissions.
