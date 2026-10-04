(function initV31Domain(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FSTV31Domain = api;
})(typeof window !== 'undefined' ? window : globalThis, function createV31Domain() {
  'use strict';

  const ENV_MPI1_PC1 = 'MPI1_PC1';
  const ENV_LPC3 = 'LPC3';
  const RECOGNIZED_STATUSES = Object.freeze(['present', 'retard', 'absent', 'justifie']);
  const PRESENT_STATUSES = new Set(['present', 'retard']);
  const ABSENT_STATUSES = new Set(['absent', 'justifie']);
  const GRADE_ORIGIN_MANUAL = 'manual';
  const GRADE_ORIGIN_ABSENCE_AUTO = 'absence_auto';
  const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'annule', 'annulee', 'annulé', 'annulée', 'pause']);

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function environmentForClass(row) {
    const moduleName = text(row && row.module).toLocaleLowerCase('fr');
    const track = text(row && row.track).toUpperCase();
    const name = text(row && row.name).toUpperCase();
    if (moduleName.includes('ondes et vibrations') || track === 'LPC' || /^LPC3(?:-|$)/.test(name)) {
      return ENV_LPC3;
    }
    return ENV_MPI1_PC1;
  }

  function normalizeStatus(value) {
    const status = text(value).toLocaleLowerCase('fr');
    return RECOGNIZED_STATUSES.includes(status) ? status : null;
  }

  function rowIsCancelled(row) {
    if (!row) return false;
    if (row.cancelled === true || row.canceled === true) return true;
    const values = [row.session_status, row.plan_status, row.status_session, row.sessionState];
    return values.some((value) => CANCELLED_STATUSES.has(text(value).toLocaleLowerCase('fr')));
  }

  function rowIsApplicable(row, options) {
    if (!row || row.applicable === false || rowIsCancelled(row)) return false;
    const requestedEnvironment = text(options && options.environment);
    const rowEnvironment = text(row.environment);
    if (requestedEnvironment && rowEnvironment && requestedEnvironment !== rowEnvironment) return false;
    return true;
  }

  function summarizeAttendance(rows, options) {
    const source = Array.isArray(rows) ? rows : [];
    const applicableRows = source.filter((row) => rowIsApplicable(row, options || {}));
    const counts = { present: 0, late: 0, absent: 0, justified: 0 };

    for (const row of applicableRows) {
      const status = normalizeStatus(row && row.status);
      if (status === 'present') counts.present += 1;
      else if (status === 'retard') counts.late += 1;
      else if (status === 'absent') counts.absent += 1;
      else if (status === 'justifie') counts.justified += 1;
    }

    const countedSessions = counts.present + counts.late + counts.absent + counts.justified;
    const presenceCount = counts.present + counts.late;
    const absenceCount = counts.absent + counts.justified;
    const presencePercent = countedSessions === 0 ? 0 : (presenceCount / countedSessions) * 100;
    const absencePercent = countedSessions === 0 ? 0 : (absenceCount / countedSessions) * 100;

    return Object.freeze({
      applicableSessions: applicableRows.length,
      countedSessions,
      unrecordedSessions: Math.max(0, applicableRows.length - countedSessions),
      present: counts.present,
      late: counts.late,
      absent: counts.absent,
      unjustifiedAbsences: counts.absent,
      justified: counts.justified,
      justifiedAbsences: counts.justified,
      presenceCount,
      absenceCount,
      totalAbsences: absenceCount,
      presencePercent,
      absencePercent,
    });
  }

  function validateGrade(value) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
      return { valid: true, value: null, kind: 'missing' };
    }
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 20) {
      return { valid: false, value: null, kind: 'invalid', message: 'La note doit être comprise entre 0 et 20.' };
    }
    return { valid: true, value: numeric, kind: 'grade' };
  }

  function normalizeGradeOrigin(origin, grade) {
    const value = text(origin);
    if (value === GRADE_ORIGIN_MANUAL || value === GRADE_ORIGIN_ABSENCE_AUTO) return value;
    return grade === null || grade === undefined ? null : GRADE_ORIGIN_MANUAL;
  }

  function applyAttendanceGradeRule(input) {
    const row = input || {};
    const status = normalizeStatus(row.status);
    const parsed = validateGrade(row.grade);
    if (!parsed.valid) return { ...parsed, status };
    const originalGrade = parsed.value;
    const originalOrigin = normalizeGradeOrigin(row.gradeOrigin || row.origin, originalGrade);
    const backupParsed = validateGrade(row.manualGradeBackup);
    const originalBackup = backupParsed.valid ? backupParsed.value : null;

    if (status === 'absent') {
      const backup = originalOrigin === GRADE_ORIGIN_MANUAL ? originalGrade : originalBackup;
      return Object.freeze({
        valid: true,
        status,
        grade: 0,
        gradeOrigin: GRADE_ORIGIN_ABSENCE_AUTO,
        manualGradeBackup: backup,
        locked: true,
      });
    }

    if (status === 'justifie') {
      const backup = originalOrigin === GRADE_ORIGIN_MANUAL ? originalGrade : originalBackup;
      return Object.freeze({
        valid: true,
        status,
        grade: null,
        gradeOrigin: null,
        manualGradeBackup: backup,
        locked: true,
      });
    }

    if (status === 'present' || status === 'retard') {
      if (originalOrigin === GRADE_ORIGIN_ABSENCE_AUTO) {
        return Object.freeze({
          valid: true,
          status,
          grade: originalBackup,
          gradeOrigin: originalBackup === null ? null : GRADE_ORIGIN_MANUAL,
          manualGradeBackup: null,
          locked: false,
        });
      }
      return Object.freeze({
        valid: true,
        status,
        grade: originalGrade,
        gradeOrigin: originalOrigin,
        manualGradeBackup: originalBackup,
        locked: false,
      });
    }

    return Object.freeze({
      valid: true,
      status,
      grade: originalGrade,
      gradeOrigin: originalOrigin,
      manualGradeBackup: originalBackup,
      locked: false,
    });
  }

  function gradeKey(environment, studentId, manipulationId) {
    return [text(environment), text(studentId), text(manipulationId)].join('|');
  }

  function indexGrades(rows) {
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row) continue;
      const key = gradeKey(row.environment, row.student_id, row.manipulation_id || row.manipulation_code);
      if (key !== '||') map.set(key, row);
    }
    return map;
  }

  function indexAttendance(rows, studentId) {
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || (studentId && text(row.student_id) !== text(studentId))) continue;
      if (row.session_id) map.set(text(row.session_id), row);
    }
    return map;
  }

  function safeTime(value) { return text(value).slice(0, 8); }
  function sessionSortKey(row) {
    return [text(row && row.session_date), safeTime(row && row.start_time), text(row && row.id)].join('|');
  }

  function buildStudentHistory(input) {
    const data = input || {};
    const student = data.student || {};
    const environment = text(data.environment) || ENV_MPI1_PC1;
    const attendanceBySession = indexAttendance(data.attendance, student.id);
    const gradeByKey = indexGrades(data.grades);
    const sessions = (Array.isArray(data.sessions) ? data.sessions : [])
      .filter((session) => rowIsApplicable(session, { environment }))
      .sort((a, b) => sessionSortKey(a).localeCompare(sessionSortKey(b)));

    const rows = sessions.map((session) => {
      const attendance = attendanceBySession.get(text(session.id)) || null;
      const manipulationId = session.manipulation_id || session.manipulation_code || (session.manipulation && (session.manipulation.id || session.manipulation.code)) || null;
      const manipulationCode = session.manipulation_code || (session.manipulation && session.manipulation.code) || manipulationId;
      const gradeRow = manipulationId ? gradeByKey.get(gradeKey(environment, student.id, manipulationId)) || null : null;
      const grade = gradeRow && gradeRow.grade !== undefined && gradeRow.grade !== null ? Number(gradeRow.grade) : null;

      return Object.freeze({
        studentId: student.id || null,
        sessionId: session.id || null,
        sessionDate: session.session_date || null,
        startTime: session.start_time || null,
        classId: session.class_id || null,
        className: session.class_name || null,
        groupName: session.group_name || session.class_name || null,
        manipulationId,
        manipulationCode,
        manipulationLabel: session.manipulation_label || manipulationCode,
        status: normalizeStatus(attendance && attendance.status),
        comment: attendance && attendance.comment ? attendance.comment : '',
        grade,
        gradeEntered: grade !== null,
        gradeOrigin: gradeRow && (gradeRow.grade_origin || gradeRow.origin) || null,
        attendanceId: attendance && attendance.id ? attendance.id : null,
        gradeId: gradeRow && gradeRow.id ? gradeRow.id : null,
        environment,
        applicable: true,
      });
    });

    return Object.freeze({
      student: Object.freeze({ ...student }),
      environment,
      rows: Object.freeze(rows),
      summary: summarizeAttendance(rows, { environment }),
    });
  }

  function formatPercent(value, digits) {
    const numeric = Number(value);
    const decimals = Number.isInteger(digits) ? Math.max(0, Math.min(3, digits)) : 1;
    return `${Number.isFinite(numeric) ? numeric.toFixed(decimals) : (0).toFixed(decimals)} %`;
  }

  return Object.freeze({
    ENV_MPI1_PC1,
    ENV_LPC3,
    RECOGNIZED_STATUSES,
    PRESENT_STATUSES,
    ABSENT_STATUSES,
    GRADE_ORIGIN_MANUAL,
    GRADE_ORIGIN_ABSENCE_AUTO,
    environmentForClass,
    normalizeStatus,
    summarizeAttendance,
    validateGrade,
    applyAttendanceGradeRule,
    gradeKey,
    indexGrades,
    buildStudentHistory,
    formatPercent,
  });
});
