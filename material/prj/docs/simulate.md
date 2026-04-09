---
title: Project → Simulating Services and Data
navTitle: Simulation
navOrder: 9
---

# Simulating Services and Data

Your project systems involve things that are expensive or impossible to do for real: transcoding video, sending emails, charging credit cards, receiving thousands of sensor readings per minute. You will simulate all of these. This document explains how.

Simulation in this project means two things:

1. **Simulating computation** — making a service behave as if it is doing real work (with realistic timing and failure rates) without actually doing it.
2. **Simulating data** — populating your databases with realistic fake records so your system has something to operate on.

Done well, simulation lets you build, test, and load-test a complete distributed system without a payment processor, a video encoder, or a hardware sensor in sight.

---

## Simulating Computation

### CPU-bound work vs. I/O-bound work

The right simulation technique depends on what kind of work you are replacing:

- **CPU-bound work** — transcoding video, extracting thumbnails, rendering a PDF, running a compression algorithm. The real operation keeps a CPU core busy. You must simulate this with a **busy-wait loop** that actually burns CPU cycles for the target duration.
- **I/O-bound work** — waiting for a payment processor to respond, waiting for an SMTP server, waiting for a remote API. The real operation is mostly waiting on the network. You can simulate this with an `async sleep`, which is non-blocking and lets the event loop serve other requests while it waits.

Using `await sleep()` to simulate CPU-bound work is wrong: it yields control back to the event loop immediately and consumes no CPU at all. Your worker appears to be processing a job but is actually idle. Under load this produces misleading k6 results because your system will seem far more capable than it really is.

### Busy-wait loops for CPU-bound simulation

A busy-wait loop spins on the CPU until a wall-clock deadline is reached. It does real work — the OS scheduler sees the thread as active and allocates CPU time to it.

**Node.js**

```javascript
// Burns CPU for approximately `ms` milliseconds.
// Uses a mix of arithmetic to prevent the compiler from optimizing the loop away.
function burnCpu(ms) {
  const deadline = Date.now() + ms;
  let x = Math.random();
  while (Date.now() < deadline) {
    x = Math.sqrt(x * x + 1.3) / 1.00001;
  }
  return x; // return so the result can't be eliminated as dead code
}

// Simulate transcoding: 200ms of CPU per second of video duration
function simulateTranscode(durationSeconds) {
  const processingMs = durationSeconds * 200;
  console.log(`Transcoding ${durationSeconds}s video (~${processingMs}ms CPU)`);
  burnCpu(processingMs);
}

// Simulate thumbnail extraction: ~500ms of CPU
function simulateThumbnailExtraction(videoId) {
  console.log(`Extracting thumbnail for ${videoId}`);
  burnCpu(500);
  return { thumbnailUrl: `/thumbnails/${videoId}.jpg` };
}
```

**Python**

```python
import time
import math
import logging

def burn_cpu(duration_s: float) -> None:
    """Burns CPU for approximately duration_s seconds."""
    deadline = time.perf_counter() + duration_s
    x = 0.12345
    while time.perf_counter() < deadline:
        x = math.sqrt(x * x + 1.3) / 1.00001

def simulate_transcode(duration_seconds: int) -> None:
    processing_s = duration_seconds * 0.2  # 200ms per second of video
    logging.info(f"Transcoding {duration_seconds}s video (~{processing_s:.1f}s CPU)")
    burn_cpu(processing_s)

def simulate_thumbnail_extraction(video_id: str) -> dict:
    logging.info(f"Extracting thumbnail for {video_id}")
    burn_cpu(0.5)
    return {"thumbnail_url": f"/thumbnails/{video_id}.jpg"}
```

### Busy-wait in workers vs. HTTP services

A busy-wait loop blocks the thread it runs on. What this means depends on where you use it:

**In a worker** that pulls jobs from a queue and processes them one at a time, blocking is correct and expected. The worker is supposed to be busy for the duration of each job. Use the synchronous `burnCpu` functions above directly.

