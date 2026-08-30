from __future__ import annotations

import importlib.util
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

MODULE_PATH = Path(__file__).with_name('observer.py')
spec = importlib.util.spec_from_file_location('hava81_observer', MODULE_PATH)
assert spec and spec.loader
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)


class ObserverFreshnessTests(unittest.TestCase):
    def test_timestamp_age_accepts_current_and_rejects_invalid_values(self) -> None:
        age = observer.timestamp_age_seconds(observer.now_iso())
        self.assertIsNotNone(age)
        self.assertLessEqual(age, 1.0)
        self.assertIsNone(observer.timestamp_age_seconds('not-a-timestamp'))
        self.assertIsNone(observer.timestamp_age_seconds(None))

    def test_stale_readiness_payload_marks_production_unhealthy(self) -> None:
        original_http_get = observer.http_get
        original_nginx_target = observer.nginx_target

        def fake_http_get(url: str, *, headers=None, timeout=6.0):  # noqa: ANN001, ARG001
            if '/health/ready' in url:
                return {
                    'ok': True,
                    'status': 200,
                    'elapsed_ms': 1,
                    'headers': {
                        'access-control-allow-origin': 'https://hava81.zekiakgul.dev',
                        'cache-control': 'no-store',
                    },
                    'json': {
                        'status': 'ready',
                        'timestamp': '2000-01-01T00:00:00Z',
                        'provider': {'name': 'OpenWeather', 'state': 'closed'},
                    },
                    'error': None,
                }
            return {
                'ok': True,
                'status': 200,
                'elapsed_ms': 1,
                'headers': {},
                'json': None,
                'error': None,
            }

        try:
            observer.http_get = fake_http_get
            observer.nginx_target = lambda: {
                'port': 4002,
                'expected': 4002,
                'ok': True,
                'error': None,
            }
            production = observer.collect_production()
        finally:
            observer.http_get = original_http_get
            observer.nginx_target = original_nginx_target

        self.assertFalse(production['healthy'])
        self.assertFalse(production['checks']['api_ready_fresh'])
        self.assertTrue(production['checks']['api_ready_no_store'])
        self.assertIn('api_ready_fresh', production['issues'])

    def test_wildcard_cors_marks_production_unhealthy(self) -> None:
        original_http_get = observer.http_get
        original_nginx_target = observer.nginx_target

        def fake_http_get(url: str, *, headers=None, timeout=6.0):  # noqa: ANN001, ARG001
            if '/health/ready' in url:
                return {
                    'ok': True,
                    'status': 200,
                    'elapsed_ms': 1,
                    'headers': {
                        'access-control-allow-origin': '*',
                        'cache-control': 'no-store',
                    },
                    'json': {
                        'status': 'ready',
                        'timestamp': observer.now_iso(),
                        'provider': {'name': 'OpenWeather', 'state': 'closed'},
                    },
                    'error': None,
                }
            return {
                'ok': True,
                'status': 200,
                'elapsed_ms': 1,
                'headers': {},
                'json': None,
                'error': None,
            }

        try:
            observer.http_get = fake_http_get
            observer.nginx_target = lambda: {
                'port': 4002,
                'expected': 4002,
                'ok': True,
                'error': None,
            }
            production = observer.collect_production()
        finally:
            observer.http_get = original_http_get
            observer.nginx_target = original_nginx_target

        self.assertFalse(production['healthy'])
        self.assertFalse(production['checks']['cors_ok'])
        self.assertEqual(production['cors']['allow_origin'], '*')
        self.assertIn('cors_ok', production['issues'])

    def test_material_future_readiness_timestamp_marks_production_unhealthy(self) -> None:
        original_http_get = observer.http_get
        original_nginx_target = observer.nginx_target
        future_timestamp = (
            datetime.now(timezone.utc)
            + timedelta(seconds=observer.MAX_FUTURE_SKEW_SECONDS + 5)
        ).isoformat().replace('+00:00', 'Z')

        def fake_http_get(url: str, *, headers=None, timeout=6.0):  # noqa: ANN001, ARG001
            if '/health/ready' in url:
                return {
                    'ok': True,
                    'status': 200,
                    'elapsed_ms': 1,
                    'headers': {
                        'access-control-allow-origin': 'https://hava81.zekiakgul.dev',
                        'cache-control': 'no-store',
                    },
                    'json': {
                        'status': 'ready',
                        'timestamp': future_timestamp,
                        'provider': {'name': 'OpenWeather', 'state': 'closed'},
                    },
                    'error': None,
                }
            return {
                'ok': True,
                'status': 200,
                'elapsed_ms': 1,
                'headers': {},
                'json': None,
                'error': None,
            }

        try:
            observer.http_get = fake_http_get
            observer.nginx_target = lambda: {
                'port': 4002,
                'expected': 4002,
                'ok': True,
                'error': None,
            }
            production = observer.collect_production()
        finally:
            observer.http_get = original_http_get
            observer.nginx_target = original_nginx_target

        self.assertFalse(production['healthy'])
        self.assertFalse(production['checks']['api_ready_fresh'])
        self.assertLess(production['api_ready']['age_seconds'], -observer.MAX_FUTURE_SKEW_SECONDS)
        self.assertIn('api_ready_fresh', production['issues'])


