/* V33 — Semestre 2 : calculs purs (sans accès réseau), testables sous Node.
   Rotation : au passage n d'une classe, le groupe g fait M((g-1)+(n-1)) mod N + 1,
   comme au S1. L'enseignant et la salle viennent du « poste » (jour, manipulation). */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V33S2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const S2_MIN_DATE='2027-01-11';
  const DAY_LABEL={1:'Lundi',2:'Mardi',3:'Mercredi',4:'Jeudi',5:'Vendredi',6:'Samedi'};

  function iso(d){return d.toISOString().slice(0,10);}
  function parse(s){const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(Date.UTC(y,m-1,d));}
  function addDays(s,n){const d=parse(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);}
  function weekdayOf(s){const w=parse(s).getUTCDay();return w===0?7:w;}
  function fmt(s){if(!s)return'';const [y,m,d]=String(s).slice(0,10).split('-');return `${d}/${m}/${y}`;}

  function manipulationFor(groupNo,occurrence,count){
    const g=Number(groupNo),n=Number(occurrence),c=Number(count);
    if(!(g>=1&&n>=1&&c>=1))throw new Error('rotation: paramètres invalides');
    return 'M'+(((g-1)+(n-1))%c+1);
  }

  /* Dates exclues validées → Map date → libellé (les propositions non validées sont ignorées). */
  function excludedMap(ranges){
    const out=new Map();
    for(const r of ranges||[]){
      if(!r||r.validated!==true)continue;
      for(let d=r.starts_on;d<=r.ends_on;d=addDays(d,1))if(!out.has(d))out.set(d,r.label||'Date exclue');
    }
    return out;
  }

  function stationIndex(stations,manipulations){
    const rooms=new Map((manipulations||[]).map(m=>[m.code,m.room||'']));
    const idx=new Map();
    for(const s of stations||[])idx.set(`${s.weekday}|${s.manipulation_code}`,{teacher_id:s.teacher_id||null,room:s.room||rooms.get(s.manipulation_code)||''});
    return {get(weekday,code){return idx.get(`${weekday}|${code}`)||{teacher_id:null,room:rooms.get(code)||''};}};
  }

  function buildSlots(weekday,occurrence,settings,st){
    const out=[];
    for(let g=1;g<=settings.group_count;g++){
      const code=manipulationFor(g,occurrence,settings.manip_count);
      const p=st.get(weekday,code);
      out.push({group_no:g,manipulation_code:code,teacher_id:p.teacher_id,room:p.room});
    }
    return out;
  }

  /* Génère (ou recalcule à partir de fromDate) le planning.
     kept : séances conservées (verrouillées, ou antérieures à fromDate) ; elles comptent
     dans la rotation et occupent leur date. */
  function generatePlan(input){
    const settings=Object.assign({group_count:6,manip_count:6,start_date:S2_MIN_DATE,end_date:null},input.settings||{});
    const start=settings.start_date<S2_MIN_DATE?S2_MIN_DATE:settings.start_date;
    const from=input.fromDate&&input.fromDate>start?input.fromDate:start;
    const end=settings.end_date||addDays(start,7*30);
    const ex=excludedMap(input.excluded);
    const st=stationIndex(input.stations,input.manipulations);
    const kept=(input.kept||[]).slice().sort((a,b)=>a.session_date.localeCompare(b.session_date));
    const pairs=new Map();
    for(const c of (input.classSlots||[]).filter(c=>c.active!==false)){
      if(!pairs.has(c.pair_key))pairs.set(c.pair_key,[]);
      pairs.get(c.pair_key).push(c);
    }
    const sessions=[],warnings=[];
    for(const [key,list] of pairs){
      list.sort((a,b)=>a.pair_order-b.pair_order||a.class_name.localeCompare(b.class_name));
      const weekday=Number(list[0].weekday);
      if(list.some(c=>Number(c.weekday)!==weekday))warnings.push(`Paire « ${key} » : les classes n'ont pas le même jour.`);
      const done=new Map(list.map(c=>[c.class_name,kept.filter(k=>k.class_name===c.class_name).length]));
      const taken=new Set(kept.filter(k=>list.some(c=>c.class_name===k.class_name)).map(k=>k.session_date));
      const lastKept=kept.filter(k=>list.some(c=>c.class_name===k.class_name)&&k.session_date<from).pop();
      let turn=lastKept?(list.findIndex(c=>c.class_name===lastKept.class_name)+1)%list.length:0;
      const mode=list[0].mode||'alternance';
      let d=from;while(weekdayOf(d)!==weekday)d=addDays(d,1);
      for(;d<=end;d=addDays(d,7)){
        if(list.every(c=>done.get(c.class_name)>=settings.manip_count))break;
        if(ex.has(d)||taken.has(d))continue;
        let pick=null;
        if(mode==='bloc'){pick=list.find(c=>done.get(c.class_name)<settings.manip_count);}
        else{
          for(let i=0;i<list.length;i++){const c=list[(turn+i)%list.length];if(done.get(c.class_name)<settings.manip_count){pick=c;turn=(turn+i+1)%list.length;break;}}
        }
        if(!pick)break;
        const occ=done.get(pick.class_name)+1;done.set(pick.class_name,occ);
        sessions.push({class_name:pick.class_name,session_date:d,start_time:String(pick.start_time).slice(0,5),end_time:String(pick.end_time).slice(0,5),occurrence:occ,slots:buildSlots(weekday,occ,settings,st)});
      }
      for(const c of list){const n=done.get(c.class_name);if(n<settings.manip_count)warnings.push(`${c.class_name} : seulement ${n} séance(s) sur ${settings.manip_count} avant le ${fmt(end)}.`);}
    }
    sessions.sort((a,b)=>a.session_date.localeCompare(b.session_date)||a.class_name.localeCompare(b.class_name));
    return {sessions,warnings};
  }

  /* Contrôles du planning complet (séances conservées + générées). */
  function checkPlan(input){
    const settings=Object.assign({group_count:6,manip_count:6},input.settings||{});
    const ex=excludedMap(input.excluded);
    const issues=[];
    const byClass=new Map();
    const at=new Map();const shared=new Set();
    for(const s of input.sessions||[]){
      if(s.session_date<S2_MIN_DATE)issues.push({level:'erreur',text:`${s.class_name} ${fmt(s.session_date)} : avant le début du S2 (11/01/2027).`});
      if(ex.has(s.session_date))issues.push({level:'erreur',text:`${s.class_name} ${fmt(s.session_date)} : date exclue (${ex.get(s.session_date)}).`});
      if(!byClass.has(s.class_name))byClass.set(s.class_name,[]);
      byClass.get(s.class_name).push(s);
      const k=s.session_date+'|'+s.start_time;
      for(const g of s.slots||[]){
        if(!g.teacher_id)issues.push({level:'attention',text:`${s.class_name} ${fmt(s.session_date)} G${g.group_no} (${g.manipulation_code}) : aucun enseignant.`});
        else{
          const key=k+'|'+g.teacher_id;
          if(at.has(key)&&at.get(key)!==s.class_name+g.group_no)issues.push({level:'erreur',text:`${fmt(s.session_date)} : un enseignant est placé deux fois sur le même créneau.`});
          at.set(key,s.class_name+g.group_no);
        }
      }
      const byRoom=new Map();for(const g of s.slots||[]){if(!g.room)continue;if(!byRoom.has(g.room))byRoom.set(g.room,new Set());byRoom.get(g.room).add(g.manipulation_code);}
      for(const [room,codes] of byRoom)if(codes.size>1)shared.add(`Salle ${room} : ${[...codes].sort().join(' et ')}`);
    }
    for(const [cls,list] of byClass){
      for(let g=1;g<=settings.group_count;g++){
        const seen=list.map(s=>(s.slots||[]).find(x=>x.group_no===g)).filter(Boolean).map(x=>x.manipulation_code);
        const missing=[];for(let m=1;m<=settings.manip_count;m++)if(!seen.includes('M'+m))missing.push('M'+m);
        const dups=[...new Set(seen.filter((m,i)=>seen.indexOf(m)!==i))];
        if(missing.length)issues.push({level:'attention',text:`${cls} G${g} : manque ${missing.join(', ')}.`});
        if(dups.length)issues.push({level:'erreur',text:`${cls} G${g} : ${dups.join(', ')} en double.`});
      }
    }
    for(const x of shared)issues.push({level:'info',text:`${x} en même temps (salle partagée, comme au S1).`});
    return issues;
  }

  /* Groupes équilibrés : seuls les étudiants actifs et non verrouillés bougent, le moins possible. */
  function balanceGroups(members,groupCount){
    const out=members.map(m=>Object.assign({},m));
    const byClass=new Map();
    for(const m of out){if(m.status!=='actif')continue;if(!byClass.has(m.class_name))byClass.set(m.class_name,[]);byClass.get(m.class_name).push(m);}
    const moves=[];
    for(const [cls,list] of byClass){
      for(let guard=0;guard<500;guard++){
        const sizes=[];for(let g=1;g<=groupCount;g++)sizes.push({g,n:list.filter(m=>m.group_no===g).length});
        sizes.sort((a,b)=>b.n-a.n||a.g-b.g);
        const big=sizes[0],small=sizes[sizes.length-1];
        if(big.n-small.n<=1)break;
        const candidates=list.filter(m=>m.group_no===big.g&&!m.locked).sort((a,b)=>String(b.name||'').localeCompare(String(a.name||'')));
        if(!candidates.length)break;
        const mv=candidates[0];moves.push({student_id:mv.student_id,name:mv.name,class_name:cls,from:big.g,to:small.g});mv.group_no=small.g;
      }
    }
    return {members:out,moves};
  }

  /* Postes du S1 (jour, manipulation → enseignant) déduits des séances réelles, pour proposition. */
  function stationsFromS1(rows){
    const byGroupClass=new Map();
    for(const r of rows||[]){
      const m=/^(.*)-G(\d+)$/.exec(r.class_name||'');if(!m)continue;
      const key=m[1];if(!byGroupClass.has(key))byGroupClass.set(key,[]);
      byGroupClass.get(key).push({g:Number(m[2]),date:r.session_date,teacher_id:r.teacher_id});
    }
    const votes=new Map();
    for(const [,list] of byGroupClass){
      const dates=[...new Set(list.map(x=>x.date))].sort();
      for(const x of list){
        const occ=dates.indexOf(x.date)+1;const code=manipulationFor(x.g,occ,6);
        const k=`${weekdayOf(x.date)}|${code}|${x.teacher_id}`;votes.set(k,(votes.get(k)||0)+1);
      }
    }
    const best=new Map();
    for(const [k,n] of votes){const [w,code,t]=k.split('|');const key=w+'|'+code;if(!best.has(key)||best.get(key).n<n)best.set(key,{weekday:Number(w),manipulation_code:code,teacher_id:t,n});}
    return [...best.values()].sort((a,b)=>a.weekday-b.weekday||a.manipulation_code.localeCompare(b.manipulation_code));
  }

  /* Statistiques de présence (lignes : {class_name, group, student, status, date}). */
  function attendanceStats(rows,{from,to}={}){
    const keep=(rows||[]).filter(r=>(!from||r.date>=from)&&(!to||r.date<=to));
    const agg=key=>{const m=new Map();for(const r of keep){const k=key(r);if(!m.has(k))m.set(k,{key:k,total:0,present:0,absent:0,justifie:0,retard:0});const a=m.get(k);a.total++;a[r.status]=(a[r.status]||0)+1;}
      return [...m.values()].map(a=>Object.assign(a,{rate:a.total?Math.round(1000*(a.present+a.retard)/a.total)/10:0})).sort((x,y)=>String(x.key).localeCompare(String(y.key)));};
    return {total:keep.length,byClass:agg(r=>r.class_name),byGroup:agg(r=>r.group),byStudent:agg(r=>r.student),byDate:agg(r=>r.date)};
  }

  return {S2_MIN_DATE,DAY_LABEL,addDays,weekdayOf,fmt,manipulationFor,excludedMap,generatePlan,checkPlan,balanceGroups,stationsFromS1,attendanceStats};
});
