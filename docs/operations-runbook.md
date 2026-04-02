# Operations runbook (scale and production)

This document complements the chat platform roadmap: how to run **Redis**, **PostgreSQL**, and **WebSockets** reliably under load, and how to **load-test** WS paths.

## Horizontal scaling (API + WebSocket)

- Run **multiple Nest instances** behind a load balancer. HTTP must stay **stateless** (no in-memory session as the source of truth).
- **Redis pub/sub** is the shared bus: every instance `PUBLISH`es to the same channel; each instance’s WS clients `SUBSCRIBE` on their own connections. No sticky sessions are required for correctness if all instances use the **same Redis URL**.
- Prefer a **managed Redis** (ElastiCache, Memorystore, Redis Cloud) with **high availability** (replication / failover). For pub/sub, confirm your provider documents pub/sub behavior during failover (brief disconnects are normal; clients should reconnect).
- Set **memory limits** and monitor **eviction policy**. Pub/sub channels should not be evicted like cache keys; still avoid running Redis out of memory.

## PostgreSQL and connection pooling

- Under high concurrency, use **PgBouncer** (or the pooler your host provides) in **transaction** mode in front of Postgres to cap connections to the database.
- Tune Nest/TypeORM **pool size** to match what PgBouncer allows per instance (avoid opening thousands of direct DB connections).
- Add **read replicas** for read-heavy workloads (listing threads/messages) once the primary becomes the bottleneck; your app would need routing reads to replicas (not implemented in this repo by default).
- Plan **archival** or **partitioning** for `chat_messages` when history grows (time-based partitions or cold storage).

## Kafka

- **Producers**: keep the HTTP path fast; failures should degrade gracefully (your producer already catches errors where appropriate).
- **Consumers**: run separate worker processes with **consumer groups** for notifications, search indexing, analytics. Tune **partitions** and use **message keys** (e.g. `threadId`) for per-thread ordering.
- Monitor **consumer lag** and **broker disk** in production.

## WebSocket load testing

- WS is **long-lived**; load tests must simulate **concurrent connections**, not only HTTP RPS.
- Example tools: **k6** (with WebSocket support), **Artillery**, or custom scripts using `ws` clients.
- Scenarios to cover:
  - Connect with valid `token` query param (see [`src/chat/chat.gateway.ts`](../src/chat/chat.gateway.ts)).
  - Subscribe to a `threadId` and verify messages received when another client posts via REST.
  - Reconnect after disconnect (Redis subscription teardown is per connection).
- Watch **file descriptor limits** and **Node heap** on servers handling many open sockets.

## JWT and secrets

- Set a strong **`JWT_SECRET`** in production (see [`src/config/configuration.ts`](../src/config/configuration.ts)).
- Replace **`POST /api/auth/token`** with real login (password/OAuth) before production; the current endpoint is suitable for development only.

## Observability

- Add structured logging, metrics (p50/p95 latency, error rate, WS connection count), and tracing before scaling traffic.
- Alert on Redis/Kafka/Postgres health and on **5xx** rate from the API.

## Rate limiting and abuse

- Add **rate limits** per IP and per user (e.g. `@nestjs/throttler` or API gateway rules).
- Keep request body limits (already configured in [`src/main.ts`](../src/main.ts)) and validate payloads at the boundary.
