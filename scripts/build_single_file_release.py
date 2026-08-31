from pathlib import Path
from urllib.request import urlopen
import re

root = Path(__file__).resolve().parents[1]
html_path = root / 'web' / 'index.html'
runtime_path = root / 'web' / 'online-runtime.js'
fixes_path = root / 'web' / 'online-fixes.js'
security_path = root / 'web' / 'security-v2.js'
no_mfa_path = root / 'web' / 'no-mfa.js'
access_path = root / 'web' / 'access-control.js'
attendance_policy_path = root / 'web' / 'attendance-policy.js'
permissions_path = root / 'web' / 'session-permissions.js'
editing_path = root / 'web' / 'session-editing.js'
statistics_path = root / 'web' / 'statistics.js'
report_path = root / 'web' / 'report-pdf.js'
vendor = root / 'web' / 'vendor'
vendor.mkdir(parents=True, exist_ok=True)

assets = {
    vendor / 'supabase.min.js': 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js',
    vendor / 'jspdf.umd.min.js': 'https://raw.githubusercontent.com/parallax/jsPDF/v4.2.1/dist/jspdf.umd.min.js',
    vendor / 'jspdf.plugin.autotable.min.js': 'https://raw.githubusercontent.com/simonbengtsson/jsPDF-AutoTable/v5.0.8/dist/jspdf.plugin.autotable.min.js',
}
for path, url in assets.items():
    if not path.exists() or path.stat().st_size < 1000:
        with urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())

html = html_path.read_text(encoding='utf-8')
for src in ['./online-runtime.js', './online-fixes.js', './security-v2.js', './no-mfa.js']:
    html = html.replace(f'<script src="{src}"></script>', '')
html = re.sub(
    r'\s*<script[^>]+src=["\'][^"\']*cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2\.57\.4/dist/umd/supabase\.min\.js["\'][^>]*></script>',
    '',
    html,
    flags=re.I,
)
html = re.sub(r'\s*<script[^>]+src=["\'][^"\']*(?:html2canvas|jspdf)[^"\']*["\'][^>]*></script>', '', html, flags=re.I)

# The empty placeholder is replaced wholesale by renderAuthScreen(); it does not need a duplicate id.
html = html.replace('<div class="auth-box" id="auth-box"></div>', '<div class="auth-box" data-auth-placeholder="true"></div>', 1)

supabase = (vendor / 'supabase.min.js').read_text(encoding='utf-8').strip()
jspdf = (vendor / 'jspdf.umd.min.js').read_text(encoding='utf-8').strip()
autotable = (vendor / 'jspdf.plugin.autotable.min.js').read_text(encoding='utf-8').strip()
runtime = runtime_path.read_text(encoding='utf-8').strip()
fixes = fixes_path.read_text(encoding='utf-8').strip()
security = security_path.read_text(encoding='utf-8').strip()
no_mfa = no_mfa_path.read_text(encoding='utf-8').strip()
access = access_path.read_text(encoding='utf-8').strip()
attendance_policy = attendance_policy_path.read_text(encoding='utf-8').strip()
permissions = permissions_path.read_text(encoding='utf-8').strip()
editing = editing_path.read_text(encoding='utf-8').strip()
statistics = statistics_path.read_text(encoding='utf-8').strip()
report = report_path.read_text(encoding='utf-8').strip()

inline = (
    '\n<script data-fst-supabase="inline">\n' + supabase + '\n</script>\n'
    '<script data-fst-pdf-engine="inline">\n' + jspdf + '\n' + autotable + '\n</script>\n'
    '<script data-fst-online-runtime="inline">\n' + runtime + '\n</script>\n'
    '<script data-fst-online-fixes="inline">\n' + fixes + '\n</script>\n'
    '<script data-fst-security-v2="inline">\n' + security + '\n</script>\n'
    '<script data-fst-no-mfa="inline">\n' + no_mfa + '\n</script>\n'
    '<script data-fst-access-control="inline">\n' + access + '\n</script>\n'
    '<script data-fst-attendance-policy="inline">\n' + attendance_policy + '\n</script>\n'
    '<script data-fst-session-permissions="inline">\n' + permissions + '\n</script>\n'
    '<script data-fst-session-editing="inline">\n' + editing + '\n</script>\n'
    '<script data-fst-statistics="inline">\n' + statistics + '\n</script>\n'
    '<script data-fst-pdf-reports="inline">\n' + report + '\n</script>\n'
)
html = html.replace('</body>', inline + '</body>', 1)
html_path.write_text(html, encoding='utf-8')

for marker in [
    'window.FSTOnlineRuntime=', 'window.FSTSecurityV2', 'pin-login', 'save_attendance_sheet',
    'VERSION_CONFLICT', 'Connexion Internet requise', 'window.FSTMfaDisabled = true',
    'data-fst-supabase="inline"', 'data-fst-pdf-engine="inline"',
    'data-fst-security-v2="inline"', 'data-fst-no-mfa="inline"',
    'window.FSTAccessControl=', 'grade_only', 'FSTSessionPermissions',
    'FSTSessionEditing', 'FSTStatistics', 'Statistiques et graphiques',
    'Répartition des notes', 'Comparaison par module', 'PDF statistiques',
    'window.FSTPdf=', 'Lecture seule'
]:
    assert marker in html, marker
for src in ['./online-runtime.js', './online-fixes.js', './security-v2.js', './no-mfa.js']:
    assert src not in html
assert 'cdn.jsdelivr.net/npm/@supabase/supabase-js' not in html
assert not re.search(r'<script[^>]+src=["\'][^"\']*(?:html2canvas|jspdf)[^"\']*["\'][^>]*></script>', html, re.I)

ids = re.findall(r'\bid=["\']([^"\']+)["\']', html, flags=re.I)
duplicates = sorted({value for value in ids if ids.count(value) > 1})
assert not duplicates, f'duplicate HTML ids: {duplicates}'

print(html_path)
