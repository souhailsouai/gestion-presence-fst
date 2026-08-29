from pathlib import Path

root = Path(__file__).resolve().parents[1]
src = (root / 'app/src/main/assets/index.html').read_text(encoding='utf-8')
css = (root / 'shared/mobile.css').read_text(encoding='utf-8')
js = (root / 'shared/mobile.js').read_text(encoding='utf-8')

src = src.replace('width=device-width, initial-scale=1.0', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
if 'data-shared-mobile-v2="css"' not in src:
    src = src.replace('</head>', f'\n<style data-shared-mobile-v2="css">\n{css}\n</style>\n</head>', 1)
if 'data-shared-mobile-v2="js"' not in src:
    src = src.replace('</body>', f'\n<script data-shared-mobile-v2="js">\n{js}\n</script>\n</body>', 1)

out = root / 'web/index.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(src, encoding='utf-8')
assert 'viewport-fit=cover' in src
assert 'Changer de compte' in src
assert '2026/2027' in src
print(out)
