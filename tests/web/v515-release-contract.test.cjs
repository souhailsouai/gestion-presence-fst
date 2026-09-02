const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

function text(p){assert.equal(fs.existsSync(p),true,p);return fs.readFileSync(p,'utf8');}

test('V5.15 release workflows and Windows project are versioned and feature-branch aware',()=>{
  const web=text('.github/workflows/build-web.yml');
  const win=text('.github/workflows/build-windows-online.yml');
  const csproj=text('windows/GestionPresenceFSTOnline/GestionPresenceFSTOnline.csproj');
  for(const yml of [web,win]) assert.match(yml,/feature\/v5\.15-session-selection/);
  for(const marker of ['web/v515-api.js','web/v515-teacher-ui.js','web/v515-admin-ui.js','web/v515-runtime.js']) assert.match(web,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),marker);
  for(const marker of ['FSTV515Api','FSTV515TeacherUI','FSTV515AdminUI','FSTV515','v515_submit_request','v515_finalize_cycle']) assert.match(web,new RegExp(marker),marker);
  assert.match(web,/Gestion-Presence-FST-Web-v5\.15\.0\.html/);
  assert.match(web,/Gestion-Presence-FST-Web-v5\.15\.0/);
  assert.match(win,/Gestion-Presence-FST-Windows-v5\.15\.0\.exe/);
  assert.match(win,/Gestion-Presence-FST-Windows-v5\.15\.0\.zip/);
  assert.match(csproj,/<Version>5\.15\.0<\/Version>/);
  assert.match(csproj,/<FileVersion>5\.15\.0\.0<\/FileVersion>/);
  assert.match(csproj,/<AssemblyVersion>5\.15\.0\.0<\/AssemblyVersion>/);
});

test('V5.15 database CI uses PostgreSQL 17 and a disposable bootstrap',()=>{
  const yml=text('.github/workflows/test-v515-database.yml');
  const bootstrap=text('.github/fixtures/v515-ci-bootstrap.sql');
  assert.match(yml,/postgres:17/);
  assert.match(yml,/v515-ci-bootstrap\.sql/);
  assert.match(yml,/20260902190000_v515_planning_schema\.sql/);
  assert.match(yml,/supabase\/tests\/v515_\*\.sql/);
  assert.match(yml,/ON_ERROR_STOP=1/);
  assert.match(bootstrap,/create\s+schema\s+(if\s+not\s+exists\s+)?auth/i);
  assert.match(bootstrap,/function\s+auth\.uid/i);
  assert.match(bootstrap,/current_user_is_admin/i);
});
