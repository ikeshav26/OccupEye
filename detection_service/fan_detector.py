import time
import logging
import threading
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Any

import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

import config

logger = logging.getLogger("OccupEye.FanDetector")


@dataclass
class FanObservation:
    raw_status: str
    confidence: float
    timestamp: float
    predictions: List[Dict[str, Any]] = field(default_factory=list)
    fan_boxes: List[Tuple[int, int, int, int, str, float]] = field(default_factory=list)
    error: Optional[str] = None


class FanDetector:
    ON_CLASSES = {"fan_blur", "ceiling_fan_on", "fan_on", "on"}
    OFF_CLASSES = {"fan_stable", "ceiling_fan_off", "fan_off", "off"}

    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: Optional[float] = None,
        model: Optional[Any] = None,
        **kwargs,
    ):
        self.confidence_threshold = (
            confidence_threshold if confidence_threshold is not None else config.FAN_CONFIDENCE_THRESHOLD
        )
        resolved_path = model_path if model_path is not None else getattr(config, "FAN_MODEL_PATH", "data.pt")
        self.model_path = resolved_path

        if model is not None:
            self.model = model
        elif YOLO is not None and self.model_path and Path(self.model_path).exists():
            try:
                self.model = YOLO(self.model_path)
                logger.info(f"Loaded local fan detection model from '{self.model_path}' (classes: {getattr(self.model, 'names', {})})")
            except Exception as e:
                logger.error(f"Failed to load fan YOLO model from '{self.model_path}': {e}")
                self.model = None
        else:
            self.model = None

    def predict_frame(
        self,
        frame: np.ndarray,
        student_boxes: Optional[List[Tuple]] = None,
    ) -> FanObservation:
        now = time.time()

        if self.model is None:
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=0.0,
                timestamp=now,
                error="Fan YOLO model is not loaded or missing",
            )

        if frame is None or frame.size == 0:
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=0.0,
                timestamp=now,
                error="Invalid or empty video frame",
            )

        try:
            results = self.model(frame, conf=self.confidence_threshold, verbose=False)
            predictions: List[Dict[str, Any]] = []
            fan_boxes: List[Tuple[int, int, int, int, str, float]] = []

            for r in results:
                boxes = getattr(r, "boxes", [])
                names_dict = getattr(r, "names", getattr(self.model, "names", {}))
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    cls_name = str(names_dict.get(cls_id, cls_id)).strip().lower()

                    pw = x2 - x1
                    ph = y2 - y1
                    if (pw * ph) < 150:
                        continue

                    # Filter out student overlapping box if present
                    if student_boxes:
                        cx = (x1 + x2) / 2
                        cy = (y1 + y2) / 2
                        overlapping_student = False
                        for sbox in student_boxes:
                            sx1, sy1, sx2, sy2 = sbox[:4]
                            if sx1 <= cx <= sx2 and sy1 <= cy <= sy2:
                                overlapping_student = True
                                break
                        if overlapping_student:
                            continue

                    predictions.append({
                        "class": cls_name,
                        "confidence": conf,
                        "x": (x1 + x2) / 2,
                        "y": (y1 + y2) / 2,
                        "width": pw,
                        "height": ph,
                        "box": (x1, y1, x2, y2),
                    })
                    fan_boxes.append((x1, y1, x2, y2, cls_name, conf))

            if not predictions:
                return FanObservation(
                    raw_status="UNKNOWN",
                    confidence=0.0,
                    timestamp=now,
                    predictions=[],
                    fan_boxes=[],
                    error="No fan predictions returned",
                )

            has_fan_on = False
            has_fan_off = False
            best_conf = 0.0

            for p in predictions:
                cls_name = p["class"]
                conf = p["confidence"]
                if cls_name in self.ON_CLASSES:
                    has_fan_on = True
                    best_conf = max(best_conf, conf)
                elif cls_name in self.OFF_CLASSES:
                    has_fan_off = True
                    best_conf = max(best_conf, conf)

            if has_fan_on:
                raw_status = "ON"
            elif has_fan_off:
                raw_status = "OFF"
            else:
                raw_status = "UNKNOWN"

            return FanObservation(
                raw_status=raw_status,
                confidence=best_conf,
                timestamp=now,
                predictions=predictions,
                fan_boxes=fan_boxes,
            )
        except Exception as e:
            logger.warning(f"Fan inference failed: {e}")
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=0.0,
                timestamp=now,
                error=f"Inference error: {e}",
            )


