(() => {
  'use strict';
  const FSTApp = window.FSTApp = window.FSTApp || {};
  const api = FSTApp.api = FSTApp.api || {};
  let clientInstance = null;

  api.requireSingleObject = function requireSingleObject(value, label = 'Réponse') {
    if (Array.isArray(value)) {
      if (value.length !== 1) throw new Error(`${label} ambiguë.`);
      return value[0];
    }
    if (value && typeof value === 'object') return value;
    throw new Error(`${label} indisponible.`);
  };

  api.normalizeError = function normalizeError(error) {
    const message = String(error?.message || error || 'Erreur inconnue');
    if (/401|jwt|session|refresh token/i.test(message)) return { code: 'SESSION_EXPIRED', message: 'Session expirée. Reconnectez-vous.' };
    if (/403|forbidden|permission|row-level security/i.test(message)) return { code: 'FORBIDDEN', message: 'Vous ne disposez pas des droits requis.' };
    if (/network|fetch|offline|failed to fetch/i.test(message)) return { code: 'NETWORK', message: 'Connexion Internet requise.' };
    return { code: error?.code || 'API_ERROR', message };
  };

  api.client = function client() {
    if (clientInstance) return clientInstance;
    if (!window.supabase?.createClient) throw new Error('Client Supabase indisponible.');
    clientInstance = window.supabase.createClient(FSTApp.config.supabaseUrl, FSTApp.config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return clientInstance;
  };

  api.invokePinLogin = async function invokePinLogin(identifier, secret) {
    const { data, error } = await api.client().functions.invoke('pin-login', { body: { identifier, credential: secret } });
    if (error || !data?.access_token || !data?.refresh_token) {
      const normalized = api.normalizeError(error || data?.message || 'Identifiants incorrects.');
      if (Number(error?.context?.status || 0) === 429) normalized.message = 'Trop de tentatives. Réessayez plus tard.';
      throw Object.assign(new Error(normalized.message), { code: normalized.code });
    }
    const sessionResult = await api.client().auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (sessionResult.error || !sessionResult.data?.session?.user) throw new Error('Session invalide.');
    return sessionResult.data.session;
  };

  api.profile = async function profile(userId) {
    const { data, error } = await api.client().from('profiles').select('id,email,username,full_name,role,account_state').eq('id', userId).limit(1);
    if (error) throw new Error(api.normalizeError(error).message);
    const profile = api.requireSingleObject(data, 'Profil');
    if (profile.account_state === 'disabled') throw new Error('Compte désactivé.');
    return profile;
  };

  function mapClass(row) {
    return { id:String(row.id), name:row.name || '', track:row.track || '', classNumber:row.class_number ?? row.classNumber ?? null, groupNumber:row.group_number ?? row.groupNumber ?? null, module:row.module || '', day:row.day || '', start:row.start_time || row.start || '', end:row.end_time || row.end || '', room:row.room || '', teacherId:row.teacher_id || null };
  }
  function mapStudent(row) {
    return { id:String(row.id), classId:String(row.class_id ?? row.classId ?? ''), lastname:row.last_name ?? row.lastname ?? '', firstname:row.first_name ?? row.firstname ?? '', email:row.email || '', teacherId:row.teacher_id || null };
  }
  function mapSession(row) {
    return { id:String(row.id), classId:String(row.class_id ?? row.classId ?? ''), date:row.session_date ?? row.date ?? '', start:row.start_time ?? row.start ?? '', end:row.end_time ?? row.end ?? '', completedAt:row.completed_at ?? row.completedAt ?? null, teacherId:row.teacher_id || null };
  }
  function mapAttendance(row) {
    return { id:String(row.id), sessionId:String(row.session_id ?? row.sessionId ?? ''), studentId:String(row.student_id ?? row.studentId ?? ''), status:row.status || 'present', comment:row.comment || '', grade:row.grade == null ? null : Number(row.grade), teacherId:row.teacher_id || null };
  }

  async function selectTable(table, columns = '*') {
    const { data, error } = await api.client().from(table).select(columns);
    if (error) throw new Error(api.normalizeError(error).message);
    return data || [];
  }

  api.listClasses = async () => (await selectTable('classes')).map(mapClass);
  api.listStudents = async () => (await selectTable('students')).map(mapStudent);
  api.listSessions = async () => (await selectTable('sessions')).map(mapSession);
  api.listAttendance = async () => (await selectTable('attendance')).map(mapAttendance);
  api.teacher_directory = async () => selectTable('teacher_directory');
  api.timetable = async () => api.listClasses();

  api.fetchApplicationData = async function fetchApplicationData() {
    if (!navigator.onLine) throw new Error('Connexion Internet requise.');
    const [classes, students, sessions, attendance] = await Promise.all([api.listClasses(), api.listStudents(), api.listSessions(), api.listAttendance()]);
    return { classes, students, sessions, attendance };
  };

  api.upsert = async function upsert(table, rows) {
    if (!navigator.onLine) throw new Error('Connexion Internet requise.');
    const { data, error } = await api.client().from(table).upsert(rows).select();
    if (error) throw new Error(api.normalizeError(error).message);
    return data || [];
  };
  api.remove = async function remove(table, id) {
    if (!navigator.onLine) throw new Error('Connexion Internet requise.');
    const { error } = await api.client().from(table).delete().eq('id', id);
    if (error) throw new Error(api.normalizeError(error).message);
    return true;
  };
  api.adminTeacher = async function adminTeacher(action, payload = {}) {
    if (!navigator.onLine) throw new Error('Connexion Internet requise.');
    const { data, error } = await api.client().functions.invoke('admin-teacher', { body: { action, ...payload } });
    if (error) throw new Error(api.normalizeError(error).message);
    return data;
  };
})();
