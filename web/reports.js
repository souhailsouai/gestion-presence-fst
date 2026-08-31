(() => {
  'use strict';
  const FSTApp = window.FSTApp = window.FSTApp || {};
  const reports = FSTApp.reports = FSTApp.reports || {};

  reports.buildAttendanceSummary = function buildAttendanceSummary(records = []) {
    const active = records.filter(r => !r.gradeOnly);
    const counts = { present:0, absent:0, retard:0, justifie:0 };
    active.forEach(r => { const key = r.status || 'present'; if (Object.hasOwn(counts,key)) counts[key] += 1; });
    const total = active.length;
    return { total, ...counts, attendanceRate: total ? ((counts.present + counts.retard + counts.justifie) / total) * 100 : 0 };
  };

  reports.buildGradeSummary = function buildGradeSummary(records = []) {
    const grades = records.map(r => r.grade).filter(v => v != null && Number.isFinite(Number(v))).map(Number);
    if (!grades.length) return { count:0, average:null, min:null, max:null };
    const sum = grades.reduce((a,b)=>a+b,0);
    return { count:grades.length, average:sum/grades.length, min:Math.min(...grades), max:Math.max(...grades) };
  };

  function pdf() {
    const Ctor = window.jspdf?.jsPDF;
    if (!Ctor) throw new Error('Moteur PDF indisponible');
    return new Ctor();
  }
  function download(doc, name) { doc.save(name); }

  reports.exportAttendancePdf = function exportAttendancePdf(records = [], title = 'Rapport de présence') {
    const doc = pdf();
    const summary = reports.buildAttendanceSummary(records);
    doc.setFontSize(16); doc.text(title, 14, 18);
    doc.setFontSize(10); doc.text(`Année universitaire 2026/2027`, 14, 27);
    doc.text(`Total : ${summary.total}  Présents : ${summary.present}  Absents : ${summary.absent}  Retards : ${summary.retard}  Justifiés : ${summary.justifie}`, 14, 36);
    if (typeof doc.autoTable === 'function') doc.autoTable({ startY:44, head:[['Étudiant','Statut','Commentaire','Note']], body:records.map(r=>[r.studentName||r.studentId||'—',r.status||'Non saisi',r.comment||'',r.grade==null?'Non saisi':String(r.grade)]) });
    download(doc, 'rapport-presence.pdf');
  };

  reports.exportStatisticsPdf = function exportStatisticsPdf(records = []) {
    const doc = pdf();
    const attendance = reports.buildAttendanceSummary(records);
    const grades = reports.buildGradeSummary(records);
    doc.setFontSize(16); doc.text('Statistiques et graphiques', 14, 18);
    doc.setFontSize(10); doc.text(`Taux de présence : ${attendance.attendanceRate.toFixed(1)} %`, 14, 29);
    doc.text(`Moyenne des notes : ${grades.average == null ? 'Non saisi' : grades.average.toFixed(2)}`, 14, 37);
    doc.text('Répartition des notes', 14, 49);
    doc.text('Comparaison par module', 14, 58);
    download(doc, 'statistiques-presence.pdf');
  };

  reports.render = async function render(container) {
    const data = FSTApp.state.data || { attendance:[], students:[], sessions:[], classes:[] };
    const enriched = data.attendance.map(record => {
      const student = data.students.find(s=>String(s.id)===String(record.studentId));
      const session = data.sessions.find(s=>String(s.id)===String(record.sessionId));
      const cls = data.classes.find(c=>String(c.id)===String(session?.classId));
      return { ...record, studentName:`${student?.lastname||''} ${student?.firstname||''}`.trim(), module:cls?.module||'' };
    });
    const attendance = reports.buildAttendanceSummary(enriched);
    const grades = reports.buildGradeSummary(enriched);
    container.append(FSTApp.ui.el('div', { class:'page-head' }, [FSTApp.ui.el('div', {}, [FSTApp.ui.el('h2', { text:'Statistiques et graphiques' }), FSTApp.ui.el('p', { text:'Synthèse de présence et des notes sur les données auxquelles vous êtes autorisé.' })])]));
    container.append(FSTApp.ui.el('div', { class:'grid stats' }, [
      FSTApp.ui.el('div', { class:'stat' }, [FSTApp.ui.el('div', { class:'stat-value', text:attendance.total }), FSTApp.ui.el('div', { class:'stat-label', text:'Pointages' })]),
      FSTApp.ui.el('div', { class:'stat' }, [FSTApp.ui.el('div', { class:'stat-value', text:`${attendance.attendanceRate.toFixed(1)} %` }), FSTApp.ui.el('div', { class:'stat-label', text:'Présence' })]),
      FSTApp.ui.el('div', { class:'stat' }, [FSTApp.ui.el('div', { class:'stat-value', text:grades.average==null?'—':grades.average.toFixed(2) }), FSTApp.ui.el('div', { class:'stat-label', text:'Moyenne des notes' })]),
      FSTApp.ui.el('div', { class:'stat' }, [FSTApp.ui.el('div', { class:'stat-value', text:grades.count }), FSTApp.ui.el('div', { class:'stat-label', text:'Notes saisies' })])
    ]));
    const card = FSTApp.ui.el('section', { class:'card' }, [
      FSTApp.ui.el('h3', { text:'Répartition des notes' }), FSTApp.ui.el('p', { text:'Comparaison par module' }),
      FSTApp.ui.el('div', { class:'notice info', text:'Lecture seule pour les données non modifiables selon votre profil et l’état des séances.' })
    ]);
    const bar = FSTApp.ui.el('div', { class:'toolbar' });
    const pdfAttendance = FSTApp.ui.el('button', { class:'button secondary', type:'button', text:'PDF présence' });
    const pdfStats = FSTApp.ui.el('button', { class:'button primary', type:'button', text:'PDF statistiques' });
    pdfAttendance.addEventListener('click',()=>{ try { reports.exportAttendancePdf(enriched); } catch(e){ FSTApp.ui.showToast(e.message,'danger'); } });
    pdfStats.addEventListener('click',()=>{ try { reports.exportStatisticsPdf(enriched); } catch(e){ FSTApp.ui.showToast(e.message,'danger'); } });
    bar.append(pdfAttendance,pdfStats); card.append(bar); container.append(card);
  };
})();
