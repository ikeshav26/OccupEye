import cv2
import time
import config
from detector import StudentDetector

def main():
    cap = cv2.VideoCapture(config.CAMERA_SOURCE)
    if not cap.isOpened():
        print("Error: Could not access webcam. Please check your camera permissions/index.")
        return

    detector = StudentDetector(conf_threshold=config.CONF_THRESHOLD)
    print("Classroom monitoring started. Press 'q' to quit.")

    prev_time = 0
    idle_start_time = None
    last_alert_time = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame.")
            break

        current_time = time.time()

        fps = 1 / (current_time - prev_time) if prev_time > 0 else 0
        prev_time = current_time

        count, annotated_frame, _ = detector.detect(frame)


        is_fan_on = config.FAN_STATUS.upper() == "ON"
        is_empty = count == 0
        elapsed_idle = 0
        is_warning = False

        if is_empty and is_fan_on:
            if idle_start_time is None:
                idle_start_time = current_time

            elapsed_idle = current_time - idle_start_time

            if elapsed_idle >= config.IDLE_TIME_THRESHOLD:
                is_warning = True

                if current_time - last_alert_time >= config.IDLE_TIME_THRESHOLD:
                    print(f"⚠️ [WARNING] Fans are ON and 0 students detected for past {int(elapsed_idle)}s!")
                    last_alert_time = current_time
        else:
            idle_start_time = None

        box_color = (0, 0, 180) if is_warning else (20, 20, 20)
        cv2.rectangle(annotated_frame, (10, 10), (450, 75), box_color, -1)

        status_line = f"Students: {count} | Fan: {config.FAN_STATUS} | FPS: {int(fps)}"
        cv2.putText(
            annotated_frame, status_line, (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2, cv2.LINE_AA
        )

        if is_warning:
            timer_text = f"ALERT: Idle for {int(elapsed_idle)}s! Turn off fans!"
            text_color = (0, 255, 255)
        elif idle_start_time is not None:
            timer_text = f"Idle Timer: {int(elapsed_idle)}s / {config.IDLE_TIME_THRESHOLD}s"
            text_color = (200, 200, 200)
        else:
            timer_text = "Room Active (Timer Reset)"
            text_color = (0, 255, 0)

        cv2.putText(
            annotated_frame, timer_text, (20, 62),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 2, cv2.LINE_AA
        )

        cv2.imshow("Classroom Monitoring", annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
