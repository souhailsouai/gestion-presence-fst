from pathlib import Path
from urllib.request import urlopen
import re
from fst_shell_transform import apply_fst_shell

root = Path(__file__).resolve().parents[1]
html_path = root / 'web' / 'index.html'
v31_config_path = root / 'web' / 'v31-config.js'
v31_domain_path = root / 'web' / 'v31-domain.js'
v31_tracking_xlsx_path = root / 'web' / 'v31-tracking-xlsx.js'
v31_version_ui_path = root / 'web' / 'v31-version-ui.js'
v31_export_ui_path = root / 'web' / 'v31-export-ui.js'
runtime_path = root / 'web' / 'online-runtime.js'
active_role_path = root / 'web' / 'v16-active-role.js'
test_mode_path = root / 'web' / 'v16-test-mode.js'
fixes_path = root / 'web' / 'online-fixes.js'
security_path = root / 'web' / 'security-v2.js'
access_path = root / 'web' / 'access-control.js'
attendance_policy_path = root / 'web' / 'attendance-policy.js'
permissions_path = root / 'web' / 'session-permissions.js'
editing_path = root / 'web' / 'session-editing.js'
v515_core_path = root / 'web' / 'v515-planning-core.js'
v515_data_path = root / 'web' / 'v515-planning-2026-2027.js'
v16_data_path = root / 'web' / 'v16-planning-data.js'
v16_state_path = root / 'web' / 'v16-planning-state.js'
v16_permutations_path = root / 'web' / 'v16-teacher-permutations.js'
v16_student_groups_path = root / 'web' / 'v16-student-groups.js'
v16_timetable_link_path = root / 'web' / 'v16-timetable-presence-link.js'
v16_export_model_path = root / 'web' / 'v16-planning-export-model.js'
v16_pdf_path = root / 'web' / 'v16-planning-pdf.js'
v16_xlsx_path = root / 'web' / 'v16-planning-xlsx.js'
v16_editor_path = root / 'web' / 'v16-planning-editor.js'
v16_notices_path = root / 'web' / 'v16-dashboard-notices.js'
v16_ui_path = root / 'web' / 'v16-planning-ui.js'
v30_lpc3_path = root / 'web' / 'v30-lpc3.js'
statistics_path = root / 'web' / 'statistics.js'
report_path = root / 'web' / 'report-pdf.js'
vendor = root / 'web' / 'vendor'
vendor.mkdir(parents=True, exist_ok=True)

assets = {
    vendor / 'jspdf.umd.min.js': 'https://raw.githubusercontent.com/parallax/jsPDF/v4.2.1/dist/jspdf.umd.min.js',
    vendor / 'jspdf.plugin.autotable.min.js': 'https://raw.githubusercontent.com/simonbengtsson/jsPDF-AutoTable/v5.0.8/dist/jspdf.plugin.autotable.min.js',
    vendor / 'xlsx.full.min.js': 'https://raw.githubusercontent.com/SheetJS/sheetjs/v0.18.5/dist/xlsx.full.min.js',
}
for path, url in assets.items():
    if not path.exists() or path.stat().st_size < 1000:
        with urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())

html = html_path.read_text(encoding='utf-8')
external_modules = [
    './v31-config.js', './v31-domain.js',
    './online-runtime.js', './v16-active-role.js', './v16-test-mode.js', './online-fixes.js', './security-v2.js',
    './v515-planning-core.js', './v515-planning-2026-2027.js',
    './v16-planning-data.js', './v16-planning-state.js', './v16-teacher-permutations.js',
    './v16-student-groups.js', './v16-timetable-presence-link.js', './vendor/xlsx.full.min.js',
    './v16-planning-export-model.js', './v16-planning-pdf.js', './v16-planning-xlsx.js', './v31-tracking-xlsx.js', './v31-version-ui.js', './v31-export-ui.js',
    './v16-planning-editor.js', './v16-dashboard-notices.js', './v16-planning-ui.js', './v30-lpc3.js'
]
for src in external_modules:
    html = html.replace(f'<script src="{src}"></script>', '')
html = re.sub(r'\s*<script[^>]+src=["\'][^"\']*(?:html2canvas|jspdf)[^"\']*["\'][^>]*></script>', '', html, flags=re.I)

