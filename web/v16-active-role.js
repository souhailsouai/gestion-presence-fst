(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16ActiveRole=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const KEY='v16_active_role';
  let adminCapability=false;
  let activeRole='teacher';

  function normalize(role){return role==='admin'?'admin':'teacher';}
  function persisted(){
    try{return normalize(root.localStorage?.getItem(KEY)||'teacher');}catch(_){return 'teacher';}
  }
  function persist(role){
    try{root.localStorage?.setItem(KEY,role);}catch(_){/* storage unavailable */}
  }
  function emit(role){
    try{
      if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('v16:role-changed',{detail:{role}}));
    }catch(_){/* no browser event target */}
  }
  function configure(options={}){
    adminCapability=options.isAdmin===true;
    const requested=normalize(options.initialRole||persisted());
    activeRole=adminCapability?requested:'teacher';
    persist(activeRole);
    return activeRole;
  }
  function get(){return activeRole;}
  function set(role){
    const next=normalize(role);
    if(next==='admin'&&!adminCapability)return false;
    if(next===activeRole)return true;
    activeRole=next;
    persist(activeRole);
    emit(activeRole);
    return true;
  }
  function canUseAdminControls(){return adminCapability&&activeRole==='admin';}
  function canUseTestMode(){return canUseAdminControls();}
  function isAdminAccount(){return adminCapability;}

  return {configure,get,set,canUseAdminControls,canUseTestMode,isAdminAccount};
});
