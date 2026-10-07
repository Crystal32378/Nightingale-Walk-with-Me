"""Provenance and preservation checks for the real 57-row review import."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'eval/reviews/trip2-2026-10-07'
spec = importlib.util.spec_from_file_location('trip2_import', ROOT / 'scripts/import-trip2-review.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReviewImportTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'eval').mkdir()
        (self.root / 'fixtures').mkdir()
        shutil.copyfile(EVIDENCE / 'labels-before.json', self.root / 'eval/photo-labels.json')
        shutil.copyfile(ROOT / 'fixtures/route-renai-001.json', self.root / 'fixtures/route-renai-001.json')
        self.review = json.loads((EVIDENCE / 'human-review.json').read_text())
        self.path = self.root / 'review.json'
        self.original = (self.root / 'eval/photo-labels.json').read_bytes()

    def tearDown(self):
        self.temp.cleanup()

    def run_import(self, review=None, apply=True):
        self.path.write_text(json.dumps(self.review if review is None else review, ensure_ascii=False))
        argv = ['import-trip2-review.py', '--review', str(self.path)] + (['--apply'] if apply else [])
        with patch.object(module, 'ROOT', self.root), patch.object(sys, 'argv', argv):
            module.main()

    def test_dry_run_leaves_labels_and_evidence_untouched(self):
        self.run_import(apply=False)
        self.assertEqual((self.root / 'eval/photo-labels.json').read_bytes(), self.original)
        self.assertFalse((self.root / 'eval/reviews').exists())

    def test_import_preserves_verbatim_text_and_first_trip(self):
        self.run_import()
        after = json.loads((self.root / 'eval/photo-labels.json').read_text())
        before = json.loads(self.original)
        self.assertEqual([r for r in before['photos'] if r.get('trip') != 2], [r for r in after['photos'] if r.get('trip') != 2])
        rows = {r['file']: r for r in after['photos']}
        self.assertEqual(rows['第二趟/jpg/IMG_5595.jpg']['place'], 'fuxing_west')
        self.assertEqual(rows['第二趟/jpg/IMG_5596.jpg']['place'], 'fuxing_west')
        self.assertEqual(rows['第二趟/frames/IMG_5580_f1.jpg']['expect'], ['聯合醫院 仁愛院區 大廳入口 急診室哭 停車場入口'])
        self.assertEqual(sum(r.get('reviewed') is True for r in after['photos']), 57)

    def test_grading_projection_excludes_unregistered_text_without_rewriting_it(self):
        self.run_import()
        projected = json.loads((self.root / 'eval/reviews/trip2-2026-10-07/labels-after.route-terms.json').read_text())
        rows = {r['file']: r for r in projected['photos']}
        self.assertEqual(rows['第二趟/jpg/IMG_5591.jpg']['expect'], [])
        self.assertEqual(rows['第二趟/jpg/IMG_5591.jpg']['humanVisibleText']['expect'], ['FamilyMart', '復興南路一段219巷'])
        self.assertEqual(rows['第二趟/frames/IMG_5583_f2.jpg']['expect'], ['急診'])
        self.assertEqual(rows['第二趟/jpg/IMG_5593.jpg']['expect'], ['大安路一段116巷'])

    def test_rejects_stale_incomplete_duplicate_and_unknown_place_reviews_before_writes(self):
        invalid = []
        review = copy.deepcopy(self.review); review['sourceSha256'] = '0' * 64; invalid.append(review)
        review = copy.deepcopy(self.review); review['photos'][0]['reviewed'] = False; invalid.append(review)
        review = copy.deepcopy(self.review); review['photos'][1]['file'] = review['photos'][0]['file']; invalid.append(review)
        review = copy.deepcopy(self.review); review['photos'][0]['place'] = 'invented'; invalid.append(review)
        review = copy.deepcopy(self.review); review['photos'][0]['place'] = 'about'; invalid.append(review)
        for review in invalid:
            with self.subTest(review=review['sourceSha256']):
                with self.assertRaises(ValueError): self.run_import(review)
                self.assertEqual((self.root / 'eval/photo-labels.json').read_bytes(), self.original)
                self.assertFalse((self.root / 'eval/reviews').exists())

    def test_second_import_cannot_silently_overwrite_the_new_source(self):
        self.run_import()
        changed = (self.root / 'eval/photo-labels.json').read_bytes()
        with self.assertRaises(ValueError): self.run_import()
        self.assertEqual((self.root / 'eval/photo-labels.json').read_bytes(), changed)


if __name__ == '__main__':
    unittest.main()
