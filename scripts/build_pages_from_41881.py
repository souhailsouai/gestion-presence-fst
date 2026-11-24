from pathlib import Path
import re
from fst_shell_transform import apply_fst_shell

root = Path(__file__).resolve().parents[1]
source = root / 'index.html'
web = root / 'web'
out = web / 'index.html'

html = source.read_text(encoding='utf-8')

# The locked source retains historical labels. Correct this one delivered title
# before writing the Pages payload, without hiding or removing the notice block.
notices_heading = '<h3><i class="fas fa-bullhorn"></i> Avis officiels \u2014 V30</h3>'
assert html.count(notices_heading) == 1, 'Expected one official notices heading in the locked source'
html = html.replace(
    notices_heading,
    '<h3><i class="fas fa-bullhorn"></i> Avis officiels</h3>',
    1,
)

# --- Mode réel uniquement : le mode test / démo est retiré (bascule et boutons).
# Chaque remplacement doit trouver exactement son texte dans la source verrouillée.
def _replace_once(text, old, new, label):
    assert text.count(old) == 1, f'{label}: {text.count(old)} occurrence(s) dans la source'
    return text.replace(old, new, 1)

html = _replace_once(html,
    "const {data,error}=await rpc('v18_get_runtime_mode');\n    if(error||!data?.ok)throw error||new Error(data?.message||'Mode indisponible');",
    "const data={ok:true,mode:'real',changed_at:null,can_manage:false};",
    'mode réel (refresh)')
html = _replace_once(html,
    "if(!adminMode()){box?.remove();return;}\n    if(!box){box=document.createElement('section');box.id='v18-runtime-controls'",
    "box?.remove();return;\n    if(!box){box=document.createElement('section');box.id='v18-runtime-controls'",
    'boutons mode V18')
html = _replace_once(html,
    "if(!adminMode()){old?.remove();return false;}",
    "old?.remove();return false;",
    'boutons mode V17')

# Change display text only, not V30/V31 module names, data attributes or APIs.
# Apply to the whole source: inline renderers recreate the student/planning
# headings after navigation, so editing only static heading elements is not enough.
visible_labels = (
    ('Gestion Pr\u00e9sence FST V30 \u2014 2026/2027', 'Gestion Pr\u00e9sence FST \u2014 2026/2027'),
    ('Gestion de Pr\u00e9sence des TP \u2014 V30', 'Gestion de Pr\u00e9sence des TP'),
    ('\u00c9tudiants \u2014 V30', '\u00c9tudiants'),
    ('S\u00e9ances \u2014 V30', 'S\u00e9ances'),
    ('Planning des s\u00e9ances \u2014 V30', 'Planning des s\u00e9ances'),
    ('Configuration des intervenants \u2014 V30', 'Configuration des intervenants'),
    ('Source officielle V30 :', 'Source officielle :'),
    ('Le planning V20 doit contenir exactement 7 enseignants configur\u00e9s.', 'Le planning doit contenir exactement 7 enseignants configur\u00e9s.'),
    ('R\u00e8gle V20 :', 'R\u00e8gle :'),
    ('\u00c9dition manuelle du planning \u2014 V20', '\u00c9dition manuelle du planning'),
    ('Mod\u00e8le d\u2019export V16 indisponible.', 'Mod\u00e8le d\u2019export indisponible.'),
    ('Erreur de chargement : modules V16 indisponibles.', 'Erreur de chargement : modules indisponibles.'),
    ('Mode de fonctionnement V20', 'Mode de fonctionnement'),
    ('Modification manuelle des enseignants \u2014 V20', 'Modification manuelle des enseignants'),
    ('Application TEST \u2192 R\u00c9EL d\u00e9sactiv\u00e9e en V20.', 'Application TEST \u2192 R\u00c9EL d\u00e9sactiv\u00e9e.'),
    ('Les noms affich\u00e9s proviennent uniquement des affectations V21.', 'Les noms affich\u00e9s proviennent uniquement des affectations officielles.'),
)
for previous_label, display_label in visible_labels:
    assert previous_label in html, 'Expected legacy display label: ' + previous_label
    html = html.replace(previous_label, display_label)

