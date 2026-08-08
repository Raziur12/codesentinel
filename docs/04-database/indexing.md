
---

# Step 5 — `indexing.md`

```markdown
# Database Indexing Strategy

Indexes will be created based on actual query patterns.

## Initial Indexes

### Users

- unique(email)

### Organizations

- unique(slug)

### Organization Members

- organization_id
- user_id
- unique(organization_id, user_id)

### Workspaces

- organization_id
- unique(organization_id, slug)

### Projects

- workspace_id
- unique(workspace_id, slug)

### Repositories

- project_id

### Scans

- project_id
- status
- created_at

### Findings

- scan_id
- severity
- status
- category

### Reports

- scan_id

## Important Rule

Do not create indexes for every column.

Indexes increase:

- Storage
- INSERT cost
- UPDATE cost
- Maintenance cost

Indexes must be justified by query patterns.