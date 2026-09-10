# Targeted regression checks

The website has no build dependencies. These test-only tools can be installed outside the repository. Run from the repository root with Node.js 22 or newer and Java 17 or newer (the tested CLI version supports Java 17):

```sh
test_tools="$(mktemp -d)"
npm install --prefix "$test_tools" --no-audit --no-fund acorn@8 jsdom@30.0.1 @firebase/rules-unit-testing@5.0.2 firebase@12.19.0 firebase-tools@14.22.0
NODE_PATH="$test_tools/node_modules" node --test tests/frontend.test.cjs
NODE_PATH="$test_tools/node_modules" "$test_tools/node_modules/.bin/firebase" emulators:exec --only firestore --project demo-bec-security --config firebase.test.json 'node --test tests/firestore.test.cjs'
node --check app.js
git diff --check
```

The Firestore tests refuse to run unless `FIRESTORE_EMULATOR_HOST` is `127.0.0.1:8085`. They seed and clear only the local demo database. Do not substitute a production project ID. Emulator logs are disposable and excluded from git.

Frontend checks parse and execute the actual changed functions with JSDOM and stubbed network boundaries; they do not launch a browser or load production Firebase. Real-browser and live-data checks are listed in `SECURITY_REVIEW.md`.

UI refresh: with the same test dependencies, run `NODE_PATH="$test_tools/node_modules" node tests/ui.test.cjs`. This uses isolated sample data and loads no real Firebase SDK. Rendering checks still required are listed in `UI_REVIEW.md`.
