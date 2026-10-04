from pathlib import Path
import re

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
]
for tag in tags:
    if tag not in html:
        html = html.replace('</body>', '\n' + tag + '\n</body>', 1)

out.write_text(html, encoding='utf-8')

for marker in [
    'v31-config.js',
    'v31-domain.js',
    'v31-tracking-xlsx.js',
    'v31-version-ui.js',
    'v31-export-ui.js',
    'v30-teacher-attendance-fix.js',
    'v30-lpc3.js',
    'data-fst-mobile-css="inline"',
    'data-fst-mobile-js="inline"',
    'presence-session',
    'saveAttendance',
    './vendor/xlsx.full.min.js',
]:
    assert marker in html, marker

assert 'data-fst-xlsx-engine="inline"' not in html
assert 'Km(e){var r=e.replace' not in html

print(out)
