
---

# Step 4 — `multi-tenancy.md`

```markdown
# Multi-Tenancy Architecture

CodeSentinel will use organization-based multi-tenancy.

## Tenant Hierarchy

```text
Organization
    |
    +-- Members
    |
    +-- Workspaces
          |
          +-- Projects
                |
                +-- Repositories
                |
                +-- Scans
                |
                +-- Findings
                |
                +-- Reports