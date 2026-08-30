(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else { root.FSTStatistics=api; api.installBrowser(); }
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STATUS_KEYS=['present','absent','retard','justifie'];
  const STATUS_LABELS={present:'Présents',absent:'Absents',retard:'Retards',justifie:'Justifiés'};
  function round2(v){return Math.round((v+Number.EPSILON)*100)/100;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function inDateRange(date,from,to){return (!from||date>=from)&&(!to||date<=to);}
  function recognized(a){return !a?.gradeOnly&&STATUS_KEYS.includes(a?.status);}
  function avg(values){return values.length?round2(values.reduce((a,b)=>a+b,0)/values.length):null;}
  function buildBreakdown(items,keyOf,labelOf){
    const map=new Map();
    for(const item of items){const key=String(keyOf(item)||'');if(!key)continue;if(!map.has(key))map.set(key,{key,label:labelOf(item,key),rows:[]});map.get(key).rows.push(item);}
    return [...map.values()].map(group=>{
      const counted=group.rows.filter(recognized);const grades=group.rows.map(x=>x.grade).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);
      return {key:group.key,label:group.label,count:counted.length,presenceRate:counted.length?round2(100*counted.filter(x=>x.status==='present').length/counted.length):0,averageGrade:avg(grades)};
    }).sort((a,b)=>a.label.localeCompare(b.label,'fr'));
  }
  function computeStatistics(source,filters,user){
    source=source||{};filters=filters||{};user=user||{};
    const classes=source.classes||[], allSessions=source.sessions||[], allStudents=source.students||[], allAttendance=source.attendance||[];
    const admin=Boolean(user.isAdmin);
    const effectiveTeacherId=admin?(filters.teacherId?String(filters.teacherId):null):String(user.id||'');
    const sessions=allSessions.filter(s=>(!effectiveTeacherId||String(s.teacherId)===effectiveTeacherId)&&(!filters.classId||String(s.classId)===String(filters.classId))&&inDateRange(String(s.date||''),filters.from,filters.to));
    const sessionIds=new Set(sessions.map(s=>String(s.id)));
    const classIds=new Set(sessions.map(s=>String(s.classId)));
    const students=allStudents.filter(st=>classIds.has(String(st.classId))&&(!effectiveTeacherId||!st.teacherId||String(st.teacherId)===effectiveTeacherId));
    const attendanceAll=allAttendance.filter(a=>sessionIds.has(String(a.sessionId)));
    const countedAttendance=attendanceAll.filter(recognized);
    const statusCounts={present:0,absent:0,retard:0,justifie:0};
    countedAttendance.forEach(a=>statusCounts[a.status]++);
    const grades=attendanceAll.map(a=>a.grade).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);
    const timeline=sessions.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(s=>{
      const rows=countedAttendance.filter(a=>String(a.sessionId)===String(s.id));
      const present=rows.filter(a=>a.status==='present').length;
      return {sessionId:s.id,date:s.date,presenceRate:rows.length?round2(present*100/rows.length):0,total:rows.length};
    });
    const teacherName=id=>root?.FSTAccessControl?.teacherNameFor?.(id)||String(id||'Enseignant');
    const className=id=>classes.find(c=>String(c.id)===String(id))?.name||String(id||'Classe');
    const byTeacher=buildBreakdown(countedAttendance,a=>sessions.find(s=>String(s.id)===String(a.sessionId))?.teacherId,(a,key)=>teacherName(key));
    const byClass=buildBreakdown(countedAttendance,a=>sessions.find(s=>String(s.id)===String(a.sessionId))?.classId,(a,key)=>className(key));
    return {sessions:sessions.length,students:students.length,attendance:countedAttendance.length,statusCounts,averageGrade:avg(grades),timeline,grades,byTeacher,byClass};
  }
  function buildStatusChartSvg(stats){
    const vals=STATUS_KEYS.map(k=>stats.statusCounts?.[k]||0),max=Math.max(1,...vals),w=520,h=220,base=175,barW=72,gap=48;
    const bars=vals.map((v,i)=>{const bh=Math.round(120*v/max),x=45+i*(barW+gap),y=base-bh;return `<g><rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="6" fill="currentColor" opacity="0.75"/><text x="${x+barW/2}" y="${y-8}" text-anchor="middle" font-size="13">${v}</text><text x="${x+barW/2}" y="${base+24}" text-anchor="middle" font-size="12">${STATUS_LABELS[STATUS_KEYS[i]]}</text></g>`;}).join('');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Répartition des présences" style="width:100%;height:auto;color:#163a66"><line x1="30" y1="${base}" x2="500" y2="${base}" stroke="currentColor" opacity=".25"/>${bars}</svg>`;
  }
  function buildTimelineChartSvg(stats){
    const rows=stats.timeline||[],w=520,h=220,left=42,right=16,top=22,bottom=40,plotW=w-left-right,plotH=h-top-bottom;
    if(!rows.length)return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto"><text x="260" y="110" text-anchor="middle" font-size="13">Aucune séance</text></svg>`;
    const pts=rows.map((r,i)=>{const x=left+(rows.length===1?plotW/2:i*plotW/(rows.length-1)),y=top+plotH-(Math.max(0,Math.min(100,r.presenceRate))*plotH/100);return {x,y,r};});
    const path=pts.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const dots=pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="currentColor"/><text x="${p.x}" y="${Math.max(12,p.y-8)}" text-anchor="middle" font-size="11">${p.r.presenceRate}%</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Évolution du taux de présence" style="width:100%;height:auto;color:#163a66"><line x1="${left}" y1="${top+plotH}" x2="${w-right}" y2="${top+plotH}" stroke="currentColor" opacity=".25"/><line x1="${left}" y1="${top}" x2="${left}" y2="${top+plotH}" stroke="currentColor" opacity=".25"/><path d="${path}" fill="none" stroke="currentColor" stroke-width="3"/>${dots}</svg>`;
  }
  function filterFromDom(){
    if(!root?.document)return {};
    const period=root.document.getElementById('fst-stats-period')?.value||'all';
    let from='';const to='';
    if(period!=='all'){const d=new Date();d.setDate(d.getDate()-Number(period));from=d.toISOString().slice(0,10);}
    return {teacherId:root.document.getElementById('fst-stats-teacher')?.value||'',classId:root.document.getElementById('fst-stats-class')?.value||'',from,to};
  }
  function sourceFromGlobals(){return {classes:root?.data?.classes||[],students:root?.data?.students||[],sessions:root?.data?.sessions||[],attendance:root?.data?.attendance||[]};}
  function userFromGlobals(){return {id:root?.currentTeacher?.id||'',isAdmin:Boolean(root?.currentTeacher?.isAdmin)};}
  function ensurePanel(){
    const doc=root?.document;if(!doc)return null;let panel=doc.getElementById('fst-statistics-panel');if(panel)return panel;
    const dashboard=doc.getElementById('dashboard');if(!dashboard)return null;panel=doc.createElement('div');panel.id='fst-statistics-panel';panel.className='card';panel.style.marginTop='20px';dashboard.appendChild(panel);return panel;
  }
  function renderDashboard(source,filters,user){
    const stats=computeStatistics(source||sourceFromGlobals(),filters||filterFromDom(),user||userFromGlobals());
    if(!root?.document)return stats;
    const panel=ensurePanel();if(!panel)return stats;const admin=Boolean((user||userFromGlobals()).isAdmin);const src=source||sourceFromGlobals();
    const teacherIds=[...new Set((src.sessions||[]).map(s=>String(s.teacherId)).filter(Boolean))];
    const teacherOptions=teacherIds.map(id=>`<option value="${esc(id)}">${esc(root.FSTAccessControl?.teacherNameFor?.(id)||id)}</option>`).join('');
    const classOptions=(src.classes||[]).filter(c=>admin||String(c.teacherId)===String(root.currentTeacher?.id)).map(c=>`<option value="${esc(c.id)}">${esc(c.name||'Classe')}</option>`).join('');
    panel.innerHTML=`<div class="card-header"><h2><i class="fas fa-chart-line"></i> Statistiques et graphiques</h2></div><div class="card-body"><div class="form-row">${admin?`<div class="form-group"><label>Enseignant</label><select id="fst-stats-teacher" class="form-control"><option value="">Tous les enseignants</option>${teacherOptions}</select></div>`:''}<div class="form-group"><label>Classe / groupe</label><select id="fst-stats-class" class="form-control"><option value="">Toutes les classes</option>${classOptions}</select></div><div class="form-group"><label>Période</label><select id="fst-stats-period" class="form-control"><option value="all">Toute l'année</option><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option></select></div></div><div class="stats-grid" style="margin-top:14px"><div class="stats-card"><div class="number">${stats.sessions}</div><div class="label">Séances</div></div><div class="stats-card"><div class="number">${stats.students}</div><div class="label">Étudiants</div></div><div class="stats-card"><div class="number">${stats.attendance}</div><div class="label">Pointages</div></div><div class="stats-card"><div class="number">${stats.averageGrade==null?'—':stats.averageGrade}</div><div class="label">Moyenne /20</div></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;margin-top:18px"><div><h3>Répartition des présences</h3>${buildStatusChartSvg(stats)}</div><div><h3>Évolution du taux de présence</h3>${buildTimelineChartSvg(stats)}</div></div><div style="margin-top:14px"><button id="fst-stats-pdf" class="btn btn-primary"><i class="fas fa-file-pdf"></i> PDF statistiques</button></div></div>`;
    const tf=root.document.getElementById('fst-stats-teacher');if(tf)tf.value=(filters||{}).teacherId||'';
    const cf=root.document.getElementById('fst-stats-class');if(cf)cf.value=(filters||{}).classId||'';
    const pf=root.document.getElementById('fst-stats-period');if(pf)pf.value=(filters||{}).period||'all';
    [tf,cf,pf].filter(Boolean).forEach(el=>el.addEventListener('change',()=>renderDashboard()));
    root.document.getElementById('fst-stats-pdf')?.addEventListener('click',()=>generateStatisticsPdf(filterFromDom()));
    return stats;
  }
  function drawPdfCharts(doc,stats,startY){
    let y=Number(startY)||40;const left=14,width=182;
    doc.setFontSize(11);doc.text('Répartition des présences',left,y);y+=5;
    const vals=STATUS_KEYS.map(k=>stats.statusCounts?.[k]||0),max=Math.max(1,...vals),barW=28,gap=16;
    vals.forEach((v,i)=>{const h=28*v/max,x=left+i*(barW+gap);doc.rect(x,y+30-h,barW,h,'S');doc.setFontSize(8);doc.text(String(v),x+barW/2,y+27-h,{align:'center'});doc.text(STATUS_LABELS[STATUS_KEYS[i]],x+barW/2,y+35,{align:'center'});});
    y+=46;doc.setFontSize(11);doc.text('Évolution du taux de présence',left,y);y+=5;
    const rows=stats.timeline||[];if(rows.length){const plotW=width,plotH=35;let prev=null;rows.forEach((r,i)=>{const x=left+(rows.length===1?plotW/2:i*plotW/(rows.length-1)),yy=y+plotH-(Math.max(0,Math.min(100,r.presenceRate))*plotH/100);doc.circle(x,yy,1.2,'F');if(prev)doc.line(prev.x,prev.y,x,yy);prev={x,y:yy};});doc.rect(left,y,plotW,plotH,'S');y+=plotH+6;}else{doc.setFontSize(8);doc.text('Aucune séance',left,y+6);y+=12;}
    return y;
  }
  function savePdf(doc,filename){
    if(root?.AndroidPdfBridge&&typeof root.AndroidPdfBridge.savePdf==='function'){root.AndroidPdfBridge.savePdf(filename,doc.output('datauristring'));return true;}
    doc.save(filename);return true;
  }
  function generateStatisticsPdf(filters){
    if(!root?.jspdf?.jsPDF)throw new Error('Moteur PDF indisponible.');
    const stats=computeStatistics(sourceFromGlobals(),filters||filterFromDom(),userFromGlobals()),doc=new root.jspdf.jsPDF({unit:'mm',format:'a4'});
    doc.setFontSize(14);doc.text('Statistiques de présence et de notes',14,16);doc.setFontSize(9);doc.text('Faculté des Sciences de Tunis — Université de Tunis El Manar',14,23);doc.text('Année universitaire : 2026/2027',14,28);
    doc.setFontSize(10);doc.text(`Séances : ${stats.sessions}   Étudiants : ${stats.students}   Pointages : ${stats.attendance}   Moyenne : ${stats.averageGrade==null?'—':stats.averageGrade+' /20'}`,14,36);
    let y=drawPdfCharts(doc,stats,44)+4;
    if(stats.byTeacher.length){doc.setFontSize(11);doc.text('Comparaison par enseignant',14,y);doc.autoTable({startY:y+3,head:[['Enseignant','Pointages','Présence','Moyenne']],body:stats.byTeacher.map(x=>[x.label,String(x.count),`${x.presenceRate}%`,x.averageGrade==null?'—':String(x.averageGrade)]),styles:{fontSize:8,cellPadding:2},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y+12)+8;}
    if(y>235){doc.addPage();y=18;}
    if(stats.byClass.length){doc.setFontSize(11);doc.text('Comparaison par classe / groupe',14,y);doc.autoTable({startY:y+3,head:[['Classe','Pointages','Présence','Moyenne']],body:stats.byClass.map(x=>[x.label,String(x.count),`${x.presenceRate}%`,x.averageGrade==null?'—':String(x.averageGrade)]),styles:{fontSize:8,cellPadding:2},margin:{left:14,right:14}});}
    return savePdf(doc,'Statistiques_Presence_2026-2027.pdf');
  }
  function installBrowser(){
    if(!root?.document)return;const old=root.updateDashboard;if(typeof old==='function'&&!old.__fstStatsWrapped){const wrapped=function(){const r=old.apply(this,arguments);setTimeout(()=>renderDashboard(),0);return r;};wrapped.__fstStatsWrapped=true;root.updateDashboard=wrapped;}setTimeout(()=>{if(root.currentTeacher)renderDashboard();},0);
  }
  return {computeStatistics,buildStatusChartSvg,buildTimelineChartSvg,renderDashboard,drawPdfCharts,generateStatisticsPdf,filterFromDom,installBrowser};
});
