const fs = require('node:fs');
const assert = require('node:assert/strict');
const src = fs.readFileSync('web/app-shell.js', 'utf8');
assert.equal((src.match(/FSTApp\.boot\s*=/g) || []).length, 1);
assert.match(src, /DOMContentLoaded/);
assert.match(src, /bootStarted/);
assert.match(src, /renderFatal/);
assert.match(src, /2026\/2027/);
console.log('PASS: deterministic app shell contract');
