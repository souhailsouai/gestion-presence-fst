/* V49 — PDF lisibles partout (site) : filet de sécurité sur le moteur PDF.
   - Texte libre : jamais sous 8 pt (pieds de page, mentions).
   - Tableaux : jamais sous 8,5 pt ; le tableau passe à la ligne au lieu de déborder.
   - Traits de tableau : au moins 0,2 mm et gris moyen, pour rester visibles une fois imprimés.
   Les PDF déjà réglés (planning, cahier, groupes du S2) ne changent pas, sauf ce qui était sous ces seuils. */
(function(root){
  'use strict';
  const MIN_TEXT=8,MIN_TABLE=8.5,MIN_LINE=0.2,MAX_GREY=150;
  function bumpStyles(st){
    if(!st||typeof st!=='object')return st;
    const out={...st};
    if(out.fontSize!=null)out.fontSize=Math.max(Number(out.fontSize)||MIN_TABLE,MIN_TABLE);
    if(typeof out.lineWidth==='number'&&out.lineWidth>0)out.lineWidth=Math.max(out.lineWidth,MIN_LINE);
    /* Texte gris moyen (ni noir, ni blanc sur fond coloré) : foncé pour l'impression. */
    const tc=out.textColor;
    if(typeof tc==='number'&&tc>60&&tc<200)out.textColor=40;
    else if(Array.isArray(tc)&&tc.every(v=>v>60&&v<200)&&Math.max(...tc)-Math.min(...tc)<30)out.textColor=[40,40,40];
    const lc=out.lineColor;
    if(typeof lc==='number')out.lineColor=Math.min(lc,MAX_GREY);
    else if(Array.isArray(lc)&&lc.every(v=>v>MAX_GREY))out.lineColor=[MAX_GREY,MAX_GREY,MAX_GREY];
    return out;
  }
  /** Options de autoTable rendues lisibles (fonction pure, testée sous Node). */
  function readableTable(opts){
    if(!opts||typeof opts!=='object')return opts;
    const o={...opts};
    o.styles=bumpStyles({fontSize:MIN_TABLE,...(o.styles||{})});
    for(const k of ['headStyles','bodyStyles','footStyles','alternateRowStyles'])if(o[k])o[k]=bumpStyles(o[k]);
    if(o.columnStyles&&typeof o.columnStyles==='object'){const cs={};for(const [k,v] of Object.entries(o.columnStyles))cs[k]=bumpStyles(v);o.columnStyles=cs;}
    if(o.styles.overflow==null)o.styles.overflow='linebreak';
    return o;
  }
  function patch(){
    const J=root.jspdf?.jsPDF;if(!J||J.__v49)return !!J;
    const API=J.API;
    /* setFontSize appartient à chaque document : on l'enveloppe à la création du document. */
    const clampFont=doc=>{const f=doc&&doc.setFontSize;if(typeof f==='function'&&!f.__v49){const g=function(n){return f.call(this,Math.max(Number(n)||MIN_TEXT,MIN_TEXT));};g.__v49=true;doc.setFontSize=g;}};
    if(Array.isArray(API.events))API.events.push(['initialized',function(){clampFont(this);}]);
    const setFontSize=API.setFontSize;
    if(typeof setFontSize==='function')API.setFontSize=function(n){return setFontSize.call(this,Math.max(Number(n)||MIN_TEXT,MIN_TEXT));};
    const autoTable=API.autoTable;
    if(typeof autoTable==='function')API.autoTable=function(opts,...rest){
      /* Ancienne signature autoTable(colonnes, lignes, options) : options en dernier. */
      if(rest.length&&rest[rest.length-1]&&typeof rest[rest.length-1]==='object'&&!Array.isArray(rest[rest.length-1])){rest[rest.length-1]=readableTable(rest[rest.length-1]);return autoTable.call(this,opts,...rest);}
      return autoTable.call(this,readableTable(opts),...rest);
    };
    J.__v49=true;return true;
  }
  if(!patch()&&root.document){let n=0;const t=setInterval(()=>{if(patch()||++n>40)clearInterval(t);},250);}
  root.V49PdfLisible={readableTable,MIN_TEXT,MIN_TABLE};
  if(typeof module!=='undefined')module.exports={readableTable,MIN_TEXT,MIN_TABLE};
})(typeof window!=='undefined'?window:globalThis);
