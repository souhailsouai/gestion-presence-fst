const V17_CONFIG = Object.freeze({
  timezone: 'Africa/Tunis',
  teacherSheetId: '1HDenoJmRejeDWN3KQnkYc0zgWbxiuEsS99nyCDrXb7g',
  teacherTab: 'Enseignants',
  assignmentSheetId: '1yWsZl6sVnGs9OLlx74Sn7_wYyn8Uqe99Xkc4uxCjShc',
  assignmentTab: 'Affectation',
  assignmentTeacherSourceTab: 'Enseignants_Source',
  studentWorkbooks: [
    '1m2sxrQkoxFgwOSt8JAkOiONIWkVrOBFwqquO9w3-PvI',
    '1SZYVM78kP8RT2DCQuoV81r3dcmfOErwduWaDCb41WG0',
    '1mXYqpxUesjxiWTogZqE5XU1WWTxkIXQF_gYoRVN181M'
  ],
  studentFirstRow: 8,
  studentLastRow: 19,
  studentNameColumn: 2,
  studentStatusColumn: 25,
  studentIdColumn: 26,
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('V17 - Gestion présence')
    .addItem('Synchroniser les enseignants', 'v17SyncTeachers')
    .addItem('Valider les affectations M1-M6', 'v17ValidateAssignments')
    .addSeparator()
    .addItem('Préparer les identifiants étudiants', 'v17PrepareStudentIds')
    .addItem('Construire l’aperçu étudiants', 'v17PreviewStudents')
    .addSeparator()
    .addItem('Envoyer vers V17 TEST', 'v17PushSnapshotToTest')
    .addToUi();
}

function v17SyncTeachers() {
  const source = SpreadsheetApp.openById(V17_CONFIG.teacherSheetId)
    .getSheetByName(V17_CONFIG.teacherTab);
  const rows = source.getRange(1, 1, Math.max(source.getLastRow(), 1), 1).getDisplayValues();
  const teachers = v17NormalizeTeachers_(rows);
  if (teachers.issues.length) throw new Error(teachers.issues.join('\n'));

  const targetBook = SpreadsheetApp.openById(V17_CONFIG.assignmentSheetId);
  const target = targetBook.getSheetByName(V17_CONFIG.assignmentTeacherSourceTab);
  target.getRange('A1:A100').clearContent();
  target.getRange(1, 1, teachers.teachers.length + 1, 1)
    .setValues([['Enseignant']].concat(teachers.teachers.map((name) => [name])));
  SpreadsheetApp.flush();
  return teachers.teachers;
}

function v17ValidateAssignments() {
  const teachers = v17SyncTeachers();
  const sheet = SpreadsheetApp.openById(V17_CONFIG.assignmentSheetId)
    .getSheetByName(V17_CONFIG.assignmentTab);
  const raw = sheet.getRange('A4:E9').getDisplayValues();
  const rows = raw.map((row) => [row[0], row[3], row[4]]);
  const result = v17ValidateManipulationAssignments_(rows, teachers);
  const ui = SpreadsheetApp.getUi();
  if (result.ok) {
    ui.alert('V17', 'Affectations valides : 2 manipulations par enseignant.', ui.ButtonSet.OK);
  } else {
    ui.alert('V17 - Affectations à corriger', result.issues.join('\n'), ui.ButtonSet.OK);
  }
  return result;
}

function v17PrepareStudentIds() {
  let created = 0;
  V17_CONFIG.studentWorkbooks.forEach((id) => {
    const book = SpreadsheetApp.openById(id);
    book.getSheets().forEach((sheet) => {
      if (!v17IsStudentGroupSheet_(sheet.getName())) return;
      const count = V17_CONFIG.studentLastRow - V17_CONFIG.studentFirstRow + 1;
      const names = sheet.getRange(V17_CONFIG.studentFirstRow, V17_CONFIG.studentNameColumn, count, 1).getDisplayValues();
      const statuses = sheet.getRange(V17_CONFIG.studentFirstRow, V17_CONFIG.studentStatusColumn, count, 1).getDisplayValues();
      const ids = sheet.getRange(V17_CONFIG.studentFirstRow, V17_CONFIG.studentIdColumn, count, 1).getDisplayValues();
      const outStatus = [];
      const outId = [];
      for (let i = 0; i < count; i += 1) {
        const name = v17Clean_(names[i][0]);
        let studentId = v17Clean_(ids[i][0]);
        let status = v17Clean_(statuses[i][0]);
        if (name && !studentId) {
          studentId = Utilities.getUuid();
          status = 'ACTIVE';
          created += 1;
        } else if (name) {
          status = 'ACTIVE';
        } else if (!studentId) {
          status = '';
        }
        outStatus.push([status]);
        outId.push([studentId]);
      }
      sheet.getRange(V17_CONFIG.studentFirstRow, V17_CONFIG.studentStatusColumn, count, 1).setValues(outStatus);
      sheet.getRange(V17_CONFIG.studentFirstRow, V17_CONFIG.studentIdColumn, count, 1).setValues(outId);
    });
  });
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('V17', `${created} identifiant(s) étudiant créé(s).`, SpreadsheetApp.getUi().ButtonSet.OK);
  return created;
}

function v17PreviewStudents() {
  const students = [];
  const deletions = [];
  V17_CONFIG.studentWorkbooks.forEach((id) => {
    const book = SpreadsheetApp.openById(id);
    book.getSheets().forEach((sheet) => {
      const name = sheet.getName();
      if (!v17IsStudentGroupSheet_(name)) return;
      const parts = name.split(' G');
      const className = parts[0];
      const groupNo = Number(parts[1]);
      const count = V17_CONFIG.studentLastRow - V17_CONFIG.studentFirstRow + 1;
      const values = sheet.getRange(V17_CONFIG.studentFirstRow, 1, count, 26).getDisplayValues();
      values.forEach((row, offset) => {
        const studentName = v17Clean_(row[V17_CONFIG.studentNameColumn - 1]);
        const status = v17Clean_(row[V17_CONFIG.studentStatusColumn - 1]);
        const studentId = v17Clean_(row[V17_CONFIG.studentIdColumn - 1]);
        if (!studentName && status !== 'DELETE_REQUESTED') return;
        const item = {
          workbookId: id,
          sheet: name,
          row: V17_CONFIG.studentFirstRow + offset,
          studentId,
          name: studentName,
          className,
          groupNo,
          status: status || 'ACTIVE'
        };
        if (status === 'DELETE_REQUESTED') deletions.push(item);
        else students.push(item);
      });
    });
  });
  return { students, deletions };
}

function v17MarkStudentDeletion_(sheet, row, previousName) {
  const idCell = sheet.getRange(row, V17_CONFIG.studentIdColumn);
  const statusCell = sheet.getRange(row, V17_CONFIG.studentStatusColumn);
  let studentId = v17Clean_(idCell.getDisplayValue());
  if (!studentId) studentId = Utilities.getUuid();
  idCell.setValue(studentId);
  statusCell.setValue('DELETE_REQUESTED');
  statusCell.setNote(`Suppression définitive demandée pour : ${v17Clean_(previousName)}. La suppression réelle est exécutée uniquement après validation côté V17.`);
}

function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (!v17IsStudentGroupSheet_(sheet.getName())) return;
  if (e.range.getColumn() !== V17_CONFIG.studentNameColumn) return;
  if (e.range.getRow() < V17_CONFIG.studentFirstRow || e.range.getRow() > V17_CONFIG.studentLastRow) return;

  const oldName = v17Clean_(e.oldValue || '');
  const newName = v17Clean_(e.value || '');
  const idCell = sheet.getRange(e.range.getRow(), V17_CONFIG.studentIdColumn);
  const statusCell = sheet.getRange(e.range.getRow(), V17_CONFIG.studentStatusColumn);

  if (newName) {
    if (!v17Clean_(idCell.getDisplayValue())) idCell.setValue(Utilities.getUuid());
    statusCell.setValue('ACTIVE').clearNote();
    return;
  }
  if (oldName) v17MarkStudentDeletion_(sheet, e.range.getRow(), oldName);
}

