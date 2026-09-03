const test=require('node:test');
const assert=require('node:assert/strict');
const data=require('../../web/v515-planning-2026-2027.js');

function teachingDates(className){
  return data.calendarRows.filter(r=>r.isTeachingSession&&r.className===className).map(r=>r.date);
}

test('approved pair starts and no-TP dates are preserved',()=>{
  assert.equal(teachingDates('MPI1-A')[0],'2026-09-14');
  assert.equal(teachingDates('MPI1-E')[0],'2026-09-21');
  assert.equal(teachingDates('MPI1-C')[0],'2026-09-17');
  assert.equal(teachingDates('MPI1-D')[0],'2026-09-24');
  assert.equal(teachingDates('MPI1-B')[0],'2026-09-18');
  assert.equal(teachingDates('PC1-A')[0],'2026-09-25');
  for(const date of ['2026-10-15','2026-11-02','2026-11-05','2026-11-06']){
    const row=data.calendarRows.find(r=>r.date===date);
    assert.equal(row.isTeachingSession,false,date);
    assert.equal(row.className,null,date);
  }
});

test('MPI1-A and MPI1-B complete six manipulations',()=>{
  assert.equal(data.completeness['MPI1-A'].complete,true);
  assert.equal(data.completeness['MPI1-B'].complete,true);
});

test('four classes remain 5/6 with the approved missing sequence',()=>{
  const expected={1:['M6'],2:['M1'],3:['M2'],4:['M3']};
  for(const cls of ['MPI1-E','MPI1-C','MPI1-D','PC1-A']){
    const c=data.completeness[cls];
    assert.equal(c.complete,false,cls);
    for(let g=1;g<=4;g++){
      assert.equal(c.groups[g].completed,5,`${cls} G${g}`);
      assert.deepEqual(c.groups[g].missing,expected[g],`${cls} G${g}`);
    }
  }
});

test('PDF manipulation rooms are fixed',()=>{
  assert.deepEqual(data.manipulationRooms,{M1:'C',M2:'B',M3:'D',M4:'D',M5:'A',M6:'A'});
  for(const row of data.calendarRows.filter(r=>r.isTeachingSession)){
    for(const post of row.posts){
      assert.equal(post.room,data.manipulationRooms[post.manipulation],`${row.date} G${post.groupNo}`);
    }
  }
});

test('PDF daily teacher pools are preserved but do not fix teacher-to-manipulation assignment',()=>{
  assert.deepEqual(data.teacherPools.monday,['Khaoula Rais','Souhail Souai','Nadia Bouaziz','Olfa Turki']);
  assert.deepEqual(data.teacherPools.thursday,['Khaoula Rais','Souhail Souai','Tarek Sbeouelji','Mouna Triki']);
  assert.deepEqual(data.teacherPools.friday,['Nadia Bouaziz','Olfa Turki','Tarek Sbeouelji','Mouna Triki']);
  assert.equal(data.calendarRows.filter(r=>r.isTeachingSession).every(r=>Array.isArray(r.allowedTeachers)&&r.allowedTeachers.length===4),true);
  assert.equal(data.calendarRows.filter(r=>r.isTeachingSession).every(r=>r.posts.every(p=>p.teacherId==null)),true);
});
