(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16StudentGroups=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function runtimeClient(){
    try{return typeof supabaseClient!=='undefined'?supabaseClient:(root.supabaseClient||null);}catch(_){return root.supabaseClient||null;}
  }

  function runtimeTeacher(){
    try{return typeof currentTeacher!=='undefined'?currentTeacher:(root.currentTeacher||null);}catch(_){return root.currentTeacher||null;}
  }

  function runtimeData(){
    try{return typeof data!=='undefined'?data:(root.data||{classes:[],students:[]});}catch(_){return root.data||{classes:[],students:[]};}
  }

  function dateFr(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:String(value||'');
  }

  function previousDay(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return value;
    const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
    d.setUTCDate(d.getUTCDate()-1);
    return d.toISOString().slice(0,10);
  }

  function historyText(rows){
    return (rows||[])
      .slice()
      .sort((a,b)=>String(a.effective_from||'').localeCompare(String(b.effective_from||'')))
      .map(row=>row.effective_to
        ?`G${row.group_no} du ${dateFr(row.effective_from)} au ${dateFr(previousDay(row.effective_to))}`
        :`G${row.group_no} à partir du ${dateFr(row.effective_from)}`);
  }

  function classFamily(cls){
    return String(cls?.name||'Classe').replace(/\s+G[1-4]\s*$/i,'').trim()||'Classe';
  }

  function latestMembership(rows){
    return (rows||[]).slice().sort((a,b)=>String(b.effective_from||'').localeCompare(String(a.effective_from||'')))[0]||null;
  }

  function classesByFamily(classes){
    const out=new Map();
    for(const cls of classes||[]){
      const family=classFamily(cls);
      if(!out.has(family))out.set(family,[]);
      out.get(family).push(cls);
    }
    for(const values of out.values())values.sort((a,b)=>Number(a.groupNumber||a.group_number||0)-Number(b.groupNumber||b.group_number||0));
    return out;
  }

  function currentGroup(student,memberships,classById){
    const history=(memberships||[]).filter(m=>String(m.student_id)===String(student.id));
    const latest=latestMembership(history);
    if(latest)return Number(latest.group_no)||null;
    const cls=classById.get(String(student.classId||student.class_id));
    return Number(cls?.groupNumber||cls?.group_number)||null;
  }

  function renderStudentRow(student,familyClasses,memberships,isAdmin,classById){
    const history=(memberships||[]).filter(m=>String(m.student_id)===String(student.id));
    const group=currentGroup(student,memberships,classById);
    const currentClass=familyClasses.find(c=>Number(c.groupNumber||c.group_number)===Number(group))||classById.get(String(student.classId||student.class_id))||familyClasses[0];
    const controls=isAdmin?`
      <div class="form-row" style="margin:0;align-items:flex-end" data-v16-change-group="${esc(student.id)}">
        <div class="form-group" style="min-width:90px;margin-bottom:0"><label>Groupe</label><select class="form-control" data-v16-group-select="${esc(student.id)}">${[1,2,3,4].map(n=>`<option value="${n}"${n===group?' selected':''}>G${n}</option>`).join('')}</select></div>
        <div class="form-group" style="min-width:150px;margin-bottom:0"><label>Date d’effet</label><input type="date" class="form-control" data-v16-effective-date="${esc(student.id)}"></div>
        <button type="button" class="btn btn-primary btn-sm" data-v16-apply-group="${esc(student.id)}">Affecter</button>
        <button type="button" class="btn btn-warning btn-sm" data-v16-end-membership="${esc(student.id)}">Rendre inactif</button>
      </div>`:'';
    const historyLines=historyText(history);
    return `<tr data-v16-student="${esc(student.id)}">
      <td>${esc(student.lastname||student.last_name||'')}</td>
      <td>${esc(student.firstname||student.first_name||'')}</td>
      <td>${esc(student.email||'—')}</td>
      <td><span class="badge badge-info">${group?`G${group}`:'Non affecté'}</span></td>
      <td>${controls}</td>
      <td><details><summary>Historique des affectations</summary><div style="margin-top:8px">${historyLines.length?historyLines.map(x=>`<div>${esc(x)}</div>`).join(''):'Aucun historique daté.'}</div></details></td>
      <td style="display:none" data-v16-current-class-id="${esc(currentClass?.id||'')}"></td>
    </tr>`;
  }

  function renderClassGroups(input={},options={}){
    const classes=input.classes||[];
    const students=input.students||[];
    const memberships=input.memberships||[];
    const isAdmin=options.isAdmin===true||options.activeMode==='admin';
    const byFamily=classesByFamily(classes);
    const classById=new Map(classes.map(c=>[String(c.id),c]));
    const blocks=[];
    for(const [family,familyClasses] of [...byFamily.entries()].sort((a,b)=>a[0].localeCompare(b[0],'fr'))){
      const ids=new Set(familyClasses.map(c=>String(c.id)));
      const familyStudents=students.filter(student=>{
        if(ids.has(String(student.classId||student.class_id)))return true;
        return memberships.some(m=>String(m.student_id)===String(student.id)&&ids.has(String(m.class_id)));
      }).sort((a,b)=>`${a.lastname||a.last_name||''} ${a.firstname||a.first_name||''}`.localeCompare(`${b.lastname||b.last_name||''} ${b.firstname||b.first_name||''}`,'fr'));
      blocks.push(`<section class="card" data-v16-class-family="${esc(family)}" style="margin-top:18px">
        <h3 style="margin-top:0">${esc(family)}</h3>
        <div class="table-responsive"><table class="table"><thead><tr><th>Nom</th><th>Prénom</th><th>Email</th><th>Groupe</th><th>${isAdmin?'Affectation':'État'}</th><th>Historique</th></tr></thead><tbody>
        ${familyStudents.length?familyStudents.map(s=>renderStudentRow(s,familyClasses,memberships,isAdmin,classById)).join(''):'<tr><td colspan="6" style="text-align:center">Aucun étudiant.</td></tr>'}
        </tbody></table></div>
      </section>`);
    }
    return blocks.join('')||'<div class="alert alert-info">Aucune classe disponible.</div>';
  }

  async function refreshAuthoritativeState(){
    if(root.FSTOnlineRuntime?.refreshAuthoritativeState)return root.FSTOnlineRuntime.refreshAuthoritativeState();
    return true;
  }

  async function changeGroup(input={},options={}){
    const client=options.supabaseClient||runtimeClient();
    if(!client)throw new Error('Connexion Supabase indisponible.');
    const payload={
      p_student_id:input.studentId,
      p_class_id:input.classId,
      p_group_no:Number(input.groupNo),
      p_effective_from:input.effectiveFrom
    };
    const {data:result,error}=await client.rpc('v16_set_student_group',payload);
    if(error)throw error;
    if(result&&result.ok===false)throw new Error(result.message||result.code||'Affectation refusée.');
    await refreshAuthoritativeState();
    return result||{ok:true};
  }

  async function endMembership(input={},options={}){
    const client=options.supabaseClient||runtimeClient();
    if(!client)throw new Error('Connexion Supabase indisponible.');
    const {data:result,error}=await client.rpc('v16_end_student_membership',{p_student_id:input.studentId,p_effective_to:input.effectiveTo});
    if(error)throw error;
    if(result&&result.ok===false)throw new Error(result.message||result.code||'Fin d’appartenance refusée.');
    await refreshAuthoritativeState();
    return result||{ok:true};
  }

  async function showHistory(studentId,options={}){
    if(options.memberships)return historyText(options.memberships.filter(m=>String(m.student_id)===String(studentId)));
    const client=options.supabaseClient||runtimeClient();
    if(!client)return [];
    const {data:rows,error}=await client.from('v16_student_group_memberships').select('student_id,class_id,group_no,effective_from,effective_to,active').eq('student_id',studentId).order('effective_from');
    if(error)throw error;
    return historyText(rows||[]);
  }

  async function loadMemberships(client){
    if(!client)return [];
    const {data:rows,error}=await client.from('v16_student_group_memberships').select('student_id,class_id,group_no,effective_from,effective_to,active').order('effective_from');
    if(error)throw error;
    return rows||[];
  }

  function groupClassId(classes,family,groupNo){
    const cls=(classes||[]).find(c=>classFamily(c)===family&&Number(c.groupNumber||c.group_number)===Number(groupNo));
    return cls?.id||null;
  }

  function alertUser(message,type){
    try{if(typeof showAlert==='function')showAlert(message,type);else if(root.showAlert)root.showAlert(message,type);}catch(_){/* noop */}
  }

  function bind(rootElement,state){
    if(!rootElement)return;
    for(const button of rootElement.querySelectorAll('[data-v16-apply-group]'))button.addEventListener('click',async()=>{
      const studentId=button.getAttribute('data-v16-apply-group');
      const row=button.closest('[data-v16-student]');
      const family=button.closest('[data-v16-class-family]')?.getAttribute('data-v16-class-family')||'';
      const groupNo=Number(row?.querySelector(`[data-v16-group-select="${CSS.escape(studentId)}"]`)?.value||0);
      const effectiveFrom=row?.querySelector(`[data-v16-effective-date="${CSS.escape(studentId)}"]`)?.value||'';
      const classId=groupClassId(state.classes,family,groupNo);
      if(!classId||!effectiveFrom){alertUser('Choisissez un groupe et une date d’effet.','warning');return;}
      button.disabled=true;
      try{await changeGroup({studentId,classId,groupNo,effectiveFrom},{supabaseClient:state.client});alertUser('Affectation enregistrée.','success');}
      catch(error){alertUser(error?.message||String(error),'danger');}
      finally{button.disabled=false;}
    });
    for(const button of rootElement.querySelectorAll('[data-v16-end-membership]'))button.addEventListener('click',async()=>{
      const studentId=button.getAttribute('data-v16-end-membership');
      const row=button.closest('[data-v16-student]');
      const effectiveTo=row?.querySelector(`[data-v16-effective-date="${CSS.escape(studentId)}"]`)?.value||'';
      if(!effectiveTo){alertUser('Choisissez la date à partir de laquelle l’étudiant devient inactif.','warning');return;}
      button.disabled=true;
      try{await endMembership({studentId,effectiveTo},{supabaseClient:state.client});alertUser('Statut étudiant mis à jour.','success');}
      catch(error){alertUser(error?.message||String(error),'danger');}
      finally{button.disabled=false;}
    });
  }

  async function renderIntoStudentsView(options={}){
    if(typeof document==='undefined')return false;
    const table=document.getElementById('students-table');
    if(!table)return false;
    let mount=document.getElementById('v16-student-groups-root');
    if(!mount){
      mount=document.createElement('div');
      mount.id='v16-student-groups-root';
      table.closest('.table-responsive')?.insertAdjacentElement('beforebegin',mount);
    }
    const client=options.supabaseClient||runtimeClient();
    const teacher=options.currentTeacher||runtimeTeacher()||{};
    const base=options.data||runtimeData()||{};
    mount.innerHTML='<div class="alert alert-info">Chargement des groupes étudiants…</div>';
    try{
      const memberships=options.memberships||await loadMemberships(client);
      const state={classes:base.classes||[],students:base.students||[],memberships,client};
      mount.innerHTML=renderClassGroups(state,{isAdmin:teacher.activeMode==='admin',activeMode:teacher.activeMode});
      table.closest('.table-responsive').style.display='none';
      bind(mount,state);
      return true;
    }catch(error){
      mount.innerHTML=`<div class="alert alert-danger">Impossible de charger l’historique des groupes : ${esc(error?.message||error)}</div>`;
      return false;
    }
  }

  return {renderClassGroups,changeGroup,endMembership,showHistory,historyText,renderIntoStudentsView};
});
