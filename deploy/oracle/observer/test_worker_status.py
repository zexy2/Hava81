import unittest
from pathlib import Path


class WorkerStatusScriptTests(unittest.TestCase):
    def test_status_script_surfaces_browser_audit_state(self) -> None:
        status_script = Path(__file__).with_name('hava81-worker-status.py').read_text(encoding='utf-8')
        self.assertIn("host.get('browser_processes')", status_script)
        self.assertIn('browser_audits:', status_script)
        self.assertIn("browser_processes.get('stale_count')", status_script)
        self.assertIn("browser_processes.get('error')", status_script)


if __name__ == '__main__':
    unittest.main()
