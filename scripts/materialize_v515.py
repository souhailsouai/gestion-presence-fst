from pathlib import Path
import base64
import io
import tarfile

root = Path(__file__).resolve().parents[1]
parts = []
for i in range(1, 8):
    path = root / '.v515' / f'materialize.part{i:02d}'
    text = path.read_text(encoding='utf-8')
    if text.startswith('# V5.15 generated source archive'):
        lines = []
        for line in text.splitlines()[1:]:
            if line.startswith('# '):
                lines.append(line[2:])
        text = ''.join(lines)
    else:
        text = ''.join(text.split())
    parts.append(text)

payload = base64.b64decode(''.join(parts), validate=True)
with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
    members = archive.getmembers()
    resolved_root = root.resolve()
    for member in members:
        target = (root / member.name).resolve()
        if target != resolved_root and resolved_root not in target.parents:
            raise RuntimeError(f'Unsafe archive path: {member.name}')
    archive.extractall(root)

print(f'Materialized {len(members)} V5.15 source files.')
