/* V34 — Bilan Excel du S1 (MPI1 et PC1), généré depuis le site.
   Une feuille par classe : une colonne par manipulation, avec la note ou l'état de la séance en couleur
   (rouge : absent non rattrapé · orange : absence justifiée · vert : absence rattrapée · jaune : retard),
   puis les totaux et le détail des absences. Une case vide n'est jamais comptée comme une absence.
   Moteur : xlsx-js-style (SheetJS + styles, Apache-2.0), chargé seulement au moment de l'export. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V34BilanS1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const S1_START='2026-09-01',S1_END='2026-12-31';
  /* Le même bilan sert au S2 (V48) : seules la période et la source des manipulations changent. */
  const WINDOWS={S1:[S1_START,S1_END],S2:['2027-01-11','2027-04-30']};
  const C={
    red:{fill:'FFC7CE',font:'9C0006'},orange:{fill:'FFEB9C',font:'9C5700'},green:{fill:'C6EFCE',font:'006100'},
    late:{fill:'FFF2CC',font:'7F6000'},head:{fill:'1F4E78',font:'FFFFFF'},title:{fill:'F3EFC8',font:'1F1F1F'}};
  const base=n=>String(n||'').replace(/-G\d+$/i,'');
  const groupOf=n=>{const m=/-G(\d+)$/i.exec(String(n||''));return m?'G'+m[1]:'';};
  const dm=d=>d?String(d).slice(8,10)+'/'+String(d).slice(5,7):'';
  const RANK={present:4,retard:3,justifie:2,absent:1};

  /* Construit le classeur (indépendant du moteur Excel : testable sous Node). */
  function build(input){
    const SEM=input.sem==='S2'?'S2':'S1',[FROM,TO]=WINDOWS[SEM];
    const classes=(input.classes||[]).filter(c=>/^(MPI1|PC1)-[A-Z]/.test(c.name||''));
    const classById=new Map(classes.map(c=>[String(c.id),c]));
    const sessions=(input.sessions||[]).filter(s=>s.session_date>=FROM&&s.session_date<=TO&&classById.has(String(s.class_id)));
    const sessionById=new Map(sessions.map(s=>[String(s.id),s]));
    const manipBySession=new Map((input.plans||[]).filter(p=>p.session_id&&p.manipulation).map(p=>[String(p.session_id),String(p.manipulation)]));
    const att=(input.attendance||[]).filter(a=>sessionById.has(String(a.session_id)));
    const byStudent=new Map();for(const a of att){const k=String(a.student_id);if(!byStudent.has(k))byStudent.set(k,[]);byStudent.get(k).push(a);}
    /* Groupe du S1 : celui des séances S1 suivies (le plus fréquent), pas la liste actuelle (changée au S2). */
    const s1Class=new Map();for(const [k,list] of byStudent){const n=new Map();for(const a of list){const c=String(sessionById.get(String(a.session_id)).class_id);n.set(c,(n.get(c)||0)+1);}let best=null,bn=0;for(const [c,v] of n)if(v>bn){best=c;bn=v;}if(best)s1Class.set(k,best);}
    const classOf=st=>s1Class.get(String(st.id))||String(st.class_id);
    const manips=[...new Set(sessions.map(s=>manipBySession.get(String(s.id))).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));
    const families=[...new Set(classes.map(c=>base(c.name)))].sort();
    const sheets=[],summary=[];
    for(const fam of families){
      const ids=new Set(classes.filter(c=>base(c.name)===fam).map(c=>String(c.id)));
      const students=(input.students||[]).filter(s=>ids.has(classOf(s))).sort((a,b)=>(a.last_name+' '+(a.first_name||'')).localeCompare(b.last_name+' '+(b.first_name||''),'fr'));
      if(!students.length)continue;
      const head=['N°','Nom','Prénom','Groupe',...manips,'Sans manip.','Moyenne','Absences','Justifiées','Rattrapées','Détail des absences'];
      const rows=[],styles=[];let tAbs=0,tJ=0,tR=0,withAbs=0;
      students.forEach((st,i)=>{
        const recs=(byStudent.get(String(st.id))||[]).map(a=>({...a,session:sessionById.get(String(a.session_id)),manip:manipBySession.get(String(a.session_id))||''}))
          .sort((a,b)=>a.session.session_date.localeCompare(b.session.session_date));
        const cells=[],cellStyles=[];
        const cellFor=list=>{
          if(!list.length)return [null,null];
          const best=list.slice().sort((a,b)=>(RANK[b.status]||0)-(RANK[a.status]||0))[0];
          const g=list.map(x=>x.grade).find(v=>v!==null&&v!==undefined&&v!=='');
          if(best.status==='present')return [g!==undefined?Number(g):'P',null];
          if(best.status==='retard')return [g!==undefined?Number(g):'Retard',C.late];
          if(best.status==='justifie')return ['ABS J '+dm(best.session.session_date),C.orange];
          if(best.makeup_date)return ['Ratt. '+dm(best.makeup_date)+(g!==undefined?' — '+g:''),C.green];
          return ['ABS '+dm(best.session.session_date),C.red];
        };
        for(const m of manips){const [v,s]=cellFor(recs.filter(r=>r.manip===m));cells.push(v);cellStyles.push(s);}
        const [vx,sx]=cellFor(recs.filter(r=>!r.manip));cells.push(vx);cellStyles.push(sx);
        const grades=recs.map(r=>r.grade).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number);
        const abs=recs.filter(r=>r.status==='absent'&&!r.makeup_date),jus=recs.filter(r=>r.status==='justifie'),rat=recs.filter(r=>r.status==='absent'&&r.makeup_date);
        tAbs+=abs.length;tJ+=jus.length;tR+=rat.length;if(abs.length)withAbs++;
        const detail=[...abs.map(r=>`${dm(r.session.session_date)}${r.manip?' ('+r.manip+')':''}`),
          ...jus.map(r=>`${dm(r.session.session_date)}${r.manip?' ('+r.manip+')':''} justifiée`),
          ...rat.map(r=>`${dm(r.session.session_date)}${r.manip?' ('+r.manip+')':''} rattrapée le ${dm(r.makeup_date)}${r.makeup_note?' — '+r.makeup_note:''}`)].join(', ');
        const nameStyle=abs.length?C.red:jus.length?C.orange:rat.length?C.green:null;
        rows.push([i+1,st.last_name||'',st.first_name||'',groupOf(classById.get(classOf(st))?.name),...cells,
          grades.length?Math.round(grades.reduce((a,b)=>a+b,0)/grades.length*100)/100:null,abs.length||null,jus.length||null,rat.length||null,detail||null]);
        styles.push([nameStyle,nameStyle,nameStyle,null,...cellStyles,null,null,abs.length?C.red:null,jus.length?C.orange:null,rat.length?C.green:null,nameStyle]);
      });
      sheets.push({name:fam,title:`Bilan ${SEM} — ${fam} — absences, rattrapages et notes`,head,rows,styles});
      summary.push([fam,students.length,withAbs,tAbs,tJ,tR]);
    }
    return {sheets,summary,manips};
  }

  function border(){const t={style:'thin',color:{rgb:'A6A6A6'}};return {top:t,bottom:t,left:t,right:t};}
  function style(c,opts){
    const o=opts||{};
    return {font:{name:'Arial',sz:o.sz||10,bold:!!o.bold||!!c,color:{rgb:c?c.font:'1F1F1F'}},
      fill:c?{patternType:'solid',fgColor:{rgb:c.fill}}:undefined,border:border(),
      alignment:{vertical:'center',horizontal:o.left?'left':'center',wrapText:!!o.wrap}};
  }

  function toWorkbook(lib,model,meta){
    const wb=lib.utils.book_new();
    for(const sh of model.sheets){
      const aoa=[[sh.title],[meta.institution],[`Année universitaire ${meta.year} — semestre 1 — généré le ${meta.today}`],[],sh.head,...sh.rows];
      const ws=lib.utils.aoa_to_sheet(aoa);
      const ncol=sh.head.length,H=4;
      ws['!merges']=[0,1,2].map(r=>({s:{r,c:0},e:{r,c:ncol-1}}));
      ws['A1'].s={font:{name:'Arial',sz:14,bold:true},fill:{patternType:'solid',fgColor:{rgb:C.title.fill}},alignment:{horizontal:'center'}};
      ws['A2'].s={font:{name:'Arial',sz:10,bold:true},alignment:{horizontal:'center'}};
      ws['A3'].s={font:{name:'Arial',sz:10,italic:true},alignment:{horizontal:'center'}};
      sh.head.forEach((_,c)=>{const cell=ws[lib.utils.encode_cell({r:H,c})];cell.s=style(C.head,{bold:true,wrap:true});});
      sh.rows.forEach((row,ri)=>row.forEach((v,c)=>{
        const ref=lib.utils.encode_cell({r:H+1+ri,c});let cell=ws[ref];if(!cell){cell={t:'s',v:''};ws[ref]=cell;}
        const name=c===1||c===2,detail=c===ncol-1;
        cell.s=style(sh.styles[ri][c],{left:name||detail,wrap:detail});
        if(typeof v==='number'&&sh.head[c]==='Moyenne')cell.z='0.00';
      }));
      ws['!cols']=sh.head.map(h=>({wch:h==='N°'?5:h==='Nom'?22:h==='Prénom'?20:h==='Groupe'?8:h==='Détail des absences'?60:/^M\d/.test(h)?14:12}));
      ws['!rows']=[{hpt:24},{hpt:16},{hpt:16},{hpt:6},{hpt:30}];
      ws['!freeze']={xSplit:4,ySplit:H+1};
      ws['!autofilter']={ref:`A${H+1}:${lib.utils.encode_col(ncol-1)}${H+1}`};
      lib.utils.book_append_sheet(wb,ws,sh.name.slice(0,31));
    }
    const syn=[['Synthèse du '+SEM],[],['Classe','Étudiants','Étudiants avec absence non rattrapée','Absences non rattrapées','Absences justifiées','Absences rattrapées'],...model.summary];
    const ws=lib.utils.aoa_to_sheet(syn);
    ws['A1'].s={font:{name:'Arial',sz:14,bold:true}};
    syn[2].forEach((_,c)=>{ws[lib.utils.encode_cell({r:2,c})].s=style(C.head,{bold:true,wrap:true});});
    model.summary.forEach((r,ri)=>r.forEach((_,c)=>{ws[lib.utils.encode_cell({r:3+ri,c})].s=style(c===3&&r[3]?C.red:c===4&&r[4]?C.orange:c===5&&r[5]?C.green:null);}));
    ws['!cols']=[{wch:12},{wch:11},{wch:22},{wch:16},{wch:16},{wch:16}];
    lib.utils.book_append_sheet(wb,ws,'Synthèse');
    const leg=[['Légende'],[],['Exemple','Signification'],['14,5','Présent : note de la manipulation (P si pas encore de note)'],['Retard','Présent en retard (note si saisie)'],
      ['ABS 21/09','Absent, non rattrapé'],['ABS J 02/10','Absence justifiée'],['Ratt. 05/11 — 12','Absence rattrapée (date du rattrapage, note si saisie)'],['(vide)','Aucune donnée : jamais compté comme une absence'],
      ['Sans manip.','Séance dont la manipulation n\'est pas connue du planning']];
    const wl=lib.utils.aoa_to_sheet(leg);wl['A1'].s={font:{name:'Arial',sz:14,bold:true}};
    [[3,null],[4,C.late],[5,C.red],[6,C.orange],[7,C.green]].forEach(([r,c])=>{wl[lib.utils.encode_cell({r,c:0})].s=style(c);});
    wl['!cols']=[{wch:18},{wch:70}];
    lib.utils.book_append_sheet(wb,wl,'Légende');
    return wb;
  }

  /* ----- Navigateur : données, moteur Excel, bouton ----- */
  function client(){try{return typeof supabaseClient!=='undefined'?supabaseClient:root.supabaseClient;}catch(_){return root.supabaseClient;}}
  async function all(q){const out=[];for(let from=0;;from+=1000){const {data,error}=await q().range(from,from+999);if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)break;}return out;}
  async function fetchData(sem){
    const c=client();if(!c)throw new Error('Connexion indisponible.');
    const [FROM,TO]=WINDOWS[sem==='S2'?'S2':'S1'];
    const [classes,students,sessions,attendance,plans]=await Promise.all([
      all(()=>c.from('classes').select('id,name').is('deleted_at',null).order('id')),
      all(()=>c.from('students').select('id,last_name,first_name,class_id').is('deleted_at',null).order('id')),
      all(()=>c.from('sessions').select('id,class_id,session_date').is('deleted_at',null).gte('session_date',FROM).lte('session_date',TO).order('id')),
      all(()=>c.from('attendance').select('id,session_id,student_id,status,grade,makeup_date,makeup_note').is('deleted_at',null).order('id')),
      sem==='S2'
        ? all(()=>c.from('v33_s2_slots').select('attendance_session_id,manipulation_code').not('attendance_session_id','is',null).order('id')).then(r=>r.map(x=>({session_id:x.attendance_session_id,manipulation:x.manipulation_code})))
        : all(()=>c.from('session_plans').select('session_id,manipulation').is('deleted_at',null).not('session_id','is',null).order('id'))]);
    return {classes,students,sessions,attendance,plans,sem:sem==='S2'?'S2':'S1'};
  }
  let libPromise=null;
  function styledXlsx(){
    if(libPromise)return libPromise;
    libPromise=new Promise((ok,ko)=>{
      const prev=root.XLSX,s=document.createElement('script');s.src='./vendor/xlsx-js-style.min.js';
      s.onload=()=>{const lib=root.XLSX;if(prev)root.XLSX=prev;lib?ok(lib):ko(new Error('Moteur Excel indisponible.'));};
      s.onerror=()=>{libPromise=null;ko(new Error('Moteur Excel (couleurs) introuvable.'));};
      document.head.appendChild(s);
    });
    return libPromise;
  }
  async function exportBilan(btn,sem){
    sem=sem==='S2'?'S2':'S1';
    const alertUser=(m,t)=>{try{(typeof showAlert==='function'?showAlert:root.showAlert)?.(m,t);}catch(_){}};
    if(btn)btn.disabled=true;
    try{
      const [lib,data]=await Promise.all([styledXlsx(),fetchData(sem)]);
      const model=build(data);if(!model.sheets.length)throw new Error('Aucune donnée du '+sem+'.');
      const d=new Date(),today=String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
      const wb=toWorkbook(lib,model,{institution:'Université de Tunis El Manar — Faculté des Sciences de Tunis — TP de Physique',year:'2026/2027',today});
      lib.writeFile(wb,'Bilan_'+sem+'_TP_Physique_MPI1_PC1_2026_2027.xlsx',{compression:true});
      alertUser('Bilan '+sem+' généré : '+model.sheets.length+' classes.','success');
    }catch(e){alertUser('Bilan '+sem+' impossible : '+(e?.message||e),'danger');}
    finally{if(btn)btn.disabled=false;}
  }
  function mount(){
    if(!root.document)return;
    const actions=document.querySelector('#v31-mpi-export .v31-export-actions');
    if(!actions||actions.querySelector('[data-v34-bilan]'))return;
    const b=document.createElement('button');b.type='button';b.className='btn btn-danger';b.dataset.v34Bilan='1';
    b.title='Une feuille par classe : notes, absences en rouge, absences justifiées en orange, rattrapages en vert';
    b.innerHTML='<i class="fas fa-file-excel"></i> Bilan S1 (absences en couleur)';
    b.addEventListener('click',()=>exportBilan(b,'S1'));actions.appendChild(b);
    if(!actions.querySelector('[data-v48-bilan-s2]')){
      const b2=document.createElement('button');b2.type='button';b2.className='btn btn-danger';b2.dataset.v48BilanS2='1';
      b2.title='Même bilan pour le S2 : une feuille par classe, absences en rouge, rattrapages en vert, notes par manipulation';
      b2.innerHTML='<i class="fas fa-file-excel"></i> Bilan S2 (absences en couleur)';
      b2.addEventListener('click',()=>exportBilan(b2,'S2'));actions.appendChild(b2);
    }
  }
  if(root.document){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,50),{once:true});else setTimeout(mount,50);
    for(const ev of ['fst:shell-ready','fst:tab-activated','fst:auth-changed'])root.addEventListener?.(ev,()=>setTimeout(mount,50));
  }
  return {build,toWorkbook,exportBilan,mount};
});
