(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningPdf=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const INSTITUTION='Faculté des Sciences de Tunis — Université de Tunis El Manar';
  function safe(v){return String(v||'planning').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');}
  function buildPdfSpec(model){
    const columns=model?.columns||[];
    const body=(model?.rows||[]).map(row=>columns.map(c=>String(row[c]??'')));
    return {
      header:[
        model?.title||'Planning des séances — FST',
        INSTITUTION,
        `Année universitaire : ${model?.academicYear||'2026/2027'}`,
        String(model?.semester||'Semestre 1'),
        String(model?.subtitle||'Planning complet'),
        `Généré le : ${model?.generatedAt||''}`
      ],
      head:[columns],
      body
    };
  }
  function engine(){
    const jsPDF=root.jspdf?.jsPDF||root.window?.jspdf?.jsPDF;
    if(!jsPDF)throw new Error('Moteur PDF indisponible.');
    return jsPDF;
  }
  function save(doc,filename){
    const bridge=root.AndroidPdfBridge||root.window?.AndroidPdfBridge;
    if(bridge&&typeof bridge.savePdf==='function'){
      bridge.savePdf(filename,doc.output('datauristring'));
      return true;
    }
    doc.save(filename);return true;
  }
  function generate(model){
    if(model?.context==='test')throw new Error('Export RÉEL requis : les données TEST ne peuvent pas être exportées avec ce générateur.');
    const spec=buildPdfSpec(model),jsPDF=engine(),doc=new jsPDF({unit:'mm',format:'a4',orientation:'landscape'});
    doc.setFontSize(14);doc.text(spec.header[0],14,14);
    doc.setFontSize(8.5);
    spec.header.slice(1).forEach((line,i)=>doc.text(String(line),14,20+i*4.5));
    doc.autoTable({
      startY:44,
      head:spec.head,
      body:spec.body,
      showHead:'everyPage',
      styles:{fontSize:7,cellPadding:1.6,overflow:'linebreak'},
      headStyles:{fontStyle:'bold'},
      margin:{left:10,right:10,top:14,bottom:12},
      didDrawPage:()=>{
        const pages=doc.getNumberOfPages();doc.setFontSize(7);doc.text(`FST · ${model.academicYear||'2026/2027'} · page ${pages}`,10,202);
      }
    });
    const filename=`Planning_TP_${safe(model?.subtitle||'complet')}.pdf`;
    save(doc,filename);
    return {ok:true,filename,rowCount:spec.body.length};
  }
  return {buildPdfSpec,generate};
});
