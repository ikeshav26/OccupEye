"""
Unit Tests for local YOLO-based FanDetector and FanTracker modules.
Tests fan_blur (ON), fan_stable (OFF), confidence thresholds, and stabilization.
"""

import time
import pytest
import numpy as np
from unittest.mock import MagicMock

from fan_detector import FanDetector, FanTracker, FanObservation


@pytest.fixture
def dummy_frame():
    """Returns a dummy 480x640 BGR image frame."""
    return np.zeros((480, 640, 3), dtype=np.uint8)


def create_mock_yolo_result(boxes_data, names_map=None):
    """Helper to create mock ultralytics result."""
    if names_map is None:
        names_map = {0: "fan_blur", 1: "fan_stable"}

    mock_boxes = []
    for x1, y1, x2, y2, conf, cls_id in boxes_data:
        box = MagicMock()
        box.xyxy = [[x1, y1, x2, y2]]
        box.conf = [conf]
        box.cls = [cls_id]
        mock_boxes.append(box)

    mock_res = MagicMock()
    mock_res.boxes = mock_boxes
    mock_res.names = names_map
    return [mock_res]


class TestFanDetector:
    def test_missing_model_returns_unknown(self, dummy_frame):
        """When YOLO model is not loaded, prediction must be UNKNOWN with an error message."""
        detector = FanDetector(model_path="non_existent_model.pt", model=None)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "UNKNOWN"
        assert obs.confidence == 0.0
        assert "not loaded or missing" in obs.error

    def test_empty_frame_returns_unknown(self):
        """Empty frame returns UNKNOWN with error."""
        detector = FanDetector(model=MagicMock())
        obs = detector.predict_frame(np.array([]))
        assert obs.raw_status == "UNKNOWN"
        assert "Invalid or empty video frame" in obs.error

    def test_fan_blur_maps_to_on(self, dummy_frame):
        """fan_blur (class 0) with confidence >= threshold maps to ON."""
        mock_model = MagicMock()
        mock_model.names = {0: "fan_blur", 1: "fan_stable"}
        mock_model.return_value = create_mock_yolo_result([(100, 100, 200, 200, 0.88, 0)])

        detector = FanDetector(confidence_threshold=0.35, model=mock_model)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "ON"
        assert obs.confidence == 0.88
        assert obs.error is None
        assert len(obs.fan_boxes) == 1

    def test_fan_stable_maps_to_off(self, dummy_frame):
        """fan_stable (class 1) with confidence >= threshold maps to OFF."""
        mock_model = MagicMock()
        mock_model.names = {0: "fan_blur", 1: "fan_stable"}
        mock_model.return_value = create_mock_yolo_result([(100, 100, 200, 200, 0.75, 1)])

        detector = FanDetector(confidence_threshold=0.35, model=mock_model)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "OFF"
        assert obs.confidence == 0.75
        assert len(obs.fan_boxes) == 1

    def test_no_predictions_returned(self, dummy_frame):
        """Empty detections returns UNKNOWN."""
        mock_model = MagicMock()
        mock_model.names = {0: "fan_blur", 1: "fan_stable"}
        mock_model.return_value = create_mock_yolo_result([])

        detector = FanDetector(model=mock_model)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "UNKNOWN"
        assert "No fan predictions" in obs.error

    def test_real_data_pt_inference_if_available(self, dummy_frame):
        """If data.pt is present, verify real YOLO model loads and runs inference."""
        from pathlib import Path
        model_paths = ["data.pt", "detection_service/data.pt"]
        valid_path = next((p for p in model_paths if Path(p).exists()), None)
        if valid_path:
            detector = FanDetector(model_path=valid_path, confidence_threshold=0.35)
            assert detector.model is not None
            obs = detector.predict_frame(dummy_frame)
            assert obs.raw_status in ("ON", "OFF", "UNKNOWN")


class TestFanTracker:
    def test_stabilization_requires_consecutive_frames(self):
        """FanTracker requires stabilization_count consecutive detections to change stabilized status."""
        detector = FanDetector(model=MagicMock())
        tracker = FanTracker(detector=detector, stabilization_count=2, stale_timeout=10.0)

        # 1st ON frame
        obs_on1 = FanObservation(raw_status="ON", confidence=0.85, timestamp=time.time())
        tracker._record_observation(obs_on1)
        assert tracker.stabilized_status == "UNKNOWN"

        # 2nd consecutive ON frame -> stabilized to ON
        obs_on2 = FanObservation(raw_status="ON", confidence=0.89, timestamp=time.time())
        tracker._record_observation(obs_on2)
        assert tracker.stabilized_status == "ON"

        # 1 OFF frame -> still ON until stabilized
        obs_off1 = FanObservation(raw_status="OFF", confidence=0.80, timestamp=time.time())
        tracker._record_observation(obs_off1)
        assert tracker.stabilized_status == "ON"

        # 2nd consecutive OFF frame -> stabilized to OFF
        obs_off2 = FanObservation(raw_status="OFF", confidence=0.82, timestamp=time.time())
        tracker._record_observation(obs_off2)
        assert tracker.stabilized_status == "OFF"

    def test_stale_timeout_resets_status_to_unknown(self):
        """When observation becomes older than stale_timeout, get_status reports UNKNOWN."""
        detector = FanDetector(model=MagicMock())
        tracker = FanTracker(detector=detector, stabilization_count=1, stale_timeout=2.0)

        past_time = time.time() - 5.0
        obs = FanObservation(raw_status="ON", confidence=0.9, timestamp=past_time)
        tracker._record_observation(obs)

        stabilized, raw, conf, last_time = tracker.get_status()
        assert stabilized == "UNKNOWN"