# Keep the locked 41881 baseline untouched, but externalize the large SheetJS
# engine in the Pages payload. This prevents browser HTML recovery from ever
# rendering minified XLSX source as visible application content.
xlsx_tag = '<script src="./vendor/xlsx.full.min.js"></script>'
xlsx_pattern = r'<script data-fst-xlsx-engine="inline">.*?</script>'
html, xlsx_replacements = re.subn(
    xlsx_pattern,
    xlsx_tag,
    html,
    count=1,
    flags=re.S,
)
assert xlsx_replacements == 1, 'Expected exactly one inline XLSX engine in locked baseline'

# Preserve the historical input order. The shared transform below retires the
# visual controllers and retains their effective authentication implementation.
mobile_css = (root / 'shared' / 'mobile.css').read_text(encoding='utf-8').strip()
mobile_js = (root / 'shared' / 'mobile.js').read_text(encoding='utf-8').strip()
if 'data-fst-mobile-css="inline"' not in html:
    html = html.replace('</head>', '\n<style data-fst-mobile-css="inline">\n' + mobile_css + '\n</style>\n</head>', 1)
if 'data-fst-mobile-js="inline"' not in html:
    html = html.replace('</body>', '\n<script data-fst-mobile-js="inline">\n' + mobile_js + '\n</script>\n</body>', 1)

tags = [
    '<script src="./v31-config.js"></script>',
    '<script src="./v31-domain.js"></script>',
    '<script src="./v31-tracking-xlsx.js"></script>',
    '<script src="./v31-version-ui.js"></script>',
    '<script src="./v31-export-ui.js"></script>',
    '<script src="./v30-teacher-attendance-fix.js"></script>',
    '<script src="./v30-lpc3.js"></script>',
    '<script src="./v30-student-add-rpc-fix.js"></script>',
    '<script src="./v32-notices.js"></script>',
    '<script src="./v32-student-search.js"></script>',
    '<script src="./v33-s2-core.js"></script>',
    '<script src="./v33-semestres.js"></script>',
    '<script src="./v33-statistiques.js"></script>',
    '<script src="./v34-bilan-s1.js"></script>',
]
for tag in tags:
    if tag not in html:
        html = html.replace('</body>', '\n' + tag + '\n</body>', 1)

html = apply_fst_shell(html, target='pages', root=root)

# Pages only: serve the sidebar copies of the two institutional logos as small
# cached files instead of repeating the 1536px base64 images (~400 KB less).
import hashlib, json, shutil
assets_src = root / 'shared' / 'assets'
logo_map = json.loads((assets_src / 'logo-map.json').read_text(encoding='utf-8'))
(web / 'assets').mkdir(exist_ok=True)
for logo_name in set(logo_map.values()):
    shutil.copyfile(assets_src / logo_name, web / 'assets' / logo_name)
def _logo_file(match):
    name = logo_map.get(hashlib.sha256(match.group(0).encode()).hexdigest())
    return './assets/' + name if name else match.group(0)
# Only the sidebar copies are replaced: the login images stay byte-identical.
def _internal_logo(tag):
    return re.sub(r'data:image/[a-z]+;base64,[A-Za-z0-9+/=]{50000,}', _logo_file, tag.group(0))
html, logo_replacements = re.subn(r'<img\b[^>]*\bid="internal-(?:utm|fst)-logo"[^>]*>', _internal_logo, html)
assert logo_replacements == 2 and './assets/fst-logo.jpg' in html and './assets/utm-logo.jpg' in html, 'Sidebar logos were not externalized'

out.write_text(html, encoding='utf-8')

for marker in [
    'v31-config.js',
    'v31-domain.js',
    'v31-tracking-xlsx.js',
    'v31-version-ui.js',
    'v31-export-ui.js',
    'v30-teacher-attendance-fix.js',
    'v30-lpc3.js',
    'v30-student-add-rpc-fix.js',
    'v32-notices.js',
    'v32-student-search.js',
    'v33-s2-core.js',
    'v33-semestres.js',
    'v33-statistiques.js',
    'v34-bilan-s1.js',
    'data-fst-shell-css="inline"',
    'data-fst-shell-js="inline"',
    'data-fst-auth-compat="inline"',
    'presence-session',
    'saveAttendance',
    './vendor/xlsx.full.min.js',
]:
    assert marker in html, marker

assert 'data-fst-xlsx-engine="inline"' not in html
assert 'Km(e){var r=e.replace' not in html

print(out)
