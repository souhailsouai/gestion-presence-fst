const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.join(__dirname, '..', '..', 'web', 'index.html');

test('release HTML is self-contained for the Windows single-file app', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(html, /<script\s+src="\.\/online-runtime\.js"><\/script>/);
  assert.doesNotMatch(html, /<script\s+src="\.\/online-fixes\.js"><\/script>/);
  assert.match(html, /window\.FSTOnlineRuntime=/);
  assert.match(html, /window\.loadData=async function/);
  assert.match(html, /Connexion Internet requise/);
});
