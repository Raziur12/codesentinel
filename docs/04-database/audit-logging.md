# Audit Logging

CodeSentinel will maintain an audit trail for security-sensitive operations.

## Events

Examples:

- User login
- User logout
- Project created
- Repository connected
- Scan started
- Scan cancelled
- Fix approved
- Fix applied
- Organization member added
- Organization member removed
- API key created
- API key revoked

## Audit Event

```text
AuditEvent

id
organization_id
user_id
action
resource_type
resource_id
metadata
ip_address
user_agent
created_at