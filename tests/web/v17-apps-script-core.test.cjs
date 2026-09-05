const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTeachers,
  validateManipulationAssignments,
  reconcileStudentEdit,
  isStudentGroupSheet,
} = require('../../apps-script/v17-apps-script-core.cjs');

test('normalizeTeachers keeps the six unique existing teacher accounts', () => {
  const result = normalizeTeachers([
    ['Enseignant'],
    [' Nadia Bouaziz '],
    ['Olfa Turki'],
    ['Souhail Souai'],
    ['Khaoula Rais'],
    ['Tarek Sbeouelji'],
    ['Mouna Triki'],
    ['Nadia Bouaziz'],
    [''],
  ]);
  assert.deepEqual(result.teachers, [
    'Nadia Bouaziz', 'Olfa Turki', 'Souhail Souai',
    'Khaoula Rais', 'Tarek Sbeouelji', 'Mouna Triki'
  ]);
  assert.deepEqual(result.issues, []);
});

test('validateManipulationAssignments requires two distinct teachers per manipulation and two manipulations per teacher', () => {
  const teachers = ['Nadia Bouaziz','Olfa Turki','Souhail Souai','Khaoula Rais','Tarek Sbeouelji','Mouna Triki'];
  const rows = [
    ['M1','Khaoula Rais','Nadia Bouaziz'],
    ['M2','Olfa Turki','Tarek Sbeouelji'],
    ['M3','Souhail Souai','Mouna Triki'],
    ['M4','Khaoula Rais','Olfa Turki'],
    ['M5','Tarek Sbeouelji','Souhail Souai'],
    ['M6','Mouna Triki','Nadia Bouaziz'],
  ];
  const result = validateManipulationAssignments(rows, teachers);
  assert.equal(result.ok, true);
  assert.deepEqual(result.counts, {
    'Nadia Bouaziz': 2,
    'Olfa Turki': 2,
    'Souhail Souai': 2,
    'Khaoula Rais': 2,
    'Tarek Sbeouelji': 2,
    'Mouna Triki': 2,
  });
  assert.deepEqual(result.issues, []);
});

test('reconcileStudentEdit assigns a stable id when a student is added', () => {
  const result = reconcileStudentEdit({
    oldName: '', newName: ' Etudiant Test ', studentId: '', idFactory: () => 'uuid-1'
  });
  assert.deepEqual(result, {
    action: 'UPSERT', name: 'Etudiant Test', studentId: 'uuid-1', status: 'ACTIVE'
  });
});

test('reconcileStudentEdit requests permanent deletion when a populated student name is cleared', () => {
  const result = reconcileStudentEdit({
    oldName: 'Etudiant Test', newName: '', studentId: 'uuid-1', idFactory: () => 'unused'
  });
  assert.deepEqual(result, {
    action: 'DELETE_PERMANENT', name: '', studentId: 'uuid-1', status: 'DELETE_REQUESTED'
  });
});

test('group sheet names are recognized without matching Planning tabs', () => {
  assert.equal(isStudentGroupSheet('MPI1-A G1'), true);
  assert.equal(isStudentGroupSheet('MPI1-E G4'), true);
  assert.equal(isStudentGroupSheet('PC1-A G2'), true);
  assert.equal(isStudentGroupSheet('Planning'), false);
});
