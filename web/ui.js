(() => {
  'use strict';
  const FSTApp = window.FSTApp = window.FSTApp || {};
  const ui = FSTApp.ui = FSTApp.ui || {};

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value == null ? '' : String(value);
      else if (key.startsWith('data-')) node.setAttribute(key, value);
      else if (key === 'hidden') node.hidden = Boolean(value);
      else if (key === 'disabled') node.disabled = Boolean(value);
      else if (key === 'type') node.type = value;
      else if (key === 'value') node.value = value == null ? '' : String(value);
      else if (key === 'placeholder') node.placeholder = value;
      else if (key === 'aria-label') node.setAttribute('aria-label', value);
      else if (key === 'colspan') node.colSpan = value;
      else node.setAttribute(key, value);
    }
    for (const child of Array.isArray(children) ? children : [children]) {
      if (child == null) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  ui.el = el;
  ui.setText = (target, value) => {
    const node = typeof target === 'string' ? document.querySelector(target) : target;
    if (node) node.textContent = value == null ? '' : String(value);
  };
  ui.clear = target => {
    const node = typeof target === 'string' ? document.querySelector(target) : target;
    if (node) node.replaceChildren();
  };
  ui.setBusy = (button, busy, text = 'Traitement…') => {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
      button.textContent = text;
      button.disabled = true;
      button.classList.add('loading');
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
      button.classList.remove('loading');
    }
  };
  ui.showToast = (message, kind = 'info') => {
    const region = document.getElementById('status-region');
    if (!region) return;
    const toast = el('div', { class: `toast ${kind}`, text: message });
    region.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  };
  ui.showFatal = ui.renderFatal = error => {
    const root = document.getElementById('app-root');
    if (!root) return;
    const message = String(error?.message || error || 'Erreur de démarrage inconnue.');
    root.replaceChildren(el('section', { class: 'fatal' }, [
      el('h1', { text: 'Impossible de démarrer l’application' }),
      el('p', { text: message }),
      el('button', { class: 'button primary', type: 'button', text: 'Réessayer' })
    ]));
    root.querySelector('button')?.addEventListener('click', () => location.reload());
  };
  ui.renderNetworkState = online => ui.showToast(online ? 'Connexion rétablie.' : 'Connexion Internet requise.', online ? 'success' : 'danger');

  function loginMarkup() {
    const section = el('section', { class: 'login-page', 'data-testid': 'login-screen', 'aria-labelledby': 'login-title' });
    const brand = el('div', { class: 'login-brand' }, [
      el('div', { class: 'brand-mark', text: 'FST', 'aria-hidden': 'true' }),
      el('div', {}, [
        el('p', { class: 'eyebrow', text: 'Université de Tunis El Manar' }),
        el('h1', { id: 'login-title', text: 'Gestion de présence des TP' }),
        el('p', { class: 'brand-subtitle', text: 'Faculté des Sciences de Tunis · Cycles préparatoires MPI / PC · 2026/2027' })
      ])
    ]);
    const form = el('form', { id: 'login-form' });
    const role = el('select', { id: 'login-role', class: 'field' }, [el('option', { value: 'teacher', text: 'Enseignant' }), el('option', { value: 'admin', text: 'Administration' })]);
    const identifier = el('input', { id: 'login-identifier', class: 'field', type: 'text', 'data-testid': 'login-identifier', autocomplete: 'username' });
    const secret = el('input', { id: 'login-secret', class: 'field', type: 'password', 'data-testid': 'login-secret', autocomplete: 'current-password' });
    const error = el('div', { id: 'login-error', class: 'form-message error', hidden: true });
    const submit = el('button', { id: 'login-submit', class: 'button primary wide', type: 'submit', text: 'Se connecter', 'data-testid': 'login-submit' });
    form.append(el('label', { for: 'login-role', text: 'Espace' }), role, el('label', { for: 'login-identifier', text: 'Identifiant' }), identifier, el('label', { for: 'login-secret', text: 'Mot de passe ou PIN' }), secret, error, submit);
    const card = el('div', { class: 'login-card' }, [el('div', { class: 'login-card-head' }, [el('h2', { text: 'Connexion' }), el('p', { text: 'Accès réservé aux enseignants et administrateurs.' })]), form, el('p', { class: 'online-note', text: '● Application en ligne sécurisée par Supabase' })]);
    section.append(brand, card);
    return section;
  }

  ui.renderLogin = (message = '') => {
    const root = document.getElementById('app-root');
    if (!root) return;
    root.replaceChildren(loginMarkup());
    if (message) {
      const error = document.getElementById('login-error');
      error.textContent = message;
      error.hidden = false;
    }
    document.getElementById('login-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('login-submit');
      const error = document.getElementById('login-error');
      error.hidden = true;
      if (!navigator.onLine) {
        error.textContent = 'Connexion Internet requise.';
        error.hidden = false;
        return;
      }
      ui.setBusy(button, true, 'Connexion…');
      try {
        const auth = await FSTApp.auth.login({
          identifier: document.getElementById('login-identifier').value,
          secret: document.getElementById('login-secret').value,
          requestedMode: document.getElementById('login-role').value
        });
        await ui.renderApplication(auth);
      } catch (err) {
        error.textContent = err?.message || 'Connexion impossible.';
        error.hidden = false;
      } finally {
        ui.setBusy(button, false);
      }
    });
  };

  const navLabels = {
    dashboard: 'Tableau de bord', presence: 'Présence', classes: 'Classes', students: 'Étudiants',
    sessions: 'Séances', timetable: 'Emploi du temps', reports: 'Rapports', account: 'Compte',
    teachers: 'Enseignants', administration: 'Administration'
  };

  function renderRows(table, columns, rows) {
    table.replaceChildren();
    const thead = el('thead');
    const headRow = el('tr');
    columns.forEach(column => headRow.append(el('th', { text: column.label })));
    thead.append(headRow);
    const tbody = el('tbody');
    if (!rows.length) {
      tbody.append(el('tr', {}, [el('td', { colspan: columns.length, class: 'empty', text: 'Aucune donnée disponible.' })]));
    } else {
      rows.forEach(row => {
        const tr = el('tr');
        columns.forEach(column => {
          const value = typeof column.value === 'function' ? column.value(row) : row[column.value];
          tr.append(el('td', { text: value == null ? '—' : value }));
        });
        tbody.append(tr);
      });
    }
    table.append(thead, tbody);
  }
  ui.renderRows = renderRows;

  function pageHeader(title, subtitle) {
    return el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: title }), el('p', { text: subtitle })])]);
  }

  function renderDashboard(container) {
    const data = FSTApp.state.data || { classes: [], students: [], sessions: [], attendance: [] };
    container.append(pageHeader('Tableau de bord', 'Vue synthétique de vos activités pédagogiques.'), el('div', { class: 'grid stats' }, [
      statCard(data.classes.length, 'Classes / groupes'), statCard(data.students.length, 'Étudiants'), statCard(data.sessions.length, 'Séances'), statCard(data.attendance.length, 'Pointages')
    ]));
    const card = el('section', { class: 'card' });
    card.append(el('h3', { text: 'Séances récentes' }));
    const table = el('table', { class: 'data-table' });
    renderRows(table, [{ label: 'Date', value: 'date' }, { label: 'Début', value: 'start' }, { label: 'Fin', value: 'end' }, { label: 'Classe', value: row => FSTApp.state.data.classes.find(c => String(c.id) === String(row.classId))?.name || row.classId }], data.sessions.slice().sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0,8));
    card.append(el('div', { class: 'table-wrap' }, table));
    container.append(card);
  }
  function statCard(value, label) { return el('div', { class: 'stat' }, [el('div', { class: 'stat-value', text: value }), el('div', { class: 'stat-label', text: label })]); }

  function renderSimpleTable(container, title, subtitle, columns, rows) {
    container.append(pageHeader(title, subtitle));
    const card = el('section', { class: 'card' });
    const table = el('table', { class: 'data-table' });
    renderRows(table, columns, rows);
    card.append(el('div', { class: 'table-wrap' }, table));
    container.append(card);
  }

  async function renderPresence(container) {
    const data = FSTApp.state.data;
    container.append(pageHeader('Présence', 'Saisie atomique avec contrôle de version et détection des conflits.'));
    if (!data.sessions.length) return container.append(el('div', { class: 'card empty', text: 'Créez une séance avant de saisir la présence.' }));
    const toolbar = el('div', { class: 'toolbar' });
    const select = el('select', { class: 'field', id: 'attendance-session' });
    data.sessions.slice().sort((a,b) => String(b.date).localeCompare(String(a.date))).forEach(s => select.append(el('option', { value: s.id, text: `${s.date} · ${data.classes.find(c => String(c.id) === String(s.classId))?.name || 'Classe'}` })));
    const load = el('button', { class: 'button secondary', type: 'button', text: 'Charger la feuille' });
    toolbar.append(select, load);
    const body = el('section', { class: 'card', id: 'attendance-body' });
    container.append(toolbar, body);
    const doLoad = async () => {
      body.replaceChildren(el('div', { class: 'empty', text: 'Chargement…' }));
      try {
        const sheet = await FSTApp.attendance.loadSession(select.value);
        ui.renderAttendanceSheet(body, sheet);
      } catch (error) { body.replaceChildren(el('div', { class: 'notice danger', text: error.message || 'Chargement impossible.' })); }
    };
    load.addEventListener('click', doLoad);
    await doLoad();
  }

  ui.renderAttendanceSheet = (container, sheet) => {
    const session = FSTApp.state.data.sessions.find(s => String(s.id) === String(sheet.sessionId));
    const students = FSTApp.state.data.students.filter(s => String(s.classId) === String(session?.classId));
    const notice = el('div', { class: 'notice info', text: `Révision serveur : ${sheet.revision}. Les modifications sont enregistrées uniquement en ligne.` });
    const list = el('div', { class: 'attendance-list' });
    students.forEach(student => {
      const record = sheet.records.find(r => String(r.studentId) === String(student.id)) || { studentId: student.id, status: 'present', comment: '', grade: null };
      const status = el('select', { class: 'field' }, ['present','absent','retard','justifie'].map(value => el('option', { value, text: value[0].toUpperCase()+value.slice(1) })));
      status.value = record.status || 'present';
      const comment = el('input', { class: 'field', type: 'text', value: record.comment || '', placeholder: 'Commentaire' });
      const grade = el('input', { class: 'field', type: 'number', value: record.grade ?? '', placeholder: 'Note', min: '0', max: '20', step: '0.25' });
      const row = el('div', { class: 'attendance-row' }, [el('strong', { text: `${student.lastname || student.last_name || ''} ${student.firstname || student.first_name || ''}`.trim() }), status, comment, grade]);
      row.dataset.studentId = student.id;
      row._fields = { status, comment, grade };
      list.append(row);
    });
    const save = el('button', { class: 'button primary', type: 'button', text: 'Enregistrer la présence' });
    const reload = el('button', { class: 'button secondary', type: 'button', text: 'Recharger' });
    const actions = el('div', { class: 'toolbar' }, [save, reload]);
    const stateNotice = el('div', { id: 'attendance-state' });
    save.addEventListener('click', async () => {
      ui.setBusy(save, true, 'Enregistrement…');
      stateNotice.replaceChildren();
      try {
        const records = [...list.children].map(row => ({
          student_id: row.dataset.studentId,
          status: row._fields.status.value,
          comment: row._fields.comment.value.trim(),
          grade: row._fields.grade.value === '' ? null : Number(row._fields.grade.value)
        }));
        const result = await FSTApp.attendance.save({ sessionId: sheet.sessionId, revision: sheet.revision, records });
        if (result.conflict) {
          stateNotice.append(el('div', { class: 'notice warning', text: 'Cette feuille a été modifiée ailleurs. Rechargez les données avant de continuer.' }));
          save.disabled = true;
        } else {
          sheet.revision = result.revision;
          stateNotice.append(el('div', { class: 'notice success', text: 'Présence enregistrée.' }));
        }
      } catch (error) {
        stateNotice.append(el('div', { class: 'notice danger', text: error.message || 'Enregistrement impossible.' }));
      } finally { if (!save.disabled) ui.setBusy(save, false); }
    });
    reload.addEventListener('click', async () => {
      const fresh = await FSTApp.attendance.loadSession(sheet.sessionId, true);
      ui.renderAttendanceSheet(container, fresh);
    });
    container.replaceChildren(notice, list, actions, stateNotice);
  };

  async function renderRoute(route, container) {
    const data = FSTApp.state.data || { classes: [], students: [], sessions: [], attendance: [] };
    if (route === 'dashboard') return renderDashboard(container);
    if (route === 'presence') return renderPresence(container);
    if (route === 'classes') return renderSimpleTable(container, 'Classes et groupes', 'Données autorisées par votre profil.', [{label:'Groupe',value:'name'},{label:'Module',value:'module'},{label:'Jour',value:'day'},{label:'Horaire',value:r=>[r.start,r.end].filter(Boolean).join('–')},{label:'Salle',value:'room'}], data.classes);
    if (route === 'students') return renderSimpleTable(container, 'Étudiants', 'Liste des étudiants rattachés à vos groupes.', [{label:'Nom',value:r=>r.lastname||r.last_name},{label:'Prénom',value:r=>r.firstname||r.first_name},{label:'Email',value:'email'},{label:'Classe',value:r=>data.classes.find(c=>String(c.id)===String(r.classId))?.name||r.classId}], data.students);
    if (route === 'sessions') return renderSimpleTable(container, 'Séances', 'Séances programmées et terminées.', [{label:'Date',value:'date'},{label:'Début',value:'start'},{label:'Fin',value:'end'},{label:'Classe',value:r=>data.classes.find(c=>String(c.id)===String(r.classId))?.name||r.classId},{label:'État',value:r=>r.completedAt?'Terminée':'Ouverte'}], data.sessions);
    if (route === 'timetable') return renderSimpleTable(container, 'Emploi du temps', 'Planification issue des groupes autorisés.', [{label:'Jour',value:'day'},{label:'Groupe',value:'name'},{label:'Module',value:'module'},{label:'Horaire',value:r=>[r.start,r.end].filter(Boolean).join('–')},{label:'Salle',value:'room'}], data.classes.filter(c=>c.day));
    if (route === 'reports') return FSTApp.reports.render(container);
    if (route === 'teachers' || route === 'administration') return FSTApp.administration.render(container, route);
    if (route === 'account') return renderSimpleTable(container, 'Compte', 'Informations du profil connecté.', [{label:'Nom',value:'name'},{label:'Identifiant',value:'username'},{label:'Rôle',value:'role'}], [{name:FSTApp.state.profile?.full_name||FSTApp.state.profile?.name,username:FSTApp.state.profile?.username,role:FSTApp.state.profile?.role}]);
    container.append(el('div', { class: 'card empty', text: 'Vue indisponible.' }));
  }

  ui.renderApplication = async auth => {
    FSTApp.state.session = auth.session || FSTApp.state.session;
    FSTApp.state.profile = auth.profile || FSTApp.state.profile;
    FSTApp.state.mode = auth.mode || FSTApp.state.mode || 'teacher';
    if (!FSTApp.state.data) FSTApp.state.data = await FSTApp.api.fetchApplicationData();
    const root = document.getElementById('app-root');
    const shell = el('div', { class: 'app-shell' });
    const logout = el('button', { class: 'button secondary', type: 'button', text: 'Déconnexion' });
    logout.addEventListener('click', () => FSTApp.auth.logout());
    const topbar = el('header', { class: 'topbar' }, [el('div', { class: 'topbar-brand' }, [el('div', { class: 'mini-mark', text: 'FST' }), el('div', {}, [el('h1', { text: 'Gestion de présence des TP' }), el('small', { text: 'FST · 2026/2027' })])]), el('div', { class: 'user-block' }, [el('span', { class: 'user-pill', text: FSTApp.state.profile?.full_name || FSTApp.state.profile?.username || 'Utilisateur' }), logout])]);
    const nav = el('nav', { class: 'sidebar', 'aria-label': 'Navigation principale' });
    const navList = el('div', { class: 'nav-list' });
    const main = el('main', { class: 'content', id: 'route-content' });
    const routes = FSTApp.administration.navigationFor(FSTApp.state.profile);
    const buttons = new Map();
    const activate = async route => {
      buttons.forEach((button,key)=>button.classList.toggle('active',key===route));
      main.replaceChildren(el('div', { class: 'empty', text: 'Chargement…' }));
      try { main.replaceChildren(); await renderRoute(route, main); }
      catch (error) { main.replaceChildren(el('div', { class: 'notice danger', text: error.message || 'Erreur de chargement.' })); }
    };
    routes.forEach(route => {
      const button = el('button', { class: 'nav-button', type: 'button', text: navLabels[route] || route });
      button.addEventListener('click', () => activate(route));
      buttons.set(route, button); navList.append(button);
    });
    nav.append(navList);
    shell.append(topbar, el('div', { class: 'layout' }, [nav, main]));
    root.replaceChildren(shell);
    await activate('dashboard');
  };
})();
