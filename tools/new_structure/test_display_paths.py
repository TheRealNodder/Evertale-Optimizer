from __future__ import annotations

import copy
import io
import json
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from path_utils import display_command, display_metadata, display_path, display_report, display_text
import MASTER_CONTROL as control
import build_optimizer_runtime_model as runtime


class DisplayPathTests(unittest.TestCase):
    def test_native_relative_root_and_dot_segments(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'repo with spaces'
            root.mkdir()
            self.assertEqual(display_path(root, root), '.')
            self.assertEqual(display_path(root / 'data' / '..' / 'tags ä.json', root), 'tags ä.json')
            self.assertEqual(display_path('data/../tags.json', root), 'tags.json')

    def test_foreign_windows_syntax_and_case(self):
        root = 'Q' + ':/workspace/repo'
        self.assertEqual(display_path('q' + ':\\workspace\\REPO\\data\\..\\tags.json', root), 'tags.json')
        self.assertEqual(display_path(root, root), '.')

    def test_prefix_neighbor_and_external_collisions(self):
        root = 'Q' + ':/workspace/repo'
        a = display_path(root + '-extra/tags.json', root)
        b = display_path('Q' + ':/other/tags.json', root)
        # Outside paths are labeled by filename only, so same-named files share a label.
        self.assertEqual(a, 'external/tags.json')
        self.assertEqual(b, 'external/tags.json')
        self.assertEqual(a, display_path(root + '-extra/tags.json', root))
        # Shared labels must never silently merge dictionary keys.
        with self.assertRaises(ValueError):
            display_metadata({root + '-extra/tags.json': 1, 'Q' + ':/other/tags.json': 2}, root)

    def test_user_profile_folder_name_is_never_published(self):
        root = 'Q' + ':/workspace/repo'
        profile = 'Q' + ':/' + 'Users/' + 'example'
        self.assertEqual(display_path(profile, root), 'external/user-profile')
        self.assertEqual(display_path(profile + '/Downloads/export.json', root), 'external/export.json')
        self.assertEqual(display_path('Q' + ':/', root), 'external/path')

    def test_symlink_escape_is_external(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'repo'; root.mkdir()
            outside = Path(tmp) / 'outside'; outside.mkdir()
            link = root / 'linked'
            try:
                link.symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest('Creating a symlink is unavailable on this host')
            self.assertTrue(display_path(link / 'tags.json', root).startswith('external/'))

    def test_interpreter_and_argument_boundaries(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            original = [sys.executable, str(root / 'tools with spaces' / 'build ä.py'), '--input', str(root / 'input folder')]
            saved = original.copy()
            shown = display_command(original, root)
            self.assertEqual(original, saved)
            self.assertEqual(len(shown), len(original))
            self.assertEqual(shown[0], Path(sys.executable).name.lower())
            self.assertEqual(shown[1], 'tools with spaces/build ä.py')
            self.assertEqual(shown[2:], ['--input', 'input folder'])

    def test_quoted_diagnostic_preserves_message(self):
        profile = 'Q' + ':/Users/' + 'example/Private folder/input ä.json'
        message = "Cannot read '" + profile + "': missing."
        expected = "Cannot read '" + display_path(profile) + "': missing."
        self.assertEqual(display_text(message), expected)

    def test_unquoted_diagnostic_preserves_suffix(self):
        profile = 'Q' + ':/Users/' + 'example/Private folder/input.json'
        self.assertEqual(display_text('Cannot read ' + profile + ' because missing'), 'Cannot read ' + display_path(profile) + ' because missing')

    def test_root_diagnostic_and_escaped_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'repo with spaces'; root.mkdir()
            message = "Missing '" + str(root / 'data/tags.json') + "': unavailable"
            shown = display_text(message, root)
            self.assertNotIn(str(root), shown)
            self.assertIn('tags.json', shown)
            self.assertTrue(shown.endswith(': unavailable'))
        profile = 'Q' + ':\\Users\\' + 'example\\Private folder\\input.json'
        shown = display_text(json.dumps({'path': profile}))
        self.assertIsInstance(json.loads(shown), dict)
        self.assertNotRegex(shown, r'[A-Za-z]:[\\/]+Users[\\/]')

    def test_metadata_copies_keys_values_and_preserves_scalar_data(self):
        root = 'Q' + ':/workspace/repo'
        data = {'sourceCounts': {root + '/data/tags.json': 0}, 'path': root + '/data/tags.json', 'enabled': False, 'chance': 0.5, 'description': 'Normal game AI targeting'}
        original = copy.deepcopy(data)
        shown = display_metadata(data, root)
        self.assertEqual(data, original)
        self.assertEqual(shown['sourceCounts'], {'data/tags.json': 0})
        self.assertEqual(shown['path'], 'data/tags.json')
        for key in ['enabled', 'chance', 'description']:
            self.assertEqual(shown[key], data[key])

    def test_key_collision_fails_without_losing_counts(self):
        root = 'Q' + ':/workspace/repo'
        with self.assertRaisesRegex(ValueError, 'collision'):
            display_metadata({root + '/data/../tags.json': 1, root + '/tags.json': 2}, root)

    def test_report_boundary_does_not_rewrite_raw_data(self):
        raw = {'path': 'Q' + ':/Users/' + 'example/input.json', '_build': {'sourceHash': 'unchanged'}}
        self.assertIs(display_report(raw, Path('entries/raw.json')), raw)
        shown = display_report(raw, Path('entries/reports/check.json'))
        self.assertEqual(shown['_build'], raw['_build'])
        self.assertNotEqual(shown['path'], raw['path'])

    def test_three_loaded_tag_sources_keep_counts_status_and_distinct_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            reports = []
            for name in ['primary/character_tags.json', 'additional/character_tags_additions.json', 'map/map_tags.json']:
                path = Path(tmp) / name; path.parent.mkdir(); path.write_text('[]', encoding='utf-8')
                value, report = runtime.load_json_checked(path)
                self.assertEqual(value, [])
                self.assertEqual((report['count'], report['status']), (0, 'ok'))
                reports.append(report)
            self.assertEqual(len({row['path'] for row in reports}), 3)
            self.assertTrue(all(row['path'].startswith('external/') for row in reports))
            self.assertEqual(len(runtime.distinct_source_counts(reports)), 3)
            # Two outside sources with the same filename share a label, so counting them must fail loudly.
            twin = Path(tmp) / 'twin' / 'character_tags.json'; twin.parent.mkdir(); twin.write_text('[]', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'collision'):
                runtime.distinct_source_counts(reports + [runtime.load_json_checked(twin)[1]])

    def test_actual_subprocess_argv_and_cwd_are_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            command = [sys.executable, str(root / 'tools with spaces' / 'runner.py'), '--flag']
            profile = 'Q' + ':/Users/' + 'example/Private folder/input.json'
            completed = SimpleNamespace(returncode=0, stdout="Missing '" + profile + "': unavailable", stderr='')
            with patch.object(control.subprocess, 'run', return_value=completed) as run, redirect_stdout(io.StringIO()):
                report = control.run_step(root, 'fixture', command)
            self.assertEqual(run.call_args.args[0], command)
            self.assertEqual(run.call_args.kwargs['cwd'], str(root))
            self.assertEqual(report['command'], display_command(command, root))
            self.assertNotRegex(report['stdoutTail'], r'[A-Za-z]:[\\/]+Users[\\/]')
            self.assertIn('unavailable', report['stdoutTail'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
