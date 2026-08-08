# Scalability Architecture

## Horizontal Scaling

The API layer must be stateless.

```text
                    Load Balancer
                         |
              +----------+----------+
              |          |          |
             API        API        API
              |          |          |
              +----------+----------+
                         |
                       Redis
                         |
                 +-------+-------+
                 |               |
               Worker          Worker
```

## Worker Scaling

Worker count should increase according to queue depth.

Example:

```text
Queue < 10 jobs
    -> 1 Worker

Queue 10-50
    -> 3 Workers

Queue 50-200
    -> 10 Workers

Queue > 200
    -> Auto Scaling
```

These values are initial design targets and must be validated through load testing.

## Database Scaling

Stage 1:

Single PostgreSQL instance.

Stage 2:

Read replicas.

Stage 3:

Partitioning and workload-specific optimization.

Stage 4:

Sharding only when justified by measured workload.

## Object Storage

Large files and scan artifacts must not be stored directly inside PostgreSQL.

Object storage should be used for:

- ZIP files
- Logs
- Reports
- Build artifacts