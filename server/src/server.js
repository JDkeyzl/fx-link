require("dotenv").config();

const express = require("express");
const cors = require("cors");
const partsRouter = require("./routes/parts");
const adminUploadRouter = require("./routes/adminUpload");
const deskRouter = require("./routes/desk");
const { ragStatus, ingestKnowledgeDir } = require("./desk-rag");

const PORT = Number(process.env.PORT || 3001);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "x-admin-upload-key",
      "x-admin-key",
      "Accept",
      "Accept-Language",
    ],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  })
);

app.use(express.json({ limit: "1mb" }));

app.use("/", adminUploadRouter);
app.use("/", partsRouter);
app.use("/", deskRouter);

app.get("/", (_req, res) => {
  res.send("crealink-backend: ok");
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

async function boot() {
  try {
    const status = ragStatus();
    if (!status.chunks) {
      const r = await ingestKnowledgeDir();
      console.log("[backend] knowledge auto-ingested", r);
    } else {
      console.log(`[backend] knowledge ready: ${status.chunks} chunks`);
    }
  } catch (err) {
    console.warn("[backend] knowledge ingest skipped:", err.message);
  }

  app.listen(PORT, () => {
    console.log(`[backend] listening on :${PORT}`);
  });
}

boot();
