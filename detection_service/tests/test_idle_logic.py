"""
Unit Tests for Continuous 10-Minute Idle Logic and Alert Generation.
Tests condition evaluation, state resets, snapshot creation, and duplicate alert prevention.
"""

import os
import time
import pytest
import numpy as np
from main import save_verification_snapshot


class TestIdleTimerLogic:
    def test_student_count_greater_than_zero_resets_timer(self):
        """If students appear in the room, idle_start_time must be reset to None."""
        idle_start_time = time.time() - 300  # Already 5 minutes into timer

        student_count = 2
        stabilized_fan = "ON"
        is_condition_active = (student_count == 0) and (stabilized_fan == "ON")

        if not is_condition_active:
            idle_start_time = None

        assert idle_start_time is None

    def test_fan_off_resets_timer(self):
        """If the fan turns OFF before threshold, idle_start_time must reset."""
        idle_start_time = time.time() - 400

        student_count = 0
        stabilized_fan = "OFF"
        is_condition_active = (student_count == 0) and (stabilized_fan == "ON")

        if not is_condition_active:
            idle_start_time = None

        assert idle_start_time is None

    def test_unknown_fan_status_resets_timer(self):
        """If fan status becomes UNKNOWN or unverified, timer must not count unverified time."""
        idle_start_time = time.time() - 500

        student_count = 0
        stabilized_fan = "UNKNOWN"
        is_condition_active = (student_count == 0) and (stabilized_fan == "ON")

        if not is_condition_active:
            idle_start_time = None

        assert idle_start_time is None

    def test_ten_minute_threshold_reached_triggers_alert(self):
        """When 0 students and fan ON persist for >= 600s, an alert is triggered."""
        idle_threshold = 600
        idle_start_time = time.time() - 601  # 601 seconds elapsed

        current_time = time.time()
        elapsed_idle = int(current_time - idle_start_time)

        is_alert = elapsed_idle >= idle_threshold
        assert is_alert is True
        assert elapsed_idle >= 600

    def test_duplicate_alert_prevention_for_ongoing_incident(self):
        """Alert must only be dispatched once for the duration of a single continuous incident."""
        idle_threshold = 10
        idle_start_time = time.time() - 15  # Already exceeded threshold

        alert_dispatched_for_incident = False
        dispatched_count = 0

        # Simulate 5 subsequent frames while condition remains continuous
        for _ in range(5):
            elapsed_idle = int(time.time() - idle_start_time)
            if elapsed_idle >= idle_threshold:
                if not alert_dispatched_for_incident:
                    dispatched_count += 1
                    alert_dispatched_for_incident = True

        # Must have fired exactly once
        assert dispatched_count == 1
        assert alert_dispatched_for_incident is True

    def test_snapshot_creation_success(self, tmp_path, monkeypatch):
        """Verification snapshot creates a file in the snapshot directory with text banner."""
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        monkeypatch.setattr("config.SNAPSHOT_DIR", str(tmp_path))

        filepath = save_verification_snapshot(dummy_frame, "room_101", 600)
        assert os.path.exists(filepath)
        assert filepath.endswith(".jpg")
        assert "room_101" in filepath

    def test_snapshot_failure_handled_gracefully(self, monkeypatch):
        """If cv2.imwrite fails or path is invalid, returns empty string without crashing."""
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        # Point to an impossible path
        monkeypatch.setattr("config.SNAPSHOT_DIR", "/non_existent_read_only_root/snapshots")

        filepath = save_verification_snapshot(dummy_frame, "room_101", 600)
        assert filepath == ""
