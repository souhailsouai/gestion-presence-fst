(function(root){
  'use strict';
  const VERSION='V3.0';
  const TITLE='Gestion Présence FST V3.0 — 2026/2027';
  function apply(){
    if(root.document){
      root.document.title=TITLE;
      root.document.documentElement.dataset.appVersion=VERSION;
      const selectors=['#planning-v16 h2','#etudiants h2'];
      for(const sel of selectors){
        const el=root.document.querySelector(sel);
        if(el)el.textContent=String(el.textContent||'').replace(/V23/g,VERSION);
      }
      const h1=root.document.querySelector('.internal-brand-title h1');
      if(h1&&/Gestion/i.test(h1.textContent||''))h1.setAttribute('data-release',VERSION);
    }
    root.APP_RELEASE=VERSION;
  }
  if(root.document){
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',apply,{once:true});
    else apply();
  }
})(window);
