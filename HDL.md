# High Level Design (HDL) - Production URL Shortener & Analytics

## 1. System Overview
This service provides a production-grade URL Shortener that handles high-throughput link redirection and analytics collection. It separates read paths, write paths, and background processing workloads.

## 2. Architecture
The system is divided into two decoupled services sharing the same data stores:
- **API Service (Read/Write)**: Handles URL shortening requests, redirects, and serves aggregated analytics endpoints.
- **Analytics Background Worker (Processing)**: Consumes click events asynchronously from Redis and batches them into PostgreSQL.

```
                      +-------------------+
                      |    Client (User)  |
                      +---------+---------+
                                |
             +------------------+------------------+
             | POST /shorten    | GET /:code       | GET /analytics/:code
             v                  v                  v
     +---------------+  +---------------+  +---------------+
     |  API Service  |  |  API Service  |  |  API Service  |
     +-------+-------+  +-------+-------+  +-------+-------+
             |                  |                  |
             |                  | (Cache Hit)      |
             | Write DB         +-------> [ Redis Cache ]
             | & Seed Cache     |                  |
             v                  | (Cache Miss)     | Read DB
     +---------------+          v                  |
     | PostgreSQL DB |  +---------------+          |
     +---------------+  | PostgreSQL DB |          |
                        +---------------+          |
                                |                  |
                                | Queue Click      v
                                v          +---------------+
                        [ Redis Queue ]    | PostgreSQL DB |
                                |          +---------------+
                                | (Async Pop)
                                v
                       +-----------------+
                       | Analytics Worker|
                       +--------+--------+
                                |
                                | Bulk DB Write
                                v
                        +---------------+
                        | PostgreSQL DB |
                        +---------------+
```

## 3. Core Behaviors
- **Shorten URL**: Validates input URL, checks for existing active mappings, generates short code (or checks custom alias availability), writes to PostgreSQL, and seeds the Redis cache.
- **Link Expiration (TTL)**: Short links expire automatically after their TTL. Both database queries and cache lookups validate expiration.
- **Redirects (301)**: Fetches original URL from Redis (sub-millisecond lookup). On a cache miss, queries PostgreSQL and caches the result. Clicks are logged asynchronously to a Redis Queue.
- **Worker Batching**: The background worker polls the Redis queue, pops click logs in batches, bulk-inserts them into PostgreSQL, and increments click counters atomically.
- **Abuse Control**: Rate limiting restricts the rate of `POST /shorten` requests per client IP.

## 4. Reliability & Performance Choices
- **Idempotency & Redundancy**: If Redis is offline, the API service degrades gracefully, falling back to direct database writes and lookups.
- **Database Index Optimization**: Performance-critical indexes are created on `originalUrl`, `expiresAt`, `urlId`, and `timestamp` using raw SQL index creation with `IF NOT EXISTS` syntax to prevent server startup errors.
- **Transactional Consistency**: Worker processes batch clicks inside SQL transactions to guarantee click integrity.
