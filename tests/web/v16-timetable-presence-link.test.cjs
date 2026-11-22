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

