(function(){'use strict';
const LETTERS=['A','B','C','D','E'];
const OFFICIAL=Object.freeze({
 'MPI:1':Object.freeze({label:'MPI1-A',module:'TP Physique',day:'Lundi',start:'13:45',end:'18:00'}),
 'MPI:2':Object.freeze({label:'MPI1-B',module:'TP Physique',day:'Vendredi',start:'13:30',end:'17:30'}),
 'MPI:3':Object.freeze({label:'MPI1-C',module:'TP Physique',day:'Jeudi',start:'13:45',end:'17:30'}),
 'MPI:4':Object.freeze({label:'MPI1-D',module:'TP Physique',day:'Jeudi',start:'13:30',end:'17:30'}),
 'MPI:5':Object.freeze({label:'MPI1-E',module:'TP Physique',day:'Lundi',start:'13:30',end:'17:30'}),
 'PC:1':Object.freeze({label:'PC1-A',module:'TP Physique',day:'Vendredi',start:'13:30',end:'17:30'})
});
function key(track,n){return `${String(track||'').toUpperCase()}:${Number(n)||0}`;}
function isAllowedClass(track,n){return Object.prototype.hasOwnProperty.call(OFFICIAL,key(track,n));}
function officialFor(track,n){const x=OFFICIAL[key(track,n)];return x?{...x}:null;}
function classLabel(r){return officialFor(r?.track,r?.classNumber)?.label||String(r?.name||'Classe').replace(/-G\d+$/i,'');}
function groupLabel(r){const g=Number(r?.groupNumber);return `${classLabel(r)}${g>0?`-G${g}`:''}`;}
function parseDateParts(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));if(!m)return null;return {y:+m[1],m:+m[2],d:+m[3]};}
function utcDate(s){const p=parseDateParts(s);return p?new Date(Date.UTC(p.y,p.m-1,p.d)):null;}
function fmt(d){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;}
function addDays(s,n){const d=utcDate(s);d.setUTCDate(d.getUTCDate()+n);return fmt(d);}
function generateAlternatingSlots(start='2026-09-14',end='2026-12-13'){
 const out=[];let week=String(start);let i=0;
 while(week<=end){const set=i%2===0?[['MPI',1,0],['MPI',3,3],['MPI',2,4]]:[['MPI',5,0],['MPI',4,3],['PC',1,4]];for(const [track,n,off] of set){const o=officialFor(track,n),date=addDays(week,off);if(date<=end)out.push({weekIndex:i,weekStart:week,date,classLabel:o.label,track,classNumber:n,day:o.day,start:o.start,end:o.end,module:'TP Physique'});}week=addDays(week,7);i++;}
 return out;
}
function updateClassOptions(){const track=String(document.getElementById('class-track')?.value||'MPI').toUpperCase();const sel=document.getElementById('class-number');if(!sel)return;const max=track==='MPI'?5:1;sel.innerHTML=Array.from({length:max},(_,i)=>`<option value="${i+1}">${LETTERS[i]}</option>`).join('');}
function applyOfficialToForm(){updateClassOptions();const track=String(document.getElementById('class-track')?.value||'MPI').toUpperCase(),n=Number(document.getElementById('class-number')?.value||1),o=officialFor(track,n);if(!o)return false;const mod=document.getElementById('class-module'),day=document.getElementById('class-day'),start=document.getElementById('class-start'),end=document.getElementById('class-end');if(mod){mod.value='TP Physique';mod.readOnly=true;}if(day)day.value=o.day;if(start)start.value=o.start;if(end)end.value=o.end;let b=document.getElementById('fst-reset-official-slot');if(!b&&end?.parentElement){b=document.createElement('button');b.type='button';b.id='fst-reset-official-slot';b.className='btn btn-sm btn-secondary';b.textContent='Rétablir le créneau officiel';b.addEventListener('click',applyOfficialToForm);end.parentElement.appendChild(b);}return true;}
window.FSTTPReference={OFFICIAL,LETTERS,isAllowedClass,officialFor,classLabel,groupLabel,generateAlternatingSlots,applyOfficialToForm,updateClassOptions,addDays};
})();