(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V515PlanningValidation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function issue(code,message,context){return {code,message,context:context||null};}

  function verify(plan){
    const blockers=[];
    const warnings=[];
    const sessions=Array.isArray(plan?.sessions)?plan.sessions:[];
    const groupCount=Number(plan?.groupCount||4);
    const manipulationCount=Number(plan?.manipulationCount||6);
    const seenPosts=new Set();

    for(const s of sessions){
      if(!s?.date||!s?.slot){
        blockers.push(issue('INVALID_SLOT','Date ou créneau invalide.',{sessionId:s?.id||null}));
        continue;
      }
      if(s.completedAt&&s.pendingMutation===true){
        blockers.push(issue('COMPLETED_SESSION_MUTATION','Une séance réalisée ne peut pas être modifiée.',{sessionId:s.id||null}));
      }
      for(const g of s.groups||[]){
        if(!g.groupNo||!/^M[1-6]$/.test(String(g.manipulation||''))){
          blockers.push(issue('INVALID_GROUP_MANIPULATION','Incohérence classe/groupe/manipulation.',{sessionId:s.id||null,groupNo:g.groupNo||null}));
          continue;
        }
        const key=[s.className,s.date,s.slot,g.groupNo].join('|');
        if(seenPosts.has(key))blockers.push(issue('DUPLICATE_GROUP_SESSION','Duplication impossible de groupe ou séance.',{key}));
        seenPosts.add(key);
      }
    }

    for(const c of plan?.completeness||[]){
      for(const g of c.groups||[]){
        if(Number(g.completed)<manipulationCount){
          warnings.push(issue('INCOMPLETE_CYCLE',`Cycle incomplet : ${c.className} G${g.groupNo} doit encore réaliser ${(g.missing||[]).join(', ')}.`,{className:c.className,groupNo:g.groupNo,missing:g.missing||[]}));
        }
      }
    }

    for(const post of plan?.assignmentPosts||[]){
      if(!post.teacherId)warnings.push(issue('VACANT_POST','Poste enseignant encore vacant.',{postId:post.id||null}));
      if(post.quotaExceeded)blockers.push(issue('TEACHER_QUOTA','Quota enseignant atteint.',{teacherId:post.teacherId||null}));
      if(post.manipulationAllowed===false)blockers.push(issue('MANIPULATION_NOT_ALLOWED',`Manipulation ${post.manipulation} non autorisée pour cet enseignant.`,{teacherId:post.teacherId||null,manipulation:post.manipulation||null}));
      if(post.timeConflict)blockers.push(issue('TEACHER_TIME_CONFLICT','Enseignant déjà affecté sur ce créneau.',{teacherId:post.teacherId||null}));
      if(post.duplicateAssignment)blockers.push(issue('DUPLICATE_ASSIGNMENT','Cette séance a déjà été attribuée.',{postId:post.id||null}));
    }

    if(plan?.rotationConsistent===false)blockers.push(issue('ROTATION_INCONSISTENT','Rotation incohérente avec le cycle M1-M6.'));

    return {blockers,warnings,canPublish:blockers.length===0};
  }

  function canFinalizeAssignments(result,plan){
    const blockers=[...(result?.blockers||[])];
    const vacant=(plan?.assignmentPosts||[]).filter(p=>!p.teacherId);
    if(vacant.length)blockers.push(issue('VACANT_POSTS',`Impossible de finaliser : ${vacant.length} postes restent sans enseignant.`,{count:vacant.length}));
    return {ok:blockers.length===0,blockers};
  }

  function canCloseCycle(plan,waivers=[]){
    const waived=new Set((waivers||[]).map(w=>`${w.className}|${w.groupNo}|${w.manipulation}`));
    const blockers=[];
    for(const c of plan?.completeness||[]){
      for(const g of c.groups||[]){
        for(const missing of g.missing||[]){
          if(!waived.has(`${c.className}|${g.groupNo}|${missing}`))blockers.push(issue('CYCLE_INCOMPLETE',`Cycle incomplet : ${c.className} G${g.groupNo} doit encore réaliser ${missing}.`,{className:c.className,groupNo:g.groupNo,manipulation:missing}));
        }
        if((g.duplicates||[]).length)blockers.push(issue('DUPLICATE_MANIPULATION','Une manipulation est dupliquée dans le cycle.',{className:c.className,groupNo:g.groupNo,duplicates:g.duplicates}));
      }
    }
    return {ok:blockers.length===0,blockers};
  }

  return {verify,canFinalizeAssignments,canCloseCycle};
});
