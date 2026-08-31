(function () {
  'use strict';

  const sheetRevisions = new Map();
  const pendingOperations = new Map();

  const messages = {
    NETWORK_UNAVAILABLE: 'Connexion Internet requise.',
    UNAUTHENTICATED: 'Votre session a expiré. Reconnectez-vous.',
    SESSION_EXPIRED: 'Votre session a expiré. Reconnectez-vous.',
    FORBIDDEN: 'Vous ne disposez pas des droits requis.',
    VALIDATION_ERROR: 'Les données saisies sont invalides.',
    VERSION_CONFLICT: 'La feuille a été modifiée depuis un autre appareil. Les données du serveur ont été rechargées.',
    RATE_LIMITED: 'Trop de tentatives. Réessayez plus tard.',
    SERVER_UNAVAILABLE: 'Serveur indisponible. Réessayez.',
    INTERNAL_ERROR: 'Une erreur interne est survenue.'
  };

  function errorMessage(code, fallback) {
    return messages[code] || fallback || messages.INTERNAL_ERROR;
  }

  function loginEndpoint(credential) {
    return /^\d{6,12}$/.test(String(credential || '')) ? 'pin-login' : 'password-login';
  }

  async function invokeLogin(identifier, credential) {
    const endpoint = loginEndpoint(credential);
    const body = endpoint === 'pin-login'
      ? { identifier, credential }
      : { identifier, password: credential };
    const { data: result, error } = await supabaseClient.functions.invoke(endpoint, { body });
    if (error || !result?.access_token || !result?.refresh_token) {
      const status = Number(error?.context?.status || 0);
      const code = status === 429 ? 'RATE_LIMITED' : (result?.code || 'UNAUTHENTICATED');
      throw Object.assign(new Error(errorMessage(code, 'Identifiant, mot de passe ou PIN incorrect.')), { code });
    }
    const session = await supabaseClient.auth.setSession({
      access_token: result.access_token,
      refresh_token: result.refresh_token
    });
    if (session.error || !session.data.user) throw new Error('Session invalide.');
    return { user: session.data.user, login: result };
  }

  async function currentProfile(userId) {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('id,email,username,full_name,role,account_state')
      .eq('id', userId)
      .single();
    if (error || !profile || profile.account_state === 'disabled') {
      throw Object.assign(new Error('Profil utilisateur indisponible.'), { code: 'FORBIDDEN' });
    }
    return profile;
  }

  window.loginTeacher = async function loginTeacherV2() {
    if (!navigator.onLine) return showAuthError(messages.NETWORK_UNAVAILABLE);
    const activeMode = document.getElementById('login-role').value;
    const identifier = document.getElementById('login-email').value.trim().toLowerCase();
    const credential = document.getElementById('login-pin').value;
    if (!identifier || !credential) return showAuthError('Saisissez votre identifiant et votre Mot de passe ou PIN.');
    try {
      const auth = await invokeLogin(identifier, credential);
      const profile = await currentProfile(auth.user.id);
      if (activeMode === 'admin' && profile.role !== 'admin') {
        throw Object.assign(new Error('Ce compte ne possède pas les droits administrateur.'), { code: 'FORBIDDEN' });
      }
      await doLogin(profile, activeMode);
      return true;
    } catch (error) {
      await supabaseClient.auth.signOut().catch(() => {});
      showAuthError(error.message || 'Identifiant, mot de passe ou PIN incorrect.');
      return false;
    }
  };

  window.restorePersistentSession = async function restorePersistentSessionV2() {
    try {
      if (!navigator.onLine) { await renderAuthScreen(); return false; }
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error || !session?.user) { await renderAuthScreen(); return false; }
      const profile = await currentProfile(session.user.id);
      let mode = localStorage.getItem(typeof ACTIVE_MODE_KEY === 'undefined' ? 'presence_active_mode' : ACTIVE_MODE_KEY) || 'teacher';
      if (mode === 'admin' && profile.role !== 'admin') mode = 'teacher';
      await doLogin(profile, mode);
      return true;
    } catch (error) {
      console.error(error);
      await supabaseClient.auth.signOut().catch(() => {});
      await renderAuthScreen();
      return false;
    }
  };

  async function refreshSheet(sessionId) {
    if (!sessionId) return null;
    const { data: result, error } = await supabaseClient.rpc('get_attendance_sheet', { p_session_id: sessionId });
    if (error || !result?.ok) {
      throw Object.assign(new Error(errorMessage(result?.code, error?.message)), { code: result?.code });
    }
    sheetRevisions.set(String(sessionId), Number(result.revision || 0));
    const records = (result.records || []).map((record) => ({
      id: String(record.id),
      sessionId: String(sessionId),
      studentId: String(record.student_id),
      status: record.status || 'present',
      comment: record.comment || '',
      grade: record.grade == null ? null : Number(record.grade),
      gradeUpdatedAt: record.updated_at || null,
      timestamp: record.updated_at || new Date().toISOString()
    }));
    data.attendance = (data.attendance || [])
      .filter((item) => String(item.sessionId) !== String(sessionId))
      .concat(records);
    return result;
  }

  const originalLoadPresenceSheet = window.loadPresenceSheet;
  if (typeof originalLoadPresenceSheet === 'function') {
    window.loadPresenceSheet = async function loadPresenceSheetV2() {
      const sessionId = document.getElementById('presence-session')?.value || '';
      try { if (sessionId) await refreshSheet(sessionId); }
      catch (error) { showAlert(errorMessage(error.code, error.message), 'danger'); }
      return originalLoadPresenceSheet.apply(this, arguments);
    };
  }

  function attendancePayload(sessionId) {
    const session = (data.sessions || []).find((item) => String(item.id) === String(sessionId));
    if (!session) return [];
    return (data.students || [])
      .filter((student) => String(student.classId) === String(session.classId))
      .map((student) => {
        const record = typeof ensureAttendanceRecord === 'function'
          ? ensureAttendanceRecord(sessionId, student.id)
          : (data.attendance || []).find((item) => String(item.sessionId) === String(sessionId) && String(item.studentId) === String(student.id));
        return {
          student_id: String(student.id),
          status: record?.status || 'present',
          comment: record?.comment || '',
          grade: record?.grade == null ? null : Number(record.grade)
        };
      });
  }

  window.saveAttendance = async function saveAttendanceV2(showSuccess = true) {
    if (!navigator.onLine) { showAlert(messages.NETWORK_UNAVAILABLE, 'danger'); return false; }
    const sessionId = document.getElementById('presence-session')?.value || '';
    if (!sessionId) { showAlert('Sélectionnez une séance.', 'danger'); return false; }
    try {
      if (!sheetRevisions.has(String(sessionId))) await refreshSheet(sessionId);
      const operationId = pendingOperations.get(String(sessionId)) || crypto.randomUUID();
      pendingOperations.set(String(sessionId), operationId);
      const { data: result, error } = await supabaseClient.rpc('save_attendance_sheet', {
        p_session_id: sessionId,
        p_expected_revision: sheetRevisions.get(String(sessionId)) || 0,
        p_operation_id: operationId,
        p_records: attendancePayload(sessionId),
        p_justification: null
      });
      if (error) throw new Error(error.message);
      if (!result?.ok) {
        if (result?.code === 'VERSION_CONFLICT') {
          pendingOperations.delete(String(sessionId));
          await refreshSheet(sessionId);
          if (typeof originalLoadPresenceSheet === 'function') originalLoadPresenceSheet();
          showAlert(messages.VERSION_CONFLICT, 'warning');
          return false;
        }
        throw Object.assign(new Error(errorMessage(result?.code)), { code: result?.code });
      }
      pendingOperations.delete(String(sessionId));
      sheetRevisions.set(String(sessionId), Number(result.revision || 0));
      await refreshSheet(sessionId);
      if (typeof originalLoadPresenceSheet === 'function') originalLoadPresenceSheet();
      if (showSuccess) showAlert('Présence enregistrée.', 'success');
      return true;
    } catch (error) {
      showAlert(errorMessage(error.code, error.message), 'danger');
      return false;
    }
  };

  window.FSTSecurityV2 = Object.freeze({
    loginEndpoint,
    invokeLogin,
    currentProfile,
    refreshSheet,
    authMethods: Object.freeze(['pin', 'password'])
  });
})();
