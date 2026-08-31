const fs = require('node:fs');
const assert = require('node:assert/strict');
const builder = fs.readFileSync('scripts/build_online_web.py', 'utf8');
assert.doesNotMatch(builder, /web-superadmin\.patch/);
assert.doesNotMatch(builder, /git.*apply/);
const htmlPath = 'dist/web/Gestion-Presence-FST-Web-2026-2027.html';
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.equal((html.match(/FSTApp\.auth\.login\s*=/g) || []).length, 1);
  assert.equal((html.match(/FSTApp\.auth\.restoreSession\s*=/g) || []).length, 1);
  assert.equal((html.match(/FSTApp\.boot\s*=/g) || []).length, 1);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+(?:cdnjs|jsdelivr|unpkg)/i);
  assert.doesNotMatch(html, /auth\.mfa|challengeAndVerify|totp/i);
  assert.match(html, /save_attendance_sheet/);
  assert.match(html, /VERSION_CONFLICT/);
}
console.log('PASS: final standalone artifact security contract');
