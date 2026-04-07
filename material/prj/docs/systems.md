---
title: Project → Systems
navTitle: Systems
navOrder: 3
---

# Project Systems

Your team will design and build one of the following systems. Each system is composed of multiple services, databases, caches, queues, and workers coordinated through Docker Compose. The system must demonstrate the distributed systems concepts covered in this course: service decomposition, synchronous and asynchronous communication, caching, background processing, replication, idempotency, and fault tolerance.

## Scaling to Team Size

The component lists below represent the full system. Teams should scale scope to match their size:

- **3-person teams**: implement the core services (marked as **core**) and at least one background worker pipeline. Replication can be limited to a single service.
- **4-person teams**: implement all core services and at least two worker pipelines. Add replication to two services.
- **5-6 person teams**: implement the full system as described, including all workers, replication across services, and the poison pill / dead letter handling.

Every team, regardless of size, must include: at least one synchronous service-to-service call, at least one async pipeline using Redis pub/sub or queues, at least one Redis cache, database-per-service isolation, idempotency on at least one write path, and a poison pill handling strategy on at least one queue.

---

## System 1: Event Ticketing Platform

Users browse events, purchase tickets, and receive confirmation emails. A popular event can see thousands of purchase attempts in seconds, so the system must handle bursts of traffic without overselling seats.

### Services and Components

| Component                   | Type                    | Description                                                                                                                                                                                                                                                                                              |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event Catalog Service**   | core service            | Manages event listings, venues, dates, and seat maps. Owns the events database. Caches popular event details in Redis.                                                                                                                                                                                   |
| **Ticket Purchase Service** | core service            | Accepts purchase requests, reserves seats, and initiates payment. Must be idempotent — a duplicate purchase request for the same user and event must not double-charge or double-reserve.                                                                                                                |
| **Payment Service**         | core service            | Processes payments (simulated). Returns success or failure. Called synchronously by the Ticket Purchase Service.                                                                                                                                                                                         |
| **Notification Service**    | service + worker        | Listens on a Redis pub/sub channel for confirmed purchases and sends confirmation emails (simulated as log output or written to a file).                                                                                                                                                                 |
| **Waitlist Worker**         | worker                  | Consumes a Redis queue of waitlist entries. When a ticket is released (cancellation or payment failure), the worker promotes the next waitlisted user and publishes a purchase event. Must handle poison pills — a malformed waitlist entry should be moved to a dead letter queue, not retried forever. |
| **Analytics Worker**        | worker                  | Consumes purchase and browse events from a Redis queue and writes aggregate stats (tickets sold per event, peak browse times) to its own database. Tolerates duplicate events via idempotent upserts.                                                                                                    |
| **Event Catalog DB**        | database                | Stores events, venues, seat inventory. Owned exclusively by the Event Catalog Service.                                                                                                                                                                                                                   |
| **Purchase DB**             | database                | Stores purchases, reservations, payment status. Owned exclusively by the Ticket Purchase Service.                                                                                                                                                                                                        |
| **Analytics DB**            | database                | Stores aggregate metrics. Owned exclusively by the Analytics Worker.                                                                                                                                                                                                                                     |
| **Redis**                   | cache + queue + pub/sub | Caches event details. Provides the waitlist queue, the analytics event queue, and the purchase confirmation pub/sub channel.                                                                                                                                                                             |
| **Caddy**                   | load balancer           | Sits in front of replicated services and distributes traffic.                                                                                                                                                                                                                                            |

### Key Interactions

- User browses events → Event Catalog Service (cache hit or DB read)
- User purchases ticket → Ticket Purchase Service → Payment Service (synchronous HTTP)
- Purchase confirmed → publish to Redis pub/sub → Notification Service consumes and sends confirmation
- Purchase confirmed → push to Redis analytics queue → Analytics Worker consumes and writes stats
- Purchase fails or is cancelled → push cancelled seat to Redis waitlist queue → Waitlist Worker promotes next user
- Waitlist Worker encounters malformed entry → moves to dead letter queue

---

## System 2: Food Delivery Coordination

