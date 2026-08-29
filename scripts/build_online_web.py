from pathlib import Path
import base64
import gzip
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
web = root / 'web'
web.mkdir(parents=True, exist_ok=True)
source = root / 'gestion_presence_tp_theme_institutionnel.html'
out = web / 'index.html'
out.write_bytes(source.read_bytes())

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
tag = '<script src="./online-runtime.js"></script>'
if tag not in html:
    html = html.replace('</body>', f'\n{tag}\n</body>', 1)
out.write_text(html, encoding='utf-8')

for marker in ['teacher_directory', 'restorePersistentSession', 'ACTIVE_MODE_KEY', '2026/2027', tag]:
    assert marker in html, marker
print(out)
