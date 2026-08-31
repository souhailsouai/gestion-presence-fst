(() => {
  'use strict';
  const FSTApp = window.FSTApp = window.FSTApp || {};
  FSTApp.auth = FSTApp.auth || {};

  FSTApp.auth.normalizeIdentifier = function normalizeIdentifier(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  };
  FSTApp.auth.isAdminProfile = function isAdminProfile(profile) {
    return Boolean(profile && (profile.is_admin === true || profile.role === 'admin'));
  };

  FSTApp.auth.login = async function login({ identifier, secret, requestedMode = 'teacher' }) {
    if (!navigator.onLine) throw new Error('Connexion Internet requise.');
    const normalized = FSTApp.auth.normalizeIdentifier(identifier);
    if (!normalized || !String(secret || '')) throw new Error('Saisissez votre identifiant et votre mot de passe ou PIN.');
    let session = null;
    try {
      session = await FSTApp.api.invokePinLogin(normalized, String(secret));
      const profile = await FSTApp.api.profile(session.user.id);
      if (requestedMode === 'admin' && !FSTApp.auth.isAdminProfile(profile)) throw new Error('Ce compte ne possède pas les droits administrateur.');
      const mode = requestedMode === 'admin' ? 'admin' : 'teacher';
      FSTApp.state.session = session;
      FSTApp.state.profile = profile;
      FSTApp.state.mode = mode;
      FSTApp.state.data = await FSTApp.api.fetchApplicationData();
      try { localStorage.setItem('presence_active_mode', mode); } catch (_) {}
      return { session, profile, mode };
    } catch (error) {
      try { await FSTApp.api.client().auth.signOut(); } catch (_) {}
      throw error;
    }
  };

  FSTApp.auth.restoreSession = async function restoreSession() {
    if (!navigator.onLine) return null;
    const { data, error } = await FSTApp.api.client().auth.getSession();
    if (error || !data?.session?.user) return null;
    try {
      const profile = await FSTApp.api.profile(data.session.user.id);
      let mode = 'teacher';
      try { mode = localStorage.getItem('presence_active_mode') || 'teacher'; } catch (_) {}
      if (mode === 'admin' && !FSTApp.auth.isAdminProfile(profile)) mode = 'teacher';
      FSTApp.state.session = data.session;
      FSTApp.state.profile = profile;
      FSTApp.state.mode = mode;
      FSTApp.state.data = await FSTApp.api.fetchApplicationData();
      return { session: data.session, profile, mode };
    } catch (error) {
      try { await FSTApp.api.client().auth.signOut(); } catch (_) {}
      return null;
    }
  };

  FSTApp.auth.logout = async function logout() {
    try { await FSTApp.api.client().auth.signOut(); } catch (_) {}
    FSTApp.state.session = null;
    FSTApp.state.profile = null;
    FSTApp.state.mode = null;
    FSTApp.state.data = null;
    try { localStorage.removeItem('presence_active_mode'); } catch (_) {}
    FSTApp.ui.renderLogin('Vous êtes déconnecté.');
  };
})();