Users place orders from restaurants, the system coordinates preparation, assigns a driver, and tracks delivery in real time. Multiple services must stay in sync without tight coupling.

### Services and Components

| Component                      | Type                    | Description                                                                                                                                                                                                                                                        |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Restaurant Service**         | core service            | Manages restaurant profiles, menus, and availability windows. Owns the restaurant database. Caches menu data in Redis.                                                                                                                                             |
| **Order Service**              | core service            | Accepts and manages orders. Validates items against the Restaurant Service (synchronous HTTP). Must be idempotent — a duplicate order submission with the same idempotency key must return the original order, not create a second one.                            |
| **Driver Service**             | core service            | Tracks driver availability and location (simulated). Assigns drivers to orders. Owns the driver database.                                                                                                                                                          |
| **Order Dispatch Worker**      | worker                  | Consumes new orders from a Redis queue. Calls the Driver Service to assign a driver, then publishes an "order dispatched" event on Redis pub/sub. Must handle poison pills — an order referencing a nonexistent restaurant should be moved to a dead letter queue. |
| **Preparation Tracker Worker** | worker                  | Listens on Redis pub/sub for "order dispatched" events. Simulates restaurant preparation time, then publishes an "order ready" event.                                                                                                                              |
| **Delivery Tracker Service**   | service                 | Listens on Redis pub/sub for "order ready" events. Simulates driver transit and publishes location updates. Exposes a status endpoint for clients to poll.                                                                                                         |
| **Notification Worker**        | worker                  | Consumes delivery status events from a Redis queue and logs notifications (order confirmed, driver assigned, order picked up, delivered). Tolerates duplicate events.                                                                                              |
| **Restaurant DB**              | database                | Stores restaurant profiles, menus. Owned by the Restaurant Service.                                                                                                                                                                                                |
| **Order DB**                   | database                | Stores orders, statuses, payment info. Owned by the Order Service.                                                                                                                                                                                                 |
| **Driver DB**                  | database                | Stores driver profiles, availability, assignment history. Owned by the Driver Service.                                                                                                                                                                             |
| **Redis**                      | cache + queue + pub/sub | Caches menus. Provides the order dispatch queue, notification queue, and pub/sub channels for order lifecycle events.                                                                                                                                              |
| **Caddy**                      | load balancer           | Distributes traffic across replicated services.                                                                                                                                                                                                                    |

### Key Interactions

- User places order → Order Service → Restaurant Service (synchronous HTTP to validate menu items)
- New order → push to Redis order dispatch queue → Order Dispatch Worker assigns driver via Driver Service
- Driver assigned → publish "order dispatched" on Redis pub/sub → Preparation Tracker Worker begins countdown
- Preparation done → publish "order ready" on Redis pub/sub → Delivery Tracker Service simulates transit
- Each status change → push to Redis notification queue → Notification Worker logs the update
- Malformed order in dispatch queue → dead letter queue

---

## System 3: Video Processing Pipeline

Users upload videos that must be transcoded into multiple resolutions, have thumbnails extracted, and be made searchable by metadata. The heavy processing happens asynchronously through a pipeline of workers.

### Services and Components

