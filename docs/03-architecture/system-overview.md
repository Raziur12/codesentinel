# CodeSentinel System Architecture

## Architecture Style

CodeSentinel uses a Modular Monolith + Worker Architecture for the initial production release.

The architecture is intentionally designed so individual modules can later be extracted into independent microservices.

## High-Level Flow

```mermaid
flowchart TD

    DEV[Developer]

    WEB[Web Dashboard]
    EXT[VS Code Extension]

    API[CodeSentinel API]

    DB[(PostgreSQL)]
    REDIS[(Redis)]
    STORAGE[(Object Storage)]

    QUEUE[Scan Queue]

    WORKER[Scan Worker]
    RUNNER[Isolated Docker Runner]

    STATIC[Static Analysis]
    RUNTIME[Runtime Analysis]
    SECURITY[Security Analysis]

    AI[AI Analysis Engine]

    REPORT[Report Generator]

    DEV --> WEB
    DEV --> EXT

    WEB --> API
    EXT --> API

    API --> DB
    API --> REDIS
    API --> STORAGE

    API --> QUEUE

    QUEUE --> WORKER
    WORKER --> RUNNER

    RUNNER --> STATIC
    RUNNER --> RUNTIME
    RUNNER --> SECURITY

    STATIC --> AI
    RUNTIME --> AI
    SECURITY --> AI

    AI --> REPORT

    REPORT --> STORAGE
    REPORT --> API
```

## Core Components

### API Server

Responsible for:

- Authentication
- Authorization
- Projects
- Repositories
- Scan management
- Reports
- User settings

### Scan Worker

Responsible for executing asynchronous scan jobs.

### Docker Runner

Provides isolated project execution.

### AI Engine

Responsible for:

- Root cause analysis
- Error classification
- Fix generation
- Fix verification

### PostgreSQL

Stores application metadata.

### Redis

Used for:

- Queue
- Cache
- Job state
- Distributed coordination

### Object Storage

Stores:

- Uploaded projects
- Build logs
- Scan artifacts
- Reports