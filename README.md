# OccupEye: Automated Classroom Energy & Occupancy Monitoring

Author: Keshav Gilhotra

## What is OccupEye?

OccupEye is an intelligent classroom energy and occupancy monitoring system. It uses computer vision to detect when classroom appliances (such as ceiling fans) are left running inside unoccupied rooms. When energy waste is detected, the system immediately captures an annotated snapshot and alerts facility administrators via push notifications and live dashboard updates.

### The Problem

In educational institutions, fans and lights are frequently left running after lectures end. Manual checks by maintenance personnel are sporadic and time-consuming, leading to significant electrical waste and inflated utility bills.

### The Solution

OccupEye automates this process continuously at the edge:
1. Counts the number of students present in real time using a local YOLOv8 computer vision model.
2. Identifies whether ceiling fans are active using a temporal-stabilized vision model.
3. Triggers an energy waste alert when 0 students are present while fans remain ON past a configurable idle threshold.
4. Posts an alert webhook with photographic evidence to a central backend.
5. Pushes instant alerts and live updates to an administrative mobile application for review and resolution.

---

## System Architecture

```
                 +--------------------------+
                 |    Classroom Camera      |
                 +------------+-------------+
                              |
                              v
                 +--------------------------+
                 |    Detection Service     |
                 |  - YOLOv8 (Students)     |
                 |  - Roboflow (Fan state)  |
                 |  - Idle Logic & Snapshot |
                 +------------+-------------+
                              |
                    HTTP POST (Alert Webhook)
                              |
                              v
                 +--------------------------+
                 |      Express Server      |
                 |  - Ingestion Controller  |
                 |  - Socket.IO Server      |
                 |  - Expo Push Service     |
                 +-----+--------------+-----+
                       |              |
           +-----------+              +-----------+
           |                                      |
           v                                      v
+--------------------+                  +--------------------+
| Cloudinary Storage |                  | PostgreSQL Database|
| (Alert Snapshots)  |                  | (Drizzle ORM)      |
+--------------------+                  +--------------------+
           |                                      |
           +-----------+              +-----------+
                       |              |
                       v              v
                 +--------------------------+
                 |    Mobile Application    |
                 |  - Live Status & Alerts  |
                 |  - Snapshot Verification |
                 |  - Incident Resolution   |
                 +--------------------------+
```

---

## Subsystems Overview

### 1. Detection Service (`detection_service/`)
A Python service that runs on edge hardware connected to classroom cameras. It uses YOLOv8 for real-time person detection, Roboflow Inference for ceiling fan state verification, and a temporal stabilization buffer to prevent false positives.
- Full setup and configuration guide: [Detection Service Documentation](docs/detection_service.md)

### 2. Backend Server (`server/`)
A Node.js service built with Express 5, TypeScript, Drizzle ORM, and PostgreSQL. It ingests alert webhooks, uploads snapshot proof to Cloudinary, persists incident records, and broadcasts live events via Socket.IO and Expo Push Notifications.
- Full setup and configuration guide: [Backend Server Documentation](docs/server.md)

### 3. Mobile Application (`mobile/`)
A cross-platform React Native / Expo application for campus administrators and facility managers. Features real-time alert banners, incident photo review, one-tap incident resolution, and a dynamic backend server switcher.
- Full setup and configuration guide: [Mobile Application Documentation](docs/mobile.md)

### 4. GitHub Actions and CI/CD (`.github/workflows/`)
Automated pipelines for continuous integration and mobile distribution:
- `ci.yml`: Verifies TypeScript builds and typechecks across server and mobile code.
- `build-mobile-apk.yml`: Compiles and signs standalone Android APK packages on demand or on tag release.
- Detailed workflow guide: [GitHub Actions Documentation](docs/actions.md)

---

## Quick Start: Running Server and Mobile Together

The root workspace includes a `package.json` that uses `concurrently` to launch both the backend server and the mobile Expo development server with a single command:

```bash
# 1. Install root dependencies (once)
pnpm install

# 2. Run both Server and Mobile concurrently
pnpm dev
```

### Individual Service Commands

From the project root:

- `pnpm dev:server` - Starts only the backend server in watch mode
- `pnpm dev:mobile` - Starts only the Expo mobile app development server
- `pnpm install:all` - Installs dependencies in both `server/` and `mobile/`
- `pnpm build:server` - Compiles the TypeScript server to `dist/`
- `pnpm check:mobile` - Runs TypeScript typechecking on the mobile codebase

---

## Documentation Index

For detailed step-by-step setup instructions, environment variable specifications, and troubleshooting for each component, consult the documentation in `docs/`:

- [Documentation Index](docs/readme.md)
- [Detection Service Setup & Configuration](docs/detection_service.md)
- [Backend Server & Database Setup](docs/server.md)
- [Mobile App Setup & Running](docs/mobile.md)
- [GitHub Actions & APK Release Workflows](docs/actions.md)

---

## License

This project is licensed under the MIT License.