# GitHub Actions and CI/CD Documentation

## Overview

The OccupEye repository includes automated GitHub Actions workflows located in `.github/workflows/`. These workflows provide continuous integration checks on incoming code and automate the production compilation and release of Android APK packages.

---

## Workflows Summary

| Workflow File | Name | Trigger Events | Purpose |
|---|---|---|---|
| `ci.yml` | CI | Push to `main`, Pull Requests targeting `main` | Validates TypeScript compilation for Server and runs typechecking for Mobile |
| `build-mobile-apk.yml` | Build & Release Mobile APK | Manual trigger (`workflow_dispatch`), Tag push (`v*`) | Builds production Android APK, signs it, and attaches the binary to a GitHub Release |

---

## 1. Continuous Integration Workflow (`ci.yml`)

### Purpose
The CI workflow ensures that pull requests and merges into the `main` branch do not break TypeScript compilation or type consistency across both the backend server and the mobile application.

### Jobs and Steps

#### Job 1: `check-server`
Runs on `ubuntu-latest` inside the `server/` directory:
1. Checks out the repository code (`actions/checkout@v4`).
2. Installs `pnpm` (version 10) via `pnpm/action-setup@v4`.
3. Sets up Node.js 20 with pnpm cache enabled based on `server/pnpm-lock.yaml`.
4. Installs server dependencies using `pnpm install --frozen-lockfile`.
5. Compiles TypeScript code using `pnpm run build` (`tsc`).

#### Job 2: `check-mobile`
Runs on `ubuntu-latest` inside the `mobile/` directory:
1. Checks out the repository code (`actions/checkout@v4`).
2. Installs `pnpm` (version 10) via `pnpm/action-setup@v4`.
3. Sets up Node.js 20 with pnpm cache enabled based on `mobile/pnpm-lock.yaml`.
4. Installs mobile dependencies using `pnpm install --frozen-lockfile`.
5. Runs typechecking across the mobile codebase using `pnpm tsc --noEmit`.

---

## 2. Mobile APK Build and Release Workflow (`build-mobile-apk.yml`)

### Purpose
The APK build workflow enables developers and administrators to produce ready-to-install Android APK files without needing local Android SDK, NDK, or Gradle installations.

### Triggering Mechanisms

1. Manual Trigger (`workflow_dispatch`):
   Allows triggering a build on demand from the GitHub web UI with custom parameters.
2. Git Tag Push:
   Pushing any tag starting with `v` (e.g., `git push origin v1.0.2`) automatically runs the workflow.

### Workflow Inputs (Manual Trigger)

| Input Name | Type | Default | Description |
|---|---|---|---|
| `version` | String | v1.0.1 | Release version tag to assign to the build |
| `api_url` | String | https://occupeye.onrender.com | Backend API URL injected into the application build |
| `arch` | Choice | arm64-v8a | Architecture to target: `arm64-v8a` (~35MB for modern phones), `arm64-v8a,armeabi-v7a`, or `universal` (~100MB) |
| `release_notes` | String | Automated release of OccupEye Mobile APK | Changelog notes included on the GitHub Release page |

### Pipeline Stages

1. Version Resolution: Normalizes the version string and tags the release.
2. Config Injection: Injects `EXPO_PUBLIC_API_URL` into `mobile/.env` and updates version numbers in `app.json` and `package.json`.
3. Toolchain Setup:
   - Sets up Java 17 (Temurin).
   - Configures Android SDK command-line tools, build tools, platforms, and NDK.
   - Sets up Node.js and pnpm with dependency caching.
4. Native Code Generation:
   Runs `npx expo prebuild --platform android --clean` to generate the native Android project from Expo templates.
5. Production Build:
   Runs Gradle assemble release (`./gradlew assembleRelease`) with memory optimizations.
6. Package Signing:
   Signs and aligns the generated APK using Android `zipalign` and `apksigner` with the repository keystore.
7. GitHub Release Publication:
   Creates a new GitHub Release with the specified tag and uploads the signed `.apk` file as a release asset.

---

## How to Trigger an APK Build

1. Open your repository on GitHub.
2. Click on the "Actions" tab at the top.
3. Select "Build & Release Mobile APK" from the left sidebar.
4. Click the "Run workflow" dropdown button.
5. Enter the desired version (e.g., `v1.0.3`) and backend API URL.
6. Click "Run workflow".
7. Once the job completes, navigate to the "Releases" section of the repository to download `OccupEye-vX.X.X.apk`.
