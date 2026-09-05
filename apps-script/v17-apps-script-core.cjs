'use strict';

function clean(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeachers(rows) {
  const seen = new Set();
  const teachers = [];
  const issues = [];
  for (let i = 1; i < (rows || []).length; i += 1) {
    const name = clean(rows[i] && rows[i][0]);
    if (!name || seen.has(name.toLocaleLowerCase('fr'))) continue;
    seen.add(name.toLocaleLowerCase('fr'));
    teachers.push(name);
  }
  if (teachers.length !== 6) {
    issues.push(`Le fichier Enseignants doit contenir exactement 6 enseignants actifs (actuel: ${teachers.length}).`);
  }
  return { teachers, issues };
}

function validateManipulationAssignments(rows, teachers) {
  const allowed = new Set((teachers || []).map(clean));
  const counts = Object.fromEntries((teachers || []).map((name) => [clean(name), 0]));
  const issues = [];
  const seenManipulations = new Set();

  for (const raw of rows || []) {
    const manipulation = clean(raw && raw[0]);
    const teacher1 = clean(raw && raw[1]);
    const teacher2 = clean(raw && raw[2]);
    if (!/^M[1-6]$/.test(manipulation)) {
      issues.push(`Manipulation invalide: ${manipulation || '(vide)'}.`);
      continue;
    }
    if (seenManipulations.has(manipulation)) issues.push(`${manipulation} apparaît plusieurs fois.`);
    seenManipulations.add(manipulation);
    if (!teacher1 || !teacher2) issues.push(`${manipulation} doit avoir deux enseignants.`);
    if (teacher1 && teacher1 === teacher2) issues.push(`${manipulation} doit avoir deux enseignants distincts.`);
    for (const teacher of [teacher1, teacher2]) {
      if (!teacher) continue;
      if (!allowed.has(teacher)) {
        issues.push(`${teacher} n'existe pas dans le fichier Enseignants.`);
      } else {
        counts[teacher] += 1;
      }
    }
  }

  for (const name of Object.keys(counts)) {
    if (counts[name] !== 2) issues.push(`${name} doit être affecté à exactement 2 manipulations (actuel: ${counts[name]}).`);
  }
  for (let i = 1; i <= 6; i += 1) {
    if (!seenManipulations.has(`M${i}`)) issues.push(`M${i} est absente.`);
  }
  return { ok: issues.length === 0, counts, issues };
}

function reconcileStudentEdit({ oldName, newName, studentId, idFactory }) {
  const before = clean(oldName);
  const after = clean(newName);
  let id = clean(studentId);
  if (after) {
    if (!id) id = clean(idFactory());
    return { action: 'UPSERT', name: after, studentId: id, status: 'ACTIVE' };
  }
  if (before && id) {
    return { action: 'DELETE_PERMANENT', name: '', studentId: id, status: 'DELETE_REQUESTED' };
  }
  return { action: 'NOOP', name: '', studentId: id, status: id ? 'INACTIVE' : '' };
}

function isStudentGroupSheet(name) {
  return /^(?:MPI1-[A-E]|PC1-A) G[1-4]$/.test(clean(name));
}

module.exports = {
  clean,
  normalizeTeachers,
  validateManipulationAssignments,
  reconcileStudentEdit,
  isStudentGroupSheet,
};