jspdf = (vendor / 'jspdf.umd.min.js').read_text(encoding='utf-8').strip()
autotable = (vendor / 'jspdf.plugin.autotable.min.js').read_text(encoding='utf-8').strip()
xlsx_engine = (vendor / 'xlsx.full.min.js').read_text(encoding='utf-8').strip()
v31_config = v31_config_path.read_text(encoding='utf-8').strip()
v31_domain = v31_domain_path.read_text(encoding='utf-8').strip()
v31_tracking_xlsx = v31_tracking_xlsx_path.read_text(encoding='utf-8').strip()
v31_version_ui = v31_version_ui_path.read_text(encoding='utf-8').strip()
v31_export_ui = v31_export_ui_path.read_text(encoding='utf-8').strip()
runtime = runtime_path.read_text(encoding='utf-8').strip()
active_role = active_role_path.read_text(encoding='utf-8').strip()
test_mode = test_mode_path.read_text(encoding='utf-8').strip()
fixes = fixes_path.read_text(encoding='utf-8').strip()
security = security_path.read_text(encoding='utf-8').strip()
access = access_path.read_text(encoding='utf-8').strip()
attendance_policy = attendance_policy_path.read_text(encoding='utf-8').strip()
permissions = permissions_path.read_text(encoding='utf-8').strip()
editing = editing_path.read_text(encoding='utf-8').strip()
v515_core = v515_core_path.read_text(encoding='utf-8').strip()
v515_data = v515_data_path.read_text(encoding='utf-8').strip()
v16_data = v16_data_path.read_text(encoding='utf-8').strip()
v16_state = v16_state_path.read_text(encoding='utf-8').strip()
v16_permutations = v16_permutations_path.read_text(encoding='utf-8').strip()
v16_student_groups = v16_student_groups_path.read_text(encoding='utf-8').strip()
v16_timetable_link = v16_timetable_link_path.read_text(encoding='utf-8').strip()
v16_export_model = v16_export_model_path.read_text(encoding='utf-8').strip()
v16_pdf = v16_pdf_path.read_text(encoding='utf-8').strip()
v16_xlsx = v16_xlsx_path.read_text(encoding='utf-8').strip()
v16_editor = v16_editor_path.read_text(encoding='utf-8').strip()
v16_notices = v16_notices_path.read_text(encoding='utf-8').strip()
v16_ui = v16_ui_path.read_text(encoding='utf-8').strip()
v30_lpc3 = v30_lpc3_path.read_text(encoding='utf-8').strip()
statistics = statistics_path.read_text(encoding='utf-8').strip()
report = report_path.read_text(encoding='utf-8').strip()

