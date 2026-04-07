---
title: Project → Endpoint Descriptions
navTitle: Endpoints
navOrder: 7
---

# Writing Endpoint Descriptions

Every team must document all HTTP endpoints in the `README.md` at the root of their repository. This document explains what an endpoint description must contain, provides a template, and shows worked examples drawn from the project systems.

A TA must be able to read your README, understand what each endpoint does, and reproduce the exact `curl` command to call it — without asking you anything.

---

## What an Endpoint Description Must Include

Each endpoint must cover the following. Omit a section entirely if it does not apply — do not write "none" or "N/A".

- **Method and path** — the HTTP verb and URL path, including path parameters (e.g. `GET /events/:id`)
- **Description** — one or two sentences on what the endpoint does and any important behavior: is it idempotent? Does it call another service synchronously? Does it write to a queue?
- **Path parameters** — each `/:param` in the URL: name, type, and what it identifies
- **Query parameters** — each `?param=`: name, type, required or optional, default value, and meaning
- **Request headers** — any non-standard headers the endpoint requires (e.g. an idempotency key)
- **Request body** — each JSON field: name, type, required or optional, and meaning
- **Responses** — every HTTP status code the endpoint can return and what it means
- **Example request** — a complete, copy-pasteable `curl` command that works against your running system
- **Example response** — the actual JSON body returned for the example request

---

## Reaching Services for Testing

Services do not need to expose fixed host ports. Use Holmes — the investigation container included in the starter repository — to reach services directly by their Docker Compose service name and internal port. Holmes runs on the same `team-net` network as all your services.

```bash
# Start a shell in Holmes
docker compose exec holmes bash

# Then reach services by service name and internal port
curl http://event-catalog-service:8000/events
curl http://ticket-purchase-service:8000/purchases
redis-cli -h redis LLEN your-queue
psql postgres://app:secret@order-db:5432/orders
```

Document the service names and internal ports at the top of your README's API reference section:

```
Base URLs (from Holmes)

  event-catalog-service    http://event-catalog-service:8000
  ticket-purchase-service  http://ticket-purchase-service:8000
  payment-service          http://payment-service:8000
  waitlist-worker          http://waitlist-worker:8000   (health endpoint only)
```

---

## Endpoint Template

Each endpoint is described in a compact block, followed by a `curl` example and a response example. Use a level-3 heading (`###`) for each endpoint so the README is easy to navigate.

The compact block uses the following structure:

```
METHOD /path/:param

  One or two sentence description. Note idempotency, synchronous calls,
  or queue writes if relevant.

  Path:
    name  type  Description

  Query:
    name  type  required|optional  default=X  Description

  Headers:
    Header-Name  type  required|optional  Description

  Body:
    name  type  required|optional  Description

  Responses:
    200  Meaning
    201  Meaning
    400  Meaning
    404  Meaning
    503  Meaning
```

Each parameter line has four columns: name, type, required/optional (and default if applicable), and a short description. Align columns with spaces so the block is easy to scan.

After the compact block, show the example request and response in their own fenced code blocks.

---

## Full Template

````markdown
### METHOD /path/:param

```
METHOD /path/:param

  Description of what this endpoint does. Note any important behavior.

  Path:
    param  string (UUID)  What this parameter identifies

  Query:
    name   string   optional  default=—   What it filters by
    limit  integer  optional  default=20  Max results to return

  Headers:
    Idempotency-Key  string  required  Client-generated UUID for deduplication

  Body:
    fieldName      string   required  Description of this field
    otherField     integer  required  Description
    optionalField  string   optional  Description

  Responses:
    200  Success — returns the resource
    201  Created — returns the newly created resource
    400  Bad request — missing or invalid fields
    404  Not found — resource does not exist
    409  Conflict — duplicate detected
    503  Service unavailable — dependency is down
```

**Example request:**

```bash
curl -X POST http://your-service:8000/endpoint \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -d '{
    "fieldName": "value",
    "otherField": 2
  }'
```

**Example response (201):**

```json
{
  "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "fieldName": "value",
  "createdAt": "2025-04-14T10:23:01Z"
}
```
````

---

## Worked Examples

---

### Example 1 — Simple read with query parameters (System 1: Event Ticketing)

````markdown
### GET /events

```
GET /events

  Returns a paginated list of upcoming events. Served from the Redis cache
  when available; the cache is populated on first read and expires after 60s.

  Query:
    page   integer  optional  default=1   Page number, 1-indexed
    limit  integer  optional  default=20  Events per page, max 100
    venue  string   optional  default=—   Filter by venue name, partial match

  Responses:
    200  Success — returns list of events
    503  Database or Redis unavailable
```

**Example request:**

```bash
curl "http://event-catalog-service:8000/events?page=1&limit=3"
```

**Example response (200):**

```json
{
  "page": 1,
  "limit": 3,
  "total": 50,
  "events": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Castellan World Tour",
      "venue": "Portland Arena",
      "eventDate": "2025-08-15T20:00:00Z",
      "availableSeats": 312,
      "priceUsd": 89.99
    },
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "Summer Festival",
      "venue": "Boston Common",
      "eventDate": "2025-07-04T18:00:00Z",
      "availableSeats": 4200,
      "priceUsd": 45.0
    },
    {
      "id": "066de609-b04a-4b30-b46c-32537c7f1f6e",
      "name": "Jazz Night Live",
      "venue": "New York Jazz Center",
      "eventDate": "2025-09-01T19:30:00Z",
      "availableSeats": 0,
      "priceUsd": 120.0
    }
  ]
}
```
````

---

### Example 2 — Read with path parameter (System 1: Event Ticketing)

