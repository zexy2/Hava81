#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

MODULE_PATH = Path(__file__).with_name('validate-api-readiness.py')
spec = importlib.util.spec_from_file_location('validate_api_readiness', MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(validator)


class ValidateApiReadinessTests(unittest.TestCase):
    def validate(self, *, status='ready', age_seconds=0, cache_control='no-store', cors=None, expected_origin=None, revision=None, expected_revision=None):  # noqa: ANN001, ANN201, E501
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            body = root / 'body.json'
            headers = root / 'headers.txt'
            timestamp = datetime.now(timezone.utc) - timedelta(seconds=age_seconds)
            payload = {'status': status, 'timestamp': timestamp.isoformat().replace('+00:00', 'Z')}
            if revision is not None:
                payload['revision'] = revision
            body.write_text(json.dumps(payload), encoding='utf-8')
            header_lines = ['HTTP/1.1 200 OK', f'Cache-Control: {cache_control}']
            if cors is not None:
                header_lines.append(f'Access-Control-Allow-Origin: {cors}')
            headers.write_text('\n'.join(header_lines) + '\n', encoding='utf-8')
            validator.validate(body, headers, expected_origin, expected_revision)

    def test_accepts_fresh_no_store_readiness(self) -> None:
        self.validate()

    def test_accepts_exact_production_cors(self) -> None:
        self.validate(cors='https://hava81.zekiakgul.dev', expected_origin='https://hava81.zekiakgul.dev')

    def test_rejects_non_ready_payload(self) -> None:
        with self.assertRaisesRegex(ValueError, 'status=ready'):
            self.validate(status='starting')

    def test_rejects_stale_payload(self) -> None:
        with self.assertRaisesRegex(ValueError, 'stale'):
            self.validate(age_seconds=validator.MAX_READY_AGE_SECONDS + 1)

    def test_rejects_material_future_timestamp(self) -> None:
        with self.assertRaisesRegex(ValueError, 'future'):
            self.validate(age_seconds=-(validator.MAX_FUTURE_SKEW_SECONDS + 1))

    def test_rejects_cacheable_health_response(self) -> None:
        with self.assertRaisesRegex(ValueError, 'no-store'):
            self.validate(cache_control='public, max-age=60')

    def test_accepts_matching_revision(self) -> None:
        self.validate(revision='abc123', expected_revision='abc123')

    def test_ignores_revision_when_not_expected(self) -> None:
        self.validate(revision='old')
        self.validate()

    def test_rejects_wrong_or_missing_revision(self) -> None:
        with self.assertRaisesRegex(ValueError, 'revision mismatch'):
            self.validate(revision='old', expected_revision='new')
        with self.assertRaisesRegex(ValueError, 'revision mismatch'):
            self.validate(expected_revision='new')

    def test_rejects_missing_or_wrong_public_cors(self) -> None:
        with self.assertRaisesRegex(ValueError, 'CORS mismatch'):
            self.validate(cors='*', expected_origin='https://hava81.zekiakgul.dev')


if __name__ == '__main__':
    unittest.main()
