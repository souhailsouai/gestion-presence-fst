const fs = require('node:fs');
const assert = require('node:assert/strict');
const api = fs.readFileSync('web/api.js', 'utf8');
const ui = fs.readFileSync('web/ui.js', 'utf8');
for (const marker of ['teacher_directory','classes','students','timetable']) assert.match(api, new RegExp(marker));
assert.match(api, /admin-teacher/);
assert.match(ui, /textContent/);
assert.doesNotMatch(ui, /innerHTML\s*=\s*[^`'"\n]*\+[^;]+/);
console.log('PASS: management and safe rendering contract');