class ObserverNginxTargetTests(unittest.TestCase):
    def test_follows_validated_blue_green_state_port(self) -> None:
        original_site = observer.NGINX_SITE
        original_port_file = observer.CURRENT_API_PORT_FILE
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            site = root / 'api.conf'
            port_file = root / 'current-api-port'
            site.write_text('proxy_pass http://127.0.0.1:4001;\n', encoding='utf-8')
            port_file.write_text('4001\n', encoding='utf-8')
            try:
                observer.NGINX_SITE = site
                observer.CURRENT_API_PORT_FILE = port_file
                target = observer.nginx_target()
            finally:
                observer.NGINX_SITE = original_site
                observer.CURRENT_API_PORT_FILE = original_port_file

        self.assertEqual(target['port'], 4001)
        self.assertEqual(target['expected'], 4001)
        self.assertTrue(target['ok'])
        self.assertIsNone(target['error'])

    def test_falls_back_to_legacy_port_when_state_file_is_absent(self) -> None:
        original_site = observer.NGINX_SITE
        original_port_file = observer.CURRENT_API_PORT_FILE
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            site = root / 'api.conf'
            site.write_text('proxy_pass http://127.0.0.1:4002;\n', encoding='utf-8')
            try:
                observer.NGINX_SITE = site
                observer.CURRENT_API_PORT_FILE = root / 'missing-current-api-port'
                target = observer.nginx_target()
            finally:
                observer.NGINX_SITE = original_site
                observer.CURRENT_API_PORT_FILE = original_port_file

        self.assertEqual(target['expected'], observer.DEFAULT_API_PORT)
        self.assertTrue(target['ok'])

    def test_rejects_invalid_state_port_instead_of_masking_it(self) -> None:
        original_site = observer.NGINX_SITE
        original_port_file = observer.CURRENT_API_PORT_FILE
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            site = root / 'api.conf'
            port_file = root / 'current-api-port'
            site.write_text('proxy_pass http://127.0.0.1:4001;\n', encoding='utf-8')
            port_file.write_text('4999\n', encoding='utf-8')
            try:
                observer.NGINX_SITE = site
                observer.CURRENT_API_PORT_FILE = port_file
                target = observer.nginx_target()
            finally:
                observer.NGINX_SITE = original_site
                observer.CURRENT_API_PORT_FILE = original_port_file

        self.assertFalse(target['ok'])
        self.assertIn('unsupported API port', target['error'])


