#!/usr/bin/env python3
"""Validate and import the complete human review; dry run unless --apply.

Human text is preserved verbatim. Separate scoring labels project only exact,
longest non-overlapping registered terms. The route fixture is never edited.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review', required=True, type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    labels_path = ROOT / 'eval/photo-labels.json'
    route_path = ROOT / 'fixtures/route-renai-001.json'
    before = json.loads(labels_path.read_text())
    review = json.loads(args.review.read_text())
    route = json.loads(route_path.read_text())
    if review.get('sourceSha256') != digest(labels_path):
        raise ValueError('Review source hash does not match current labels; stop without modifying files.')
    if review.get('routeId') != before['routeId'] or review.get('trip') != 2 or review.get('status') != 'reviewed':
        raise ValueError('Expected a completed trip-2 review of this route.')
    expected = {p['file'] for p in before['photos'] if p.get('trip') == 2}
    rows = review.get('photos', [])
    files = [p['file'] for p in rows]
    if len(rows) != 57 or len(set(files)) != 57 or set(files) != expected:
        raise ValueError('Review must contain exactly the original 57 trip-2 files, each once.')
    places = {name for name, value in before['places'].items() if isinstance(value, dict)
              and isinstance(value.get('pos'), (int, float)) and isinstance(value.get('zone'), str)}
    for row in rows:
        if row.get('reviewed') is not True:
            raise ValueError('An unreviewed row remains: ' + row['file'])
        if row.get('place') != 'noise' and row.get('place') not in places:
            raise ValueError('Unknown reviewed place: ' + str(row.get('place')))
        for key in ['expect', 'optional']:
            if not isinstance(row.get(key, []), list) or any(not isinstance(s, str) or not s.strip() for s in row.get(key, [])):
                raise ValueError('Invalid visible text in ' + row['file'])
    byfile = {p['file']: p for p in rows}
    after = copy.deepcopy(before)
    changes = []
    for row in after['photos']:
        if row['file'] not in byfile:
            continue
        approved = byfile[row['file']]
        changed = {}
        for key in ['place', 'expect', 'optional']:
            value = approved.get(key, [])
            if row.get(key, []) != value:
                changed[key] = {'before': copy.deepcopy(row.get(key, [])), 'after': copy.deepcopy(value)}
            row[key] = copy.deepcopy(value)
        row['reviewed'] = True
        row['reviewedBy'] = 'Crystal'
        row['reviewExportedAt'] = review['exportedAt']
        if approved.get('reviewNote'):
            row['reviewNote'] = approved['reviewNote']
        if changed:
            changes.append({'file': row['file'], 'changes': changed})
    after['about'] = before['about'].replace(
        'Trip 2 (2026-09-28) rows are placed by Opus from GPS and content; Crystal has not checked them yet.',
        'Trip 2 (2026-09-28): all 57 rows reviewed by Crystal and exported 2026-10-07. Visible text is verbatim human input; derived route-term scoring labels are stored separately.'
    )
    review_dir = ROOT / 'eval/reviews/trip2-2026-10-07'
    after['trip2Review'] = {
        'reviewedBy': 'Crystal', 'exportedAt': review['exportedAt'],
        'sourceSha256': review['sourceSha256'], 'reviewSha256': digest(args.review),
        'reviewFile': 'eval/reviews/trip2-2026-10-07/human-review.json',
        'rows': 57, 'changedRows': len(changes),
    }
    terms = set()
    for cp in route['checkpoints']:
        terms.update(cp.get('expectedLandmarks', []))
        terms.update(cp.get('arrivalEvidence', []))
        terms.update(cp.get('ambiguity', {}).get('sharedEvidence', []))
        terms.update(c['landmark'] for c in cp.get('conflictLandmarks', []))
    lookup = {term.strip().lower(): term.strip() for term in terms}
    pattern = re.compile('|'.join(re.escape(t) for t in sorted(lookup, key=lambda t: (-len(t), t))))

    def project(doc):
        result = copy.deepcopy(doc)
        audit = []
        for row in result['photos']:
            row['humanVisibleText'] = {k: copy.deepcopy(row.get(k, [])) for k in ['expect', 'optional']}
            for key in ['expect', 'optional']:
                matched = []
                for text in row['humanVisibleText'][key]:
                    hits = [lookup[m.group()] for m in pattern.finditer(text.strip().lower())]
                    matched.extend(hits)
                    audit.append({'file': row['file'], 'field': key, 'verbatim': text, 'routeTerms': list(dict.fromkeys(hits))})
                row[key] = list(dict.fromkeys(matched))
            row['optional'] = [t for t in row['optional'] if t not in row['expect']]
        result['scoringProjection'] = {
            'method': 'Exact case-insensitive longest non-overlapping registered substrings; no synonym or spelling correction.',
            'routeSha256': digest(route_path),
            'warning': 'Only for scoring saved readings. Does not change the route vocabulary or authorize any navigation evidence.',
        }
        return result, audit

    before_scoring, before_map = project(before)
    after_scoring, after_map = project(after)
    # Invariants before the first write: original first-trip labels and approved text stay exact.
    assert [p for p in before['photos'] if p.get('trip') != 2] == [p for p in after['photos'] if p.get('trip') != 2]
    assert all(all(p.get(k, []) == byfile[p['file']].get(k, []) for k in ['place', 'expect', 'optional']) for p in after['photos'] if p.get('trip') == 2)
    print(json.dumps({'apply': args.apply, 'rows': len(rows), 'changedRows': len(changes),
                      'placeChanges': sum('place' in c['changes'] for c in changes), 'routeSha256': digest(route_path)}, ensure_ascii=False))
    if not args.apply:
        return
    if review_dir.exists():
        raise ValueError('Review evidence directory exists; refusing to overwrite provenance.')
    review_dir.mkdir(parents=True)
    (review_dir / 'human-review.json').write_bytes(args.review.read_bytes())
    (review_dir / 'labels-before.json').write_bytes(labels_path.read_bytes())
    dump(review_dir / 'import-audit.json', {'sourceSha256': digest(labels_path), 'reviewSha256': digest(args.review),
         'routeSha256': digest(route_path), 'changes': changes})
    dump(review_dir / 'labels-before.route-terms.json', before_scoring)
    dump(review_dir / 'labels-after.route-terms.json', after_scoring)
    dump(review_dir / 'term-projection-before.json', before_map)
    dump(review_dir / 'term-projection-after.json', after_map)
    dump(labels_path, after)
    print('Imported human review; original text, source labels, and grading projection preserved separately.')


if __name__ == '__main__':
    main()
