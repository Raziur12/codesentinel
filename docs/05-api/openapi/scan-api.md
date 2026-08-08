
---

# 5.9 Scan API

`docs/05-api/openapi/scan-api.md`

Ye **CodeSentinel ka core API** hai.

```markdown
# Scan API

## Start Scan

`POST /api/v1/projects/{projectId}/scans`

Request:

```json
{
  "branch": "main",
  "scanProfile": "production"
}