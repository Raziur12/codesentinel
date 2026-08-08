# Database Architecture

## Database Engine

CodeSentinel will use PostgreSQL as the primary relational database.

## Why PostgreSQL?

PostgreSQL provides:

- ACID transactions
- Strong relational modelling
- JSONB support
- Advanced indexing
- Foreign keys
- Constraints
- Full-text search capabilities
- Reliable ecosystem
- Managed cloud availability

## Database Responsibilities

PostgreSQL stores application metadata and structured scan information.

The database should NOT be used as the primary storage location for large project ZIP files, build artifacts or large raw logs.

Those assets will be stored in object storage.

## High-Level Data Flow

```mermaid
flowchart LR

    API[API Server]

    DB[(PostgreSQL)]

    STORAGE[(Object Storage)]

    API --> DB
    API --> STORAGE

    DB --> META[Metadata]

    STORAGE --> FILES[Projects / Logs / Reports]