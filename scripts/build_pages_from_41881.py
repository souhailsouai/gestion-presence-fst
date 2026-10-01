from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / 'index.html'
web = root / 'web'
out = web / 'index.html'

html = source.read_text(encoding='utf-8')
tags = [
    '<script src="./v30-teacher-attendance-fix.js"></script>',
    '<script src="./v30-lpc3.js"></script>',
]
for tag in tags:
    if tag not in html:
        html = html.replace('</body>', '\n' + tag + '\n</body>', 1)

out.write_text(html, encoding='utf-8')

for marker in [
    'v30-teacher-attendance-fix.js',
    'v30-lpc3.js',
    'presence-session',
    'saveAttendance',
]:
    assert marker in html, marker

print(out)