| Component               | Type                    | Description                                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Upload Service**      | core service            | Accepts video uploads (simulated as metadata + a delay). Writes upload records to the upload database. Pushes a job onto the Redis transcode queue. Must be idempotent — re-uploading the same file (by hash) returns the existing record.                                                                 |
| **Catalog Service**     | core service            | Serves the video library. Reads from the catalog database. Caches recently viewed video metadata in Redis. Exposes search and browse endpoints.                                                                                                                                                            |
| **Transcode Worker**    | core worker             | Consumes jobs from the Redis transcode queue. Simulates transcoding by sleeping proportionally to video duration, then writes output records to the catalog database and publishes a "transcode complete" event. Must handle poison pills — a job with invalid parameters is moved to a dead letter queue. |
| **Thumbnail Worker**    | worker                  | Listens on Redis pub/sub for "transcode complete" events. Simulates thumbnail extraction and writes thumbnail references to the catalog database.                                                                                                                                                          |
| **Search Index Worker** | worker                  | Listens on Redis pub/sub for "transcode complete" events. Reads video metadata and writes it to the search database. Idempotent — indexing the same video twice produces the same result.                                                                                                                  |
| **Quota Service**       | service                 | Tracks per-user upload limits and storage usage. Called synchronously by the Upload Service before accepting an upload. Owns the quota database.                                                                                                                                                           |
| **Upload DB**           | database                | Stores upload records, processing status. Owned by the Upload Service.                                                                                                                                                                                                                                     |
| **Catalog DB**          | database                | Stores video metadata, transcode outputs, thumbnail references. Owned by the Catalog Service and written to by workers.                                                                                                                                                                                    |
| **Search DB**           | database                | Stores the search index. Owned by the Search Index Worker.                                                                                                                                                                                                                                                 |
| **Quota DB**            | database                | Stores per-user upload counts and storage usage. Owned by the Quota Service.                                                                                                                                                                                                                               |
| **Redis**               | cache + queue + pub/sub | Caches video metadata. Provides the transcode job queue and pub/sub channels for pipeline events.                                                                                                                                                                                                          |
| **Caddy**               | load balancer           | Distributes traffic across replicated Upload and Catalog services.                                                                                                                                                                                                                                         |

### Key Interactions

- User uploads video → Upload Service → Quota Service (synchronous HTTP to check limits) → push job to Redis transcode queue
- Transcode Worker picks up job → simulates processing → writes to Catalog DB → publishes "transcode complete"
- "transcode complete" → Thumbnail Worker extracts thumbnails → writes to Catalog DB
- "transcode complete" → Search Index Worker indexes metadata → writes to Search DB
- User browses catalog → Catalog Service (Redis cache or DB read)
- Invalid transcode job → dead letter queue

---

## System 4: IoT Sensor Monitoring Dashboard

Thousands of sensors (simulated) report temperature, humidity, and pressure readings. The system ingests readings at high volume, detects anomalies, triggers alerts, and serves a dashboard API with recent and historical data.

### Services and Components

| Component                    | Type                    | Description                                                                                                                                                                                                             |
| ---------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ingestion Service**        | core service            | Accepts sensor readings via HTTP. Validates the reading format and pushes valid readings onto a Redis queue. Must be idempotent — a duplicate reading (same sensor ID and timestamp) is acknowledged but not re-queued. |
| **Dashboard API**            | core service            | Serves current and historical sensor data. Reads from the readings database. Caches the most recent reading per sensor in Redis for fast dashboard polling.                                                             |
| **Storage Worker**           | core worker             | Consumes readings from the Redis queue and writes them to the readings database in batches. Must handle poison pills — a reading with an unregistered sensor ID is moved to a dead letter queue.                        |
| **Anomaly Detection Worker** | worker                  | Consumes readings from a second Redis queue (or fan-out from the same queue). Compares each reading against thresholds stored in the sensor registry database. If anomalous, publishes an alert event on Redis pub/sub. |
| **Alert Service**            | service                 | Listens on Redis pub/sub for alert events. Logs alerts and writes them to the alert database. Exposes an endpoint for the dashboard to query recent alerts.                                                             |
| **Sensor Registry Service**  | service                 | Manages sensor metadata: location, type, thresholds. Called synchronously by the Anomaly Detection Worker to look up thresholds. Owns the sensor registry database. Caches sensor configs in Redis.                     |
| **Readings DB**              | database                | Stores time-series sensor readings. Owned by the Storage Worker, read by the Dashboard API.                                                                                                                             |
| **Sensor Registry DB**       | database                | Stores sensor metadata and anomaly thresholds. Owned by the Sensor Registry Service.                                                                                                                                    |
| **Alert DB**                 | database                | Stores alert history. Owned by the Alert Service.                                                                                                                                                                       |
| **Redis**                    | cache + queue + pub/sub | Caches latest readings and sensor configs. Provides the ingestion queue and the alert pub/sub channel.                                                                                                                  |
| **Caddy**                    | load balancer           | Distributes traffic across replicated Ingestion and Dashboard API services.                                                                                                                                             |
| **Sensor Simulator**         | utility                 | A script or container that generates fake sensor readings and posts them to the Ingestion Service at configurable rates. Used for load testing and demos.                                                               |

