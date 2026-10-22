# OccupEye Documentation Index

## Overview

This directory contains technical documentation for each subsystem within the OccupEye automated classroom energy and occupancy monitoring system.

OccupEye detects when classroom electrical appliances (such as ceiling fans) are left active in empty rooms and immediately notifies facility personnel, preventing energy waste and reducing institutional operating costs.

---

## Documentation Sections

### 1. [Detection Service](file:///home/keshav/Desktop/JourneyTOBMW/auto_detection/docs/detection_service.md)
Detailed guide for the Python edge monitoring service:
- Computer vision pipeline using YOLOv8 for student detection.
- Ceiling fan inference with Roboflow and temporal stabilization.
- Idle time waste calculation and alert webhook dispatch.
- Python virtual environment setup and configuration reference.

### 2. [Backend Server](file:///home/keshav/Desktop/JourneyTOBMW/auto_detection/docs/server.md)
Detailed guide for the Express TypeScript API server:
- PostgreSQL database setup with Docker Compose or Neon.
- Database schema and Drizzle ORM migrations.
- Cloudinary integration for incident snapshot evidence.
- Administrator authentication, JWT handling, and initial account seeding.
- REST API endpoint reference and Socket.IO real-time event descriptions.

### 3. [Mobile Application](file:///home/keshav/Desktop/JourneyTOBMW/auto_detection/docs/mobile.md)
Detailed guide for the React Native / Expo mobile application:
- Mobile project structure and Expo SDK 57 configuration.
- Real-time incident notifications, push notification service, and live dashboard.
- Dynamic backend server URL switcher.
- Running on Android, iOS, Web, and Expo Go.
- Building release APK packages.

### 4. [GitHub Actions & CI/CD](file:///home/keshav/Desktop/JourneyTOBMW/auto_detection/docs/actions.md)
Detailed guide for automated repository workflows:
- CI validation for server builds and mobile TypeScript verification (`ci.yml`).
- Automated standalone Android APK compilation and GitHub Releases (`build-mobile-apk.yml`).

---

## Quick Reference: Running the System

```bash
# 1. Start PostgreSQL (if running locally)
docker compose up -d

# 2. Start both Server and Mobile together (from root)
pnpm dev

# 3. Start Detection Service (in detection_service/ with venv active)
cd detection_service
source venv/bin/activate
python main.py
```