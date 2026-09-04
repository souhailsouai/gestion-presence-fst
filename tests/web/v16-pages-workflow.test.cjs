const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '../../.github/workflows/deploy-pages.yml');

test('V16 private distribution has no GitHub Pages deployment workflow', () => {
  assert.equal(fs.existsSync(workflowPath), false, 'public deploy-pages.yml must stay absent');
});
