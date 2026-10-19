import os
os.environ["QT_LOGGING_RULES"] = "*=false"

import time
import logging
from datetime import datetime
from typing import Optional

import cv2
import numpy as np

import config
from detector import StudentDetector
from fan_detector import FanTracker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("OccupEye.Main")


def save_verification_snapshot(frame: np.ndarray, classroom_id: str, elapsed_seconds: int) -> str:
    try:
        os.makedirs(config.SNAPSHOT_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = os.path.join(config.SNAPSHOT_DIR, f"snapshot_{classroom_id}_{timestamp}.jpg")

        snapshot = frame.copy()
        h, w = snapshot.shape[:2]
        cv2.rectangle(snapshot, (0, h - 40), (w, h), (0, 0, 180), -1)

        banner = (
            f"OccupEye Alert | Room: {classroom_id} | Students: 0 | Fan: ON | "
            f"Idle: {elapsed_seconds}s | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        cv2.putText(snapshot, banner, (10, h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.imwrite(filepath, snapshot)
        return filepath
    except Exception as e:
        logger.error(f"Failed to save verification snapshot: {e}")
        return ""


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

    logger.info(f"OccupEye running for '{config.CLASSROOM_ID}' (Idle Threshold: {config.IDLE_TIME_THRESHOLD}s). Press 'q' to quit.")

    idle_start_time: Optional[float] = None
    last_active_time = 0.0
    alert_dispatched = False

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            current_time = time.time()
            student_count, annotated_frame, student_boxes = student_detector.detect(frame)

            fan_tracker.update_frame(frame, student_boxes)
            stabilized_fan, _, _, _ = fan_tracker.get_status()
            fan_status = "ON" if stabilized_fan == "ON" else "OFF"

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
                    if not alert_dispatched:
                        snapshot = save_verification_snapshot(frame, config.CLASSROOM_ID, elapsed_idle)
                        logger.warning(
                            f"⚠️ [WARNING] Energy waste in '{config.CLASSROOM_ID}': "
                            f"0 students & Fan ON for {elapsed_idle}s! Snapshot: '{snapshot}'"
                        )
                        alert_dispatched = True
            else:
                if (current_time - last_active_time) > 2.0:
                    idle_start_time = None
                    alert_dispatched = False
                    elapsed_idle = 0
                elif idle_start_time is not None:
                    elapsed_idle = int(current_time - idle_start_time)

            display_frame = render_hud(annotated_frame, student_count, fan_status, elapsed_idle, is_alert)
            cv2.imshow("OccupEye - Classroom Monitoring", display_frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        fan_tracker.stop()
        cap.release()
        cv2.destroyAllWindows()
        logger.info("OccupEye stopped.")


if __name__ == "__main__":
    main()
