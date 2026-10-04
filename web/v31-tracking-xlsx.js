(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FSTV31TrackingXlsx=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  const DOMAIN=()=>root.FSTV31Domain||(typeof require==='function'?require('./v31-domain.js'):null);
  const CONFIG=()=>root.FSTV31Config||(typeof require==='function'?require('./v31-config.js'):null);
  const STATUS_LABELS={present:'Présent',retard:'Retard',absent:'Absent non justifié',justifie:'Absent justifié'};

  function safe(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
  }
  function statusLabel(v){return STATUS_LABELS[String(v||'').toLowerCase()]||'—';}
  function uniqueManipulations(rows){
    const map=new Map();
    for(const row of rows||[]){
      const code=String(row.manipulationCode||row.manipulation_code||'').trim();
      if(code&&!map.has(code))map.set(code,{code,label:row.manipulationLabel||row.manipulation_label||code});
    }
    return [...map.values()].sort((a,b)=>a.code.localeCompare(b.code,'fr',{numeric:true}));
  }
  function classBaseName(name){return String(name||'Classe').replace(/-G\d+$/i,'');}
  function groupLabel(row){return row.groupName||row.group_name||row.className||row.class_name||'—';}

  function buildSheetModel(input){
    const D=DOMAIN(),cfg=CONFIG(),data=input||{},environment=data.environment||D.ENV_MPI1_PC1;
    const rows=Array.isArray(data.rows)?data.rows:[];
    const manipulations=(data.manipulations&&data.manipulations.length)?data.manipulations:uniqueManipulations(rows);
    const students=Array.isArray(data.students)?data.students:[];
    const columns=['N°','Nom','Prénom','Groupe'];
    manipulations.forEach(m=>columns.push(m.code+' Statut',m.code+' Note'));
    columns.push('Présences','Retards','Abs. justifiées','Abs. non justifiées','Total absences','Présence %','Absence %');

    const out=students.map((student,index)=>{
      const studentRows=rows.filter(r=>String(r.studentId||r.student_id)===String(student.id));
      const summary=D.summarizeAttendance(studentRows,{environment});
      const row={
        'N°':index+1,
        'Nom':student.last_name||student.lastname||'',
        'Prénom':student.first_name||student.firstname||'',
        'Groupe':student.groupName||student.group_name||groupLabel(studentRows[0]||{})
      };
      for(const manipulation of manipulations){
        const mr=studentRows.find(r=>String(r.manipulationCode||r.manipulation_code||'')===String(manipulation.code));
        row[manipulation.code+' Statut']=mr?statusLabel(mr.status):'—';
        row[manipulation.code+' Note']=mr&&mr.grade!==null&&mr.grade!==undefined?Number(mr.grade):null;
      }
      row['Présences']=summary.present;
      row['Retards']=summary.late;
      row['Abs. justifiées']=summary.justifiedAbsences;
      row['Abs. non justifiées']=summary.unjustifiedAbsences;
      row['Total absences']=summary.totalAbsences;
      row['Présence %']=summary.presencePercent/100;
      row['Absence %']=summary.absencePercent/100;
      return row;
    });

    return {
      environment,
      className:data.className||'Classe',
      title:data.title||('Suivi TP — '+(data.className||'Classe')),
      academicYear:data.academicYear||cfg.ACADEMIC_YEAR,
      appVersion:cfg.APP_VERSION_LABEL,
      manipulations,
      columns,
      rows:out
    };
  }

  function buildWorkbookSpec(models,options){
    const cfg=CONFIG(),list=Array.isArray(models)?models:[models],opts=options||{};
    return {
      institution:cfg.INSTITUTION_LONG,
      academicYear:opts.academicYear||cfg.ACADEMIC_YEAR,
      appVersion:cfg.APP_VERSION_LABEL,
      environment:opts.environment||(list[0]&&list[0].environment)||'MPI1_PC1',
      sheets:list.filter(Boolean).map(buildSheetModel)
    };
  }

  function xlsx(){
    const lib=root.XLSX||root.window?.XLSX;
    if(!lib)throw new Error('Moteur Excel indisponible.');
    return lib;
  }

  function addSheet(lib,wb,spec,sheet){
    const rows=[
      [sheet.title],
      [spec.institution],
      ['Année universitaire',spec.academicYear],
      ['Classe',sheet.className],
      ['Export généré avec l’application',spec.appVersion],
      [],
      sheet.columns
    ];
    for(const row of sheet.rows)rows.push(sheet.columns.map(c=>row[c]===null||row[c]===undefined?'':row[c]));
    const ws=lib.utils.aoa_to_sheet(rows);
    const headerRow=7;
    ws['!autofilter']={ref:'A'+headerRow+':'+lib.utils.encode_col(sheet.columns.length-1)+headerRow};
    ws['!freeze']={xSplit:0,ySplit:headerRow};
    ws['!cols']=sheet.columns.map(c=>({wch:Math.min(28,Math.max(11,String(c).length+2))}));
    const pctCols=sheet.columns.map((c,i)=>/ %$/.test(c)?i:-1).filter(i=>i>=0);
    const gradeCols=sheet.columns.map((c,i)=>/ Note$/.test(c)?i:-1).filter(i=>i>=0);
    for(let r=headerRow+1;r<=rows.length;r++){
      pctCols.forEach(c=>{const cell=ws[lib.utils.encode_cell({r:r-1,c})];if(cell){cell.t='n';cell.z='0.0%';}});
      gradeCols.forEach(c=>{const cell=ws[lib.utils.encode_cell({r:r-1,c})];if(cell&&cell.v!==''){cell.t='n';cell.z='0.00';}});
    }
    const name=safe(classBaseName(sheet.className)).slice(0,31)||'Classe';
    lib.utils.book_append_sheet(wb,ws,name);
  }

  function globalFilename(environment,year){
    const cfg=CONFIG(),y=safe(year||cfg.ACADEMIC_YEAR_FILE);
    return environment==='LPC3'?('Suivi_TP_LPC3_'+y+'.xlsx'):('Suivi_TP_MPI1_PC1_'+y+'.xlsx');
  }
  function classFilename(className,year){
    const cfg=CONFIG(),y=safe(year||cfg.ACADEMIC_YEAR_FILE);
    return 'Suivi_TP_'+safe(classBaseName(className))+'_'+y+'.xlsx';
  }

  function generate(models,options){
    const lib=xlsx(),spec=buildWorkbookSpec(models,options),wb=lib.utils.book_new();
    spec.sheets.forEach(sheet=>addSheet(lib,wb,spec,sheet));
    const filename=(options&&options.filename)||globalFilename(spec.environment,String(spec.academicYear).replace('/','_'));
    lib.writeFile(wb,filename,{compression:true});
    return {ok:true,filename,sheetCount:spec.sheets.length,rowCount:spec.sheets.reduce((n,s)=>n+s.rows.length,0)};
  }

  function generatePerClass(models,options){
    const list=Array.isArray(models)?models:[models],results=[];
    for(const model of list){
      const spec=buildWorkbookSpec(model,options),lib=xlsx(),wb=lib.utils.book_new(),sheet=spec.sheets[0];
      addSheet(lib,wb,spec,sheet);
      const filename=classFilename(sheet.className,String(spec.academicYear).replace('/','_'));
      lib.writeFile(wb,filename,{compression:true});
      results.push({ok:true,filename,rowCount:sheet.rows.length});
    }
    return results;
  }

  return {STATUS_LABELS,statusLabel,buildSheetModel,buildWorkbookSpec,globalFilename,classFilename,generate,generatePerClass};
});
