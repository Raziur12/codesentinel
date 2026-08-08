
---

# Step 7 — `backup-recovery.md`

```markdown
# Backup and Recovery

## Database Backup Strategy

Production PostgreSQL should use:

- Automated backups
- Point-in-time recovery where supported
- Backup retention policy
- Encryption
- Periodic restore testing

## Recovery Objectives

Initial targets:

RPO:
15 minutes

RTO:
1 hour

These targets must be validated against the selected cloud provider and infrastructure.

## Important

A backup is not considered reliable until a restore has been successfully tested.