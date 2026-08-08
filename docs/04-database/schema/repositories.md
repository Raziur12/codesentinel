
---

# Step 12 — `schema/repositories.md`

```markdown
# Repositories Table

A project can contain multiple repositories.

## Repository Types

- frontend
- backend
- database
- infrastructure
- mobile
- shared
- unknown

## Providers

- github
- gitlab
- bitbucket
- local
- uploaded_zip

## Fields

| Field | Type |
|---|---|
| id | UUID |
| project_id | UUID |
| name | VARCHAR |
| provider | VARCHAR |
| url | TEXT |
| repository_type | VARCHAR |
| created_at | TIMESTAMP |