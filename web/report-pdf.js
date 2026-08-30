(function(){
  'use strict';
  const INSTITUTION_NAME='Faculté des Sciences de Tunis — Université de Tunis El Manar';
  const YEAR='2026/2027';
  function acl(){return window.FSTAccessControl;}
  function sessionById(id){return (data.sessions||[]).find(s=>String(s.id)===String(id));}
  function classFor(s){return (data.classes||[]).find(c=>String(c.id)===String(s.classId));}
  function teacherName(id){return acl()?.teacherNameFor(id)||currentTeacher?.name||'Enseignant';}
  function safeFilePart(v){return String(v||'rapport').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');}
  function engine(){const jsPDF=window.jspdf?.jsPDF;if(!jsPDF)throw new Error('Moteur PDF indisponible.');return jsPDF;}

  function buildSessionReportModel(sessionId){
    const s=sessionById(sessionId); if(!s)throw new Error('Séance introuvable.');
    if(!acl()?.canManageRecord(s))throw new Error('Cette séance est en lecture seule.');
    const c=classFor(s); const students=(data.students||[]).filter(st=>String(st.classId)===String(s.classId));
    return {institution:INSTITUTION_NAME,academicYear:YEAR,teacher:teacherName(s.teacherId),track:c?.track||'—',classNumber:c?.classNumber||'—',groupNumber:c?.groupNumber||'—',module:c?.module||'—',date:s.date,start:s.start,end:s.end,room:c?.room||'—',students:students.map(st=>{const a=(data.attendance||[]).find(x=>String(x.sessionId)===String(s.id)&&String(x.studentId)===String(st.id));return{name:`${st.lastname} ${st.firstname}`,status:a?.status||'Non saisi',comment:a?.comment||'—',grade:a?.grade==null?'—':`${a.grade} /20`};})};
  }

  function addHeader(doc,title,model){
    doc.setFontSize(14);doc.text(title,14,16);doc.setFontSize(9);
    const lines=[model.institution,`Année universitaire : ${model.academicYear}`,`Enseignant : ${model.teacher}`];
    lines.forEach((x,i)=>doc.text(String(x),14,23+i*5));
  }
  function generateSessionPdf(sessionId){
    try{
      const m=buildSessionReportModel(sessionId);const jsPDF=engine();const doc=new jsPDF({unit:'mm',format:'a4'});addHeader(doc,'Rapport de séance TP',m);
      doc.setFontSize(9);doc.text(`Filière : ${m.track} | Classe : ${m.classNumber} | Groupe : G${m.groupNumber}`,14,40);doc.text(`Module : ${m.module} | Date : ${m.date} | ${m.start}-${m.end} | Salle : ${m.room}`,14,45);
      doc.autoTable({startY:51,head:[['Étudiant','Présence','Commentaire','Note']],body:m.students.map(x=>[x.name,x.status,x.comment,x.grade]),styles:{fontSize:8,cellPadding:2},headStyles:{fontStyle:'bold'},margin:{left:14,right:14}});
      doc.save(`Presence_TP_${safeFilePart(m.classNumber)}_${safeFilePart(m.date)}.pdf`);return true;
    }catch(e){console.error(e);showAlert(`PDF impossible : ${e.message}`,'danger');return false;}
  }

  function buildGeneralReportModel(requestedTeacherId){
    const admin=acl()?.isAdmin();const own=String(currentTeacher?.id||'');const target=admin?(requestedTeacherId?String(requestedTeacherId):null):own;
    if(!admin && requestedTeacherId && String(requestedTeacherId)!==own)throw new Error('Rapport non autorisé.');
    const sessions=(data.sessions||[]).filter(s=>!target||String(s.teacherId)===target);
    const groups=new Map();
    for(const s of sessions){
      const tid=String(s.teacherId);if(!groups.has(tid))groups.set(tid,{teacherId:tid,teacher:teacherName(tid),rows:[]});const c=classFor(s);
      const ownStudents=(data.students||[]).filter(st=>String(st.classId)===String(s.classId)&&(!st.teacherId||String(st.teacherId)===tid));
      const attendance=(data.attendance||[]).filter(a=>String(a.sessionId)===String(s.id));
      groups.get(tid).rows.push({date:s.date,time:`${s.start}-${s.end}`,className:c?.name||'—',module:c?.module||'—',room:c?.room||'—',students:ownStudents.length,attendance:attendance.length});
    }
    return {institution:INSTITUTION_NAME,academicYear:YEAR,groups:[...groups.values()]};
  }
  function generateGeneralPdf(requestedTeacherId){
    try{
      const m=buildGeneralReportModel(requestedTeacherId);const jsPDF=engine();const doc=new jsPDF({unit:'mm',format:'a4'});doc.setFontSize(14);doc.text('Rapport général de présence',14,16);doc.setFontSize(9);doc.text(m.institution,14,23);doc.text(`Année universitaire : ${m.academicYear}`,14,28);let y=36;
      for(const g of m.groups){if(y>250){doc.addPage();y=18;}doc.setFontSize(10);doc.text(`Enseignant : ${g.teacher}`,14,y);doc.autoTable({startY:y+3,head:[['Date','Horaire','Classe','Module','Salle','Étudiants','Pointages']],body:g.rows.map(r=>[r.date,r.time,r.className,r.module,r.room,String(r.students),String(r.attendance)]),styles:{fontSize:7,cellPadding:1.7},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y+10)+9;}
      doc.save(`Rapport_general_${safeFilePart(requestedTeacherId||'tous')}.pdf`);return true;
    }catch(e){console.error(e);showAlert(`PDF impossible : ${e.message}`,'danger');return false;}
  }

  function renderSessionHtml(sessionId){
    try{const m=buildSessionReportModel(sessionId);const rows=m.students.map(x=>`<tr><td>${x.name}</td><td>${x.status}</td><td>${x.comment}</td><td>${x.grade}</td></tr>`).join('');const el=document.getElementById('session-report-content');if(el)el.innerHTML=`<div class="alert alert-info"><div><strong>Rapport de séance TP</strong><br>${m.institution}<br>Année universitaire : ${m.academicYear}<br>Enseignant : ${m.teacher}<br>Filière : ${m.track} | Classe : ${m.classNumber} | Groupe : G${m.groupNumber}<br>Module : ${m.module} | Date : ${m.date} | ${m.start}-${m.end} | Salle : ${m.room}</div></div><div class="table-responsive"><table class="table"><thead><tr><th>Étudiant</th><th>Présence</th><th>Commentaire</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div><button class="btn btn-primary" onclick="FSTPdf.generateSessionPdf('${sessionId}')"><i class="fas fa-file-pdf"></i> Télécharger PDF</button> <button class="btn btn-info" onclick="openSessionForNotes('${sessionId}')"><i class="fas fa-pen"></i> Modifier les notes</button>`;return true;}catch(e){showAlert(e.message,'danger');return false;}
  }

  function refreshGeneralPdfButton(){
    const c=document.getElementById('report-content');if(!c||!c.innerHTML.trim())return;if(!document.getElementById('download-general-pdf')){const b=document.createElement('button');b.id='download-general-pdf';b.className='btn btn-primary';b.style.marginTop='14px';b.innerHTML='<i class="fas fa-file-pdf"></i> Télécharger PDF';b.onclick=()=>generateGeneralPdf(document.getElementById('report-teacher')?.value||'');c.appendChild(b);}
  }
  async function ensureAdminTeacherFilter(){
    const existing=document.getElementById('report-teacher-wrap');if(existing){existing.style.display=acl()?.isAdmin()?'block':'none';return;}
    if(!acl()?.isAdmin())return;await acl().refreshTeacherNames();const report=document.getElementById('rapports')?.querySelector('.form-row');if(!report)return;const wrap=document.createElement('div');wrap.className='form-group';wrap.id='report-teacher-wrap';wrap.innerHTML='<label>Enseignant</label><select id="report-teacher" class="form-control"><option value="">Tous les enseignants</option></select>';report.prepend(wrap);
    const sel=wrap.querySelector('select');const ids=[...new Set((data.sessions||[]).map(s=>String(s.teacherId)))];ids.sort((a,b)=>teacherName(a).localeCompare(teacherName(b),'fr')).forEach(id=>{const o=document.createElement('option');o.value=id;o.textContent=teacherName(id);sel.appendChild(o);});
  }

  window.generateSessionReport=renderSessionHtml;
  window.downloadSessionReportPdf=function(){const id=document.getElementById('presence-session')?.value||'';return generateSessionPdf(id);};
  window.downloadGeneralReportPdf=function(){return generateGeneralPdf(document.getElementById('report-teacher')?.value||'');};
  const oldGenerateReport=window.generateReport;if(typeof oldGenerateReport==='function')window.generateReport=function(){const r=oldGenerateReport.apply(this,arguments);setTimeout(refreshGeneralPdfButton,0);return r;};
  const oldDoLogin=window.doLogin;if(typeof oldDoLogin==='function')window.doLogin=async function(...args){const r=await oldDoLogin.apply(this,args);await ensureAdminTeacherFilter();return r;};
  window.FSTPdf={buildSessionReportModel,generateSessionPdf,buildGeneralReportModel,generateGeneralPdf,ensureAdminTeacherFilter};
})();
