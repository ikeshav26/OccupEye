import os
os.environ["QT_LOGGING_RULES"] = "*=false"

import time
import logging
from datetime import datetime
from typing import Optional

import cv2
import numpy as np

import base64
import threading
import requests

import config
from detector import StudentDetector
from fan_detector import FanTracker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("OccupEye.Main")


def save_verification_snapshot(frame: np.ndarray, classroom_id: str, elapsed_seconds: int) -> str:
    """Saves a verification snapshot to disk (used for local verification and tests)."""
    try:
        snapshot_dir = getattr(config, "SNAPSHOT_DIR", "snapshots")
        os.makedirs(snapshot_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = os.path.join(snapshot_dir, f"snapshot_{classroom_id}_{timestamp}.jpg")

        snapshot = frame.copy()
        h, w = snapshot.shape[:2]
        cv2.rectangle(snapshot, (0, h - 40), (w, h), (0, 0, 180), -1)

        banner = (
            f"OccupEye Alert | Room: {classroom_id} | Idle: {elapsed_seconds}s | "
            f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        cv2.putText(snapshot, banner, (10, h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.imwrite(filepath, snapshot)
        return filepath
    except Exception as e:
        logger.error(f"Failed to save verification snapshot: {e}")
        return ""


def dispatch_alert_webhook(
    frame: np.ndarray,
    classroom_id: str,
    elapsed_seconds: int,
    student_count: int,
    fan_status: str,
) -> None:
    """Encodes snapshot in-memory and dispatches alert payload to Express server asynchronously."""
    try:
        snapshot = frame.copy()
        h, w = snapshot.shape[:2]
        cv2.rectangle(snapshot, (0, h - 40), (w, h), (0, 0, 180), -1)

        banner = (
            f"OccupEye Alert | Room: {classroom_id} | Students: {student_count} | Fan: {fan_status} | "
            f"Idle: {elapsed_seconds}s | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        cv2.putText(snapshot, banner, (10, h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        ret, buffer = cv2.imencode(".jpg", snapshot, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ret:
            logger.error("Failed to encode snapshot image")
            return

        image_b64 = base64.b64encode(buffer).decode("utf-8")
        payload = {
            "classroom_id": classroom_id,
            "student_count": student_count,
            "fan_status": fan_status,
            "idle_seconds": elapsed_seconds,
            "image_base64": f"data:image/jpeg;base64,{image_b64}",
        }

        def _send():
            try:
                res = requests.post(config.SERVER_WEBHOOK_URL, json=payload, timeout=6)
                if res.status_code in (200, 201):
                    logger.info(f"🚀 Alert webhook successfully delivered to server: {res.json().get('message')}")
                else:
                    logger.error(f"Failed to post alert webhook: {res.status_code} {res.text}")
            except Exception as ex:
                logger.error(f"Error dispatching alert webhook to {config.SERVER_WEBHOOK_URL}: {ex}")

        threading.Thread(target=_send, daemon=True).start()
    except Exception as e:
        logger.error(f"Failed to prepare alert webhook: {e}")


def render_hud(
    frame: np.ndarray,
    student_count: int,
    fan_status: str,
    elapsed_idle: int,
    is_alert: bool,
) -> np.ndarray:
    annotated = frame.copy()
    overlay = annotated.copy()
    cv2.rectangle(overlay, (15, 15), (490, 95), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.75, annotated, 0.25, 0, annotated)

    border_color = (0, 0, 220) if is_alert else (70, 70, 70)
    cv2.rectangle(annotated, (15, 15), (490, 95), border_color, 2)

    line1 = f"Student Count: {student_count} | Fan Status: {fan_status}"
    cv2.putText(annotated, line1, (25, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 255, 255), 2, cv2.LINE_AA)

    if is_alert:
        idle_text = f"Idle Time: {elapsed_idle}s (WARNING)"
        idle_color = (0, 0, 255)
    elif elapsed_idle > 0:
        idle_text = f"Idle Time: {elapsed_idle}s"
        idle_color = (0, 255, 255)
    else:
        idle_text = "Idle Time: 0s"
        idle_color = (200, 200, 200)

    cv2.putText(annotated, idle_text, (25, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.62, idle_color, 2, cv2.LINE_AA)
    return annotated


def main():
    cap = cv2.VideoCapture(config.CAMERA_SOURCE)
    if not cap.isOpened():
        logger.error(f"Cannot open camera source: {config.CAMERA_SOURCE}")
        return

    student_detector = StudentDetector(
        model_path=config.STUDENT_MODEL_PATH,
        conf_threshold=config.CONF_THRESHOLD,
    )
    fan_tracker = FanTracker()
    fan_tracker.start()

    logger.info(
        f"OccupEye running for '{config.CLASSROOM_ID}' "
        f"(Idle Threshold: {config.IDLE_TIME_THRESHOLD}s, Repeat Interval: {config.ALERT_REPEAT_INTERVAL}s). "
        f"Press 'q' to quit."
    )

    idle_start_time: Optional[float] = None
    last_active_time = 0.0
    last_alert_dispatch_time = 0.0

    # Emergency presentation override state:
    # None = Auto (YOLO detection), "ON" = Forced ON, "OFF" = Forced OFF
    manual_fan_override: Optional[str] = None

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            current_time = time.time()
            student_count, annotated_frame, student_boxes = student_detector.detect(frame)

            fan_tracker.update_frame(frame, student_boxes)
            stabilized_fan, _, _, _ = fan_tracker.get_status()
            auto_fan_status = "ON" if stabilized_fan == "ON" else "OFF"

            # Use manual override if activated, otherwise auto model detection
            if manual_fan_override is not None:
                fan_status = manual_fan_override
            else:
                fan_status = auto_fan_status

            # Draw detected fan boxes from model
            for fx1, fy1, fx2, fy2, fcls, fconf in fan_tracker.get_latest_boxes():
                is_on = fcls in ("fan_blur", "ceiling_fan_on", "fan_on", "on")
                color = (255, 180, 0) if is_on else (0, 165, 255)
                label = f"Fan ({'ON' if is_on else 'OFF'}): {fconf:.2f}"
                cv2.rectangle(annotated_frame, (fx1, fy1), (fx2, fy2), color, 2)
                t_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)[0]
                cv2.rectangle(annotated_frame, (fx1, max(0, fy1 - 20)), (fx1 + t_size[0] + 8, max(20, fy1)), color, -1)
                cv2.putText(
                    annotated_frame,
                    label,
                    (fx1 + 4, max(15, fy1 - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (0, 0, 0),
                    1,
                    cv2.LINE_AA,
                )

            is_waste_condition = (student_count == 0) and (fan_status == "ON")
            elapsed_idle = 0
            is_alert = False

            if is_waste_condition:
                last_active_time = current_time
                if idle_start_time is None:
                    idle_start_time = current_time

                elapsed_idle = int(current_time - idle_start_time)
                if elapsed_idle >= config.IDLE_TIME_THRESHOLD:
                    is_alert = True
                    # Send alert immediately once threshold is met, then repeat every ALERT_REPEAT_INTERVAL seconds
                    time_since_last_alert = current_time - last_alert_dispatch_time
                    if last_alert_dispatch_time == 0.0 or time_since_last_alert >= config.ALERT_REPEAT_INTERVAL:
                        dispatch_alert_webhook(
                            frame,
                            config.CLASSROOM_ID,
                            elapsed_idle,
                            student_count,
                            fan_status,
                        )
                        logger.warning(
                            f"⚠️ [WARNING] Energy waste in '{config.CLASSROOM_ID}': "
                            f"0 students & Fan ON for {elapsed_idle}s! Dispatching webhook "
                            f"(next repeat in {config.ALERT_REPEAT_INTERVAL}s)..."
                        )
                        last_alert_dispatch_time = current_time
            else:
                if (current_time - last_active_time) > 2.0:
                    idle_start_time = None
                    last_alert_dispatch_time = 0.0
                    elapsed_idle = 0
                elif idle_start_time is not None:
                    elapsed_idle = int(current_time - idle_start_time)

            display_frame = render_hud(
                annotated_frame,
                student_count,
                fan_status,
                elapsed_idle,
                is_alert,
            )
            cv2.imshow("OccupEye - Classroom Monitoring", display_frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('9'):
                # Presentation emergency toggle: AUTO -> MANUAL ON -> MANUAL OFF -> AUTO
                if manual_fan_override is None:
                    manual_fan_override = "ON"
                elif manual_fan_override == "ON":
                    manual_fan_override = "OFF"
                else:
                    manual_fan_override = None

                override_label = manual_fan_override if manual_fan_override else "AUTO (Model)"
                logger.info(f"⚡ [Emergency Keybind 9] Fan status manually toggled to: {override_label}")
            elif key == ord('0'):
                manual_fan_override = None
                logger.info("🔄 [Keybind 0] Fan status reset to AUTO (Model)")
    finally:
        fan_tracker.stop()
        cap.release()
        cv2.destroyAllWindows()
        logger.info("OccupEye stopped.")


if __name__ == "__main__":
    main()
