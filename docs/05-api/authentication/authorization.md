
---

# 5.5 Authorization

`docs/05-api/authentication/authorization.md`

```markdown
# Authorization

Authentication answers:

"Who are you?"

Authorization answers:

"What are you allowed to do?"

## Initial Roles

- Owner
- Admin
- Developer
- QA
- Viewer

## Example Permissions

| Role | Scan | Manage Project | Manage Members |
|---|---:|---:|---:|
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |
| Developer | Yes | Yes | No |
| QA | Yes | No | No |
| Viewer | No | No | No |

## Resource Authorization

A user must belong to the organization that owns the requested resource.

Example:

```text
Request
   ↓
Authenticate
   ↓
Get Organization
   ↓
Check Membership
   ↓
Check Permission
   ↓
Access Resource