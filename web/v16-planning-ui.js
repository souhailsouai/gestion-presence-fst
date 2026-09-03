(function(root,factory){
  const api=factory(root.V16PlanningData,root.V16PlanningState);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(dataApi,stateApi){
  'use strict';

  let context={supabaseClient:null,currentTeacher:null};
  let planningState={rows:[]};
  let teachers=[];
  let initialized=false;

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function fmtDate(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:String(value||'');
  }

  function dayLabel(day){
    return ({monday:'Lundi',thursday:'Jeudi',friday:'Vendredi'})[day]||day||'—';
  }

  function teacherName(id){
    if(!id)return 'Non affecté';
    return teachers.find(t=>String(t.id)===String(id))?.full_name||String(id);
  }

  function option(value,label){return `<option value="${esc(value)}">${esc(label)}</option>`;}

  function unique(values){return [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'fr'));}

  function shell(rows){
    const classes=unique(rows.map(r=>r.className));
    const weeks=unique(rows.map(r=>stateApi.isoWeek(r.date)));
    const teacherIds=unique(teachers.map(t=>String(t.id)));
    return `
      <div class="form-row" data-v16-filter-bar="true">
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
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 14px">
        <span class="badge badge-info">Séances : <strong id="v16-session-count">0</strong></span>
        <span class="badge badge-info">Affectations : <strong id="v16-assignment-count">0</strong></span>
        <button type="button" class="btn btn-sm btn-secondary" id="v16-clear-filters"><i class="fas fa-filter-circle-xmark"></i> Réinitialiser les filtres</button>
      </div>
      <div class="table-responsive" aria-live="polite">
        <table class="table" data-v16-planning-table="true">
          <thead><tr><th>Semaine</th><th>Date</th><th>Jour</th><th>Horaire</th><th>Classe</th><th>Groupe</th><th>Manipulation</th><th>Salle</th><th>Enseignant</th><th>État</th></tr></thead>
          <tbody id="v16-planning-table-body"></tbody>
        </table>
      </div>`;
  }

  function readFilters(){
    const val=id=>document.getElementById(id)?.value||'';
    return {
      className:val('v16-filter-class'),groupNo:val('v16-filter-group'),weekday:val('v16-filter-weekday'),
      week:val('v16-filter-week'),teacherId:val('v16-filter-teacher'),manipulation:val('v16-filter-manipulation'),
      room:val('v16-filter-room'),fromDate:val('v16-filter-from'),toDate:val('v16-filter-to')
    };
  }

  function renderRows(filtered){
    const body=document.getElementById('v16-planning-table-body');
    if(!body)return;
    if(!filtered.length){
      body.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--gray)">Aucune séance ne correspond aux filtres sélectionnés.</td></tr>';
      return;
    }
    const out=[];
    for(const row of filtered){
      if(!row.isTeachingSession){
        out.push(`<tr><td>${esc(stateApi.isoWeek(row.date))}</td><td>${esc(fmtDate(row.date))}</td><td>${esc(dayLabel(row.weekday))}</td><td>${esc(`${row.start||''}${row.end?`–${row.end}`:''}`)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td><span class="badge badge-warning">${esc(row.reason||'Aucun TP')}</span></td></tr>`);
        continue;
      }
      for(const group of row.groups||[]){
        const assigned=Boolean(group.teacherId);
        out.push(`<tr><td>${esc(stateApi.isoWeek(row.date))}</td><td>${esc(fmtDate(row.date))}</td><td>${esc(dayLabel(row.weekday))}</td><td>${esc(`${row.start}–${row.end}`)}</td><td>${esc(row.className)}</td><td>G${esc(group.groupNo)}</td><td>${esc(group.manipulation)}</td><td>Salle ${esc(group.room)}</td><td>${esc(teacherName(group.teacherId))}</td><td><span class="badge ${assigned?'badge-present':'badge-warning'}">${assigned?'Affectée':'À affecter'}</span></td></tr>`);
      }
    }
    body.innerHTML=out.join('');
  }

  function refresh(){
    const filtered=stateApi.filterPlanning(planningState,readFilters());
    const summary=stateApi.planningSummary(filtered);
    const sessions=document.getElementById('v16-session-count');
    const assignments=document.getElementById('v16-assignment-count');
    if(sessions)sessions.textContent=String(summary.sessionCount);
    if(assignments)assignments.textContent=String(summary.assignmentCount);
    renderRows(filtered);
    return filtered;
  }

  function bindFilters(){
    for(const control of document.querySelectorAll('#v16-planning-root select,#v16-planning-root input')){
      control.addEventListener('change',refresh);
    }
    document.getElementById('v16-clear-filters')?.addEventListener('click',()=>{
      for(const control of document.querySelectorAll('#v16-planning-root select,#v16-planning-root input'))control.value='';
      refresh();
    });
  }

  async function remoteAssignments(client){
    if(!client)return {assignments:[],teachers:[]};
    const cycleRes=await client.from('v515_cycles').select('id').eq('academic_year','2026/2027').eq('semester',1).maybeSingle();
    if(cycleRes.error)throw cycleRes.error;
    if(!cycleRes.data)return {assignments:[],teachers:[]};
    const cycleId=cycleRes.data.id;
    const [sessionsRes,assignmentsRes,teachersRes]=await Promise.all([
      client.from('v515_sessions').select('id,session_date,class_name').eq('cycle_id',cycleId),
      client.from('v515_assignments').select('session_id,group_no,teacher_id').eq('cycle_id',cycleId),
      client.from('profiles').select('id,full_name,role').in('role',['teacher','admin']).is('deleted_at',null).order('full_name')
    ]);
    if(sessionsRes.error)throw sessionsRes.error;
    if(assignmentsRes.error)throw assignmentsRes.error;
    const sessions=new Map((sessionsRes.data||[]).map(s=>[String(s.id),s]));
    const assignments=(assignmentsRes.data||[]).map(a=>{
      const s=sessions.get(String(a.session_id));
      return s?{date:s.session_date,className:s.class_name,groupNo:Number(a.group_no),teacherId:a.teacher_id}:null;
    }).filter(Boolean);
    return {assignments,teachers:teachersRes.error?[]:(teachersRes.data||[])};
  }

  async function init(options={}){
    const container=document.getElementById('v16-planning-root');
    if(!container)return false;
    if(!dataApi||!stateApi){container.innerHTML='<div class="alert alert-danger">Erreur de chargement : modules V16 indisponibles.</div>';return false;}
    context={
      supabaseClient:options.supabaseClient||root.supabaseClient||null,
      currentTeacher:options.currentTeacher||root.currentTeacher||null
    };
    container.innerHTML='<div class="alert alert-info">Chargement du planning interactif…</div>';
    try{
      const remote=await remoteAssignments(context.supabaseClient);
      teachers=remote.teachers;
      planningState=stateApi.createPlanningState(dataApi.rows(),remote.assignments);
      container.innerHTML=shell(planningState.rows);
      bindFilters();
      initialized=true;
      refresh();
      return true;
    }catch(error){
      initialized=false;
      container.innerHTML=`<div class="alert alert-danger"><strong>Erreur de chargement.</strong> ${esc(error?.message||error)}</div>`;
      return false;
    }
  }

  function autoInit(){
    if(initialized)return;
    init({supabaseClient:root.supabaseClient,currentTeacher:root.currentTeacher});
  }

  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autoInit);
    else autoInit();
  }

  return {init,refresh};
});
