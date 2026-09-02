(function(){
'use strict';
const TABLES=['v515_requests','v515_assignments','v515_session_positions','v515_teacher_config','v515_teacher_manipulations'];
let channel=null,refreshTimer=null;
function isAdmin(){return Boolean(currentTeacher?.isAdmin||currentTeacher?.role==='admin'||currentTeacher?.activeMode==='admin');}
async function refresh(){
  if(typeof currentTeacher==='undefined'||!currentTeacher)return false;
  const teacherOk=await window.FSTV515TeacherUI?.refresh?.();
  if(isAdmin())await window.FSTV515AdminUI?.refresh?.();
  else window.FSTV515AdminUI?.destroy?.();
  return teacherOk!==false;
}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refresh(),180);}
function stopRealtime(){
  if(refreshTimer){clearTimeout(refreshTimer);refreshTimer=null;}
  if(channel){try{supabaseClient.removeChannel(channel);}catch(_){}channel=null;}
}
function startRealtime(){
  stopRealtime();
  if(typeof currentTeacher==='undefined'||!currentTeacher||!navigator.onLine)return;
  channel=supabaseClient.channel('v515-live-'+currentTeacher.id);
  for(const table of TABLES)channel=channel.on('postgres_changes',{event:'*',schema:'public',table},scheduleRefresh);
  channel.subscribe(status=>{
    if(status==='SUBSCRIBED')return;
    if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))stopRealtime();
  });
}
async function onAuthenticated(){
  if(typeof currentTeacher==='undefined'||!currentTeacher)return false;
  window.FSTV515TeacherUI?.install?.();
  if(isAdmin())window.FSTV515AdminUI?.install?.();
  await refresh();
  startRealtime();
  return true;
}
function onLogout(){
  stopRealtime();
  window.FSTV515AdminUI?.destroy?.();
  window.FSTV515TeacherUI?.destroy?.();
}
function wrapAuthenticationLifecycle(){
  const originalDoLogin=window.doLogin;
  if(typeof originalDoLogin==='function'&&!originalDoLogin.__v515Wrapped){
    const wrapped=async function(...args){const result=await originalDoLogin.apply(this,args);if(typeof currentTeacher!=='undefined'&&currentTeacher)await onAuthenticated();return result;};
    wrapped.__v515Wrapped=true;window.doLogin=wrapped;
  }
  const originalLogout=window.logoutTeacher;
  if(typeof originalLogout==='function'&&!originalLogout.__v515Wrapped){
    const wrapped=async function(...args){onLogout();return await originalLogout.apply(this,args);};
    wrapped.__v515Wrapped=true;window.logoutTeacher=wrapped;
  }
  const originalSwitch=window.switchAccount;
  if(typeof originalSwitch==='function'&&!originalSwitch.__v515Wrapped){
    const wrapped=async function(...args){onLogout();return await originalSwitch.apply(this,args);};
    wrapped.__v515Wrapped=true;window.switchAccount=wrapped;
  }
}
wrapAuthenticationLifecycle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(typeof currentTeacher!=='undefined'&&currentTeacher)void onAuthenticated();},{once:true});
else if(typeof currentTeacher!=='undefined'&&currentTeacher)void onAuthenticated();
window.FSTV515={TABLES,onAuthenticated,refresh,startRealtime,stopRealtime,onLogout};
})();
