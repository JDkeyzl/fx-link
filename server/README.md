# crealink-backend (Express + SQLite)

## Features
- SQLite table `parts(part_no TEXT PRIMARY KEY, brand TEXT NOT NULL, name_ch TEXT NOT NULL, name_en TEXT NOT NULL, name_fr TEXT NOT NULL, name_ar TEXT NOT NULL, price REAL)` + explicit index `idx_parts_part_no`
- Stream import from Excel files in `web/data/format_data`
- API: `GET /api/parts/:partNo` → JSON part detail (recommended for SEO frontend)
- API: `GET /parts/:brand/:part_no` → same JSON (legacy / human-readable URL)

## CreaLink Chat (LangChain + DeepSeek + RAG)

RFQ chat for catalogue lookup and sales review queue.

1. Copy `.env.example` → `.env` and set `LLM_API_KEY` (DeepSeek).
2. Set `ADMIN_UPLOAD_KEY` or `ADMIN_TRANSLATION_KEY` for `/desk/review` and knowledge reindex.
3. `npm run ingest-knowledge` (also auto-runs on boot if KB empty).
4. Restart backend → open `http://localhost:3000/desk` (chat) and `http://localhost:3000/desk/review` (sales, bookmark).

APIs:
- `GET  /api/desk/health`
- `POST /api/desk/session`
- `GET  /api/desk/session/:id`
- `POST /api/desk/chat` `{ "sessionId"?: "...", "message": "..." }`
- `POST /api/desk/contact` `{ "sessionId", "name?", "email", "phone?", "company?" }`
- `POST /api/desk/quote/submit` `{ "sessionId" }` (requires valid email + lines)
- `POST /api/desk/quote/confirm` (legacy alias → submit)
- `POST /api/desk/quote/line/remove` `{ "sessionId", "part_no" }`
- `GET  /api/desk/review/leads` (admin key)
- `GET  /api/desk/review/leads/:sessionId` (admin key)
- `POST /api/desk/review/leads/:sessionId` `{ "decision": "approved"|"rejected", "note?" }` (admin key)
- `POST /api/desk/knowledge/reindex` (admin key)

Tools: `lookup_part`, `search_parts`, `get_fx_rate`, `update_requirement_card`, `search_knowledge`, `upsert_quote_line`, `remove_quote_line`, `get_quote_draft`, `upsert_contact`, `get_contact`.
Quote status: `draft` → `pending_review` → `approved` | `rejected`. Catalogue prices are CNY; USD via `usd_cny_rate`.

## Setup
```bash
cd /path/to/tk-link/server
npm install
```

## Import Excel -> SQLite
```bash
# first run (creates db under server/data/parts.db)
RESET_DB=1 npm run ingest
```

Environment variables:
- `DATA_DIR` (default: `../web/data/format_data`)
- `DB_PATH` (default: `server/data/parts.db`)
- `BATCH_SIZE` (default: 5000)
- `RESET_DB=1` (delete existing db file before import)

## Start API
```bash
PORT=3001 npm start
```

### Hidden translation correction admin APIs

Set admin key (required):

```bash
export ADMIN_TRANSLATION_KEY="change-this-secret"
```

Admin endpoints (header `x-admin-key: $ADMIN_TRANSLATION_KEY`):
- `GET /api/admin/translation/issues/grouped`
- `GET /api/admin/translation/issues/items`
- `POST /api/admin/translation/single`
- `POST /api/admin/translation/batch-preview`
- `POST /api/admin/translation/batch-apply`
- `POST /api/admin/translation/rollback`

Notes:
- Runtime overrides are stored in `part_translation_overrides` and take precedence over `parts`.
- All correction operations are audit-logged in `translation_correction_logs`.

## Example
```bash
curl http://localhost:3001/api/parts/WG9000360521
curl "http://localhost:3001/api/parts/search?q=201V25441&limit=30"
curl http://localhost:3001/parts/sinotruk/WG9000360521
```
Fuzzy search requires `q` length ≥ 2; `limit` default 30, max 50.

## Generate part sitemaps (350k+ URLs)
Writes chunked `parts-sitemap-*.xml` + `parts-sitemap-index.xml` under `web/public/sitemaps/`.

```bash
SITE_URL=https://crealink.shop npm run generate-part-sitemaps
```

Optional env:
- `PARTS_DB_PATH` – override SQLite path
- `OUT_DIR` – override output directory
- `MAX_URLS_PER_FILE` – default `50000`

