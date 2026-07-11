# Optional Strategy Research Service

This service is advisory-only. The deterministic V6 optimizer does not depend
on it and does not import its observations into mechanical evidence or weights.

Run locally:

```bash
python -m pip install -r services/strategy-research/requirements.txt
uvicorn app:app --app-dir services/strategy-research --host 127.0.0.1 --port 8787
```

Configure deployments with:

- `RESEARCH_DB`: persistent SQLite path.
- `RESEARCH_ALLOWED_HOSTS`: comma-separated additional public source hosts.

The fetcher accepts only HTTP(S), standard ports, allowlisted hosts, public IP
addresses, bounded text/HTML/JSON responses, and validated redirects. It rejects
credentials, localhost, private/link-local/reserved addresses, unsupported
content types, oversized responses, and redirects to forbidden hosts.

The frontend remains disabled unless `window.EVERTALE_RESEARCH_API_BASE` and
`window.EVERTALE_RESEARCH_SOURCES` are explicitly configured before
`optimizer-strategy-research.js` loads.