function v17PushSnapshotToTest() {
  const validation = v17ValidateAssignments();
  if (!validation.ok) throw new Error('Les affectations enseignants doivent être valides avant envoi vers TEST.');

  const props = PropertiesService.getScriptProperties();
  const endpoint = props.getProperty('V17_TEST_ENDPOINT');
  const token = props.getProperty('V17_SYNC_TOKEN');
  if (!endpoint || !token) {
    throw new Error('Configurer V17_TEST_ENDPOINT et V17_SYNC_TOKEN dans les propriétés du script.');
  }

  const students = v17PreviewStudents();
  const payload = {
    source: 'google_apps_script',
    timezone: V17_CONFIG.timezone,
    generatedAt: new Date().toISOString(),
    assignments: v17AssignmentSnapshot_(),
    students: students.students,
    permanentDeletionRequests: students.deletions
  };

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-V17-Sync-Token': token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(`V17 TEST a répondu HTTP ${code}: ${response.getContentText()}`);
  SpreadsheetApp.getUi().alert('V17', 'Snapshot envoyé vers V17 TEST. Aucun changement RÉEL automatique.', SpreadsheetApp.getUi().ButtonSet.OK);
  return response.getContentText();
}

function v17AssignmentSnapshot_() {
  const sheet = SpreadsheetApp.openById(V17_CONFIG.assignmentSheetId)
    .getSheetByName(V17_CONFIG.assignmentTab);
  return sheet.getRange('A4:E9').getDisplayValues().map((row) => ({
    manipulation: v17Clean_(row[0]),
    title: v17Clean_(row[1]),
    room: v17Clean_(row[2]),
    teacher1: v17Clean_(row[3]),
    teacher2: v17Clean_(row[4])
  }));
}

