(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningXlsx=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const INSTITUTION='Faculté des Sciences de Tunis — Université de Tunis El Manar';
  function safe(v){return String(v||'planning').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');}
  function buildWorkbookSpec(model){
    const columns=model?.columns||[];
    const rows=[
      [model?.title||'Planning des séances — FST'],
      [INSTITUTION],
      ['Année universitaire',model?.academicYear||'2026/2027'],
      ['Semestre',model?.semester||'Semestre 1'],
      ['Filtre',model?.subtitle||'Planning complet'],
      ['Généré le',model?.generatedAt||''],
      [],
      columns
    ];
    for(const row of model?.rows||[])rows.push(columns.map(c=>String(row[c]??'')));
    return {sheetName:'Planning TP',rows};
  }
  function xlsx(){
    const lib=root.XLSX||root.window?.XLSX;
    if(!lib)throw new Error('Moteur Excel indisponible.');
    return lib;
  }
  function generate(model){
    if(model?.context==='test')throw new Error('Export RÉEL requis : les données TEST ne peuvent pas être exportées avec ce générateur.');
    const lib=xlsx(),spec=buildWorkbookSpec(model),ws=lib.utils.aoa_to_sheet(spec.rows),wb=lib.utils.book_new();
    ws['!cols']=[{wch:14},{wch:14},{wch:12},{wch:16},{wch:16},{wch:10},{wch:14},{wch:12},{wch:24}];
    lib.utils.book_append_sheet(wb,ws,spec.sheetName);
    const filename=`Planning_TP_${safe(model?.subtitle||'complet')}.xlsx`;
    lib.writeFile(wb,filename,{compression:true});
    return {ok:true,filename,rowCount:(model?.rows||[]).length};
  }
  return {buildWorkbookSpec,generate};
});