class FanTracker:
    def __init__(
        self,
        detector: Optional[FanDetector] = None,
        check_interval: Optional[float] = None,
        stale_timeout: Optional[float] = None,
        stabilization_count: Optional[int] = None,
    ):
        self.detector = detector if detector is not None else FanDetector()
        self.check_interval = check_interval if check_interval is not None else getattr(config, "FAN_CHECK_INTERVAL_SECONDS", 0.5)
        self.stale_timeout = stale_timeout if stale_timeout is not None else getattr(config, "FAN_STALE_TIMEOUT_SECONDS", 6.0)
        self.stabilization_count = (
            stabilization_count if stabilization_count is not None else getattr(config, "FAN_STABILIZATION_COUNT", 2)
        )

        self._lock = threading.Lock()
        self._latest_frame: Optional[np.ndarray] = None
        self._latest_student_boxes: List[Tuple] = []
        self._new_frame_available = False
        self._stop_event = threading.Event()
        self._worker_thread: Optional[threading.Thread] = None

        self.last_observation: Optional[FanObservation] = None
        self.last_successful_time: float = 0.0
        self.stabilized_status: str = "UNKNOWN"
        self._recent_valid_predictions: deque = deque(maxlen=self.stabilization_count)
        self._latest_fan_boxes: List[Tuple[int, int, int, int, str, float]] = []

    def start(self):
        if self._worker_thread is None or not self._worker_thread.is_alive():
            self._stop_event.clear()
            self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True, name="FanWorker")
            self._worker_thread.start()

    def stop(self):
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)

    def update_frame(self, frame: np.ndarray, student_boxes: Optional[List[Tuple]] = None):
        with self._lock:
            self._latest_frame = frame.copy()
            self._latest_student_boxes = list(student_boxes) if student_boxes else []
            self._new_frame_available = True

    def get_latest_boxes(self) -> List[Tuple[int, int, int, int, str, float]]:
        with self._lock:
            return list(self._latest_fan_boxes)

    def _worker_loop(self):
        while not self._stop_event.is_set():
            frame_to_process = None
            boxes_to_process = []
            with self._lock:
                if self._new_frame_available and self._latest_frame is not None:
                    frame_to_process = self._latest_frame
                    boxes_to_process = self._latest_student_boxes
                    self._new_frame_available = False

            if frame_to_process is not None:
                obs = self.detector.predict_frame(frame_to_process, student_boxes=boxes_to_process)
                self._record_observation(obs)

            self._stop_event.wait(self.check_interval)

    def _record_observation(self, obs: FanObservation):
        with self._lock:
            self.last_observation = obs
            self._latest_fan_boxes = list(obs.fan_boxes)

            if obs.raw_status in ("ON", "OFF"):
                effective_status = obs.raw_status
            elif obs.error == "No fan predictions returned" or (obs.error and "below threshold" in obs.error):
                effective_status = "OFF"
            else:
                effective_status = "UNKNOWN"

            if effective_status in ("ON", "OFF"):
                self.last_successful_time = obs.timestamp
                self._recent_valid_predictions.append(effective_status)

                if (
                    len(self._recent_valid_predictions) == self.stabilization_count
                    and len(set(self._recent_valid_predictions)) == 1
                ):
                    self.stabilized_status = self._recent_valid_predictions[0]
                elif self.stabilization_count == 1:
                    self.stabilized_status = effective_status
            else:
                self._recent_valid_predictions.clear()

    def get_status(self) -> Tuple[str, str, float, float]:
        with self._lock:
            now = time.time()
            raw_status = self.last_observation.raw_status if self.last_observation else "UNKNOWN"
            confidence = self.last_observation.confidence if self.last_observation else 0.0
            last_time = self.last_successful_time

            if last_time == 0.0 or (now - last_time > self.stale_timeout):
                return "UNKNOWN", raw_status, confidence, last_time

            return self.stabilized_status, raw_status, confidence, last_time
