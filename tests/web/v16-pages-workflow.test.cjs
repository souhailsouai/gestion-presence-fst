const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '../../.github/workflows/deploy-pages-no-artifact.yml');

test('GitHub Pages publishes the approved online build from main without Actions artifacts', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'deploy-pages-no-artifact.yml must exist');
  const workflow=fs.readFileSync(workflowPath,'utf8');
  for(const marker of [
    'branches: [ main ]',
    'python scripts/build_pages_from_41881.py',
    'contents: write',
    'git push --force origin HEAD:gh-pages',
    'lpc3-student-management',
    'v31_add_student_authorized',
    'v30_teacher_assign_student'
  ]) assert.ok(workflow.includes(marker), `Missing Pages marker: ${marker}`);
  assert.doesNotMatch(workflow,/actions\/upload-pages-artifact|actions\/deploy-pages/);
  assert.doesNotMatch(workflow,/service_role|sb_secret_/i);
});
