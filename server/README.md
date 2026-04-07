# crealink-backend (Express + SQLite)

## Features
- SQLite table `parts(part_no TEXT PRIMARY KEY, brand TEXT NOT NULL, name_ch TEXT NOT NULL, name_en TEXT NOT NULL, name_fr TEXT NOT NULL, name_ar TEXT NOT NULL, price REAL)` + explicit index `idx_parts_part_no`
- Stream import from Excel files in `web/data/format_data`
- API: `GET /api/parts/:partNo` → JSON part detail (recommended for SEO frontend)
- API: `GET /parts/:brand/:part_no` → same JSON (legacy / human-readable URL)

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

