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


if __name__ == '__main__':
    unittest.main()
