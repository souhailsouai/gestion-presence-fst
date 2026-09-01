(function(){
'use strict';

const MPI_CLASS_LETTERS=['A','B','C','D','E'];
const YEAR='2026/2027';
const INSTITUTION='Faculté des Sciences de Tunis — Université de Tunis El Manar';

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function classLetter(n){const i=Number(n)-1;return i>=0&&i<MPI_CLASS_LETTERS.length?MPI_CLASS_LETTERS[i]:'';}
function classLabel(c){
  const track=String(c?.track||'').trim().toUpperCase();
  const n=Number(c?.classNumber);
  if(track==='MPI'&&classLetter(n))return `MPI1-${classLetter(n)}`;
  if(track&&Number.isFinite(n)&&n>0)return `${track}${n}`;
  return String(c?.name||'Classe').replace(/-G\d+$/i,'');
}
function groupLabel(c){const g=Number(c?.groupNumber);return `${classLabel(c)}${g>0?`-G${g}`:''}`;}
function classKey(c){return classLabel(c);}
function groupStyle(n){const x=Math.min(10,Math.max(1,Number(n)||1));return `student-group-${x}`;}
function owned(c){return window.FSTAccessControl?.canManageRecord?window.FSTAccessControl.canManageRecord(c):true;}
function groupsForFamily(key){return (data?.classes||[]).filter(c=>owned(c)&&classKey(c)===key).sort((a,b)=>(Number(a.groupNumber)||0)-(Number(b.groupNumber)||0));}

function buildGroupName(track,classNumber,groupNumber){return groupLabel({track,classNumber,groupNumber});}
function updateClassNumberOptions(){const track=String(document.getElementById('class-track')?.value||'MPI').toUpperCase(),select=document.getElementById('class-number');if(!select)return;if(track==='MPI')select.innerHTML=MPI_CLASS_LETTERS.map((letter,i)=>`<option value="${i+1}">${letter}</option>`).join('');else select.innerHTML='<option value="1">1</option>';}
function updateGroupOptions(){const select=document.getElementById('class-group-number');if(select)select.innerHTML=Array.from({length:10},(_,i)=>`<option value="${i+1}">G${i+1}</option>`).join('');}
function initFormOptions(){updateClassNumberOptions();updateGroupOptions();}
function normalizeClassNames(payload){for(const c of payload?.classes||[])c.name=groupLabel(c);return payload;}
const previousFetch=window.fetchRemoteData;if(typeof previousFetch==='function')window.fetchRemoteData=async function(...args){return normalizeClassNames(await previousFetch.apply(this,args));};
if(typeof data!=='undefined'&&data?.classes)normalizeClassNames(data);

function ensureStyles(){if(document.getElementById('fst-class-structure-styles'))return;const s=document.createElement('style');s.id='fst-class-structure-styles';s.textContent='.student-class-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.student-class-header .btn{background:#fff;color:#092f63}.student-group-1{border-left-color:#0d6efd!important;background:#eef5ff!important}.student-group-2{border-left-color:#198754!important;background:#eefaf4!important}.student-group-3{border-left-color:#fd7e14!important;background:#fff5eb!important}.student-group-4{border-left-color:#6f42c1!important;background:#f6f0ff!important}.student-group-5{border-left-color:#d63384!important;background:#fff0f7!important}.student-group-6{border-left-color:#20c997!important;background:#edfffa!important}.student-group-7{border-left-color:#dc3545!important;background:#fff1f2!important}.student-group-8{border-left-color:#0dcaf0!important;background:#eefcff!important}.student-group-9{border-left-color:#795548!important;background:#f8f2ef!important}.student-group-10{border-left-color:#607d8b!important;background:#f1f5f7!important}';document.head.appendChild(s);}
function renderStudents(){ensureStyles();const table=document.getElementById('students-table');if(!table)return;let host=document.getElementById('students-by-class');if(!host){host=document.createElement('div');host.id='students-by-class';table.parentElement.insertBefore(host,table);}table.style.display='none';host.innerHTML='';const families=new Map();for(const c of (data?.classes||[]).filter(owned)){const key=classKey(c);if(key&&!families.has(key))families.set(key,[]);if(key)families.get(key).push(c);}for(const [key,groups] of [...families.entries()].sort(([a],[b])=>a.localeCompare(b,'fr',{numeric:true}))){const block=document.createElement('section');block.className='student-class-block';block.dataset.classKey=key;block.innerHTML=`<div class="student-class-header"><strong>${esc(key)}</strong><button type="button" class="btn btn-sm" onclick="FSTClassStructure.generateClassPdf('${esc(key)}')"><i class="fas fa-file-pdf"></i> PDF de la classe</button></div>`;for(const c of groups.sort((a,b)=>(Number(a.groupNumber)||0)-(Number(b.groupNumber)||0))){const students=(data.students||[]).filter(st=>String(st.classId)===String(c.id)).sort((a,b)=>(a.lastname||'').localeCompare(b.lastname||'','fr')||(a.firstname||'').localeCompare(b.firstname||'','fr'));const g=document.createElement('div');g.className=`student-group-block ${groupStyle(c.groupNumber)}`;g.innerHTML=`<div class="student-group-title">G${esc(c.groupNumber||'—')} · ${students.length} étudiant(s)</div>`;if(!students.length)g.insertAdjacentHTML('beforeend','<div class="student-class-empty">Aucun étudiant dans ce groupe.</div>');else for(const st of students){const opts=groupsForFamily(key).map(target=>`<option value="${esc(target.id)}" ${String(target.id)===String(st.classId)?'selected':''}>G${esc(target.groupNumber||'—')}</option>`).join('');g.insertAdjacentHTML('beforeend',`<div class="student-item"><div><strong>${esc(st.lastname)} ${esc(st.firstname)}</strong><br><small>${esc(st.email||'—')}</small></div><div><select class="student-group-select" aria-label="Groupe de ${esc(st.lastname)} ${esc(st.firstname)}" onchange="changeStudentGroup('${esc(st.id)}',this.value,this)">${opts}</select> <button class="btn btn-sm btn-danger" onclick="deleteStudent('${esc(st.id)}')"><i class="fas fa-trash"></i></button></div></div>`);}block.appendChild(g);}host.appendChild(block);}if(!families.size)host.innerHTML='<div class="student-class-empty">Aucune classe disponible.</div>';}
async function changeStudentGroup(studentId,targetClassId,selectEl){const st=(data?.students||[]).find(s=>String(s.id)===String(studentId)),from=(data?.classes||[]).find(c=>String(c.id)===String(st?.classId)),to=(data?.classes||[]).find(c=>String(c.id)===String(targetClassId));if(!st||!from||!to||classKey(from)!==classKey(to)||!owned(to)){if(selectEl)selectEl.value=st?.classId||'';showAlert('Changement de groupe non autorisé.','danger');return false;}const{error}=await supabaseClient.from('students').update({class_id:String(targetClassId)}).eq('id',String(studentId));if(error){if(selectEl)selectEl.value=String(st.classId);showAlert('Changement de groupe impossible.','danger');return false;}await window.FSTOnlineRuntime?.refreshAuthoritativeState();showAlert('Groupe de l’étudiant modifié avec succès.','success');return true;}

function gradeText(v){const n=Number(v);return Number.isFinite(n)?`${Number.isInteger(n)?n:n.toFixed(2)} /20`:'—';}
function buildClassReportModel(key){
  const classes=groupsForFamily(key);if(!classes.length)throw new Error('Classe introuvable.');
  const classIds=new Set(classes.map(c=>String(c.id))),classMap=new Map(classes.map(c=>[String(c.id),c]));
  const students=(data.students||[]).filter(st=>classIds.has(String(st.classId))).sort((a,b)=>(a.lastname||'').localeCompare(b.lastname||'','fr')||(a.firstname||'').localeCompare(b.firstname||'','fr'));
  const sessions=(data.sessions||[]).filter(s=>classIds.has(String(s.classId))).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.start||'').localeCompare(String(b.start||'')));
  const attendance=data.attendance||[];
  const rows=students.map(st=>{
    const group=classMap.get(String(st.classId));
    const relevantSessions=sessions.filter(s=>String(s.classId)===String(st.classId)||attendance.some(x=>String(x.sessionId)===String(s.id)&&String(x.studentId)===String(st.id)));
    const notes=relevantSessions.map(s=>{
      const a=attendance.find(x=>String(x.sessionId)===String(s.id)&&String(x.studentId)===String(st.id));
      const sessionGroup=classMap.get(String(s.classId));
      const value=a?.grade==null?null:Number(a.grade),module=sessionGroup?.module||'—';
      return {sessionId:s.id,date:s.date,module,groupNumber:sessionGroup?.groupNumber||'—',value:Number.isFinite(value)?value:null,display:a?.grade==null?'—':gradeText(a.grade)};
    });
    const entered=notes.filter(n=>n.value!=null).map(n=>n.value),average=entered.length?entered.reduce((sum,n)=>sum+n,0)/entered.length:null;
    return {lastname:st.lastname||'',firstname:st.firstname||'',group:`G${group?.groupNumber||'—'}`,notes,average,averageDisplay:average==null?'—':`${average.toFixed(2)} /20`};
  });
  return {institution:INSTITUTION,academicYear:YEAR,classLabel:key,teacher:currentTeacher?.name||'Enseignant',rows};
}
function safeFilePart(v){return String(v||'classe').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');}
function generateClassPdf(key){try{const m=buildClassReportModel(key),jsPDF=window.jspdf?.jsPDF;if(!jsPDF)throw new Error('Moteur PDF indisponible.');const doc=new jsPDF({unit:'mm',format:'a4',orientation:'landscape'});doc.setFontSize(14);doc.text('Relevé des notes par classe',12,14);doc.setFontSize(9);doc.text(m.institution,12,21);doc.text(`Année universitaire : ${m.academicYear}`,12,26);doc.text(`Classe : ${m.classLabel} | Enseignant : ${m.teacher}`,12,31);doc.autoTable({startY:37,head:[['Nom','Prénom','Groupe','Notes par séance','Moyenne /20']],body:m.rows.map(r=>[r.lastname,r.firstname,r.group,r.notes.length?r.notes.map(n=>`${n.date} · ${n.module} · G${n.groupNumber} : ${n.display}`).join('\n'):'Aucune séance',r.averageDisplay]),styles:{fontSize:7.5,cellPadding:1.8,overflow:'linebreak',valign:'top'},headStyles:{fontStyle:'bold'},columnStyles:{0:{cellWidth:38},1:{cellWidth:38},2:{cellWidth:18},3:{cellWidth:150},4:{cellWidth:28}},margin:{left:12,right:12}});doc.save(`Notes_${safeFilePart(m.classLabel)}_${m.academicYear.replace('/','-')}.pdf`);return true;}catch(e){console.error(e);showAlert(`PDF de classe impossible : ${e.message}`,'danger');return false;}}

window.buildGroupName=buildGroupName;window.updateClassNumberOptions=updateClassNumberOptions;window.renderStudents=renderStudents;window.changeStudentGroup=changeStudentGroup;window.FSTClassStructure={classLetter,classLabel,groupLabel,classKey,groupStyle,groupsForFamily,buildClassReportModel,generateClassPdf,initFormOptions};window.FSTStudentManagement={...(window.FSTStudentManagement||{}),classKey,groupStyle,groupsForFamily};window.FSTPdf={...(window.FSTPdf||{}),buildClassReportModel,generateClassPdf};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initFormOptions,{once:true});else initFormOptions();
})();