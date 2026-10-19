"""
Unit Tests for FanDetector and FanTracker modules.
Mocks Roboflow InferenceHTTPClient to test offline without consuming credits.
"""

import time
import pytest
import numpy as np
from unittest.mock import MagicMock, patch

from fan_detector import FanDetector, FanTracker, FanObservation


@pytest.fixture
def dummy_frame():
    """Returns a dummy 480x640 BGR image frame."""
    return np.zeros((480, 640, 3), dtype=np.uint8)


class TestFanDetector:
    def test_missing_api_key_returns_unknown(self, dummy_frame):
        """When ROBOFLOW_API_KEY is not provided, prediction must be UNKNOWN with an error message."""
        detector = FanDetector(api_key="")
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "UNKNOWN"
        assert obs.confidence == 0.0
        assert "Missing ROBOFLOW_API_KEY" in obs.error

    def test_fan_on_prediction(self, dummy_frame):
        """ceiling_fan_on with confidence >= threshold maps to ON."""
        mock_client = MagicMock()
        mock_client.infer.return_value = {
            "predictions": [
                {"class": "ceiling_fan_on", "confidence": 0.88, "x": 100, "y": 100, "width": 50, "height": 50}
            ]
        }
        detector = FanDetector(api_key="mock_key", confidence_threshold=0.65, client=mock_client)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "ON"
        assert obs.confidence == 0.88
        assert obs.error is None

    def test_fan_off_prediction(self, dummy_frame):
        """ceiling_fan_off with confidence >= threshold maps to OFF."""
        mock_client = MagicMock()
        mock_client.infer.return_value = {
            "predictions": [
                {"class": "ceiling_fan_off", "confidence": 0.75, "x": 200, "y": 200, "width": 60, "height": 60}
            ]
        }
        detector = FanDetector(api_key="mock_key", confidence_threshold=0.65, client=mock_client)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "OFF"
        assert obs.confidence == 0.75

    def test_no_predictions_returned(self, dummy_frame):
        """Empty predictions list returns UNKNOWN."""
        mock_client = MagicMock()
        mock_client.infer.return_value = {"predictions": []}
        detector = FanDetector(api_key="mock_key", client=mock_client)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "UNKNOWN"
        assert "No fan predictions" in obs.error

    def test_low_confidence_prediction(self, dummy_frame):
        """Prediction below confidence threshold (e.g. 0.40 < 0.65) must return UNKNOWN."""
        mock_client = MagicMock()
        mock_client.infer.return_value = {
            "predictions": [
                {"class": "ceiling_fan_on", "confidence": 0.40}
            ]
        }
        detector = FanDetector(api_key="mock_key", confidence_threshold=0.65, client=mock_client)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "UNKNOWN"
        assert "below threshold" in obs.error

    def test_unexpected_class_name(self, dummy_frame):
        """Unexpected class name like 'light_bulb' returns UNKNOWN."""
        mock_client = MagicMock()
        mock_client.infer.return_value = {
            "predictions": [
                {"class": "light_bulb", "confidence": 0.95}
            ]
        }
        detector = FanDetector(api_key="mock_key", client=mock_client)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "UNKNOWN"

    def test_malformed_response(self, dummy_frame):
        """Malformed response (not a dict or missing keys) safely returns UNKNOWN."""
        mock_client = MagicMock()
        mock_client.infer.return_value = ["invalid_list_response"]
        detector = FanDetector(api_key="mock_key", client=mock_client)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "UNKNOWN"
        assert "Malformed response" in obs.error

    def test_api_timeout_and_network_failure(self, dummy_frame):
        """Network timeout or connection exception safely returns UNKNOWN and never OFF."""
        mock_client = MagicMock()
        mock_client.infer.side_effect = TimeoutError("HTTP connection timed out")
        detector = FanDetector(api_key="mock_key", client=mock_client)
        obs = detector.predict_frame(dummy_frame)
        assert obs.raw_status == "UNKNOWN"
        assert "timed out" in obs.error


class TestFanTracker:
    def test_temporal_stabilization_requires_consecutive_readings(self):
        """FanTracker requires stabilization_count (e.g. 2) consecutive matches before transitioning."""
        tracker = FanTracker(detector=MagicMock(), stabilization_count=2, stale_timeout=10.0)

        # First observation: ON -> state remains UNKNOWN until verified twice
        tracker._record_observation(FanObservation(raw_status="ON", confidence=0.8, timestamp=time.time()))
        status, raw, _, _ = tracker.get_status()
        assert status == "UNKNOWN"
        assert raw == "ON"

        # Second observation: ON -> state stabilizes to ON
        tracker._record_observation(FanObservation(raw_status="ON", confidence=0.85, timestamp=time.time()))
        status, _, _, _ = tracker.get_status()
        assert status == "ON"

        # Transitioning to OFF requires 2 consecutive OFF readings
        tracker._record_observation(FanObservation(raw_status="OFF", confidence=0.9, timestamp=time.time()))
        status, _, _, _ = tracker.get_status()
        assert status == "ON"  # Still ON, waiting for second OFF

        tracker._record_observation(FanObservation(raw_status="OFF", confidence=0.92, timestamp=time.time()))
        status, _, _, _ = tracker.get_status()
        assert status == "OFF"  # Successfully transitioned to OFF

    def test_stale_inference_results_become_unknown(self):
        """If last valid inference occurred longer ago than stale_timeout, status must become UNKNOWN."""
        tracker = FanTracker(detector=MagicMock(), stabilization_count=1, stale_timeout=2.0)

        old_timestamp = time.time() - 5.0  # 5 seconds ago (exceeds 2s timeout)
        tracker._record_observation(FanObservation(raw_status="ON", confidence=0.9, timestamp=old_timestamp))

        # Check status: stale timeout triggered
        status, raw, _, _ = tracker.get_status()
        assert status == "UNKNOWN"
        assert raw == "ON"

    def test_unknown_raw_clears_stabilization_buffer(self):
        """An UNKNOWN observation resets intermediate transition buffer."""
        tracker = FanTracker(detector=MagicMock(), stabilization_count=2, stale_timeout=10.0)

        # 1 ON reading
        tracker._record_observation(FanObservation(raw_status="ON", confidence=0.8, timestamp=time.time()))
        assert tracker.stabilized_status == "UNKNOWN"

        # UNKNOWN reading interrupts sequence
        tracker._record_observation(FanObservation(raw_status="UNKNOWN", confidence=0.0, timestamp=time.time()))

        # Next single ON reading must not trigger stabilization
        tracker._record_observation(FanObservation(raw_status="ON", confidence=0.8, timestamp=time.time()))
        assert tracker.stabilized_status == "UNKNOWN"
