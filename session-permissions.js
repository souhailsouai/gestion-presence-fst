(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FSTSessionPermissions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function isAdmin(user){return Boolean(user&&user.isAdmin);}
  function owns(user,record){return Boolean(user&&record)&&String(record.teacherId||'')===String(user.id||'');}
  function canManage(user,record){return Boolean(record)&&(isAdmin(user)||owns(user,record));}
  function isCompleted(session){return Boolean(session&&session.completedAt);}
  function canEditAttendance(user,session){return canManage(user,session);}
  function canEditComment(user,session){return canEditAttendance(user,session);}
  function canEditGrade(user,session){return canManage(user,session);}
  return {isAdmin,owns,canManage,isCompleted,canEditAttendance,canEditComment,canEditGrade};
});
