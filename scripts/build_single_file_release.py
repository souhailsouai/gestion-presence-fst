from pathlib import Path

root = Path(__file__).resolve().parents[1]
html_path = root / 'web' / 'index.html'
runtime_path = root / 'web' / 'online-runtime.js'
fixes_path = root / 'web' / 'online-fixes.js'

html = html_path.read_text(encoding='utf-8')
runtime = runtime_path.read_text(encoding='utf-8').strip()
fixes = fixes_path.read_text(encoding='utf-8').strip()

html = html.replace('<script src="./online-runtime.js"></script>', '')
html = html.replace('<script src="./online-fixes.js"></script>', '')
inline = (
    '\n<script data-fst-online-runtime="inline">\n' + runtime + '\n</script>\n'
    '<script data-fst-online-fixes="inline">\n' + fixes + '\n</script>\n'
)
html = html.replace('</body>', inline + '</body>', 1)
html_path.write_text(html, encoding='utf-8')

for marker in ['window.FSTOnlineRuntime=', 'window.loadData=async function', 'Connexion Internet requise']:
    assert marker in html, marker
assert './online-runtime.js' not in html
assert './online-fixes.js' not in html
print(html_path)
