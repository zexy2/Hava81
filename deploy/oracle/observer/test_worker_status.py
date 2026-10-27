import importlib.util
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path
from unittest.mock import patch

STATUS_PATH = Path(__file__).with_name('hava81-worker-status.py')
SPEC = importlib.util.spec_from_file_location('hava81_worker_status', STATUS_PATH)
assert SPEC and SPEC.loader
status = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(status)


class WorkerStatusScriptTests(unittest.TestCase):
    def test_status_script_surfaces_snapshot_freshness(self) -> None:
        status_script = STATUS_PATH.read_text(encoding='utf-8')
        self.assertIn('snapshot_freshness:', status_script)
        self.assertIn('readiness_schema:', status_script)
        self.assertIn('legacy_or_incomplete', status_script)
        self.assertIn('MAX_STATE_AGE_SECONDS = 10 * 60', status_script)
        self.assertIn("freshness['reason']", status_script)
        self.assertIn("frontend_revision.get('english_city')", status_script)
        self.assertIn("boot_assets.get('english_city_count')", status_script)

    def test_readiness_schema_flags_legacy_snapshots_without_scoped_gates(self) -> None:
        legacy = status.readiness_schema({'can_merge_or_deploy': False})
        self.assertFalse(legacy['current'])
        self.assertIn('can_merge', legacy['missing_fields'])
        self.assertIn('can_deploy_frontend', legacy['missing_fields'])
        self.assertIn('can_deploy_api', legacy['missing_fields'])

        current = status.readiness_schema({field: [] for field in status.READINESS_FIELDS})
        self.assertTrue(current['current'])
        self.assertEqual(current['missing_fields'], [])

    def test_main_prints_readiness_schema_warning_for_legacy_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / 'state.json'
            state_path.write_text(
                json.dumps({
                    'collected_at': datetime.now(timezone.utc).isoformat(),
                    'worker': {'can_merge_or_deploy': False},
                }),
                encoding='utf-8',
            )
            output = StringIO()
            with patch.object(status, 'STATE_FILE', state_path), redirect_stdout(output):
                exit_code = status.main()

        self.assertEqual(exit_code, 0)
        self.assertIn('readiness_schema: state=legacy_or_incomplete', output.getvalue())
        self.assertIn('can_deploy_api', output.getvalue())

    def test_main_prints_snapshot_age_and_freshness(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / 'state.json'
            state_path.write_text(
                json.dumps({'collected_at': datetime.now(timezone.utc).isoformat()}),
                encoding='utf-8',
            )
            output = StringIO()
            with patch.object(status, 'STATE_FILE', state_path), redirect_stdout(output):
                exit_code = status.main()
        self.assertEqual(exit_code, 0)
        self.assertIn('collected_at:', output.getvalue())
        self.assertIn('snapshot_freshness: fresh=True', output.getvalue())
        self.assertIn('max_age_s=600', output.getvalue())

    def test_main_prints_github_rate_limit_recovery_hint(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / 'state.json'
            state_path.write_text(
                json.dumps({
                    'collected_at': datetime.now(timezone.utc).isoformat(),
                    'github': {
                        'auth_mode': 'anonymous',
                        'rate_limit_remaining': '0',
                        'rate_limit_reset': '1793061868',
                        'error': 'GitHub API rate limit exhausted',
                    },
                }),
                encoding='utf-8',
            )
            output = StringIO()
            with patch.object(status, 'STATE_FILE', state_path), redirect_stdout(output):
                exit_code = status.main()

        self.assertEqual(exit_code, 0)
        self.assertIn('github_api: auth_mode=anonymous rate_limit_remaining=0 reset_epoch=1793061868', output.getvalue())
        self.assertIn('github_api_action: configure the documented repository-scoped read-only token', output.getvalue())
        self.assertNotIn('token=', output.getvalue())

    def test_status_distinguishes_process_host_from_snapshot_disk_host(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / 'state.json'
            state_path.write_text(
                json.dumps({
                    'collected_at': datetime.now(timezone.utc).isoformat(),
                    'host': {'hostname': 'snapshot-node', 'disk': {}},
                }),
                encoding='utf-8',
            )
            output = StringIO()
            with (
                patch.object(status, 'STATE_FILE', state_path),
                patch.object(status.socket, 'gethostname', return_value='status-node'),
                redirect_stdout(output),
            ):
                exit_code = status.main()

        self.assertEqual(exit_code, 0)
        self.assertIn('status_process_host: hostname=status-node', output.getvalue())
        self.assertIn(
            'observer_host: snapshot_hostname=snapshot-node disk_scope=observer-host-local',
            output.getvalue(),
        )

    def test_recent_snapshot_is_fresh(self) -> None:
        now = datetime(2026, 10, 25, 4, 47, tzinfo=timezone.utc)
        collected_at = (now - timedelta(minutes=5)).isoformat().replace('+00:00', 'Z')
        result = status.snapshot_freshness(collected_at, now=now)
        self.assertEqual(result, {'fresh': True, 'age_seconds': 300.0, 'reason': 'fresh'})

    def test_snapshot_older_than_two_observer_intervals_is_stale(self) -> None:
        now = datetime(2026, 10, 25, 4, 47, tzinfo=timezone.utc)
        collected_at = (now - timedelta(seconds=status.MAX_STATE_AGE_SECONDS + 1)).isoformat()
        result = status.snapshot_freshness(collected_at, now=now)
        self.assertFalse(result['fresh'])
        self.assertEqual(result['reason'], 'stale')
        self.assertEqual(result['age_seconds'], 601.0)

    def test_material_future_timestamp_is_not_fresh(self) -> None:
        now = datetime(2026, 10, 25, 4, 47, tzinfo=timezone.utc)
        collected_at = (now + timedelta(seconds=status.MAX_FUTURE_SKEW_SECONDS + 1)).isoformat()
        result = status.snapshot_freshness(collected_at, now=now)
        self.assertFalse(result['fresh'])
        self.assertEqual(result['reason'], 'future_timestamp')

    def test_missing_or_invalid_timestamp_is_unknown_and_not_fresh(self) -> None:
        for value in (None, '', 'not-a-time'):
            with self.subTest(value=value):
                result = status.snapshot_freshness(value)
                self.assertFalse(result['fresh'])
                self.assertIsNone(result['age_seconds'])
                self.assertEqual(result['reason'], 'missing_or_invalid_timestamp')

    def test_status_script_surfaces_browser_audit_state(self) -> None:
        status_script = STATUS_PATH.read_text(encoding='utf-8')
        self.assertIn("host.get('browser_processes')", status_script)
        self.assertIn('browser_audits:', status_script)
        self.assertIn("browser_processes.get('stale_count')", status_script)
        self.assertIn("browser_processes.get('error')", status_script)

    def test_status_script_surfaces_merge_deploy_readiness(self) -> None:
        status_script = STATUS_PATH.read_text(encoding='utf-8')
        self.assertIn("s.get('worker', {})", status_script)
        self.assertIn('merge_ready:', status_script)
        self.assertIn("worker.get('can_merge')", status_script)
        self.assertIn('frontend_deploy_ready:', status_script)
        self.assertIn("worker.get('can_deploy_frontend')", status_script)
        self.assertIn('api_deploy_ready:', status_script)
        self.assertIn("worker.get('can_deploy_api')", status_script)
        self.assertIn('merge_candidates:', status_script)
        self.assertIn("sig.get('ci_merge_candidates', [])", status_script)
        self.assertIn('merge_deploy_ready:', status_script)
        self.assertIn("worker.get('can_merge_or_deploy')", status_script)
        self.assertIn("worker.get('merge_deploy_blocking_reasons', [])", status_script)
        self.assertIn("worker.get('writes_repository')", status_script)

    def test_status_script_surfaces_api_build_disk_headroom(self) -> None:
        status_script = STATUS_PATH.read_text(encoding='utf-8')
        self.assertIn("disk.get('api_build_headroom_ok')", status_script)
        self.assertIn("disk.get('bytes_to_free_for_api_build')", status_script)
        self.assertIn('api_build_headroom_ok=', status_script)
        self.assertIn('api_build_recovery_gib=', status_script)
        self.assertIn("disk.get('bytes_to_free_for_ok')", status_script)
        self.assertIn('recovery_mib=', status_script)

    def test_status_script_distinguishes_current_main_head_from_latest_ci_run(self) -> None:
        status_script = STATUS_PATH.read_text(encoding='utf-8')
        self.assertIn("gh.get('main_branch')", status_script)
        self.assertIn("gh.get('main_pipeline')", status_script)
        self.assertIn('main_ci_current:', status_script)
        self.assertIn('main_ci_latest:', status_script)
        self.assertIn("sig.get('main_pipeline_pending')", status_script)

    def test_status_script_surfaces_codeql_gate_state(self) -> None:
        status_script = STATUS_PATH.read_text(encoding='utf-8')
        self.assertIn("pr.get('codeql')", status_script)
        self.assertIn("codeql={codeql.get('status')}/{codeql.get('conclusion')}", status_script)
        self.assertIn("failed_jobs={ci.get('failed_jobs', [])}", status_script)

    def test_status_script_surfaces_ops_contract_gate_state(self) -> None:
        status_script = STATUS_PATH.read_text(encoding='utf-8')
        self.assertIn("pr.get('ops')", status_script)
        self.assertIn("ops={ops.get('status')}/{ops.get('conclusion')}", status_script)


if __name__ == '__main__':
    unittest.main()
