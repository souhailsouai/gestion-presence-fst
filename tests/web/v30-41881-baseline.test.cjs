const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');

function gitBlobSha(content){
  const body=Buffer.from(content);
  const header=Buffer.from('blob '+body.length+'\0');
  return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');
}

test('MPI-PC1 baseline remains exactly commit 41881 index blob',()=>{
  const source=fs.readFileSync('index.html');
  const normalized=Buffer.from(source.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
  assert.equal(gitBlobSha(normalized),'216fa2171551ca5ffb8a785b2801dba1efad7e0c');
});

test('teacher attendance fix is isolated from baseline',()=>{
  const source=fs.readFileSync('web/v30-teacher-attendance-fix.js','utf8');
  assert.match(source,/Présences et absences enregistrées avec succès/);
  assert.match(source,/onConflict:'session_id,student_id'/);
  assert.match(source,/materialize\(s\)/);
  assert.match(source,/V22TeacherAttendanceAccess/);
});

test('LPC3 remains a separate extension',()=>{
  const source=fs.readFileSync('web/v30-lpc3.js','utf8');
  assert.match(source,/presence-lpc3/);
  assert.match(source,/TP Ondes et Vibrations/);
  assert.match(source,/Salle Onde/);
});
