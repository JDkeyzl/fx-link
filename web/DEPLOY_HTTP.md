# crealink.shop — HTTP 部署要点（无 HTTPS）

完整步骤：`docs/deploy-crealink-shop-http.md`。

服务器路径示例：**`/home/admin/fx-link`**（web：`.../web`，server：`.../server`）。

## 环境变量（生产）

`web/ecosystem.config.cjs` 已写入默认值；**首次或修改 `NEXT_PUBLIC_*` 后必须重新 build**：

```bash
cd /home/admin/fx-link/web
NEXT_PUBLIC_SITE_URL=http://crealink.shop PARTS_API_BASE_URL=http://127.0.0.1:3001 npm run build
```

运行时（PM2）仍需与 build 时一致的 `NEXT_PUBLIC_SITE_URL`（已在 ecosystem 中）。

```bash
export NEXT_PUBLIC_SITE_URL=http://crealink.shop
export PARTS_API_BASE_URL=http://127.0.0.1:3001
```

## Nginx（80 → Next 3000）

```nginx
server {
    listen 80;
    server_name crealink.shop www.crealink.shop;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 同时运行

- `server`：`PORT=3001`（Express + SQLite）
- `web`：`npm run start`（默认 3000）

## Sitemap

```bash
cd ../server && SITE_URL=http://crealink.shop npm run generate-part-sitemaps
```

然后重新 `npm run build`（或把生成的 `public/sitemaps/*.xml` 放到构建环境）。
