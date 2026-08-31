(function () {
  'use strict';

  function removeMfaUi() {
    document.getElementById('security-v2-overlay')?.remove();
    document.querySelectorAll('button,a,[role="button"]').forEach((el) => {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text.includes('double authentification') || text.includes('mfa') || text === 'sécurité' || text.includes('sécurité du compte')) {
        el.style.display = 'none';
      }
    });
  }

  async function invokeLogin(identifier, credential) {
    const { data: result, error } = await supabaseClient.functions.invoke('pin-login', {
      body: { identifier, credential }
    });
    if (error || !result?.access_token || !result?.refresh_token) {
      const status = Number(error?.context?.status || 0);
      const message = status === 429 ? 'Trop de tentatives. Réessayez plus tard.' : 'Identifiant, mot de passe ou PIN incorrect.';
      throw new Error(message);
    }
    const session = await supabaseClient.auth.setSession({
      access_token: result.access_token,
      refresh_token: result.refresh_token
    });
    if (session.error || !session.data.user) throw new Error('Session invalide.');
    return session.data.user;
  }

  async function currentProfile(userId) {
    const { data: rows, error } = await supabaseClient
      .from('profiles')
      .select('id,email,username,full_name,role,account_state')
      .eq('id', userId)
      .limit(1);
    if (error) throw error;
    const profile = Array.isArray(rows) ? rows[0] : rows;
    if (!profile || profile.account_state === 'disabled') throw new Error('Profil utilisateur indisponible.');
    return profile;
  }

  window.loginTeacher = async function loginTeacherNoMfa() {
    if (!navigator.onLine) return showAuthError('Connexion Internet requise.');
    const activeMode = document.getElementById('login-role').value;
    const identifier = document.getElementById('login-email').value.trim().toLowerCase();
    const credential = document.getElementById('login-pin').value;
    if (!identifier || !credential) return showAuthError('Saisissez votre identifiant et votre mot de passe ou PIN.');
    try {
      const user = await invokeLogin(identifier, credential);
      const profile = await currentProfile(user.id);
      if (activeMode === 'admin' && profile.role !== 'admin') throw new Error('Ce compte ne possède pas les droits administrateur.');
      await doLogin(profile, activeMode);
      removeMfaUi();
    } catch (error) {
      await supabaseClient.auth.signOut().catch(() => {});
      showAuthError(error.message || 'Identifiant, mot de passe ou PIN incorrect.');
    }
  };

  window.restorePersistentSession = async function restorePersistentSessionNoMfa() {
    try {
      if (!navigator.onLine) { await renderAuthScreen(); return false; }
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error || !session?.user) { await renderAuthScreen(); return false; }
      const profile = await currentProfile(session.user.id);
      let mode = localStorage.getItem(typeof ACTIVE_MODE_KEY === 'undefined' ? 'presence_active_mode' : ACTIVE_MODE_KEY) || 'teacher';
      if (mode === 'admin' && profile.role !== 'admin') mode = 'teacher';
      await doLogin(profile, mode);
      removeMfaUi();
      return true;
    } catch (error) {
      console.error(error);
      await supabaseClient.auth.signOut().catch(() => {});
      await renderAuthScreen();
      return false;
    }
  };

  const observer = new MutationObserver(removeMfaUi);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', removeMfaUi);
  window.FSTMfaDisabled = true;
})();
