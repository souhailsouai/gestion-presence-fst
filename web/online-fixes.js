(function(){
  'use strict';

  window.loadData=async function(){
    if(!window.FSTOnlineRuntime?.requireOnline() || !currentTeacher){
      data={classes:[],students:[],sessions:[],attendance:[]};
      return false;
    }
    try{
      data=await fetchRemoteData();
      return true;
    }catch(error){
      console.error(error);
      data={classes:[],students:[],sessions:[],attendance:[]};
      window.FSTOnlineRuntime.setOnlineRequired(true,'Serveur indisponible. Vérifiez votre connexion Internet puis réessayez.');
      return false;
    }
  };

  const onlineDoLogin=window.doLogin;
  if(typeof onlineDoLogin==='function'){
    window.doLogin=async function(profile,mode){
      const result=await onlineDoLogin(profile,mode);
      localStorage.removeItem('presence_profile_cache');
      localStorage.removeItem('attendanceSupabase_syncQueue');
      return result;
    };
  }

  function rowForClass(x){
    return {id:String(x.id),teacher_id:currentTeacher.id,name:x.name,track:x.track||null,class_number:x.classNumber||null,group_number:x.groupNumber||null,module:x.module||'Général',day:x.day||null,start_time:x.start||null,end_time:x.end||null,room:x.room||null};
  }
  function rowForStudent(x){
    return {id:String(x.id),teacher_id:currentTeacher.id,class_id:String(x.classId),last_name:x.lastname,first_name:x.firstname,email:x.email||null};
  }
  async function upsert(table,rows){
    if(!rows.length)return true;
    const {error}=await supabaseClient.from(table).upsert(rows);
    if(error){showAlert('Import impossible : '+error.message,'danger');return false;}
    return true;
  }

  window.handleFile=function(file){
    if(!window.FSTOnlineRuntime?.requireOnline())return;
    const reader=new FileReader();
    reader.onload=async function(e){
      try{
        const lines=String(e.target.result||'').split(/\r?\n/);
        const classByName=new Map((data.classes||[]).map(c=>[c.name,c]));
        const newClasses=[];
        const newStudents=[];
        for(let i=1;i<lines.length;i++){
          if(!lines[i].trim())continue;
          const columns=lines[i].split(/[,;]/);
          if(columns.length<2)continue;
          const lastname=(columns[0]||'').trim();
          const firstname=(columns[1]||'').trim();
          if(!lastname||!firstname)continue;
          const email=(columns[2]||'').trim();
          const className=(columns[3]||'Général').trim()||'Général';
          let cls=classByName.get(className);
          if(!cls){
            cls={id:crypto.randomUUID(),name:className,module:'Général',track:null,classNumber:null,groupNumber:null,day:null,start:null,end:null,room:null};
            classByName.set(className,cls);
            newClasses.push(cls);
          }
          newStudents.push({id:crypto.randomUUID(),lastname,firstname,email,classId:cls.id});
        }
        if(!await upsert('classes',newClasses.map(rowForClass)))return;
        if(!await upsert('students',newStudents.map(rowForStudent)))return;
        await window.FSTOnlineRuntime.refreshAuthoritativeState();
        showAlert('Import réussi !','success');
      }catch(error){
        console.error(error);
        showAlert('Import impossible.','danger');
      }
    };
    reader.readAsText(file);
  };

  async function renderV16StudentGroups(){
    if(!window.V16StudentGroups?.renderIntoStudentsView)return false;
    try{
      return await window.V16StudentGroups.renderIntoStudentsView({supabaseClient,currentTeacher,data});
    }catch(error){
      console.error('V16 student groups',error);
      return false;
    }
  }

  const baseSwitchTab=window.switchTab;
  if(typeof baseSwitchTab==='function'){
    window.switchTab=function(tabName){
      const result=baseSwitchTab.apply(this,arguments);
      if(tabName==='etudiants')setTimeout(()=>{void renderV16StudentGroups();},0);
      return result;
    };
  }

  window.renderV16StudentGroups=renderV16StudentGroups;
})();
