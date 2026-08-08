
---

# 5.6 Error Handling

`docs/05-api/errors/error-handling.md`

```markdown
# API Error Handling

All API errors should follow a consistent structure.

## Example

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project was not found",
    "requestId": "req_123456"
  }
}