**In an HTTP service**, you should not run `burnCpu` in your request handlers. Both Node.js and Python's `asyncio` have event loops: `await sleep()` yields to the loop so other requests can be handled concurrently, while a synchronous busy-wait loop blocks the loop entirely and makes your service unresponsive. For HTTP services, simulate elapsed time with `await sleep()` — it correctly models the time a slow operation takes and keeps your service responsive under load. The distinction between CPU-burning and sleeping matters for workers where you want to generate real CPU pressure; for an HTTP service in this project, simulating the time is enough.

**Node.js**

```javascript
// In an Express route handler, use sleep to simulate a slow downstream call
// or a processing step — the event loop stays alive for other requests.
app.post('/exports', async (req, res) => {
  const { documentId, pageCount } = req.body;
  await sleep(withJitter(pageCount * 300)); // simulate ~300ms per page
  res.json({ exportUrl: `/exports/${documentId}.pdf` });
});
```

**Python (asyncio)**

```python
# asyncio is an event loop, just like Node.js. await asyncio.sleep() yields
# to the loop so other coroutines can run while this one waits.
async def simulate_pdf_render(document_id: str, page_count: int) -> dict:
    await asyncio.sleep(with_jitter(page_count * 0.3))  # ~300ms per page
    return {"export_url": f"/exports/{document_id}.pdf"}
```

### Adding Variance

Real processing time is not constant. Add a small amount of random variance so your simulations do not look artificial and so your load tests expose realistic behavior under mixed workloads.

**Node.js**

```javascript
function withJitter(baseMs, fractionOfBase = 0.2) {
  const variance = baseMs * fractionOfBase;
  return Math.max(1, baseMs + (Math.random() * 2 - 1) * variance);
}

function simulateTranscodeWithJitter(durationSeconds) {
  const baseMs = durationSeconds * 200;
  burnCpu(withJitter(baseMs));
}
```

**Python**

```python
import random

def with_jitter(base_s: float, jitter_fraction: float = 0.2) -> float:
    variance = base_s * jitter_fraction
    return max(0.001, base_s + random.uniform(-variance, variance))

def simulate_transcode_with_jitter(duration_seconds: int) -> None:
    burn_cpu(with_jitter(duration_seconds * 0.2))
```

### Simulating I/O-bound work with sleep

For operations where the real bottleneck is network latency — not CPU — `async sleep` is the right tool. A payment processor API, an SMTP handshake, and a remote file storage upload all spend most of their time waiting on the network. Your service should be free to handle other requests during that wait, which is exactly what an async sleep gives you.

**Node.js**

```javascript
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
```

**Python**

```python
import asyncio

# just use: await asyncio.sleep(seconds)
```

### Simulating Failures

Real services fail. Your payment service should decline some requests. Your transcode worker should occasionally encounter a corrupt file. Introduce realistic failure rates so your system is tested against the failure paths it must handle.

**Node.js**

```javascript
class PaymentDeclinedError extends Error {
  constructor() {
    super('Payment declined');
    this.name = 'PaymentDeclinedError';
  }
}

// Simulates a payment processor: succeeds 90% of the time
// Uses sleep because the bottleneck is network round-trip, not CPU
async function simulatePayment(amount, cardToken) {
  await sleep(withJitter(300)); // ~300ms network latency

  if (Math.random() < 0.1) {
    throw new PaymentDeclinedError();
  }

  return {
    transactionId: crypto.randomUUID(),
    status: 'success',
    amount,
  };
}
```

**Python**

```python
import asyncio
import random
import uuid

class PaymentDeclinedError(Exception):
    pass

async def simulate_payment(amount: float, card_token: str) -> dict:
    await asyncio.sleep(with_jitter(0.3))  # ~300ms network latency

    if random.random() < 0.1:
        raise PaymentDeclinedError("Payment declined by issuer")

    return {
        "transaction_id": str(uuid.uuid4()),
        "status": "success",
        "amount": amount,
    }
```

### Simulating Notifications (Email, SMS)

Do not send real emails. Log a structured message instead. Use a consistent format so a TA can see in `docker compose logs` that the notification pipeline is working. Email delivery is I/O-bound (SMTP round-trip), so async sleep is appropriate here.

