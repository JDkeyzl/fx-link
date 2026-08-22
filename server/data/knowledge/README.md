# Knowledge base README（维护说明）

## 目录（FDE）

| 文件 | 用途 |
|------|------|
| `00-hard-rules.md` | 必须/禁止/升级人工、报价边界 |
| `01-rfq-done-definition.md` | 需求卡何时算完成、可否进报价草稿 |
| `02-brand-ask-scripts.md` | 重汽/陕汽/潍柴等缺件号追问 |
| `03-quality-and-fitment.md` | 质量档口径、不适配免责 |
| `04-market-notes.md` | 目的国/港口/证书（只写真实经验） |
| `05-objections.md` | 比价、要 CIF、只要便宜等短话术 |
| `06-incident-log.md` | 事故与客诉摘要（持续追加） |

## 标记

文中 **`[待确认]`** = 业务未拍板。人工改完后请删除该标记，避免 Desk 把不确定内容说成政策。

## 更新后重建索引

```bash
cd server
npm run ingest-knowledge
```

或生产环境：`POST /api/desk/knowledge/reindex`（需 admin key）。

## 不要写入

- 件号价目、实时库存（走 SQLite Tools）
- 无法核实的实力宣传、独家授权口号
