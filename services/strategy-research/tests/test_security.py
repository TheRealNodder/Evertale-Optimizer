import asyncio
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "app.py"
os.environ.setdefault("RESEARCH_DB", str(Path(tempfile.gettempdir()) / "evertale_strategy_research_tests.sqlite3"))
SPEC = importlib.util.spec_from_file_location("strategy_research_app", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


def write_bundle(folder: Path) -> Path:
    path = folder / "families.json"
    path.write_text(
        json.dumps(
            {
                "contentHash": "fixture-catalog-hash",
                "generatedAt": 123,
                "entries": [
                    {
                        "family": "AliceFire",
                        "name": "Alice",
                        "title": "Crimson Dream",
                        "states": [{"sourceId": "AliceFire01", "name": "Alice", "title": "Crimson Dream"}],
                    },
                    {
                        "family": "AliceDark",
                        "name": "Alice",
                        "title": "Midnight Dream",
                        "states": [{"sourceId": "AliceDark01", "name": "Alice", "title": "Midnight Dream"}],
                    },
                    {
                        "family": "LunaWater",
                        "name": "Luna",
                        "title": "Tide Caller",
                        "states": [{"sourceId": "LunaWater01", "name": "Luna", "title": "Tide Caller"}],
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    return path


def enabled_profile() -> dict:
    return {
        "id": "official-fixture",
        "name": "Official fixture",
        "seedUrl": "https://example.com/news",
        "sourceType": "official",
        "policyState": "enabled",
        "policyReason": "test",
        "allowedHosts": ["example.com"],
        "crawlMode": "seed-only",
        "maxPages": 1,
        "followKeywords": [],
        "confidence": 0.9,
    }


class SecurityTests(unittest.TestCase):
    def test_rejects_protocol_credentials_ports_and_unlisted_hosts(self):
        hosts = {"example.com"}
        for url in (
            "file:///etc/passwd",
            "http://user:pass@example.com",
            "https://example.com:8443",
            "https://evil.example",
        ):
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

    def test_registry_blocks_reddit_and_fandom_and_refuses_enabling_them(self):
        self.assertEqual(MODULE.REGISTRY["community-reddit"]["policyState"], "blocked")
        self.assertEqual(MODULE.REGISTRY["community-fandom"]["policyState"], "blocked")
        for host in ("www.reddit.com", "evertale.fandom.com"):
            raw = {
                "id": "bad-source",
                "seedUrl": f"https://{host}/page",
                "policyState": "enabled",
                "allowedHosts": [host],
            }
            with self.assertRaisesRegex(ValueError, "cannot enable"):
                MODULE._registry_row(raw)

    def test_enabled_sources_require_https_and_source_ids_are_bounded(self):
        raw = {
            "id": "official-insecure",
            "seedUrl": "http://example.com/news",
            "policyState": "enabled",
            "allowedHosts": ["example.com"],
        }
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            MODULE._registry_row(raw)
        self.assertTrue(MODULE.valid_source_id("a" * 64))
        self.assertFalse(MODULE.valid_source_id("a" * 65))
        self.assertFalse(MODULE.valid_source_id("ab"))
        self.assertEqual(
            [source_id for source_id, row in MODULE.REGISTRY.items() if row["policyState"] == "enabled"],
            ["official-google-play"],
        )

    def test_cors_is_limited_to_localhost_and_project_pages(self):
        values = MODULE.cors_origins("http://localhost:8787,https://therealnodder.github.io")
        self.assertIn("http://localhost:8787", values)
        self.assertIn("https://therealnodder.github.io", values)
        for origin in ("https://example.com", "https://therealnodder.github.io:444", "https://user@therealnodder.github.io"):
            with self.assertRaises(ValueError):
                MODULE.cors_origins(origin)

    def test_cache_round_trip(self):
        with tempfile.TemporaryDirectory() as folder:
            cache = MODULE.Cache(Path(folder) / "cache.sqlite3")
            record = {"sourceUrl": "https://example.com", "fetchedAt": 1, "contentHash": "a"}
            cache.put(record)
            self.assertEqual(cache.latest()[0]["contentHash"], "a")

    def test_identity_catalog_does_not_guess_ambiguous_display_name(self):
        with tempfile.TemporaryDirectory() as folder:
            catalog = MODULE.IdentityCatalog(write_bundle(Path(folder)))
            resolved, unresolved = catalog.mentions("Alice is useful in burn teams")
            self.assertEqual(resolved, [])
            self.assertEqual(unresolved[0]["mention"], "alice")
            self.assertEqual(unresolved[0]["candidateFamilies"], ["AliceDark", "AliceFire"])

    def test_claim_extraction_resolves_unique_unit_with_provenance(self):
        with tempfile.TemporaryDirectory() as folder:
            catalog = MODULE.IdentityCatalog(write_bundle(Path(folder)))
            body = b"<html><title>Strategy note</title><p>Luna is a strong Sleep guardian.</p><p>Alice works with Burn.</p></html>"
            record = MODULE.advisory_record(
                enabled_profile(),
                "https://example.com/news",
                body,
                "text/html",
                "https://example.com/news",
                catalog,
            )
            self.assertEqual(record["catalogHash"], "fixture-catalog-hash")
            self.assertEqual([row["family"] for row in record["observedUnits"]], ["LunaWater"])
            self.assertEqual(record["observedUnits"][0]["plans"], ["guardian", "sleep"])
            self.assertTrue(record["claims"][0]["provenance"]["sourceUrl"].startswith("https://example.com"))
            self.assertEqual(record["unresolvedMentions"][0]["mention"], "alice")

    def test_claim_extraction_binds_plans_to_their_sentence(self):
        with tempfile.TemporaryDirectory() as folder:
            catalog = MODULE.IdentityCatalog(write_bundle(Path(folder)))
            body = b"<html><p>Luna uses Sleep. Crimson Dream uses Burn.</p></html>"
            record = MODULE.advisory_record(
                enabled_profile(), "https://example.com/news", body, "text/html", "https://example.com/news", catalog
            )
            plans = {row["family"]: row["plans"] for row in record["observedUnits"]}
            self.assertEqual(plans["LunaWater"], ["sleep"])
            self.assertEqual(plans["LunaWater"], ["sleep"])
            self.assertEqual(plans["AliceFire"], ["burn"])
            claims = {(row["provenance"]["excerpt"], tuple(row["plans"])) for row in record["claims"]}
            self.assertIn(("Luna uses Sleep.", ("sleep",)), claims)
            self.assertIn(("Crimson Dream uses Burn.", ("burn",)), claims)

    def test_claim_amplification_and_serialized_records_are_bounded(self):
        with tempfile.TemporaryDirectory() as folder:
            catalog = MODULE.IdentityCatalog(write_bundle(Path(folder)))
            aliases = [f"ambiguous alias {index}" for index in range(MODULE.MAX_UNRESOLVED_PER_RECORD + 24)]
            for alias in aliases:
                catalog.aliases[alias] = ["AliceDark", "AliceFire"]
            catalog.ambiguous_aliases = aliases
            paragraphs = "".join(
                f"<p>Luna and {aliases[index % len(aliases)]} support Sleep guardian plan number {index}.</p>"
                for index in range(MODULE.MAX_CONTEXTS_PER_DOCUMENT * 3)
            )
            record = MODULE.advisory_record(
                enabled_profile(),
                "https://example.com/news",
                f"<html><title>Amplification fixture</title>{paragraphs}</html>".encode(),
                "text/html",
                "https://example.com/news",
                catalog,
            )
            self.assertLessEqual(len(record["claims"]), MODULE.MAX_CLAIMS_PER_RECORD)
            self.assertLessEqual(len(record["unresolvedMentions"]), MODULE.MAX_UNRESOLVED_PER_RECORD)
            self.assertLessEqual(len(record["observedUnits"]), MODULE.MAX_OBSERVED_UNITS_PER_RECORD)
            self.assertLessEqual(
                len(MODULE.serialize_record(record).encode("utf-8")), MODULE.MAX_SERIALIZED_RECORD_BYTES
            )
            self.assertEqual(
                len(MODULE.claim_contexts([f"Luna Sleep context {index}." for index in range(1000)])),
                MODULE.MAX_CONTEXTS_PER_DOCUMENT,
            )

    def test_plan_and_crawl_matching_stay_bounded(self):
        self.assertEqual(MODULE.plans_in("Frostburn support"), ["frostburn"])
        self.assertEqual(MODULE.plans_in("Burn and Stealth team"), ["burn", "stealth"])
        self.assertIsNone(
            MODULE.canonical_crawl_url("https://example.com/news", "https://evil.example/internal", {"example.com"})
        )
        self.assertEqual(
            MODULE.canonical_crawl_url(
                "https://example.com/news", "/updates?id=1&utm_source=test", {"example.com"}
            ),
            "https://example.com/updates?id=1",
        )

    def test_bounded_job_queue_and_policy_selected_sources(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            catalog = MODULE.IdentityCatalog(write_bundle(root))
            cache = MODULE.Cache(root / "cache.sqlite3")
            other = {**enabled_profile(), "id": "official-other", "name": "Other", "seedUrl": "https://example.com/other"}
            registry = {"official-fixture": enabled_profile(), "official-other": other}
            manager = MODULE.JobManager(
                cache,
                registry,
                catalog,
                queue_size=1,
                start_workers=False,
            )
            job = manager.create([])
            self.assertEqual(job["sourceIds"], ["official-fixture", "official-other"])
            coalesced = manager.create(["official-other", "official-fixture"])
            self.assertEqual(coalesced["jobId"], job["jobId"])
            self.assertTrue(coalesced["coalesced"])
            with self.assertRaises(MODULE.JobQueueFull):
                manager.create(["official-fixture"])
            with self.assertRaisesRegex(ValueError, "Invalid source"):
                manager.create(["https://example.com/arbitrary-url"])

    def test_fresh_cache_reuse_and_global_source_cooldown(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            catalog = MODULE.IdentityCatalog(write_bundle(root))
            cache = MODULE.Cache(root / "cache.sqlite3")
            allowed, retry = cache.begin_source_fetch("official-fixture", cooldown_seconds=60, now=100)
            self.assertTrue(allowed)
            self.assertEqual(retry, 0)
            allowed, retry = cache.begin_source_fetch("official-fixture", cooldown_seconds=60, now=101)
            self.assertFalse(allowed)
            self.assertEqual(retry, 59)

            calls = []

            def crawler(profile, current_catalog, _progress):
                calls.append(profile["id"])
                return [
                    MODULE.advisory_record(
                        profile,
                        profile["seedUrl"],
                        b"<p>Luna is useful in Sleep guardian teams.</p>",
                        "text/html",
                        profile["seedUrl"],
                        current_catalog,
                    )
                ], []

            manager = MODULE.JobManager(
                cache,
                {"official-fixture": enabled_profile()},
                catalog,
                queue_size=4,
                start_workers=False,
                crawler=crawler,
            )
            first = manager.create(["official-fixture"])
            manager.run(first["jobId"], first["sourceIds"])
            second = manager.create(["official-fixture"])
            manager.run(second["jobId"], second["sourceIds"])
            self.assertEqual(calls, ["official-fixture"])
            self.assertEqual(manager.get(second["jobId"])["stage"], "complete")

    def test_chunked_request_body_limit(self):
        async def exercise():
            sent = []
            messages = [
                {"type": "http.request", "body": b"1234", "more_body": True},
                {"type": "http.request", "body": b"5678", "more_body": False},
            ]

            async def receive():
                return messages.pop(0)

            async def send(message):
                sent.append(message)

            async def downstream(_scope, receive_body, send_response):
                while True:
                    message = await receive_body()
                    if not message.get("more_body"):
                        break
                await send_response({"type": "http.response.start", "status": 204, "headers": []})
                await send_response({"type": "http.response.body", "body": b""})

            middleware = MODULE.RequestBodyLimitMiddleware(downstream, max_bytes=6)
            await middleware({"type": "http", "headers": []}, receive, send)
            return sent

        sent = asyncio.run(exercise())
        self.assertEqual(sent[0]["status"], 413)

    def test_rate_limit(self):
        limiter = MODULE.RateLimiter(limit=2, window_seconds=60)
        self.assertTrue(limiter.allow("client"))
        self.assertTrue(limiter.allow("client"))
        self.assertFalse(limiter.allow("client"))


if __name__ == "__main__":
    unittest.main()
