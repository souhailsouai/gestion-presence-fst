const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const markers = [
  'data-fst-vendor="supabase.min.js"',
  'data-fst-module="ui.js"',
  'data-fst-module="api.js"',
  'data-fst-module="auth.js"',
  'data-fst-module="attendance.js"',
  'data-fst-module="administration.js"',
  'data-fst-module="reports.js"',
  'data-fst-module="app-shell.js"'
];
let previous = -1;
for (const marker of markers) {
  const index = html.indexOf(marker);
  assert.ok(index >= 0, `Missing bundle marker: ${marker}`);
  assert.ok(index > previous, `Incorrect bundle order at: ${marker}`);
  previous = index;
}
assert.ok(html.indexOf('data-fst-vendor="supabase.min.js"') < html.indexOf('window.supabase.createClient'), 'Supabase SDK must load before the API module creates a client.');
assert.ok(html.indexOf('data-fst-module="auth.js"') < html.indexOf('data-fst-module="app-shell.js"'), 'Authentication must register before boot.');
console.log('PASS: rebuilt standalone dependency order is executable');
