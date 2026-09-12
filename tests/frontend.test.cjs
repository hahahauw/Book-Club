const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const acorn = require('acorn');
const { JSDOM } = require('jsdom');
const source = readFileSync(resolve(__dirname, '../app.js'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
// Execute the actual production functions, with isolated DOM and database boundaries.
function harness(names, html = '', globals = {}) {
  const dom = new JSDOM(html, { url: 'https://club.example.test', runScripts: 'outside-only' });
  Object.assign(dom.window, globals);
  dom.window.eval(names.map((name) => {
    const node = ast.body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id.name === name);
    assert.ok(node, `Production function ${name} exists`);
    return source.slice(node.start, node.end);
  }).join('\n'));
  return dom;
}
test('cover text and quoted metadata cannot become attributes or HTML', () => {
  const dom = harness(['escapeHtml', 'safeImageUrl', 'optimizedImageUrl', 'automaticCoverUrl', 'coverRetryAttributes', 'coverImageMarkup']);
  const payload = 'A " onerror="alert(1)\' <img src=x> 📚';
  dom.window.document.body.innerHTML = dom.window.coverImageMarkup({ title: payload, author: payload, isbn: payload, coverUrl: 'https://example.test/cover.jpg' });
  const image = dom.window.document.querySelector('img');
  assert.equal(dom.window.document.querySelectorAll('img').length, 1);
  assert.equal(image.getAttribute('alt'), `Cover of ${payload}`);
  assert.equal(image.dataset.coverTitle, payload);
  assert.equal(image.dataset.coverAuthor, payload);
  assert.equal(image.hasAttribute('onerror'), false);
  assert.equal(dom.window.safeImageUrl('javascript:alert(1)'), '');
  assert.equal(dom.window.safeImageUrl('data:image/svg+xml,<svg/>'), '');
  assert.equal(dom.window.safeImageUrl('https://user:pass@example.test/x'), '');
  assert.equal(dom.window.safeImageUrl('http://example.test/x'), 'https://example.test/x');
  assert.match(dom.window.optimizedImageUrl('https://res.cloudinary.com/club/image/upload/a.jpg', 192), /f_auto,q_auto,c_limit,w_192/);
  dom.window.close();
});
test('quoted member IDs remain a single inert attribute', () => {
  const memberId = 'id" onclick="alert(1)';
  const dom = harness(['escapeHtml', 'safeImageUrl', 'optimizedImageUrl', 'initials', 'color', 'renderMembers'], '<div id="members"></div>', { state: { members: [{ id: memberId, displayName: 'Reader' }] } });
  dom.window.ui = { members: dom.window.document.getElementById('members') };
  dom.window.renderMembers();
  const button = dom.window.document.querySelector('button');
  assert.equal(button.dataset.memberId, memberId);
  assert.equal(button.hasAttribute('onclick'), false);
  dom.window.close();
});
test('legacy page cover failure uses inert text instead of an inline handler', () => {
  const dom = new JSDOM(readFileSync(resolve(__dirname, '../Index.html'), 'utf8'), { runScripts: 'outside-only' });
  const script = [...dom.window.document.scripts].map(node => node.textContent).find(text => text.includes('function renderBooks'));
  const tree = acorn.parse(script, { ecmaVersion: 'latest' });
  const payload = 'Reader\'s "book" <img src=x onerror=alert(1)>';
  dom.window.books = [{ title: payload, author: 'Author', coverUrl: 'https://example.test/missing.jpg', comments: [] }];
  dom.window.bookshelf = dom.window.document.querySelector('.bookshelf');
  for (const name of ['escapeHtml', 'safeImageUrl', 'renderCommentList', 'renderBooks']) {
    const node = tree.body.find(entry => entry.type === 'FunctionDeclaration' && entry.id.name === name);
    dom.window.eval(script.slice(node.start, node.end));
  }
  const listener = tree.body.find(node => node.type === 'ExpressionStatement' && script.slice(node.start, node.end).startsWith("bookshelf.addEventListener('error'"));
  dom.window.eval(script.slice(listener.start, listener.end));
  dom.window.renderBooks();
  const image = dom.window.bookshelf.querySelector('img');
  assert.equal(image.hasAttribute('onerror'), false);
  image.dispatchEvent(new dom.window.Event('error'));
  assert.equal(dom.window.bookshelf.querySelector('.book-card-cover-placeholder').textContent, payload);
  assert.equal(dom.window.bookshelf.querySelectorAll('img').length, 0);
  dom.window.close();
});
for (const outcome of ['success', 'write failure', 'refresh failure']) {
  test(`pinboard async submission: ${outcome}`, async () => {
    let finish, writes = 0;
    const pending = new Promise((resolve, reject) => { finish = () => outcome === 'write failure' ? reject(new Error('permission-denied')) : resolve({ id: 'saved' }); });
    const dom = harness(['postBoard', 'runBusy'], '<form><textarea></textarea><button type="submit">Pin</button></form><p></p>', {
      state: { user: { uid: 'alice' }, profile: { displayName: 'Reader' } }, isMember: () => true,
      db: {}, collection: () => ({}), addDoc: () => { writes++; return pending; }, console: { error() {} }
    });
    const form = dom.window.document.querySelector('form'), input = form.querySelector('textarea');
    input.value = 'My draft';
    dom.window.ui = { boardText: input, boardStatus: dom.window.document.querySelector('p') };
    if (outcome === 'refresh failure') form.reset = () => { throw new Error('UI reset failed'); };
    let submission;
    form.addEventListener('submit', event => { submission = dom.window.postBoard(event); });
    const event = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    assert.equal(event.currentTarget, null, 'Browser clears currentTarget after dispatch');
    assert.equal(form.querySelector('button').disabled, true);
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal(writes, 1, 'Busy button prevents duplicate write');
    finish();
    await pending.catch(() => {});
    // The duplicate event completed immediately; drain the original async handler.
    await new Promise(resolve => setImmediate(resolve));
    if (outcome === 'success') { assert.equal(input.value, ''); assert.match(dom.window.ui.boardStatus.textContent, /Pinned/); }
    if (outcome === 'write failure') { assert.equal(input.value, 'My draft'); assert.match(dom.window.ui.boardStatus.textContent, /Could not pin/); }
    if (outcome === 'refresh failure') assert.match(dom.window.ui.boardStatus.textContent, /was saved/);
    assert.equal(form.querySelector('button').disabled, false);
    await submission;
    dom.window.close();
  });
}
test('malformed legacy comments do not crash normalization', () => {
  const dom = harness(['legacyCommentId', 'normalizeLegacyComments'], '', { state: { activeBookId: 'book' } });
  assert.equal(dom.window.normalizeLegacyComments(null).length, 0);
  assert.equal(dom.window.normalizeLegacyComments([null, {}, { text: 'Valid', name: 'Reader' }]).length, 1);
  dom.window.close();
});

test('stored IDs cannot override IDs returned by Firestore', () => {
  // Run each real snapshot-mapping expression, including the owner and legacy flags.
  const expressions = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ArrowFunctionExpression' && node.params[0]?.name === 'entry' && node.body.type === 'ObjectExpression') {
      const text = source.slice(node.start, node.end);
      if (text.includes('entry.data()') && text.includes('id: entry.id')) expressions.push(text);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  assert.ok(expressions.length > 10);
  const entry = { id: 'actual-id', data: () => ({ id: 'forged-id', ownerId: 'forged-owner', legacy: true }), ref: { parent: { parent: { id: 'actual-owner' } } } };
  for (const expression of expressions) {
    const result = Function(`return (${expression})`)()(entry);
    assert.equal(result.id, 'actual-id');
    if (expression.includes('ownerId:')) assert.equal(result.ownerId, 'actual-owner');
    if (expression.includes('legacy: false')) assert.equal(result.legacy, false);
  }
});

for (const feature of ['shelf', 'comment']) {
  for (const outcome of ['success', 'write failure', 'secondary failure']) {
    test(`${feature} submission: ${outcome}`, async () => {
      const fields = feature === 'shelf' ? ['shelfTitle', 'shelfAuthor', 'shelfCover', 'shelfStatus', 'shelfGenre', 'shelfNote', 'shelfPages'] : ['bookCommentText', 'bookCommentSpoiler', 'bookSpoilerScope'];
      let message = '';
      const dom = harness([feature === 'shelf' ? 'addShelfBook' : 'postBookComment', 'runBusy'], `<form id="bookCommentForm">${fields.map(id => `<input id="${id}">`).join('')}<button type="submit">Save</button></form><p id="bookCommentMessage"></p>`, {
        isMember: () => true, state: { user: { uid: 'alice' }, profile: { displayName: 'Reader' }, openProfileId: 'alice', activeBookId: 'book', books: [{ id: 'book' }] },
        db: {}, collection: () => ({}), doc: () => ({ id: 'new-comment' }), serverTimestamp: () => ({}),
        addDoc: async () => { if (outcome === 'write failure') throw new Error('Write rejected'); return { id: 'new-book' }; },
        setDoc: async () => { if (outcome === 'write failure') throw new Error('Write rejected'); },
        existingShelfEntry: async () => null, withPageCount: (book) => book,
        requireShelfOwner: () => {},
        createShelfEntry: async () => { if (outcome === 'write failure') throw new Error('Write rejected'); return { added: true, id: 'new-book' }; },
        recordActivity: async () => { if (outcome === 'secondary failure') throw new Error('Refresh failed'); },
        activityTypeForStatus: () => 'started_reading', shelfAddedMessage: () => 'Book added', toast: text => { message = text; },
        clearReplyTarget: () => {}, updateSpoilerScopeVisibility: () => {}, console: { error() {} }
      });
      dom.window.$ = id => dom.window.document.getElementById(id);
      for (const id of fields) dom.window.$(id).value = 'Draft';
      const form = dom.window.document.querySelector('form');
      let submission;
      form.addEventListener('submit', event => { submission = feature === 'shelf' ? dom.window.addShelfBook(event) : dom.window.postBookComment(event, 'book'); });
      form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
      await submission;
      if (feature === 'comment') message = dom.window.$('bookCommentMessage').textContent;
      if (outcome === 'success') { assert.equal(dom.window.$(fields[0]).value, ''); assert.match(message, /Book added|part of the club discussion/); }
      if (outcome === 'write failure') { assert.equal(dom.window.$(fields[0]).value, 'Draft'); assert.match(message, /Write rejected|Could not post/); }
      if (outcome === 'secondary failure') assert.match(message, /was saved/);
      dom.window.close();
    });
  }
}
