from pathlib import Path
from urllib.request import urlopen
import re

root = Path(__file__).resolve().parents[1]
html_path = root / 'web' / 'index.html'
runtime_path = root / 'web' / 'online-runtime.js'
active_role_path = root / 'web' / 'v16-active-role.js'
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
v16_ui_path = root / 'web' / 'v16-planning-ui.js'
statistics_path = root / 'web' / 'statistics.js'
report_path = root / 'web' / 'report-pdf.js'
vendor = root / 'web' / 'vendor'
vendor.mkdir(parents=True, exist_ok=True)

assets = {
    vendor / 'jspdf.umd.min.js': 'https://raw.githubusercontent.com/parallax/jsPDF/v4.2.1/dist/jspdf.umd.min.js',
    vendor / 'jspdf.plugin.autotable.min.js': 'https://raw.githubusercontent.com/simonbengtsson/jsPDF-AutoTable/v5.0.8/dist/jspdf.plugin.autotable.min.js',
}
for path, url in assets.items():
    if not path.exists() or path.stat().st_size < 1000:
        with urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())

html = html_path.read_text(encoding='utf-8')
external_modules = [
    './online-runtime.js', './v16-active-role.js', './online-fixes.js', './security-v2.js',
    './v515-planning-core.js', './v515-planning-2026-2027.js',
    './v16-planning-data.js', './v16-planning-state.js', './v16-teacher-permutations.js',
    './v16-student-groups.js', './v16-planning-ui.js'
]
for src in external_modules:
    html = html.replace(f'<script src="{src}"></script>', '')
html = re.sub(r'\s*<script[^>]+src=["\'][^"\']*(?:html2canvas|jspdf)[^"\']*["\'][^>]*></script>', '', html, flags=re.I)

jspdf = (vendor / 'jspdf.umd.min.js').read_text(encoding='utf-8').strip()
autotable = (vendor / 'jspdf.plugin.autotable.min.js').read_text(encoding='utf-8').strip()
runtime = runtime_path.read_text(encoding='utf-8').strip()
active_role = active_role_path.read_text(encoding='utf-8').strip()
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
v16_ui = v16_ui_path.read_text(encoding='utf-8').strip()
statistics = statistics_path.read_text(encoding='utf-8').strip()
report = report_path.read_text(encoding='utf-8').strip()

inline = (
    '\n<script data-fst-pdf-engine="inline">\n' + jspdf + '\n' + autotable + '\n</script>\n'
    '<script data-fst-online-runtime="inline">\n' + runtime + '\n</script>\n'
    '<script data-fst-v16-active-role="inline">\n' + active_role + '\n</script>\n'
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
    '<script data-fst-v16-planning-ui="inline">\n' + v16_ui + '\n</script>\n'
    '<script data-fst-statistics="inline">\n' + statistics + '\n</script>\n'
    '<script data-fst-pdf-reports="inline">\n' + report + '\n</script>\n'
)
html = html.replace('</body>', inline + '</body>', 1)
html_path.write_text(html, encoding='utf-8')

for marker in [
    'window.FSTOnlineRuntime=', 'V16ActiveRole', 'window.FSTSecurityV2', 'pin-login', 'save_attendance_sheet',
    'challengeAndVerify', 'VERSION_CONFLICT', 'Connexion Internet requise',
    'data-fst-pdf-engine="inline"', 'data-fst-v16-active-role="inline"', 'data-fst-security-v2="inline"',
    'window.FSTAccessControl=', 'grade_only', 'FSTSessionPermissions',
    'FSTSessionEditing', 'FSTStatistics', 'Statistiques et graphiques',
    'Répartition des notes', 'Comparaison par module', 'PDF statistiques',
    'window.FSTPdf=', 'Lecture seule', 'V515Planning', 'V515PlanningData',
    'V16PlanningData', 'V16PlanningState', 'V16TeacherPermutations', 'V16StudentGroups', 'V16PlanningUI',
    'data-fst-v16-planning-data="inline"', 'data-fst-v16-planning-state="inline"',
    'data-fst-v16-teacher-permutations="inline"', 'data-fst-v16-student-groups="inline"',
    'data-fst-v16-planning-ui="inline"'
]:
    assert marker in html, marker
for src in external_modules:
    assert not re.search(r'<script[^>]+src=["\']' + re.escape(src) + r'["\'][^>]*></script>', html, re.I), src
assert 'data-fst-v515-planning-ui="inline"' not in html
assert 'data-fst-v515-planning-admin="inline"' not in html
assert not re.search(r'<script[^>]+src=["\'][^"\']*(?:html2canvas|jspdf)[^"\']*["\']', html, re.I)
print(html_path)
