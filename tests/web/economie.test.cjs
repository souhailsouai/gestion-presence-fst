'use strict';
// V55 : lectures différentielles et pause quand personne ne regarde (quota Supabase).
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const E=require(path.join(__dirname,'..','..','web','v55-economie.js'));
test('Fusion : modifiée remplacée, supprimée retirée, nouvelle ajoutée, ordre respecté',()=>{
  const rows=[{id:'1',n:'B',deleted_at:null},{id:'2',n:'A',deleted_at:null}];
  const out=E.merge(rows,[{id:'1',n:'Z',deleted_at:null},{id:'2',n:'A',deleted_at:'2026-11-28'},{id:'3',n:'C',deleted_at:null}],true,[['n','asc']]);
  assert.deepEqual(out.map(r=>r.id+r.n),['3C','1Z']);
  assert.equal(E.merge(rows,[{id:'2',deleted_at:'x'}],false,[]).length,2,'sans filtre deleted_at, la ligne reste (comme le serveur la renverrait)');
});
test('Date la plus récente et ordre',()=>{
  assert.equal(E.newest([{updated_at:'2026-11-01T00:00:00Z'},{updated_at:'2026-11-28T08:00:00Z'},{}]),'2026-11-28T08:00:00Z');
  assert.deepEqual(E.parseOrder('full_name.asc,created_at.desc'),[['full_name','asc'],['created_at','desc']]);
  assert.equal(E.parseOrder('name.asc.nullslast'),null,'ordre particulier : pas de lecture différentielle');
});
test('Seules les lectures complètes et simples sont gardées',()=>{
  const b=(q,h={})=>({method:'GET',url:new URL('http://x/rest/v1/attendance?'+q),headers:new Headers(h)});
  assert.equal(E.eligible(b('select=*&deleted_at=is.null')),true);
  assert.equal(E.eligible(b('select=*&limit=5')),false);
  assert.equal(E.eligible(b('select=*',{Prefer:'count=exact'})),false);
  assert.equal(E.eligible(b('select=*',{Accept:'application/vnd.pgrst.object+json'})),false);
  assert.equal(E.eligible(b('select=id,name')),false,'colonnes choisies sans updated_at');
  assert.equal(E.eligible({method:'POST',url:new URL('http://x/rest/v1/attendance'),headers:new Headers()}),false);
});
test('Pause, déconnexion après 2 h, chargé par la page',()=>{
  const js=fs.readFileSync(path.join(__dirname,'..','..','web','v55-economie.js'),'utf8');
  assert.ok(js.includes("visibilitychange")&&js.includes('stopRealtime')&&js.includes('2*60*60*1000'));
  assert.ok(js.includes('.v50-bar[data-state="dirty"]'),'jamais de déconnexion pendant un appel non enregistré');
  assert.ok(fs.readFileSync(path.join(__dirname,'..','..','web','index.html'),'utf8').includes('v55-economie.js'));
});