**Node.js**

```javascript
async function simulateSendEmail({ to, subject, body }) {
  await sleep(withJitter(100)); // simulate SMTP round-trip latency
  console.log(JSON.stringify({
    event: 'email_sent',
    to,
    subject,
    body,
    timestamp: new Date().toISOString(),
  }));
}
```

**Python**

```python
import asyncio
import json
import logging
from datetime import datetime, timezone

async def simulate_send_email(to: str, subject: str, body: str) -> None:
    await asyncio.sleep(0.1)
    logging.info(json.dumps({
        "event": "email_sent",
        "to": to,
        "subject": subject,
        "body": body,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }))
```

---

## Generating Fake Data with Faker

[Faker](https://fakerjs.dev) is a library for generating realistic fake data: names, emails, addresses, phone numbers, company names, sentences, UUIDs, dates, and much more. It is available for both JavaScript/TypeScript and Python.

### Installation

**Node.js**

```bash
npm install @faker-js/faker
```

**Python**

```bash
pip install faker
```

### Basic Usage

**Node.js**

```javascript
import { faker } from '@faker-js/faker';

// People
faker.person.fullName()        // "Marcus Webb"
faker.internet.email()         // "marcus.webb@example.com"
faker.phone.number()           // "+1 (555) 234-5678"

// Locations
faker.location.city()          // "Portland"
faker.location.streetAddress() // "742 Evergreen Terrace"

// Dates
faker.date.future()            // Date object in the future
faker.date.past({ years: 1 }) // Date object within the past year
faker.date.between({ from: '2025-01-01', to: '2025-12-31' })

// Numbers
faker.number.int({ min: 1, max: 100 })
faker.number.float({ min: 5.00, max: 150.00, fractionDigits: 2 })

// Text
faker.lorem.sentence()
faker.lorem.paragraph()
faker.word.adjective()

// IDs and tokens
faker.string.uuid()            // "a3d4b2c1-..."
faker.string.alphanumeric(16)  // "x7fK2mN9pQrTvW4z"
```

**Python**

```python
from faker import Faker

fake = Faker()

# People
fake.name()           # "Marcus Webb"
fake.email()          # "marcus.webb@example.com"
fake.phone_number()   # "+1-555-234-5678"

# Locations
fake.city()           # "Portland"
fake.street_address() # "742 Evergreen Terrace"

# Dates
fake.future_date()
fake.past_date(start_date="-1y")
fake.date_between(start_date="-6m", end_date="today")

# Numbers
fake.random_int(min=1, max=100)
round(fake.pyfloat(min_value=5.0, max_value=150.0), 2)

# Text
fake.sentence()
fake.paragraph()

# IDs
fake.uuid4()
fake.lexify("????????????????")  # 16 random chars
```

---

## Seeding Your Database

A seed script runs once when your system starts up and populates the database with enough fake data for development and testing. Without a seed, your system starts with empty tables and your k6 tests have nothing to read.

### Principles

- **Idempotent:** running the seed twice should not create duplicates. Check whether data already exists before inserting.
- **Deterministic (optional):** use a fixed faker seed so the same data is generated every run. This makes debugging easier.
- **Fast enough to not slow down `docker compose up`:** seed scripts that insert thousands of rows synchronously block your service from starting. Insert in batches, or run the seed as a separate one-shot container.

### Running Seeds on Startup

The simplest approach is to call your seed function when the service starts, before the HTTP server begins listening.

**Node.js — `seed.js`**

```javascript
import { faker } from '@faker-js/faker';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function seed() {
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM events');
  if (parseInt(rows[0].count) > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  faker.seed(42); // deterministic output

  const values = [];
  for (let i = 0; i < 50; i++) {
    values.push([
      faker.string.uuid(),
      faker.music.songName() + ' Tour',
      faker.location.city() + ' Arena',
      faker.date.between({ from: '2025-06-01', to: '2025-12-31' }),
      faker.number.int({ min: 200, max: 5000 }),
      faker.number.float({ min: 25, max: 250, fractionDigits: 2 }),
    ]);
  }

  for (const v of values) {
    await pool.query(
      `INSERT INTO events (id, name, venue, event_date, total_seats, price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      v
    );
  }

  console.log(`Seeded ${values.length} events.`);
}
```

**Python — `seed.py`**

```python
import os
import psycopg2
from faker import Faker
from datetime import timezone

