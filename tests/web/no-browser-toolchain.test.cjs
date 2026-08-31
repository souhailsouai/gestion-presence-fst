const fs = require('node:fs');
const assert = require('node:assert/strict');

const pkg = fs.readFileSync('package.json', 'utf8');
const workflow = fs.readFileSync('.github/workflows/build-web.yml', 'utf8');
const testsDir = fs.readdirSync('tests/web').filter(name => name.endsWith('.cjs'));
const testSources = testsDir.map(name => fs.readFileSync(`tests/web/${name}`, 'utf8')).join('\n');

assert.doesNotMatch(pkg, /"playwright"|"chromium"/i, 'package.json must not declare browser-test dependencies');
assert.doesNotMatch(workflow, /npx\s+playwright|playwright\s+install|chromium\.launch/i, 'Web CI must not install or invoke a browser engine');
assert.doesNotMatch(testSources, /require\(['"]playwright['"]\)|chromium\.launch/i, 'Web tests must not require a browser engine');
