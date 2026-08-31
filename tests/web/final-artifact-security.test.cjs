const fs = require('node:fs');
const assert = require('node:assert/strict');
const builder = fs.readFileSync('scripts/build_online_web.py', 'utf8');
assert.doesNotMatch(builder, /web-superadmin\.patch/);
assert.doesNotMatch(builder, /git.*apply/);
const appFiles = ['web/ui.js','web/api.js','web/auth.js','web/attendance.js','web/administration.js','web/reports.js','web/app-shell.js'];
const appSource = appFiles.map(path => fs.readFileSync(path, 'utf8')).join('\n');
assert.doesNotMatch(appSource, /auth\.mfa|challengeAndVerify|totp/i);
const htmlPath = 'dist/web/Gestion-Presence-FST-Web-2026-2027.html';
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.equal((html.match(/FSTApp\.auth\.login\s*=/g) || []).length, 1);
  assert.equal((html.match(/FSTApp\.auth\.restoreSession\s*=/g) || []).length, 1);
  assert.equal((html.match(/FSTApp\.boot\s*=/g) || []).length, 1);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+(?:cdnjs|jsdelivr|unpkg)/i);
  assert.match(html, /save_attendance_sheet/);
  assert.match(html, /VERSION_CONFLICT/);
  assert.match(html, /data-testid="login-identifier"/);
}
console.log('PASS: final standalone artifact security contract');
