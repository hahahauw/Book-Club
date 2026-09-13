# Targeted regression checks

The website has no build dependencies. These test-only tools can be installed outside the repository. Run from the repository root with Node.js 22 or newer and Java 17 or newer (the tested CLI version supports Java 17):

```sh
test_tools="$(mktemp -d)"
npm install --prefix "$test_tools" --no-audit --no-fund acorn@8.18.0 jsdom@30.0.1 @firebase/rules-unit-testing@5.0.2 firebase@12.19.0 firebase-tools@14.22.0
NODE_PATH="$test_tools/node_modules" node --test tests/frontend.test.cjs tests/ui.test.cjs tests/audit-repairs.test.cjs tests/batch-one.test.cjs tests/club-shelf.test.cjs tests/events-memories-tools.test.cjs tests/library-tools.test.cjs tests/memories-view.test.cjs tests/navigation-catalog-tools.test.cjs tests/qol-audit.test.cjs tests/visual-regressions.test.cjs tests/catalogue-baseline.test.cjs
NODE_PATH="$test_tools/node_modules" "$test_tools/node_modules/.bin/firebase" emulators:exec --only firestore --project demo-bec-security --config firebase.test.json 'node --test tests/firestore.test.cjs'
node --check app.js
node --check book-catalog.js
git diff --check
```

The Firestore tests refuse to run unless `FIRESTORE_EMULATOR_HOST` is `127.0.0.1:8085`. They seed and clear only the local demo database. Do not substitute a production project ID. Emulator logs are disposable and excluded from git.

Frontend checks parse and execute the actual changed functions with JSDOM and stubbed network boundaries; they do not launch a browser or load production Firebase. Real-browser and live-data checks are listed in `SECURITY_REVIEW.md`.

UI refresh: with the same test dependencies, run `NODE_PATH="$test_tools/node_modules" node tests/ui.test.cjs`. This uses isolated sample data and loads no real Firebase SDK. Rendering checks still required are listed in `UI_REVIEW.md`.

## Catalogue baseline checks

`catalogue-baseline.test.cjs` exercises the actual catalogue transition in JSDOM for the first, middle and last of 18 results, focus return with the original query, detail-loading failure, measured header offsets, metadata limits and all three catalogue write destinations. It also verifies that approval can handle a historical 4,000-character pending synopsis and retains the queue record when publication fails. The existing stale-response, save-lock and nested-dialog checks remain in `qol-audit.test.cjs`.

The emulator tests verify that normalized metadata fits all three current schemas and that signed-out visitors can read shelf notes even when summary cards are hidden. That second check documents the current public policy; it is not a private-note feature.

JSDOM and the source checks in `visual-regressions.test.cjs` do not establish rendered layout or contrast. Before merging visual changes, check both themes at 320, 390, 768, 820, 821, 1024 and desktop widths. Select first/middle/last results, return to results, use Escape, and navigate to section headings with both guest and wrapped signed-in headers. Verify phone keyboard behavior on a device. Keep writes in a staging/test account.
