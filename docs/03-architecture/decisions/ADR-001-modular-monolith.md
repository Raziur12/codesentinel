# ADR-001: Modular Monolith for Initial Architecture

## Status

Accepted

## Context

CodeSentinel is initially being developed by a solo developer.

A full microservices architecture would introduce unnecessary operational complexity during the early development phase.

## Decision

Use a Modular Monolith for the API application combined with independent background workers.

The internal modules will have clear boundaries.

## Initial Modules

- Authentication
- Users
- Organizations
- Projects
- Repositories
- Scans
- Analysis
- AI
- Reports
- Billing
- Notifications

## Future Migration

Any module may later be extracted into an independent service if:

- It requires independent scaling.
- It has a different deployment lifecycle.
- It has significantly different resource requirements.
- Operational complexity is justified.

## Consequences

### Positive

- Faster development
- Easier local development
- Easier debugging
- Lower infrastructure cost
- Simpler deployment

### Negative

- Larger application codebase
- Strong module boundaries must be maintained
- Future extraction may require additional work