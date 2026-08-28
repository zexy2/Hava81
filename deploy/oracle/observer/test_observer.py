from __future__ import annotations

import importlib.util
import unittest
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

    def test_healthy_disk_must_pass_both_free_space_guards(self) -> None:
        host = self._collect_with_available_blocks(1_500_000)  # ~6.1 GB free, 85% used
        self.assertTrue(host['disk']['free_ok'])
        self.assertTrue(host['disk']['usage_ok'])
        self.assertTrue(host['healthy'])
        self.assertEqual(host['issues'], [])


if __name__ == '__main__':
    unittest.main()
