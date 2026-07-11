"""Optional advisory-only strategy research API.

The deterministic optimizer never imports or calls this service. Deploy it
separately and configure the frontend API URL only when public research is
desired.
"""
from __future__ import annotations

import hashlib
import html
import ipaddress
import json
import os
import socket
import sqlite3
import tempfile
import threading
import time
import uuid
from collections import defaultdict, deque
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
FETCH_TIMEOUT_SECONDS = 10
MAX_REDIRECTS = 4
ALLOWED_CONTENT_TYPES = ("text/html", "text/plain", "application/json")
DEFAULT_ALLOWED_HOSTS = {
    "evertale.com",
    "www.evertale.com",
    "zigzagame.com",
    "www.zigzagame.com",
    "reddit.com",
    "www.reddit.com",
    "old.reddit.com",
    "evertale.fandom.com",
}
PLAN_WORDS = ("burn", "poison", "sleep", "stun", "blood", "crisis", "survivor", "guardian", "tempo")


def allowed_hosts() -> set[str]:
    extra = {item.strip().lower() for item in os.getenv("RESEARCH_ALLOWED_HOSTS", "").split(",") if item.strip()}
    return DEFAULT_ALLOWED_HOSTS | extra


def validate_url_syntax(url: str, hosts: set[str] | None = None) -> tuple[str, str]:
    parsed = urlsplit(url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http and https sources are supported")
    if parsed.username or parsed.password:
        raise ValueError("Credentials in source URLs are forbidden")
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if not hostname or hostname not in (hosts or allowed_hosts()):
        raise ValueError(f"Source host is not allowlisted: {hostname or '(missing)'}")
    if parsed.port not in {None, 80, 443}:
        raise ValueError("Only standard HTTP(S) ports are supported")
    return parsed.geturl(), hostname


def validate_resolved_addresses(hostname: str, resolver=socket.getaddrinfo) -> list[str]:
    addresses = sorted({row[4][0] for row in resolver(hostname, None, type=socket.SOCK_STREAM)})
    if not addresses:
        raise ValueError("Source host did not resolve")
    for value in addresses:
        ip = ipaddress.ip_address(value.split("%")[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            raise ValueError(f"Source resolves to a forbidden address: {ip}")
    return addresses


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def fetch_public(url: str) -> tuple[bytes, str, str]:
    current, hostname = validate_url_syntax(url)
    opener = build_opener(NoRedirect)
    for _ in range(MAX_REDIRECTS + 1):
        validate_resolved_addresses(hostname)
        request = Request(current, headers={"User-Agent": "EvertaleOptimizerStrategyResearch/1.0"})
        try:
            response = opener.open(request, timeout=FETCH_TIMEOUT_SECONDS)
        except HTTPError as exc:
            if exc.code not in {301, 302, 303, 307, 308}:
                raise
            location = exc.headers.get("Location")
            if not location:
                raise ValueError("Redirect response omitted Location") from exc
            current, hostname = validate_url_syntax(urljoin(current, location))
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


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._in_title = tag.lower() == "title"

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        value = " ".join(data.split())
        if not value:
            return
        if self._in_title and not self.title:
            self.title = value[:300]
        self.parts.append(value)


def advisory_record(source_url: str, source_type: str, body: bytes, content_type: str, fetched_url: str) -> dict[str, Any]:
    text = body.decode("utf-8", errors="replace")
    title = fetched_url
    if content_type == "text/html":
        parser = TextExtractor()
        parser.feed(text)
        title = parser.title or title
        text = " ".join(parser.parts)
    elif content_type == "application/json":
        try:
            text = json.dumps(json.loads(text), ensure_ascii=False)
        except json.JSONDecodeError:
            pass
    clean = html.unescape(" ".join(text.split()))
    lowered = clean.lower()
    plans = sorted({word for word in PLAN_WORDS if word in lowered})
    now = int(time.time())
    return {
        "sourceUrl": source_url,
        "sourceType": source_type,
        "fetchedAt": now,
        "contentHash": hashlib.sha256(body).hexdigest(),
        "title": title[:300],
        "summary": clean[:1200],
        "observedPlans": plans,
        "observedUnits": [],
        "confidence": min(0.75, 0.35 + len(plans) * 0.05),
        "expiresAt": now + 6 * 60 * 60,
    }


class Cache:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = self.connect()
        try:
            db.execute("CREATE TABLE IF NOT EXISTS observations (source_url TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL)")
            db.commit()
        finally:
            db.close()

    def connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path, timeout=5)

    def put(self, record: dict[str, Any]) -> None:
        db = self.connect()
        try:
            db.execute("INSERT OR REPLACE INTO observations(source_url,payload,fetched_at) VALUES(?,?,?)", (record["sourceUrl"], json.dumps(record), record["fetchedAt"]))
            db.commit()
        finally:
            db.close()

    def latest(self, limit: int = 50) -> list[dict[str, Any]]:
        db = self.connect()
        try:
            rows = db.execute("SELECT payload FROM observations ORDER BY fetched_at DESC LIMIT ?", (limit,)).fetchall()
        finally:
            db.close()
        return [json.loads(row[0]) for row in rows]


class JobManager:
    def __init__(self, cache: Cache) -> None:
        self.cache = cache
        self.jobs: dict[str, dict[str, Any]] = {}
        self.lock = threading.Lock()

    def event(self, job_id: str, stage: str, progress: int, message: str) -> None:
        row = {"stage": stage, "progress": progress, "message": message, "at": int(time.time())}
        with self.lock:
            self.jobs[job_id]["stage"] = stage
            self.jobs[job_id]["progress"] = progress
            self.jobs[job_id]["events"].append(row)

    def create(self, sources: list[dict[str, str]]) -> dict[str, Any]:
        job_id = uuid.uuid4().hex
        job = {"jobId": job_id, "status": "queued", "stage": "queued", "progress": 0, "events": [], "results": [], "errors": []}
        self.jobs[job_id] = job
        self.event(job_id, "queued", 0, "Research job queued")
        threading.Thread(target=self.run, args=(job_id, sources), daemon=True).start()
        return job

    def run(self, job_id: str, sources: list[dict[str, str]]) -> None:
        try:
            self.jobs[job_id]["status"] = "running"
            self.event(job_id, "sources", 7, "Checking approved sources")
            validated = [(validate_url_syntax(row["url"])[0], row.get("sourceType", "forum")) for row in sources]
            records = []
            for index, (url, source_type) in enumerate(validated):
                self.event(job_id, "fetch", 15 + round(index / max(1, len(validated)) * 35), f"Downloading public source {index + 1}/{len(validated)}")
                try:
                    body, content_type, fetched_url = fetch_public(url)
                    self.event(job_id, "parse", 50 + round(index / max(1, len(validated)) * 20), f"Extracting observations {index + 1}/{len(validated)}")
                    record = advisory_record(url, source_type, body, content_type, fetched_url)
                    self.cache.put(record)
                    records.append(record)
                except Exception as exc:  # one public source must not conceal the rest
                    self.jobs[job_id]["errors"].append({"sourceUrl": url, "error": str(exc)})
            self.event(job_id, "dedupe", 75, "Removing duplicate claims")
            records = list({record["contentHash"]: record for record in records}.values())
            self.event(job_id, "compare", 86, "Preparing advisory-only observations")
            self.jobs[job_id]["results"] = records
            self.event(job_id, "finalize", 95, "Finalizing advisory report")
            self.jobs[job_id]["status"] = "complete" if records else "failed"
            self.event(job_id, "complete", 100, "Research complete" if records else "No sources completed successfully")
        except Exception as exc:
            self.jobs[job_id]["status"] = "failed"
            self.jobs[job_id]["errors"].append({"error": str(exc)})
            self.event(job_id, "failed", 100, "Research failed")


class RateLimiter:
    def __init__(self, limit: int = 10, window_seconds: int = 60) -> None:
        self.limit, self.window = limit, window_seconds
        self.calls: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.time()
        bucket = self.calls[key]
        while bucket and bucket[0] < now - self.window:
            bucket.popleft()
        if len(bucket) >= self.limit:
            return False
        bucket.append(now)
        return True


CACHE = Cache(Path(os.getenv("RESEARCH_DB", Path(tempfile.gettempdir()) / "evertale_strategy_research.sqlite3")))
JOBS = JobManager(CACHE)
LIMITER = RateLimiter()

try:
    from fastapi import FastAPI, HTTPException, Request
    from pydantic import BaseModel, Field
except ImportError:  # security/cache tests can run without optional web dependencies
    FastAPI = None
    app = None
else:
    class Source(BaseModel):
        url: str
        sourceType: str = "forum"

    class JobRequest(BaseModel):
        sources: list[Source] = Field(default_factory=list, max_length=20)

    app = FastAPI(title="Evertale Strategy Research", version="1.0.0")

    def rate_limit(request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        if not LIMITER.allow(key):
            raise HTTPException(status_code=429, detail="Rate limit exceeded")

    @app.post("/api/research/jobs")
    def create_job(payload: JobRequest, request: Request) -> dict[str, Any]:
        rate_limit(request)
        if not payload.sources:
            raise HTTPException(status_code=400, detail="At least one approved public source is required")
        return JOBS.create([row.model_dump() for row in payload.sources])

    @app.get("/api/research/jobs/{job_id}")
    def get_job(job_id: str) -> dict[str, Any]:
        if job_id not in JOBS.jobs:
            raise HTTPException(status_code=404, detail="Job not found")
        return JOBS.jobs[job_id]

    @app.get("/api/research/jobs/{job_id}/events")
    def get_events(job_id: str) -> dict[str, Any]:
        if job_id not in JOBS.jobs:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"jobId": job_id, "events": JOBS.jobs[job_id]["events"]}

    @app.get("/api/research/latest")
    def latest() -> dict[str, Any]:
        return {"advisoryOnly": True, "observations": CACHE.latest()}

    @app.post("/api/research/refresh-source")
    def refresh_source(source: Source, request: Request) -> dict[str, Any]:
        rate_limit(request)
        return JOBS.create([source.model_dump()])
