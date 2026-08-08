
---

# 5.12 `endpoints.md`

Ab ek central API catalogue:

```markdown
# API Endpoint Catalogue

## Authentication

| Method | Endpoint |
|---|---|
| POST | /api/v1/auth/register |
| POST | /api/v1/auth/login |
| POST | /api/v1/auth/refresh |
| POST | /api/v1/auth/logout |

## Organizations

| Method | Endpoint |
|---|---|
| POST | /api/v1/organizations |
| GET | /api/v1/organizations |
| GET | /api/v1/organizations/{id} |

## Projects

| Method | Endpoint |
|---|---|
| POST | /api/v1/projects |
| GET | /api/v1/projects |
| GET | /api/v1/projects/{id} |
| PATCH | /api/v1/projects/{id} |
| DELETE | /api/v1/projects/{id} |

## Repositories

| Method | Endpoint |
|---|---|
| POST | /api/v1/projects/{id}/repositories |
| GET | /api/v1/projects/{id}/repositories |
| DELETE | /api/v1/repositories/{id} |

## Scans

| Method | Endpoint |
|---|---|
| POST | /api/v1/projects/{id}/scans |
| GET | /api/v1/scans/{id} |
| POST | /api/v1/scans/{id}/cancel |
| GET | /api/v1/scans/{id}/findings |
| GET | /api/v1/scans/{id}/report |

## Findings

| Method | Endpoint |
|---|---|
| GET | /api/v1/findings/{id} |
| POST | /api/v1/findings/{id}/analyze |
| POST | /api/v1/findings/{id}/fix |

## Reports

| Method | Endpoint |
|---|---|
| GET | /api/v1/scans/{id}/report |
| GET | /api/v1/scans/{id}/report/download |