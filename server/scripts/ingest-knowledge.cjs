#!/usr/bin/env node
require("dotenv").config();
const { ingestKnowledgeDir } = require("../src/desk-rag");

ingestKnowledgeDir()
  .then((r) => {
    console.log("[ingest-knowledge] done", r);
  })
  .catch((err) => {
    console.error("[ingest-knowledge] failed:", err);
    process.exit(1);
  });
