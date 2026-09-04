(function(root,factory){
  const api=factory(root.V16PlanningData,root.V16PlanningState,root.V16PlanningEditor,root.V16PlanningExportModel,root.V16PlanningPdf,root.V16PlanningXlsx,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(dataApi,stateApi,planningEditorApi,exportModelApi,planningPdfApi,planningXlsxApi,host){
  'use strict';
  let context={supabaseClient:null,currentTeacher:null};
  let planningState={rows:[]};
  let teachers=[];
  let initialized=false;
  let lastFiltered=[];

  function runtimeClient(){try{return typeof supabaseClient!=='undefined'?supabaseClient:(host.supabaseClient||null);}catch(_){return host.supabaseClient||null;}}
  function runtimeTeacher(){try{return typeof currentTeacher!=='undefined'?currentTeacher:(host.currentTeacher||null);}catch(_){return host.currentTeacher||null;}}
  function currentContext(){return host.V16TestMode?.getContext?.()||'real';}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmtDate(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(value||'');}
  function dayLabel(day){return ({monday:'Lundi',thursday:'Jeudi',friday:'Vendredi'})[day]||day||'—';}
  function teacherName(id){if(!id)return 'Non affecté';return teachers.find(t=>String(t.id)===String(id))?.full_name||String(id);}
  function option(value,label){return `<option value="${esc(value)}">${esc(label)}</option>`;}
  function unique(values){return [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'fr'));}

  function shell(rows){
    const classes=unique(rows.map(r=>r.className)),weeks=unique(rows.map(r=>stateApi.isoWeek(r.date))),teacherIds=unique(teachers.map(t=>String(t.id)));
    return `<div class="form-row" data-v16-filter-bar="true">
      <div class="form-group"><label for="v16-filter-class">Classe</label><select id="v16-filter-class" class="form-control"><option value="">Toutes</option>${classes.map(v=>option(v,v)).join('')}</select></div>
      <div class="form-group"><label for="v16-filter-group">Groupe</label><select id="v16-filter-group" class="form-control"><option value="">Tous</option>${[1,2,3,4].map(v=>option(v,`G${v}`)).join('')}</select></div>
      <div class="form-group"><label for="v16-filter-weekday">Jour</label><select id="v16-filter-weekday" class="form-control"><option value="">Tous</option>${option('monday','Lundi')}${option('thursday','Jeudi')}${option('friday','Vendredi')}</select></div>
      <div class="form-group"><label for="v16-filter-week">Semaine</label><select id="v16-filter-week" class="form-control"><option value="">Toutes</option>${weeks.map(v=>option(v,v)).join('')}</select></div>
      <div class="form-group"><label for="v16-filter-teacher">Enseignant</label><select id="v16-filter-teacher" class="form-control"><option value="">Tous</option>${teacherIds.map(id=>option(id,teacherName(id))).join('')}</select></div>
      <div class="form-group"><label for="v16-filter-manipulation">Manipulation</label><select id="v16-filter-manipulation" class="form-control"><option value="">Toutes</option>${[1,2,3,4,5,6].map(n=>option(`M${n}`,`M${n}`)).join('')}</select></div>
      <div class="form-group"><label for="v16-filter-room">Salle</label><select id="v16-filter-room" class="form-control"><option value="">Toutes</option>${['A','B','C','D'].map(v=>option(v,`Salle ${v}`)).join('')}</select></div>
      <div class="form-group"><label for="v16-filter-from">Du</label><input id="v16-filter-from" class="form-control" type="date"></div>
      <div class="form-group"><label for="v16-filter-to">Au</label><input id="v16-filter-to" class="form-control" type="date"></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 14px;align-items:center">
      <span class="badge badge-info">Séances : <strong id="v16-session-count">0</strong></span>
      <span class="badge badge-info">Affectations : <strong id="v16-assignment-count">0</strong></span>
      <button type="button" class="btn btn-sm btn-secondary" id="v16-clear-filters"><i class="fas fa-filter-circle-xmark"></i> Réinitialiser les filtres</button>
      <div style="display:flex;gap:6px;align-items:center;margin-left:auto" data-v16-generate-menu><strong>Générer</strong><button type="button" class="btn btn-sm btn-primary" data-v16-generate-pdf><i class="fas fa-file-pdf"></i> PDF</button><button type="button" class="btn btn-sm btn-success" data-v16-generate-xlsx><i class="fas fa-file-excel"></i> Excel (.xlsx)</button></div>
      <span id="v16-generate-status" data-v16-generate-status style="font-size:.85rem"></span>
    </div>
    <div id="v16-admin-permutations"></div>
    <div class="table-responsive" aria-live="polite"><table class="table" data-v16-planning-table="true">
      <thead><tr><th>Semaine</th><th>Date</th><th>Jour</th><th>Horaire</th><th>Classe</th><th>Groupe</th><th>Manipulation</th><th>Salle</th><th>Enseignant</th><th>État</th></tr></thead>
      <tbody id="v16-planning-table-body"></tbody></table></div>`;
  }

  function readFilters(){const val=id=>document.getElementById(id)?.value||'';return {className:val('v16-filter-class'),groupNo:val('v16-filter-group'),weekday:val('v16-filter-weekday'),week:val('v16-filter-week'),teacherId:val('v16-filter-teacher'),manipulation:val('v16-filter-manipulation'),room:val('v16-filter-room'),fromDate:val('v16-filter-from'),toDate:val('v16-filter-to')};}
  function renderRows(filtered){
    const body=document.getElementById('v16-planning-table-body');if(!body)return;
    if(!filtered.length){body.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--gray)">Aucune séance ne correspond aux filtres sélectionnés.</td></tr>';return;}
    const out=[];
    for(const row of filtered){
      if(!row.isTeachingSession){out.push(`<tr><td>${esc(stateApi.isoWeek(row.date))}</td><td>${esc(fmtDate(row.date))}</td><td>${esc(dayLabel(row.weekday))}</td><td>${esc(`${row.start||''}${row.end?`–${row.end}`:''}`)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td><span class="badge badge-warning">${esc(row.reason||'Aucun TP')}</span></td></tr>`);continue;}
      for(const group of row.groups||[]){
        const assigned=Boolean(group.teacherId),controls=planningEditorApi?.renderGroupControls?.(row,group)||null;
        const manipCell=controls?controls.manipulation:esc(group.manipulation||'—');
        const roomCell=controls?controls.room:(group.room?`Salle ${esc(group.room)}`:'À choisir');
        const teacherCell=controls?controls.teacher:esc(teacherName(group.teacherId));
        out.push(`<tr><td>${esc(stateApi.isoWeek(row.date))}</td><td>${esc(fmtDate(row.date))}</td><td>${esc(dayLabel(row.weekday))}</td><td>${esc(`${row.start}–${row.end}`)}</td><td>${esc(row.className)}</td><td>G${esc(group.groupNo)}</td><td>${manipCell}</td><td>${roomCell}</td><td>${teacherCell}</td><td><span class="badge ${assigned?'badge-present':'badge-warning'}">${assigned?'Affectée':'À affecter'}</span></td></tr>`);
      }
    }
    body.innerHTML=out.join('');planningEditorApi?.bindTable?.();
  }
  function refresh(){const filtered=stateApi.filterPlanning(planningState,readFilters()),summary=stateApi.planningSummary(filtered);lastFiltered=filtered;const sessions=document.getElementById('v16-session-count'),assignments=document.getElementById('v16-assignment-count');if(sessions)sessions.textContent=String(summary.sessionCount);if(assignments)assignments.textContent=String(summary.assignmentCount);renderRows(filtered);return filtered;}
  function bindFilters(){for(const control of document.querySelectorAll('#v16-planning-root select,#v16-planning-root input'))control.addEventListener('change',refresh);document.getElementById('v16-clear-filters')?.addEventListener('click',()=>{for(const control of document.querySelectorAll('#v16-planning-root select,#v16-planning-root input'))control.value='';refresh();});}

  function exportModel(){const builder=exportModelApi?.buildPlanningExportModel||host.V16PlanningExportModel?.buildPlanningExportModel;if(!builder)throw new Error('Modèle d’export V16 indisponible.');return builder(lastFiltered,{teachers,filters:readFilters(),academicYear:'2026/2027',semester:'Semestre 1',context:currentContext()});}
  function setGenerating(isBusy,text){const pdf=document.querySelector('[data-v16-generate-pdf]'),xlsx=document.querySelector('[data-v16-generate-xlsx]'),status=document.querySelector('[data-v16-generate-status]');if(pdf)pdf.disabled=isBusy;if(xlsx)xlsx.disabled=isBusy;if(status)status.textContent=text||'';}
  async function generate(kind){setGenerating(true,'Génération en cours…');try{const model=exportModel();if(kind==='pdf')await Promise.resolve((planningPdfApi||host.V16PlanningPdf).generate(model));else await Promise.resolve((planningXlsxApi||host.V16PlanningXlsx).generate(model));setGenerating(false,kind==='pdf'?'PDF généré.':'Excel généré.');return true;}catch(error){setGenerating(false,`Erreur : ${error?.message||error}`);return false;}}
  function bindGenerate(){document.querySelector('[data-v16-generate-pdf]')?.addEventListener('click',()=>{void generate('pdf');});document.querySelector('[data-v16-generate-xlsx]')?.addEventListener('click',()=>{void generate('xlsx');});}

  async function teacherDirectory(client){const r=await client.from('profiles').select('id,full_name,role,email').in('role',['teacher','admin']).is('deleted_at',null).order('full_name');return r.error?[]:(r.data||[]);}
  async function remoteReal(client){
    const cycleRes=await client.from('v515_cycles').select('id').eq('academic_year','2026/2027').eq('semester',1).maybeSingle();if(cycleRes.error)throw cycleRes.error;if(!cycleRes.data)return {assignments:[],teachers:await teacherDirectory(client)};
    const cycleId=cycleRes.data.id;
    const [sessionsRes,assignmentsRes,dir]=await Promise.all([
      client.from('v515_sessions').select('id,session_date,class_name').eq('cycle_id',cycleId),
      client.from('v515_assignments').select('session_id,group_no,teacher_id,manipulation_code,room').eq('cycle_id',cycleId),
      teacherDirectory(client)]);
    if(sessionsRes.error)throw sessionsRes.error;if(assignmentsRes.error)throw assignmentsRes.error;
    const sessions=new Map((sessionsRes.data||[]).map(s=>[String(s.id),s]));
    const assignments=(assignmentsRes.data||[]).map(a=>{const s=sessions.get(String(a.session_id));return s?{sessionId:a.session_id,date:s.session_date,className:s.class_name,groupNo:Number(a.group_no),teacherId:a.teacher_id,manipulation:a.manipulation_code,room:a.room}:null;}).filter(Boolean);
    return {assignments,teachers:dir};
  }
  async function remoteTest(client){
    const [sessionsRes,assignmentsRes,dir]=await Promise.all([
      client.from('v16_test_sessions').select('id,real_session_id,session_date,class_name'),
      client.from('v16_test_assignments').select('test_session_id,group_no,teacher_id,manipulation_code,room,real_assignment_id'),
      teacherDirectory(client)]);
    if(sessionsRes.error)throw sessionsRes.error;if(assignmentsRes.error)throw assignmentsRes.error;
    const sessions=new Map((sessionsRes.data||[]).map(s=>[String(s.id),s]));
    const assignments=(assignmentsRes.data||[]).map(a=>{const s=sessions.get(String(a.test_session_id));return s?{sessionId:a.test_session_id,realAssignmentId:a.real_assignment_id,date:s.session_date,className:s.class_name,groupNo:Number(a.group_no),teacherId:a.teacher_id,manipulation:a.manipulation_code,room:a.room}:null;}).filter(Boolean);
    return {assignments,teachers:dir};
  }
  async function remoteAssignments(client){if(!client)return {assignments:[],teachers:[]};return currentContext()==='test'?remoteTest(client):remoteReal(client);}

  async function init(options={}){
    const container=document.getElementById('v16-planning-root');if(!container)return false;
    if(!dataApi||!stateApi){container.innerHTML='<div class="alert alert-danger">Erreur de chargement : modules V16 indisponibles.</div>';return false;}
    context={supabaseClient:options.supabaseClient||runtimeClient(),currentTeacher:options.currentTeacher||runtimeTeacher()};container.innerHTML='<div class="alert alert-info">Chargement du planning interactif…</div>';
    try{
      const remote=await remoteAssignments(context.supabaseClient);teachers=remote.teachers;planningState=stateApi.createPlanningState(dataApi.rows(),remote.assignments);container.innerHTML=shell(planningState.rows);bindFilters();bindGenerate();initialized=true;refresh();
      planningEditorApi?.render?.({supabaseClient:context.supabaseClient,currentTeacher:context.currentTeacher,teachers,planningState,context:currentContext(),onSaved:async()=>{initialized=false;await init(context);}});
      return true;
    }catch(error){initialized=false;container.innerHTML=`<div class="alert alert-danger"><strong>Erreur de chargement.</strong> ${esc(error?.message||error)}</div>`;return false;}
  }
  function autoInit(){if(initialized)return;init({supabaseClient:runtimeClient(),currentTeacher:runtimeTeacher()});}
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autoInit);else autoInit();}
  return {init,refresh,generate};
});
