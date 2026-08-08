# Authentication

CodeSentinel APIs require authentication except for explicitly public endpoints.

## Authentication Flow

```mermaid
sequenceDiagram

    actor User
    participant Client
    participant API
    participant Auth
    participant DB

    User->>Client: Login
    Client->>API: POST /auth/login
    API->>Auth: Validate Credentials
    Auth->>DB: Find User
    DB-->>Auth: User
    Auth-->>API: Access Token
    API-->>Client: Access + Refresh Token