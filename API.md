# API Reference - URL Shortener & Link Analytics

Base URL: `http://localhost:3000`

The service accepts requests at the root paths and also under `/api` for the shorten and analytics endpoints.

## 1. Health Check

### `GET /health`

Returns basic service status.

```bash
curl http://localhost:3000/health
```

Example response:

```json
{
  "status": "OK"
}
```

## 2. Shorten URL

### `POST /shorten`

### `POST /api/shorten`

Creates a short code for a long URL.

Request payload:

```json
{
  "url": "https://example.com/some/very/long/path",
  "alias": "ex",
  "expiresInDays": 14
}
```

Field rules:

- `url` is required and must be a valid absolute URL.
- `alias` is optional.
- `expiresInDays` is optional and must be a positive integer.
- When omitted, the service uses the default TTL from `.env`.
- If the same URL is shortened again, the service returns the existing stored mapping.
- If `alias` is supplied and already exists, the request fails with `409`.
- Shorten requests are rate-limited per client IP. When the limit is exceeded, the API returns `429`.

#### cURL

```bash
curl -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/some/very/long/path",
    "alias": "ex",
    "expiresInDays": 14
  }'
```

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/some/very/long/path",
    "alias": "ex",
    "expiresInDays": 14
  }'
```

#### Success response: `201 Created`

```json
{
  "status": "success",
  "data": {
    "originalUrl": "https://example.com/some/very/long/path",
    "shortCode": "ex",
    "shortUrl": "http://localhost:3000/ex",
    "ttlDays": 14,
    "expiresAt": "2026-06-24T10:15:30.000Z"
  }
}
```

#### Error responses

```json
{
  "status": "error",
  "message": "Invalid URL provided"
}
```

```json
{
  "status": "error",
  "message": "Custom alias already in use"
}
```

```json
{
  "status": "error",
  "message": "Too many short URL creation requests. Please try again later."
}
```

## 3. Redirect

### `GET /{code}`

Resolves a short code and redirects with `301` to the original URL.

#### cURL

```bash
curl -i http://localhost:3000/ex
```

#### Success response: `301 Moved Permanently`

No JSON body is returned. The `Location` header points to the original URL.

#### Error response: `404 Not Found`

```json
{
  "status": "error",
  "message": "Short code not found"
}
```

## 4. Analytics

### `GET /analytics/{code}`

### `GET /api/analytics/{code}`

Returns click statistics for a short code.

#### cURL

```bash
curl http://localhost:3000/analytics/ex
```

```bash
curl http://localhost:3000/api/analytics/ex
```

#### Success response: `200 OK`

```json
{
  "status": "success",
  "data": {
    "shortCode": "ex",
    "originalUrl": "https://example.com/some/very/long/path",
    "expiresAt": "2026-06-24T10:15:30.000Z",
    "ttlDays": 14,
    "totalClicks": 2,
    "recentClicks": [
      {
        "id": "8f19d1f4-0c63-40e4-bd6f-9b6f9c5b2d5c",
        "urlId": "b4d62327-52f3-4f7a-857f-0e12b93d0c2d",
        "userAgent": "curl/8.7.1",
        "ipAddress": "::1",
        "referrer": null,
        "timestamp": "2026-06-10T10:15:30.000Z"
      }
    ]
  }
}
```

#### Error response: `404 Not Found`

```json
{
  "status": "error",
  "message": "Short code not found"
}
```

## 5. Common Error Model

All application errors use the same shape:

```json
{
  "status": "error",
  "message": "Readable error message"
}
```

HTTP status codes used by the service:

- `400` invalid input
- `404` unknown short code
- `409` alias already exists
- `429` rate limit exceeded
- `500` unexpected server failure
