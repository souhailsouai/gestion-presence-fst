const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.existsSync('web/v16-planning-editor.js')?fs.readFileSync('web/v16-planning-editor.js','utf8'):'';
let api=null;
try{api=require('../../web/v16-planning-editor.js');}catch(_){api=null;}

test('manual planning editor module exists and exposes render/save API',()=>{
  assert.ok(source.length>0,'v16-planning-editor.js missing');
  assert.ok(api,'editor cannot be loaded');
  assert.equal(typeof api.render,'function');
  assert.equal(typeof api.saveDirtyWeeks,'function');
});

test('editor exposes Admin teacher manipulation and room controls',()=>{
  const rendered=api.render({
    isAdmin:true,
    row:{date:'2026-09-14',className:'MPI1-A'},
    group:{groupNo:1,teacherId:'teacher-1',manipulation:'M3',room:null},
    teachers:[{id:'teacher-1',full_name:'Enseignant 1'}]
  });
  assert.equal(rendered.editable,true);
  assert.match(rendered.teacher,/data-v16-edit-teacher/);
  assert.match(rendered.manipulation,/data-v16-edit-manipulation/);
  assert.match(rendered.manipulation,/M1/);
  assert.match(rendered.manipulation,/M6/);
  assert.match(rendered.room,/data-v16-edit-room/);
  assert.match(rendered.room,/À choisir/);
  assert.match(rendered.room,/Salle A/);
  assert.match(source,/canUseAdminControls/);
});

test('editor saves complete weeks to context-specific RPCs',()=>{
  assert.match(source,/v16_save_week_plan/);
  assert.match(source,/v16_save_test_week_plan/);
  assert.match(source,/p_week_start/);
  assert.match(source,/p_rows/);
  assert.match(source,/dirtyWeeks/);
});

test('editor checks manipulation history across the complete planning state before any week save',async()=>{
  const planningState={rows:[
    {date:'2026-09-14',className:'MPI1-A',isTeachingSession:true,groups:[{groupNo:1,manipulation:'M1'}]},
    {date:'2026-09-28',className:'MPI1-A',isTeachingSession:true,groups:[{groupNo:1,manipulation:'M1'}]}
  ]};
  api.configure({planningState,teachers:[],supabaseClient:{rpc:async()=>({data:{ok:true},error:null})},context:'real'});
  await assert.rejects(
    ()=>api.saveDirtyWeeks({isAdmin:true}),
    error=>error&&error.code==='REPEATED_GROUP_MANIPULATION'
  );
});

test('editor table binding is idempotent across filter refreshes',()=>{
  assert.match(source,/data-v16-editor-bound/);
  assert.match(source,/getAttribute\(['"]data-v16-editor-bound['"]\)/);
  assert.match(source,/setAttribute\(['"]data-v16-editor-bound['"],['"]true['"]\)/);
});

test('teacher mode is read-only and cannot mount edit controls',()=>{
  const rendered=api.render({
    isAdmin:false,
    row:{date:'2026-09-14',className:'MPI1-A'},
    group:{groupNo:1,teacherId:'teacher-1',manipulation:'M2',room:'B'},
    teachers:[{id:'teacher-1',full_name:'Enseignant 1'}]
  });
  assert.equal(rendered.editable,false);
  assert.doesNotMatch(rendered.teacher,/data-v16-edit-|<select/i);
  assert.doesNotMatch(rendered.manipulation,/data-v16-edit-|<select/i);
  assert.doesNotMatch(rendered.room,/data-v16-edit-|<select/i);
  assert.equal(api.toolbar(false),'');
});
