from pathlib import Path
from urllib.request import urlopen
import base64
import gzip
import subprocess
import tempfile

from v16_html_transform import apply_v16_shell
from fst_shell_transform import apply_fst_shell

root = Path(__file__).resolve().parents[1]
web = root / 'web'
web.mkdir(parents=True, exist_ok=True)
vendor = web / 'vendor'
vendor.mkdir(parents=True, exist_ok=True)
source = root / 'gestion_presence_tp_theme_institutionnel.html'
out = web / 'index.html'
out.write_bytes(source.read_bytes())

xlsx_path = vendor / 'xlsx.full.min.js'
xlsx_url = 'https://raw.githubusercontent.com/SheetJS/sheetjs/v0.18.5/dist/xlsx.full.min.js'
if not xlsx_path.exists() or xlsx_path.stat().st_size < 1000:
    with urlopen(xlsx_url, timeout=60) as response:
        xlsx_path.write_bytes(response.read())

part1 = (root / 'scripts' / 'web-superadmin.patch.part1').read_text(encoding='utf-8').strip()
part2 = (root / 'scripts' / 'web-superadmin.patch.part2').read_text(encoding='utf-8').strip()
patch_bytes = gzip.decompress(base64.b64decode(part1 + part2))
with tempfile.NamedTemporaryFile(suffix='.patch', delete=False) as tmp:
    tmp.write(patch_bytes)
    patch_path = Path(tmp.name)
try:
    subprocess.run(['git', 'apply', '-p0', '--whitespace=nowarn', str(patch_path)], cwd=root, check=True)
finally:
    patch_path.unlink(missing_ok=True)

html = out.read_text(encoding='utf-8')
html = apply_v16_shell(html)
mobile_css = (root / 'shared' / 'mobile.css').read_text(encoding='utf-8').strip()
mobile_js = (root / 'shared' / 'mobile.js').read_text(encoding='utf-8').strip()
if 'data-fst-mobile-css="inline"' not in html:
    html = html.replace('</head>', '\n<style data-fst-mobile-css="inline">\n' + mobile_css + '\n</style>\n</head>', 1)
if 'data-fst-mobile-js="inline"' not in html:
    html = html.replace('</body>', '\n<script data-fst-mobile-js="inline">\n' + mobile_js + '\n</script>\n</body>', 1)
tags = [
    '<script src="./v31-config.js"></script>',
    '<script src="./v31-domain.js"></script>',
    '<script src="./online-runtime.js"></script>',
    '<script src="./v16-active-role.js"></script>',
    '<script src="./v16-test-mode.js"></script>',
    '<script src="./online-fixes.js"></script>',
    '<script src="./security-v2.js"></script>',
    '<script src="./v515-planning-core.js"></script>',
    '<script src="./v515-planning-2026-2027.js"></script>',
    '<script src="./v16-planning-data.js"></script>',
    '<script src="./v16-planning-state.js"></script>',
    '<script src="./v16-teacher-permutations.js"></script>',
    '<script src="./v16-student-groups.js"></script>',
    '<script src="./v16-timetable-presence-link.js"></script>',
    '<script src="./vendor/xlsx.full.min.js"></script>',
    '<script src="./v16-planning-export-model.js"></script>',
    '<script src="./v16-planning-pdf.js"></script>',
    '<script src="./v16-planning-xlsx.js"></script>',
    '<script src="./v31-tracking-xlsx.js"></script>',
    '<script src="./v31-version-ui.js"></script>',
    '<script src="./v31-export-ui.js"></script>',
    '<script src="./v16-planning-editor.js"></script>',
    '<script src="./v16-dashboard-notices.js"></script>',
    '<script src="./v16-planning-ui.js"></script>',
    '<script src="./v30-lpc3.js"></script>',
    '<script src="./v30-student-add-rpc-fix.js"></script>',
]
for tag in tags:
    if tag not in html:
        html = html.replace('</body>', f'\n{tag}\n</body>', 1)
html = apply_fst_shell(html, target='online', root=root)
out.write_text(html, encoding='utf-8')

markers = [
    'teacher_directory',
    'restorePersistentSession',
    'ACTIVE_MODE_KEY',
    '2026/2027',
    'data-v16-navigation="true"',
    'id="planning-v16" class="tab-content"',
    'data-fst-shell-css="inline"',
    'data-fst-shell-js="inline"',
    'data-fst-auth-compat="inline"',
    *tags,
]
for marker in markers:
    assert marker in html, marker

security = (web / 'security-v2.js').read_text(encoding='utf-8')
for marker in ['pin-login', 'challengeAndVerify', 'save_attendance_sheet', 'VERSION_CONFLICT']:
    assert marker in security, marker
print(out)
