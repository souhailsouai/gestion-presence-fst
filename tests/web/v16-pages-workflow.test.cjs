const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '../../.github/workflows/deploy-pages.yml');

test('V16 GitHub Pages deploys the approved online build from main', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'deploy-pages.yml must exist');
  const workflow=fs.readFileSync(workflowPath,'utf8');
  for(const marker of [
    'branches: [ main ]',
    'python scripts/build_online_web.py',
    'pages: write',
    'actions/upload-pages-artifact@v3',
    'actions/deploy-pages@v4',
    'path: web'
  ]) assert.ok(workflow.includes(marker), `Missing Pages marker: ${marker}`);
  assert.doesNotMatch(workflow,/service_role|sb_secret_/i);
});
