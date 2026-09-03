import re

V16_NAVIGATION = '''<!-- Navigation -->
        <div class="nav-tabs" data-v16-navigation="true">
            <button class="nav-tab active" onclick="switchTab('dashboard')">
                <i class="fas fa-chart-bar"></i> Dashboard
            </button>
            <button class="nav-tab" onclick="switchTab('presence')">
                <i class="fas fa-clipboard-check"></i> Présence
            </button>
            <button class="nav-tab" onclick="switchTab('classes')">
                <i class="fas fa-door-open"></i> Classes & Groupes
            </button>
            <button class="nav-tab" onclick="switchTab('emploi')">
                <i class="fas fa-calendar-week"></i> Emploi du temps
            </button>
            <button class="nav-tab" onclick="switchTab('etudiants')">
                <i class="fas fa-user-graduate"></i> Étudiants
            </button>
            <button class="nav-tab" onclick="switchTab('seances')">
                <i class="fas fa-calendar-check"></i> Séances
            </button>
            <button class="nav-tab" onclick="switchTab('planning-v16')">
                <i class="fas fa-calendar-days"></i> Planning des séances
            </button>
            <button class="nav-tab" onclick="switchTab('rapports')">
                <i class="fas fa-file-alt"></i> Rapports
            </button>
            <button class="nav-tab" id="admin-nav-tab" style="display:none;" onclick="switchTab('administration')">
                <i class="fas fa-user-shield"></i> Administration
            </button>
        </div>

        <!-- Contenu -->'''

V16_PLANNING_PANEL = '''
            <!-- Planning des séances — V16 -->
            <div id="planning-v16" class="tab-content" data-v16-planning="true">
                <h2><i class="fas fa-calendar-days"></i> Planning des séances</h2>
                <div class="sub" style="color:var(--gray);margin-bottom:14px;">
                    Planning officiel TP 2026/2027. Rotation, dates et salles selon la référence validée.
                </div>
                <div id="v16-planning-root">
                    <div class="auth-note" style="margin-top:0;">
                        Chargement du planning interactif…
                    </div>
                </div>
            </div>

'''


def apply_v16_shell(html: str) -> str:
    """Return the V16 delivered shell while leaving the V5.13 source file unchanged."""
    nav_pattern = re.compile(r'<!-- Navigation -->[\s\S]*?<!-- Contenu -->', re.I)
    if not nav_pattern.search(html):
        raise ValueError('Bloc de navigation V5.13 introuvable.')
    html = nav_pattern.sub(V16_NAVIGATION, html, count=1)

    if 'id="planning-v16" class="tab-content"' not in html:
        report_marker = '            <!-- Rapports -->'
        if report_marker not in html:
            raise ValueError('Point d’insertion Rapports introuvable.')
        html = html.replace(report_marker, V16_PLANNING_PANEL + report_marker, 1)

    return html
