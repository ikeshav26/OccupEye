import time
import logging
import threading
from collections import deque
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Tuple, Any

import numpy as np

try:
    from inference_sdk import InferenceHTTPClient
except ImportError:
    InferenceHTTPClient = None

import config

logger = logging.getLogger("OccupEye.FanDetector")


@dataclass
class FanObservation:
    raw_status: str
    confidence: float
    timestamp: float
    predictions: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None


class FanDetector:
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_url: Optional[str] = None,
        model_id: Optional[str] = None,
        confidence_threshold: Optional[float] = None,
        timeout_seconds: Optional[float] = None,
        client: Optional[Any] = None,
    ):
        self.api_key = api_key if api_key is not None else config.ROBOFLOW_API_KEY
        self.api_url = api_url if api_url is not None else config.ROBOFLOW_API_URL
        self.model_id = model_id if model_id is not None else config.FAN_MODEL_ID
        self.confidence_threshold = (
            confidence_threshold if confidence_threshold is not None else config.FAN_CONFIDENCE_THRESHOLD
        )
        self.timeout_seconds = (
            timeout_seconds if timeout_seconds is not None else config.FAN_INFERENCE_TIMEOUT_SECONDS
        )

        if client is not None:
            self.client = client
        elif self.api_key and InferenceHTTPClient is not None:
            try:
                from inference_sdk import InferenceConfiguration
                self.client = InferenceHTTPClient(api_url=self.api_url, api_key=self.api_key)
                self.client.configure(InferenceConfiguration(api_key_transport="both"))
            except Exception as e:
                logger.error(f"Failed to initialize InferenceHTTPClient: {e}")
                self.client = None
        else:
            self.client = None

    def predict_frame(
        self,
        frame: np.ndarray,
        student_boxes: Optional[List[Tuple]] = None,
    ) -> FanObservation:
        now = time.time()

        if not self.api_key:
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=0.0,
                timestamp=now,
                error="Missing ROBOFLOW_API_KEY environment variable",
            )

        if self.client is None:
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=0.0,
                timestamp=now,
                error="InferenceHTTPClient is not initialized or inference-sdk is missing",
            )

        if frame is None or frame.size == 0:
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=0.0,
                timestamp=now,
                error="Invalid or empty video frame",
            )

        try:
            response = self.client.infer(frame, model_id=self.model_id)
            frame_shape = frame.shape[:2] if hasattr(frame, "shape") else None
            return self._parse_response(
                response,
                now,
                frame_shape=frame_shape,
                student_boxes=student_boxes,
            )
        except Exception as e:
            err_msg = str(e)
            if self.api_key:
                err_msg = err_msg.replace(self.api_key, "***API_KEY***")
            logger.warning(f"Fan inference API request failed: {err_msg}")
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=0.0,
                timestamp=now,
                error=f"Inference error: {err_msg}",
            )

    def _parse_response(
        self,
        response: Any,
        timestamp: float,
        frame_shape: Optional[Tuple[int, int]] = None,
        student_boxes: Optional[List[Tuple]] = None,
    ) -> FanObservation:
        if not isinstance(response, dict):
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=0.0,
                timestamp=timestamp,
                error="Malformed response: expected dictionary",
            )

        predictions = response.get("predictions", [])
        if not predictions or not isinstance(predictions, list):
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=0.0,
                timestamp=timestamp,
                predictions=[],
                error="No fan predictions returned",
            )

        confident_preds = []
        for p in predictions:
            if not isinstance(p, dict):
                continue
            conf = float(p.get("confidence", 0.0))
            cls_name = str(p.get("class", "")).strip().lower()
            if conf < self.confidence_threshold:
                continue

            pw = float(p.get("width", 0))
            ph = float(p.get("height", 0))
            fx = float(p.get("x", 0))
            fy = float(p.get("y", 0))

        
            if (pw * ph) < 200:
                continue

            if frame_shape:
                fh, fw = frame_shape
                area_ratio = (pw * ph) / (fw * fh)

               
                if area_ratio > 0.55 or fy > (0.75 * fh):
                    continue

                
                if student_boxes:
                    overlapping_student = False
                    for sbox in student_boxes:
                        sx1, sy1, sx2, sy2 = sbox[:4]
                        if sx1 <= fx <= sx2 and sy1 <= fy <= sy2:
                            overlapping_student = True
                            break
                    if overlapping_student:
                        continue

            confident_preds.append((cls_name, conf, p))

        if not confident_preds:
            highest_conf = max([float(p.get("confidence", 0.0)) for p in predictions if isinstance(p, dict)] or [0.0])
            return FanObservation(
                raw_status="UNKNOWN",
                confidence=highest_conf,
                timestamp=timestamp,
                predictions=predictions,
                error=f"Predictions below threshold ({highest_conf:.2f} < {self.confidence_threshold:.2f})",
            )

        has_fan_on = False
        has_fan_off = False
        best_conf = 0.0

        for cls_name, conf, p in confident_preds:
            if cls_name == "ceiling_fan_on":
                has_fan_on = True
                best_conf = max(best_conf, conf)
            elif cls_name == "ceiling_fan_off":
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
            timestamp=timestamp,
            predictions=predictions,
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
        self.check_interval = check_interval if check_interval is not None else config.FAN_CHECK_INTERVAL_SECONDS
        self.stale_timeout = stale_timeout if stale_timeout is not None else config.FAN_STALE_TIMEOUT_SECONDS
        self.stabilization_count = (
            stabilization_count if stabilization_count is not None else config.FAN_STABILIZATION_COUNT
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
