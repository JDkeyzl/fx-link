const path = require("path");

module.exports = {
  apps: [
    {
      name: "crealink-backend",
      cwd: __dirname,
      script: path.join(__dirname, "src", "server.js"),
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};

