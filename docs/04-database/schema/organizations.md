# Organizations Table

## Purpose

Represents a tenant/company.

## Fields

| Field | Type | Required |
|---|---|---:|
| id | UUID | Yes |
| name | VARCHAR | Yes |
| slug | VARCHAR | Yes |
| status | VARCHAR | Yes |
| created_at | TIMESTAMP | Yes |
| updated_at | TIMESTAMP | Yes |

## Relationships

Organization has:

- Members
- Workspaces