````markdown
### GET /events/:id

```
GET /events/:id

  Returns full detail for a single event. Served from the Redis cache when
  available; a cache miss falls through to the database.

  Path:
    id  string (UUID)  The event's ID

  Responses:
    200  Success — returns event detail
    404  No event found with that ID
    503  Database or Redis unavailable
```

**Example request:**

```bash
curl http://event-catalog-service:8000/events/3fa85f64-5717-4562-b3fc-2c963f66afa6
```

**Example response (200):**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Castellan World Tour",
  "venue": "Portland Arena",
  "eventDate": "2025-08-15T20:00:00Z",
  "totalSeats": 500,
  "availableSeats": 312,
  "priceUsd": 89.99,
  "cachedAt": "2025-04-14T10:22:55Z"
}
```

**Example response (404):**

```json
{
  "error": "event not found",
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```
````

---

### Example 3 — Idempotent write with request body (System 1: Event Ticketing)

````markdown
### POST /purchases

```
POST /purchases

  Reserves seats and processes payment. Idempotent: a duplicate Idempotency-Key
  returns the original purchase without re-charging or re-reserving. Calls the
  Payment Service synchronously before confirming.

  Headers:
    Idempotency-Key  string  required  Client-generated UUID; safe to retry with same key

  Body:
    userId    string   required  UUID of the purchasing user
    eventId   string   required  UUID of the event
    quantity  integer  required  Number of seats to purchase, 1–8
    cardToken string   required  Payment token from the client

  Responses:
    201  Purchase confirmed — seats reserved, payment succeeded
    200  Duplicate request — original purchase returned (idempotent)
    400  Missing or invalid fields
    402  Payment declined — seats not reserved
    409  Insufficient seats available
    503  Payment Service or database unavailable
```

**Example request:**

```bash
curl -X POST http://ticket-purchase-service:8000/purchases \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -d '{
    "userId":    "d290f1ee-6c54-4b01-90e6-d701748f0851",
    "eventId":   "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "quantity":  2,
    "cardToken": "tok_visa_4242"
  }'
```

**Example response (201):**

```json
{
  "purchaseId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "userId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "eventId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "quantity": 2,
  "totalUsd": 179.98,
  "status": "confirmed",
  "createdAt": "2025-04-14T10:23:01Z"
}
```

**Example response (402):**

```json
{
  "error": "payment declined",
  "purchaseId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "failed"
}
```
````

---

### Example 4 — Status poll endpoint (System 2: Food Delivery)

````markdown
### GET /deliveries/:orderId/status

```
GET /deliveries/:orderId/status

  Returns the current delivery status of an order. Updated by the Delivery
  Tracker Service as it processes pub/sub events. Poll this endpoint to track
  progress.

  Path:
    orderId  string (UUID)  The order's ID

  Responses:
    200  Success — returns current delivery state
    404  No order found with that ID
```

**Example request:**

```bash
curl http://delivery-tracker-service:8000/deliveries/f47ac10b-58cc-4372-a567-0e02b2c3d479/status
```

**Example response (200):**

```json
{
  "orderId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "in_transit",
  "driverName": "Marcus Webb",
  "updatedAt": "2025-04-14T10:31:45Z",
  "estimatedDeliveryAt": "2025-04-14T10:45:00Z"
}
```
````

---

## Documenting Workers and Health Endpoints

Workers have no user-facing endpoints, but they must still expose `/health`. Give each worker its own section in the README with a brief description and its health endpoint URL.

````markdown
## Waitlist Worker

Consumes entries from the `waitlist-queue` Redis queue. When a seat is released,
promotes the next waitlisted user and publishes a purchase event on Redis pub/sub.
Malformed entries are moved to `waitlist-queue:dlq`.

```
GET /health   http://waitlist-worker:8000/health

  Returns 200 when Redis is reachable and the worker is processing jobs.
  Returns 503 if Redis is down.

  Responses:
    200  Worker healthy
    503  Redis unreachable
```

See [Health Endpoints](../health/) for the full response body format.
````

---

## README Structure

Organise your README's API section one service at a time. Use level-2 headings for services and level-3 headings for individual endpoints.

````markdown
## API Reference

```
Base URLs (from Holmes)

  event-catalog-service    http://event-catalog-service:8000
  ticket-purchase-service  http://ticket-purchase-service:8000
  payment-service          http://payment-service:8000   (internal — called by purchase service)
  waitlist-worker          http://waitlist-worker:8000   (health endpoint only)
  analytics-worker         http://analytics-worker:8000   (health endpoint only)
```

---

## Event Catalog Service

### GET /events

...

### GET /events/:id

...

### GET /health

...

---

## Ticket Purchase Service

### POST /purchases

...

### GET /health

...

---

## Waitlist Worker

...
````

---

## Common Mistakes

**Describing the implementation, not the contract.**
"This calls `db.query()` and returns the result" is not useful to a TA. Describe what the caller sends, what they get back, and under what conditions each status code is returned.

**Omitting error responses.**
A POST endpoint that only documents 201 is incomplete. Document every status code the endpoint can return, including 400, 404, 409, 503, and any other error case your code handles.

**Example requests that do not actually work.**
Before tagging a sprint, run every `curl` command in your README against your running system and verify the output matches your documented example response. A TA will do exactly this.

**Missing the Idempotency-Key header.**
If your endpoint requires an idempotency key, it must appear in the compact block's Headers section and in the `curl` example. A TA testing idempotency will send the same request twice with the same key and verify the response is identical.

**Undocumented query parameters.**
If your endpoint accepts `?page=` or `?limit=`, document them. TAs use these when constructing k6 tests.
