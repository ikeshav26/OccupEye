# Backend Server Documentation

## Overview

The OccupEye backend server is a Node.js service built with Express 5, TypeScript, Drizzle ORM, and PostgreSQL. It functions as the central communication hub and database layer:
- Ingests alert webhooks from the Detection Service.
- Uploads annotated snapshot evidence to Cloudinary.
- Stores incident logs and administrator accounts in PostgreSQL.
- Broadcasts real-time events to connected clients via Socket.IO.
- Dispatches mobile push notifications using the Expo Server SDK.
- Provides authenticated REST endpoints for the mobile administrative application.

---

## Directory Structure

```
server/
|-- drizzle/             # Generated database migration files
|-- drizzle.config.ts    # Drizzle Kit migration configuration
|-- package.json         # Node.js dependencies and script definitions
|-- tsconfig.json        # TypeScript compiler options
`-- src/
    |-- app.ts           # Express application initialization and middleware
    |-- server.ts        # HTTP server, Socket.IO binding, and port listener
    |-- config/
    |   |-- cloudinary.ts# Cloudinary storage SDK configuration
    |   `-- env.ts       # Validated environment variable loader
    |-- controllers/
    |   |-- alert.controller.ts # Alert ingestion, listing, resolution, push tokens
    |   `-- auth.controller.ts  # Admin login, password changes, token management
    |-- db/
    |   |-- db.ts        # PostgreSQL connection pool and Drizzle client
    |   `-- schema.ts    # Table definitions (admins, notifications, push_tokens)
    |-- middleware/
    |   `-- auth.ts      # JWT verification middleware
    |-- routes/
    |   |-- alert.routes.ts # Alert and push token route endpoints
    |   `-- auth.routes.ts  # Authentication route endpoints
    |-- services/
    |   `-- pushNotification.service.ts # Expo push notification dispatcher
    `-- sockets/
        `-- socket.js    # Socket.IO event handlers and emitter functions
```

---

## Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm
- PostgreSQL database (Local via Docker or cloud-hosted via Neon.tech)
- Cloudinary account for snapshot storage

---

## Setup Instructions

### 1. Install Dependencies

From the repository root or inside `server/`:

```bash
cd server
pnpm install
```

### 2. Configure Environment Variables

Create the `.env` file from the provided `.env.example`:

```bash
cp .env.example .env
```

Configure the following variables in `server/.env`:

```ini
PORT=3000
DATABASE_URL=postgresql://occueye_user:occueye_password@localhost:5432/occueye_db

# Cloudinary credentials
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Security
JWT_SECRET=your_jwt_secret_random_key

# Optional settings
API_URL=http://localhost:3000
KEEP_AWAKE_INTERVAL=14
```

### 3. Database Setup

#### Option A: Local PostgreSQL via Docker Compose

In the root directory, start the PostgreSQL container:

```bash
docker compose up -d
```

The database will be accessible at:
`postgresql://occueye_user:occueye_password@localhost:5432/occueye_db`

#### Option B: Cloud Database (Neon)

Sign up at https://neon.tech, create a project, and paste your connection string into `DATABASE_URL` in `server/.env`.

### 4. Push Database Schema

Use Drizzle Kit to create the necessary tables (`admins`, `notifications`, `push_tokens`):

```bash
npx drizzle-kit push
```

### 5. Create the Initial Admin User

Run the following helper command from the `server` directory to seed an administrator account (`admin` / `admin123`):

```bash
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
bcrypt.hash('admin123', 10).then(hash => {
  pool.query(
    'INSERT INTO admins (username, password_hash) VALUES (\$1, \$2) ON CONFLICT (username) DO NOTHING',
    ['admin', hash]
  ).then(() => {
    console.log('Admin account created successfully: admin / admin123');
    pool.end();
  });
});
"
```

---

## Running the Server

### Development Mode

Runs the server with live reload via `tsx`:

```bash
pnpm dev
```

### Production Build

Compiles TypeScript to JavaScript and executes the production bundle:

