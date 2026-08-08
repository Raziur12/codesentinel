# CodeSentinel API Architecture

## Base URL

Production:

`https://api.codesentinel.example.com`

Development:

`http://localhost:4000`

## API Style

CodeSentinel uses REST APIs for the primary application interface.

## Format

Request and response bodies use JSON.

## API Prefix

All APIs use:

`/api/v1`

Example:

`GET /api/v1/projects`

## Main API Domains

- Authentication
- Organizations
- Workspaces
- Projects
- Repositories
- Scans
- Findings
- AI Analysis
- Fixes
- Reports
- Users