class ObserverApiDeploymentTests(unittest.TestCase):
    def _collect(
        self,
        *,
        deployed_revision: str | None = 'deployed-revision',
        main_revision: str = 'main-revision',
        compare_status: str = 'ahead',
        changed_files: list[str] | None = None,
        compare_ok: bool = True,
    ):  # noqa: ANN201
        original_http_get = observer.http_get
        original_tree_file = observer.DEPLOYED_API_TREE_FILE
        original_revision_file = observer.DEPLOYED_API_REVISION_FILE
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            tree_file = root / 'current-api-tree'
            revision_file = root / 'current-api-revision'
            tree_file.write_text('deployed-api-tree\n', encoding='utf-8')
            if deployed_revision is not None:
                revision_file.write_text(f'{deployed_revision}\n', encoding='utf-8')

            def fake_http_get(url: str, *, headers=None, timeout=6.0):  # noqa: ANN001, ARG001
                if '/compare/' in url:
                    return {
                        'ok': compare_ok,
                        'status': 200 if compare_ok else 503,
                        'elapsed_ms': 1,
                        'headers': {},
                        'json': (
                            {
                                'status': compare_status,
                                'files': [
                                    {'filename': filename}
                                    for filename in (changed_files or [])
                                ],
                            }
                            if compare_ok
                            else None
                        ),
                        'error': None if compare_ok else 'HTTP 503',
                    }
                raise AssertionError(f'unexpected GitHub lookup: {url}')

            try:
                observer.http_get = fake_http_get
                observer.DEPLOYED_API_TREE_FILE = tree_file
                observer.DEPLOYED_API_REVISION_FILE = revision_file
                return observer.collect_api_deployment({'head_sha': main_revision})
            finally:
                observer.http_get = original_http_get
                observer.DEPLOYED_API_TREE_FILE = original_tree_file
                observer.DEPLOYED_API_REVISION_FILE = original_revision_file

    def test_reports_identical_deployed_revision_as_current_without_lookup(self) -> None:
        deployment = self._collect(
            deployed_revision='same-revision',
            main_revision='same-revision',
        )
        self.assertTrue(deployment['known'])
        self.assertFalse(deployment['pending'])
        self.assertEqual(deployment['runtime_changed_files'], [])

    def test_ignores_test_only_api_tree_drift(self) -> None:
        deployment = self._collect(changed_files=['apps/api/test/app.test.ts'])
        self.assertTrue(deployment['known'])
        self.assertFalse(deployment['pending'])
        self.assertEqual(deployment['runtime_changed_files'], [])
        self.assertIsNone(deployment['main_tree'])

    def test_reports_runtime_source_drift_as_pending(self) -> None:
        deployment = self._collect(
            changed_files=['apps/api/src/app.ts', 'apps/api/test/app.test.ts']
        )
        self.assertTrue(deployment['known'])
        self.assertTrue(deployment['pending'])
        self.assertEqual(deployment['runtime_changed_files'], ['apps/api/src/app.ts'])
        self.assertEqual(deployment['deployed_tree'], 'deployed-api-tree')
        self.assertIsNone(deployment['main_tree'])

    def test_reports_api_build_and_compose_inputs_as_runtime_drift(self) -> None:
        deployment = self._collect(
            changed_files=[
                'apps/api/Dockerfile',
                'apps/api/package-lock.json',
                'deploy/oracle/docker-compose.yml',
                'docs/AUTONOMOUS_PROGRESS.md',
            ]
        )
        self.assertTrue(deployment['known'])
        self.assertTrue(deployment['pending'])
        self.assertEqual(
            deployment['runtime_changed_files'],
            [
                'apps/api/Dockerfile',
                'apps/api/package-lock.json',
                'deploy/oracle/docker-compose.yml',
            ],
        )

    def test_reports_missing_deploy_revision_as_unknown_not_pending(self) -> None:
        deployment = self._collect(deployed_revision=None)
        self.assertFalse(deployment['known'])
        self.assertFalse(deployment['pending'])
        self.assertIn('revision marker is missing', deployment['error'])

    def test_reports_failed_compare_as_unknown_not_pending(self) -> None:
        deployment = self._collect(compare_ok=False)
        self.assertFalse(deployment['known'])
        self.assertFalse(deployment['pending'])
        self.assertEqual(deployment['error'], 'HTTP 503')

    def test_reports_non_ancestor_deployment_as_unknown(self) -> None:
        deployment = self._collect(compare_status='diverged', changed_files=['apps/api/src/app.ts'])
        self.assertFalse(deployment['known'])
        self.assertFalse(deployment['pending'])
        self.assertIn('not an ancestor', deployment['error'])

    def test_fails_unknown_when_compare_file_list_may_be_truncated(self) -> None:
        deployment = self._collect(
            changed_files=[f'docs/generated-{index}.md' for index in range(observer.GITHUB_COMPARE_FILE_LIMIT)]
        )
        self.assertFalse(deployment['known'])
        self.assertFalse(deployment['pending'])
        self.assertIn('maximum file count', deployment['error'])



