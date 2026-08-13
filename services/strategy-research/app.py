"""Advisory-only, policy-bound strategy research API.

The deterministic optimizer never depends on this service.  This process may
fetch only sources present in its server-owned registry, resolves unit mentions
against the generated character-family bundle, and emits provenance-preserving
observations that a user may opt into as a bounded meta prior.
"""
from __future__ import annotations

import hashlib
import html
import ipaddress
import json
import os
import queue
import re
import socket
import sqlite3
import threading
import time
import uuid
from collections import defaultdict, deque
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError
from urllib.parse import urldefrag, urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
FETCH_TIMEOUT_SECONDS = 10
MAX_REDIRECTS = 4
MAX_SOURCES_PER_JOB = 8
MAX_SOURCE_ID_LENGTH = 64
MAX_SOURCE_URL_CHARS = 2048
MAX_ALLOWED_HOSTS_PER_SOURCE = 16
MAX_CONTEXTS_PER_DOCUMENT = 128
MAX_CLAIMS_PER_RECORD = 96
MAX_UNRESOLVED_PER_RECORD = 48
MAX_OBSERVED_UNITS_PER_RECORD = 64
MAX_RECORDS_PER_JOB = 16
MAX_CACHED_RECORDS = 50
MAX_SERIALIZED_RECORD_BYTES = 256 * 1024
MAX_LATEST_PAYLOAD_BYTES = 2 * 1024 * 1024
MAX_JOB_RESULT_BYTES = 2 * 1024 * 1024
ALLOWED_CONTENT_TYPES = ("text/html", "text/plain", "application/json")
SOURCE_POLICY_STATES = {"enabled", "disabled", "blocked"}
FORBIDDEN_AUTOMATED_HOST_SUFFIXES = ("reddit.com", "fandom.com")
DEFAULT_SOURCE_REGISTRY = Path(__file__).with_name("sources.json")
DEFAULT_FAMILY_BUNDLE = (
    Path(__file__).resolve().parents[2]
    / "apkfiles"
    / "entries"
    / "bundles"
    / "character_families.bundle.json"
)
DEFAULT_DB = (
    Path(os.getenv("LOCALAPPDATA", Path.home() / ".local" / "share"))
    / "EvertaleOptimizer"
    / "strategy-research.sqlite3"
)
DEFAULT_CORS_ORIGINS = {
    "http://127.0.0.1:4173",
    "http://localhost:4173",
    "https://therealnodder.github.io",
}

PLAN_PATTERNS: dict[str, tuple[str, ...]] = {
    "burn": (r"\bburn(?:ing|ed|s)?\b",),
    "frostburn": (r"\bfrost[ -]?burn\b",),
    "poison": (r"\bpoison(?:ed|ing|s)?\b",),
    "sleep": (r"\bsleep(?:ing)?\b", r"\bputs? .{0,24}\bto sleep\b"),
    "stun": (r"\bstun(?:ned|ning|s)?\b",),
    "blood": (r"\bblood(?:shot|nova|pool)?\b", r"\bmori\b"),
    "crisis": (r"\bcrisis\b", r"\blow spirit\b"),
    "survivor": (r"\bsurvivor(?:'s)?\b", r"\bsurvival\b"),
    "guardian": (r"\bguardian(?:s)?\b", r"\bguard(?:ing|ed|s)?\b"),
    "tempo": (r"\btempo\b", r"\bturn order\b", r"\btime units?\b", r"\btu\b"),
    "stealth": (r"\bstealth\b",),
    "counter": (r"\bcounter(?:attack| stance|ed|ing|s)?\b",),
}
COMPILED_PLAN_PATTERNS = {
    plan: tuple(re.compile(pattern, re.IGNORECASE) for pattern in patterns)
    for plan, patterns in PLAN_PATTERNS.items()
}


def env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(maximum, value))


MAX_REQUEST_BODY_BYTES = env_int("RESEARCH_MAX_REQUEST_BODY_BYTES", 16 * 1024, 1024, 64 * 1024)
SOURCE_FETCH_COOLDOWN_SECONDS = env_int("RESEARCH_SOURCE_COOLDOWN_SECONDS", 300, 30, 24 * 60 * 60)


def normalize_host(host: str) -> str:
    return host.strip().lower().rstrip(".")


def host_is_forbidden(host: str) -> bool:
    value = normalize_host(host)
    return any(value == suffix or value.endswith("." + suffix) for suffix in FORBIDDEN_AUTOMATED_HOST_SUFFIXES)


def valid_source_id(value: Any) -> bool:
    source_id = str(value or "").strip()
    return bool(
        len(source_id) <= MAX_SOURCE_ID_LENGTH
        and re.fullmatch(r"[a-z0-9][a-z0-9-]{2,63}", source_id)
    )


