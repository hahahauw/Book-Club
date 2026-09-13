# UI changes and validation

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
