const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8'),base=fs.readFileSync('styles.css','utf8'),theme=fs.readFileSync('reading-room.css','utf8');
test('saved status is inside the existing caption, outside the cover image',()=>{
 const render=app.slice(app.indexOf('function renderBooks('),app.indexOf('function ',app.indexOf('function renderBooks(')+10));
 assert.match(render,/<span class="shelf-book-copy">.*\$\{savedBookBadge\(book\)\}<\/span>/);
 assert.doesNotMatch(base,/\.book-card(?:\:hover)? > span/);assert.doesNotMatch(theme,/\.book-card > \.saved-book-indicator/);
});
test('month action inherits standard button colors and padding in both themes',()=>{
 const rule=base.match(/\.month-details\s*\{([^}]+)\}/)[1];assert.doesNotMatch(rule,/(?:^|;)\s*(?:color|background|padding)\s*:/);
 assert.match(theme,/html\[data-theme="dark"\] \.month-card \{ background:var\(--surface\); \}/);
});
function extract(name){const start=app.indexOf('function '+name+'(');const end=app.indexOf('\nfunction ',start+1);return app.slice(start,end);}
test('pinboard eagerly requests avatars with original and post fallbacks',()=>{
 const c=vm.createContext({state:{members:[{id:'u',displayName:'Reader',photoURL:'https://original'}]},safeImageUrl:s=>s||'',optimizedImageUrl:s=>'optimized:'+s,escapeHtml:String,initials:()=> 'R'});vm.runInContext(extract('pinAvatar'),c);
 const html=c.pinAvatar({memberId:'u',photoURL:'https://post'});assert.match(html,/loading="eager"/);assert.match(html,/referrerpolicy="no-referrer"/);assert.match(html,/data-pin-original="https:\/\/original"/);assert.match(html,/data-pin-fallback="https:\/\/post"/);
});
test('failed avatar retries original, then post image, then initials without looping',()=>{
 const c=vm.createContext({document:{createTextNode:s=>({text:s})}});vm.runInContext(extract('retryPinAvatar'),c);
 const image={dataset:{pinOriginal:'original',pinFallback:'post',pinInitials:'R'},replaceWith(node){this.replacement=node}};
 c.retryPinAvatar(image);assert.equal(image.src,'original');c.retryPinAvatar(image);assert.equal(image.src,'post');c.retryPinAvatar(image);assert.equal(image.replacement.text,'R');assert.equal(image.dataset.pinOriginal,'');assert.equal(image.dataset.pinFallback,'');
});