### Key Interactions

- Sensors post readings → Ingestion Service (idempotent) → push to Redis queue
- Storage Worker consumes queue → batch writes to Readings DB
- Anomaly Detection Worker consumes queue → Sensor Registry Service (synchronous HTTP for thresholds) → publishes alert on Redis pub/sub if anomalous
- Alert Service listens on pub/sub → writes to Alert DB
- Dashboard polls → Dashboard API → Redis cache (latest reading) or Readings DB (historical)
- Malformed reading in queue → dead letter queue

---

## System 5: Collaborative Document Workspace

Users create documents, edit them, share them with collaborators, and receive notifications when changes are made. The system tracks revision history and generates document exports asynchronously.

### Services and Components

| Component               | Type                    | Description                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document Service**    | core service            | Creates, reads, updates, and deletes documents. Owns the document database. Caches frequently accessed documents in Redis. Publishes "document updated" events on Redis pub/sub after each write.                                                                                                                                                                               |
| **Auth Service**        | core service            | Manages users and permissions. Called synchronously by the Document Service to verify access on every request. Owns the auth database. Caches permission lookups in Redis.                                                                                                                                                                                                      |
| **Revision Service**    | core service            | Stores document revision history. Listens on Redis pub/sub for "document updated" events and writes a snapshot of the document at that point. Exposes an endpoint to list and retrieve past revisions. Owns the revision database.                                                                                                                                              |
| **Export Worker**       | worker                  | Consumes export requests from a Redis queue. Reads the document from the Document Service (synchronous HTTP), simulates rendering to PDF, and writes the result to the export database. Must be idempotent — requesting the same export twice returns the existing result. Must handle poison pills — an export request for a deleted document is moved to a dead letter queue. |
| **Notification Worker** | worker                  | Listens on Redis pub/sub for "document updated" events. Looks up collaborators from the Auth Service and logs a notification for each. Tolerates duplicate events.                                                                                                                                                                                                              |
| **Search Service**      | service + worker        | Listens on Redis pub/sub for "document updated" events and indexes document content into the search database. Exposes a search endpoint. Idempotent indexing.                                                                                                                                                                                                                   |
| **Document DB**         | database                | Stores documents and their current content. Owned by the Document Service.                                                                                                                                                                                                                                                                                                      |
| **Auth DB**             | database                | Stores users, teams, and permissions. Owned by the Auth Service.                                                                                                                                                                                                                                                                                                                |
| **Revision DB**         | database                | Stores document snapshots. Owned by the Revision Service.                                                                                                                                                                                                                                                                                                                       |
| **Export DB**           | database                | Stores export job status and output references. Owned by the Export Worker.                                                                                                                                                                                                                                                                                                     |
| **Search DB**           | database                | Stores the search index. Owned by the Search Service.                                                                                                                                                                                                                                                                                                                           |
| **Redis**               | cache + queue + pub/sub | Caches documents and permissions. Provides the export job queue and pub/sub channels for document events.                                                                                                                                                                                                                                                                       |
| **Caddy**               | load balancer           | Distributes traffic across replicated Document and Auth services.                                                                                                                                                                                                                                                                                                               |

### Key Interactions

- User creates/edits document → Document Service → Auth Service (synchronous HTTP to check permissions) → write to Document DB → publish "document updated" on Redis pub/sub
- "document updated" → Revision Service writes snapshot to Revision DB
- "document updated" → Notification Worker looks up collaborators via Auth Service → logs notifications
- "document updated" → Search Service indexes content into Search DB
- User requests PDF export → Document Service pushes job to Redis export queue → Export Worker processes
- Export Worker encounters deleted document → dead letter queue
- User searches → Search Service reads from Search DB
- User views revision history → Revision Service reads from Revision DB