fake = Faker()
Faker.seed(42)  # deterministic output

def seed(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM events")
        count = cur.fetchone()[0]
        if count > 0:
            print("Database already seeded, skipping.")
            return

        for _ in range(50):
            cur.execute(
                """INSERT INTO events (id, name, venue, event_date, total_seats, price)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    fake.uuid4(),
                    fake.catch_phrase() + " Tour",
                    fake.city() + " Arena",
                    fake.date_between(start_date="+30d", end_date="+365d"),
                    fake.random_int(min=200, max=5000),
                    round(fake.pyfloat(min_value=25, max_value=250), 2),
                )
            )
        conn.commit()
        print("Seeded 50 events.")

if __name__ == "__main__":
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    seed(conn)
    conn.close()
```

### Using a One-Shot Seed Container in Docker Compose

If your seed script is slow or needs to run after migrations, run it as a separate short-lived container rather than blocking the main service.

```yaml
services:
  event-catalog-db:
    image: postgres:16
    environment:
      POSTGRES_DB: events
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret

  event-catalog-service:
    build: ./event-catalog-service
    environment:
      DATABASE_URL: postgres://app:secret@event-catalog-db:5432/events
    depends_on:
      db-seed:
        condition: service_completed_successfully

  db-seed:
    build: ./event-catalog-service
    command: node seed.js
    environment:
      DATABASE_URL: postgres://app:secret@event-catalog-db:5432/events
    depends_on:
      event-catalog-db:
        condition: service_healthy
```

---

## System-Specific Examples

### System 1: Event Ticketing Platform

**Generating events, venues, and users (Node.js)**

```javascript
import { faker } from '@faker-js/faker';

faker.seed(42);

function makeEvent() {
  const totalSeats = faker.number.int({ min: 200, max: 10000 });
  return {
    id: faker.string.uuid(),
    name: `${faker.person.lastName()} ${faker.helpers.arrayElement(['Tour', 'Festival', 'Live', 'World Tour'])}`,
    venue: `${faker.location.city()} ${faker.helpers.arrayElement(['Arena', 'Amphitheater', 'Stadium', 'Center'])}`,
    eventDate: faker.date.between({ from: '2025-06-01', to: '2025-12-31' }),
    totalSeats,
    availableSeats: totalSeats,
    priceUsd: faker.number.float({ min: 25, max: 300, fractionDigits: 2 }),
  };
}

function makeUser() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    createdAt: faker.date.past({ years: 2 }),
  };
}

// Generate a purchase request (used in k6 tests or manual testing)
function makePurchaseRequest(userId, eventId) {
  return {
    idempotencyKey: faker.string.uuid(), // unique per attempt
    userId,
    eventId,
    quantity: faker.number.int({ min: 1, max: 4 }),
    cardToken: `tok_${faker.string.alphanumeric(16)}`,
  };
}
```

**Seeding the waitlist queue (Node.js)**

```javascript
import { createClient } from 'redis';

async function seedWaitlist(client, eventId, count = 20) {
  for (let i = 0; i < count; i++) {
    const entry = JSON.stringify({
      userId: faker.string.uuid(),
      eventId,
      requestedAt: faker.date.recent({ days: 1 }).toISOString(),
    });
    await client.rPush('waitlist-queue', entry);
  }
  console.log(`Pushed ${count} waitlist entries for event ${eventId}`);
}
```

---

### System 2: Food Delivery Coordination

**Generating restaurants, menus, and drivers (Python)**

```python
from faker import Faker
import random
import uuid

fake = Faker()
Faker.seed(42)

CUISINES = ["Italian", "Mexican", "Japanese", "Indian", "Thai", "American", "Mediterranean"]
MENU_CATEGORIES = ["Appetizers", "Mains", "Desserts", "Drinks"]

def make_restaurant():
    return {
        "id": fake.uuid4(),
        "name": fake.company() + " " + random.choice(["Kitchen", "Bistro", "Grill", "House"]),
        "cuisine": random.choice(CUISINES),
        "address": fake.street_address(),
        "city": fake.city(),
        "rating": round(random.uniform(3.0, 5.0), 1),
        "is_open": random.random() > 0.2,
    }

def make_menu_item(restaurant_id):
    return {
        "id": fake.uuid4(),
        "restaurant_id": restaurant_id,
        "name": fake.word().capitalize() + " " + random.choice(["Bowl", "Plate", "Wrap", "Salad", "Burger"]),
        "category": random.choice(MENU_CATEGORIES),
        "price_usd": round(random.uniform(8.0, 28.0), 2),
        "available": random.random() > 0.1,
    }

def make_driver():
    return {
        "id": fake.uuid4(),
        "name": fake.name(),
        "phone": fake.phone_number(),
        "vehicle": random.choice(["bike", "car", "scooter"]),
        "is_available": random.random() > 0.3,
        "latitude": float(fake.latitude()),
        "longitude": float(fake.longitude()),
    }
```

**Simulating order dispatch (Python)**

```python
import asyncio
import random
import logging

async def simulate_dispatch(order_id: str, driver_id: str) -> dict:
    """Simulates the driver accepting the order and heading to the restaurant."""
    await asyncio.sleep(random.uniform(1.0, 3.0))  # dispatch confirmation delay
    logging.info(f"Driver {driver_id} accepted order {order_id}")
    return {"order_id": order_id, "driver_id": driver_id, "status": "dispatched"}

async def simulate_preparation(order_id: str, item_count: int) -> None:
    """Simulates the restaurant preparing the order."""
    prep_time = item_count * random.uniform(2.0, 4.0)  # 2-4s per item
    logging.info(f"Restaurant preparing order {order_id} ({prep_time:.1f}s)")
    await asyncio.sleep(prep_time)
    logging.info(f"Order {order_id} is ready for pickup")

async def simulate_delivery(order_id: str) -> None:
    """Simulates the driver traveling to the customer."""
    transit_time = random.uniform(5.0, 15.0)
    logging.info(f"Driver en route for order {order_id} ({transit_time:.1f}s)")
    await asyncio.sleep(transit_time)
    logging.info(f"Order {order_id} delivered")
```

---

### System 3: Video Processing Pipeline

**Generating video upload metadata (Node.js)**

```javascript
import { faker } from '@faker-js/faker';

faker.seed(42);

const VIDEO_CATEGORIES = ['education', 'gaming', 'music', 'sports', 'cooking', 'travel'];
const RESOLUTIONS = ['1080p', '720p', '480p', '360p'];

function makeVideoUpload(userId) {
  const durationSeconds = faker.number.int({ min: 30, max: 3600 });
  const fileSizeMb = Math.round(durationSeconds * faker.number.float({ min: 0.5, max: 2.5 }));

  return {
    id: faker.string.uuid(),
    userId,
    title: faker.lorem.words({ min: 3, max: 8 }),
    description: faker.lorem.paragraph(),
    category: faker.helpers.arrayElement(VIDEO_CATEGORIES),
    tags: faker.helpers.arrayElements(
      ['tutorial', 'review', 'vlog', 'live', 'shorts', 'highlight'],
      { min: 1, max: 4 }
    ),
    durationSeconds,
    fileSizeMb,
    fileHash: faker.string.hexadecimal({ length: 64, prefix: '' }), // used for idempotency
    uploadedAt: faker.date.recent({ days: 30 }),
    status: 'pending',
  };
}

// Simulate the transcode worker processing a job
async function simulateTranscodeJob(job) {
  const { videoId, durationSeconds } = job;
  const outputs = [];

  for (const resolution of ['1080p', '720p', '480p']) {
    const processingMs = durationSeconds * 150 + Math.random() * 500;
    burnCpu(processingMs); // CPU-bound: use busy-wait, not sleep
    outputs.push({
      resolution,
      url: `/videos/${videoId}/${resolution}.mp4`,
      fileSizeMb: Math.round(durationSeconds * (resolution === '1080p' ? 2.0 : resolution === '720p' ? 1.2 : 0.6)),
    });
  }

  return { videoId, outputs };
}
```

---

### System 4: IoT Sensor Monitoring Dashboard

This system requires generating a continuous stream of sensor readings rather than a one-time database seed. Use a **Sensor Simulator** container that posts readings to the Ingestion Service at a configurable rate.

**Sensor simulator script (Python)**

```python
import asyncio
import random
import uuid
import httpx
from faker import Faker
from datetime import datetime, timezone

fake = Faker()
Faker.seed(42)

# Generate a fixed set of sensor IDs at startup
# These must also be seeded into the Sensor Registry database
SENSOR_IDS = [str(uuid.UUID(int=i)) for i in range(1, 51)]  # 50 sensors

SENSOR_THRESHOLDS = {
    "temperature": {"min": -20.0, "max": 40.0, "anomaly_above": 38.0},
    "humidity":    {"min": 0.0,   "max": 100.0, "anomaly_above": 90.0},
    "pressure":    {"min": 950.0, "max": 1050.0, "anomaly_above": 1045.0},
}

def make_reading(sensor_id: str, inject_anomaly: bool = False) -> dict:
    metric = random.choice(list(SENSOR_THRESHOLDS.keys()))
    thresholds = SENSOR_THRESHOLDS[metric]

    if inject_anomaly:
        value = round(thresholds["anomaly_above"] + random.uniform(0.1, 5.0), 2)
    else:
        value = round(random.uniform(thresholds["min"], thresholds["anomaly_above"] * 0.9), 2)

    return {
        "sensor_id": sensor_id,
        "metric": metric,
        "value": value,
        "unit": {"temperature": "C", "humidity": "%", "pressure": "hPa"}[metric],
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }

async def run_simulator(
    ingestion_url: str,
    readings_per_second: float = 10.0,
    anomaly_rate: float = 0.05,
):
    interval = 1.0 / readings_per_second
    async with httpx.AsyncClient() as client:
        while True:
            sensor_id = random.choice(SENSOR_IDS)
            inject_anomaly = random.random() < anomaly_rate
            reading = make_reading(sensor_id, inject_anomaly)
            try:
                await client.post(f"{ingestion_url}/readings", json=reading, timeout=2.0)
            except Exception as e:
                print(f"Ingestion error: {e}")
            await asyncio.sleep(interval)

if __name__ == "__main__":
    import os
    url = os.environ.get("INGESTION_URL", "http://ingestion-service:8000")
    rps = float(os.environ.get("READINGS_PER_SECOND", "10"))
    asyncio.run(run_simulator(url, rps))
```

**Seeding the sensor registry (Python)**

```python
def seed_sensors(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM sensors")
        if cur.fetchone()[0] > 0:
            return

        for sensor_id in SENSOR_IDS:
            metric = random.choice(list(SENSOR_THRESHOLDS.keys()))
            thresholds = SENSOR_THRESHOLDS[metric]
            cur.execute(
                """INSERT INTO sensors (id, location, metric, min_threshold, max_threshold)
                   VALUES (%s, %s, %s, %s, %s)""",
                (
                    sensor_id,
                    fake.city() + " - " + fake.word().capitalize() + " Building",
                    metric,
                    thresholds["min"],
                    thresholds["anomaly_above"],
                )
            )
        conn.commit()
        print(f"Seeded {len(SENSOR_IDS)} sensors.")
```

**Sensor simulator in Docker Compose**

```yaml
services:
  sensor-simulator:
    build: ./sensor-simulator
    environment:
      INGESTION_URL: http://ingestion-service:8000
      READINGS_PER_SECOND: "20"
    depends_on:
      - ingestion-service
    restart: unless-stopped
```

---

### System 5: Collaborative Document Workspace

**Generating users, teams, and documents (Node.js)**

```javascript
import { faker } from '@faker-js/faker';

faker.seed(42);

function makeUser() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    passwordHash: '$2b$10$placeholder', // never store real passwords in seeds
    createdAt: faker.date.past({ years: 1 }),
  };
}

function makeTeam(memberIds) {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    memberIds,
  };
}

function makeDocument(ownerId, collaboratorIds = []) {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.words({ min: 2, max: 6 }),
    content: faker.lorem.paragraphs({ min: 2, max: 8 }),
    ownerId,
    collaboratorIds,
    createdAt: faker.date.past({ years: 1 }),
    updatedAt: faker.date.recent({ days: 30 }),
  };
}

// Simulate the export worker rendering a document to PDF
function simulatePdfRender(documentId, pageCount) {
  const renderTimeMs = pageCount * faker.number.int({ min: 200, max: 500 });
  console.log(`Rendering PDF for document ${documentId} (${pageCount} pages, ~${renderTimeMs}ms)`);
  burnCpu(renderTimeMs); // CPU-bound: use busy-wait, not sleep
  return {
    documentId,
    exportUrl: `/exports/${documentId}.pdf`,
    pageCount,
    fileSizeKb: pageCount * faker.number.int({ min: 50, max: 200 }),
  };
}
```

---

## Generating Poison Pills for Testing

Sprint 3 requires you to deliberately inject malformed messages into your queues to test dead letter handling. Here is how to generate poison pills for each system.

**Node.js — generic poison pill factory**

```javascript
// Returns a structurally valid-looking message with a bad field value
function makePoisonPill(validMessage, field, badValue) {
  return { ...validMessage, [field]: badValue };
}

// Examples:
const poisonPills = [
  // Reference to a nonexistent resource
  { ...validPurchase, eventId: faker.string.uuid() },       // event doesn't exist
  { ...validOrder, restaurantId: faker.string.uuid() },     // restaurant doesn't exist

  // Missing required fields
  { userId: faker.string.uuid() },                          // missing eventId, quantity, etc.

  // Wrong types
  { ...validReading, value: "not-a-number" },               // sensor value is a string
  { ...validUpload, durationSeconds: -1 },                  // negative duration

  // Null / empty
  { ...validWaitlistEntry, userId: null },
  { ...validExportRequest, documentId: "" },
];
```

**Python — poison pill factory**

```python
import copy
import random

def make_poison_pill(valid_message: dict, strategy: str = "missing_field") -> dict:
    pill = copy.deepcopy(valid_message)

    if strategy == "missing_field":
        key = random.choice(list(pill.keys()))
        del pill[key]
    elif strategy == "null_id":
        for key in pill:
            if key.endswith("_id"):
                pill[key] = None
                break
    elif strategy == "nonexistent_id":
        for key in pill:
            if key.endswith("_id"):
                pill[key] = str(uuid.uuid4())  # valid UUID format, but doesn't exist
                break
    elif strategy == "wrong_type":
        key = random.choice(list(pill.keys()))
        pill[key] = "INVALID"

    return pill
```

---

## Quick Reference

| What you need to simulate | How to do it |
|---|---|
| CPU-bound processing in a **worker** (transcoding, rendering) | `burnCpu(ms)` busy-wait loop — actually consumes CPU, blocking is fine in a worker |
| Simulating elapsed time in an **HTTP service** | `await sleep(ms)` — yields to the event loop, service stays responsive |
| Variable processing time | Add ±20% random jitter via `withJitter()` / `with_jitter()` |
| Flaky external service (payment, email) | Random failure rate with `Math.random()` or `random.random()` |
| Email / SMS notifications | Log a structured JSON message |
| Realistic database records | Generate with `@faker-js/faker` (JS) or `faker` (Python) |
| Consistent seed data across runs | `faker.seed(42)` / `Faker.seed(42)` |
| Continuous data stream (sensors) | Simulator container in Docker Compose, `POST` in a loop |
| Poison pills for dead letter testing | Valid message with one field missing, null, or pointing to a nonexistent ID |
| Idempotency testing | Send the same message twice with the same ID and verify the result is identical |
