from pathlib import Path
from urllib.request import urlopen
import re

root = Path(__file__).resolve().parents[1]
html_path = root / 'web' / 'index.html'
runtime_path = root / 'web' / 'online-runtime.js'
fixes_path = root / 'web' / 'online-fixes.js'
security_path = root / 'web' / 'security-v2.js'
access_path = root / 'web' / 'access-control.js'
attendance_policy_path = root / 'web' / 'attendance-policy.js'
permissions_path = root / 'web' / 'session-permissions.js'
editing_path = root / 'web' / 'session-editing.js'
time_path = root / 'web' / 'time-format.js'
time_integration_path = root / 'web' / 'time-integration.js'
student_import_path = root / 'web' / 'student-import.js'
student_management_path = root / 'web' / 'student-management.js'
class_structure_pdf_path = root / 'web' / 'class-structure-pdf.js'
statistics_path = root / 'web' / 'statistics.js'
report_path = root / 'web' / 'report-pdf.js'
vendor = root / 'web' / 'vendor'
vendor.mkdir(parents=True, exist_ok=True)

assets = {
    vendor / 'jspdf.umd.min.js': 'https://raw.githubusercontent.com/parallax/jsPDF/v4.2.1/dist/jspdf.umd.min.js',
    vendor / 'jspdf.plugin.autotable.min.js': 'https://raw.githubusercontent.com/simonbengtsson/jsPDF-AutoTable/v5.0.8/dist/jspdf.plugin.autotable.min.js',
    vendor / 'xlsx.full.min.js': 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
}
for path, url in assets.items():
    if not path.exists() or path.stat().st_size < 1000:
        with urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())

html = html_path.read_text(encoding='utf-8')
for src in ['./online-runtime.js', './online-fixes.js', './security-v2.js']:
    html = html.replace(f'<script src="{src}"></script>', '')
html = re.sub(r'\s*<script[^>]+src=["\'][^"\']*(?:html2canvas|jspdf)[^"\']*["\'][^>]*></script>', '', html, flags=re.I)

jspdf = (vendor / 'jspdf.umd.min.js').read_text(encoding='utf-8').strip()
autotable = (vendor / 'jspdf.plugin.autotable.min.js').read_text(encoding='utf-8').strip()
xlsx = (vendor / 'xlsx.full.min.js').read_text(encoding='utf-8').strip()
time_format = time_path.read_text(encoding='utf-8').strip()
runtime = runtime_path.read_text(encoding='utf-8').strip()
fixes = fixes_path.read_text(encoding='utf-8').strip()
security = security_path.read_text(encoding='utf-8').strip()
access = access_path.read_text(encoding='utf-8').strip()
attendance_policy = attendance_policy_path.read_text(encoding='utf-8').strip()
permissions = permissions_path.read_text(encoding='utf-8').strip()
editing = editing_path.read_text(encoding='utf-8').strip()
student_import = student_import_path.read_text(encoding='utf-8').strip()
student_management = student_management_path.read_text(encoding='utf-8').strip()
time_integration = time_integration_path.read_text(encoding='utf-8').strip()
statistics = statistics_path.read_text(encoding='utf-8').strip()
report = report_path.read_text(encoding='utf-8').strip()
class_structure_pdf = class_structure_pdf_path.read_text(encoding='utf-8').strip()

inline = (
    '\n<script data-fst-pdf-engine="inline">\n' + jspdf + '\n' + autotable + '\n</script>\n'
    '<script data-fst-excel-engine="inline">\n' + xlsx + '\n</script>\n'
    '<script data-fst-time-format="inline">\n' + time_format + '\n</script>\n'
    '<script data-fst-online-runtime="inline">\n' + runtime + '\n</script>\n'
    '<script data-fst-online-fixes="inline">\n' + fixes + '\n</script>\n'
    '<script data-fst-security-v2="inline">\n' + security + '\n</script>\n'
    '<script data-fst-access-control="inline">\n' + access + '\n</script>\n'
    '<script data-fst-attendance-policy="inline">\n' + attendance_policy + '\n</script>\n'
    '<script data-fst-session-permissions="inline">\n' + permissions + '\n</script>\n'
    '<script data-fst-session-editing="inline">\n' + editing + '\n</script>\n'
    '<script data-fst-student-import="inline">\n' + student_import + '\n</script>\n'
    '<script data-fst-student-management="inline">\n' + student_management + '\n</script>\n'
    '<script data-fst-time-integration="inline">\n' + time_integration + '\n</script>\n'
    '<script data-fst-statistics="inline">\n' + statistics + '\n</script>\n'
    '<script data-fst-pdf-reports="inline">\n' + report + '\n</script>\n'
    '<script data-fst-class-structure-pdf="inline">\n' + class_structure_pdf + '\n</script>\n'
)
html = html.replace('</body>', inline + '</body>', 1)
html_path.write_text(html, encoding='utf-8')

for marker in [
    'window.FSTOnlineRuntime=', 'window.FSTSecurityV2', 'pin-login', 'save_attendance_sheet',
    'challengeAndVerify', 'VERSION_CONFLICT', 'Connexion Internet requise',
    'data-fst-pdf-engine="inline"', 'data-fst-security-v2="inline"',
    'data-fst-excel-engine="inline"', 'data-fst-time-format="inline"',
    'data-fst-student-import="inline"', 'data-fst-student-management="inline"',
    'data-fst-time-integration="inline"', 'data-fst-class-structure-pdf="inline"',
    'window.FSTAccessControl=', 'grade_only', 'FSTSessionPermissions', 'FSTSessionEditing',
    'FSTStudentImport', 'FSTStudentManagement', 'FSTTimeIntegration', 'FSTClassStructure',
    'student-class-block', 'XLSX.read', 'PDF de la classe', 'Notes par séance', 'Moyenne /20',
    'Statistiques et graphiques', 'Répartition des notes', 'Comparaison par module',
    'PDF statistiques', 'window.FSTPdf=', 'Lecture seule'
]:
    assert marker in html, marker
for src in ['./online-runtime.js', './online-fixes.js', './security-v2.js']:
    assert src not in html
assert not re.search(r'<script[^>]+src=["\'][^"\']*(?:html2canvas|jspdf)[^"\']*["\'][^>]*></script>', html, re.I)
print(html_path)
