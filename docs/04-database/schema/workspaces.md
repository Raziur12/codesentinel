# Workspaces Table

A workspace groups related projects inside an organization.

## Fields

| Field | Type | Required |
|---|---|---:|
| id | UUID | Yes |
| organization_id | UUID | Yes |
| name | VARCHAR | Yes |
| slug | VARCHAR | Yes |
| created_at | TIMESTAMP | Yes |

## Relationship

Organization

↓

Workspace

↓

Projects