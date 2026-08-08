# Deployment Architecture

## Initial Production Architecture

```mermaid
flowchart TB

    INTERNET[Internet]

    CDN[CDN / WAF]

    LB[Load Balancer]

    API1[API Instance 1]
    API2[API Instance 2]

    WORKER1[Worker 1]
    WORKER2[Worker 2]

    REDIS[(Redis)]

    DB[(PostgreSQL)]

    STORAGE[(Object Storage)]

    RUNNER1[Docker Runner]
    RUNNER2[Docker Runner]

    INTERNET --> CDN
    CDN --> LB

    LB --> API1
    LB --> API2

    API1 --> REDIS
    API2 --> REDIS

    API1 --> DB
    API2 --> DB

    API1 --> STORAGE
    API2 --> STORAGE

    REDIS --> WORKER1
    REDIS --> WORKER2

    WORKER1 --> RUNNER1
    WORKER2 --> RUNNER2
```

## Scaling Strategy

API servers are stateless and can be horizontally scaled.

Workers can be independently scaled according to scan queue depth.

Docker runners are isolated and disposable.

Database scaling will initially use vertical scaling followed by read replicas when required.