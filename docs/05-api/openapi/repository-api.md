
---

# 5.8 Repository API

Ye tumhare original **frontend + backend separate repositories** wale requirement ke liye important hai.

`docs/05-api/openapi/repository-api.md`

```markdown
# Repository API

A single CodeSentinel Project may contain multiple repositories.

## Add Repository

`POST /api/v1/projects/{projectId}/repositories`

Request:

```json
{
  "provider": "github",
  "repositoryType": "frontend",
  "url": "https://github.com/example/frontend.git",
  "branch": "main"
}