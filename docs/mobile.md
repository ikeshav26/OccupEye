# Mobile Application Documentation

## Overview

The OccupEye mobile application is built using React Native and Expo (SDK 57) with Expo Router. It serves as an administrative client that allows school staff and facility managers to:
- Monitor live classroom statuses and active alerts in real time.
- Receive instant push notifications whenever energy waste is detected.
- View incident photo evidence (snapshots with detection overlays and metrics).
- Mark incidents as resolved once the room has been inspected.
- Switch between development, local network, and production backend servers directly within the app interface.
- Manage administrator account settings.

---

## Directory Structure

```
mobile/
|-- app.json             # Expo project configuration (bundle ID, permissions, plugins)
|-- eas.json             # Expo Application Services build configuration
|-- package.json         # React Native and Expo dependencies
|-- tsconfig.json        # TypeScript configuration
`-- src/
    |-- app/             # Expo Router entry point
    |   |-- _layout.tsx  # Root navigation layout and global context providers
    |   `-- index.tsx    # Main container screen switching between tabs
    |-- components/      # UI screens and modular components
    |   |-- DashboardScreen.tsx # High-level system metrics and active alert summary
    |   |-- AlertsScreen.tsx    # Detailed alert list with snapshot review and resolve actions
    |   |-- LoginScreen.tsx     # Administrator sign-in and server switcher modal
    |   `-- Toast.tsx           # In-app toast alerts
    |-- context/
    |   |-- AuthContext.tsx     # Authentication state, login, and logout routines
    |   `-- ToastContext.tsx    # Global toast state provider
    |-- services/
    |   |-- api.ts              # Axios client with bearer token interceptor
    |   |-- config.ts           # Dynamic server URL resolver and AsyncStorage persistence
    |   |-- notifications.ts    # Expo push notification registration and listener
    |   `-- socket.ts           # Socket.IO client for live incident updates
    `-- types/                  # Shared TypeScript interfaces
```

---

## Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm
- One of the following testing environments:
  - Physical Android or iOS device running the Expo Go app
  - Android Studio Emulator (for Android emulation)
  - Xcode Simulator (macOS only, for iOS simulation)
  - Modern web browser (Chrome, Safari, Firefox, Edge)

---

## Setup Instructions

### 1. Install Dependencies

From the repository root or inside `mobile/`:

```bash
cd mobile
pnpm install
```

### 2. Configure Environment

Create or edit `mobile/.env` to specify your backend server endpoint:

```ini
EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3000
```

#### Network Configuration Guidelines:
- Testing on Local Computer / Web Browser:
  You can set `EXPO_PUBLIC_API_URL=http://localhost:3000`.
- Testing on a Physical Phone via Expo Go:
  Phones cannot reach `localhost`. Use your computer's local Wi-Fi IP address (e.g., `http://192.168.1.100:3000`). Both your computer and phone must be connected to the same Wi-Fi network.
- Testing against Remote Production Server:
  Set `EXPO_PUBLIC_API_URL=https://occupeye.onrender.com`.

### 3. Dynamic Server Switcher

The login screen includes a built-in server switcher. If you need to test against a different endpoint without re-building:
1. Open the login screen.
2. Tap the server settings icon.
3. Enter the desired backend URL and tap Save.
The app persists the selected URL across sessions using AsyncStorage.

---

## Running the Application

Start the Expo development server:

```bash
npx expo start
```

Once the interactive terminal appears, use the following key shortcuts:

- Press `a`: Open in an Android emulator.
- Press `i`: Open in an iOS simulator (macOS required).
- Press `w`: Open in your default web browser.
- Press `r`: Reload the app.
- Press `c`: Show project terminal commands.

### Running with Expo Go on a Physical Device

1. Install Expo Go from Google Play Store or Apple App Store.
2. Ensure your phone and development computer are on the same local Wi-Fi.
3. Scan the QR code displayed in your terminal using the Expo Go app (on iOS, use the standard Camera app).

---

## Key Features and Workflows

### 1. Authentication
- Staff members authenticate with username and password.
- Default credentials: `admin` / `admin123`.
- Tokens are stored in AsyncStorage and attached to every API request via an Axios authorization interceptor.

### 2. Real-Time Socket Connection
- Upon login, the app establishes a WebSocket connection to the backend via `Socket.IO`.
- Listens for `alert` events: Immediately increments active alert counts and displays an in-app banner.
- Listens for `alert:resolved` events: Automatically updates the UI when another administrator resolves an incident.

### 3. Push Notifications
- The app requests system notification permissions upon initial login.
- Registers an Expo Push Token with `POST /api/alerts/push-token`.
- Handles both foreground and background notification delivery using `expo-notifications`.

### 4. Incident Review and Resolution
- Administrators can view active and resolved incident lists.
- Tapping an incident displays full metrics: Room ID, duration of unoccupied state, student count, and the annotated snapshot evidence.
- Tapping "Resolve" sends a PATCH request to mark the incident resolved and broadcasts the resolution across all connected clients.

---

## Building Standalone Android APKs

You can compile standalone Android APK packages using either GitHub Actions or local Gradle commands.

### Option A: Via GitHub Actions (Recommended)
Use the automated workflow in the repository:
1. Navigate to the GitHub repository Actions tab.
2. Select "Build & Release Mobile APK".
3. Trigger the workflow with your desired version tag and backend URL.
4. Download the generated APK directly from the resulting GitHub Release.

### Option B: Local Android Build
To build locally with Android Studio / Gradle:

```bash
cd mobile
npx expo run:android --variant release
```

The APK will be generated under `mobile/android/app/build/outputs/apk/release/`.

---

## Troubleshooting

### App Cannot Connect to Server
- If testing on a physical phone, ensure you did not use `localhost` in `EXPO_PUBLIC_API_URL`.
- Verify your computer's firewall allows incoming connections on port 3000.
- Check that the phone and computer are on the same Wi-Fi subnet.

### Notifications Not Appearing on Android
- In Android system settings, ensure notification permissions are granted for Expo Go or the standalone OccupEye APK.
- Ensure Google Play Services are up to date on your device.
