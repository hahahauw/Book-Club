# Reading-room UI refresh

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
