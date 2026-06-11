# Low Level Design (LLD) - Production URL Shortener & Analytics

## 1. Endpoint Contract

### `POST /shorten`
- Alias: `POST /api/shorten`
- **Body**: `{ "url": string, "alias"?: string, "expiresInDays"?: number }`
- **Validation**: URL must pass `validator.isURL`.
- **Behavior**:
  - If `alias` is provided:
    - Validate that the alias is at least 6 characters in length. If not, return `400 Bad Request`.
    - Verify availability in DB using `findURLByShortCode`.
    - If already taken by the **same** original URL, reuse it idempotently and return it.
    - If taken by a **different** original URL, return `409 Conflict`.
  - If `alias` is not provided:
    - Check if this URL was already shortened (auto-generated canonical mapping). If found, return it.
    - Otherwise, auto-generate a unique 7-character short code (minimum of 6 characters).
  - Saves record to PostgreSQL and seeds Redis cache (`SET url:{code} data EX {ttl}`).

### `GET /:code`
- **Behavior**:
  - Attempt lookup in Redis (`GET url:{code}`).
  - If hit, check `expiresAt`. If expired, run `DEL url:{code}` and throw `404`. Otherwise, return original URL.
  - If miss, lookup in PostgreSQL. If found, save to Redis cache and return. Otherwise, throw `404`.
  - Push click event to Redis Queue (`LPUSH queue:clicks clickEventJson`).
  - Redirect client with `301 Moved Permanently`.

### `GET /analytics/:code`
- Alias: `GET /api/analytics/:code`
- **Behavior**:
  - Fetch link details and recent clicks directly from PostgreSQL.
  - Returns `404` if the code does not exist.

---

## 2. Store Schema

### Url Model (`Urls` table)
- `id`: UUID (Primary Key)
- `originalUrl`: TEXT (Indexed)
- `shortCode`: VARCHAR(255) (Unique Index)
- `customAlias`: BOOLEAN
- `ttlDays`: INTEGER
- `expiresAt`: TIMESTAMP (Indexed)
- `clicksCount`: INTEGER
- `createdAt`: TIMESTAMP
- `updatedAt`: TIMESTAMP

### Click Model (`Clicks` table)
- `id`: UUID (Primary Key)
- `urlId`: UUID (Foreign Key, Indexed)
- `userAgent`: TEXT
- `ipAddress`: VARCHAR(45)
- `referrer`: TEXT
- `timestamp`: TIMESTAMP (Indexed)

---

## 3. Module Responsibilities

- `src/server.js`: API Service entry point. Initializes databases and boots HTTP server.
- `src/worker.js`: Analytics Worker entry point. Initializes databases and starts queue consumer loop.
- `src/workers/analytics.worker.js`: Implements the batch polling logic. Executes `Click.bulkCreate` and `Url.increment` in single database transactions.
- `src/controllers/url.controller.js`: Handles Express request extraction and controller mapping.
- `src/services/url.service.js`: Orchestrates business logic, URL validation, cache expiration checks, and Single-Flight cache stampede protection.
- `src/services/analytics.service.js`: Handles click queueing to Redis and fetching analytics stats from the store.
- `src/store/link-store.js`: PostgreSQL queries and database persistence layers.
- `src/store/cache-store.js`: Redis cache set, get, and delete operations.
- `src/config/database.js`: PostgreSQL connection pool setup, write/read replication routing, and safe index creation.
- `src/config/redis.js`: Redis connection string and retry strategies.
- `src/middlewares/rate-limit.middleware.js`: Enforces distributed rate limiting using Redis-based sliding counters with fail-open safety.
