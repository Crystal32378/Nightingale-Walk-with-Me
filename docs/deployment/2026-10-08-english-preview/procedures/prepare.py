#!/usr/bin/env python3
"""Prepare immutable local deployment archives; does not deploy or change traffic."""
import argparse, hashlib, io, json, pathlib, subprocess, tarfile, tempfile
from datetime import datetime, timezone
BACKEND = pathlib.Path(__file__).resolve().parents[4]
FRONTEND = pathlib.Path('/Users/crystalchang/Desktop/Opus Chamber/Nightingale')
OUTPUT = BACKEND / 'docs/deployment/2026-10-08-english-preview'
STAGE = pathlib.Path(tempfile.mkdtemp(prefix='nightingale-english-preview-'))
TAG = 'english-20261008'
parser = argparse.ArgumentParser()
parser.add_argument('--backend-commit', default='34bc9be')
parser.add_argument('--frontend-commit', default='cdb9da550b0b7b039380ca52505a1bd193e26b52')
args = parser.parse_args()
def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args])
def source(repo, name, paths):
    commit = git(repo, 'rev-parse', args.backend_commit if name == 'backend' else args.frontend_commit).decode().strip()
    archive = git(repo, 'archive', '--format=tar', commit, *paths)
    target = STAGE / name
    target.mkdir()
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        tar.extractall(target, filter='data')
    if name == 'frontend':
        (target / '.env.example').unlink(missing_ok=True)
    files = sorted(str(p.relative_to(target)) for p in target.rglob('*') if p.is_file())
    assert not any(p.endswith('.env') or 'field trip photos' in p for p in files)
    return {'commit': commit, 'sourceDir': str(target), 'archiveSha256': hashlib.sha256(archive).hexdigest(), 'fileCount': len(files), 'files': files}
receipt = {'preparedAtUtc': datetime.now(timezone.utc).isoformat(), 'tag': TAG, 'channel': TAG,
    'revision': 'nightingale-english20261008', 'stagingRoot': str(STAGE), 'sources': {
        'backend': source(BACKEND, 'backend', ['.gcloudignore', '.dockerignore', 'Dockerfile', 'src', 'fixtures', 'package.json', 'package-lock.json', 'tsconfig.json']),
        'frontend': source(FRONTEND, 'frontend', []),
    }}
config = {'hosting': {'site': 'nightingale-walk-with-me', 'public': 'dist', 'ignore': ['firebase.json', '**/.*', '**/node_modules/**'],
    'headers': [{'source':'/', 'headers':[{'key':'Cache-Control','value':'no-cache'}]}, {'source':'**/*.html','headers':[{'key':'Cache-Control','value':'no-cache'}]},
        {'source':'/assets/**','headers':[{'key':'Cache-Control','value':'public, max-age=31536000, immutable'}]}]}}
(STAGE / 'frontend/firebase.preview.json').write_text(json.dumps(config, indent=2) + '\n')
(OUTPUT / 'prebuild.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k: v for k, v in receipt.items() if k != 'sources'}, indent=2))
