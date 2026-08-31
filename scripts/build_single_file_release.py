from pathlib import Path
from html.parser import HTMLParser
import hashlib
import re

root = Path(__file__).resolve().parents[1]
web = root / 'web'
template = web / 'index.template.html'
styles = web / 'styles.css'
vendor = web / 'vendor'
out = web / 'index.html'
dist = root / 'dist' / 'web'
dist.mkdir(parents=True, exist_ok=True)
release = dist / 'Gestion-Presence-FST-Web-2026-2027.html'
checksum = dist / 'SHA256SUMS.txt'

modules = [
    web / 'ui.js',
    web / 'api.js',
    web / 'auth.js',
    web / 'attendance.js',
    web / 'administration.js',
    web / 'reports.js',
    web / 'app-shell.js',
]
vendors = [
    vendor / 'supabase.min.js',
    vendor / 'jspdf.umd.min.js',
    vendor / 'jspdf.plugin.autotable.min.js',
]

html = template.read_text(encoding='utf-8')
css = styles.read_text(encoding='utf-8').strip()
html = html.replace('<!-- FST_STYLES -->', f'<style data-fst-styles="inline">\n{css}\n</style>')

vendor_parts = []
for path in vendors:
    text = path.read_text(encoding='utf-8').strip().replace('</script>', '<\\/script>')
    vendor_parts.append(f'<script data-fst-vendor="{path.name}">\n{text}\n</script>')
html = html.replace('<!-- FST_VENDOR -->', '\n'.join(vendor_parts))

module_parts = []
application_sources = []
for path in modules:
    raw = path.read_text(encoding='utf-8').strip()
    application_sources.append(raw)
    text = raw.replace('</script>', '<\\/script>')
    module_parts.append(f'<script data-fst-module="{path.name}">\n{text}\n</script>')
html = html.replace('<!-- FST_MODULES -->', '\n'.join(module_parts))
application_js = '\n'.join(application_sources)

required = [
    'FSTApp.auth.login', 'FSTApp.auth.restoreSession', 'FSTApp.boot',
    'pin-login', 'save_attendance_sheet', 'VERSION_CONFLICT', '2026/2027',
    'data-testid="login-identifier"', 'data-testid="login-secret"', 'data-testid="login-submit"',
    'Statistiques et graphiques', 'Répartition des notes', 'Comparaison par module', 'Lecture seule'
]
for marker in required:
    assert marker in html, marker

assert application_js.count('FSTApp.auth.login =') == 1, 'duplicate canonical login implementation'
assert application_js.count('FSTApp.auth.restoreSession =') == 1, 'duplicate canonical session restore implementation'
assert application_js.count('FSTApp.boot =') == 1, 'duplicate canonical boot implementation'
assert not re.search(r'<script[^>]+src=', html, re.I), 'external script dependency present'
assert not re.search(r'<link[^>]+(?:cdnjs|jsdelivr|unpkg)', html, re.I), 'external stylesheet dependency present'
# Supabase's vendored SDK contains optional MFA/TOTP APIs internally. The application
# itself must never call or expose them, so the policy check is intentionally scoped
# to our own modules rather than third-party source code.
assert not re.search(r'auth\.mfa|challengeAndVerify|totp', application_js, re.I), 'MFA client flow present in application code'
assert 'web-superadmin.patch' not in application_js

class IdValidator(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name.lower() == 'id' and value:
                self.ids.append(value)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

validator = IdValidator()
validator.feed(html)
duplicates = sorted({value for value in validator.ids if validator.ids.count(value) > 1})
assert not duplicates, f'duplicate static HTML ids: {duplicates}'

out.write_text(html, encoding='utf-8')
release.write_text(html, encoding='utf-8')
digest = hashlib.sha256(release.read_bytes()).hexdigest()
checksum.write_text(f'{digest}  {release.name}\n', encoding='utf-8')
print(release)
print(digest)
