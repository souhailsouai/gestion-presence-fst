const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');

const vendorMarker = 'data-fst-supabase="inline"';
const clientUse = 'supabase.createClient';

const vendorIndex = html.indexOf(vendorMarker);
const clientIndex = html.indexOf(clientUse);

assert.ok(vendorIndex >= 0, 'Standalone Web bundle must inline Supabase JS.');
assert.ok(clientIndex >= 0, 'Standalone Web bundle must initialize the Supabase client.');
assert.ok(
  vendorIndex < clientIndex,
  'Supabase JS must be loaded before application code calls supabase.createClient().'
);

console.log('PASS: standalone Web dependency order is executable');
