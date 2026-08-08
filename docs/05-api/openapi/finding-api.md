
---

# 5.10 Findings API

`docs/05-api/openapi/finding-api.md`

```markdown
# Finding API

## Get Findings

`GET /api/v1/scans/{scanId}/findings`

Query parameters:

- severity
- category
- status
- page
- limit

Example:

`GET /api/v1/scans/123/findings?severity=critical`

---

## Get Finding

`GET /api/v1/findings/{findingId}`

---

## Analyze Finding

`POST /api/v1/findings/{findingId}/analyze`

AI will return:

- Root cause
- Explanation
- Suggested fix
- Confidence
- Related files

---

## Generate Fix

`POST /api/v1/findings/{findingId}/fix`

Important:

AI-generated fixes must NOT automatically be merged into production.

They must go through validation.