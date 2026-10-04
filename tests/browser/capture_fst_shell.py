"""Capture reproducible geometry evidence on final artifacts, using offline fixtures."""
import argparse
import hashlib
import json
from pathlib import Path
from fst_shell_harness import Harness, VIEWPORTS, measure_layout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--artifact', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    evidence = {'artifact_sha256': hashlib.sha256(args.artifact.read_bytes()).hexdigest(),
                'offline_fixtures': True, 'real_authentication': False, 'measurements': []}
    h = Harness(path=args.artifact)
    try:
        h.login_fixture(name='Enseignant de test')
        for width, height in VIEWPORTS:
            h.page.set_viewport_size({'width': width, 'height': height})
            h.page.wait_for_timeout(180)
            evidence['measurements'].append(measure_layout(h.page))
            h.page.screenshot(path=str(args.out / f'shell-{width}.png'))
        h.page.set_viewport_size({'width': 390, 'height': 844})
        h.page.wait_for_timeout(180)
        h.page.locator('#fst-sidebar-toggle').click()
        h.page.locator('#lpc3-nav-tab').scroll_into_view_if_needed()
        h.page.screenshot(path=str(args.out / 'drawer-lpc3-390.png'))
        evidence['javascript_errors'] = h.errors
    finally:
        h.close()
    (args.out / 'measurements.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'viewports': len(evidence['measurements']), 'output': str(args.out),
                      'javascript_errors': evidence['javascript_errors']}))


if __name__ == '__main__':
    main()
