# API Versioning

CodeSentinel APIs use URL-based versioning.

Example:

`/api/v1/projects`

Future breaking version:

`/api/v2/projects`

## Rules

A new API version is required when:

- Existing response contracts change incompatibly.
- Required fields are removed.
- Existing behavior changes significantly.
- Authentication behavior changes.

Non-breaking changes may be added to the existing version.

Examples:

- New optional response field
- New endpoint
- New optional request field