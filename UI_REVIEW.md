# UI changes and validation

## Batch 2: fewer destinations, books first — 13 September 2026

Prepared from merged batch 1 at `af8123d9c783d369f6b3febde98e91f1145d630b`.

- Desktop and mobile share four primary destinations: Books, My library, Readers and Community. The landing page contains a shorter introduction, the recommendation shelf and optional curated collections. Book titles, authors and saved status are always below a fixed 2:3 cover frame.
- Move the reading dashboard into My library. Add book opens the catalogue directly from the reading desk and profile; manual entry remains a separate fallback. Detailed period summaries sit under Reading history and use dated shelf finishes, with no unsupported historical rating claim. Remove the duplicate editable “currently reading” profile field; the original stored field is retained, and the shelf remains the reading-status source.
- Put the monthly read, activity and events in Community. Hide an empty announcement except for officers or an explicit announcement link. Group invitation/integration forms under Manage community. Memories and the archive remain secondary links.
- Retire active pinboard posting/removal and goal creation/live progress. Preserve records in a read-only archive that loads only when opened, supports partial failure/retry, and avoids duplicate concurrent reads. The whole-site shelf scan and goal/pinboard startup listeners are removed. A formerly active goal is not presented as a finalized result.
- Preserve `#events`, `#memories`, `#members`, `#discovery`, `#monthHeading`, `#announcementHeading`, `#board` and `#readingGoal`. Each reveals its owning page, sets matching main navigation and focuses a visible heading. Shelf filters and collection disclosure stay mounted across navigation. Unknown/malformed hashes fall back to Books.

The full collection editor and book/profile details still use their existing dialogs. Canonical book identity, addressable book/profile pages, private-note migration and self-service membership are later batches; this change does not claim to complete them.

Validation: 107 frontend/regression checks passed, including 18 new route/archive/library checks. Both stylesheets parsed without errors; JavaScript syntax and git whitespace checks passed. Four tests for retired active goal/posting code were removed and replaced by archive/load/retention tests. Existing image fallback, catalogue race, shelf, event, notification and Memories tests remain.

Rendered verification is pending. Local preview access was blocked in the prior batch; the self-contained preview attempt was rejected by automatic tool review because it exceeded the tool's 64,000-byte execution limit. No successful screenshots, measured layout/contrast, real phone keyboard or live authenticated writes are claimed. Keep the PR draft until the responsive checklist below and in `tests/README.md` is completed. In particular, check permanent cover captions, four-item mobile navigation, the 820/821px boundary, route Back/Forward and guest/member/officer states.

## Catalogue and trust baseline — 12 September 2026

Prepared from main `522ddeaf240414f0c9b7f5294a0f8002920fa1dd`.

- Rename the shelf catalogue entry to **Find a book** and explain member/guest destinations.
- Show selected details in place of the results list, focus the book heading, and scroll the preview into view. **Back to results** restores the selected result's focus and leaves the query/results intact. Preserve stale-response tokens, locked saves and manual fallback.
- Use measured header height for anchor offsets, including changes caused by wrapping or authentication controls. Give the reading-room footer the same surface/ink palette in both themes.
- Label shelf notes as public beside catalogue, manual-add and edit controls. Explain that hiding summary cards does not make the underlying shelf private. Replace claims of verified page counts and internal development-phase wording.
- Disclose catalogue text shortening and edition uncertainty before saving. Apply one metadata contract to personal, recommendation, guest and officer approval writes.

Validation: **93 frontend/regression checks and 9 local Firestore emulator checks passed**, including catalogue focus/return for results 1, 9 and 18, detail-load fallback, long metadata, all save destinations, older pending synopsis approval, current public-note access and existing security/transaction regressions. JavaScript syntax and git whitespace checks passed. The old frontend shelf submission fixture was updated for the existing transactional helper; it had stopped matching the application before this batch.

The browser rejected the isolated localhost preview with `ERR_BLOCKED_BY_CLIENT`. No rendered desktop/mobile/tablet, actual device keyboard, assistive-technology or authenticated staging checks are claimed. The CSS palette/offset repair has source and behavior coverage, not measured rendered evidence. Keep the pull request draft until the device/theme checklist in `tests/README.md` is completed. Production Firebase rules parity is separately unverified; see `SECURITY_REVIEW.md`.

## Earlier reading-room UI refresh (historical)

This draft builds on `fix/security-first-batch`. Review the UI diff against that branch; merge the security batch first before integrating this work into main. No production data, rules, releases, or deployment settings were changed.

## Changes

- Compact welcome and announcement layout; move the member dashboard and books ahead of secondary club activity.
- Keep the current palette, fonts, and existing book covers. No generated images or new third-party assets.
- Visible book titles/authors, fixed cover proportions during loading, previous/next controls on desktop, and an expanded grid.
- One selectable discovery collection at a time. Internal score/signal wording replaced with reader-facing descriptions.
- Preview three activities, with the rest expandable. Collapse past events and preserve disclosure state during refreshes.
- Short Book of the Month preview; expanded reader updates retain the rating form and all notes. Summaries explicitly count ratings and responding readers.
- Full-width reactions/discussion beneath the book summary; larger close controls, compact profile statistics, and no empty public favorites panel.
- Essential profile text uses theme tokens instead of arbitrary personalized colors. Personal color remains decorative.
- Split comma/semicolon/slash-separated genre labels for consistent case-insensitive filtering without rewriting stored metadata.
- Skip link, visible focus states, reduced-motion styles, and responsive layout rules.

## Validation performed

The 14 existing frontend regression checks pass. `tests/ui.test.cjs` loads the actual page and application in JSDOM with network/database boundaries stubbed and fictional fixtures. It checks initialization, unique IDs, permanent shelf labels, search, split-genre filtering, discovery selection/persistence/empty state, collapsed activity/archive, rating denominators, and discussion placement. JavaScript syntax and git whitespace checks pass.

The available browser rejected the isolated localhost preview (`ERR_BLOCKED_BY_CLIENT`). Therefore desktop/mobile rendering, measured contrast, and native dialog behavior of this new layout have not been visually verified. JSDOM does not measure CSS layout. This PR remains draft for that reason.

## Before release

Review at 320, 360, 390, 430, 768 and desktop widths, in both themes. Check long titles, image loading/failure, expanded shelf, discovery category selection, empty libraries, red/black/white profile accents, keyboard focus/Escape, and large text. Test signed-in rating/profile forms and guest suggestion navigation in staging. Ensure header and bottom navigation do not cover controls.

The current live announcement, existing author typos, and historical database metadata are not silently edited by this UI change. Officer content cleanup is separate. Activity grouping across individual actions, deep links between dialogs, and complete loading-timeout handling remain future work.