function v17NormalizeTeachers_(rows) {
  const seen = {};
  const teachers = [];
  const issues = [];
  for (let i = 1; i < rows.length; i += 1) {
    const name = v17Clean_(rows[i][0]);
    const key = name.toLowerCase();
    if (!name || seen[key]) continue;
    seen[key] = true;
    teachers.push(name);
  }
  if (teachers.length !== 6) issues.push(`Le fichier Enseignants doit contenir exactement 6 enseignants actifs (actuel: ${teachers.length}).`);
  return { teachers, issues };
}

function v17ValidateManipulationAssignments_(rows, teachers) {
  const allowed = {};
  const counts = {};
  teachers.forEach((name) => { allowed[name] = true; counts[name] = 0; });
  const issues = [];
  const seen = {};
  rows.forEach((raw) => {
    const manipulation = v17Clean_(raw[0]);
    const teacher1 = v17Clean_(raw[1]);
    const teacher2 = v17Clean_(raw[2]);
    if (!/^M[1-6]$/.test(manipulation)) {
      issues.push(`Manipulation invalide: ${manipulation || '(vide)'}.`);
      return;
    }
    if (seen[manipulation]) issues.push(`${manipulation} apparaît plusieurs fois.`);
    seen[manipulation] = true;
    if (!teacher1 || !teacher2) issues.push(`${manipulation} doit avoir deux enseignants.`);
    if (teacher1 && teacher1 === teacher2) issues.push(`${manipulation} doit avoir deux enseignants distincts.`);
    [teacher1, teacher2].forEach((teacher) => {
      if (!teacher) return;
      if (!allowed[teacher]) issues.push(`${teacher} n'existe pas dans le fichier Enseignants.`);
      else counts[teacher] += 1;
    });
  });
  Object.keys(counts).forEach((name) => {
    if (counts[name] !== 2) issues.push(`${name} doit être affecté à exactement 2 manipulations (actuel: ${counts[name]}).`);
  });
  for (let i = 1; i <= 6; i += 1) if (!seen[`M${i}`]) issues.push(`M${i} est absente.`);
  return { ok: issues.length === 0, counts, issues };
}

function v17IsStudentGroupSheet_(name) {
  return /^(?:MPI1-[A-E]|PC1-A) G[1-4]$/.test(v17Clean_(name));
}

function v17Clean_(value) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}
