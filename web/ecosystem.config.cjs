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
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