def validate_url_syntax(url: str, hosts: set[str], *, require_https: bool = False) -> tuple[str, str]:
    if len(str(url or "")) > MAX_SOURCE_URL_CHARS:
        raise ValueError("Source URL exceeds length limit")
    parsed = urlsplit(url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http and https sources are supported")
    if require_https and parsed.scheme != "https":
        raise ValueError("Enabled research sources must use HTTPS")
    if parsed.username or parsed.password:
        raise ValueError("Credentials in source URLs are forbidden")
    hostname = normalize_host(parsed.hostname or "")
    allowed = {normalize_host(item) for item in hosts}
    if not hostname or hostname not in allowed:
        raise ValueError(f"Source host is not enabled by its policy profile: {hostname or '(missing)'}")
    if parsed.port not in {None, 80, 443}:
        raise ValueError("Only standard HTTP(S) ports are supported")
    clean, _fragment = urldefrag(parsed.geturl())
    return clean, hostname


def validate_resolved_addresses(hostname: str, resolver=socket.getaddrinfo) -> list[str]:
    addresses = sorted({row[4][0] for row in resolver(hostname, None, type=socket.SOCK_STREAM)})
    if not addresses:
        raise ValueError("Source host did not resolve")
    for value in addresses:
        ip = ipaddress.ip_address(value.split("%")[0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValueError(f"Source resolves to a forbidden address: {ip}")
    return addresses


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def fetch_public(url: str, hosts: set[str]) -> tuple[bytes, str, str]:
    current, hostname = validate_url_syntax(url, hosts, require_https=True)
    opener = build_opener(NoRedirect)
    for _ in range(MAX_REDIRECTS + 1):
        validate_resolved_addresses(hostname)
        request = Request(
            current,
            headers={
                "User-Agent": "EvertaleOptimizerStrategyResearch/2.0 (+advisory-only)",
                "Accept": "text/html,text/plain,application/json;q=0.9",
            },
        )
        try:
            response = opener.open(request, timeout=FETCH_TIMEOUT_SECONDS)
        except HTTPError as exc:
            if exc.code not in {301, 302, 303, 307, 308}:
                raise
            location = exc.headers.get("Location")
            if not location:
                raise ValueError("Redirect response omitted Location") from exc
            current, hostname = validate_url_syntax(urljoin(current, location), hosts, require_https=True)
            continue
        content_type = response.headers.get_content_type().lower()
        if not any(content_type.startswith(item) for item in ALLOWED_CONTENT_TYPES):
            raise ValueError(f"Unsupported response content type: {content_type}")
        advertised = int(response.headers.get("Content-Length") or 0)
        if advertised > MAX_RESPONSE_BYTES:
            raise ValueError("Response exceeds size limit")
        body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ValueError("Response exceeds size limit")
        return body, content_type, current
    raise ValueError("Too many redirects")


def _registry_row(raw: dict[str, Any]) -> dict[str, Any]:
    source_id = str(raw.get("id") or "").strip()
    if not valid_source_id(source_id):
        raise ValueError(f"Invalid source id: {source_id or '(missing)'}")
    state = str(raw.get("policyState") or "disabled").strip().lower()
    if state not in SOURCE_POLICY_STATES:
        raise ValueError(f"Invalid policy state for {source_id}: {state}")
    seed_url = str(raw.get("seedUrl") or "").strip()
    parsed = urlsplit(seed_url)
    seed_host = normalize_host(parsed.hostname or "")
    hosts = {normalize_host(item) for item in raw.get("allowedHosts", []) if str(item).strip()}
    if seed_host:
        hosts.add(seed_host)
    if not hosts:
        raise ValueError(f"Source {source_id} has no allowed hosts")
    if len(hosts) > MAX_ALLOWED_HOSTS_PER_SOURCE or any(len(host) > 253 for host in hosts):
        raise ValueError(f"Source {source_id} exceeds the allowed-host limit")
    if state == "enabled" and any(host_is_forbidden(host) for host in hosts):
        raise ValueError(f"Source {source_id} cannot enable a Reddit or Fandom host")
    validate_url_syntax(seed_url, hosts, require_https=state == "enabled")
    crawl_mode = str(raw.get("crawlMode") or "seed-only").strip().lower()
    if crawl_mode not in {"seed-only", "same-host-bounded"}:
        raise ValueError(f"Invalid crawl mode for {source_id}: {crawl_mode}")
    patterns = [str(item).strip().lower()[:80] for item in raw.get("followKeywords", []) if str(item).strip()]
    return {
        "id": source_id,
        "name": str(raw.get("name") or source_id).strip()[:120],
        "seedUrl": seed_url,
        "sourceType": str(raw.get("sourceType") or "official").strip().lower()[:40],
        "policyState": state,
        "policyReason": str(raw.get("policyReason") or "No policy reason supplied").strip()[:300],
        "allowedHosts": sorted(hosts),
        "crawlMode": crawl_mode,
        "maxPages": max(1, min(12, int(raw.get("maxPages") or 1))),
        "followKeywords": patterns[:20],
        "confidence": max(0.0, min(1.0, float(raw.get("confidence") or 0.75))),
    }


def load_source_registry(path: Path | None = None) -> dict[str, dict[str, Any]]:
    registry_path = Path(path or os.getenv("RESEARCH_SOURCE_REGISTRY", DEFAULT_SOURCE_REGISTRY))
    payload = json.loads(registry_path.read_text(encoding="utf-8"))
    rows = payload.get("sources") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("Source registry must contain a sources array")
    registry: dict[str, dict[str, Any]] = {}
    for raw in rows:
        if not isinstance(raw, dict):
            raise ValueError("Source registry entries must be objects")
        row = _registry_row(raw)
        if row["id"] in registry:
            raise ValueError(f"Duplicate source id: {row['id']}")
        registry[row["id"]] = row
    if not registry:
        raise ValueError("Source registry is empty")
    return registry


def public_source_profile(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "sourceType": row["sourceType"],
        "policyState": row["policyState"],
        "policyReason": row["policyReason"],
        "crawlMode": row["crawlMode"],
        "maxPages": row["maxPages"],
        "seedHost": normalize_host(urlsplit(row["seedUrl"]).hostname or ""),
        "allowedHosts": row["allowedHosts"],
    }


def cors_origins(extra: str | None = None) -> list[str]:
    values = set(DEFAULT_CORS_ORIGINS)
    for raw in (extra if extra is not None else os.getenv("RESEARCH_CORS_ORIGINS", "")).split(","):
        value = raw.strip().rstrip("/")
        if not value:
            continue
        parsed = urlsplit(value)
        host = normalize_host(parsed.hostname or "")
        is_loopback = parsed.scheme == "http" and host in {"localhost", "127.0.0.1", "::1"}
        is_pages = parsed.scheme == "https" and host == "therealnodder.github.io" and parsed.port in {None, 443}
        if (
            not (is_loopback or is_pages)
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(f"CORS origin is outside the approved localhost/GitHub Pages policy: {value}")
        values.add(value)
    return sorted(values)


def normalize_alias(value: Any) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).split())


class IdentityCatalog:
    def __init__(self, bundle_path: Path) -> None:
        self.bundle_path = bundle_path
        payload = json.loads(bundle_path.read_text(encoding="utf-8"))
        entries = payload.get("entries") if isinstance(payload, dict) else None
        if not isinstance(entries, list) or not entries:
            raise ValueError("Character-family bundle has no entries")
        self.content_hash = str(payload.get("contentHash") or "")
        self.generated_at = payload.get("generatedAt")
        self.families: dict[str, dict[str, Any]] = {}
        aliases: dict[str, set[str]] = defaultdict(set)
        alias_kinds: dict[tuple[str, str], set[str]] = defaultdict(set)
        for raw in entries:
            family = str(raw.get("family") or "").strip()
            if not family or len(family) > 128 or family in self.families:
                continue
            states = raw.get("states") if isinstance(raw.get("states"), list) else []
            source_ids = sorted(
                {
                    str(value).strip()
                    for state in states
                    for value in (state.get("sourceId"), state.get("dataSourceId"))
                    if str(value or "").strip()
                }
            )[:16]
            row = {
                "family": family,
                "name": str(raw.get("name") or family).strip()[:160],
                "title": str(raw.get("title") or "").strip()[:240],
                "sourceIds": source_ids,
            }
            self.families[family] = row
            candidates: list[tuple[str, str]] = [(family, "family"), (row["name"], "name"), (row["title"], "title")]
            for state in states:
                candidates.extend(
                    [
                        (str(state.get("name") or ""), "name"),
                        (str(state.get("title") or ""), "title"),
                        (str(state.get("sourceId") or ""), "sourceId"),
                        (str(state.get("dataSourceId") or ""), "sourceId"),
                    ]
                )
            for candidate, kind in candidates:
                alias = normalize_alias(candidate)
                if len(alias) < 4 or alias.isdigit():
                    continue
                aliases[alias].add(family)
                alias_kinds[(alias, family)].add(kind)
        self.aliases = {alias: sorted(families) for alias, families in aliases.items()}
        self.alias_kinds = alias_kinds
        self.unique_aliases = sorted(
            (alias for alias, families in self.aliases.items() if len(families) == 1),
            key=lambda value: (-len(value), value),
        )
        self.ambiguous_aliases = sorted(
            (alias for alias, families in self.aliases.items() if len(families) > 1),
            key=lambda value: (-len(value), value),
        )

    def metadata(self) -> dict[str, Any]:
        return {
            "contentHash": self.content_hash,
            "generatedAt": self.generated_at,
            "familyCount": len(self.families),
            "uniqueAliasCount": len(self.unique_aliases),
            "ambiguousAliasCount": len(self.ambiguous_aliases),
        }

    def mentions(self, text: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        padded = f" {normalize_alias(text)} "
        resolved: dict[str, dict[str, Any]] = {}
        for alias in self.unique_aliases:
            if f" {alias} " not in padded:
                continue
            family = self.aliases[alias][0]
            current = resolved.get(family)
            kinds = sorted(self.alias_kinds.get((alias, family), set()))
            candidate = {**self.families[family], "matchedAlias": alias, "aliasKinds": kinds}
            if current is None or len(alias) > len(current["matchedAlias"]):
                resolved[family] = candidate
        unresolved: list[dict[str, Any]] = []
        for alias in self.ambiguous_aliases:
            if f" {alias} " not in padded:
                continue
            unresolved.append(
                {
                    "mention": alias,
                    "reason": "ambiguous-canonical-name",
                    "candidateFamilies": self.aliases[alias][:12],
                    "candidateCount": len(self.aliases[alias]),
                }
            )
        return sorted(resolved.values(), key=lambda row: row["family"]), unresolved


class TextExtractor(HTMLParser):
    BLOCK_TAGS = {"article", "blockquote", "div", "h1", "h2", "h3", "h4", "li", "p", "section", "td"}

    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self._ignored_depth = 0
        self.parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self._link_href = ""
        self._link_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        lowered = tag.lower()
        if lowered in {"script", "style", "noscript", "svg"}:
            self._ignored_depth += 1
            return
        self._in_title = lowered == "title"
        if lowered == "a":
            self._link_href = next((value or "" for key, value in attrs if key.lower() == "href"), "")
            self._link_parts = []

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered in {"script", "style", "noscript", "svg"} and self._ignored_depth:
            self._ignored_depth -= 1
            return
        if lowered == "title":
            self._in_title = False
        if lowered == "a" and self._link_href:
            self.links.append((self._link_href, " ".join(self._link_parts)[:200]))
            self._link_href = ""
            self._link_parts = []

    def handle_data(self, data: str) -> None:
        if self._ignored_depth:
            return
        value = " ".join(data.split())
        if not value:
            return
        if self._in_title and not self.title:
            self.title = value[:300]
        if self._link_href:
            self._link_parts.append(value)
        self.parts.append(value)


def flatten_json_strings(value: Any, out: list[str]) -> None:
    if isinstance(value, str):
        clean = " ".join(value.split())
        if clean:
            out.append(clean)
    elif isinstance(value, list):
        for item in value:
            flatten_json_strings(item, out)
    elif isinstance(value, dict):
        for item in value.values():
            flatten_json_strings(item, out)


def parse_document(body: bytes, content_type: str, fetched_url: str) -> tuple[str, list[str], list[tuple[str, str]]]:
    text = body.decode("utf-8", errors="replace")
    title = fetched_url
    links: list[tuple[str, str]] = []
    parts: list[str] = []
    if content_type.startswith("text/html"):
        parser = TextExtractor()
        parser.feed(text)
        title = parser.title or title
        parts = parser.parts
        links = parser.links
    elif content_type.startswith("application/json"):
        try:
            flatten_json_strings(json.loads(text), parts)
        except json.JSONDecodeError:
            parts = [text]
    else:
        parts = re.split(r"[\r\n]+", text)
    clean_parts = [html.unescape(" ".join(part.split())) for part in parts]
    clean_parts = [part[:1200] for part in clean_parts if len(part) >= 3]
    return title[:300], clean_parts[:5000], links[:2000]


def plans_in(text: str) -> list[str]:
    return sorted(
        plan
        for plan, patterns in COMPILED_PLAN_PATTERNS.items()
        if any(pattern.search(text) for pattern in patterns)
    )


def claim_contexts(parts: list[str]) -> list[str]:
    contexts: list[str] = []
    seen: set[str] = set()
    for part in parts:
        sentences = re.split(r"(?<=[.!?])\s+", part)
        candidates = sentences if len(sentences) > 1 else [part]
        for candidate in candidates:
            clean = " ".join(candidate.split())[:800]
            fingerprint = clean.casefold()
            if len(clean) >= 12 and fingerprint not in seen:
                seen.add(fingerprint)
                contexts.append(clean)
                if len(contexts) >= MAX_CONTEXTS_PER_DOCUMENT:
                    return contexts
    return contexts


def advisory_record(
    profile: dict[str, Any],
    requested_url: str,
    body: bytes,
    content_type: str,
    fetched_url: str,
    catalog: IdentityCatalog,
) -> dict[str, Any]:
    title, parts, _links = parse_document(body, content_type, fetched_url)
    claims: dict[str, dict[str, Any]] = {}
    unresolved: dict[tuple[str, tuple[str, ...]], dict[str, Any]] = {}
    unit_claims: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for context in claim_contexts(parts):
        plans = plans_in(context)
        if not plans:
            continue
        resolved, ambiguous = catalog.mentions(context)
        for item in ambiguous:
            if len(unresolved) >= MAX_UNRESOLVED_PER_RECORD:
                break
            key = (item["mention"], tuple(item["candidateFamilies"]))
            unresolved[key] = {**item, "plans": plans, "excerpt": context[:360]}
        for unit in resolved:
            provenance = {
                "sourceId": profile["id"],
                "sourceUrl": requested_url,
                "fetchedUrl": fetched_url,
                "sourceTitle": title,
                "matchedAlias": unit["matchedAlias"],
                "aliasKinds": unit["aliasKinds"],
                "excerpt": context[:360],
            }
            confidence = profile["confidence"]
            if "sourceId" in unit["aliasKinds"] or "family" in unit["aliasKinds"]:
                confidence += 0.04
            if len(plans) == 1:
                confidence += 0.02
            confidence = round(max(0.0, min(0.98, confidence)), 3)
            claim_id = hashlib.sha256(
                f"{profile['id']}\0{fetched_url}\0{unit['family']}\0{','.join(plans)}\0{context}".encode("utf-8")
            ).hexdigest()[:20]
            claim = {
                "claimId": claim_id,
                "identityStatus": "resolved",
                "family": unit["family"],
                "name": unit["name"],
                "title": unit["title"],
                "sourceIds": unit["sourceIds"],
                "plans": plans,
                "confidence": confidence,
                "provenance": provenance,
            }
            if claim_id in claims:
                continue
            if len(claims) >= MAX_CLAIMS_PER_RECORD:
                break
            claims[claim_id] = claim
            unit_claims[unit["family"]].append(claim)
        if len(claims) >= MAX_CLAIMS_PER_RECORD and len(unresolved) >= MAX_UNRESOLVED_PER_RECORD:
            break
    deduped_claims = claims
    observed_units: list[dict[str, Any]] = []
    for family, rows in sorted(unit_claims.items()):
        if len(observed_units) >= MAX_OBSERVED_UNITS_PER_RECORD:
            break
        identity = catalog.families[family]
        confidence = max(row["confidence"] for row in rows)
        observed_units.append(
            {
                "identityStatus": "resolved",
                **identity,
                "plans": sorted({plan for row in rows for plan in row["plans"]}),
                "claimIds": sorted({row["claimId"] for row in rows}),
                "confidence": confidence,
                "score": round(confidence * 100, 2),
            }
        )
    now = int(time.time())
    observed_plans = sorted({plan for row in deduped_claims.values() for plan in row["plans"]})
    summary_text = " ".join(parts)
    record = {
        "schemaVersion": 2,
        "advisoryOnly": True,
        "sourceId": profile["id"],
        "sourceUrl": requested_url,
        "fetchedUrl": fetched_url,
        "sourceType": profile["sourceType"],
        "sourcePolicyState": profile["policyState"],
        "fetchedAt": now,
        "contentHash": hashlib.sha256(body).hexdigest(),
        "catalogHash": catalog.content_hash,
        "title": title,
        "summary": summary_text[:1200],
        "observedPlans": observed_plans,
        "observedUnits": observed_units,
        "claims": sorted(deduped_claims.values(), key=lambda row: row["claimId"]),
        "unresolvedMentions": sorted(unresolved.values(), key=lambda row: (row["mention"], row["candidateFamilies"])),
        "confidence": max((row["confidence"] for row in deduped_claims.values()), default=0.0),
        "expiresAt": now + 6 * 60 * 60,
    }
    serialize_record(record)
    return record


def serialize_record(record: dict[str, Any]) -> str:
    payload = json.dumps(record, ensure_ascii=False, separators=(",", ":"))
    if len(payload.encode("utf-8")) > MAX_SERIALIZED_RECORD_BYTES:
        raise ValueError("Advisory record exceeds serialized size limit")
    return payload


def canonical_crawl_url(base: str, href: str, hosts: set[str]) -> str | None:
    try:
        joined, _host = validate_url_syntax(urljoin(base, href), hosts, require_https=True)
    except ValueError:
        return None
    parsed = urlsplit(joined)
    if re.search(r"\.(?:apk|dmg|exe|gif|jpe?g|pdf|png|svg|webp|zip)$", parsed.path, re.IGNORECASE):
        return None
    query = "&".join(
        item
        for item in parsed.query.split("&")
        if item and not item.lower().startswith(("utm_", "fbclid=", "gclid="))
    )
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", query, ""))


def crawl_source(
    profile: dict[str, Any],
    catalog: IdentityCatalog,
    progress: Callable[[str], None] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    if profile["policyState"] != "enabled":
        raise ValueError(f"Source is not enabled: {profile['id']}")
    hosts = set(profile["allowedHosts"])
    pending: deque[str] = deque([profile["seedUrl"]])
    visited: set[str] = set()
    records: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    while pending and len(visited) < profile["maxPages"]:
        url = pending.popleft()
        if url in visited:
            continue
        visited.add(url)
        if progress:
            progress(f"Fetching {profile['name']} page {len(visited)}/{profile['maxPages']}")
        try:
            body, content_type, fetched_url = fetch_public(url, hosts)
            record = advisory_record(profile, url, body, content_type, fetched_url, catalog)
            records.append(record)
            if profile["crawlMode"] != "same-host-bounded" or not content_type.startswith("text/html"):
                continue
            _title, _parts, links = parse_document(body, content_type, fetched_url)
            keywords = profile["followKeywords"]
            for href, label in links:
                candidate = canonical_crawl_url(fetched_url, href, hosts)
                if not candidate or candidate in visited or candidate in pending:
                    continue
                haystack = f"{candidate} {label}".casefold()
                if keywords and not any(keyword in haystack for keyword in keywords):
                    continue
                pending.append(candidate)
                if len(pending) >= profile["maxPages"] * 4:
                    break
        except Exception as exc:  # one approved page must not conceal the rest
            errors.append({"sourceId": profile["id"], "sourceUrl": url, "error": str(exc)})
    return records, errors


class Cache:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = self.connect()
        try:
            db.execute(
                "CREATE TABLE IF NOT EXISTS observations "
                "(source_url TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS source_fetch_state "
                "(source_id TEXT PRIMARY KEY, last_attempt_at INTEGER NOT NULL)"
            )
            db.commit()
        finally:
            db.close()

    def connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path, timeout=5)

    def put(self, record: dict[str, Any]) -> None:
        payload = serialize_record(record)
        db = self.connect()
        try:
            db.execute(
                "INSERT OR REPLACE INTO observations(source_url,payload,fetched_at) VALUES(?,?,?)",
                (record["sourceUrl"], payload, record["fetchedAt"]),
            )
            db.commit()
        finally:
            db.close()

    def latest(self, limit: int = MAX_CACHED_RECORDS) -> list[dict[str, Any]]:
        db = self.connect()
        try:
            rows = db.execute(
                "SELECT payload FROM observations ORDER BY fetched_at DESC LIMIT ?",
                (max(1, min(MAX_CACHED_RECORDS, limit)),),
            ).fetchall()
        finally:
            db.close()
        records: list[dict[str, Any]] = []
        total_bytes = 0
        for (payload,) in rows:
            size = len(payload.encode("utf-8"))
            if size > MAX_SERIALIZED_RECORD_BYTES or total_bytes + size > MAX_LATEST_PAYLOAD_BYTES:
                continue
            try:
                record = json.loads(payload)
            except json.JSONDecodeError:
                continue
            if not isinstance(record, dict):
                continue
            records.append(record)
            total_bytes += size
        return records

    def fresh_for_source(
        self,
        profile: dict[str, Any],
        catalog_hash: str,
        *,
        now: int | None = None,
    ) -> list[dict[str, Any]]:
        current = int(time.time()) if now is None else int(now)
        hosts = set(profile["allowedHosts"])
        fresh: list[dict[str, Any]] = []
        for record in self.latest():
            try:
                if (
                    record.get("advisoryOnly") is not True
                    or record.get("sourceId") != profile["id"]
                    or record.get("sourcePolicyState") != "enabled"
                    or record.get("catalogHash") != catalog_hash
                    or not current < int(record.get("expiresAt") or 0)
                ):
                    continue
                validate_url_syntax(str(record.get("sourceUrl") or ""), hosts, require_https=True)
                validate_url_syntax(str(record.get("fetchedUrl") or ""), hosts, require_https=True)
                serialize_record(record)
            except (TypeError, ValueError):
                continue
            fresh.append(record)
            if len(fresh) >= profile["maxPages"]:
                break
        return fresh

    def begin_source_fetch(
        self,
        source_id: str,
        cooldown_seconds: int = SOURCE_FETCH_COOLDOWN_SECONDS,
        *,
        now: int | None = None,
    ) -> tuple[bool, int]:
        if not valid_source_id(source_id):
            raise ValueError("Invalid source id")
        current = int(time.time()) if now is None else int(now)
        cooldown = max(1, int(cooldown_seconds))
        db = self.connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT last_attempt_at FROM source_fetch_state WHERE source_id=?", (source_id,)
            ).fetchone()
            last_attempt = int(row[0]) if row else 0
            retry_after = max(0, last_attempt + cooldown - current)
            if retry_after:
                db.rollback()
                return False, retry_after
            db.execute(
                "INSERT INTO source_fetch_state(source_id,last_attempt_at) VALUES(?,?) "
                "ON CONFLICT(source_id) DO UPDATE SET last_attempt_at=excluded.last_attempt_at",
                (source_id, current),
            )
            db.commit()
            return True, 0
        finally:
            db.close()


class JobQueueFull(RuntimeError):
    pass


class JobManager:
    def __init__(
        self,
        cache: Cache,
        registry: dict[str, dict[str, Any]],
        catalog: IdentityCatalog,
        *,
        worker_count: int = 2,
        queue_size: int = 8,
        start_workers: bool = True,
        crawler: Callable[..., tuple[list[dict[str, Any]], list[dict[str, str]]]] = crawl_source,
    ) -> None:
        self.cache = cache
        self.registry = registry
        self.catalog = catalog
        self.jobs: dict[str, dict[str, Any]] = {}
        self.lock = threading.RLock()
        self.crawler = crawler
        self.queue: queue.Queue[tuple[str, list[str]]] = queue.Queue(maxsize=max(1, queue_size))
        self.worker_count = max(1, worker_count)
        if start_workers:
            for index in range(self.worker_count):
                threading.Thread(target=self._worker, name=f"strategy-research-{index + 1}", daemon=True).start()

    def event(self, job_id: str, stage: str, progress: int, message: str) -> None:
        row = {"stage": stage, "progress": progress, "message": message, "at": int(time.time())}
        with self.lock:
            job = self.jobs[job_id]
            job["stage"] = stage
            job["progress"] = progress
            job["events"].append(row)
            job["updatedAt"] = int(time.time())

    def _prune(self) -> None:
        with self.lock:
            complete = [
                (job_id, row.get("updatedAt", 0))
                for job_id, row in self.jobs.items()
                if row.get("status") in {"complete", "failed"}
            ]
            for job_id, _updated in sorted(complete, key=lambda pair: pair[1], reverse=True)[100:]:
                self.jobs.pop(job_id, None)

    def enabled_source_ids(self) -> list[str]:
        return sorted(source_id for source_id, row in self.registry.items() if row["policyState"] == "enabled")

    def create(self, source_ids: list[str] | None = None) -> dict[str, Any]:
        requested = list(dict.fromkeys(source_ids or self.enabled_source_ids()))
        if not requested:
            raise ValueError("No research sources are enabled by server policy")
        if len(requested) > MAX_SOURCES_PER_JOB:
            raise ValueError(f"At most {MAX_SOURCES_PER_JOB} sources may be researched per job")
        for source_id in requested:
            if not valid_source_id(source_id):
                raise ValueError(f"Invalid source id: {str(source_id)[:80]}")
            profile = self.registry.get(source_id)
            if not profile:
                raise ValueError(f"Unknown source id: {source_id}")
            if profile["policyState"] != "enabled":
                raise ValueError(f"Source is not enabled by policy: {source_id}")
        self._prune()
        signature = tuple(sorted(requested))
        with self.lock:
            for row in self.jobs.values():
                if row.get("status") not in {"queued", "running"}:
                    continue
                if tuple(sorted(row.get("sourceIds") or [])) != signature:
                    continue
                coalesced = json.loads(json.dumps(row))
                coalesced["coalesced"] = True
                return coalesced
            job_id = uuid.uuid4().hex
            now = int(time.time())
            job = {
                "jobId": job_id,
                "status": "queued",
                "stage": "queued",
                "progress": 0,
                "sourceIds": requested,
                "catalog": self.catalog.metadata(),
                "events": [{"stage": "queued", "progress": 0, "message": "Research job queued", "at": now}],
                "results": [],
                "errors": [],
                "createdAt": now,
                "updatedAt": now,
                "coalesced": False,
            }
            self.jobs[job_id] = job
            try:
                self.queue.put_nowait((job_id, requested))
            except queue.Full as exc:
                self.jobs.pop(job_id, None)
                raise JobQueueFull("Research queue is full; retry later") from exc
        return self.get(job_id)

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self.lock:
            row = self.jobs.get(job_id)
            return json.loads(json.dumps(row)) if row else None

    def _worker(self) -> None:
        while True:
            job_id, source_ids = self.queue.get()
            try:
                self.run(job_id, source_ids)
            finally:
                self.queue.task_done()

    def run(self, job_id: str, source_ids: list[str]) -> None:
        try:
            with self.lock:
                self.jobs[job_id]["status"] = "running"
            self.event(job_id, "sources", 7, "Checking server-approved source policies")
            records: list[dict[str, Any]] = []
            result_bytes = 0
            for index, source_id in enumerate(source_ids):
                profile = self.registry[source_id]
                base_progress = 12 + round(index / max(1, len(source_ids)) * 58)

                def source_progress(message: str, progress_value: int = base_progress) -> None:
                    self.event(job_id, "fetch", progress_value, message)

                source_records = self.cache.fresh_for_source(profile, self.catalog.content_hash)
                source_errors: list[dict[str, str]] = []
                if source_records:
                    self.event(job_id, "cache", base_progress, f"Reusing fresh cache for {profile['name']}")
                else:
                    may_fetch, retry_after = self.cache.begin_source_fetch(source_id)
                    if not may_fetch:
                        source_errors.append(
                            {
                                "sourceId": source_id,
                                "sourceUrl": profile["seedUrl"],
                                "error": f"Source fetch cooldown active; retry in {retry_after} seconds",
                            }
                        )
                    else:
                        source_records, source_errors = self.crawler(profile, self.catalog, source_progress)
                with self.lock:
                    self.jobs[job_id]["errors"].extend(source_errors)
                for record in source_records:
                    if len(records) >= MAX_RECORDS_PER_JOB:
                        break
                    payload_bytes = len(serialize_record(record).encode("utf-8"))
                    if result_bytes + payload_bytes > MAX_JOB_RESULT_BYTES:
                        with self.lock:
                            self.jobs[job_id]["errors"].append(
                                {"sourceId": source_id, "error": "Job result byte limit reached"}
                            )
                        break
                    self.cache.put(record)
                    records.append(record)
                    result_bytes += payload_bytes
            self.event(job_id, "dedupe", 75, "Removing duplicate source snapshots")
            records = list({(record["sourceId"], record["contentHash"]): record for record in records}.values())[
                :MAX_RECORDS_PER_JOB
            ]
            self.event(job_id, "compare", 86, "Resolving unit-plan claims against generated identities")
            with self.lock:
                self.jobs[job_id]["results"] = records
            self.event(job_id, "finalize", 95, "Preparing advisory-only report")
            with self.lock:
                self.jobs[job_id]["status"] = "complete" if records else "failed"
            self.event(job_id, "complete", 100, "Research complete" if records else "No sources completed successfully")
        except Exception as exc:
            with self.lock:
                self.jobs[job_id]["status"] = "failed"
                self.jobs[job_id]["errors"].append({"error": str(exc)})
            self.event(job_id, "failed", 100, "Research failed")


class RateLimiter:
    def __init__(self, limit: int = 10, window_seconds: int = 60) -> None:
        self.limit, self.window = limit, window_seconds
        self.calls: dict[str, deque[float]] = defaultdict(deque)
        self.lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.time()
        with self.lock:
            bucket = self.calls[key]
            while bucket and bucket[0] < now - self.window:
                bucket.popleft()
            if len(bucket) >= self.limit:
                return False
            bucket.append(now)
            return True


class RequestBodyTooLarge(RuntimeError):
    pass


class RequestBodyLimitMiddleware:
    """Bound request bodies even when a client omits Content-Length."""

    def __init__(self, app: Any, max_bytes: int = MAX_REQUEST_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max(1, int(max_bytes))

    async def __call__(self, scope: dict[str, Any], receive: Callable[..., Any], send: Callable[..., Any]) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        try:
            advertised = int(headers.get(b"content-length", b"0") or b"0")
        except ValueError:
            advertised = 0
        if advertised > self.max_bytes:
            await self._reject(send)
            return
        consumed = 0
        response_started = False

        async def limited_receive() -> dict[str, Any]:
            nonlocal consumed
            message = await receive()
            if message.get("type") == "http.request":
                consumed += len(message.get("body") or b"")
                if consumed > self.max_bytes:
                    raise RequestBodyTooLarge("Request body exceeds size limit")
            return message

        async def tracked_send(message: dict[str, Any]) -> None:
            nonlocal response_started
            if message.get("type") == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except RequestBodyTooLarge:
            if response_started:
                raise
            await self._reject(send)

    @staticmethod
    async def _reject(send: Callable[..., Any]) -> None:
        body = b'{"detail":"Request body exceeds size limit"}'
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


REGISTRY = load_source_registry()
CATALOG = IdentityCatalog(Path(os.getenv("RESEARCH_FAMILY_BUNDLE", DEFAULT_FAMILY_BUNDLE)))
CACHE = Cache(Path(os.getenv("RESEARCH_DB", DEFAULT_DB)))
JOBS = JobManager(
    CACHE,
    REGISTRY,
    CATALOG,
    worker_count=env_int("RESEARCH_WORKERS", 2, 1, 4),
    queue_size=env_int("RESEARCH_QUEUE_SIZE", 8, 1, 32),
)
LIMITER = RateLimiter(
    limit=env_int("RESEARCH_RATE_LIMIT", 10, 1, 120),
    window_seconds=env_int("RESEARCH_RATE_WINDOW_SECONDS", 60, 10, 3600),
)

try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field
except ImportError:  # extraction/cache tests can run without optional web dependencies
    FastAPI = None
    app = None
else:

    class JobRequest(BaseModel):
        sourceIds: list[str] = Field(default_factory=list, max_length=MAX_SOURCES_PER_JOB)

        class Config:
            extra = "forbid"

    class RefreshRequest(BaseModel):
        sourceId: str = Field(min_length=3, max_length=MAX_SOURCE_ID_LENGTH, pattern=r"^[a-z0-9][a-z0-9-]{2,63}$")

        class Config:
            extra = "forbid"

    app = FastAPI(title="Evertale Strategy Research", version="2.0.0")
    app.add_middleware(RequestBodyLimitMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        max_age=600,
    )

    def rate_limit(request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        if not LIMITER.allow(key):
            raise HTTPException(status_code=429, detail="Rate limit exceeded")

    def create_job_response(source_ids: list[str]) -> dict[str, Any]:
        try:
            return JOBS.create(source_ids)
        except JobQueueFull as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/research/sources")
    def source_profiles() -> dict[str, Any]:
        return {
            "advisoryOnly": True,
            "sources": [public_source_profile(REGISTRY[key]) for key in sorted(REGISTRY)],
        }

    @app.post("/api/research/jobs")
    def create_job(payload: JobRequest, request: Request) -> dict[str, Any]:
        rate_limit(request)
        return create_job_response(payload.sourceIds)

    @app.get("/api/research/jobs/{job_id}")
    def get_job(job_id: str) -> dict[str, Any]:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job

    @app.get("/api/research/jobs/{job_id}/events")
    def get_events(job_id: str) -> dict[str, Any]:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"jobId": job_id, "events": job["events"]}

    @app.get("/api/research/latest")
    def latest() -> dict[str, Any]:
        return {
            "schemaVersion": 2,
            "advisoryOnly": True,
            "catalog": CATALOG.metadata(),
            "observations": CACHE.latest(),
        }

    @app.post("/api/research/refresh-source")
    def refresh_source(source: RefreshRequest, request: Request) -> dict[str, Any]:
        rate_limit(request)
        return create_job_response([source.sourceId])
