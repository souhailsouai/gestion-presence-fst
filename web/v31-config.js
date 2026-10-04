(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FSTV31Config=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const APP_VERSION='3.1';
  const APP_VERSION_LABEL='v'+APP_VERSION;
  const ACADEMIC_YEAR='2026/2027';
  const ACADEMIC_YEAR_FILE='2026_2027';
  const INSTITUTION_SHORT='FST - Université de Tunis El Manar';
  const INSTITUTION_LONG='Faculté des Sciences de Tunis — Université de Tunis El Manar';
  return Object.freeze({
    APP_VERSION,
    APP_VERSION_LABEL,
    ACADEMIC_YEAR,
    ACADEMIC_YEAR_FILE,
    INSTITUTION_SHORT,
    INSTITUTION_LONG
  });
});
