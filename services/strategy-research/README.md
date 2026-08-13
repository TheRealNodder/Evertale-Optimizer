# Optional Strategy Research Service

This service is advisory-only. The deterministic V6 optimizer does not depend
on it, and a failed or absent service never changes mechanical evidence, legal
team constraints, or the last valid optimizer result.

## What changed in v2

- The browser can request only server-owned source IDs. It cannot submit a URL.
- Every source has an explicit `enabled`, `disabled`, or `blocked` policy state
  in `sources.json` (or an operator-provided registry file).
- Reddit and Fandom are blocked by the checked-in registry, and the loader
  rejects any registry that attempts to enable either host family.
- Unit names resolve against the generated
  `character_families.bundle.json`. Shared display names remain unresolved and
  never receive a score.
- Unit-plan claims keep the source URL, final fetched URL, source title,
  matching alias, excerpt, canonical family, confidence, and content hash.
- A fixed worker pool, bounded queue, request rate limit, response limit,
  timeout, redirect validation, and public-IP checks bound collection work.
- Extraction is capped per document and per serialized observation (contexts,
  claims, unresolved mentions, units, record bytes, and job result records).
- Enabled sources and every redirect must remain HTTPS. Source IDs use a
  server-validated 3-64 character lowercase identifier contract.
- Fresh observations are reused until expiry, identical active jobs coalesce,
  and a SQLite-backed per-source cooldown applies across workers/processes that
  share the database.
- SQLite defaults to persistent application data instead of a temporary file.
- CORS permits only the project's GitHub Pages origin and local development
  origins.

The checked-in enabled profile is the Google Play distribution listing. Apple,
the publisher website, the former Evertale domain, and unapproved community
sources are explicitly blocked because their current terms do not establish
permission for this automated collection path.
An operator may add other permitted public sources to a server-side registry
after reviewing the source's terms and crawl policy; those sources are never
configured by frontend users.

## Local run

```powershell
python -m pip install -r services/strategy-research/requirements.txt
uvicorn app:app --app-dir services/strategy-research --host 127.0.0.1 --port 8787
```

Then define this before `optimizer-strategy-research.js` loads:

```html
<script>window.EVERTALE_RESEARCH_API_BASE = 'http://127.0.0.1:8787';</script>
```

The optimizer presents separate controls for the local release-order prior and
the internet research prior. The internet prior remains disabled until a valid,
catalog-compatible advisory contains at least one unambiguous provenance-backed
unit-plan claim. Browser local storage caches the last response; cookies are not
used.

## Deployment configuration

- `RESEARCH_DB`: persistent SQLite file (recommended on a durable volume).
- `RESEARCH_SOURCE_REGISTRY`: server-side JSON registry path.
- `RESEARCH_FAMILY_BUNDLE`: generated family bundle path matching the deployed
  optimizer data.
- `RESEARCH_WORKERS`: fixed worker count, clamped to 1-4 (default 2).
- `RESEARCH_QUEUE_SIZE`: pending job capacity, clamped to 1-32 (default 8).
- `RESEARCH_RATE_LIMIT`: requests per rate window (default 10).
- `RESEARCH_RATE_WINDOW_SECONDS`: rate window (default 60 seconds).
- `RESEARCH_SOURCE_COOLDOWN_SECONDS`: global per-source fetch cooldown stored in
  SQLite, clamped to 30-86400 seconds (default 300).
- `RESEARCH_MAX_REQUEST_BODY_BYTES`: application request-body ceiling, clamped
  to 1-64 KiB (default 16 KiB), including chunked requests without a declared
  `Content-Length`.
- `RESEARCH_CORS_ORIGINS`: optional additional origins, accepted only when they
  are localhost HTTP origins or `https://therealnodder.github.io`.

GitHub Pages cannot execute this Python service. Internet research becomes live
only after deploying the service to an HTTPS runtime with persistent storage and
setting `EVERTALE_RESEARCH_API_BASE` in the site deployment. Until then, the UI
clearly reports that the backend is unconfigured and continues using local data.

The production reverse proxy/serverless gateway must also reject request bodies
larger than 16 KiB (or the explicitly configured lower application limit) before
forwarding them. Keep that platform limit aligned with
`RESEARCH_MAX_REQUEST_BODY_BYTES`; the in-process limit is defense in depth, not
a substitute for an edge limit. Deploy only behind HTTPS. The only checked-in
enabled crawler is the permitted Google Play seed-only profile.

## API

```text
GET  /api/research/sources
POST /api/research/jobs                 {"sourceIds": []}
GET  /api/research/jobs/{jobId}
GET  /api/research/jobs/{jobId}/events
GET  /api/research/latest
POST /api/research/refresh-source       {"sourceId": "official-google-play"}
```

An empty `sourceIds` list selects every server-enabled source. Unknown, blocked,
or disabled source IDs fail closed. There is deliberately no arbitrary-URL API.

## Tests

```powershell
python -m unittest discover -s services/strategy-research/tests -p "test_*.py" -v
```
