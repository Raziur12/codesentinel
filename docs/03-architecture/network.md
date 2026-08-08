# Network Architecture

## Network Zones

### Public Zone

Contains:

- CDN
- WAF
- Load Balancer

### Application Zone

Contains:

- API
- Workers

### Data Zone

Contains:

- PostgreSQL
- Redis
- Object Storage

### Execution Zone

Contains:

- Docker Sandboxes

## Security Principle

The project being scanned must never have unrestricted access to internal infrastructure.

Runner containers must operate with:

- CPU limits
- Memory limits
- Execution timeout
- Restricted network access
- Temporary filesystem
- Non-root execution where possible