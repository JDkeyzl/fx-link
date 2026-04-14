const express = require("express");
const cors = require("cors");
const partsRouter = require("./routes/parts");
const adminUploadRouter = require("./routes/adminUpload");

const PORT = Number(process.env.PORT || 3001);

const app = express();
app.disable("x-powered-by");

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "x-admin-upload-key",
      "Accept",
      "Accept-Language",
    ],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  })
);

// Basic JSON response. For SEO/SSR metadata, frontend should call this API and render its own HTML.
app.use(express.json({ limit: "1mb" }));

app.use("/", adminUploadRouter);
app.use("/", partsRouter);

// Simple root response for health-checks.
app.get("/", (_req, res) => {
  res.send("crealink-backend: ok");
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on :${PORT}`);
});

