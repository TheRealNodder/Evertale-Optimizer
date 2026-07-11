import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "app.py"
SPEC = importlib.util.spec_from_file_location("strategy_research_app", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class SecurityTests(unittest.TestCase):
    def test_rejects_protocol_credentials_ports_and_unlisted_hosts(self):
        hosts = {"example.com"}
        for url in ("file:///etc/passwd", "http://user:pass@example.com", "https://example.com:8443", "https://evil.example"):
            with self.assertRaises(ValueError):
                MODULE.validate_url_syntax(url, hosts)

    def test_rejects_private_and_metadata_addresses(self):
        def resolver(host, *_args, **_kwargs):
            address = "169.254.169.254" if host == "metadata" else "127.0.0.1"
            return [(2, 1, 6, "", (address, 0))]

        for host in ("metadata", "localhost"):
            with self.assertRaises(ValueError):
                MODULE.validate_resolved_addresses(host, resolver)

    def test_accepts_public_resolved_address(self):
        resolver = lambda *_args, **_kwargs: [(2, 1, 6, "", ("93.184.216.34", 0))]
        self.assertEqual(MODULE.validate_resolved_addresses("example.com", resolver), ["93.184.216.34"])

    def test_cache_round_trip(self):
        with tempfile.TemporaryDirectory() as folder:
            cache = MODULE.Cache(Path(folder) / "cache.sqlite3")
            record = {"sourceUrl": "https://example.com", "fetchedAt": 1, "contentHash": "a"}
            cache.put(record)
            self.assertEqual(cache.latest()[0]["contentHash"], "a")

    def test_rate_limit(self):
        limiter = MODULE.RateLimiter(limit=2, window_seconds=60)
        self.assertTrue(limiter.allow("client"))
        self.assertTrue(limiter.allow("client"))
        self.assertFalse(limiter.allow("client"))


if __name__ == "__main__":
    unittest.main()