class ObserverStateSignatureTests(unittest.TestCase):
    def test_api_lookup_latency_does_not_create_a_change_event(self) -> None:
        base_deployment = {
            'main_revision': 'main-sha',
            'main_tree': 'api-tree',
            'deployed_revision': 'deployed-sha',
            'deployed_tree': 'api-tree',
            'known': True,
            'pending': False,
            'error': None,
        }
        first = {
            'github': {
                'open_automation_prs': [],
                'latest_main_run': {'head_sha': 'main-sha', 'status': 'completed'},
                'api_deployment': {
                    **base_deployment,
                    'lookup': {'ok': True, 'status': 200, 'elapsed_ms': 309, 'error': None},
                },
            },
            'production': {'healthy': True, 'issues': [], 'nginx': {'port': 4002}},
            'host': {'disk': {'ok': True}},
        }
        second = {
            **first,
            'github': {
                **first['github'],
                'api_deployment': {
                    **base_deployment,
                    'lookup': {'ok': True, 'status': 200, 'elapsed_ms': 72, 'error': None},
                },
            },
        }

        self.assertEqual(observer.state_signature(first), observer.state_signature(second))

    def test_api_tree_change_remains_part_of_the_change_signature(self) -> None:
        base = {
            'github': {
                'open_automation_prs': [],
                'latest_main_run': {'head_sha': 'main-sha', 'status': 'completed'},
                'api_deployment': {
                    'main_revision': 'main-sha',
                    'main_tree': 'api-tree-a',
                    'deployed_revision': 'deployed-sha',
                    'deployed_tree': 'api-tree-a',
                    'known': True,
                    'pending': False,
                    'error': None,
                },
            },
            'production': {'healthy': True, 'issues': [], 'nginx': {'port': 4002}},
            'host': {'disk': {'ok': True}},
        }
        changed = {
            **base,
            'github': {
                **base['github'],
                'api_deployment': {
                    **base['github']['api_deployment'],
                    'main_tree': 'api-tree-b',
                    'pending': True,
                },
            },
        }

        self.assertNotEqual(observer.state_signature(base), observer.state_signature(changed))


class ObserverHostDiskTests(unittest.TestCase):
    class _Statvfs:
        f_frsize = 4096
        f_blocks = 10_000_000

        def __init__(self, available_blocks: int) -> None:
            self.f_bavail = available_blocks

    def _collect_with_available_blocks(self, available_blocks: int):  # noqa: ANN201
        original_statvfs = observer.os.statvfs
        try:
            observer.os.statvfs = lambda _path: self._Statvfs(available_blocks)
            return observer.collect_host()
        finally:
            observer.os.statvfs = original_statvfs

    def test_high_disk_percentage_is_unhealthy_even_above_absolute_free_floor(self) -> None:
        host = self._collect_with_available_blocks(750_000)  # ~3.1 GB free, 92.5% used
        self.assertGreater(host['disk']['free_bytes'], observer.MINIMUM_ROOT_FREE_BYTES)
        self.assertFalse(host['disk']['usage_ok'])
        self.assertFalse(host['healthy'])
        self.assertIn('root_disk_pressure', host['issues'])
        self.assertNotIn('root_disk_low', host['issues'])

    def test_usage_threshold_is_inclusive_and_not_decided_from_rounded_display(self) -> None:
        exact_threshold = self._collect_with_available_blocks(800_000)  # exactly 92.0% used
        rounded_up = self._collect_with_available_blocks(805_000)  # 91.95% used, displayed as 92.0%

        self.assertEqual(exact_threshold['disk']['used_percent'], 92.0)
        self.assertTrue(exact_threshold['disk']['usage_ok'])
        self.assertTrue(exact_threshold['healthy'])
        self.assertEqual(rounded_up['disk']['used_percent'], 92.0)
        self.assertTrue(rounded_up['disk']['usage_ok'])
        self.assertTrue(rounded_up['healthy'])

    def test_healthy_disk_must_pass_both_free_space_guards(self) -> None:
        host = self._collect_with_available_blocks(1_500_000)  # ~6.1 GB free, 85% used
        self.assertTrue(host['disk']['free_ok'])
        self.assertTrue(host['disk']['usage_ok'])
        self.assertTrue(host['healthy'])
        self.assertEqual(host['issues'], [])


if __name__ == '__main__':
    unittest.main()
