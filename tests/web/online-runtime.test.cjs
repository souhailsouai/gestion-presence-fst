const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='web/online-runtime.js';

test('online runtime exists and has no offline persistence',()=>{
  assert.equal(fs.existsSync(p),true);
  const js=fs.readFileSync(p,'utf8');
  for(const forbidden of ['localStorage.setItem(QUEUE_KEY','saveCache()','loadCache()','sync_queue','sync_conflicts','Microsoft.Data.Sqlite']) assert.equal(js.includes(forbidden),false,forbidden);
  assert.match(js,/Connexion Internet requise/);
  assert.match(js,/classes.*students.*sessions.*attendance/s);
  assert.match(js,/postgres_changes/);
  assert.match(js,/refreshAuthoritativeState/);
  assert.equal(/location\.reload\s*\(/.test(js),false);
});
