(() => {
  'use strict';
  const FSTApp = window.FSTApp = window.FSTApp || {};
  const administration = FSTApp.administration = FSTApp.administration || {};

  administration.isAdminProfile = profile => FSTApp.auth.isAdminProfile(profile);
  administration.navigationFor = function navigationFor(profile) {
    const base = ['dashboard','presence','classes','students','sessions','timetable','reports','account'];
    const admin = ['teachers','administration'];
    return administration.isAdminProfile(profile) ? [...base, ...admin] : base;
  };

  administration.refreshData = async function refreshData() {
    FSTApp.state.data = await FSTApp.api.fetchApplicationData();
    return FSTApp.state.data;
  };

  administration.createClass = async function createClass(input) {
    const profile = FSTApp.state.profile;
    const row = {
      id: crypto.randomUUID(), teacher_id: profile.id, name: input.name, track: input.track || null,
      class_number: input.classNumber == null ? null : Number(input.classNumber), group_number: input.groupNumber == null ? null : Number(input.groupNumber),
      module: input.module || '', day: input.day || null, start_time: input.start || null, end_time: input.end || null, room: input.room || null
    };
    await FSTApp.api.upsert('classes', [row]);
    return administration.refreshData();
  };
  administration.createStudent = async function createStudent(input) {
    const row = { id:crypto.randomUUID(), teacher_id:FSTApp.state.profile.id, class_id:input.classId, last_name:input.lastname, first_name:input.firstname, email:input.email || null };
    await FSTApp.api.upsert('students', [row]);
    return administration.refreshData();
  };
  administration.createSession = async function createSession(input) {
    const row = { id:crypto.randomUUID(), teacher_id:FSTApp.state.profile.id, class_id:input.classId, session_date:input.date, start_time:input.start, end_time:input.end, completed_at:null };
    await FSTApp.api.upsert('sessions', [row]);
    return administration.refreshData();
  };
  administration.deleteItem = async function deleteItem(table, id) {
    if (!['classes','students','sessions'].includes(table)) throw new Error('Suppression non autorisée.');
    await FSTApp.api.remove(table, id);
    return administration.refreshData();
  };

  administration.teachers = async () => {
    if (!administration.isAdminProfile(FSTApp.state.profile)) throw new Error('Accès administrateur requis.');
    return FSTApp.api.teacher_directory();
  };
  administration.students = async () => FSTApp.api.listStudents();
  administration.timetable = async () => FSTApp.api.timetable();
  administration.adminTeacher = async (action, payload) => {
    if (!administration.isAdminProfile(FSTApp.state.profile)) throw new Error('Accès administrateur requis.');
    return FSTApp.api.adminTeacher(action, payload);
  };

  function renderTeachers(container) {
    container.append(FSTApp.ui.el('div', { class:'page-head' }, [FSTApp.ui.el('div', {}, [FSTApp.ui.el('h2', { text:'Enseignants' }), FSTApp.ui.el('p', { text:'Annuaire central, visible uniquement pour les administrateurs.' })])]));
    const card = FSTApp.ui.el('section', { class:'card' });
    const table = FSTApp.ui.el('table', { class:'data-table' });
    card.append(FSTApp.ui.el('div', { class:'table-wrap' }, table));
    container.append(card);
    administration.teachers().then(rows => FSTApp.ui.renderRows(table, [
      {label:'Nom', value:r=>r.full_name || r.name || '—'}, {label:'Identifiant',value:'username'}, {label:'Email',value:'email'}, {label:'Rôle',value:'role'}, {label:'État',value:r=>r.account_state || 'actif'}
    ], rows || [])).catch(error => card.prepend(FSTApp.ui.el('div', { class:'notice danger', text:error.message })));
  }

  administration.render = async function render(container, route) {
    if (!administration.isAdminProfile(FSTApp.state.profile)) {
      container.append(FSTApp.ui.el('div', { class:'notice danger', text:'Vous ne disposez pas des droits administrateur.' }));
      return;
    }
    if (route === 'teachers') return renderTeachers(container);
    container.append(FSTApp.ui.el('div', { class:'page-head' }, [FSTApp.ui.el('div', {}, [FSTApp.ui.el('h2', { text:'Administration' }), FSTApp.ui.el('p', { text:'Gestion centralisée protégée par les autorisations serveur.' })])]));
    container.append(FSTApp.ui.el('section', { class:'card' }, [
      FSTApp.ui.el('div', { class:'notice info', text:'Les opérations sensibles sont exécutées côté serveur via admin-teacher et les politiques Supabase.' }),
      FSTApp.ui.el('p', { text:`Classes : ${FSTApp.state.data?.classes?.length || 0} · Étudiants : ${FSTApp.state.data?.students?.length || 0} · Séances : ${FSTApp.state.data?.sessions?.length || 0}` })
    ]));
  };
})();
