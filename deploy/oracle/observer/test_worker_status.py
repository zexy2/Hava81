import unittest
from pathlib import Path


class WorkerStatusScriptTests(unittest.TestCase):
    def test_status_script_surfaces_browser_audit_state(self) -> None:
        status_script = Path(__file__).with_name('hava81-worker-status.py').read_text(encoding='utf-8')
        self.assertIn("host.get('browser_processes')", status_script)
        self.assertIn('browser_audits:', status_script)
        self.assertIn("browser_processes.get('stale_count')", status_script)
        self.assertIn("browser_processes.get('error')", status_script)

    def test_status_script_surfaces_merge_deploy_readiness(self) -> None:
        status_script = Path(__file__).with_name('hava81-worker-status.py').read_text(encoding='utf-8')
        self.assertIn("s.get('worker', {})", status_script)
        self.assertIn('merge_deploy_ready:', status_script)
        self.assertIn("worker.get('can_merge_or_deploy')", status_script)
        self.assertIn("worker.get('merge_deploy_blocking_reasons', [])", status_script)
        self.assertIn("worker.get('writes_repository')", status_script)

    def test_status_script_surfaces_api_build_disk_headroom(self) -> None:
        status_script = Path(__file__).with_name('hava81-worker-status.py').read_text(encoding='utf-8')
        self.assertIn("disk.get('api_build_headroom_ok')", status_script)
        self.assertIn("disk.get('bytes_to_free_for_api_build')", status_script)
        self.assertIn('api_build_headroom_ok=', status_script)
        self.assertIn('api_build_recovery_gib=', status_script)
        self.assertIn("disk.get('bytes_to_free_for_ok')", status_script)
        self.assertIn('recovery_mib=', status_script)

    def test_status_script_surfaces_codeql_gate_state(self) -> None:
        status_script = Path(__file__).with_name('hava81-worker-status.py').read_text(encoding='utf-8')
        self.assertIn("pr.get('codeql')", status_script)
        self.assertIn("codeql={codeql.get('status')}/{codeql.get('conclusion')}", status_script)
        self.assertIn("failed_jobs={ci.get('failed_jobs', [])}", status_script)


if __name__ == '__main__':
    unittest.main()
