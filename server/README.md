# crealink-backend (Express + SQLite)

## Features
- SQLite table `parts(part_no TEXT PRIMARY KEY, brand TEXT, name_en TEXT, price REAL)` + explicit index `idx_parts_part_no`
- Stream import from Excel files in `web/data/format data`
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
- `DATA_DIR` (default: `../web/data/format data`)
- `DB_PATH` (default: `server/data/parts.db`)
- `BATCH_SIZE` (default: 5000)
- `RESET_DB=1` (delete existing db file before import)

## Start API
```bash
PORT=3001 npm start
```

## Example
```bash
curl http://localhost:3001/api/parts/WG9000360521
curl http://localhost:3001/parts/sinotruk/WG9000360521
```

## Generate part sitemaps (350k+ URLs)
Writes chunked `parts-sitemap-*.xml` + `parts-sitemap-index.xml` under `web/public/sitemaps/`.

```bash
SITE_URL=http://crealink.shop npm run generate-part-sitemaps
```

Optional env:
- `PARTS_DB_PATH` – override SQLite path
- `OUT_DIR` – override output directory
- `MAX_URLS_PER_FILE` – default `50000`

