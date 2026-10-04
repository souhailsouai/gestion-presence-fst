(function(root){
'use strict';

const VERSION_PATTERNS=[
  /\bV30\b/i,
  /\bV31\b/i,
  /\bv3\.0\b/i,
  /\bv3\.1\b/i,
  /\bVersion\s*(?:V?30|V?31|3\.0|3\.1)\b/i
];

function looksLikeVisibleVersion(text){
  const value=String(text||'').trim();
  return VERSION_PATTERNS.some(function(re){return re.test(value);});
}

function install(){
  const doc=root.document;
  if(!doc)return;

  ['v31-app-version-footer','v30-app-version-footer','app-version-footer'].forEach(function(id){
    doc.getElementById(id)?.remove();
  });

  doc.querySelectorAll('[data-app-version-visible],[id*="version" i],[class*="version" i]').forEach(function(el){
    if(looksLikeVisibleVersion(el.textContent))el.remove();
  });
}

if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});
else install();

root.FSTV31VersionUi={install,looksLikeVisibleVersion};
})(typeof window!=='undefined'?window:globalThis);
