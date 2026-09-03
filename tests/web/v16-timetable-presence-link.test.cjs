const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='web/v16-timetable-presence-link.js';
const source=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
let api=null;
try{api=require('../../web/v16-timetable-presence-link.js');}catch(_){api=null;}

test('V16 timetable module exposes real-session renderer and presence opener',()=>{
  assert.ok(source.length>0,'timetable link module missing');
  assert.ok(api);
  assert.equal(typeof api.openPresenceForSession,'function');
  assert.equal(typeof api.renderTimetableSessions,'function');
});

test('presence opener activates Presence, selects exact session and reuses existing loader',()=>{
  assert.match(source,/options\.switchTab\|\|root\.switchTab/);
  assert.match(source,/switchFn\s*\(\s*['"]presence['"]\s*\)/);
  assert.match(source,/presence-session/);
  assert.match(source,/select\.value\s*=\s*String\(sessionId\)|\.value\s*=\s*String\(sessionId\)/);
  assert.match(source,/options\.loadPresenceSheet\|\|root\.loadPresenceSheet/);
  assert.match(source,/loadFn\s*\(\s*\)/);
  assert.doesNotMatch(source,/from\s*\(\s*['"]attendance['"]\s*\)/);
  assert.doesNotMatch(source,/fetchRemoteData\s*\(/);
});

test('timetable renders one action per real session using session id',()=>{
  assert.match(source,/data-v16-timetable-session/);
  assert.match(source,/data-v16-open-presence/);
  assert.match(source,/session\.id|s\.id/);
  assert.match(source,/Date/);
  assert.match(source,/Horaire/);
  assert.match(source,/Groupe/);
  assert.match(source,/Présence/);
});

test('module replaces the legacy recurring timetable renderer when loaded in browser',()=>{
  assert.match(source,/renderMyTimetable/);
  assert.match(source,/renderTimetableSessions/);
  assert.match(source,/emploi-content/);
});

test('online and standalone builders include the timetable presence module',()=>{
  const online=fs.readFileSync('scripts/build_online_web.py','utf8');
  const standalone=fs.readFileSync('scripts/build_single_file_release.py','utf8');
  assert.match(online,/v16-timetable-presence-link\.js/);
  assert.match(standalone,/v16-timetable-presence-link\.js/);
  assert.match(standalone,/data-fst-v16-timetable-presence-link="inline"/);
});
