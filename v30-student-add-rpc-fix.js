(function(root){
  'use strict';

  async function refreshAfterAdd(){
    if(typeof root.FSTOnlineRuntime?.refreshAuthoritativeState==='function'){
      await root.FSTOnlineRuntime.refreshAuthoritativeState();
      return true;
    }
    if(typeof root.fetchRemoteData==='function'){
      await root.fetchRemoteData();
      if(typeof root.renderStudents==='function') root.renderStudents();
      if(typeof root.updateAllSelects==='function') root.updateAllSelects();
      if(typeof root.renderGroups==='function') root.renderGroups();
      return true;
    }
    return false;
  }

  root.addStudent=async function(){
    const lastname=document.getElementById('student-lastname')?.value.trim()||'';
    const firstname=document.getElementById('student-firstname')?.value.trim()||'';
    const classId=document.getElementById('student-class')?.value||'';
    const email=document.getElementById('student-email')?.value.trim()||'';

    if(!lastname||!firstname||!classId){
      root.showAlert?.('Veuillez remplir tous les champs obligatoires','danger');
      return false;
    }

    if(typeof root.supabaseClient?.rpc!=='function'){
      root.showAlert?.('Ajout impossible : service indisponible.','danger');
      return false;
    }

    const id=crypto.randomUUID();
    const {error}=await root.supabaseClient.rpc('v31_add_student_authorized',{
      p_student_id:id,
      p_class_id:String(classId),
      p_last_name:lastname,
      p_first_name:firstname,
      p_email:email||null
    });

    if(error){
      root.showAlert?.('Ajout impossible : '+error.message,'danger');
      return false;
    }

    const last=document.getElementById('student-lastname');
    const first=document.getElementById('student-firstname');
    const mail=document.getElementById('student-email');
    if(last) last.value='';
    if(first) first.value='';
    if(mail) mail.value='';

    let refreshed=false;
    try{refreshed=await refreshAfterAdd();}catch(error){console.error(error);}
    root.showAlert?.('Étudiant ajouté avec succès','success');
    if(!refreshed) root.setTimeout(()=>root.location.reload(),250);
    return true;
  };

  root.FSTStudentAddRpcFix={version:'2026-10-10',rpc:'v31_add_student_authorized'};
})(window);
