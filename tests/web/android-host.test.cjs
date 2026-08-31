const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const activityPath = path.join(root, 'app-native', 'src', 'main', 'java', 'tn', 'utm', 'fst', 'gestionpresence', 'nativeapp', 'MainActivity.kt');
const sessionStorePath = path.join(root, 'app-native', 'src', 'main', 'java', 'tn', 'utm', 'fst', 'gestionpresence', 'nativeapp', 'core', 'security', 'SecureSessionStore.kt');
const apiClientPath = path.join(root, 'app-native', 'src', 'main', 'java', 'tn', 'utm', 'fst', 'gestionpresence', 'nativeapp', 'data', 'remote', 'OnlineApiClient.kt');
const workflowPath = path.join(root, '.github', 'workflows', 'verify-native-android.yml');

assert.ok(fs.existsSync(activityPath), 'Native Android MainActivity.kt is required');
assert.ok(fs.existsSync(sessionStorePath), 'Encrypted session store is required');
assert.ok(fs.existsSync(apiClientPath), 'Online API client is required');
assert.ok(fs.existsSync(workflowPath), 'Native Android verification workflow is required');

const activity = fs.readFileSync(activityPath, 'utf8');
const sessionStore = fs.readFileSync(sessionStorePath, 'utf8');
const apiClient = fs.readFileSync(apiClientPath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');

assert.ok(activity.includes('setContent { AppRoot() }'), 'MainActivity must host the native Compose root');
assert.ok(!activity.includes('WebView'), 'The native Android application must not use WebView');
assert.ok(sessionStore.includes('AndroidKeyStore'), 'Sessions must be protected by Android Keystore');
assert.ok(sessionStore.includes('AES/GCM/NoPadding'), 'Sessions must use authenticated AES-GCM encryption');
assert.ok(apiClient.includes('/functions/v1/pin-login'), 'Authentication must use the shared online PIN endpoint');
assert.ok(apiClient.includes('save_attendance_sheet'), 'Attendance writes must use the versioned shared RPC');
assert.ok(!apiClient.includes('/auth/v1/factors/'), 'MFA factor API must not be required when MFA is disabled');
assert.ok(apiClient.includes('La double authentification est désactivée.'), 'Android client must explicitly disable MFA enrollment');
assert.ok(workflow.includes(':app-native:testDebugUnitTest'), 'The native Android workflow must run unit tests');
assert.ok(workflow.includes(':app-native:lintDebug'), 'The native Android workflow must run lint');
assert.ok(workflow.includes(':app-native:assembleDebug'), 'The native Android workflow must build an installable APK');
