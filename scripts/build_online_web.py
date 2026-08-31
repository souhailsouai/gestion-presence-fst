from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1]
web = root / 'web'
vendor = web / 'vendor'
vendor.mkdir(parents=True, exist_ok=True)

required_sources = [
    web / 'index.template.html',
    web / 'styles.css',
    web / 'ui.js',
    web / 'api.js',
    web / 'auth.js',
    web / 'attendance.js',
    web / 'administration.js',
    web / 'reports.js',
    web / 'app-shell.js',
]
for path in required_sources:
    if not path.exists() or path.stat().st_size == 0:
        raise SystemExit(f'missing Web source: {path}')

assets = {
    vendor / 'supabase.min.js': 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js',
    vendor / 'jspdf.umd.min.js': 'https://raw.githubusercontent.com/parallax/jsPDF/v4.2.1/dist/jspdf.umd.min.js',
    vendor / 'jspdf.plugin.autotable.min.js': 'https://raw.githubusercontent.com/simonbengtsson/jsPDF-AutoTable/v5.0.8/dist/jspdf.plugin.autotable.min.js',
}
for path, url in assets.items():
    if not path.exists() or path.stat().st_size < 1000:
        with urlopen(url, timeout=60) as response:
            payload = response.read()
        if len(payload) < 1000:
            raise SystemExit(f'invalid vendor asset: {url}')
        path.write_bytes(payload)

print('Web sources and pinned vendor assets are ready.')
