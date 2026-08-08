# Users Table

## Purpose

Stores CodeSentinel user accounts.

## Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| email | VARCHAR | Yes | Unique email |
| name | VARCHAR | Yes | Display name |
| status | VARCHAR | Yes | Account status |
| created_at | TIMESTAMP | Yes | Creation time |
| updated_at | TIMESTAMP | Yes | Last update |

## Constraints

- id is primary key
- email is unique
- status must use an allowed value

## Security

Passwords must never be stored as plain text.

Authentication credentials should use a secure password hashing algorithm or external identity provider.