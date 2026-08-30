const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'web/security-v2.js'), 'utf8');

new Function(source);

for (const marker of [
  "functions.invoke('pin-login'",
  "rpc('get_attendance_sheet'",
  "rpc('save_attendance_sheet'",
  'p_expected_revision',
  'p_operation_id',
  'VERSION_CONFLICT',
  'pendingOperations',
  'account_state',
  'Mot de passe ou PIN',
]) {
  assert.ok(source.includes(marker), `missing simple-auth marker: ${marker}`);
}

for (const forbidden of [
  'auth.mfa',
  'challengeAndVerify',
  'MFA_REQUIRED',
  'aal2',
  'TOTP',
  'mfa_required',
]) {
  assert.equal(source.includes(forbidden), false, `MFA marker must be absent: ${forbidden}`);
}

assert.equal(source.includes('service_role'), false, 'A privileged key must never be embedded in the Web client');
assert.equal(source.includes('SUPABASE_SERVICE_ROLE_KEY'), false, 'A privileged key must never be embedded in the Web client');

console.log('PASS: Web simple authentication, revision and idempotency contract');