```bash
pnpm run build
pnpm start
```

The server listens on `http://localhost:3000`.

---

## Database Schema Reference

### `admins` Table
Stores administrator credentials for authenticating mobile and dashboard clients.
- `id`: Integer primary key (identity)
- `username`: Unique username (varchar 100)
- `password_hash`: Bcrypt hashed password (varchar 255)
- `created_at`: Timestamp
- `updated_at`: Timestamp

### `notifications` Table
Stores alert incident history.
- `id`: Integer primary key (identity)
- `classroom_id`: Identifier of the room where waste was detected (varchar 100)
- `student_count`: Occupancy count at the time of alert (integer)
- `fan_status`: Operational status of the fan, e.g. "ON" (varchar 20)
- `idle_seconds`: Duration in seconds the room remained unoccupied (integer)
- `snapshot_url`: Hosted Cloudinary URL of the incident snapshot image (text)
- `cloudinary_public_id`: Cloudinary asset ID for lifecycle management (varchar 255)
- `is_resolved`: Boolean flag indicating if staff checked the room (boolean, default false)
- `resolved_at`: Timestamp when the incident was marked resolved
- `created_at`: Incident creation timestamp

### `push_tokens` Table
Maintains device push notification tokens for the Expo push notification service.
- `id`: Integer primary key (identity)
- `token`: Unique Expo push token string (varchar 255)
- `device_type`: Device platform (varchar 50)
- `created_at`: Timestamp
- `updated_at`: Timestamp

---

## REST API Reference

### Public Endpoints

#### GET `/`
Returns API metadata and service status.

#### POST `/api/alerts`
Webhook endpoint called by the Detection Service to report an energy waste incident.
- Headers: `Content-Type: application/json`
- Body:
  ```json
  {
    "classroom_id": "room_101",
    "student_count": 0,
    "fan_status": "ON",
    "idle_seconds": 15,
    "image_base64": "data:image/jpeg;base64,..."
  }
  ```
- Response: `201 Created` with saved notification record.

#### POST `/api/auth/login`
Authenticates an administrator.
- Body: `{ "username": "admin", "password": "admin123" }`
- Response: Sets HTTP-only `token` cookie and returns `{ success: true, token, user }`.

#### POST `/api/auth/logout`
Clears the authentication cookie.

#### POST `/api/alerts/push-token`
Registers a mobile device for push notifications.
- Body: `{ "token": "ExponentPushToken[...]", "deviceType": "android" }`

#### DELETE `/api/alerts/push-token`
Unregisters a device push token.
- Body: `{ "token": "ExponentPushToken[...]" }`

---

### Authenticated Endpoints (Requires Bearer Token or Cookie)

#### GET `/api/auth/me`
Retrieves the logged-in administrator's profile.

#### PATCH `/api/auth/change-password`
Changes the administrator's password.
- Body: `{ "currentPassword": "...", "newPassword": "..." }`

#### PATCH `/api/auth/update-username`
Updates the administrator's username.
- Body: `{ "newUsername": "..." }`

#### GET `/api/alerts`
Fetches incident records.
- Query Parameters:
  - `resolved`: `false` (active alerts only) or `true` (resolved alerts only). If omitted, returns all alerts.
- Response: `{ success: true, count: number, alerts: [...] }`

#### PATCH `/api/alerts/:id/resolve`
Marks an alert incident as resolved.
- Response: `{ success: true, alert: { ...is_resolved: true } }`

---

## WebSocket Events (Socket.IO)

Clients connect to the root namespace using `socket.io-client`.

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `alert` | Server -> Client | Notification object | Broadcast when a new incident is ingested |
| `alert:resolved` | Server -> Client | `{ id, isResolved, resolvedAt }` | Broadcast when an alert is marked resolved |
| `client:ping` | Client -> Server | Optional timestamp | Connection health check |
| `client:pong` | Server -> Client | `{ status: "ok" }` | Pong acknowledgement |
