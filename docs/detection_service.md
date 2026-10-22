# Detection Service Documentation

## Overview

The Detection Service is a Python-based edge monitoring module that processes live video feeds from classroom cameras. It uses computer vision to track occupancy and appliance usage simultaneously:
- Detects the presence and count of students in the classroom using a local YOLO model.
- Tracks ceiling fan operational states (ON vs OFF) using a cloud-hosted vision model with temporal stabilization.
- Evaluates energy waste logic (0 students present while fans remain ON).
- Dispatches alert webhooks with encoded snapshot images to the backend server when waste conditions exceed a configured duration threshold.

---

## Directory Structure

```
detection_service/
|-- config.py            # Environment configuration loader and defaults
|-- detector.py          # Student detection class using YOLOv8
|-- fan_detector.py      # Ceiling fan tracker with debounce and stabilization
|-- main.py              # Main loop, heads-up display (HUD), and alert dispatcher
|-- requirements.txt     # Python package requirements
`-- yolov8n.pt           # YOLOv8 nano pre-trained weights
```

---

## Prerequisites

- Python 3.10 or higher
- A connected webcam, USB camera, or an accessible RTSP/HTTP network stream
- A Roboflow account and API key (for ceiling fan state detection)

---

## Setup Instructions

### 1. Create a Virtual Environment

Navigate to the `detection_service` directory and create an isolated Python virtual environment:

```bash
cd detection_service
python3 -m venv venv
source venv/bin/activate
```

On Windows (Command Prompt):
```cmd
venv\Scripts\activate
```

### 2. Install Dependencies

Install the required Python libraries:

```bash
pip install -r requirements.txt
```

The primary dependencies installed include:
- `ultralytics`: YOLOv8 object detection engine
- `opencv-python`: Camera capture and frame manipulation
- `numpy`: Array and image tensor calculations
- `inference-sdk`: Roboflow client library for fan inference
- `python-dotenv`: Environment variable management
- `requests`: HTTP client for dispatching alert webhooks

### 3. Model Weights

The repository includes `yolov8n.pt` (YOLOv8 Nano) inside `detection_service/`. If not present, the `ultralytics` library downloads it automatically upon first launch.

---

## Configuration Reference

Configuration is managed via environment variables. The service loads settings from a `.env` file located either in `detection_service/.env` or in the repository root.

### Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| CAMERA_SOURCE | Integer / String | 0 | Video device index (0 for default webcam) or RTSP stream URL |
| CLASSROOM_ID | String | room_101 | Unique identifier for the monitored classroom |
| STUDENT_MODEL_PATH | String | yolov8n.pt | Path to the local YOLO model file |
| CONF_THRESHOLD | Float | 0.40 | Confidence threshold for student/person detection |
| ROBOFLOW_API_KEY | String | (empty) | API key for the Roboflow ceiling fan detection model |
| ROBOFLOW_API_URL | String | https://serverless.roboflow.com | Roboflow inference server URL |
| FAN_MODEL_ID | String | ceiling-fan-detection-epfsk/1 | Roboflow model ID for ceiling fan state |
| FAN_CONFIDENCE_THRESHOLD | Float | 0.45 | Minimum confidence score for fan detection predictions |
| FAN_CHECK_INTERVAL_SECONDS | Float | 0.5 | Seconds between fan inference queries |
| FAN_INFERENCE_TIMEOUT_SECONDS | Float | 5.0 | Network timeout for fan inference requests |
| FAN_STALE_TIMEOUT_SECONDS | Float | 6.0 | Seconds after which an inference result is considered stale |
| FAN_STABILIZATION_COUNT | Integer | 2 | Number of consecutive matching frames required before updating fan state |
| IDLE_TIME_THRESHOLD | Integer | 10 | Duration (in seconds) that an empty room with fan ON must persist before triggering an alert |
| ALERT_REPEAT_INTERVAL | Integer | 30 | Seconds between recurring alert webhook dispatches if the condition persists |
| SERVER_WEBHOOK_URL | String | http://localhost:3000/api/alerts | Destination HTTP endpoint for alert payloads |

---

## How It Works

### 1. Student Detection (`detector.py`)
The `StudentDetector` class passes each frame to YOLOv8 targeting class ID 0 (Person). It filters detections by `CONF_THRESHOLD`, draws bounding boxes and confidence labels on the frame, and returns the total count of occupants.

### 2. Ceiling Fan Detection and Tracking (`fan_detector.py`)
Ceiling fan inference runs asynchronously in a dedicated background worker thread:
- Queries the Roboflow inference endpoint using `inference-sdk`.
- Employs a sliding history buffer (`FAN_STABILIZATION_COUNT`) to prevent false triggers caused by single-frame anomalies or lighting changes.
- Automatically marks status as `UNKNOWN` if requests time out or network connectivity is lost.

### 3. Waste Detection Logic (`main.py`)
The main loop checks for the following condition:
```
is_waste_condition = (student_count == 0) and (fan_status == "ON")
```
- If true, an idle timer starts.
- If the idle duration reaches or exceeds `IDLE_TIME_THRESHOLD` (e.g., 10 seconds), an alert is generated.
- Subsequent alert dispatches are throttled by `ALERT_REPEAT_INTERVAL` (e.g., every 30 seconds) until students re-enter or fans are shut off.
- If students enter or fans are turned off, the idle timer resets after a 2-second stabilization window.

### 4. Alert Webhook Dispatch
When an alert triggers, the service:
- Takes a snapshot of the current camera frame.
- Overlays an alert banner containing the room ID, timestamp, student count, fan state, and idle seconds.
- Encodes the image to a JPEG base64 string.
- Sends an asynchronous HTTP POST request to `SERVER_WEBHOOK_URL` in a background thread so the camera feed remains smooth.

---

## Running the Service

Execute the main script from the `detection_service` directory:

```bash
python main.py
```

### Controls

- HUD: Displays real-time student count, fan status, and idle seconds.
- Quit: Focus the video window and press `q` on your keyboard to stop monitoring.

---

## Troubleshooting

### Camera Fails to Open
- Check if your camera is being used by another application.
- On Linux, check permissions:
  ```bash
  ls -l /dev/video*
  sudo chmod 666 /dev/video0
  ```
- If using an external USB camera, change `CAMERA_SOURCE=1` in `.env`.

### Roboflow Client Not Working
- Ensure `ROBOFLOW_API_KEY` is set in your `.env`.
- Check internet access to `serverless.roboflow.com`.
- The system handles missing keys by marking fan status as `UNKNOWN` without crashing.

### Webhook Dispatch Errors
- Check that the backend server is running and accessible from the machine hosting the detection service.
- Verify `SERVER_WEBHOOK_URL` in your `.env` points to the correct IP address or domain.
