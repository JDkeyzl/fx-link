/**
 * PM2 进程配置，用于阿里云服务器上常驻运行 Next.js
 * 使用方式：在项目 web 目录下执行 pm2 start ecosystem.config.cjs
 */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "crealink-web",
      cwd: __dirname,
      script: path.join(__dirname, "node_modules/next/dist/bin/next"),
      args: "start",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // 公网域名（HTTP；上 HTTPS 后改为 https://crealink.shop 并重新 build）
        NEXT_PUBLIC_SITE_URL: "http://crealink.shop",
        // SSR 查零件 API：必须指向本机后端，不要写公网域名
        PARTS_API_BASE_URL: "http://127.0.0.1:3001",
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
