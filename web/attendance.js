(() => {
  'use strict';
  const FSTApp = window.FSTApp = window.FSTApp || {};
  const attendance = FSTApp.attendance = FSTApp.attendance || {};
  const sheets = new Map();

  function normalizeSheet(sessionId, result) {
    const sheet = {
      sessionId: String(sessionId),
      revision: Number(result?.revision || 0),
      records: (result?.records || []).map(record => ({
        id: record.id == null ? null : String(record.id),
        studentId: String(record.student_id ?? record.studentId ?? ''),
        status: record.status || 'present',
        comment: record.comment || '',
        grade: record.grade == null ? null : Number(record.grade)
      }))
    };
    sheets.set(String(sessionId), sheet);
    return sheet;
  }

  attendance.loadSession = async function loadSession(sessionId, force = false) {
    if (!sessionId) throw new Error('Séance invalide.');
    if (!navigator.onLine) throw new Error('Connexion Internet requise.');
    if (!force && sheets.has(String(sessionId))) return sheets.get(String(sessionId));
    const { data, error } = await FSTApp.api.client().rpc('get_attendance_sheet', { p_session_id: sessionId });
    if (error) throw new Error(FSTApp.api.normalizeError(error).message);
    if (!data?.ok) throw Object.assign(new Error(data?.message || 'Feuille de présence indisponible.'), { code: data?.code });
    return normalizeSheet(sessionId, data);
  };

  attendance.buildSavePayload = function buildSavePayload(state) {
    return {
      p_session_id: state.sessionId,
      p_expected_revision: Number(state.revision || 0),
      p_operation_id: crypto.randomUUID(),
      p_records: (state.records || []).map(record => ({
        student_id: String(record.student_id ?? record.studentId),
        status: record.status || 'present',
        comment: record.comment || '',
        grade: record.grade == null || record.grade === '' ? null : Number(record.grade)
      })),
      p_justification: null
    };
  };

  attendance.save = async function save(state) {
    if (!navigator.onLine) throw new Error('Connexion Internet requise.');
    const payload = attendance.buildSavePayload(state);
    const { data, error } = await FSTApp.api.client().rpc('save_attendance_sheet', payload);
    if (error) throw new Error(FSTApp.api.normalizeError(error).message);
    if (!data?.ok) {
      if (data?.code === 'VERSION_CONFLICT') {
        sheets.delete(String(state.sessionId));
        return { ok: false, conflict: true, code: 'VERSION_CONFLICT', revision: Number(data?.revision || state.revision || 0) };
      }
      throw Object.assign(new Error(data?.message || 'Enregistrement impossible.'), { code: data?.code });
    }
    const revision = Number(data.revision || Number(state.revision || 0) + 1);
    sheets.set(String(state.sessionId), { sessionId:String(state.sessionId), revision, records:(state.records || []).map(r => ({ studentId:String(r.student_id ?? r.studentId), status:r.status || 'present', comment:r.comment || '', grade:r.grade == null ? null : Number(r.grade) })) });
    if (FSTApp.state?.data) FSTApp.state.data.attendance = await FSTApp.api.listAttendance();
    return { ok: true, conflict: false, revision };
  };

  attendance.clearCache = () => sheets.clear();
  attendance.VERSION_CONFLICT = 'VERSION_CONFLICT';
  attendance.rpcName = 'save_attendance_sheet';
})();
