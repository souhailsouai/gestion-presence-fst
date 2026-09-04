(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16DashboardNotices=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  function html(){
    return `<section data-v16-dashboard-notices="true" style="margin-top:18px">
      <h2 style="margin-bottom:12px"><i class="fas fa-bullhorn"></i> Avis TP 2026/2027</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
        <article class="card" data-v16-notice="mpi1">
          <h3 style="margin-top:0">Avis n°1 — Démarrage des TP MPI1</h3>
          <p><strong>MPI1-A et MPI1-E</strong> : lundi 14/09/2026 à <strong>13h45</strong>.</p>
          <p><strong>MPI1-C et MPI1-D</strong> : jeudi 17/09/2026 à <strong>13h30</strong>.</p>
          <p><strong>MPI1-B</strong> : vendredi 18/09/2026 à <strong>13h30</strong>.</p>
          <p><strong>Salles A, B, C et D</strong> — rez-de-chaussée, à l’entrée du Département de Physique.</p>
          <p style="margin-bottom:0"><strong>Avis du 11/09/2026</strong><br>Coordinateur : Souhail Souai — souhail.souai@fst.utm.tn</p>
        </article>
        <article class="card" data-v16-notice="pc1">
          <h3 style="margin-top:0">Avis n°1 — Démarrage des TP PC1</h3>
          <p><strong>PC1-A</strong> : vendredi 18/09/2026 à <strong>13h30</strong>.</p>
          <p><strong>Salles A, B, C et D</strong> — rez-de-chaussée, à l’entrée du Département de Physique.</p>
          <p style="margin-bottom:0"><strong>Avis du 11/09/2026</strong><br>Coordinateur : Souhail Souai — souhail.souai@fst.utm.tn</p>
        </article>
      </div>
    </section>`;
  }

  function mount(){
    if(typeof document==='undefined')return false;
    const dashboard=document.getElementById('dashboard');
    if(!dashboard)return false;
    if(dashboard.querySelector('[data-v16-dashboard-notices="true"]'))return true;
    dashboard.insertAdjacentHTML('beforeend',html());
    return true;
  }

  function autoMount(){mount();}
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autoMount);
    else autoMount();
  }

  return {mount,html};
});
