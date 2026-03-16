# 部署后无法通过 IP 访问 — 排查步骤

部署脚本跑完后，浏览器访问 **http://服务器IP** 打不开，按下面顺序排查。

---

## 1. 确认应用是否在跑

在服务器上执行：

```bash
cd /home/admin/testback/web   # 或你的 web 目录
pm2 status
```

- 若看到 `crealink-web` 且 status 为 **online**，说明进程正常。
- 若为 **errored** 或 **stopped**，看日志：`pm2 logs crealink-web`。

再在本机测 3000 端口是否通：

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
```

若返回 **200**，说明 Next.js 在 3000 端口正常响应。

---

## 2. 用「IP:3000」访问（必做）

Next.js 默认监听 **3000** 端口，不是 80。

在浏览器访问：

```text
http://你的公网IP:3000
```

例如：`http://47.96.123.456:3000`

- 若这样能打开，说明应用正常，只是没走 80 端口。
- 若这样也打不开，继续下面步骤。

---

## 3. 放行 3000 端口（阿里云安全组）

若 **IP:3000** 在服务器本机 `curl` 正常，但外网打不开，多半是安全组没放行。

1. 登录 **阿里云控制台** → **ECS** → 找到该实例。
2. 点击 **安全组** → **配置规则** → **入方向** → **手动添加**。
3. 端口范围填 **3000/3000**，授权对象 **0.0.0.0/0**，保存。
4. 再在浏览器访问 **http://公网IP:3000**。

---

## 4. 用 80 端口访问（可选，需 Nginx）

若希望直接访问 **http://公网IP**（不带 :3000），需要 Nginx 把 80 转到 3000。

### 4.1 安装 Nginx（未安装时）

```bash
sudo dnf install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4.2 使用示例配置

项目里已提供示例配置：

```bash
cd /home/admin/testback/web/scripts
sudo cp nginx-crealink.conf.example /etc/nginx/conf.d/crealink.conf
sudo nano /etc/nginx/conf.d/crealink.conf
```

把 `server_name your_server_ip;` 改成你的公网 IP 或域名（没有域名可改为 `_` 或 `default_server`），保存。

### 4.3 启用并重载

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4.4 安全组放行 80

在阿里云安全组 **入方向** 添加端口 **80**，授权对象 **0.0.0.0/0**。

然后访问 **http://公网IP** 即可打开项目。

---

## 5. 本机防火墙（若有）

若服务器上开了 firewalld，需放行 3000（或 80）：

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
# 若用 Nginx 则：sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload
```

---

## 小结

| 现象           | 处理方式 |
|----------------|----------|
| 访问 http://IP 无响应 | 先试 **http://IP:3000**；并检查安全组是否放行 3000。 |
| 希望用 http://IP 不加端口 | 安装 Nginx，用 80 反代到 3000，并放行安全组 80。 |
| PM2 显示异常   | 执行 `pm2 logs crealink-web` 看报错，再根据报错排查。 |