inline = (
    '\n<script data-fst-pdf-engine="inline">\n' + jspdf + '\n' + autotable + '\n</script>\n'
    '<script data-fst-xlsx-engine="inline">\n' + xlsx_engine + '\n</script>\n'
    '<script data-fst-v31-config="inline">\n' + v31_config + '\n</script>\n'
    '<script data-fst-v31-domain="inline">\n' + v31_domain + '\n</script>\n'
    '<script data-fst-online-runtime="inline">\n' + runtime + '\n</script>\n'
    '<script data-fst-v16-active-role="inline">\n' + active_role + '\n</script>\n'
    '<script data-fst-v16-test-mode="inline">\n' + test_mode + '\n</script>\n'
    '<script data-fst-online-fixes="inline">\n' + fixes + '\n</script>\n'
    '<script data-fst-security-v2="inline">\n' + security + '\n</script>\n'
    '<script data-fst-access-control="inline">\n' + access + '\n</script>\n'
    '<script data-fst-attendance-policy="inline">\n' + attendance_policy + '\n</script>\n'
    '<script data-fst-session-permissions="inline">\n' + permissions + '\n</script>\n'
    '<script data-fst-session-editing="inline">\n' + editing + '\n</script>\n'
    '<script data-fst-v515-planning-core="inline">\n' + v515_core + '\n</script>\n'
    '<script data-fst-v515-planning-data="inline">\n' + v515_data + '\n</script>\n'
    '<script data-fst-v16-planning-data="inline">\n' + v16_data + '\n</script>\n'
    '<script data-fst-v16-planning-state="inline">\n' + v16_state + '\n</script>\n'
    '<script data-fst-v16-teacher-permutations="inline">\n' + v16_permutations + '\n</script>\n'
    '<script data-fst-v16-student-groups="inline">\n' + v16_student_groups + '\n</script>\n'
    '<script data-fst-v16-timetable-presence-link="inline">\n' + v16_timetable_link + '\n</script>\n'
    '<script data-fst-v16-planning-export-model="inline">\n' + v16_export_model + '\n</script>\n'
    '<script data-fst-v16-planning-pdf="inline">\n' + v16_pdf + '\n</script>\n'
    '<script data-fst-v16-planning-xlsx="inline">\n' + v16_xlsx + '\n</script>\n'
    '<script data-fst-v31-tracking-xlsx="inline">\n' + v31_tracking_xlsx + '\n</script>\n'
    '<script data-fst-v31-version-ui="inline">\n' + v31_version_ui + '\n</script>\n'
    '<script data-fst-v31-export-ui="inline">\n' + v31_export_ui + '\n</script>\n'
    '<script data-fst-v16-planning-editor="inline">\n' + v16_editor + '\n</script>\n'
    '<script data-fst-v16-dashboard-notices="inline">\n' + v16_notices + '\n</script>\n'
    '<script data-fst-v16-planning-ui="inline">\n' + v16_ui + '\n</script>\n'
    '<script data-fst-v30-lpc3="inline">\n' + v30_lpc3 + '\n</script>\n'
    '<script data-fst-statistics="inline">\n' + statistics + '\n</script>\n'
    '<script data-fst-pdf-reports="inline">\n' + report + '\n</script>\n'
)
html = html.replace('</body>', inline + '</body>', 1)
html = apply_fst_shell(html, target='standalone', root=root)
html_path.write_text(html, encoding='utf-8')

for marker in [
    'FSTV31Config', 'FSTV31Domain', 'FSTV31TrackingXlsx', 'FSTV31VersionUi', 'FSTV31ExportUi', 'window.FSTOnlineRuntime=', 'V16ActiveRole', 'V16TestMode', 'window.FSTSecurityV2', 'pin-login', 'save_attendance_sheet',
    'challengeAndVerify', 'VERSION_CONFLICT', 'Connexion Internet requise',
    'data-fst-pdf-engine="inline"', 'data-fst-xlsx-engine="inline"', 'data-fst-v16-active-role="inline"', 'data-fst-v16-test-mode="inline"', 'data-fst-security-v2="inline"',
    'window.FSTAccessControl=', 'grade_only', 'FSTSessionPermissions',
    'FSTSessionEditing', 'FSTStatistics', 'Statistiques et graphiques',
    'Répartition des notes', 'Comparaison par module', 'PDF statistiques',
    'window.FSTPdf=', 'Lecture seule', 'V515Planning', 'V515PlanningData',
    'V16PlanningData', 'V16PlanningState', 'V16TeacherPermutations', 'V16StudentGroups', 'V16TimetablePresenceLink',
    'V16PlanningExportModel', 'V16PlanningPdf', 'V16PlanningXlsx', 'V16PlanningEditor', 'V16DashboardNotices', 'V16PlanningUI',
    'data-fst-v16-planning-data="inline"', 'data-fst-v16-planning-state="inline"',
    'data-fst-v16-teacher-permutations="inline"', 'data-fst-v16-student-groups="inline"',
    'data-fst-v16-timetable-presence-link="inline"', 'data-fst-v16-planning-export-model="inline"',
    'data-fst-v16-planning-pdf="inline"', 'data-fst-v16-planning-xlsx="inline"',
    'data-fst-v16-planning-editor="inline"', 'data-fst-v16-dashboard-notices="inline"', 'data-fst-v16-planning-ui="inline"',
    'data-fst-v30-lpc3="inline"', 'V30LPC3', 'Présence LPC3', 'Salle Onde', '08h30'
]:
    assert marker in html, marker
for src in external_modules:
    assert not re.search(r'<script[^>]+src=["\']' + re.escape(src) + r'["\'][^>]*></script>', html, re.I), src
assert 'data-fst-v515-planning-ui="inline"' not in html
assert 'data-fst-v515-planning-admin="inline"' not in html
assert not re.search(r'<script[^>]+src=["\'][^"\']*(?:html2canvas|jspdf)[^"\']*["\']', html, re.I)
print(html_path)
