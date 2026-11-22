const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const lpc3=fs.readFileSync('web/v30-lpc3.js','utf8');
const mobile=fs.readFileSync('shared/mobile.js','utf8');
const pages=fs.readFileSync('scripts/build_pages_from_41881.py','utf8');
const online=fs.readFileSync('scripts/build_pages_from_41881.py','utf8');
const versionUi=fs.readFileSync('web/v31-version-ui.js','utf8');

test('LPC3 mobile entry reuses the same owner authorization as desktop',()=>{
  assert.match(lpc3,/function isOwner\(\)/);
  assert.match(lpc3,/function ensureMobileEntry\(\)/);
  assert.match(lpc3,/mobile-lpc3-link/);
  assert.match(lpc3,/mobile\.hidden=!ok/);
  assert.match(lpc3,/if\(!isOwner\(\)\)return false/);
  assert.doesNotMatch(lpc3,/innerWidth.*OWNER_ID|matchMedia.*OWNER_ID/);
});

test('responsive shell notifies LPC3 after mobile menu creation',()=>{
  assert.match(mobile,/fst:mobile-shell-ready/);
  assert.match(mobile,/window\.syncMobileActive=syncMobileActive/);
  assert.match(lpc3,/fst:mobile-shell-ready/);
});

test('Pages and online builds both embed the responsive mobile shell',()=>{
  for(const source of [pages,online]){
    assert.match(source,/shared.*mobile\.css/s);
    assert.match(source,/shared.*mobile\.js/s);
    assert.match(source,/data-fst-mobile-css="inline"/);
    assert.match(source,/data-fst-mobile-js="inline"/);
  }
});

test('LPC3 content has controlled mobile table overflow and full-width essential actions',()=>{
  assert.match(lpc3,/table-responsive/);
  assert.match(lpc3,/@media\(max-width:768px\)/);
  assert.match(lpc3,/#presence-lpc3 #lpc3-save\{width:100%\}/);
  assert.match(lpc3,/overflow-x:auto/);
});

test('visible application version footer is removed rather than renamed',()=>{
  assert.doesNotMatch(versionUi,/APP_VERSION_LABEL/);
  assert.doesNotMatch(versionUi,/footer\.textContent=.*v3/i);
  assert.match(versionUi,/looksLikeVisibleVersion/);
  assert.match(versionUi,/\.remove\(\)/);
});
