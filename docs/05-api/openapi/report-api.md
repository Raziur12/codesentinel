# Report API

## Get Report

`GET /api/v1/scans/{scanId}/report`

Example response:

```json
{
  "scanId": "uuid",
  "overallScore": 87,
  "status": "production_ready",
  "scores": {
    "security": 91,
    "quality": 84,
    "performance": 88,
    "testing": 86
  }
}