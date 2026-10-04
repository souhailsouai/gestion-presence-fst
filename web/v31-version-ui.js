(function(root){
'use strict';
function install(){
  const cfg=root.FSTV31Config;
  if(!cfg||!root.document)return;
  let style=document.getElementById('v31-footer-style');
  if(!style){
    style=document.createElement('style');
    style.id='v31-footer-style';
    style.textContent='#v31-app-version-footer{font-size:11px;line-height:1.4;color:#6b7280;text-align:center;padding:8px 12px 12px;opacity:.85}';
    document.head.appendChild(style);
  }
  let footer=document.getElementById('v31-app-version-footer');
  if(!footer){
    footer=document.createElement('div');
    footer.id='v31-app-version-footer';
    footer.setAttribute('aria-label','Version technique de l’application');
    document.body.appendChild(footer);
  }
  footer.textContent='© '+cfg.INSTITUTION_SHORT+' · '+cfg.APP_VERSION_LABEL;
}
if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();
root.FSTV31VersionUi={install};
})(typeof window!=='undefined'?window:globalThis);
