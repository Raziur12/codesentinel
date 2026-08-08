# C4 Container Architecture

```mermaid
flowchart TB

    USER[User]

    WEB[Web Dashboard]
    EXT[VS Code Extension]

    API[API Application]

    AUTH[Authentication Module]
    PROJECT[Project Module]
    SCAN[Scan Orchestrator]
    REPORT[Report Module]

    QUEUE[(Redis Queue)]

    WORKER[Scan Worker]

    RUNNER[Docker Sandbox]

    ANALYZER[Analysis Engine]

    AI[AI Engine]

    DB[(PostgreSQL)]

    STORAGE[(Object Storage)]

    USER --> WEB
    USER --> EXT

    WEB --> API
    EXT --> API

    API --> AUTH
    API --> PROJECT
    API --> SCAN
    API --> REPORT

    API --> DB
    API --> STORAGE

    SCAN --> QUEUE
    QUEUE --> WORKER

    WORKER --> RUNNER
    RUNNER --> ANALYZER

    ANALYZER --> AI

    AI --> REPORT
```

## Container Responsibilities

| Container | Responsibility |
|---|---|
| Web Dashboard | User interface |
| VS Code Extension | IDE integration |
| API | Application backend |
| Scan Worker | Background processing |
| Docker Runner | Secure execution |
| Analysis Engine | Static/runtime/security analysis |
| AI Engine | Reasoning and patch generation |
| PostgreSQL | Persistent metadata |
| Redis | Queue/cache |
| Object Storage | Files and artifacts |