# Production-Grade URL Shortener & Link Analytics Service

This is a highly scalable, production-grade URL Shortener and Link Analytics service built using Node.js, Express, PostgreSQL (via Sequelize ORM), and Redis.

## Architectural Overview

To meet production-grade scaling requirements, the application separates the **Write/Read API path** from the **Analytics processing path** (CQRS-inspired architecture):

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

1. **Write Path (`POST /shorten`)**: Validates the URL, checks for duplicates, creates a short code (or custom alias), writes to PostgreSQL, and seeds the Redis cache.
2. **Read Path (`GET /:code`)**: Resolves the short code from the Redis cache. On a cache miss, it falls back to PostgreSQL and populates the cache.
3. **Analytics Path (`GET /analytics/:code`)**: Fetches stats and recent click history directly from PostgreSQL.
4. **Decoupled Click Logger (Scaling Feature)**: Instead of writing to PostgreSQL synchronously on every redirect (which degrades latency and saturates the DB connection pool), the API pushes click metadata to a Redis List (`queue:clicks`).
5. **Background Analytics Worker**: A standalone process (`src/worker.js`) polls the Redis queue, pops click events in batches (e.g., 100 at a time), bulk-inserts them into PostgreSQL (`Click.bulkCreate`), and increments the corresponding URL clicks count using atomic database updates.

---

## Features

- **Duplicate URL Handling**: Reuses the same short code when the same URL is shortened without a custom alias (canonical mapping).
- **Custom Aliases**: Supports custom aliases; rejects request with `409 Conflict` if the alias is already in use.
- **Cache-Verified TTL**: Links expire automatically after a TTL. The Redis cache layer strictly validates record expiration dates, preventing expired links from being served.
- **Graceful Degradation**: If Redis goes offline, the API service automatically falls back to direct PostgreSQL queries for redirects and click logging, maintaining system availability.
- **Rate Limiting**: Includes a rate limiter on the URL creation endpoint to prevent abuse.
- **Robust Database Syncing**: Solved the Sequelize `alter: true` index collision bugs by disabling alter sync and creating custom database indexes safely with `CREATE INDEX IF NOT EXISTS` raw SQL queries on boot.

---

## Installation & Setup

### Prerequisites

- **Node.js** (v18+)
- **PostgreSQL**
- **Redis**

### Setup Environment

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file based on `.env.example`:

   ```bash
   cp .env.example .env
   ```

3. Update the `.env` file with your database and Redis connections:
   ```env
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/paytm_url_shortener
   REDIS_URL=redis://localhost:6379
   ```

---

## Running the Services

In production, you should scale the API Service and Analytics Worker independently.

### Running in Single-Process (Combined) Mode (Convenient for Dev)

Starts the API server. In this mode, click logs are queued in Redis, and you can run the worker separately.

```bash
npm run dev
```

### Running in Multi-Process / Split Mode (Production Style)

1. **Start the API Server**:

   ```bash
   npm run dev
   ```

2. **Start the Analytics Worker Process** (in a separate terminal or container):
   ```bash
   npm run dev:worker
   ```

---

## Running Automated Tests

We use Jest to run the automated unit tests. All tests run fully isolated with mocked databases and Redis servers.

To run the tests:

```bash
npm test
```

---

## API Documentation

### 1. Shorten URL

- **Endpoint**: `POST /shorten` (or `/api/shorten`)
- **Body**:
  ```json
  {
    "url": "https://example.com/some/long/path",
    "alias": "optionalCustomAlias",
    "expiresInDays": 30
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "status": "success",
    "data": {
      "originalUrl": "https://example.com/some/long/path",
      "shortCode": "optionalCustomAlias",
      "shortUrl": "http://localhost:3000/optionalCustomAlias",
      "ttlDays": 30,
      "expiresAt": "2026-07-11T06:10:00.000Z"
    }
  }
  ```

### 2. Redirect URL

- **Endpoint**: `GET /:code`
- **Response (301 Permanent Redirect)**:
  Redirects to original long URL.

### 3. Link Analytics

- **Endpoint**: `GET /analytics/:code` (or `/api/analytics/:code`)
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "shortCode": "ex",
      "originalUrl": "https://example.com",
      "expiresAt": "2026-07-11T06:10:00.000Z",
      "ttlDays": 30,
      "totalClicks": 105,
      "recentClicks": [
        {
          "id": "uuid-click-1",
          "urlId": "uuid-url-1",
          "userAgent": "Mozilla/5.0...",
          "ipAddress": "127.0.0.1",
          "referrer": "https://google.com",
          "timestamp": "2026-06-11T06:12:00.000Z"
        }
      ]
    }
  }
  ```
