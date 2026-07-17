#!/usr/bin/env python3
import json
import os
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EXTENSION_ROOT = REPO_ROOT / 'apps' / 'firefox-extension'
DIST_DIR = REPO_ROOT / 'dist'

ALLOWED_DIRS = {'src', 'assets', 'lib'}
ALLOWED_ROOT_FILES = {'manifest.json'}

FORBIDDEN_SUFFIXES = {'.map', '.swp', '.swo', '.pyc'}
FORBIDDEN_NAMES = {'__pycache__', 'Thumbs.db', '.DS_Store'}

FORBIDDEN_PATTERNS = frozenset([
    'node_modules', 'dist', '.git', 'tests', 'docs', 'tools', 'scripts',
])


def is_forbidden(rel: Path) -> bool:
    for part in rel.parts:
        if part.startswith('.'):
            return True
        if part in FORBIDDEN_NAMES or part in FORBIDDEN_PATTERNS:
            return True
        if any(part.endswith(s) for s in FORBIDDEN_SUFFIXES):
            return True
    return False


def collect_files(root: Path):
    files = []
    for dirpath_str, dirnames, filenames in os.walk(str(root), followlinks=False):
        dirpath = Path(dirpath_str)
        rel_dir = dirpath.relative_to(root)

        if rel_dir == Path('.'):
            dirnames[:] = sorted(d for d in dirnames if d in ALLOWED_DIRS)
            include_file = lambda n: n in ALLOWED_ROOT_FILES
        else:
            dirnames[:] = sorted(d for d in dirnames if not d.startswith('.') and d not in FORBIDDEN_NAMES)
            include_file = lambda n: not n.startswith('.')

        for name in sorted(filenames):
            if not include_file(name):
                continue
            abs_path = dirpath / name
            rel = abs_path.relative_to(root)
            if is_forbidden(rel):
                print(f'  skip: {rel}', file=sys.stderr)
                continue
            files.append((rel, abs_path))
    return files


def verify_no_forbidden(files):
    violations = []
    for rel, _ in files:
        for pattern in FORBIDDEN_PATTERNS:
            if pattern in rel.parts:
                violations.append(str(rel))
    if violations:
        print('error: forbidden files in package:', file=sys.stderr)
        for v in violations:
            print(f'  {v}', file=sys.stderr)
        sys.exit(1)


def main():
    if not EXTENSION_ROOT.is_dir():
        print(f'error: extension root not found: {EXTENSION_ROOT}', file=sys.stderr)
        sys.exit(1)

    manifest_path = EXTENSION_ROOT / 'manifest.json'
    if not manifest_path.is_file():
        print(f'error: manifest.json not found', file=sys.stderr)
        sys.exit(1)

    with open(manifest_path) as f:
        version = json.load(f).get('version', '0.0.0')

    files = collect_files(EXTENSION_ROOT)
    if not files:
        print('error: no files found to package', file=sys.stderr)
        sys.exit(1)

    verify_no_forbidden(files)

    DIST_DIR.mkdir(exist_ok=True)
    output = DIST_DIR / f'videodefaults-{version}.zip'

    with zipfile.ZipFile(str(output), 'w', zipfile.ZIP_DEFLATED) as zf:
        for rel, abs_path in files:
            zf.write(str(abs_path), str(rel))
            print(f'  + {rel}')

    size_kb = output.stat().st_size // 1024
    print(f'\npackaged: {output}')
    print(f'files: {len(files)}, size: {size_kb}KB')


if __name__ == '__main__':
    main()
