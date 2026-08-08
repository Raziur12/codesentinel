
---

# Step 3 — `er-diagram.md`

Ye **core ER diagram** hai:

```markdown
# Entity Relationship Diagram

```mermaid
erDiagram

    USERS ||--o{ ORGANIZATION_MEMBERS : belongs_to

    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : has

    ORGANIZATIONS ||--o{ WORKSPACES : owns

    WORKSPACES ||--o{ PROJECTS : contains

    PROJECTS ||--o{ REPOSITORIES : contains

    REPOSITORIES ||--o{ BRANCHES : has

    PROJECTS ||--o{ SCANS : has

    SCANS ||--o{ SCAN_JOBS : contains

    SCANS ||--o{ FINDINGS : produces

    FINDINGS ||--o{ AI_ANALYSES : analyzed_by

    FINDINGS ||--o{ FIXES : has

    SCANS ||--o{ TEST_RESULTS : produces

    SCANS ||--|| REPORTS : generates

    USERS {
        uuid id PK
        string email UK
        string name
        string status
        timestamp created_at
        timestamp updated_at
    }

    ORGANIZATIONS {
        uuid id PK
        string name
        string slug UK
        string status
        timestamp created_at
        timestamp updated_at
    }

    ORGANIZATION_MEMBERS {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string role
        timestamp created_at
    }

    WORKSPACES {
        uuid id PK
        uuid organization_id FK
        string name
        string slug
        timestamp created_at
    }

    PROJECTS {
        uuid id PK
        uuid workspace_id FK
        string name
        string slug
        string status
        timestamp created_at
        timestamp updated_at
    }

    REPOSITORIES {
        uuid id PK
        uuid project_id FK
        string name
        string provider
        string url
        string repository_type
        timestamp created_at
    }

    BRANCHES {
        uuid id PK
        uuid repository_id FK
        string name
        string commit_sha
        boolean is_default
    }

    SCANS {
        uuid id PK
        uuid project_id FK
        string status
        string trigger_type
        timestamp started_at
        timestamp completed_at
        timestamp created_at
    }

    SCAN_JOBS {
        uuid id PK
        uuid scan_id FK
        string job_type
        string status
        integer attempt
        timestamp started_at
        timestamp completed_at
    }

    FINDINGS {
        uuid id PK
        uuid scan_id FK
        string severity
        string category
        string title
        text description
        string file_path
        integer line_number
        string status
        timestamp created_at
    }

    AI_ANALYSES {
        uuid id PK
        uuid finding_id FK
        string provider
        string model
        text root_cause
        text recommendation
        decimal confidence
        timestamp created_at
    }

    FIXES {
        uuid id PK
        uuid finding_id FK
        text patch
        string status
        timestamp created_at
    }

    TEST_RESULTS {
        uuid id PK
        uuid scan_id FK
        string test_type
        integer total
        integer passed
        integer failed
        integer skipped
        timestamp created_at
    }

    REPORTS {
        uuid id PK
        uuid scan_id FK
        string report_type
        string storage_key
        decimal overall_score
        timestamp created_at
    }