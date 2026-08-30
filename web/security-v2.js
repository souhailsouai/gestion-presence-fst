(function () {
  'use strict';

  const sheetRevisions = new Map();
  const pendingOperations = new Map();
  let enrollment = null;
  let mfaDialogPromise = null;

  const messages = {
    NETWORK_UNAVAILABLE: 'Connexion Internet requise.',
    UNAUTHENTICATED: 'Votre session a expiré. Reconnectez-vous.',
    SESSION_EXPIRED: 'Votre session a expiré. Reconnectez-vous.',
    MFA_REQUIRED: 'La double authentification est requise.',
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

  function securityOverlay() {
    let root = document.getElementById('security-v2-overlay');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'security-v2-overlay';
    root.style.cssText = 'display:none;position:fixed;inset:0;z-index:100000;background:rgba(3,28,58,.78);align-items:center;justify-content:center;padding:18px';
    root.innerHTML = '<div id="security-v2-card" style="width:min(520px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.35)"></div>';
    document.body.appendChild(root);
    return root;
  }

  function closeSecurityOverlay(result) {
    const root = securityOverlay();
    root.style.display = 'none';
    if (mfaDialogPromise) {
      mfaDialogPromise.resolve(Boolean(result));
      mfaDialogPromise = null;
    }
  }

  function showSecurityCard(html) {
    const root = securityOverlay();
    root.querySelector('#security-v2-card').innerHTML = html;
    root.style.display = 'flex';
    return root;
  }

  async function invokeLogin(identifier, credential) {
    const { data: result, error } = await supabaseClient.functions.invoke('pin-login', {
      body: { identifier, credential }
    });
    if (error || !result?.access_token || !result?.refresh_token) {
      const status = Number(error?.context?.status || 0);
      const code = status === 429 ? 'RATE_LIMITED' : result?.code;
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
      .select('id,email,username,full_name,role,account_state,mfa_required')
      .eq('id', userId)
      .single();
    if (error || !profile || profile.account_state === 'disabled') throw new Error('Profil utilisateur indisponible.');
    return profile;
  }

  async function assurance() {
    const { data, error } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data;
  }

  async function verifiedTotpFactor() {
    const { data, error } = await supabaseClient.auth.mfa.listFactors();
    if (error) throw error;
    return (data?.totp || []).find((factor) => factor.status === 'verified') || null;
  }

  function challengeMfa(factor) {
    if (mfaDialogPromise) return mfaDialogPromise.promise;
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    mfaDialogPromise = { promise, resolve };
    const root = showSecurityCard(`
      <h2 style="color:#092f63;margin:0 0 8px">Double authentification</h2>
      <p>Saisissez le code à 6 chiffres généré par votre application d’authentification.</p>
      <div id="security-v2-error" style="display:none;color:#b02a37;margin:10px 0"></div>
      <input id="security-v2-code" class="form-control" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">
      <button id="security-v2-verify" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:14px">Vérifier</button>
      <button id="security-v2-cancel" class="btn btn-info" style="width:100%;justify-content:center;margin-top:8px">Annuler</button>
    `);
    const code = root.querySelector('#security-v2-code');
    const verify = root.querySelector('#security-v2-verify');
    const error = root.querySelector('#security-v2-error');
    const submit = async () => {
      const value = code.value.trim();
      if (!/^\d{6}$/.test(value)) {
        error.textContent = 'Le code doit contenir exactement 6 chiffres.';
        error.style.display = 'block';
        return;
      }
      verify.disabled = true;
      const result = await supabaseClient.auth.mfa.challengeAndVerify({ factorId: factor.id, code: value });
      verify.disabled = false;
      if (result.error) {
        error.textContent = 'Code invalide ou expiré.';
        error.style.display = 'block';
        return;
      }
      closeSecurityOverlay(true);
    };
    verify.onclick = () => void submit();
    code.onkeydown = (event) => { if (event.key === 'Enter') void submit(); };
    root.querySelector('#security-v2-cancel').onclick = () => closeSecurityOverlay(false);
    setTimeout(() => code.focus(), 0);
    return promise;
  }

  async function startEnrollment() {
    if (!enrollment) {
      const { data, error } = await supabaseClient.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `FST-${new Date().toISOString().slice(0, 10)}`,
        issuer: 'FST UTM Gestion Presence'
      });
      if (error || !data) throw error || new Error('Enrôlement MFA indisponible.');
      enrollment = data;
    }
    if (mfaDialogPromise) return mfaDialogPromise.promise;
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    mfaDialogPromise = { promise, resolve };
    const qr = enrollment.totp?.qr_code || enrollment.totp?.qrCode || '';
    const secret = enrollment.totp?.secret || '';
    const root = showSecurityCard(`
      <h2 style="color:#092f63;margin:0 0 8px">Activer la double authentification</h2>
      <p>Scannez ce QR code avec une application TOTP, puis saisissez le code généré.</p>
      ${qr ? `<div style="text-align:center"><img alt="QR code MFA" src="${qr}" style="max-width:240px;width:100%;background:#fff;padding:8px"></div>` : ''}
      ${secret ? `<details style="margin:10px 0"><summary>Saisie manuelle</summary><code style="word-break:break-all">${secret}</code></details>` : ''}
      <div id="security-v2-error" style="display:none;color:#b02a37;margin:10px 0"></div>
      <input id="security-v2-code" class="form-control" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Code à 6 chiffres">
      <button id="security-v2-enroll" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:14px">Activer</button>
      <button id="security-v2-cancel" class="btn btn-info" style="width:100%;justify-content:center;margin-top:8px">Annuler et se déconnecter</button>
    `);
    const code = root.querySelector('#security-v2-code');
    const activate = root.querySelector('#security-v2-enroll');
    const error = root.querySelector('#security-v2-error');
    const submit = async () => {
      const value = code.value.trim();
      if (!/^\d{6}$/.test(value)) {
        error.textContent = 'Le code doit contenir exactement 6 chiffres.';
        error.style.display = 'block';
        return;
      }
      activate.disabled = true;
      const result = await supabaseClient.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: value });
      activate.disabled = false;
      if (result.error) {
        error.textContent = 'Code invalide ou expiré.';
        error.style.display = 'block';
        return;
      }
      enrollment = null;
      closeSecurityOverlay(true);
    };
    activate.onclick = () => void submit();
    code.onkeydown = (event) => { if (event.key === 'Enter') void submit(); };
    root.querySelector('#security-v2-cancel').onclick = async () => {
      if (enrollment?.id) await supabaseClient.auth.mfa.unenroll({ factorId: enrollment.id }).catch(() => {});
      enrollment = null;
      await supabaseClient.auth.signOut();
      closeSecurityOverlay(false);
    };
    return promise;
  }

  async function ensureMfa(profile) {
    if (profile?.mfa_required === false) return true;
    const level = await assurance();
    if (level.currentLevel === 'aal2') return true;
    const factor = await verifiedTotpFactor();
    return factor ? challengeMfa(factor) : startEnrollment();
  }

  window.loginTeacher = async function loginTeacherV2() {
    if (!navigator.onLine) return showAuthError(messages.NETWORK_UNAVAILABLE);
    const activeMode = document.getElementById('login-role').value;
    const identifier = document.getElementById('login-email').value.trim().toLowerCase();
    const credential = document.getElementById('login-pin').value;
    if (!identifier || !credential) return showAuthError('Saisissez votre identifiant et votre mot de passe ou PIN.');
    try {
      const auth = await invokeLogin(identifier, credential);
      const profile = await currentProfile(auth.user.id);
      if (activeMode === 'admin' && profile.role !== 'admin') throw new Error('Ce compte ne possède pas les droits administrateur.');
      if (!await ensureMfa(profile)) return;
      await doLogin(profile, activeMode);
      installSecurityButton();
    } catch (error) {
      await supabaseClient.auth.signOut().catch(() => {});
      showAuthError(error.message || 'Identifiant, mot de passe ou PIN incorrect.');
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
      if (!await ensureMfa(profile)) { await renderAuthScreen(); return false; }
      await doLogin(profile, mode);
      installSecurityButton();
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
    if (error || !result?.ok) throw Object.assign(new Error(errorMessage(result?.code, error?.message)), { code: result?.code });
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
    data.attendance = (data.attendance || []).filter((item) => String(item.sessionId) !== String(sessionId)).concat(records);
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
        if (result?.code === 'MFA_REQUIRED') {
          const { data: { user } } = await supabaseClient.auth.getUser();
          const profile = user ? await currentProfile(user.id) : null;
          if (profile && await ensureMfa(profile)) return window.saveAttendance(showSuccess);
        }
        throw Object.assign(new Error(errorMessage(result?.code)), { code: result?.code });
      }
      pendingOperations.delete(String(sessionId));
      sheetRevisions.set(String(sessionId), Number(result.revision || 0));
      await refreshSheet(sessionId);
      if (typeof window.FSTOnlineRuntime?.refreshAuthoritativeState === 'function') await window.FSTOnlineRuntime.refreshAuthoritativeState();
      if (showSuccess) showAlert('Présence enregistrée avec succès', 'success');
      return true;
    } catch (error) {
      showAlert(errorMessage(error.code, error.message), 'danger');
      return false;
    }
  };

  async function openMfaManager() {
    try {
      const { data, error } = await supabaseClient.auth.mfa.listFactors();
      if (error) throw error;
      const factors = data?.totp || [];
      const rows = factors.map((factor) => `<li style="display:flex;justify-content:space-between;gap:12px;margin:8px 0"><span>${factor.friendly_name || 'Application TOTP'} — ${factor.status}</span><button class="btn btn-danger security-v2-remove" data-factor="${factor.id}">Retirer</button></li>`).join('');
      const root = showSecurityCard(`
        <h2 style="color:#092f63;margin:0 0 8px">Sécurité du compte</h2>
        <p>Double authentification TOTP.</p>
        <ul style="padding:0;list-style:none">${rows || '<li>Aucun facteur configuré.</li>'}</ul>
        <button id="security-v2-add" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:12px">Ajouter un appareil</button>
        <button id="security-v2-close" class="btn btn-info" style="width:100%;justify-content:center;margin-top:8px">Fermer</button>
      `);
      root.querySelectorAll('.security-v2-remove').forEach((button) => {
        button.onclick = async () => {
          if (!confirm('Retirer cet appareil d’authentification ?')) return;
          const result = await supabaseClient.auth.mfa.unenroll({ factorId: button.dataset.factor });
          if (result.error) return showAlert(result.error.message, 'danger');
          closeSecurityOverlay(false);
          await openMfaManager();
        };
      });
      root.querySelector('#security-v2-add').onclick = async () => {
        closeSecurityOverlay(false);
        enrollment = null;
        await startEnrollment();
      };
      root.querySelector('#security-v2-close').onclick = () => closeSecurityOverlay(false);
    } catch (error) { showAlert(error.message || messages.INTERNAL_ERROR, 'danger'); }
  }

  function installSecurityButton() {
    if (document.getElementById('security-v2-button')) return;
    const anchor = document.getElementById('current-user-pill');
    if (!anchor) return;
    const button = document.createElement('button');
    button.id = 'security-v2-button';
    button.type = 'button';
    button.className = 'btn btn-info';
    button.style.marginLeft = '8px';
    button.innerHTML = '<i class="fas fa-shield-halved"></i> Sécurité';
    button.onclick = () => void openMfaManager();
    anchor.appendChild(button);
  }

  window.FSTSecurityV2 = {
    ensureMfa,
    refreshSheet,
    openMfaManager,
    errorMessage,
    sheetRevisions,
    pendingOperations
  };
})();
