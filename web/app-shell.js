(() => {
  'use strict';
  const FSTApp = window.FSTApp = window.FSTApp || {};
  let bootStarted = false;
  FSTApp.config = Object.freeze({
    academicYear: '2026/2027',
    supabaseUrl: 'https://dbslzmvzbxczpqyektpx.supabase.co',
    supabaseKey: 'sb_publishable_wKwmPnXS_Q7REGU57hTIyw_eqxhIXLT'
  });
  FSTApp.state = FSTApp.state || { booted:false, session:null, profile:null, mode:null, data:null, online:navigator.onLine };

  FSTApp.boot = async function boot() {
    if (bootStarted) return;
    bootStarted = true;
    FSTApp.state.booted = true;
    try {
      const restored = await FSTApp.auth.restoreSession();
      if (restored) await FSTApp.ui.renderApplication(restored);
      else FSTApp.ui.renderLogin();
    } catch (error) {
      FSTApp.ui.renderFatal(error);
    }
  };

  window.addEventListener('offline', () => {
    FSTApp.state.online = false;
    FSTApp.ui.renderNetworkState(false);
  });
  window.addEventListener('online', () => {
    FSTApp.state.online = true;
    FSTApp.ui.renderNetworkState(true);
  });
  document.addEventListener('DOMContentLoaded', () => FSTApp.boot(), { once:true });
})();
